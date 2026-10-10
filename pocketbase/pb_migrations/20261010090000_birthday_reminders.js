migrate((app) => {
  const annotations = app.findCollectionByNameOrId('day_annotations');
  // Calendar dates and their notifications must observe the same visibility.
  annotations.listRule = annotationAccess();
  annotations.viewRule = annotations.listRule;
  app.save(annotations);

  const notices = app.findCollectionByNameOrId('notifications');
  notices.fields.getByName('type').values.push('birthday.reminder');
  notices.fields.add(new RelationField({ name: 'annotation', collectionId: annotations.id, maxSelect: 1, cascadeDelete: true }));
  notices.fields.add(new TextField({ name: 'annotation_date', max: 10, pattern: '^$|^[0-9]{4}-[0-9]{2}-[0-9]{2}$' }));
  notices.indexes.push("CREATE UNIQUE INDEX idx_notifications_birthday_reminder ON notifications (annotation, annotation_date, recipient_member) WHERE type = 'birthday.reminder'");
  for (const key of ['listRule', 'viewRule', 'updateRule']) {
    notices[key] = `(${String(notices[key])}) && ${birthdayNoticeAccess()}`;
  }
  app.save(notices);
  const members = app.findCollectionByNameOrId('family_members');
  members.indexes.push("CREATE INDEX idx_birthday_recipients ON family_members (active, id) WHERE user != ''");
  app.save(members);
}, () => {
  // Keep hardened visibility rules; deployment rollback restores an audited backup.
  throw new Error('Birthday reminders require restoring the pre-release database backup to roll back.');
});

function annotationAccess() {
  const viewer = '@collection.family_members:birthday_viewer';
  return `@request.auth.id != "" && ${viewer}.user ?= @request.auth.id &&
    ${viewer}.family ?= family && ${viewer}.active ?= true && (
      visibility = "family" ||
      (visibility = "adults" && (${viewer}.role ?= "owner" || ${viewer}.role ?= "parent" || ${viewer}.role ?= "adult")) ||
      ((visibility = "private" || visibility = "assignees") &&
        (created_by.user = @request.auth.id || linked_member.user = @request.auth.id))
    ) && (linked_member = "" || (linked_member.active = true && linked_member.family = family))`;
}

function birthdayNoticeAccess() {
  return `(type != "birthday.reminder" || (annotation != "" && annotation.family = family && annotation.kind = "birthday" &&
    (annotation.linked_member = "" || (annotation.linked_member.active = true && annotation.linked_member.family = family)) && (
      annotation.visibility = "family" ||
      (annotation.visibility = "adults" && (recipient_member.role = "owner" || recipient_member.role = "parent" || recipient_member.role = "adult")) ||
      ((annotation.visibility = "private" || annotation.visibility = "assignees") &&
        (annotation.created_by = recipient_member || annotation.linked_member = recipient_member))
    )))`;
}
