import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const sql = readFileSync(new URL('../queries/analytics-summary.sql', import.meta.url), 'utf8');
const wrangler = process.platform === 'win32'
  ? 'node_modules\\.bin\\wrangler.cmd'
  : './node_modules/.bin/wrangler';
const result = spawnSync(
  wrangler,
  ['d1', 'execute', 'royal-siege-leaderboard', '--remote', '--command', sql],
  { cwd: new URL('..', import.meta.url), stdio: 'inherit' },
);

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
