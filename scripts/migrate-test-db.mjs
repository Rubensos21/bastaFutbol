import 'dotenv/config';
import { spawnSync } from 'node:child_process';
const testDatabase = process.env.TEST_DATABASE_URL;
if (!testDatabase || !new URL(testDatabase).pathname.endsWith('_test'))
  throw new Error('TEST_DATABASE_URL debe terminar en una base con sufijo _test.');
const result = spawnSync('pnpm', ['--filter', '@basta/server', 'db:migrate'], {
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL: testDatabase },
});
process.exitCode = result.status ?? 1;
