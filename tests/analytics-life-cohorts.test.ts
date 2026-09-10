import { afterEach, describe, expect, test, vi } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildCohortSql, parseAggregateResponse, parseArgs, runCli } from '../scripts/analytics-life-cohorts.mjs';

const directories: string[] = [];
afterEach(() => { for (const path of directories.splice(0)) rmSync(path, { recursive: true, force: true }); });
const options = { version: 'v2.9.4', from: '2026-09-01', asOf: '2026-09-04' };
const quote = (value: unknown) => value === null ? 'NULL' : `'${String(value).replaceAll("'", "''")}'`;

function database() {
  const directory = mkdtempSync(join(tmpdir(), 'life-cohort-test-'));
  directories.push(directory);
  const path = join(directory, 'analytics.sqlite');
  const schema = ['0001_create_leaderboard.sql', '0002_create_analytics.sql', '0003_add_analytics_visitor.sql']
    .map((name) => readFileSync(new URL(`../leaderboard-worker/migrations/${name}`, import.meta.url), 'utf8')).join('\n');
  execFileSync('sqlite3', [path], { input: schema });
  let sequence = 0;
  const event = (name: string, run: string | null, at: string, properties: object = {}, visitor: string | null = 'hash-private-default', version = options.version, received = at) => {
    const values = [`event-${sequence++}`, name, at, received, 'session-private-id', run, version, JSON.stringify(properties), visitor];
    execFileSync('sqlite3', [path], { input: `INSERT INTO analytics_events VALUES (${values.map(quote).join(',')});` });
  };
  const start = (run: string | null, day: string, visitor: string | null, crown = 0, tutorialDone = false, version = options.version, ruleset = 'life-economy') => {
    event('run_started', run, `${day}T00:00:00Z`, { ruleset, crownLevel: crown, tutorialDone }, visitor, version);
  };
  const report = (config = options) => {
    const raw = execFileSync('sqlite3', ['-readonly', '-json', path, buildCohortSql(config)], { encoding: 'utf8' });
    expect(raw).not.toMatch(/hash-private|session-private|event-\d/);
    return JSON.parse(raw).map((row: { section: string; data: string }) => ({ section: row.section, ...JSON.parse(row.data) }));
  };
  return { event, start, report };
}

