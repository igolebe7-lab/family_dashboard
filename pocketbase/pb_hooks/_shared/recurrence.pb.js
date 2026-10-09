const DAY = 86400000;
const DEFAULT_MATERIALIZATION_DAYS = 60;
const WEEKDAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

function weekdayTimes(item) {
  const times = JSON.parse(item.getString('recurrence_times_json') || 'null');
  if (times === null) return {};
  if (typeof times !== 'object' || Array.isArray(times)) throw newApiError(400, 'Проверьте время по дням недели', {});
  const keys = Object.keys(times);
  if (!keys.length) return {};
  const rule = item.getString('recurrence_rule');
  const byday = /(?:^|;)BYDAY=([^;]+)/.exec(rule)?.[1].split(',') || [];
  if (item.getString('kind') !== 'event' || item.get('all_day') || !/^(RRULE:)?FREQ=WEEKLY(?:;|$)/.test(rule) || !byday.length ||
    keys.length !== new Set(byday).size || keys.some(key => !byday.includes(key))) throw newApiError(400, 'Разное время доступно для выбранных дней недельного события', {});
  for (const key of keys) {
    const value = times[key];
    if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(field => !['startTime', 'endTime'].includes(field)) ||
      typeof value.startTime !== 'string' || typeof value.endTime !== 'string' ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(value.startTime) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value.endTime) || value.endTime <= value.startTime) {
      throw newApiError(400, 'Для каждого дня окончание должно быть позже начала', {});
    }
  }
  return times;
}

function minutes(time) { const parts = time.split(':').map(Number); return parts[0] * 60 + parts[1]; }

function durationAt(item, wall) {
  const times = weekdayTimes(item)[WEEKDAYS[wall.getUTCDay()]];
  if (times) return (minutes(times.endTime) - minutes(times.startTime)) * 60000;
  const end = item.getString('end_at');
  return end ? toWall(new Date(end), item.getString('timezone') || 'UTC') - toWall(new Date(item.getString('start_at')), item.getString('timezone') || 'UTC') : 0;
}

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
  const times = weekdayTimes(item);
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
  // Custom times apply to calendar dates, not the common time used as the series anchor.
  if (Object.keys(times).length) options.dtstart.setUTCHours(0, 0, 0, 0);
  const until = item.getString('recurrence_until');
  if (until) {
    if (new Date(until) < new Date(anchor)) throw newApiError(400, 'Окончание повтора раньше начала', {});
    options.until = toWall(new Date(until), zone);
    if (Object.keys(times).length) options.until.setUTCHours(23, 59, 59, 999);
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
  const times = weekdayTimes(item);
  const custom = Object.keys(times).length > 0;
  const exceptions = JSON.parse(item.getString('recurrence_exdates_json') || '[]');
  const lower = toWall(new Date(from.getTime() - Math.max(0, duration, custom ? DAY : 0)), zone);
  const upper = toWall(new Date(to.getTime() + DAY), zone);
  return rule.between(lower, upper, true, (_, index) => index < 800).map((wall) => {
    const time = times[WEEKDAYS[wall.getUTCDay()]];
    if (time) wall.setUTCHours(0, minutes(time.startTime), 0, 0);
    const plannedDuration = time ? (minutes(time.endTime) - minutes(time.startTime)) * 60000 : duration;
    const start = fromWall(wall, zone);
    const finish = end ? fromWall(new Date(wall.getTime() + plannedDuration), zone) : null;
    return { start, finish, wall, plannedDuration };
  }).filter(({ start, finish, wall, plannedDuration }) => {
    // Skip nonexistent local times during a spring-forward transition.
    if (toWall(start, zone).getTime() !== wall.getTime() || finish && toWall(finish, zone).getTime() !== wall.getTime() + plannedDuration) return false;
    if (start >= to || (finish || start) < from) return false;
    return !Array.isArray(exceptions) || !exceptions.some((value) =>
      value === wall.toISOString().slice(0, 10) || new Date(value).getTime() === start.getTime());
  });
}

function materializeItem(app, item, from, to) {
  if (!item.getString('recurrence_rule') || item.get('archived')) return 0;
  const dates = datesInRange(item, from, to);
  if (!dates.length) return 0;
  const collection = app.findCollectionByNameOrId('item_occurrences');
  const field = item.getString('start_at') ? 'start_at' : 'due_at';
  const keys = dates.map(({ start }) => start.toISOString()).sort();
  const lower = keys[0], upper = keys[keys.length - 1];
  const existingKeys = new Set();
  // Match original series keys, including moved/cancelled occurrences and legacy rows.
  for (let offset = 0; ; offset += 200) {
    const rows = app.findRecordsByFilter('item_occurrences',
      `item = {:item} && ((recurrence_key >= {:lower} && recurrence_key <= {:upper}) || (recurrence_key = "" && ${field} >= {:dateLower} && ${field} <= {:dateUpper}))`,
      'id', 200, offset, { item: item.id, lower, upper,
        dateLower: new DateTime(lower).string(), dateUpper: new DateTime(upper).string() });
    for (const row of rows) {
      const key = row.getString('recurrence_key');
      const legacyDate = key ? null : new Date(row.getString(field));
      if (key) existingKeys.add(key);
      else if (Number.isFinite(legacyDate.getTime())) existingKeys.add(legacyDate.toISOString());
    }
    if (rows.length < 200) break;
  }
  let created = 0;
  for (const { start, finish } of dates) {
    const key = start.toISOString();
    if (existingKeys.has(key)) continue;
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
    existingKeys.add(key);
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
  parseRule, datesInRange, materializeItem, materializeFamily, toWall, fromWall, weekdayTimes, durationAt };
