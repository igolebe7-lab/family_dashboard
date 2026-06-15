onRecordCreateRequest((event) => {
  const authHelpers = require(`${__hooks}/_shared/auth.pb.js`);
  const lifecycle = require(`${__hooks}/_shared/item-lifecycle.pb.js`);
  const auth = authHelpers.requireAuth(event);

  lifecycle.validateBeforeSave($app, event.record, auth, authHelpers.hasSuperuserAuth(event));
  event.next();
}, 'items');

onRecordUpdateRequest((event) => {
  const authHelpers = require(`${__hooks}/_shared/auth.pb.js`);
  const lifecycle = require(`${__hooks}/_shared/item-lifecycle.pb.js`);
  const auth = authHelpers.requireAuth(event);

  lifecycle.validateBeforeSave($app, event.record, auth, authHelpers.hasSuperuserAuth(event));
  event.next();
}, 'items');

onRecordAfterCreateSuccess((event) => {
  require(`${__hooks}/_shared/item-lifecycle.pb.js`).afterCreate($app, event.record);
}, 'items');
