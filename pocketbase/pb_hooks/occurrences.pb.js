onRecordUpdateRequest((event) => {
  const authHelpers = require(`${__hooks}/_shared/auth.pb.js`);
  const lifecycle = require(`${__hooks}/_shared/occurrence-lifecycle.pb.js`);
  const auth = authHelpers.requireAuth(event);

  const originalApp = event.app;
  try {
    originalApp.runInTransaction(tx => {
      event.app = tx;
      // The request record was loaded before the writer lock. Rebase onto the
      // latest row so concurrent status/checklist actions cannot overwrite it.
      const body = event.requestInfo().body || {};
      event.record = tx.findRecordById('item_occurrences', event.record.id);
      for (const field of Object.keys(body)) event.record.set(field, body[field]);
      lifecycle.validateBeforeUpdate(tx, event, auth, event.hasSuperuserAuth());
      event.next();
    });
  } finally {
    event.app = originalApp;
  }
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
