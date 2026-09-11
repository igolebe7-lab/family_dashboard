function createNotification(app, payload) {
  const member = app.findRecordById('family_members', payload.recipient_member);
  if (!member.get('active') || member.get('family') !== payload.family) return;
  if (payload.item) {
    const item = app.findRecordById('items', payload.item);
    if (!require(`${__hooks}/_shared/permissions.pb.js`).canViewItem(app, member, item)) return;
  }
  const collection = app.findCollectionByNameOrId('notifications');
  const record = new Record(collection);
  Object.entries(payload).forEach(([key, value]) => {
    if (value !== undefined && value !== null) record.set(key, value);
  });
  record.set('recipient_user', member.get('user'));
  app.save(record);
}

module.exports = {
  createNotification
};
