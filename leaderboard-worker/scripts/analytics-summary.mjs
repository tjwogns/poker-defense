import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const sql = readFileSync(new URL('../queries/analytics-summary.sql', import.meta.url), 'utf8');
const wrangler = process.platform === 'win32'
  ? 'node_modules\\.bin\\wrangler.cmd'
  : './node_modules/.bin/wrangler';
const location = process.argv.includes('--local') ? '--local' : '--remote';
const statements = sql.split(';').map((statement) => statement.trim()).filter(Boolean);

for (const [index, statement] of statements.entries()) {
  console.log(`\n=== analytics ${index + 1}/${statements.length} ===`);
  const result = spawnSync(
    wrangler,
    ['d1', 'execute', 'royal-siege-leaderboard', location, '--command', statement],
    { cwd: new URL('..', import.meta.url), stdio: 'inherit' },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) {
    process.exitCode = result.status ?? 1;
    break;
  }
}
