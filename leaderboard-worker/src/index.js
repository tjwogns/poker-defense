const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const NAME_RE = /^[가-힣A-Za-z0-9 ]{3,30}$/;

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') ?? '';
    const cors = corsHeaders(origin, env.ALLOWED_ORIGIN);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    const url = new URL(request.url);
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
  const allowed = origin === allowedOrigin || origin.startsWith('http://127.0.0.1:') || origin.startsWith('http://localhost:');
  return {
    'access-control-allow-origin': allowed ? origin : allowedOrigin,
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
    'vary': 'Origin',
  };
}

function json(payload, status, headers) {
  return new Response(JSON.stringify(payload), { status, headers });
}
