import { COLLECTIONS } from '$lib/constants/collections';
import type { NotificationRecord } from '$lib/types/domain';

import {
  type ActiveFamilyContext,
  asRecord,
  asString,
  getPocketBaseClient,
  memberRequestOptions,
  requireActiveContext,
  requireCollectionMethod
} from './pocketbase';

export async function listUnreadNotifications(
  context: Partial<ActiveFamilyContext>
): Promise<NotificationRecord[]> {
  const activeContext = requireActiveContext(context);
  const notifications = getPocketBaseClient().collection(COLLECTIONS.notifications);
  const getFullList = requireCollectionMethod(notifications, 'getFullList');
  const records = await getFullList({
    filter: `family = "${activeContext.familyId}" && read_at = ""`,
    sort: '-created',
    ...memberRequestOptions(activeContext)
  });

  return records.map(mapNotificationRecord);
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
