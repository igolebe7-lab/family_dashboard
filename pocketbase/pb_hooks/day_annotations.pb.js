onRecordCreateRequest((event) => {
  const authHelpers = require(`${__hooks}/_shared/auth.pb.js`);
  const validation = require(`${__hooks}/_shared/day-annotations.pb.js`);
  const auth = authHelpers.requireAuth(event);

  require(`${__hooks}/_shared/member-birthdays.pb.js`).validateBirthDateRequest(event, 'birth_date');

  validation.validateDayAnnotationRecord(
    event.app,
    event.record,
    auth,
    event.hasSuperuserAuth()
  );
  event.next();
}, 'day_annotations');

onRecordUpdateRequest((event) => {
  const authHelpers = require(`${__hooks}/_shared/auth.pb.js`);
  const validation = require(`${__hooks}/_shared/day-annotations.pb.js`);
  const auth = authHelpers.requireAuth(event);

  require(`${__hooks}/_shared/member-birthdays.pb.js`).validateBirthDateRequest(event, 'birth_date');

  validation.validateDayAnnotationRecord(
    event.app,
    event.record,
    auth,
    event.hasSuperuserAuth()
  );
  event.next();
}, 'day_annotations');

onRecordDeleteRequest((event) => {
  const authHelpers = require(`${__hooks}/_shared/auth.pb.js`);
  const validation = require(`${__hooks}/_shared/day-annotations.pb.js`);
  const auth = authHelpers.requireAuth(event);

  validation.validateDayAnnotationRecord(
    event.app,
    event.record,
    auth,
    event.hasSuperuserAuth()
  );
  event.next();
}, 'day_annotations');
