migrate((app) => {
  const collection = app.findCollectionByNameOrId('items');

  if (!findField(collection, 'reminder_offset_minutes')) {
    collection.fields.addMarshaledJSON(
      JSON.stringify({
        name: 'reminder_offset_minutes',
        type: 'number'
      })
    );
  }

  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId('items');
  const field = findField(collection, 'reminder_offset_minutes');

  if (field) {
    collection.fields.remove(field.id);
    app.save(collection);
  }
});

function findField(collection, name) {
  try {
    return collection.fields.getByName(name);
  } catch (_) {
    return null;
  }
}
