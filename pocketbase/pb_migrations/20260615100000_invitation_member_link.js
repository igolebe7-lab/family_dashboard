migrate((app) => {
  const collection = app.findCollectionByNameOrId('invitations');

  if (!findField(collection, 'member')) {
    collection.fields.addMarshaledJSON(
      JSON.stringify({
        name: 'member',
        type: 'relation',
        collectionId: 'ft_members_0001',
        cascadeDelete: false,
        minSelect: 0,
        maxSelect: 1
      })
    );
    collection.indexes = [
      ...(collection.indexes || []),
      'CREATE INDEX idx_invitations_member ON invitations (member)'
    ];
  }

  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId('invitations');
  const field = findField(collection, 'member');

  if (field) {
    collection.fields.remove(field.id);
    collection.indexes = (collection.indexes || []).filter(
      (index) => !String(index).includes('idx_invitations_member')
    );
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
