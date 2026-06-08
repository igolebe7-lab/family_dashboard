function createActivity(app, payload) {
  const collection = app.findCollectionByNameOrId('item_activity');
  const record = new Record(collection);
  Object.entries(payload).forEach(([key, value]) => record.set(key, value));
  app.save(record);
}

module.exports = {
  createActivity
};
