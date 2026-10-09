import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import vm from 'node:vm';

const hooks = fileURLToPath(new URL('../pocketbase/pb_hooks', import.meta.url));
class Row {
  constructor(fields = {}) { this.fields = { ...fields }; this.id = fields.id; }
  get(field) { return this.fields[field]; }
  getString(field) { return String(this.fields[field] ?? ''); }
  set(field, value) { this.fields[field] = value; }
}
class DateTime {
  constructor(value) { this.date = new Date(value.includes('T') ? value : value.replace(' ', 'T') + 'Z'); }
  string() { return this.date.toISOString().replace('T', ' '); }
}
const module = { exports: {} };
vm.runInNewContext(readFileSync(`${hooks}/_shared/recurrence.pb.js`, 'utf8'), {
  module, require: createRequire(import.meta.url), __hooks: hooks, Date, Set, DateTime,
  Record: class extends Row {}, newApiError: (_code, message) => new Error(message)
});
const { materializeItem } = module.exports;

function fixture(kind = 'event', count = 365) {
  const field = kind === 'event' ? 'start_at' : 'due_at';
  const item = new Row({ id: 'series', kind, family: 'family', timezone: 'UTC',
    [field]: '2026-01-01T09:00:00Z', recurrence_rule: `FREQ=DAILY;COUNT=${count}` });
  const rows = Array.from({ length: count }, (_, index) => {
    const key = new Date(Date.parse('2026-01-01T09:00:00Z') + index * 86400000).toISOString();
    return new Row({ item: item.id, recurrence_key: key, [field]: key });
  });
  const queries = [];
  const app = {
    findCollectionByNameOrId: () => ({}),
    findRecordsByFilter(_collection, filter, sort, limit, offset, params) {
      queries.push({ filter, sort, limit, offset, params });
      const matching = rows.filter(row => row.get('item') === params.item &&
        (params.key ? row.get('recurrence_key') === params.key || (!row.get('recurrence_key') && new Date(row.get(field)).getTime() === new Date(params.date).getTime())
          : row.get('recurrence_key') ? row.get('recurrence_key') >= params.lower && row.get('recurrence_key') <= params.upper
            : new Date(row.get(field)) >= new Date(params.dateLower) && new Date(row.get(field)) <= new Date(params.dateUpper)));
      return matching.slice(offset, offset + limit);
    },
    save(row) { rows.push(row); }
  };
  return { item, rows, queries, app };
}

test('a loaded daily year needs two bounded lookups, not 365 existence queries', () => {
  const { item, rows, app, queries } = fixture();
  rows[0].set('start_at', '2027-01-01T09:00:00Z'); // Moved outside the requested range.
  rows[1].set('status', 'cancelled');
  rows[2].set('recurrence_key', ''); // Legacy occurrence identified by actual date.
  assert.equal(materializeItem(app, item, new Date('2026-01-01'), new Date('2027-01-01')), 0);
  assert.equal(rows.length, 365);
  assert.equal(queries.length, 2);
  assert.ok(queries.every(query => query.limit === 200 && query.params.item === item.id));
});

test('missing task dates are filled once, with bounded pagination and idempotency', () => {
  const { item, rows, app, queries } = fixture('assignment', 600);
  rows.splice(300, 1);
  const from = new Date('2026-01-01'), to = new Date('2027-09-01');
  assert.equal(materializeItem(app, item, from, to), 1);
  assert.equal(rows.length, 600);
  assert.equal(rows.at(-1).get('status'), 'assigned');
  assert.equal(materializeItem(app, item, from, to), 0);
  assert.equal(queries.length, 7); // 3 pages before insertion, 4 (including empty end page) after.
});

test('an empty recurrence range does not query occurrences', () => {
  const { item, app, queries } = fixture();
  assert.equal(materializeItem(app, item, new Date('2030-01-01'), new Date('2030-02-01')), 0);
  assert.equal(queries.length, 0);
});
