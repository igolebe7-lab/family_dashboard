function createNotification(app, payload) {
  const collection = app.findCollectionByNameOrId('notifications');
  const record = new Record(collection);
  Object.entries(payload).forEach(([key, value]) => {
    if (value !== undefined && value !== null) record.set(key, value);
  });
  app.save(record);
}

module.exports = {
  createNotification
};
