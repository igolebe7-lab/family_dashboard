import { COLLECTIONS } from '$lib/constants/collections';

import {
  asRecord,
  asString,
  createAuthRequestClient,
  getPocketBaseClient,
  requireCollectionMethod,
  type PocketBaseClientLike
} from './pocketbase';

export type AuthUser = {
  id: string;
  email: string;
  name: string;
};

export type AuthSession = {
  token: string;
  user: AuthUser;
};

export type LoginInput = {
  email: string;
  password: string;
};

export type RegisterAdultInput = LoginInput & {
  passwordConfirm: string;
  name?: string;
};

export type UpdateCurrentUserProfileInput = {
  email: string;
  name: string;
};

export type UpdateCurrentUserPasswordInput = {
  oldPassword: string;
  password: string;
  passwordConfirm: string;
};

export type ConfirmPasswordResetInput = {
  token: string;
  password: string;
  passwordConfirm: string;
};

export async function login(input: LoginInput): Promise<AuthSession> {
  const client = getPocketBaseClient();
  const guard = captureSession(client);
  const users = createAuthRequestClient(client).collection(COLLECTIONS.users);
  const authWithPassword = requireCollectionMethod(users, 'authWithPassword');
  try {
    const response = asRecord(await authWithPassword(input.email, input.password));
    if (!guard.isCurrent()) throw new Error('Сессия изменилась. Повторите вход.');
    client.authStore.save?.(asString(response.token), response.record);
    return { token: asString(response.token), user: mapAuthUser(response.record) };
  } finally {
    guard.dispose();
  }
}

export async function registerAdult(input: RegisterAdultInput): Promise<AuthUser> {
  const users = getPocketBaseClient().collection(COLLECTIONS.users);
  const create = requireCollectionMethod(users, 'create');
  const record = await create({
    email: input.email,
    password: input.password,
    passwordConfirm: input.passwordConfirm,
    name: input.name || '',
    verified: false
  });

  return mapAuthUser(record);
}

export async function refreshAuth(): Promise<AuthSession | null> {
  const client = getPocketBaseClient();

  if (!client.authStore.isValid) {
    if (client.authStore.token || client.authStore.record) client.authStore.clear();
    return null;
  }

  const guard = captureSession(client);
  const users = createAuthRequestClient(client).collection(COLLECTIONS.users);
  const authRefresh = requireCollectionMethod(users, 'authRefresh');
  try {
    const response = asRecord(await authRefresh());
    if (!guard.isCurrent()) return null;
    const token = asString(response.token, client.authStore.token);
    const record = response.record || client.authStore.record;
    client.authStore.save?.(token, record);
    return { token, user: mapAuthUser(record) };
  } catch (error) {
    if (!guard.isCurrent()) return null;
    if ([401, 403].includes(Number(asRecord(error).status))) client.authStore.clear();
    throw error;
  } finally {
    guard.dispose();
  }
}

export function getCurrentSession(): AuthSession | null {
  const client = getPocketBaseClient();

  if (!client.authStore.isValid || !client.authStore.record) {
    return null;
  }

  return {
    token: client.authStore.token,
    user: mapAuthUser(client.authStore.record)
  };
}

export function observeAuthSession(callback: (session: AuthSession | null) => void): () => void {
  const client = getPocketBaseClient();
  let timer: ReturnType<typeof setTimeout> | undefined;
  function update(): void {
    clearTimeout(timer);
    const session = getCurrentSession();
    if (!session && (client.authStore.token || client.authStore.record)) {
      client.authStore.clear();
      return;
    }
    callback(session);
    if (session) {
      try {
        const payload = session.token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
        const expiresAt = Number(asRecord(JSON.parse(atob(payload))).exp) * 1000;
        if (Number.isFinite(expiresAt)) {
          timer = setTimeout(update, Math.min(2_147_483_647, Math.max(1, expiresAt - Date.now())));
        }
      } catch {
        // The SDK remains the authority for token validity.
      }
    }
  }
  const unsubscribe = client.authStore.onChange?.(update);
  update();
  if (typeof window !== 'undefined') window.addEventListener('focus', update);
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', update);
  return () => {
    clearTimeout(timer);
    unsubscribe?.();
    if (typeof window !== 'undefined') window.removeEventListener('focus', update);
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', update);
  };
}

