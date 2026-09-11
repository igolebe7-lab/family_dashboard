const PB_URL = process.env.PB_URL || 'http://127.0.0.1:8090';
const SUPERUSER_EMAIL = process.env.PB_SUPERUSER_EMAIL || 'admin@familytime.local';
const SUPERUSER_PASSWORD = process.env.PB_SUPERUSER_PASSWORD || 'ChangeMe123456!';

const suffix = Date.now();
const email = `ui.auth.${suffix}@familytime.local`;
const password = 'AuthSmokePass12345!';
const nextPassword = 'AuthSmokePass67890!';
const familySlug = `ui-auth-${suffix}`;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function request(path, options = {}) {
  const { token, body, method = body ? 'POST' : 'GET', expectOk = true } = options;
  const response = await fetch(`${PB_URL}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : undefined;

  if (expectOk && !response.ok) {
    throw new Error(`${method} ${path} failed: ${response.status} ${text}`);
  }

  return { response, data };
}

async function auth(collection, identity, passwordValue) {
  return (
    await request(`/api/collections/${collection}/auth-with-password`, {
      body: { identity, password: passwordValue }
    })
  ).data;
}

async function deleteRecord(collection, token, id) {
  await request(`/api/collections/${collection}/records/${id}`, {
    token,
    method: 'DELETE',
    expectOk: false
  });
}

const superAuth = await auth('_superusers', SUPERUSER_EMAIL, SUPERUSER_PASSWORD);
const superToken = superAuth.token;
const created = { family: null, member: null, user: null };

try {
  created.user = (
    await request('/api/collections/users/records', {
      token: superToken,
      body: {
        email,
        password,
        passwordConfirm: password,
        name: 'Auth Smoke',
        verified: false
      }
    })
  ).data;

  let userAuth = await auth('users', email, password);
  assert(userAuth.record.id === created.user.id, 'created user cannot log in');

  created.family = (
    await request('/api/collections/families/records', {
      token: userAuth.token,
      body: {
        name: 'Auth Smoke Family',
        slug: familySlug,
        timezone: 'Europe/Amsterdam',
        owner_user: created.user.id
      }
    })
  ).data;

  created.member = (
    await request('/api/collections/family_members/records', {
      token: userAuth.token,
      body: {
        family: created.family.id,
        user: created.user.id,
        display_name: 'Auth Smoke',
        role: 'owner',
        color_key: 'green',
        active: true
      }
    })
  ).data;

  const updated = (
    await request(`/api/collections/users/records/${created.user.id}`, {
      token: userAuth.token,
      method: 'PATCH',
      body: { name: 'Auth Smoke Updated' }
    })
  ).data;
  assert(updated.name === 'Auth Smoke Updated', 'profile name was not updated');

  await request(`/api/collections/users/records/${created.user.id}`, {
    token: userAuth.token,
    method: 'PATCH',
    body: {
      oldPassword: password,
      password: nextPassword,
      passwordConfirm: nextPassword
    }
  });
  userAuth = await auth('users', email, nextPassword);
  assert(Boolean(userAuth.token), 'new password login failed');

  const reset = await request('/api/collections/users/request-password-reset', {
    body: { email },
    expectOk: false
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        email,
        family: created.family.id,
        member: created.member.id,
        resetRequestStatus: reset.response.status
      },
      null,
      2
    )
  );
} finally {
  if (created.member?.id) await deleteRecord('family_members', superToken, created.member.id);
  if (created.family?.id) await deleteRecord('families', superToken, created.family.id);
  if (created.user?.id) await deleteRecord('users', superToken, created.user.id);
}
