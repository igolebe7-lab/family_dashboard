const { getRecordArray, getRecordValue } = require(`${__hooks}/_shared/auth.pb.js`);

function validateItemRecord(record) {
  const kind = getRecordValue(record, 'kind');
  const title = String(getRecordValue(record, 'title') || '').trim();

  if (!title) {
    throw newApiError(400, 'Название обязательно', { field: 'title' });
  }

  if (kind === 'event') validateEvent(record);
  if (kind === 'assignment') validateAssignment(record);
  if (kind === 'task') validateTask(record);
}

function validateEvent(record) {
  const startAt = getRecordValue(record, 'start_at');
  const endAt = getRecordValue(record, 'end_at');

  if (!startAt || !endAt) {
    throw newApiError(400, 'Для события нужны начало и окончание', { field: 'start_at' });
  }

  if (new Date(endAt).getTime() < new Date(startAt).getTime()) {
    throw newApiError(400, 'Окончание не может быть раньше начала', { field: 'end_at' });
  }

  if (getRecordArray(record, 'participants').length === 0) {
    const createdBy = getRecordValue(record, 'created_by');
    if (createdBy && typeof record.set === 'function') {
      record.set('participants', [createdBy]);
    }
  }
}

function validateTask(record) {
  const createdBy = getRecordValue(record, 'created_by');
  if (!getRecordValue(record, 'owner') && createdBy && typeof record.set === 'function') {
    record.set('owner', createdBy);
  }
}

function validateAssignment(record) {
  const createdBy = getRecordValue(record, 'created_by');
  const assignees = getRecordArray(record, 'assignees');

  if (assignees.length === 0) {
    throw newApiError(400, 'У поручения должен быть исполнитель', { field: 'assignees' });
  }

  if (assignees.length === 1 && assignees[0] === createdBy) {
    throw newApiError(400, 'Для задачи себе используйте тип «Дело»', { field: 'assignees' });
  }

  if (!getRecordValue(record, 'due_at')) {
    throw newApiError(400, 'Для поручения нужен срок выполнения', { field: 'due_at' });
  }
}

module.exports = {
  validateAssignment,
  validateEvent,
  validateItemRecord,
  validateTask
};
