onRecordUpdateRequest((event) => {
  const authHelpers = require(`${__hooks}/_shared/auth.pb.js`);
  const lifecycle = require(`${__hooks}/_shared/occurrence-lifecycle.pb.js`);
  const auth = authHelpers.requireAuth(event);

  lifecycle.validateBeforeUpdate($app, event, auth, authHelpers.hasSuperuserAuth(event));
  event.next();
}, 'item_occurrences');

onRecordAfterUpdateSuccess((event) => {
  require(`${__hooks}/_shared/occurrence-lifecycle.pb.js`).afterUpdate($app, event.record);
}, 'item_occurrences');
