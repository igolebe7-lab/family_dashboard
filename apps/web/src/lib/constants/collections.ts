export const COLLECTIONS = {
  users: 'users',
  families: 'families',
  familyMembers: 'family_members',
  items: 'items',
  itemOccurrences: 'item_occurrences',
  dayAnnotations: 'day_annotations',
  itemComments: 'item_comments',
  itemActivity: 'item_activity',
  notifications: 'notifications',
  pushSubscriptions: 'push_subscriptions',
  invitations: 'invitations',
  choreTemplates: 'chore_templates'
} as const;

export type CollectionName = (typeof COLLECTIONS)[keyof typeof COLLECTIONS];