export async function updateCurrentUserProfile(
  input: UpdateCurrentUserProfileInput
): Promise<AuthUser> {
  const client = getPocketBaseClient();
  const session = requireAuthenticatedSession();
  const users = createAuthRequestClient(client).collection(COLLECTIONS.users);
  const update = requireCollectionMethod(users, 'update');
  const record = await update(session.user.id, {
    email: input.email.trim(),
    name: input.name.trim()
  });

  syncAuthRecord(record, session);

  return mapAuthUser(record);
}

export async function updateCurrentUserPassword(
  input: UpdateCurrentUserPasswordInput
): Promise<AuthUser> {
  const client = getPocketBaseClient();
  const session = requireAuthenticatedSession();
  const users = createAuthRequestClient(client).collection(COLLECTIONS.users);
  const update = requireCollectionMethod(users, 'update');
  const record = await update(session.user.id, {
    oldPassword: input.oldPassword,
    password: input.password,
    passwordConfirm: input.passwordConfirm
  });

  if (getCurrentSession()?.user.id === session.user.id) client.authStore.clear();

  return mapAuthUser(record);
}

export async function requestPasswordReset(email: string): Promise<void> {
  const users = getPocketBaseClient().collection(COLLECTIONS.users);
  const requestReset = requireCollectionMethod(users, 'requestPasswordReset');

  await requestReset(email.trim());
}

export async function confirmPasswordReset(input: ConfirmPasswordResetInput): Promise<void> {
  const client = getPocketBaseClient();
  const session = getCurrentSession();
  const users = createAuthRequestClient(client).collection(COLLECTIONS.users);
  const confirmReset = requireCollectionMethod(users, 'confirmPasswordReset');

  await confirmReset(input.token, input.password, input.passwordConfirm);
  if (session && getCurrentSession()?.user.id === session.user.id) client.authStore.clear();
}

export function logout(): void {
  getPocketBaseClient().authStore.clear();
}

export function getAuthErrorMessage(error: unknown, fallback: string): string {
  const record = asRecord(error);
  const responseData = asRecord(asRecord(record.data).data);
  const firstFieldError = Object.values(responseData)
    .map((value) => asString(asRecord(value).message))
    .find(Boolean);

  if (firstFieldError) {
    return firstFieldError;
  }

  return fallback;
}

function requireAuthenticatedSession(): AuthSession {
  const session = getCurrentSession();

  if (!session) {
    throw new Error('authenticated user is required');
  }

  return session;
}

function syncAuthRecord(record: unknown, expected: AuthSession): void {
  const client = getPocketBaseClient();

  if (client.authStore.isValid && client.authStore.token === expected.token &&
      asRecord(client.authStore.record).id === expected.user.id && client.authStore.save) {
    client.authStore.save(client.authStore.token, record);
  }
}

function captureSession(client: PocketBaseClientLike) {
  const token = client.authStore.token;
  const userId = asRecord(client.authStore.record).id;
  let changed = false;
  const dispose = client.authStore.onChange?.((nextToken, record) => {
    if (nextToken !== token || asRecord(record).id !== userId) changed = true;
  }) ?? (() => {});
  return {
    isCurrent: () => !changed && client.authStore.token === token && asRecord(client.authStore.record).id === userId,
    dispose
  };
}

function mapAuthUser(value: unknown): AuthUser {
  const record = asRecord(value);

  return {
    id: asString(record.id),
    email: asString(record.email),
    name: asString(record.name)
  };
}
