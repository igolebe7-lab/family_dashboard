import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
assert.equal(process.env.SMOKE_ISOLATED, '1');
const root = process.env.PB_URL;
async function request(path, token, body, method = body ? 'POST' : 'GET') {
  const response = await fetch(root + path, { method, headers: { Authorization: token || '', 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  return { status: response.status, data: await response.json().catch(() => null) };
}
async function ok(...args) { const result = await request(...args); assert.equal(result.status, 200, JSON.stringify(result)); return result.data; }
const users = '/api/collections/users';
const admin = (await ok('/api/collections/_superusers/auth-with-password', '', { identity: process.env.PB_SUPERUSER_EMAIL, password: process.env.PB_SUPERUSER_PASSWORD })).token;
async function account(zone) {
  const email = `timezone.${randomUUID()}@familytime.local`, password = randomUUID();
  const user = await ok(`${users}/records`, '', { email, password, passwordConfirm: password, ...(zone ? { timezone: zone } : {}) });
  return { user, token: (await ok(`${users}/auth-with-password`, '', { identity: email, password })).token };
}
const first = await account(), second = await account('America/New_York');
assert.equal(first.user.timezone, '');
assert.equal(second.user.timezone, 'America/New_York');
await ok(`${users}/records/${first.user.id}`, first.token, { timezone: 'Europe/Moscow' }, 'PATCH');
for (const zone of ['UTC', 'Europe/Amsterdam', 'Asia/Kathmandu']) {
  assert.equal((await ok(`${users}/records/${first.user.id}`, first.token, { timezone: zone }, 'PATCH')).timezone, zone);
}
for (const zone of ['Unknown/Invalid', 'Local', 'Europe/Moscow\n', 'x'.repeat(81)]) {
  assert.equal((await request(`${users}/records/${first.user.id}`, first.token, { timezone: zone }, 'PATCH')).status, 400);
  assert.equal((await ok(`${users}/records/${first.user.id}`, first.token)).timezone, 'Asia/Kathmandu');
}
assert.ok([403,404].includes((await request(`${users}/records/${second.user.id}`, first.token, { timezone: 'UTC' }, 'PATCH')).status));
assert.equal((await ok(`${users}/records/${second.user.id}`, second.token)).timezone, 'America/New_York');
assert.equal((await ok(`${users}/records/${first.user.id}`, first.token, { timezone: '' }, 'PATCH')).timezone, '');
for (const user of [first.user, second.user]) assert.equal((await request(`${users}/records/${user.id}`, admin, null, 'DELETE')).status, 204);
console.log('PASS timezones: legacy/default compatibility, account persistence, valid IANA zones, invalid rejection and cross-account isolation');