describe('read-only LIFE cohort analytics', () => {
  test.each(['--local', '--remote'])('rejects not-yet-closed UTC windows before %s database invocation', (target) => {
    const execute = vi.fn();
    const args = [target, '--from', '2026-09-07', '--as-of', '2026-09-09'];
    for (const instant of ['2026-09-08T23:59:59.999Z', '2026-09-09T00:13:00+09:00']) {
      expect(() => runCli(args, { now: () => new Date(instant), execute })).toThrow('closed UTC dates only');
    }
    expect(execute).not.toHaveBeenCalled();
  });

  test.each(['--local', '--remote'])('allows a closed window at UTC midnight using a fake %s executor', (target) => {
    const execute = vi.fn(() => ({ status: 0, stdout: '[{"results":[]}]' }));
    const output = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      runCli([target, '--from', '2026-09-07', '--as-of', '2026-09-09'], {
        now: () => new Date('2026-09-09T09:00:00+09:00'), execute,
      });
      expect(execute).toHaveBeenCalledTimes(1);
      expect(execute.mock.calls[0][1]).toContain(target);
    } finally { output.mockRestore(); }
  });

  test('SQL generation remains date-independent for future fixture windows', () => {
    expect(buildCohortSql({ ...options, from: '2099-09-07', asOf: '2099-09-09' })).toContain("julianday('2099-09-09')");
  });

  test('no target prints usage; remote must be explicit and dates are strict', () => {
    expect(parseArgs([])).toBeNull();
    expect(parseArgs(['--from', options.from, '--as-of', options.asOf])).toBeNull();
    expect(parseArgs(['--local', '--from', options.from, '--as-of', options.asOf])?.target).toBe('--local');
    expect(parseArgs(['--remote', '--from', options.from, '--as-of', options.asOf])?.target).toBe('--remote');
    expect(() => parseArgs(['--local', '--remote'])).toThrow();
    expect(() => parseArgs(['--local', '--from', '2026-02-30', '--as-of', options.asOf])).toThrow();
    expect(() => buildCohortSql({ ...options, version: "v2.9.4';DELETE" })).toThrow();
  });

  test('deduplicates starts, separates crowns/rules/versions and includes later followups before cutoff', () => {
    const db = database();
    db.start('a', '2026-09-01', 'hash-private-a');
    db.start('a', '2026-09-02', 'hash-private-a', 5);
    db.start('b', '2026-09-02', 'hash-private-b', 1);
    db.start('c', '2026-09-03', 'hash-private-c', 0, true);
    db.start('d', '2026-09-01', null);
    db.start('e-old', '2026-08-31', 'hash-private-e', 0, false, 'v2.9.3');
    db.start('e', '2026-09-01', 'hash-private-e');
    db.start('f', '2026-09-02', 'hash-private-f');
    db.start(null, '2026-09-01', null);
    db.start('a-return', '2026-09-02', 'hash-private-a', 0, true, 'v2.9.3');
    db.start('f-return', '2026-09-03', 'hash-private-f', 0, true, 'v2.9.3');
    db.start('b-classic', '2026-09-03', 'hash-private-b', 0, false, options.version, 'classic');
    db.event('menu_viewed', null, '2026-09-03T02:00:00Z', {}, 'hash-private-b');
    db.event('combat_started', 'a', '2026-09-02T10:00:00Z', { round: 1 });
    db.event('round_reached', 'a', '2026-09-03T12:00:00Z', { round: 2 });
    db.event('run_abandoned', 'a', '2026-09-02T12:00:00Z', { round: 1 });
    db.event('run_finished', 'b', '2026-09-02T20:00:00Z', { round: 1 });
    db.event('round_reached', 'b', '2026-09-04T00:00:00Z', { round: 2 });
    db.event('combat_started', 'b', '2026-09-01T20:00:00Z', { round: 1 });
    db.event('onboarding_step', 'a', '2026-09-01T01:00:00Z', { step: 'hand_confirmed', durationSeconds: 10 });
    db.event('onboarding_step', 'a', '2026-09-01T02:00:00Z', { step: 'hand_confirmed', durationSeconds: 90 });
    db.event('onboarding_step', 'b', '2026-09-02T01:00:00Z', { step: 'hand_confirmed', durationSeconds: '20' });
    db.event('onboarding_step', 'd', '2026-09-01T01:00:00Z', { step: 'hand_confirmed' });
    db.event('onboarding_step', 'c', '2026-09-03T01:00:00Z', { step: 'hand_confirmed', durationSeconds: 100 });
    const report = db.report();
    expect(report.find((r: any) => r.section === 'quality')).toMatchObject({ cohortRuns: 6, missingVisitorRuns: 1, missingVisitorPercent: 16.7, firstRunCohort: 5, missingRunIdStarts: 1 });
    expect(report.find((r: any) => r.section === 'crowns' && r.crown === 0)).toMatchObject({ started: 5, r1Combat: 1, r2Reached: 1, r1FinishedWithoutR2: 0, r1AbandonedOnlyWithoutR2: 0, unresolvedWithoutR2: 4 });
    expect(report.find((r: any) => r.section === 'crowns' && r.crown === 1)).toMatchObject({ started: 1, r1Combat: 0, r2Reached: 0, r1FinishedWithoutR2: 1 });
    expect(report.find((r: any) => r.step === 'hand_confirmed')).toMatchObject({ reached: 3, validDurationCount: 1, avgDurationSeconds: 10, firstRunDenominator: 5 });
    expect(report.find((r: any) => r.step === 'cards_exchanged')).toMatchObject({ reached: 0, avgDurationSeconds: null });
    expect(report.find((r: any) => r.section === 'd1')).toMatchObject({ matureVisitors: 3, returnedVisitors: 2, returnPercent: 66.7 });
    expect(report.find((r: any) => r.section === 'd1_by_crown' && r.crown === 1)).toMatchObject({ matureVisitors: 1, returnedVisitors: 0 });
    // Start cohorts are selected before followups; narrower start period still retains later events.
    expect(db.report({ ...options, asOf: '2026-09-03' }).find((r: any) => r.section === 'd1')).toMatchObject({ matureVisitors: 1, returnedVisitors: 1 });
  });

  test('empty reports have null rates, no invented durations and zero mature denominator', () => {
    const report = database().report();
    expect(report.find((r: any) => r.section === 'quality')).toMatchObject({ cohortRuns: 0, missingVisitorPercent: null });
    expect(report.find((r: any) => r.section === 'd1')).toMatchObject({ matureVisitors: 0, returnedVisitors: 0, returnPercent: null });
    expect(report.filter((r: any) => r.section === 'onboarding')).toHaveLength(7);
  });

  test('server timestamps override client clock, normalize UTC boundaries, and firstRun wins disagreements', () => {
    const db = database();
    db.event('run_started', 'clock', '2099-01-01', { ruleset: 'life-economy', crownLevel: 2, firstRun: true, tutorialDone: true }, 'hash-private-clock', options.version, '2026-09-01 00:00:00');
    db.event('run_started', 'returned', 'invalid-client-clock', { ruleset: 'life-economy' }, 'hash-private-clock', 'v2.9.3', '2026-09-02T09:00:00+09:00');
    db.event('onboarding_step', 'clock', 'invalid', { step: 'card_held', durationSeconds: -3 }, null, options.version, '2026-09-01T01:00:00Z');
    db.event('run_abandoned', 'clock', 'invalid', { round: 1 }, null, options.version, '2026-09-01T02:00:00Z');
    db.event('run_started', 'excluded', '2026-09-01', { ruleset: 'life-economy' }, null, options.version, '2026-09-04T09:00:00+09:00');
    db.event('run_started', 'not-first', '2026-09-01', { ruleset: 'life-economy', firstRun: false, tutorialDone: false }, null, options.version, '2026-09-01');
    db.event('run_finished', 'not-first', '2026-09-01', { round: 3 }, null, options.version, '2026-09-02');
    db.event('run_abandoned', 'not-first', '2026-09-01', { round: 1 }, null, options.version, '2026-09-01T01:00:00Z');
    const report = db.report();
    expect(report.find((r: any) => r.section === 'quality')).toMatchObject({ cohortRuns: 2, firstRunCohort: 1, firstRunTutorialDisagreements: 2, finishedLaterWithoutR2Event: 1 });
    expect(report.find((r: any) => r.section === 'crowns' && r.crown === 2)).toMatchObject({ r1AbandonedOnlyWithoutR2: 1, r1FinishedWithoutR2: 0 });
    expect(report.find((r: any) => r.step === 'card_held')).toMatchObject({ reached: 1, validDurationCount: 0, avgDurationSeconds: null });
    expect(report.find((r: any) => r.section === 'd1_by_crown')).toMatchObject({ crown: 2, matureVisitors: 1, returnedVisitors: 1 });
    expect(report.find((r: any) => r.section === 'crowns' && r.crown === 'unknown')).toMatchObject({ r1AbandonedOnlyWithoutR2: 0, unresolvedWithoutR2: 0 });
  });

  test('malformed JSON, embedded errors and unexpected identifiers never leak in errors or aggregate output', () => {
    for (const raw of ['raw-private-id', '[{"results":null}]',
      JSON.stringify([{ results: [{ section: 'd1', data: 'raw-private-id' }] }]),
      JSON.stringify([{ results: [{ section: 'd1', data: JSON.stringify({ matureVisitors: 1, returnedVisitors: 0, returnPercent: 'raw-private-id' }) }] }]),
      JSON.stringify([{ results: [{ section: 'visitor_id', data: '{}' }] }])]) {
      expect(() => parseAggregateResponse(raw)).toThrow('Invalid aggregate response; raw database output was suppressed.');
    }
    expect(parseAggregateResponse(JSON.stringify([{ results: [{ section: 'd1', data: '{"matureVisitors":1,"returnedVisitors":0,"returnPercent":0}' }] }]))).toEqual([{ section: 'd1', matureVisitors: 1, returnedVisitors: 0, returnPercent: 0 }]);
  });
});
