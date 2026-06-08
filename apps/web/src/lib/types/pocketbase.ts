import type { Item, ItemOccurrence, NotificationRecord } from './domain';

export type PocketBaseRecordBase = {
  id: string;
  collectionId: string;
  collectionName: string;
  created: string;
  updated: string;
};

export type PocketBaseItemRecord = PocketBaseRecordBase & {
  family: string;
  kind: Item['kind'];
  title: string;
  description?: string;
  created_by: string;
  owner?: string;
  assignees?: string[];
  participants?: string[];
  category: Item['category'];
  priority: Item['priority'];
  visibility: Item['visibility'];
  all_day: boolean;
  start_at?: string;
  end_at?: string;
  due_at?: string;
  timezone: string;
  recurrence_rule?: string;
  recurrence_until?: string;
  approval_required: boolean;
  checklist_json?: unknown;
  points?: number;
  location_text?: string;
  color_override?: string;
  archived: boolean;
};

export type PocketBaseOccurrenceRecord = PocketBaseRecordBase & {
  family: string;
  item: string;
  kind: ItemOccurrence['kind'];
  title_snapshot: string;
  category_snapshot: ItemOccurrence['categorySnapshot'];
  start_at?: string;
  end_at?: string;
  due_at?: string;
  all_day: boolean;
  status: ItemOccurrence['status'];
};

export type PocketBaseNotificationRecord = PocketBaseRecordBase & {
  family: string;
  recipient_member: string;
  recipient_user?: string;
  type: NotificationRecord['type'];
  title: string;
  body: string;
  item?: string;
  occurrence?: string;
  read_at?: string;
  delivered_at?: string;
};
