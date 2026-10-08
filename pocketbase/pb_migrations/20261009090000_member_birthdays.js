migrate((app) => {
  const collection = app.findCollectionByNameOrId('day_annotations');
  collection.fields.add(new DateField({ name: 'birth_date' }));
  app.save(collection);

  // Profiles are the source of truth. Never infer a birth year from a legacy annotation.year.
  const members = app.findRecordsByFilter('family_members', 'birthday != ""', '', 0, 0);
  for (const member of members) {
    const rows = app.findRecordsByFilter('day_annotations', 'kind = "birthday" && linked_member = {:member}', 'created,id', 0, 0, { member: member.id });
    const birthDate = member.getString('birthday').slice(0, 10);
    const date = new Date(`${birthDate}T00:00:00Z`);
    if (!member.getBool('active') || !Number.isFinite(date.getTime()) || birthDate > new Date().toISOString().slice(0, 10)) continue;
    const annotation = rows[0] || new Record(collection);
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
  collection.indexes.push('CREATE UNIQUE INDEX idx_member_birthday_unique ON day_annotations (linked_member) WHERE kind = \'birthday\' AND source = \'family_member\' AND linked_member != \'\'');
  app.save(collection);
}, (app) => {
  // Rollback restores the versioned database backup, not guessed legacy birthday data.
  throw new Error('Restore the pre-release backup to roll back member birthday synchronization.');
});
