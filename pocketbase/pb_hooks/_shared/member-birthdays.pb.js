function validateBirthDate(value, field) {
  if (value == null || String(value) === '') return;
  const key = String(value).slice(0, 10);
  const date = new Date(`${key}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || !Number.isFinite(date.getTime()) ||
      date.toISOString().slice(0, 10) !== key || key < '1900-01-01' ||
      key > new Date().toISOString().slice(0, 10)) {
    throw new ApiError(400, 'Проверьте дату рождения', { field });
  }
}

function validateBirthDateRequest(event, field) {
  // requestInfo().body already contains DateField-coerced values (invalid dates become empty).
  const body = new DynamicModel({ [field]: '' });
  event.bindBody(body);
  validateBirthDate(body[field], field);
}

function syncMemberBirthday(app, member) {
  const rows = app.findRecordsByFilter('day_annotations',
    'kind = "birthday" && linked_member = {:member}', 'created,id', 0, 0, { member: member.id });
  const birthDate = member.getString('birthday').slice(0, 10);
  if (!birthDate || !member.getBool('active')) {
    for (const row of rows) app.delete(row);
    return;
  }
  const date = new Date(`${birthDate}T00:00:00Z`);
  validateBirthDate(birthDate, 'birthday');
  const annotation = rows[0] || new Record(app.findCollectionByNameOrId('day_annotations'));
  annotation.load({
    family: member.getString('family'), kind: 'birthday',
    title: `День рождения · ${member.getString('display_name')}`,
    birth_date: birthDate, month: date.getUTCMonth() + 1, day: date.getUTCDate(),
    year: 0, recurrence: 'yearly', color: member.getString('color_key') || 'green',
    tone: 'positive', visibility: 'family', source: 'family_member', readonly: true,
    linked_member: member.id, person_name: member.getString('display_name')
  });
  app.save(annotation);
  for (const duplicate of rows.slice(1)) app.delete(duplicate);
}

module.exports = { syncMemberBirthday, validateBirthDate, validateBirthDateRequest };
