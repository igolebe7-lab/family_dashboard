function preview(event) {
  const code = getInviteCodeFromRequest(event);
  const invitation = findActiveInvitation(event.app, code);

  return event.json(200, serializeInvitation(invitation));
}

function accept(event) {
  const auth = require(`${__hooks}/_shared/auth.pb.js`).requireAuth(event);
  const code = getInviteCodeFromRequest(event);
  const invitation = findActiveInvitation(event.app, code);
  validateInvitationEmail(invitation, auth);

  const family = findRecordById(event.app, 'families', invitation.get('family'));
  const member = acceptInvitationForUser(event.app, invitation, family, auth);

  invitation.set('used_by_user', auth.id);
  invitation.set('used_at', nowIso());
  saveRecord(event.app, invitation);

  return event.json(200, {
    family: serializeFamily(family),
    member: serializeMember(member),
    invitation: serializeInvitation(invitation)
  });
}

function getInviteCodeFromRequest(event) {
  const requestInfo = require(`${__hooks}/_shared/auth.pb.js`).getRequestInfo(event);
  const body = requestInfo.body || {};
  const code = String(body.code || '').trim();

  if (!code) {
    throw new Error('Код приглашения не указан');
  }

  return code;
}

function findActiveInvitation(app, code) {
  const safeCode = escapeFilterValue(String(code || '').trim());
  if (!safeCode) {
    throw new Error('Код приглашения не указан');
  }

  const invitation = findFirstRecordByFilter(app, 'invitations', `code='${safeCode}'`);

  if (!invitation) {
    throw new Error('Приглашение не найдено или уже использовано');
  }

  if (hasRecordValue(invitation, 'used_at') || hasRecordValue(invitation, 'revoked_at')) {
    throw new Error('Приглашение не найдено или уже использовано');
  }

  if (new Date(invitation.get('expires_at')).getTime() < Date.now()) {
    throw new Error('Срок приглашения истёк');
  }

  return invitation;
}

function findFirstRecordByFilter(app, collection, filter) {
  if (typeof app.findFirstRecordByFilter === 'function') {
    return app.findFirstRecordByFilter(collection, filter);
  }

  const records =
    typeof app.FindRecordsByFilter === 'function'
      ? app.FindRecordsByFilter(collection, filter, '', 1, 0)
      : app.findRecordsByFilter(collection, filter, '', 1, 0);
  return records && records.length ? records[0] : null;
}

function findRecordById(app, collection, id) {
  if (typeof app.findRecordById === 'function') {
    return app.findRecordById(collection, id);
  }
  return app.FindRecordById(collection, id);
}

function findCollectionByNameOrId(app, collection) {
  if (typeof app.findCollectionByNameOrId === 'function') {
    return app.findCollectionByNameOrId(collection);
  }
  return app.FindCollectionByNameOrId(collection);
}

function saveRecord(app, record) {
  if (typeof app.save === 'function') {
    app.save(record);
    return;
  }
  app.Save(record);
}

function acceptInvitationForUser(app, invitation, family, auth) {
  const linkedMemberId = invitation.get('member');
  if (linkedMemberId) {
    const member = findRecordById(app, 'family_members', linkedMemberId);

    if (member.get('family') !== family.id) {
      throw new Error('Профиль не принадлежит семье приглашения');
    }

    const existingUser = member.get('user');
    if (existingUser && existingUser !== auth.id) {
      throw new Error('Профиль уже связан с другим аккаунтом');
    }

    member.set('user', auth.id);
    member.set('active', true);
    saveRecord(app, member);
    return member;
  }

  const collection = findCollectionByNameOrId(app, 'family_members');
  const member = new Record(collection);
  member.set('family', family.id);
  member.set('user', auth.id);
  member.set('display_name', getAuthDisplayName(auth));
  member.set('role', invitation.get('role'));
  member.set('color_key', 'blue');
  member.set('active', true);
  member.set('created_by', invitation.get('created_by'));
  saveRecord(app, member);

  return member;
}

function validateInvitationEmail(invitation, auth) {
  const email = String(invitation.get('email') || '').trim().toLowerCase();
  if (!email) return;

  const authEmail = String(auth.get('email') || '').trim().toLowerCase();
  if (email !== authEmail) {
    throw new Error('Это приглашение выписано на другой email');
  }
}

function getAuthDisplayName(auth) {
  return String(auth.get('name') || auth.get('email') || 'Новый взрослый').trim();
}

function serializeFamily(record) {
  return {
    id: record.id,
    name: record.get('name'),
    slug: record.get('slug'),
    timezone: record.get('timezone'),
    owner_user: record.get('owner_user')
  };
}

function serializeMember(record) {
  return {
    id: record.id,
    family: record.get('family'),
    user: record.get('user'),
    display_name: record.get('display_name'),
    role: record.get('role'),
    color_key: record.get('color_key'),
    color_hex: record.get('color_hex'),
    birthday: record.get('birthday'),
    managed_by: require(`${__hooks}/_shared/auth.pb.js`).getRecordArray(record, 'managed_by'),
    active: record.get('active')
  };
}

function serializeInvitation(record) {
  return {
    id: record.id,
    family: record.get('family'),
    member: record.get('member'),
    code: record.get('code'),
    role: record.get('role'),
    email: record.get('email'),
    created_by: record.get('created_by'),
    expires_at: record.get('expires_at'),
    used_by_user: record.get('used_by_user'),
    used_at: record.get('used_at'),
    revoked_at: record.get('revoked_at')
  };
}

function hasRecordValue(record, field) {
  return String(record.get(field) || '').trim() !== '';
}

function nowIso() {
  return new Date().toISOString();
}

function escapeFilterValue(value) {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

module.exports = {
  accept,
  preview
};
