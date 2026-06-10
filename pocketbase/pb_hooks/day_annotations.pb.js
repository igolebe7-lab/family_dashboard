onRecordCreateRequest((event) => {
  const authHelpers = require(`${__hooks}/_shared/auth.pb.js`);
  const validation = require(`${__hooks}/_shared/day-annotations.pb.js`);
  const auth = authHelpers.requireAuth(event);

  validation.validateDayAnnotationRecord(
    $app,
    event.record,
    auth,
    authHelpers.hasSuperuserAuth(event)
  );
  event.next();
}, 'day_annotations');

onRecordUpdateRequest((event) => {
  const authHelpers = require(`${__hooks}/_shared/auth.pb.js`);
  const validation = require(`${__hooks}/_shared/day-annotations.pb.js`);
  const auth = authHelpers.requireAuth(event);

  validation.validateDayAnnotationRecord(
    $app,
    event.record,
    auth,
    authHelpers.hasSuperuserAuth(event)
  );
  event.next();
}, 'day_annotations');

onRecordDeleteRequest((event) => {
  const authHelpers = require(`${__hooks}/_shared/auth.pb.js`);
  const validation = require(`${__hooks}/_shared/day-annotations.pb.js`);
  const auth = authHelpers.requireAuth(event);

  validation.validateDayAnnotationRecord(
    $app,
    event.record,
    auth,
    authHelpers.hasSuperuserAuth(event)
  );
  event.next();
}, 'day_annotations');
