import { spawn, spawnSync } from 'node:child_process';
import { copyFile, cp, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { randomUUID } from 'node:crypto';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = 8091;
const probe = createServer();
probe.listen(port, '127.0.0.1');
await once(probe, 'listening');
await new Promise((resolve) => probe.close(resolve));
const dir = await mkdtemp(resolve(tmpdir(), 'familytime-backend-smoke-'));
const email = 'audit@familytime.local';
const password = randomUUID();
const binary = resolve(root, 'pocketbase/pocketbase');
const migrations = resolve(dir, 'migrations');
const repair = '20260911092000_repair_applied_access_rules.js';
const upgrade = process.env.SMOKE_LEGACY_REPAIR === '1';
const args = ['--automigrate=false', `--dir=${resolve(dir, 'data')}`, `--hooksDir=${resolve(dir, 'hooks')}`,
  `--migrationsDir=${migrations}`];
let server;
let output = '';
try {
  // Snapshot source files so a concurrent development server cannot rewrite or reload this run.
  await cp(resolve(root, 'pocketbase/pb_hooks'), resolve(dir, 'hooks'), { recursive: true });
  await cp(resolve(root, 'pocketbase/pb_migrations'), migrations, {
    recursive: true, filter: (source) => !upgrade || !source.endsWith(`/${repair}`)
  });
  if (upgrade) {
    // Reproduce an already-applied 091000 migration that skipped wrapped Go string rules.
    // This fixture exists only under the runner-owned temporary directory.
    await writeFile(resolve(migrations, '20260911091500_legacy_security_fixture.js'), `
migrate((app) => {
  for (const name of ['items', 'item_occurrences', 'item_activity', 'item_comments', 'notifications']) {
    const collection = app.findCollectionByNameOrId(name);
    for (const key of ['listRule', 'viewRule', 'updateRule', 'deleteRule', 'createRule']) {
      if (collection[key] == null) continue;
      let rule = String(collection[key]);
      for (const prefix of ['item.', '']) {
        for (const relation of ['assignees.managed_by', 'participants.managed_by', 'assignees', 'participants']) {
          rule = rule.split(prefix + relation + '.id ?= @collection.family_members:viewer.id')
            .join('@collection.family_members:viewer.id ?= ' + prefix + relation);
        }
      }
      collection[key] = rule;
    }
    if (name === 'notifications') collection.fields.getByName('body').max = 1;
    app.save(collection);
  }
});
`);
  }
  const setup = spawnSync(binary, ['superuser', 'upsert', email, password, ...args], { encoding: 'utf8' });
  if (setup.status !== 0) throw new Error(setup.stderr || setup.error || setup.stdout);
  if (upgrade) {
    // Startup must repair persisted legacy state, not just a fresh collection definition.
    await copyFile(resolve(root, 'pocketbase/pb_migrations', repair), resolve(migrations, repair));
  }
  server = spawn(binary, ['serve', `--http=127.0.0.1:${port}`, `--dev=${process.env.SMOKE_DEBUG === '1'}`, ...args]);
  server.stdout.on('data', (data) => { output += data; });
  server.stderr.on('data', (data) => { output += data; });
  const url = `http://127.0.0.1:${port}`;
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server.exitCode !== null) throw new Error(output);
    try { ready = (await fetch(`${url}/api/health`)).ok; } catch { /* Wait for the owned server. */ }
    if (ready) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  if (!ready) throw new Error(`PocketBase did not start: ${output}`);
  console.log(`Isolated backend smoke: ${upgrade ? 'legacy repair' : 'fresh migrations'}, port ${port}, automigrate=false`);
  for (const script of process.argv.slice(2).length ? process.argv.slice(2) : ['smoke-backend-security.mjs', 'smoke-pocketbase-stage4.mjs']) {
    const child = spawn(process.execPath, [resolve(root, 'scripts', script)], {
      cwd: root, stdio: 'inherit', env: { ...process.env, PB_URL: url,
        PB_SUPERUSER_EMAIL: email, PB_SUPERUSER_PASSWORD: password,
        SMOKE_KEEP_DATA: '0', SMOKE_CLEANUP_BEFORE: '0', SMOKE_CLEANUP_AFTER: '1', SMOKE_ISOLATED: '1' }
    });
    const [code] = await once(child, 'exit');
    if (code !== 0) throw new Error(`${script} failed (${code})\n${output.slice(-14000)}`);
  }
} finally {
  if (server && server.exitCode === null) {
    server.kill('SIGTERM');
    await once(server, 'exit');
  }
  // This directory was created by mkdtemp above; no configured/user database is touched.
  await rm(dir, { recursive: true, force: true });
}
