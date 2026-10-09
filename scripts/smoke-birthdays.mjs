import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
assert.equal(process.env.SMOKE_ISOLATED, '1');
const root = process.env.PB_URL;
async function request(path, token, body, method = body ? 'POST' : 'GET') {
  const response = await fetch(root + path, { method, headers: { Authorization: token || '', 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  return { status: response.status, data: await response.json().catch(() => null) };
}
async function ok(...args) { const result = await request(...args); assert.equal(result.status, 200, JSON.stringify(result)); return result.data; }
const admin = (await ok('/api/collections/_superusers/auth-with-password', '', { identity: process.env.PB_SUPERUSER_EMAIL, password: process.env.PB_SUPERUSER_PASSWORD })).token;
const upgrades = (await ok(`/api/collections/families/records?filter=${encodeURIComponent('slug="birthday-upgrade-fixture"')}`, admin)).items;
assert.equal(upgrades.length,1);
const upgraded = (await ok(`/api/collections/day_annotations/records?filter=${encodeURIComponent(`family="${upgrades[0].id}"`)}`,admin)).items;
assert.equal(upgraded.length,2);
const linked = upgraded.find(row => row.linked_member);
assert.equal(linked.birth_date.slice(0,10),'1980-06-18');
assert.equal(linked.description,'Keep this note');
assert.equal(linked.source,'family_member');
assert.equal(upgraded.find(row => !row.linked_member).birth_date,'');
console.log('PASS birthday migration: linked duplicates reconciled, profile DOB backfilled, notes retained, unknown external birth year not invented');
async function account() {
  const email = `birthday.${randomUUID()}@familytime.local`, password = randomUUID();
  const user = await ok('/api/collections/users/records', admin, { email, password, passwordConfirm: password });
  return { user, token: (await ok('/api/collections/users/auth-with-password', '', { identity: email, password })).token };
}
const owner = await account(), outsider = await account(), child = await account();
const family = await ok('/api/collections/families/records', owner.token, { name: 'Birthday test', slug: randomUUID(), owner_user: owner.user.id, timezone: 'UTC' });
const member = await ok('/api/collections/family_members/records', admin, { family: family.id, user: owner.user.id, display_name: 'Игорь', role: 'owner', active: true });
const path = '/api/collections/day_annotations/records';
const list = async (token = owner.token) => (await ok(`${path}?filter=${encodeURIComponent(`family="${family.id}"`)}`, token)).items;
const profile = await ok('/api/collections/family_members/records', owner.token, { family: family.id, display_name: 'Ева', role: 'child', user: child.user.id, managed_by: [member.id], birthday: '2018-06-18', color_key: 'peach', active: true });
let rows = await list();
assert.equal(rows.length, 1, 'Creating a member with DOB must create their birthday');
const id = rows[0].id;
assert.equal(rows[0].birth_date.slice(0,10), '2018-06-18');
assert.equal(rows[0].source, 'family_member');
assert.equal(rows[0].linked_member, profile.id);
assert.equal(rows[0].readonly, true);
assert.equal((await list(child.token)).length, 1);
assert.equal((await list(outsider.token)).length, 0);
await ok(`/api/collections/family_members/records/${profile.id}`, owner.token, { display_name: 'Ева Новая', birthday: '2019-02-28' }, 'PATCH');
rows = await list(); assert.equal(rows.length,1); assert.equal(rows[0].id,id);
assert.equal(rows[0].title, 'День рождения · Ева Новая'); assert.equal(rows[0].day,28); assert.equal(rows[0].month,2);
for (const body of [{ readonly:false, source:'manual' }, { birth_date:'2010-01-01' }, { family: family.id, created_by: member.id }]) {
  assert.ok([400,403,404].includes((await request(`${path}/${id}`, owner.token, body,'PATCH')).status));
}
assert.ok([400,403,404].includes((await request(`${path}/${id}`, owner.token, null,'DELETE')).status));
await ok(`/api/collections/family_members/records/${profile.id}`, owner.token, { active:false },'PATCH');
assert.equal((await list()).length,0);
await ok(`/api/collections/family_members/records/${profile.id}`, owner.token, { active:true },'PATCH');
assert.equal((await list()).length,1);
await ok(`/api/collections/family_members/records/${profile.id}`, owner.token, { birthday:'' },'PATCH');
assert.equal((await list()).length,0);
const input = { family:family.id, created_by:member.id, kind:'birthday', title:'Друг', person_name:'Друг', birth_date:'1984-02-29', month:10, day:8, recurrence:'one_time', year:2026, color:'blue', tone:'positive', visibility:'family', source:'manual' };
const manual = await ok(path, owner.token, input);
assert.equal(manual.month,2); assert.equal(manual.day,29); assert.equal(manual.recurrence,'yearly');
for (const birth_date of ['2200-01-01','2018-02-29']) assert.equal((await request(path,owner.token,{...input,birth_date})).status,400);
assert.equal((await request(path,owner.token,{...input,birth_date:''})).status,400);
for (const birthday of ['2200-01-01','2018-02-29']) {
  assert.equal((await request(`/api/collections/family_members/records/${profile.id}`,owner.token,{birthday},'PATCH')).status,400);
  assert.equal((await list()).length,1);
}
await ok(`/api/collections/family_members/records/${profile.id}`,owner.token,{birthday:'2018-06-18'},'PATCH');
assert.equal((await request(path, owner.token, {...input, source:'family_member', readonly:true, linked_member:profile.id})).status,403);
assert.equal((await request(path,child.token,{...input,created_by:profile.id})).status,403);
const annualInput = { ...input, kind:'family_date', title:'Годовщина', birth_date:'', origin_date:'1890-06-18', recurrence:'yearly' };
assert.equal((await request(path,child.token,{...annualInput,created_by:profile.id})).status,403);
assert.equal((await request(`/api/collections/family_members/records/${profile.id}`,owner.token,null,'DELETE')).status,204);
assert.equal((await list()).length,1, 'Deleting a profile must delete only its derived birthday');
console.log('PASS birthdays: automatic creation, same-record sync, deactivation, reactivation, removal, leap dates, manual DOB, child reads, family isolation and system write protection');
const annual = await ok(path, owner.token, annualInput);
assert.equal(annual.origin_date.slice(0,10),'1890-06-18');
assert.equal(annual.month,6); assert.equal(annual.day,18); assert.equal(annual.year,0);
for (const origin_date of ['2019-02-29','0999-01-01','not-a-date']) {
  assert.equal((await request(`${path}/${annual.id}`,owner.token,{origin_date},'PATCH')).status,400);
  assert.equal((await ok(`${path}/${annual.id}`,owner.token)).origin_date.slice(0,10),'1890-06-18');
}
const editedAnnual = await ok(`${path}/${annual.id}`,owner.token,{origin_date:'2040-02-29'},'PATCH');
assert.equal(editedAnnual.day,29); assert.equal(editedAnnual.month,2);
const once = await ok(`${path}/${annual.id}`,owner.token,{recurrence:'one_time',year:2027,month:5,day:1},'PATCH');
assert.equal(once.origin_date,''); assert.equal(once.year,2027); assert.equal(once.month,5); assert.equal(once.day,1);
const unknown = await ok(`${path}/${annual.id}`,owner.token,{recurrence:'yearly',origin_date:''},'PATCH');
assert.equal(unknown.origin_date,'');
assert.ok([400,403,404].includes((await request(`${path}/${annual.id}`,outsider.token,{origin_date:'2000-01-01'},'PATCH')).status));
console.log('PASS special dates: origin date normalization, editing, leap/future/historical dates, invalid raw dates, one-time reset, unknown origin and family isolation');
