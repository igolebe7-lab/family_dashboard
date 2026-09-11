migrate((app) => {
  const collection = app.findCollectionByNameOrId('items');
  collection.fields.add(new TextField({ name: 'search_text' }));
  app.save(collection);
  for (let offset = 0; ; offset += 100) {
    const records = app.findRecordsByFilter('items', '', 'id', 100, offset);
    for (const record of records) {
      const text = ['title', 'description', 'location_text'].map((field) => record.getString(field)).join(' ')
        .toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
      app.db().newQuery('UPDATE items SET search_text = {:text} WHERE id = {:id}').bind({ text, id: record.id }).execute();
    }
    if (records.length < 100) break;
  }
}, (app) => {
  const collection = app.findCollectionByNameOrId('items');
  collection.fields.removeByName('search_text');
  app.save(collection);
});
