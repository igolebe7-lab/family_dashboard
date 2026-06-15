export const MEMBER_ROLES = ['owner', 'parent', 'adult', 'teen', 'child', 'guest'] as const;

export type MemberRole = (typeof MEMBER_ROLES)[number];

export const ADULT_ROLES = ['owner', 'parent', 'adult'] as const satisfies readonly MemberRole[];
export const CHILD_ROLES = ['teen', 'child'] as const satisfies readonly MemberRole[];

export function isAdultRole(role: MemberRole): boolean {
  return ADULT_ROLES.includes(role as (typeof ADULT_ROLES)[number]);
}

export function canManageChildren(role: MemberRole): boolean {
  return role === 'owner' || role === 'parent';
}
