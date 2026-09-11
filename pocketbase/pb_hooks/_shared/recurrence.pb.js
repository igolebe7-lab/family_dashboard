const DAY = 86400000;
const DEFAULT_MATERIALIZATION_DAYS = 60;

function shouldMaterializeSingleOccurrence(record) {
  return !record.getString('recurrence_rule') &&
    (['task', 'assignment'].includes(record.get('kind')) || !!record.getString('start_at'));
}

function fromWall(date, zone) {
  return new Date(new DateTime(date.toISOString().slice(0, 19).replace('T', ' '), zone).string());
}

// RRule uses floating wall-clock dates; Go resolves each date in the IANA zone.
function toWall(date, zone) {
  let wall = new Date(date.getTime());
  for (let i = 0; i < 4; i++) {
    const difference = date.getTime() - fromWall(wall, zone).getTime();
    if (!difference) return wall;
    wall = new Date(wall.getTime() + difference);
  }
  return wall;
}

function parseRule(item) {
  const text = item.getString('recurrence_rule').replace(/^RRULE:/, '');
  if (!text) return null;
  if (text.length > 240 || !/^FREQ=(DAILY|WEEKLY|MONTHLY)(;(INTERVAL=\d{1,2}|BYDAY=(MO|TU|WE|TH|FR|SA|SU)(,(MO|TU|WE|TH|FR|SA|SU))*|COUNT=\d{1,4}))*$/.test(text)) {
    throw newApiError(400, 'Неподдерживаемое правило повтора', {});
  }
  const parts = text.split(';').map((part) => part.split('=')[0]);
  if (new Set(parts).size !== parts.length) throw newApiError(400, 'Проверьте правило повтора', {});
  const { RRule } = require(`${__hooks}/vendor/rrule.cjs`);
  const options = RRule.parseString(text);
  if (options.interval !== undefined && (options.interval < 1 || options.interval > 52)) {
    throw newApiError(400, 'Интервал повтора: от 1 до 52', {});
  }
  if (options.count !== undefined && options.count < 1) throw newApiError(400, 'Число повторов должно быть положительным', {});
  const anchor = item.getString('start_at') || item.getString('due_at');
  if (!anchor || !Number.isFinite(new Date(anchor).getTime())) throw newApiError(400, 'Для повтора нужна дата', {});
  const zone = item.getString('timezone') || 'UTC';
  options.dtstart = toWall(new Date(anchor), zone);
  const until = item.getString('recurrence_until');
  if (until) {
    if (new Date(until) < new Date(anchor)) throw newApiError(400, 'Окончание повтора раньше начала', {});
    options.until = toWall(new Date(until), zone);
  }
  return new RRule(options, true);
}

function datesInRange(item, from, to) {
  const rule = parseRule(item);
  if (!rule || item.get('archived')) return [];
  const zone = item.getString('timezone') || 'UTC';
  const anchor = new Date(item.getString('start_at') || item.getString('due_at'));
  const baseWall = toWall(anchor, zone);
  const end = item.getString('end_at');
  const duration = end ? toWall(new Date(end), zone) - baseWall : 0;
  const exceptions = item.get('recurrence_exdates_json') || [];
  const lower = toWall(new Date(from.getTime() - Math.max(0, duration)), zone);
  const upper = toWall(new Date(to.getTime() + DAY), zone);
  return rule.between(lower, upper, true, (_, index) => index < 800).map((wall) => {
    const start = fromWall(wall, zone);
    const finish = end ? fromWall(new Date(wall.getTime() + duration), zone) : null;
    return { start, finish, wall };
  }).filter(({ start, finish, wall }) => {
    // Skip nonexistent local times during a spring-forward transition.
    if (toWall(start, zone).getTime() !== wall.getTime()) return false;
    if (start >= to || (finish || start) < from) return false;
    return !Array.isArray(exceptions) || !exceptions.some((value) =>
      value === wall.toISOString().slice(0, 10) || new Date(value).getTime() === start.getTime());
  });
}

function materializeItem(app, item, from, to) {
  if (!item.getString('recurrence_rule') || item.get('archived')) return 0;
  const collection = app.findCollectionByNameOrId('item_occurrences');
  let created = 0;
  for (const { start, finish } of datesInRange(item, from, to)) {
    const key = start.toISOString();
    const field = item.getString('start_at') ? 'start_at' : 'due_at';
    const existing = app.findRecordsByFilter('item_occurrences',
      `item = {:item} && (recurrence_key = {:key} || (recurrence_key = "" && ${field} = {:date}))`, '', 1, 0,
      { item: item.id, key, date: new DateTime(key).string() });
    if (existing.length) continue;
    const occurrence = new Record(collection);
    for (const field of ['family', 'visible_to', 'kind', 'all_day']) occurrence.set(field, item.get(field));
    occurrence.set('item', item.id);
    occurrence.set('title_snapshot', item.get('title'));
    occurrence.set('category_snapshot', item.get('category'));
    occurrence.set('recurrence_key', key);
    occurrence.set(field, key);
    if (finish) occurrence.set('end_at', finish.toISOString());
    occurrence.set('status', item.get('kind') === 'assignment' ? 'assigned' : 'todo');
    app.save(occurrence);
    created++;
  }
  return created;
}

function materializeFamily(app, familyId, from, to) {
  let offset = 0;
  let created = 0;
  while (true) {
    const items = app.findRecordsByFilter('items',
      'family = {:family} && recurrence_rule != "" && archived = false', 'id', 50, offset, { family: familyId });
    for (const item of items) {
      app.runInTransaction((tx) => { created += materializeItem(tx, item, from, to); });
    }
    if (items.length < 50) return created;
    offset += items.length;
  }
}

module.exports = { DEFAULT_MATERIALIZATION_DAYS, shouldMaterializeSingleOccurrence,
  parseRule, datesInRange, materializeItem, materializeFamily, toWall, fromWall };
