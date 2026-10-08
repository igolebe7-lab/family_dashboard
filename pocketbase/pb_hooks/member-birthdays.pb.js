onRecordCreateRequest((event) => {
  require(`${__hooks}/_shared/member-birthdays.pb.js`).validateBirthDateRequest(event, 'birthday');
  event.next();
}, 'family_members');

onRecordUpdateRequest((event) => {
  require(`${__hooks}/_shared/member-birthdays.pb.js`).validateBirthDateRequest(event, 'birthday');
  event.next();
}, 'family_members');

onRecordCreateExecute((event) => {
  const originalApp = event.app;
  try {
    originalApp.runInTransaction((tx) => {
      event.app = tx;
      event.next();
      require(`${__hooks}/_shared/member-birthdays.pb.js`).syncMemberBirthday(tx, event.record);
    });
  } finally { event.app = originalApp; }
}, 'family_members');

onRecordUpdateExecute((event) => {
  const original = event.record.original();
  if (!['birthday', 'display_name', 'active', 'color_key', 'family'].some((field) =>
    event.record.getString(field) !== original.getString(field))) return event.next();
  const originalApp = event.app;
  try {
    originalApp.runInTransaction((tx) => {
      event.app = tx;
      event.next();
      require(`${__hooks}/_shared/member-birthdays.pb.js`).syncMemberBirthday(tx, event.record);
    });
  } finally { event.app = originalApp; }
}, 'family_members');

onRecordDeleteExecute((event) => {
  const originalApp = event.app;
  try {
    originalApp.runInTransaction((tx) => {
      event.app = tx;
      // Remove derived dates before the linked-member relation is cleared by deletion.
      const rows = tx.findRecordsByFilter('day_annotations', 'kind = "birthday" && linked_member = {:member}', '', 0, 0, { member: event.record.id });
      for (const row of rows) tx.delete(row);
      event.next();
    });
  } finally { event.app = originalApp; }
}, 'family_members');
