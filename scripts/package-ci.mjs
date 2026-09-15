import { cp, mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const output = resolve(root, 'dist/ci', commit);
await mkdir(resolve(output, 'backend'), { recursive: true });
execFileSync('go', ['build', '-trimpath', '-ldflags=-s -w', '-o', resolve(output, 'backend/pocketbase'), '.'], {
  cwd: resolve(root, 'pocketbase'), stdio: 'inherit',
  env: { ...process.env, GOEXPERIMENT: 'nojsonv2', GOOS: 'linux', GOARCH: 'amd64', CGO_ENABLED: '0' }
});
await cp(resolve(root, 'apps/web/build'), resolve(output, 'web'), { recursive: true });
for (const dir of ['pb_hooks', 'pb_migrations']) await cp(resolve(root, 'pocketbase', dir), resolve(output, 'backend', dir), { recursive: true });
await writeFile(resolve(output, 'release.json'), JSON.stringify({ commit }));
execFileSync('tar', [...(process.platform === 'darwin' ? ['--no-xattrs'] : []), '-czf', resolve(root, 'dist/ci-release.tar.gz'), '-C', output, 'release.json', 'web', 'backend'], { env: { ...process.env, COPYFILE_DISABLE: '1' } });
console.log(`Packaged full release ${commit}`);
