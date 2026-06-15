import { COLLECTIONS } from '$lib/constants/collections';
import type { MemberRole } from '$lib/constants/roles';
import type { Family, FamilyMember, InvitationRecord } from '$lib/types/domain';

import { mapFamilyRecord } from './families.api';
import { mapFamilyMemberRecord } from './members.api';
import {
  type ActiveFamilyContext,
  asRecord,
  asString,
  getPocketBaseClient,
  memberRequestOptions,
  requireActiveContext,
  requireCollectionMethod,
  resolvePocketBaseUrl
} from './pocketbase';

export type CreateInvitationInput = {
  memberId?: string;
  role: Exclude<MemberRole, 'owner'>;
  email?: string;
};

export type AcceptInvitationResult = {
  family: Family;
  member: FamilyMember;
  invitation: InvitationRecord;
};

export async function createInvitation(
  input: CreateInvitationInput,
  context: Partial<ActiveFamilyContext>
): Promise<InvitationRecord> {
  const activeContext = requireActiveContext(context);
  const invitations = getPocketBaseClient().collection(COLLECTIONS.invitations);
  const create = requireCollectionMethod(invitations, 'create');
  const record = await create(
    {
      family: activeContext.familyId,
      member: input.memberId,
      code: createInviteCode(),
      role: input.role,
      email: input.email?.trim() || undefined,
      created_by: activeContext.memberId,
      expires_at: createExpiryDate()
    },
    memberRequestOptions(activeContext)
  );

  return mapInvitationRecord(record);
}

export async function getInvitationPreview(code: string): Promise<InvitationRecord> {
  const response = await sendPocketBase('/familytime/invitations/preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { code }
  });

  return mapInvitationRecord(response);
}

export async function acceptInvitation(code: string): Promise<AcceptInvitationResult> {
  const response = asRecord(
    await sendPocketBase('/familytime/invitations/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { code }
    })
  );

  return {
    family: mapFamilyRecord(response.family),
    member: mapFamilyMemberRecord(response.member),
    invitation: mapInvitationRecord(response.invitation)
  };
}

export function mapInvitationRecord(value: unknown): InvitationRecord {
  const record = asRecord(value);

  return {
    id: asString(record.id),
    family: asString(record.family),
    member: asString(record.member) || undefined,
    code: asString(record.code),
    role: asString(record.role) as MemberRole,
    email: asString(record.email) || undefined,
    createdBy: asString(record.created_by),
    expiresAt: asString(record.expires_at),
    usedByUser: asString(record.used_by_user) || undefined,
    usedAt: asString(record.used_at) || undefined,
    revokedAt: asString(record.revoked_at) || undefined
  };
}

async function sendPocketBase(
  path: string,
  options: {
    method: string;
    headers?: Record<string, string>;
    body?: Record<string, unknown>;
  }
): Promise<unknown> {
  const client = getPocketBaseClient();
  const token = client.authStore.token;

  if (!token && typeof client.send === 'function') {
    return client.send(path, options);
  }

  const response = await fetch(`${resolvePocketBaseUrl()}${path}`, {
    method: options.method,
    headers: {
      ...options.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  if (!response.ok) {
    throw new Error(`PocketBase custom route failed: ${response.status}`);
  }

  return response.json();
}

function createInviteCode(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(36).padStart(2, '0')).join('').slice(0, 12);
}

function createExpiryDate(): string {
  const date = new Date();
  date.setDate(date.getDate() + 14);
  return date.toISOString();
}
