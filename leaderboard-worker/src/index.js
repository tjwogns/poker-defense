const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const NAME_RE = /^[가-힣A-Za-z0-9 ]{3,30}$/;
const ID_RE = /^[A-Za-z0-9_-]{8,100}$/;
const VERSION_RE = /^v\d+\.\d+(?:\.\d+)?(?:-[A-Za-z0-9.-]+)?$/;
const ANALYTICS_RETENTION_DAYS = 90;
const ANALYTICS_EVENT_NAMES = new Set([
  'menu_view', 'consent_granted', 'run_started', 'tutorial_finished', 'hand_confirmed',
  'combat_started', 'round_reached', 'placement_blocked', 'unit_fused', 'relic_selected',
  'run_finished', 'run_abandoned', 'retry_clicked', 'result_shared', 'leaderboard_viewed',
  'leaderboard_submitted', 'synergy_activated', 'patch_notes_viewed', 'background_pause',
  'upgrade_bought', 'odds_opened', 'boss_encountered', 'boss_defeated', 'boss_survived',
  'deck_opened', 'deck_modified', 'maintenance_opened', 'maintenance_purchase',
  'maintenance_relic_purchase', 'maintenance_closed', 'relic_sold', 'relic_triggered',
]);

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') ?? '';
    const cors = corsHeaders(origin, env.ALLOWED_ORIGIN);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    const url = new URL(request.url);
    if (url.pathname === '/analytics') {
      if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, cors);
      return await collectAnalytics(request, env, cors);
    }
    if (url.pathname !== '/' && url.pathname !== '/leaderboard') {
      return json({ error: 'not_found' }, 404, cors);
    }

    try {
      if (request.method === 'GET') return await listScores(url, env, cors);
      if (request.method === 'POST') return await submitScore(request, env, cors);
      return json({ error: 'method_not_allowed' }, 405, cors);
    } catch {
      return json({ error: 'internal_error' }, 500, cors);
    }
  },
};

