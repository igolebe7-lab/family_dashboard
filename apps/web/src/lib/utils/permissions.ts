import { isAdultRole } from '$lib/constants/roles';
import type { FamilyMember, Item } from '$lib/types/domain';

export function canViewItem(member: FamilyMember, item: Item, familyMembers: readonly FamilyMember[] = []): boolean {
  if (!member.active) return false;
  if (member.family !== item.family) return false;
  if (item.archived) return false;

  if (item.visibility === 'family') return true;
  if (item.visibility === 'adults') return isAdultRole(member.role);

  if (item.visibility === 'private') {
    return item.createdBy === member.id || item.owner === member.id || member.role === 'owner';
  }

  const directlyRelated = new Set([item.createdBy, item.owner, ...item.assignees, ...item.participants]);
  if (directlyRelated.has(member.id)) return true;

  if (member.role === 'owner') return true;

  return [...item.assignees, ...item.participants].some((memberId) =>
    canManageMember(member, memberId, familyMembers)
  );
}

export function canManageMember(
  actor: FamilyMember,
  targetMemberId: string,
  familyMembers: readonly FamilyMember[]
): boolean {
  if (actor.role === 'owner') return actor.family === findMemberFamily(targetMemberId, familyMembers);
  if (actor.role !== 'parent') return false;

  const target = familyMembers.find((member) => member.id === targetMemberId);
  if (!target || target.family !== actor.family) return false;

  return actor.managedBy.includes(targetMemberId) || target.managedBy.includes(actor.id);
}

function findMemberFamily(memberId: string, familyMembers: readonly FamilyMember[]): string | undefined {
  return familyMembers.find((member) => member.id === memberId)?.family;
}
