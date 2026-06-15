const { getRecordValue } = require(`${__hooks}/_shared/auth.pb.js`);

function validateDayAnnotationRecord(app, record, auth, isSuperuser) {
  validateShape(record);
  validateClientWriteMode(record, isSuperuser);
  validateActor(app, record, auth, isSuperuser);
  validateLinkedMember(app, record);
}

function validateShape(record) {
  const title = String(getRecordValue(record, 'title') || '').trim();
  const kind = getRecordValue(record, 'kind');
  const month = Number(getRecordValue(record, 'month'));
  const day = Number(getRecordValue(record, 'day'));
  const year = getRecordValue(record, 'year');
  const recurrence = getRecordValue(record, 'recurrence');
  const personName = String(getRecordValue(record, 'person_name') || '').trim();
  const linkedMember = getRecordValue(record, 'linked_member');
  const personContact = String(getRecordValue(record, 'person_contact') || '').trim();

  if (!title) {
    throw newApiError(400, 'Название особой даты обязательно', { field: 'title' });
  }

  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw newApiError(400, 'Месяц должен быть от 1 до 12', { field: 'month' });
  }

  if (!Number.isInteger(day) || day < 1 || day > 31) {
    throw newApiError(400, 'День должен быть от 1 до 31', { field: 'day' });
  }

  if (!isValidMonthDay(month, day, Number(year) || 2024)) {
    throw newApiError(400, 'Такой даты не существует', { field: 'day' });
  }

  if (recurrence === 'one_time' && !Number.isInteger(Number(year))) {
    throw newApiError(400, 'Для одноразовой даты нужен год', { field: 'year' });
  }

  if (kind === 'birthday' && !linkedMember && !personName) {
    throw newApiError(400, 'Для дня рождения нужен член семьи или имя человека', {
      field: 'person_name'
    });
  }

  if (personContact.length > 120) {
    throw newApiError(400, 'Контакт слишком длинный', { field: 'person_contact' });
  }
}

function validateClientWriteMode(record, isSuperuser) {
  const source = getRecordValue(record, 'source');
  const readonly = getRecordValue(record, 'readonly') === true;
  const original = typeof record.original === 'function' ? record.original() : undefined;
  const wasReadonly = original && getRecordValue(original, 'readonly') === true;

  if (isSuperuser) return;

  if (readonly || wasReadonly || source === 'nager_date') {
    throw newApiError(403, 'Системные праздники нельзя менять вручную', {
      field: 'readonly'
    });
  }
}

function validateActor(app, record, auth, isSuperuser) {
  if (isSuperuser) return;

  const createdBy = getRecordValue(record, 'created_by');
  const familyId = getRecordValue(record, 'family');
  const actor = findMember(app, createdBy, 'created_by');

  require(`${__hooks}/_shared/permissions.pb.js`).requireSameFamily(actor, familyId);

  if (actor.get('active') === false) {
    throw newApiError(403, 'Член семьи неактивен', { field: 'created_by' });
  }

  if (actor.get('user') !== auth.id) {
    throw newApiError(403, 'Нельзя создавать особые даты от имени другого члена семьи', {
      field: 'created_by'
    });
  }
}

function validateLinkedMember(app, record) {
  const linkedMemberId = getRecordValue(record, 'linked_member');
  if (!linkedMemberId) return;

  const member = findMember(app, linkedMemberId, 'linked_member');
  require(`${__hooks}/_shared/permissions.pb.js`).requireSameFamily(
    member,
    getRecordValue(record, 'family')
  );
}

function findMember(app, memberId, field) {
  if (!memberId) {
    throw newApiError(400, 'Нужно выбрать члена семьи', { field });
  }

  try {
    return app.findRecordById('family_members', memberId);
  } catch (_) {
    throw newApiError(400, 'Член семьи не найден', { field });
  }
}

function isValidMonthDay(month, day, year) {
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

module.exports = {
  validateDayAnnotationRecord
};
