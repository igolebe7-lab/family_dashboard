import { z } from 'zod';
import { ITEM_CATEGORIES } from '$lib/constants/categories';
import { isValidIsoDate } from './date';

const visibilitySchema = z.enum(['private', 'assignees', 'family', 'adults']);
const prioritySchema = z.enum(['low', 'normal', 'high', 'urgent']);
const categorySchema = z.enum(ITEM_CATEGORIES);
const optionalIsoDateSchema = z.string().refine(isValidIsoDate).optional();
const isoDateSchema = z.string().refine(isValidIsoDate);
const titleSchema = z.string().trim().min(1);

export const eventFormSchema = z
  .object({
    title: titleSchema,
    category: categorySchema,
    participants: z.array(z.string()).default([]),
    startAt: isoDateSchema,
    endAt: isoDateSchema,
    allDay: z.boolean().default(false),
    visibility: visibilitySchema.default('family'),
    reminderAt: optionalIsoDateSchema,
    locationText: z.string().trim().optional(),
    description: z.string().trim().optional()
  })
  .superRefine((value, ctx) => {
    if (Date.parse(value.endAt) < Date.parse(value.startAt)) {
      ctx.addIssue({
        code: 'custom',
        message: 'Окончание не может быть раньше начала',
        path: ['endAt']
      });
    }
  });

export const taskFormSchema = z.object({
  title: titleSchema,
  owner: z.string().min(1),
  dueAt: optionalIsoDateSchema,
  priority: prioritySchema.default('normal'),
  category: categorySchema,
  checklist: z.array(z.object({ title: titleSchema, done: z.boolean().default(false) })).default([]),
  visibility: visibilitySchema.default('private'),
  reminderAt: optionalIsoDateSchema,
  description: z.string().trim().optional()
});

export const assignmentFormSchema = z
  .object({
    title: titleSchema,
    createdBy: z.string().min(1),
    assignees: z.array(z.string()).min(1),
    dueAt: optionalIsoDateSchema,
    approvalRequired: z.boolean().default(true),
    repeatRule: z.string().trim().optional(),
    points: z.number().int().nonnegative().optional(),
    category: categorySchema,
    description: z.string().trim().optional(),
    reminderAt: optionalIsoDateSchema
  })
  .superRefine((value, ctx) => {
    if (value.assignees.length === 1 && value.assignees[0] === value.createdBy) {
      ctx.addIssue({
        code: 'custom',
        message: 'Для задачи себе используйте тип «Дело»',
        path: ['assignees']
      });
    }
  });

export type EventFormInput = z.infer<typeof eventFormSchema>;
export type TaskFormInput = z.infer<typeof taskFormSchema>;
export type AssignmentFormInput = z.infer<typeof assignmentFormSchema>;
