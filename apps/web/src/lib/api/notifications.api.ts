import { COLLECTIONS } from '$lib/constants/collections';
import type { NotificationRecord } from '$lib/types/domain';

import {
  type ActiveFamilyContext,
  asRecord,
  asString,
  escapeFilterValue,
  getPocketBaseClient,
  memberRequestOptions,
  requireActiveContext,
  requireCollectionMethod
} from './pocketbase';

export async function listUnreadNotifications(
  context: Partial<ActiveFamilyContext>
): Promise<NotificationRecord[]> {
  return listNotifications(context, { unreadOnly: true });
}

export async function listNotifications(
  context: Partial<ActiveFamilyContext>,
  options: { unreadOnly?: boolean; limit?: number } = {}
): Promise<NotificationRecord[]> {
  const activeContext = requireActiveContext(context);
  const notifications = getPocketBaseClient().collection(COLLECTIONS.notifications);
  const getList = requireCollectionMethod(notifications, 'getList');
  const filter = [
    `family = "${escapeFilterValue(activeContext.familyId)}"`,
    options.unreadOnly ? 'read_at = ""' : ''
  ]
    .filter(Boolean)
    .join(' && ');
  const result = asRecord(
    await getList(1, options.limit ?? 50, {
      filter,
      sort: '-created',
      requestKey: null,
      ...memberRequestOptions(activeContext)
    })
  );

  return Array.isArray(result.items) ? result.items.map(mapNotificationRecord) : [];
}

export async function markAllNotificationsRead(
  context: Partial<ActiveFamilyContext>,
  readAt = new Date().toISOString()
): Promise<NotificationRecord[]> {
  const unread = await listUnreadNotifications(context);

  return Promise.all(unread.map((record) => markNotificationRead(record.id, context, readAt)));
}

export async function markNotificationRead(
  id: string,
  context: Partial<ActiveFamilyContext>,
  readAt = new Date().toISOString()
): Promise<NotificationRecord> {
  const activeContext = requireActiveContext(context);
  const notifications = getPocketBaseClient().collection(COLLECTIONS.notifications);
  const update = requireCollectionMethod(notifications, 'update');
  const record = await update(id, { read_at: readAt }, memberRequestOptions(activeContext));

  return mapNotificationRecord(record);
}

export function mapNotificationRecord(value: unknown): NotificationRecord {
  const record = asRecord(value);

  return {
    id: asString(record.id),
    family: asString(record.family),
    recipientMember: asString(record.recipient_member),
    recipientUser: asString(record.recipient_user) || undefined,
    type: asString(record.type) as NotificationRecord['type'],
    title: asString(record.title),
    body: asString(record.body),
    item: asString(record.item) || undefined,
    occurrence: asString(record.occurrence) || undefined,
    readAt: asString(record.read_at) || undefined,
    deliveredAt: asString(record.delivered_at) || undefined,
    created: asString(record.created)
  };
}
