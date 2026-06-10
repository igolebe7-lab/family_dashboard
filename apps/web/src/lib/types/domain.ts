import type { ItemCategory } from '$lib/constants/categories';
import type { AccentColor } from '$lib/constants/colors';
import type { MemberRole } from '$lib/constants/roles';

export type ItemKind = 'event' | 'task' | 'assignment' | 'routine';
export type ItemPriority = 'low' | 'normal' | 'high' | 'urgent';
export type ItemVisibility = 'private' | 'assignees' | 'family' | 'adults';
export type DayAnnotationKind = 'birthday' | 'public_holiday' | 'family_date' | 'observance' | 'memorial';
export type DayAnnotationRecurrence = 'one_time' | 'yearly';
export type DayAnnotationTone = 'positive' | 'neutral' | 'important' | 'memorial' | 'system';
export type DayAnnotationSource = 'manual' | 'family_member' | 'nager_date';

export type AssignmentStatus =
  | 'assigned'
  | 'accepted'
  | 'in_progress'
  | 'done'
  | 'approved'
  | 'rejected'
  | 'skipped'
  | 'overdue'
  | 'cancelled';

export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'cancelled';
export type OccurrenceStatus = AssignmentStatus | TaskStatus;

export type ActivityAction =
  | 'item.created'
  | 'item.updated'
  | 'item.deleted'
  | 'occurrence.created'
  | 'occurrence.rescheduled'
  | 'assignment.assigned'
  | 'assignment.accepted'
  | 'assignment.done'
  | 'assignment.approved'
  | 'assignment.rejected'
  | 'assignment.skipped'
  | 'comment.created'
  | 'member.created'
  | 'member.updated';

export type NotificationType =
  | 'assignment.created'
  | 'assignment.due_soon'
  | 'assignment.done_waiting_approval'
  | 'assignment.approved'
  | 'assignment.rejected'
  | 'event.reminder'
  | 'event.changed'
  | 'comment.created'
  | 'digest.morning'
  | 'digest.evening';

export type Family = {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  ownerUser: string;
};

export type FamilyMember = {
  id: string;
  family: string;
  user?: string;
  displayName: string;
  role: MemberRole;
  colorKey?: string;
  colorHex?: string;
  birthday?: string;
  managedBy: string[];
  active: boolean;
};

export type Item = {
  id: string;
  family: string;
  kind: ItemKind;
  title: string;
  description?: string;
  createdBy: string;
  owner?: string;
  assignees: string[];
  participants: string[];
  visibleTo: string[];
  category: ItemCategory;
  priority: ItemPriority;
  visibility: ItemVisibility;
  allDay: boolean;
  startAt?: string;
  endAt?: string;
  dueAt?: string;
  timezone: string;
  recurrenceRule?: string;
  recurrenceUntil?: string;
  approvalRequired: boolean;
  checklist?: ChecklistItem[];
  points?: number;
  locationText?: string;
  colorOverride?: string;
  archived: boolean;
};

export type ChecklistItem = {
  id: string;
  title: string;
  done: boolean;
};

export type ItemOccurrence = {
  id: string;
  family: string;
  item: string;
  visibleTo: string[];
  kind: ItemKind;
  titleSnapshot: string;
  categorySnapshot: ItemCategory;
  startAt?: string;
  endAt?: string;
  dueAt?: string;
  allDay: boolean;
  status: OccurrenceStatus;
  completedBy?: string;
  completedAt?: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  rejectionReason?: string;
};

export type DayAnnotation = {
  id: string;
  family: string;
  kind: DayAnnotationKind;
  title: string;
  description?: string;
  month: number;
  day: number;
  year?: number;
  recurrence: DayAnnotationRecurrence;
  color: AccentColor;
  tone: DayAnnotationTone;
  visibility: ItemVisibility;
  source: DayAnnotationSource;
  readonly: boolean;
  linkedMember?: string;
  personName?: string;
  personRelation?: string;
  personContact?: string;
  countryCode?: string;
  regionCode?: string;
  sourceUid?: string;
  sourceHash?: string;
  fetchedAt?: string;
  createdBy?: string;
  created?: string;
  updated?: string;
};

export type ActivityRecord = {
  id: string;
  family: string;
  item?: string;
  occurrence?: string;
  actor: string;
  action: ActivityAction;
  summary: string;
  created: string;
};

export type NotificationRecord = {
  id: string;
  family: string;
  recipientMember: string;
  recipientUser?: string;
  type: NotificationType;
  title: string;
  body: string;
  item?: string;
  occurrence?: string;
  readAt?: string;
  deliveredAt?: string;
  created: string;
};
