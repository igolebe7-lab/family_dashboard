migrate(app => {
  const users = app.findCollectionByNameOrId('users');
  if (!users.fields.getByName('timezone')) users.fields.add(new TextField({ name: 'timezone', max: 80 }));
  app.save(users);
}, app => {
  const users = app.findCollectionByNameOrId('users');
  users.fields.removeByName('timezone');
  app.save(users);
});
