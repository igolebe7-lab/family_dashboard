migrate((app) => {
  const items = app.findCollectionByNameOrId('items');
  items.fields.addMarshaledJSON(JSON.stringify({ name: 'reminder_enabled', type: 'bool' }));
  app.save(items);
  // Legacy zero is ambiguous: preserve explicit positive offsets only.
  app.db().newQuery('UPDATE items SET reminder_enabled = 1 WHERE reminder_offset_minutes > 0').execute();

  const notifications = app.findCollectionByNameOrId('notifications');
  const type = notifications.fields.getByName('type');
  type.values = [...type.values, 'item.reminder'];
  notifications.indexes = [...notifications.indexes,
    "CREATE UNIQUE INDEX idx_notifications_item_reminder ON notifications (occurrence, recipient_member) WHERE type = 'item.reminder' AND occurrence != ''"
  ];
  app.save(notifications);
}, (app) => {
  app.db().newQuery("DELETE FROM notifications WHERE type = 'item.reminder'").execute();
  const notifications = app.findCollectionByNameOrId('notifications');
  notifications.fields.getByName('type').values = notifications.fields.getByName('type').values.filter((value) => value !== 'item.reminder');
  notifications.indexes = notifications.indexes.filter((index) => !index.includes('idx_notifications_item_reminder'));
  app.save(notifications);
  const items = app.findCollectionByNameOrId('items');
  items.fields.removeByName('reminder_enabled');
  app.save(items);
});
