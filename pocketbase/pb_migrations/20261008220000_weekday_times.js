migrate((app) => {
  const collection = app.findCollectionByNameOrId('items');
  collection.fields.add(new JSONField({ name: 'recurrence_times_json', maxSize: 2048 }));
  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId('items');
  collection.fields.removeByName('recurrence_times_json');
  app.save(collection);
});
