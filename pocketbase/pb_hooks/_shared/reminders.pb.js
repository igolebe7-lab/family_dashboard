const PAGE_SIZE = 50;
const MAX_PAGES = 2;
const CATCHUP_MS = 24 * 60 * 60 * 1000;
const CURSOR_KEY = 'familytime.reminders.cursor';
const TERMINAL = ['done', 'approved', 'skipped', 'cancelled'];

function reminderTime(item, occurrence) {
  const anchor = item.get('kind') === 'event'
    ? occurrence.get('start_at')
    : occurrence.get('due_at') || occurrence.get('start_at');
  const offset = item.get('reminder_offset_minutes');
  if (!anchor || !Number.isInteger(offset) || offset < 0) return NaN;
  return new Date(anchor).getTime() - offset * 60000;
}

function recipientIds(item) {
  const { getRecordArray } = require(`${__hooks}/_shared/auth.pb.js`);
  if (item.get('kind') === 'event') return getRecordArray(item, 'participants');
  if (item.get('kind') === 'assignment') return getRecordArray(item, 'assignees');
  return [item.get('owner') || item.get('created_by')].filter(Boolean);
}

function deliverOccurrence(app, id, now) {
  let delivered = 0;
  app.runInTransaction((tx) => {
    const occurrence = tx.findRecordById('item_occurrences', id);
    const item = tx.findRecordById('items', occurrence.get('item'));
    const due = reminderTime(item, occurrence);
    if (!item.get('reminder_enabled') || item.get('archived') || TERMINAL.includes(occurrence.get('status')) ||
        occurrence.get('family') !== item.get('family') || !Number.isFinite(due) || due > now || due < now - CATCHUP_MS) return;
    const { canViewItem } = require(`${__hooks}/_shared/permissions.pb.js`);
    for (const memberId of new Set(recipientIds(item))) {
      const member = tx.findRecordById('family_members', memberId);
      if (!canViewItem(tx, member, item)) continue;
      const existing = tx.findRecordsByFilter('notifications',
        'type = "item.reminder" && occurrence = {:occurrence} && recipient_member = {:member}',
        '', 1, 0, { occurrence: id, member: memberId });
      if (existing.length) continue;
      require(`${__hooks}/_shared/notifications.pb.js`).createNotification(tx, {
        family: item.get('family'), item: item.id, occurrence: id,
        recipient_member: memberId, type: 'item.reminder',
        title: '\u041d\u0430\u043f\u043e\u043c\u0438\u043d\u0430\u043d\u0438\u0435', body: item.get('title'),
        delivered_at: new Date(now).toISOString()
      });
      delivered++;
    }
  });
  return delivered;
}

function runReminders(app, nowValue) {
  const now = nowValue === undefined ? Date.now() : new Date(nowValue).getTime();
  if (!Number.isFinite(now)) throw new Error('Invalid reminder clock');
  let cursor = app.store().get(CURSOR_KEY) || '';
  const result = { scanned: 0, delivered: 0, failed: 0 };
  for (let page = 0; page < MAX_PAGES; page++) {
    const rows = arrayOf(new DynamicModel({ id: '' }));
    app.db().newQuery(`
      SELECT o.id FROM item_occurrences o JOIN items i ON i.id = o.item
      WHERE o.id > {:cursor} AND o.family = i.family
        AND i.reminder_enabled = 1 AND i.archived = 0
        AND o.status NOT IN ('done', 'approved', 'skipped', 'cancelled')
        AND i.reminder_offset_minutes >= 0
        AND i.reminder_offset_minutes = CAST(i.reminder_offset_minutes AS INTEGER)
        AND (CAST(strftime('%s', CASE WHEN i.kind = 'event' THEN o.start_at
          ELSE COALESCE(NULLIF(o.due_at, ''), o.start_at) END) AS INTEGER) - i.reminder_offset_minutes * 60)
          BETWEEN {:from} AND {:to}
      ORDER BY o.id LIMIT {:limit}
    `).bind({ cursor, from: Math.floor((now - CATCHUP_MS) / 1000), to: Math.floor(now / 1000), limit: PAGE_SIZE }).all(rows);
    for (const row of rows) {
      result.scanned++;
      try {
        result.delivered += deliverOccurrence(app, row.id, now);
      } catch (_) {
        // Advance past poison records; the next sweep retries within the catch-up window.
        result.failed++;
        app.logger().error('Reminder occurrence delivery failed', 'occurrence', row.id);
      }
      cursor = row.id;
    }
    if (rows.length < PAGE_SIZE) {
      cursor = '';
      break;
    }
  }
  // Process-local cursor gives bounded fair sweeps; durable notification uniqueness makes restart safe.
  app.store().set(CURSOR_KEY, cursor);
  return result;
}

module.exports = { runReminders };
