function requireAuth(event) {
  const requestInfo = getRequestInfo(event);
  const auth = event.auth || requestInfo.auth;
  if (!auth) {
    throw newApiError(401, 'Требуется вход', {});
  }
  return auth;
}

function getRequestInfo(event) {
  if (!event) return {};
  if (typeof event.requestInfo === 'function') return event.requestInfo();
  return event.requestInfo || {};
}

function hasSuperuserAuth(event) {
  const requestInfo = getRequestInfo(event);
  return (
    typeof requestInfo.hasSuperuserAuth === 'function' &&
    requestInfo.hasSuperuserAuth()
  );
}

function getRecordValue(record, field) {
  if (!record) return undefined;
  if (typeof record.get === 'function') return record.get(field);
  return record[field];
}

function getRecordArray(record, field) {
  const value = getRecordValue(record, field);
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

module.exports = {
  getRecordArray,
  getRequestInfo,
  getRecordValue,
  hasSuperuserAuth,
  requireAuth
};
