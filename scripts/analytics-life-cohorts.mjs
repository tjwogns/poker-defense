import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export const USAGE = 'npm run analytics:life -- --local --from YYYY-MM-DD --as-of YYYY-MM-DD [--version vX.Y.Z]\nRemote requires explicit --remote. --as-of is exclusive UTC midnight. No rows/identifiers are exported.';
const currentVersion = () => readFileSync(new URL('../src/meta/patchNotes.ts', import.meta.url), 'utf8').match(/CURRENT_VERSION = '([^']+)'/)[1];

export function parseArgs(args) {
  const options = { version: currentVersion(), target: null };
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === '--help') return null;
    if (arg === '--local' || arg === '--remote') {
      if (options.target) throw new Error('Choose exactly one target.');
      options.target = arg;
    } else if (['--version', '--from', '--as-of'].includes(arg)) {
      const key = arg === '--as-of' ? 'asOf' : arg.slice(2);
      if (!args[index + 1] || args[index + 1].startsWith('--')) throw new Error(`Missing ${arg} value.`);
      options[key] = args[++index];
    } else throw new Error(`Unknown option: ${arg}`);
  }
  if (!options.target) return null;
  for (const value of [options.from, options.asOf]) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? '') || !Number.isFinite(Date.parse(`${value}T00:00:00Z`))
      || new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value) throw new Error('Dates must be valid YYYY-MM-DD UTC dates.');
  }
  if (options.from >= options.asOf) throw new Error('--from must precede --as-of.');
  if (!/^v\d+\.\d+\.\d+$/.test(options.version)) throw new Error('Version must be vX.Y.Z.');
  return options;
}

