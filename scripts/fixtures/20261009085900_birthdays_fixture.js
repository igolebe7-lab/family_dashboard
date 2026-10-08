migrate((app) => {
  const user = new Record(app.findCollectionByNameOrId('users'));
  user.set('email', 'birthday-upgrade@familytime.local');
  user.setPassword('IsolatedUpgradeOnly12345');
  app.save(user);
  const family = new Record(app.findCollectionByNameOrId('families'));
  family.load({ name: 'Birthday upgrade fixture', slug: 'birthday-upgrade-fixture', owner_user: user.id, timezone: 'UTC' });
  app.save(family);
  const member = new Record(app.findCollectionByNameOrId('family_members'));
  member.load({ family: family.id, user: user.id, display_name: 'Upgrade member', role: 'owner', active: true, birthday: '1980-06-18' });
  app.save(member);
  for (const row of app.findRecordsByFilter('day_annotations', 'family = {:family}', '', 0, 0, { family: family.id })) app.delete(row);
  for (let index = 0; index < 2; index++) {
    const row = new Record(app.findCollectionByNameOrId('day_annotations'));
    row.load({ family: family.id, kind: 'birthday', title: 'Old linked birthday', month: 6, day: 18, year: 2026,
      recurrence: 'yearly', color: 'green', tone: 'positive', visibility: 'family', source: 'manual', readonly: false,
      linked_member: member.id, person_name: 'Upgrade member', description: 'Keep this note', created_by: member.id });
    app.save(row);
  }
  const legacy = new Record(app.findCollectionByNameOrId('day_annotations'));
  legacy.load({ family: family.id, kind: 'birthday', title: 'Unknown birth year', month: 10, day: 8, year: 2026,
    recurrence: 'yearly', color: 'blue', tone: 'positive', visibility: 'family', source: 'manual', readonly: false,
    person_name: 'Legacy external person', created_by: member.id });
  app.save(legacy);
});
