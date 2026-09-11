import { COLLECTIONS } from '$lib/constants/collections';
import type { NotificationRecord } from '$lib/types/domain';
import { buildTodayCalendarHref } from '$lib/calendar/today-navigation';

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

export type InboxNotification = NotificationRecord & {
  destination: { href: string; label: string } | null;
};

export async function listUnreadNotifications(
  context: Partial<ActiveFamilyContext>
): Promise<NotificationRecord[]> {
  return listNotifications(context, { unreadOnly: true });
}

export async function listNotifications(
  context: Partial<ActiveFamilyContext>,
  options: { unreadOnly?: boolean; limit?: number; page?: number; createdBefore?: string } = {}
): Promise<InboxNotification[]> {
  const activeContext = requireActiveContext(context);
  const notifications = getPocketBaseClient().collection(COLLECTIONS.notifications);
  const getList = requireCollectionMethod(notifications, 'getList');
  const filter = [
    `family = "${escapeFilterValue(activeContext.familyId)}"`,
    `recipient_member = "${escapeFilterValue(activeContext.memberId)}"`,
    options.unreadOnly ? 'read_at = ""' : '',
    options.createdBefore ? `created <= "${escapeFilterValue(options.createdBefore)}"` : ''
  ]
    .filter(Boolean)
    .join(' && ');
  const result = asRecord(
    await getList(Math.max(1, Math.trunc(options.page ?? 1) || 1), Math.min(100, Math.max(1, Math.trunc(options.limit ?? 50) || 50)), {
      filter,
      sort: '-created',
      expand: 'item,occurrence',
      requestKey: null,
      ...memberRequestOptions(activeContext)
    })
  );

  return Array.isArray(result.items) ? result.items.map((record) => ({
    ...mapNotificationRecord(record),
    destination: notificationDestination(record)
  })) : [];
}

export async function markAllNotificationsRead(
  context: Partial<ActiveFamilyContext>,
  readAt = new Date().toISOString(),
  signal?: AbortSignal
): Promise<NotificationRecord[]> {
  const activeContext = requireActiveContext(context);
  const updated: NotificationRecord[] = [];
  const seen = new Set<string>();
  // Always drain page one: successful updates remove rows from the unread result.
  for (;;) {
    signal?.throwIfAborted();
    const unread = await listNotifications(activeContext, { unreadOnly: true, limit: 50, createdBefore: readAt });
    for (const record of unread) {
      signal?.throwIfAborted();
      if (seen.has(record.id)) throw new Error('Unread notification did not advance');
      seen.add(record.id);
      updated.push(await markNotificationRead(record.id, activeContext, readAt));
    }
    if (unread.length < 50) return updated;
  }
}

export function notificationDestination(value: unknown): InboxNotification['destination'] {
  const record = asRecord(value);
  const expanded = asRecord(record.expand);
  const occurrence = asRecord(expanded.occurrence);
  const item = asRecord(expanded.item);
  const related = occurrence.kind ? occurrence : item;
  if (related.family && related.family !== record.family) return null;
  const itemId = asString(record.item) || asString(occurrence.item) || asString(item.id);
  if (itemId) return { href: `/app/items/${encodeURIComponent(itemId)}`, label: 'Открыть запись' };
  const type = asString(record.type);
  const kind = asString(related.kind);
  if (kind === 'assignment' || type.startsWith('assignment.')) {
    return { href: '/app/assignments', label: 'Открыть поручения' };
  }
  if (kind === 'task') return { href: '/app/tasks', label: 'Открыть дела' };
  if (kind === 'event' || type.startsWith('event.')) {
    const date = new Date(asString(related.start_at));
    const dateKey = Number.isNaN(date.getTime()) ? null :
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return { href: dateKey ? buildTodayCalendarHref({ dateKey }) : '/app/today', label: dateKey ? 'Открыть день события' : 'Открыть расписание' };
  }
  if (type.startsWith('digest.')) return { href: '/app/today', label: 'Открыть сегодня' };
  return null;
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

export async function subscribeNotifications(
  context: Partial<ActiveFamilyContext>,
  onChange: () => void
): Promise<() => void> {
  const activeContext = requireActiveContext(context);
  const notifications = getPocketBaseClient().collection(COLLECTIONS.notifications);
  const subscribe = requireCollectionMethod(notifications, 'subscribe');

  return subscribe(
    '*',
    () => onChange(),
    {
      filter: [
        `family = "${escapeFilterValue(activeContext.familyId)}"`,
        `recipient_member = "${escapeFilterValue(activeContext.memberId)}"`
      ].join(' && '),
      ...memberRequestOptions(activeContext)
    }
  );
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