export function buildCohortSql({ version, from, asOf }) {
  // Parameters are validated even when this module is imported rather than invoked.
  parseArgs(['--local', '--version', version, '--from', from, '--as-of', asOf]);
  return `WITH
  events AS (
    SELECT *, julianday(received_at) AS at,
      CASE WHEN json_valid(properties_json) THEN properties_json ELSE '{}' END AS props
    FROM analytics_events
    WHERE julianday(received_at) < julianday('${asOf}')
  ),
  ordered_starts AS (
    SELECT *, ROW_NUMBER() OVER (PARTITION BY run_id ORDER BY at, received_at, id) AS ordinal
    FROM events WHERE name = 'run_started' AND NULLIF(TRIM(run_id), '') IS NOT NULL
  ),
  starts AS (SELECT * FROM ordered_starts WHERE ordinal = 1),
  cohort AS (
    SELECT *, CASE WHEN json_type(props, '$.crownLevel') = 'integer' AND json_extract(props, '$.crownLevel') >= 0
      THEN json_extract(props, '$.crownLevel') ELSE 'unknown' END AS crown,
      CASE WHEN json_type(props, '$.firstRun') IN ('true', 'false') THEN json_extract(props, '$.firstRun')
        ELSE json_type(props, '$.tutorialDone') = 'false' END AS first_run
    FROM starts WHERE game_version = '${version}' AND json_extract(props, '$.ruleset') = 'life-economy'
      AND at >= julianday('${from}')
  ),
  followups AS (
    SELECT e.*, c.crown, c.first_run FROM events e JOIN cohort c ON e.run_id = c.run_id AND e.at >= c.at
  ),
  run_flags AS (
    SELECT c.run_id, c.crown,
      EXISTS(SELECT 1 FROM followups f WHERE f.run_id = c.run_id AND f.name = 'combat_started' AND json_extract(f.props, '$.round') = 1) AS r1_combat,
      EXISTS(SELECT 1 FROM followups f WHERE f.run_id = c.run_id AND f.name = 'round_reached' AND json_extract(f.props, '$.round') = 2) AS r2,
      EXISTS(SELECT 1 FROM followups f WHERE f.run_id = c.run_id AND f.name = 'run_finished' AND json_extract(f.props, '$.round') = 1) AS r1_finished,
      EXISTS(SELECT 1 FROM followups f WHERE f.run_id = c.run_id AND f.name = 'run_abandoned' AND json_extract(f.props, '$.round') = 1) AS r1_abandoned,
      EXISTS(SELECT 1 FROM followups f WHERE f.run_id = c.run_id AND f.name = 'run_finished' AND json_extract(f.props, '$.round') > 1) AS later_finished
    FROM cohort c
  ),
  step_names(step, sort) AS (VALUES ('run_started', 1), ('card_held', 2), ('cards_exchanged', 3), ('hand_confirmed', 4), ('unit_placed', 5), ('combat_started', 6), ('first_combat_cleared', 7)),
  step_rows AS (
    SELECT *, json_extract(props, '$.step') AS step,
      ROW_NUMBER() OVER (PARTITION BY run_id, json_extract(props, '$.step') ORDER BY at, received_at, id) AS step_ordinal
    FROM followups WHERE first_run = 1 AND name = 'onboarding_step'
  ),
  steps AS (
    SELECT *, CASE WHEN json_type(props, '$.durationSeconds') IN ('integer', 'real')
      AND json_extract(props, '$.durationSeconds') >= 0 AND json_extract(props, '$.durationSeconds') < 1e308
      THEN json_extract(props, '$.durationSeconds') END AS duration
    FROM step_rows WHERE step_ordinal = 1
  ),
  life_visitor_starts AS (
    SELECT *, ROW_NUMBER() OVER (PARTITION BY visitor_hash ORDER BY at, received_at, id) AS visitor_ordinal
    FROM starts WHERE json_extract(props, '$.ruleset') = 'life-economy' AND NULLIF(TRIM(visitor_hash), '') IS NOT NULL
  ),
  mature_visitors AS (
    SELECT v.*, c.crown, EXISTS(SELECT 1 FROM life_visitor_starts r WHERE r.visitor_hash = v.visitor_hash
      AND date(r.received_at) = date(v.received_at, '+1 day')) AS returned
    FROM life_visitor_starts v JOIN cohort c ON c.run_id = v.run_id
    WHERE v.visitor_ordinal = 1 AND julianday(date(v.received_at), '+2 days') <= julianday('${asOf}')
  )
  SELECT 'quality' AS section, json_object(
    'cohortRuns', (SELECT COUNT(*) FROM cohort),
    'missingVisitorRuns', (SELECT COUNT(*) FROM cohort WHERE NULLIF(TRIM(visitor_hash), '') IS NULL),
    'missingVisitorPercent', (SELECT ROUND(100.0 * SUM(NULLIF(TRIM(visitor_hash), '') IS NULL) / NULLIF(COUNT(*), 0), 1) FROM cohort),
    'firstRunCohort', (SELECT COUNT(*) FROM cohort WHERE first_run = 1),
    'finishedLaterWithoutR2Event', (SELECT COUNT(*) FROM run_flags WHERE later_finished AND NOT r2),
    'unknownTutorialRuns', (SELECT COUNT(*) FROM cohort WHERE json_type(props, '$.tutorialDone') IS NULL),
    'firstRunTutorialDisagreements', (SELECT COUNT(*) FROM cohort WHERE json_type(props, '$.firstRun') IN ('true', 'false') AND json_type(props, '$.tutorialDone') IN ('true', 'false') AND json_extract(props, '$.firstRun') = json_extract(props, '$.tutorialDone')),
    'missingRunIdStarts', (SELECT COUNT(*) FROM events WHERE name = 'run_started' AND game_version = '${version}' AND at >= julianday('${from}') AND json_extract(props, '$.ruleset') = 'life-economy' AND NULLIF(TRIM(run_id), '') IS NULL)
  ) AS data
  UNION ALL
  SELECT 'crowns', json_object('crown', crown, 'started', COUNT(*), 'r1Combat', SUM(r1_combat), 'r2Reached', SUM(r2),
    'r1FinishedWithoutR2', SUM(r1_finished AND NOT r2), 'r1AbandonedOnlyWithoutR2', SUM(r1_abandoned AND NOT r1_finished AND NOT later_finished AND NOT r2),
    'unresolvedWithoutR2', SUM(NOT r1_finished AND NOT r1_abandoned AND NOT later_finished AND NOT r2)) FROM run_flags GROUP BY crown
  UNION ALL
  SELECT 'onboarding', json_object('step', n.step, 'firstRunDenominator', (SELECT COUNT(*) FROM cohort WHERE first_run = 1),
    'reached', COUNT(s.run_id), 'validDurationCount', COUNT(s.duration), 'avgDurationSeconds', ROUND(AVG(s.duration), 1))
    FROM step_names n LEFT JOIN steps s ON s.step = n.step GROUP BY n.step, n.sort
  UNION ALL
  SELECT 'd1', json_object('matureVisitors', COUNT(*), 'returnedVisitors', COALESCE(SUM(returned), 0),
    'returnPercent', ROUND(100.0 * SUM(returned) / NULLIF(COUNT(*), 0), 1)) FROM mature_visitors
  UNION ALL
  SELECT 'd1_by_crown', json_object('crown', crown, 'matureVisitors', COUNT(*), 'returnedVisitors', SUM(returned),
    'returnPercent', ROUND(100.0 * SUM(returned) / COUNT(*), 1)) FROM mature_visitors GROUP BY crown;`;
}

