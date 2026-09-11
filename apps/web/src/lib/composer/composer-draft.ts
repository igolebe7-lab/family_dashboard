import { z } from 'zod';
import type { ActiveFamilyContext } from '$lib/api/pocketbase';
import { ITEM_CATEGORIES } from '$lib/constants/categories';
import { COMPOSER_WEEKDAYS, type ComposerFormValues } from './composer-form';

const draftSchema = z.object({
  version: z.literal(1),
  values: z.object({
    kind: z.enum(['event', 'task']),
    activeMemberId: z.string(),
    familyMemberIds: z.array(z.string()),
    title: z.string(), description: z.string(),
    category: z.enum(ITEM_CATEGORIES),
    visibility: z.enum(['private', 'assignees', 'family', 'adults']),
    priority: z.enum(['low', 'normal', 'high', 'urgent']),
    date: z.string(), startTime: z.string(), endTime: z.string(), dueTime: z.string(),
    allDay: z.boolean(), owner: z.string(), assignee: z.string(), participants: z.array(z.string()),
    checklistText: z.string(), locationText: z.string(),
    reminder: z.enum(['none', 'at_time', 'before_15', 'before_60', 'before_day']),
    repeat: z.enum(['none', 'daily', 'weekdays', 'weekly', 'monthly']),
    repeatInterval: z.number().default(1),
    repeatDays: z.array(z.enum(COMPOSER_WEEKDAYS)).optional(),
    repeatUntil: z.string().default(''),
    approvalRequired: z.boolean(), points: z.string()
  })
});

type DraftStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function composerDraftKey(context: ActiveFamilyContext): string {
  return `familytime:composer:draft:v1:${encodeURIComponent(context.familyId)}:${encodeURIComponent(context.memberId)}`;
}

export function createComposerDraftStorage(getStorage: () => DraftStorage = () => sessionStorage) {
  return {
    restore(context: ActiveFamilyContext, defaults: ComposerFormValues): ComposerFormValues | null {
      try {
        const raw = getStorage().getItem(composerDraftKey(context));
        if (!raw) return null;
        const draft = draftSchema.safeParse(JSON.parse(raw));
        if (!draft.success || draft.data.values.activeMemberId !== context.memberId) return null;
        return { ...defaults, ...draft.data.values, activeMemberId: context.memberId, familyMemberIds: defaults.familyMemberIds };
      } catch {
        return null;
      }
    },
    save(context: ActiveFamilyContext, values: ComposerFormValues): boolean {
      try {
        getStorage().setItem(composerDraftKey(context), JSON.stringify({ version: 1, values }));
        return true;
      } catch {
        return false;
      }
    },
    remove(context: ActiveFamilyContext): boolean {
      try {
        getStorage().removeItem(composerDraftKey(context));
        return true;
      } catch {
        return false;
      }
    }
  };
}
