migrate((app) => {
  // Resolve an active member in the item's family, not an independently matched user/role.
  const viewer = '@collection.family_members:viewer';
  function itemAccess(prefix = '') {
    const field = (name) => prefix + name;
    const explicit = `${viewer}.id ?= ${field('created_by')} || ${viewer}.id ?= ${field('owner')}`;
    const managed = (relation) => `(${field(`${relation}.managed_by.id`)} ?= ${viewer}.id &&
      ${field(`${relation}.family`)} ?= ${field('family')} &&
      ${field(`${relation}.active`)} ?= true &&
      (${field(`${relation}.role`)} ?= "child" || ${field(`${relation}.role`)} ?= "teen"))`;
    return `@request.auth.id != "" && ${viewer}.user ?= @request.auth.id &&
      ${viewer}.family ?= ${field('family')} && ${viewer}.active ?= true && (
        ${field('visibility')} = "family" ||
        (${field('visibility')} = "adults" && (${viewer}.role ?= "owner" || ${viewer}.role ?= "parent" || ${viewer}.role ?= "adult")) ||
        (${field('visibility')} = "private" && (${explicit})) ||
        (${field('visibility')} = "assignees" && (${explicit} ||
          ${field('assignees.id')} ?= ${viewer}.id || ${field('participants.id')} ?= ${viewer}.id ||
          ((${viewer}.role ?= "owner" || ${viewer}.role ?= "parent") && (${managed('assignees')} || ${managed('participants')}))
        ))
      )`;
  }
  const items = app.findCollectionByNameOrId('items');
  items.listRule = itemAccess();
  items.viewRule = items.listRule;
  items.updateRule = `${items.listRule} && created_by.user = @request.auth.id`;
  items.deleteRule = `${items.updateRule} && (kind != "assignment" || (created_by.role != "child" && created_by.role != "teen"))`;
  app.save(items);

  const relatedRule = `family = item.family && (${itemAccess('item.')})`;
  const occurrences = app.findCollectionByNameOrId('item_occurrences');
  occurrences.listRule = relatedRule;
  occurrences.viewRule = relatedRule;
  occurrences.updateRule = relatedRule;
  occurrences.createRule = null;
  occurrences.deleteRule = null;
  app.save(occurrences);

  const activity = app.findCollectionByNameOrId('item_activity');
  activity.listRule = relatedRule;
  activity.viewRule = relatedRule;
  app.save(activity);

  const comments = app.findCollectionByNameOrId('item_comments');
  comments.listRule = relatedRule;
  comments.viewRule = relatedRule;
  comments.createRule = `${relatedRule} && author.family = family && author.user = @request.auth.id && author.active = true && (occurrence = "" || occurrence.item = item)`;
  comments.updateRule = comments.createRule;
  comments.deleteRule = comments.createRule;
  app.save(comments);

  const notifications = app.findCollectionByNameOrId('notifications');
  notifications.listRule = `@request.auth.id != "" && recipient_user = @request.auth.id &&
    recipient_member.user = @request.auth.id && recipient_member.active = true && recipient_member.family = family &&
    (item = "" || (${relatedRule}))`;
  notifications.viewRule = notifications.listRule;
  notifications.updateRule = notifications.listRule;
  app.save(notifications);
}, () => {
  // Security rules must not silently roll back to vulnerable access policies.
  throw new Error('Item access hardening is irreversible; restore an audited backup to roll back.');
});
