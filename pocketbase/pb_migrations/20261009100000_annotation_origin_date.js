migrate((app) => {
  const collection = app.findCollectionByNameOrId('day_annotations');
  collection.fields.add(new DateField({ name: 'origin_date' }));
  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId('day_annotations');
  collection.fields.removeByName('origin_date');
  app.save(collection);
});
