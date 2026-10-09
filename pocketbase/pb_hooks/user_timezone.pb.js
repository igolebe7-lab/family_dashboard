onRecordCreateRequest(event => require(`${__hooks}/_shared/user-timezone.js`).validateUserTimezone(event), 'users');
onRecordUpdateRequest(event => require(`${__hooks}/_shared/user-timezone.js`).validateUserTimezone(event), 'users');
