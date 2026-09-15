import { spawnSync } from 'node:child_process';
import { cp, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const name = `familytime-${new Date().toISOString().replace(/[^0-9T]/g, '').slice(0, 15)}`;
const output = resolve(root, 'dist', name);
function run(command, args, cwd = root, env = process.env) {
  const result = spawnSync(command, args, { cwd, env, stdio: 'inherit' });
  if (result.error || result.status !== 0) throw result.error ?? new Error(`${command} failed`);
}
run('npx', ['pnpm@10.12.1', 'build']);
await mkdir(resolve(output, 'backend'), { recursive: true });
run(process.env.GO_BIN || 'go', ['build', '-trimpath', '-ldflags=-s -w', '-o', resolve(output, 'backend/pocketbase'), '.'], resolve(root, 'pocketbase'),
  { ...process.env, GOEXPERIMENT: 'nojsonv2', GOOS: 'linux', GOARCH: 'amd64', CGO_ENABLED: '0' });
await cp(resolve(root, 'apps/web/build'), resolve(output, 'web'), { recursive: true });
for (const directory of ['pb_hooks', 'pb_migrations']) await cp(resolve(root, 'pocketbase', directory), resolve(output, 'backend', directory), { recursive: true });
await cp(resolve(root, 'deploy'), resolve(output, 'deploy'), { recursive: true, filter: (path) => !/\/\.env(?!\.example$)/.test(path) });
const checksums = [];
async function walk(path) {
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const file = resolve(path, entry.name);
    if (entry.isDirectory()) await walk(file);
    else checksums.push(`${createHash('sha256').update(await readFile(file)).digest('hex')}  ${relative(output, file)}`);
  }
}
await walk(output);
await writeFile(resolve(output, 'SHA256SUMS'), checksums.sort().join('\n') + '\n');
// macOS AppleDouble files look like executable JS migrations to PocketBase on Linux.
run('tar', ['--no-xattrs', '-czf', `${output}.tar.gz`, '-C', dirname(output), name], root,
  { ...process.env, COPYFILE_DISABLE: '1' });
const listing = spawnSync('tar', ['-tzf', `${output}.tar.gz`], { encoding: 'utf8' });
if (listing.status !== 0 || listing.stdout.split('\n').some((path) => /(^|\/)\._/.test(path))) {
  throw new Error('Release archive validation failed: unexpected AppleDouble metadata');
}
console.log(`Local release only: ${output}.tar.gz`);
