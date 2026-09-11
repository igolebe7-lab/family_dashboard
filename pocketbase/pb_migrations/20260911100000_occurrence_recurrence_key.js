migrate((app) => {
  const collection = app.findCollectionByNameOrId('item_occurrences');
  collection.fields.add(new TextField({ name: 'recurrence_key', max: 32 }));
  collection.indexes.push('CREATE UNIQUE INDEX idx_occurrence_series_key ON item_occurrences (item, recurrence_key) WHERE recurrence_key != ""');
  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId('item_occurrences');
  collection.indexes = collection.indexes.filter((index) => !index.includes('idx_occurrence_series_key'));
  collection.fields.removeByName('recurrence_key');
  app.save(collection);
});
