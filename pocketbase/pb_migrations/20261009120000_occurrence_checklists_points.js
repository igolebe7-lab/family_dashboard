migrate(app => {
  const occurrences = app.findCollectionByNameOrId('item_occurrences');
  occurrences.fields.add(new JSONField({ name: 'checklist_done_json', maxSize: 10000 }));
  app.save(occurrences);
  // Template done flags are not historical occurrence completions or point awards.
  app.db().newQuery("UPDATE item_occurrences SET checklist_done_json = '[]'").execute();
  app.save(new Collection({
    type: 'base', name: 'member_points_ledger',
    listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null,
    fields: [
      // IDs are immutable snapshots, not relations that cascade or erase history.
      { type: 'text', name: 'member', required: true, max: 15 },
      { type: 'text', name: 'family', required: true, max: 15 },
      { type: 'text', name: 'occurrence', required: true, max: 15 },
      { type: 'text', name: 'approved_by', required: true, max: 15 },
      { type: 'number', name: 'points', required: true, onlyInt: true, min: 1, max: 100 },
      { type: 'autodate', name: 'created', onCreate: true }
    ],
    indexes: [
      'CREATE UNIQUE INDEX idx_member_points_occurrence ON member_points_ledger (member, occurrence)',
      'CREATE INDEX idx_member_points_balance ON member_points_ledger (family, member, points)'
    ]
  }));
}, app => {
  app.delete(app.findCollectionByNameOrId('member_points_ledger'));
  const occurrences = app.findCollectionByNameOrId('item_occurrences');
  occurrences.fields.removeByName('checklist_done_json');
  app.save(occurrences);
});
