cronAdd('familytime_reminders', '* * * * *', () => {
  require(`${__hooks}/_shared/reminders.pb.js`).runReminders($app);
});
