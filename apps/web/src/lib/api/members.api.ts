import { COLLECTIONS } from '$lib/constants/collections';
import type { MemberRole } from '$lib/constants/roles';
import type { FamilyMember } from '$lib/types/domain';

import {
  type ActiveFamilyContext,
  asBoolean,
  asRecord,
  asString,
  asStringArray,
  getPocketBaseClient,
  memberRequestOptions,
  requireActiveContext,
  requireCollectionMethod
} from './pocketbase';

export type CreateMemberInput = {
  displayName: string;
  role: MemberRole;
  user?: string;
  colorKey?: string;
  colorHex?: string;
  birthday?: string;
  managedBy?: string[];
  isChildLoginEnabled?: boolean;
};

export async function listMembers(context: Partial<ActiveFamilyContext>): Promise<FamilyMember[]> {
  const activeContext = requireActiveContext(context);
  const members = getPocketBaseClient().collection(COLLECTIONS.familyMembers);
  const getFullList = requireCollectionMethod(members, 'getFullList');
  const records = await getFullList({
    filter: `family = "${activeContext.familyId}" && active = true`,
    sort: 'display_name',
    ...memberRequestOptions(activeContext)
  });

  return records.map(mapFamilyMemberRecord);
}

export async function createMember(
  input: CreateMemberInput,
  context: Partial<ActiveFamilyContext>
): Promise<FamilyMember> {
  const activeContext = requireActiveContext(context);
  const members = getPocketBaseClient().collection(COLLECTIONS.familyMembers);
  const create = requireCollectionMethod(members, 'create');
  const record = await create(
    {
      family: activeContext.familyId,
      user: input.user,
      display_name: input.displayName,
      role: input.role,
      color_key: input.colorKey,
      color_hex: input.colorHex,
      birthday: input.birthday,
      managed_by: input.managedBy || [],
      is_child_login_enabled: input.isChildLoginEnabled || false,
      active: true,
      created_by: activeContext.memberId
    },
    memberRequestOptions(activeContext)
  );

  return mapFamilyMemberRecord(record);
}

export function mapFamilyMemberRecord(value: unknown): FamilyMember {
  const record = asRecord(value);

  return {
    id: asString(record.id),
    family: asString(record.family),
    user: asString(record.user) || undefined,
    displayName: asString(record.display_name),
    role: asString(record.role) as MemberRole,
    colorKey: asString(record.color_key) || undefined,
    colorHex: asString(record.color_hex) || undefined,
    birthday: asString(record.birthday) || undefined,
    managedBy: asStringArray(record.managed_by),
    active: asBoolean(record.active)
  };
}
