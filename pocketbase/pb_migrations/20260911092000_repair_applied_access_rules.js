migrate((app) => {
  // JSVM exposes Go *string rules as wrapped values, not primitive JS strings.
  // Repair databases where the earlier typeof guard skipped every rule.
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
      const body = collection.fields.getByName('body');
      if (Number(body.max) === 1) body.max = 0;
    }
    app.save(collection);
  }
}, () => {
  throw new Error('Do not restore invalid access comparisons or test-only body limits.');
});
