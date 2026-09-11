onRecordUpdateRequest((event) => {
  const authHelpers = require(`${__hooks}/_shared/auth.pb.js`);
  const lifecycle = require(`${__hooks}/_shared/occurrence-lifecycle.pb.js`);
  const auth = authHelpers.requireAuth(event);

  lifecycle.validateBeforeUpdate(event.app, event, auth, event.hasSuperuserAuth());
  event.next();
}, 'item_occurrences');

onRecordUpdateExecute((event) => {
  const originalApp = event.app;
  try {
    originalApp.runInTransaction((txApp) => {
      event.app = txApp;
      require(`${__hooks}/_shared/occurrence-lifecycle.pb.js`).afterUpdate(txApp, event.record);
      event.next();
    });
  } finally {
    event.app = originalApp;
  }
}, 'item_occurrences');
