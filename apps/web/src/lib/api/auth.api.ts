import { COLLECTIONS } from '$lib/constants/collections';

import {
  asRecord,
  asString,
  getPocketBaseClient,
  requireCollectionMethod
} from './pocketbase';

export type AuthUser = {
  id: string;
  email: string;
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

export async function login(input: LoginInput): Promise<AuthSession> {
  const users = getPocketBaseClient().collection(COLLECTIONS.users);
  const authWithPassword = requireCollectionMethod(users, 'authWithPassword');
  const response = asRecord(await authWithPassword(input.email, input.password));

  return {
    token: asString(response.token),
    user: mapAuthUser(response.record)
  };
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
    return null;
  }

  const users = client.collection(COLLECTIONS.users);
  const authRefresh = requireCollectionMethod(users, 'authRefresh');
  const response = asRecord(await authRefresh());

  return {
    token: asString(response.token, client.authStore.token),
    user: mapAuthUser(response.record || client.authStore.record)
  };
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

export function logout(): void {
  getPocketBaseClient().authStore.clear();
}

function mapAuthUser(value: unknown): AuthUser {
  const record = asRecord(value);

  return {
    id: asString(record.id),
    email: asString(record.email)
  };
}