export function parseAggregateResponse(stdout) {
  const fields = {
    quality: ['cohortRuns', 'missingVisitorRuns', 'missingVisitorPercent', 'firstRunCohort', 'finishedLaterWithoutR2Event', 'unknownTutorialRuns', 'firstRunTutorialDisagreements', 'missingRunIdStarts'],
    crowns: ['crown', 'started', 'r1Combat', 'r2Reached', 'r1FinishedWithoutR2', 'r1AbandonedOnlyWithoutR2', 'unresolvedWithoutR2'],
    onboarding: ['step', 'firstRunDenominator', 'reached', 'validDurationCount', 'avgDurationSeconds'],
    d1: ['matureVisitors', 'returnedVisitors', 'returnPercent'],
    d1_by_crown: ['crown', 'matureVisitors', 'returnedVisitors', 'returnPercent'],
  };
  const steps = ['run_started', 'card_held', 'cards_exchanged', 'hand_confirmed', 'unit_placed', 'combat_started', 'first_combat_cleared'];
  try {
    const batches = JSON.parse(stdout);
    if (!Array.isArray(batches) || batches.length === 0) throw new Error();
    return batches.flatMap((batch) => {
      if (!batch || batch.success === false || !Array.isArray(batch.results)) throw new Error();
      return batch.results.map((row) => {
        if (!row || !Object.hasOwn(fields, row.section) || typeof row.data !== 'string') throw new Error();
        const data = JSON.parse(row.data);
        const keys = fields[row.section];
        if (!data || typeof data !== 'object' || Array.isArray(data) || Object.keys(data).length !== keys.length) throw new Error();
        const safe = { section: row.section };
        for (const key of keys) {
          const value = data[key];
          if (key === 'step' ? !steps.includes(value)
            : key === 'crown' ? !(value === 'unknown' || (Number.isInteger(value) && value >= 0))
            : !(value === null || (typeof value === 'number' && Number.isFinite(value) && value >= 0))) throw new Error();
          safe[key] = value;
        }
        return safe;
      });
    });
  } catch {
    throw new Error('Invalid aggregate response; raw database output was suppressed.');
  }
}

export function assertClosedUtcAsOf(asOf, now = new Date()) {
  if (!Number.isFinite(now.getTime()) || asOf > now.toISOString().slice(0, 10)) {
    throw new Error('closed UTC dates only');
  }
}

export function runCli(args, { now = () => new Date(), execute = spawnSync } = {}) {
  const options = parseArgs(args);
  if (!options) { console.log(USAGE); return; }
  // Reject incomplete/future calendar windows before touching either database target.
  // The pure SQL builder deliberately has no wall-clock dependency for fixtures.
  assertClosedUtcAsOf(options.asOf, now());
  const result = execute(process.platform === 'win32' ? 'node_modules/.bin/wrangler.cmd' : './node_modules/.bin/wrangler',
    ['d1', 'execute', 'royal-siege-leaderboard', options.target, '--json', '--command', buildCohortSql(options)],
    { cwd: new URL('../leaderboard-worker/', import.meta.url), encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  if (result.error || result.status !== 0) throw new Error('Read-only cohort query failed. Check the selected database and migrations; no raw response was printed.');
  const rows = parseAggregateResponse(result.stdout);
  console.log(JSON.stringify({ version: options.version, from: options.from, asOfExclusiveUTC: options.asOf,
    caveats: ['Consent-only browser observations; QA may be included.', 'First retained LIFE start is not a new person; 90-day retention limits history.', 'D1 is next UTC calendar day; menu/classic excluded. Numeric duration strings are excluded.', 'Abandonment may be a page-hide signal, not permanent churn. Unresolved is not a loss.'],
    results: rows,
  }, null, 2));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { runCli(process.argv.slice(2)); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
