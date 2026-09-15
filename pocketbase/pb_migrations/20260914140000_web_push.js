migrate((app) => {
  const relation = (name, collection) => ({ name, type: 'relation', collectionId: app.findCollectionByNameOrId(collection).id, maxSelect: 1, required: true, cascadeDelete: true });
  const text = (name, max = 256) => ({ name, type: 'text', max });
  const date = (name) => ({ name, type: 'date' });
  const dates = [{ name: 'created', type: 'autodate', onCreate: true }, { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true }];
  app.save(new Collection({ name: 'push_subscriptions', type: 'base',
    listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null,
    fields: [relation('user', 'users'), text('endpoint', 4096), text('endpoint_hash'), text('p256dh'), text('auth'),
      text('secret_hash'), text('token_key_hash'), text('label', 80), date('expires_at'), date('enabled_at'),
      date('last_test_at'), ...dates],
    indexes: ['CREATE UNIQUE INDEX idx_push_endpoint ON push_subscriptions (endpoint_hash)', 'CREATE INDEX idx_push_user ON push_subscriptions (user)']
  }));
  app.save(new Collection({ name: 'push_deliveries', type: 'base',
    listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null,
    fields: [relation('subscription', 'push_subscriptions'),
      { ...relation('notification', 'notifications'), required: false },
      { name: 'state', type: 'select', values: ['pending', 'sent', 'failed', 'skipped'], maxSelect: 1, required: true },
      { name: 'attempts', type: 'number' }, date('next_at'), text('last_status', 20), ...dates],
    indexes: ["CREATE UNIQUE INDEX idx_push_delivery_unique ON push_deliveries (notification, subscription) WHERE notification != ''", 'CREATE INDEX idx_push_pending ON push_deliveries (state, next_at)']
  }));
  const notifications = app.findCollectionByNameOrId('notifications');
  notifications.fields.add(new BoolField({ name: 'push_enqueued' }));
  notifications.indexes.push('CREATE INDEX idx_notifications_push_pending ON notifications (push_enqueued, created)');
  app.save(notifications);
  // Historical inbox entries must not become a flood of new device notifications.
  app.db().newQuery('UPDATE notifications SET push_enqueued = true').execute();
}, (app) => {
  app.delete(app.findCollectionByNameOrId('push_deliveries'));
  app.delete(app.findCollectionByNameOrId('push_subscriptions'));
  const notifications = app.findCollectionByNameOrId('notifications');
  notifications.indexes = notifications.indexes.filter((index) => !index.includes('idx_notifications_push_pending'));
  notifications.fields.removeByName('push_enqueued');
  app.save(notifications);
});
