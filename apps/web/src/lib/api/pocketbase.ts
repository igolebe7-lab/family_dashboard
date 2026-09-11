import PocketBase, { BaseAuthStore } from 'pocketbase';

export const DEFAULT_POCKETBASE_URL = '/';

export type ActiveFamilyContext = {
  familyId: string;
  memberId: string;
};

export type PocketBaseAuthStoreLike = {
  clear: () => void;
  save?: (token: string, record: unknown) => void;
  onChange?: (callback: (token: string, record: unknown) => void, fireImmediately?: boolean) => () => void;
  isValid: boolean;
  token: string;
  record: unknown;
};

export type PocketBaseCollectionLike = {
  authWithPassword?: (email: string, password: string) => Promise<unknown>;
  authRefresh?: () => Promise<unknown>;
  requestPasswordReset?: (email: string, options?: Record<string, unknown>) => Promise<unknown>;
  confirmPasswordReset?: (
    token: string,
    password: string,
    passwordConfirm: string,
    options?: Record<string, unknown>
  ) => Promise<unknown>;
  create?: (body: Record<string, unknown>, options?: Record<string, unknown>) => Promise<unknown>;
  update?: (
    id: string,
    body: Record<string, unknown>,
    options?: Record<string, unknown>
  ) => Promise<unknown>;
  delete?: (id: string, options?: Record<string, unknown>) => Promise<unknown>;
  getList?: (
    page: number,
    perPage: number,
    options?: Record<string, unknown>
  ) => Promise<unknown>;
  getOne?: (id: string, options?: Record<string, unknown>) => Promise<unknown>;
  getFullList?: (options?: Record<string, unknown>) => Promise<unknown[]>;
  subscribe?: (
    topic: string,
    callback: (event: unknown) => void,
    options?: Record<string, unknown>
  ) => Promise<() => void> | (() => void);
};

export type PocketBaseClientLike = {
  baseURL?: string;
  authStore: PocketBaseAuthStoreLike;
  collection: (name: string) => PocketBaseCollectionLike;
  send?: (path: string, options?: Record<string, unknown>) => Promise<unknown>;
};

let pocketBaseClient: PocketBaseClientLike | undefined;

export function resolvePocketBaseUrl(
  value = import.meta.env.PUBLIC_POCKETBASE_URL,
  origin = typeof location === 'undefined' ? '' : location.origin
): string {
  const normalized = String(value || '').trim().replace(/\/+$/, '');
  return normalized || origin || DEFAULT_POCKETBASE_URL;
}

export function createAuthRequestClient(client: PocketBaseClientLike): PocketBaseClientLike {
  // SDK auth methods save responses automatically. Stage them in memory so a late
  // response cannot overwrite logout or an account change in the shared auth store.
  if (!client.baseURL) return client;
  const requestClient = new PocketBase(client.baseURL, new BaseAuthStore()) as PocketBaseClientLike;
  requestClient.authStore.save?.(client.authStore.token, client.authStore.record);
  return requestClient;
}

export function createPocketBaseClient(baseUrl = resolvePocketBaseUrl()): PocketBaseClientLike {
  return new PocketBase(baseUrl) as PocketBaseClientLike;
}

export function getPocketBaseClient(): PocketBaseClientLike {
  pocketBaseClient ??= createPocketBaseClient();
  return pocketBaseClient;
}

export function setPocketBaseClient(client: PocketBaseClientLike): void {
  pocketBaseClient = client;
}

export function resetPocketBaseClient(): void {
  pocketBaseClient = undefined;
}

export function requireActiveContext(context?: Partial<ActiveFamilyContext>): ActiveFamilyContext {
  if (!context?.familyId || !context?.memberId) {
    throw new Error('active family and member context is required');
  }

  return {
    familyId: context.familyId,
    memberId: context.memberId
  };
}

export function memberRequestOptions(context: ActiveFamilyContext): {
  headers: { 'X-Family-Member-Id': string };
} {
  return {
    headers: {
      'X-Family-Member-Id': context.memberId
    }
  };
}

export function requireCollectionMethod<T extends keyof PocketBaseCollectionLike>(
  collection: PocketBaseCollectionLike,
  method: T
): NonNullable<PocketBaseCollectionLike[T]> {
  const value = collection[method];

  if (typeof value !== 'function') {
    throw new Error(`PocketBase collection method is unavailable: ${String(method)}`);
  }

  return value.bind(collection) as NonNullable<PocketBaseCollectionLike[T]>;
}

export function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object') return {};
  return value as Record<string, unknown>;
}

export function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

export function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

export function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string');
}

export function escapeFilterValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}
