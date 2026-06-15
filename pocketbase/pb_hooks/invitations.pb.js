routerAdd(
  'POST',
  '/familytime/invitations/preview',
  (event) => {
    try {
      return require(`${__hooks}/_shared/invitations.pb.js`).preview(event);
    } catch (error) {
      throw newApiError(400, String(error), {});
    }
  },
  $apis.requireAuth('users')
);

routerAdd(
  'POST',
  '/familytime/invitations/accept',
  (event) => {
    try {
      return require(`${__hooks}/_shared/invitations.pb.js`).accept(event);
    } catch (error) {
      throw newApiError(400, String(error), {});
    }
  },
  $apis.requireAuth('users')
);
