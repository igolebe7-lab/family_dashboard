import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const command = process.argv[2];
if (!['build', 'test'].includes(command)) throw new Error('Use backend.mjs build|test');
if (command === 'test') {
  const hooks = spawnSync(process.execPath, ['--test', 'scripts/recurrence-materialization.test.mjs'], { cwd: root, stdio: 'inherit' });
  if (hooks.error) throw hooks.error;
  if (hooks.status !== 0) process.exit(hooks.status ?? 1);
}
const args = command === 'build' ? ['build', '-trimpath', '-o', 'pocketbase', '.'] : ['test', '-race', './...'];
const result = spawnSync(process.env.GO_BIN || 'go', args, { cwd: resolve(root, 'pocketbase'),
  env: { ...process.env, GOEXPERIMENT: 'nojsonv2' }, stdio: 'inherit' });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
