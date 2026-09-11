onRecordCreateRequest((event) => {
  const authHelpers = require(`${__hooks}/_shared/auth.pb.js`);
  const lifecycle = require(`${__hooks}/_shared/item-lifecycle.pb.js`);
  const auth = authHelpers.requireAuth(event);

  lifecycle.validateBeforeSave(event.app, event.record, auth, event.hasSuperuserAuth());
  event.next();
}, 'items');

onRecordUpdateRequest((event) => {
  const authHelpers = require(`${__hooks}/_shared/auth.pb.js`);
  const lifecycle = require(`${__hooks}/_shared/item-lifecycle.pb.js`);
  const auth = authHelpers.requireAuth(event);

  lifecycle.validateBeforeSave(event.app, event.record, auth, event.hasSuperuserAuth());
  event.next();
}, 'items');

onRecordCreateExecute((event) => {
  require(`${__hooks}/_shared/search.pb.js`).updateSearchText(event.record);
  const originalApp = event.app;
  try {
    originalApp.runInTransaction((txApp) => {
      event.app = txApp;
      event.next();
      require(`${__hooks}/_shared/item-lifecycle.pb.js`).afterCreate(txApp, event.record);
    });
  } finally {
    event.app = originalApp;
  }
}, 'items');

onRecordUpdateExecute((event) => {
  require(`${__hooks}/_shared/search.pb.js`).updateSearchText(event.record);
  const originalApp = event.app;
  const original = event.record.original();
  try {
    originalApp.runInTransaction((txApp) => {
      event.app = txApp;
      event.next();
      require(`${__hooks}/_shared/item-lifecycle.pb.js`).afterUpdate(txApp, event.record, original);
    });
  } finally {
    event.app = originalApp;
  }
}, 'items');