async function collectAnalytics(request, env, cors) {
  if (!allowedRequestOrigin(request.headers.get('Origin') ?? '', env.ALLOWED_ORIGIN)) {
    return json({ error: 'origin_not_allowed' }, 403, cors);
  }
  if ((request.headers.get('content-type') ?? '').split(';')[0] !== 'application/json') {
    return json({ error: 'json_required' }, 415, cors);
  }
  const declaredLength = Number(request.headers.get('content-length') ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > 8192) {
    return json({ error: 'payload_too_large' }, 413, cors);
  }

  const body = await request.json();
  const invalid = validateAnalyticsSubmission(body);
  if (invalid) return json({ error: invalid }, 400, cors);

  const event = body.event;
  const propertiesJson = JSON.stringify(event.properties);
  if (propertiesJson.length > 4096) return json({ error: 'properties_too_large' }, 400, cors);
  const receivedAt = new Date().toISOString();
  const visitorHash = event.visitorId
    ? await hashPlayer(`analytics:${event.visitorId}`, env.PLAYER_HASH_SALT ?? '')
    : null;

  await env.DB.prepare(
    `INSERT OR IGNORE INTO analytics_events
       (id, name, occurred_at, received_at, visitor_hash, session_id, run_id, game_version, properties_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    event.id,
    event.name,
    event.at,
    receivedAt,
    visitorHash,
    event.sessionId,
    event.runId ?? null,
    body.gameVersion,
    propertiesJson,
  ).run();

  if (event.name === 'run_finished' || event.name === 'run_abandoned') {
    await env.DB.prepare(
      `DELETE FROM analytics_events WHERE received_at < datetime('now', '-${ANALYTICS_RETENTION_DAYS} days')`,
    ).run();
  }
  return json({ accepted: true }, 202, cors);
}

export function validateAnalyticsSubmission(body) {
  if (!body || typeof body !== 'object') return 'invalid_body';
  if (body.schema !== 'poker-defense-event-v1') return 'invalid_schema';
  if (typeof body.gameVersion !== 'string' || !VERSION_RE.test(body.gameVersion)) return 'invalid_version';
  const event = body.event;
  if (!event || typeof event !== 'object') return 'invalid_event';
  if (!ID_RE.test(event.id ?? '')) return 'invalid_event_id';
  if (!ANALYTICS_EVENT_NAMES.has(event.name)) return 'invalid_event_name';
  if (!isIsoDate(event.at)) return 'invalid_event_time';
  if (event.visitorId !== undefined && !ID_RE.test(event.visitorId ?? '')) return 'invalid_visitor';
  if (!ID_RE.test(event.sessionId ?? '')) return 'invalid_session';
  if (event.runId !== undefined && !ID_RE.test(event.runId ?? '')) return 'invalid_run';
  if (!validProperties(event.properties)) return 'invalid_properties';
  return '';
}

function validProperties(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const entries = Object.entries(value);
  if (entries.length > 20) return false;
  return entries.every(([key, item]) => {
    if (!/^[A-Za-z][A-Za-z0-9_]{0,39}$/.test(key)) return false;
    if (item === null || typeof item === 'boolean') return true;
    if (typeof item === 'number') return Number.isFinite(item);
    if (typeof item === 'string') return item.length <= 200;
    return Array.isArray(item)
      && item.length <= 20
      && item.every((part) => (
        (typeof part === 'string' && part.length <= 100)
        || (typeof part === 'number' && Number.isFinite(part))
      ));
  });
}

function isIsoDate(value) {
  return typeof value === 'string'
    && value.length <= 40
    && Number.isFinite(Date.parse(value));
}

async function listScores(url, env, cors) {
  const date = url.searchParams.get('date') ?? '';
  const limit = Math.min(20, Math.max(1, Number(url.searchParams.get('limit') ?? 10)));
  if (!DATE_RE.test(date) || !Number.isInteger(limit)) return json({ error: 'invalid_query' }, 400, cors);

  const playerId = url.searchParams.get('playerId') ?? '';
  const currentHash = playerId ? await hashPlayer(playerId, env.PLAYER_HASH_SALT ?? '') : '';
  const rows = await env.DB.prepare(
    `SELECT player_hash, display_name, score, round, result, submitted_at
       FROM leaderboard_entries
      WHERE date = ?
      ORDER BY score DESC, round DESC, submitted_at ASC
      LIMIT ?`,
  ).bind(date, limit).all();

  const entries = rows.results.map((row, index) => ({
    rank: index + 1,
    name: row.display_name,
    score: row.score,
    round: row.round,
    result: row.result,
    submittedAt: row.submitted_at,
    ...(currentHash && row.player_hash === currentHash ? { isCurrentPlayer: true } : {}),
  }));
  return json({ date, entries }, 200, cors);
}

async function submitScore(request, env, cors) {
  if ((request.headers.get('content-type') ?? '').split(';')[0] !== 'application/json') {
    return json({ error: 'json_required' }, 415, cors);
  }
  const body = await request.json();
  const invalid = validateSubmission(body);
  if (invalid) return json({ error: invalid }, 400, cors);
  if (body.date !== dateInKorea(new Date())) return json({ error: 'daily_closed' }, 409, cors);
  if (body.seed !== dailySeed(body.date)) return json({ error: 'invalid_seed' }, 400, cors);

  const playerHash = await hashPlayer(body.playerId, env.PLAYER_HASH_SALT ?? '');
  const previous = await env.DB.prepare(
    'SELECT score FROM leaderboard_entries WHERE date = ? AND player_hash = ?',
  ).bind(body.date, playerHash).first();
  const accepted = !previous || body.score > previous.score;
  const submittedAt = new Date().toISOString();

  await env.DB.prepare(
    `INSERT INTO leaderboard_entries
       (date, player_hash, display_name, score, round, kills, result, submitted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(date, player_hash) DO UPDATE SET
       display_name = excluded.display_name,
       score = excluded.score,
       round = excluded.round,
       kills = excluded.kills,
       result = excluded.result,
       submitted_at = excluded.submitted_at
     WHERE excluded.score > leaderboard_entries.score`,
  ).bind(
    body.date, playerHash, body.name, body.score, body.round,
    body.kills, body.result, submittedAt,
  ).run();

  const stored = await env.DB.prepare(
    'SELECT score, round, submitted_at FROM leaderboard_entries WHERE date = ? AND player_hash = ?',
  ).bind(body.date, playerHash).first();
  const ahead = await env.DB.prepare(
    `SELECT COUNT(*) AS count FROM leaderboard_entries
      WHERE date = ? AND (
        score > ? OR
        (score = ? AND round > ?) OR
        (score = ? AND round = ? AND submitted_at < ?)
      )`,
  ).bind(
    body.date, stored.score, stored.score, stored.round,
    stored.score, stored.round, stored.submitted_at,
  ).first();

  return json({ rank: Number(ahead.count) + 1, bestScore: stored.score, accepted }, 200, cors);
}

function validateSubmission(body) {
  if (!body || typeof body !== 'object') return 'invalid_body';
  if (body.schema !== 'royal-siege-leaderboard-v1') return 'invalid_schema';
  if (!DATE_RE.test(body.date)) return 'invalid_date';
  if (typeof body.playerId !== 'string' || body.playerId.length < 10 || body.playerId.length > 100) return 'invalid_player';
  if (typeof body.name !== 'string' || !NAME_RE.test(body.name)) return 'invalid_name';
  if (!isInt(body.seed, 1, 0xffffffff)) return 'invalid_seed';
  if (!isInt(body.score, 0, 10_000_000)) return 'invalid_score';
  if (!isInt(body.round, 1, 60)) return 'invalid_round';
  if (!isInt(body.kills, 0, 1_000_000)) return 'invalid_kills';
  if (body.result !== 'victory' && body.result !== 'defeat') return 'invalid_result';
  if (body.result === 'victory' && body.round !== 60) return 'invalid_victory';
  return '';
}

function isInt(value, min, max) {
  return Number.isInteger(value) && value >= min && value <= max;
}

function dailySeed(date) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < date.length; index++) {
    hash ^= date.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0 || 1;
}

function dateInKorea(now) {
  return new Date(now.getTime() + 9 * 60 * 60_000).toISOString().slice(0, 10);
}

async function hashPlayer(playerId, salt) {
  const bytes = new TextEncoder().encode(`${salt}:${playerId}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function corsHeaders(origin, allowedOrigin) {
  const allowed = allowedRequestOrigin(origin, allowedOrigin);
  return {
    'access-control-allow-origin': allowed ? origin : allowedOrigin,
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'access-control-allow-credentials': 'true',
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
    'vary': 'Origin',
  };
}

function allowedRequestOrigin(origin, allowedOrigin) {
  return origin === allowedOrigin
    || origin.startsWith('http://127.0.0.1:')
    || origin.startsWith('http://localhost:');
}

function json(payload, status, headers) {
  return new Response(JSON.stringify(payload), { status, headers });
}
