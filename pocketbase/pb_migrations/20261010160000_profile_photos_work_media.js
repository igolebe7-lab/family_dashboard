migrate(app => {
  const members = app.findCollectionByNameOrId('family_members');
  const avatar = members.fields.getByName('avatar');
  avatar.maxSize = 2 * 1024 * 1024;
  avatar.mimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
  avatar.protected = true;
  avatar.thumbs = ['64x64', '128x128', '512x512'];
  const viewer = '@collection.family_members:avatar_viewer';
  members.updateRule = `(${members.updateRule}) || (@request.auth.id != "" && active = true && @request.body.avatar:isset = true && ${viewer}.user ?= @request.auth.id && ${viewer}.family ?= family && ${viewer}.active ?= true && (user = @request.auth.id || ((role = "child" || role = "teen") && (${viewer}.role ?= "owner" || (${viewer}.role ?= "parent" && managed_by.id ?= ${viewer}.id)))))`;
  members.listRule = `@request.auth.id != "" && ${viewer}.user ?= @request.auth.id && ${viewer}.family ?= family && ${viewer}.active ?= true`;
  members.viewRule = members.listRule;
  app.save(members);

  // Relations reuse the current hardened item visibility rule, not a stale snapshot.
  const occurrences = app.findCollectionByNameOrId('item_occurrences');
  const rule = `(${occurrences.viewRule}) && occurrence.item = item && occurrence.family = family`;
  const collection = new Collection({
    name: 'work_media', type: 'base', listRule: rule, viewRule: rule,
    createRule: null, updateRule: null, deleteRule: null,
    fields: [
      { name: 'family', type: 'relation', collectionId: members.fields.getByName('family').collectionId, required: true, maxSelect: 1, cascadeDelete: true },
      { name: 'item', type: 'relation', collectionId: app.findCollectionByNameOrId('items').id, required: true, maxSelect: 1, cascadeDelete: true },
      { name: 'occurrence', type: 'relation', collectionId: occurrences.id, required: true, maxSelect: 1, cascadeDelete: true },
      { name: 'photos', type: 'file', maxSelect: 10, maxSize: 2 * 1024 * 1024, mimeTypes: ['image/jpeg', 'image/png', 'image/webp'], protected: true, thumbs: ['320x320', '800x800'] },
      { name: 'links_json', type: 'json', maxSize: 30000 },
      { name: 'created', type: 'autodate', onCreate: true },
      { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true }
    ],
    indexes: ['CREATE UNIQUE INDEX idx_work_media_occurrence ON work_media (occurrence)', 'CREATE INDEX idx_work_media_family ON work_media (family)']
  });
  app.save(collection);
}, () => {
  throw new Error('Protected media migration is irreversible; restore an audited backup to roll back.');
});
