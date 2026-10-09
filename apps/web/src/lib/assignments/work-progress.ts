import type { FamilyMember, Item, ItemOccurrence } from '$lib/types/domain';
import { canViewItem } from '$lib/utils/permissions';

export function canEditWorkChecklist(actor: FamilyMember | undefined, item: Item, members: readonly FamilyMember[], row: ItemOccurrence | undefined): boolean {
  return Boolean(actor && row && ['task', 'assignment'].includes(item.kind)
    && ['todo', 'assigned', 'accepted', 'in_progress', 'overdue', 'rejected'].includes(row.status)
    && canViewItem(actor, item, members)
    && ([item.owner, item.createdBy, ...item.assignees].includes(actor.id)
      || [...item.assignees, ...(item.owner ? [item.owner] : [])].some(id => {
        const child = members.find(member => member.id === id && member.active && member.family === actor.family && ['child', 'teen'].includes(member.role));
        return child && (actor.role === 'owner' || actor.role === 'parent' && child.managedBy.includes(actor.id));
      })));
}

export function latestWorkOccurrence(current: ItemOccurrence, incoming: ItemOccurrence): ItemOccurrence {
  const currentTime = Date.parse(current.updated?.replace(' ', 'T') ?? '');
  const incomingTime = Date.parse(incoming.updated?.replace(' ', 'T') ?? '');
  return Number.isFinite(currentTime) && Number.isFinite(incomingTime) && currentTime > incomingTime ? current : incoming;
}
