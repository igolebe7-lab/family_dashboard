import type { FamilyMember } from '$lib/types/domain';

// Matches the backend's canManageMember policy; the actor is the signed-in user,
// never the currently selected child profile.
export function getSelectableProfiles(members: readonly FamilyMember[], userId?: string): FamilyMember[] {
  if (!userId) return [];
  const own = members.filter(member => member.active && member.user === userId);
  return members.filter(target => target.active && own.some(actor =>
    actor.family === target.family && (actor.id === target.id ||
      (['child', 'teen'].includes(target.role) &&
        (actor.role === 'owner' || (actor.role === 'parent' && target.managedBy.includes(actor.id)))))
  ));
}
