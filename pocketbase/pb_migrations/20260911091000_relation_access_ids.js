migrate((app) => {
  // A running development server may have applied the initial hardening migration
  // before the multi-relation comparison was corrected. Reapply only that correction.
  for (const name of ['items', 'item_occurrences', 'item_activity', 'item_comments', 'notifications']) {
    const collection = app.findCollectionByNameOrId(name);
    for (const key of ['listRule', 'viewRule', 'updateRule', 'deleteRule', 'createRule']) {
      if (collection[key] == null) continue;
      let rule = String(collection[key]);
      for (const prefix of ['item.', '']) {
        for (const relation of ['assignees.managed_by', 'participants.managed_by', 'assignees', 'participants']) {
          rule = rule.split(`@collection.family_members:viewer.id ?= ${prefix}${relation}`)
            .join(`${prefix}${relation}.id ?= @collection.family_members:viewer.id`);
        }
      }
      collection[key] = rule;
    }
    if (name === 'notifications') {
      // Restore the schema accidentally captured by the isolated fault-injection
      // test before automigrate was disabled. The intended field has no max.
      const body = collection.fields.getByName('body');
      if (body.max === 1) body.max = 0;
    }
    app.save(collection);
  }
}, () => {
  throw new Error('Do not restore the invalid multi-relation access comparison.');
});
