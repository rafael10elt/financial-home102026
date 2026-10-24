import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'

export const visibilitySchema = z.enum(['shared', 'personal'])
export const prioritySchema = z.enum(['low', 'medium', 'high', 'urgent'])
export const taskStatusSchema = z.enum(['open', 'done', 'cancelled'])
export const frequencySchema = z.enum(['daily', 'weekly', 'monthly', 'yearly'])
export const exceptionActionSchema = z.enum(['skipped', 'postponed'])

const titleSchema = z.string().trim().min(1).max(120)
const isoDateTimeSchema = z.string().datetime({ offset: true })
const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD')

export const recurrenceRuleInputSchema = z
  .object({
    frequency: frequencySchema,
    interval_n: z.number().int().min(1).max(365).default(1),
    days_of_week: z.array(z.number().int().min(0).max(6)).max(7).nullable().default(null),
    month_day: z.number().int().min(1).max(31).nullable().default(null),
    start_date: isoDateSchema,
    end_date: isoDateSchema.nullable().default(null),
    occurrence_count: z.number().int().positive().nullable().default(null),
    timezone: z.string().min(1).max(64).default('Europe/Dublin'),
  })
  .refine((rule) => rule.end_date === null || rule.end_date >= rule.start_date, {
    message: 'A data final deve ser posterior à inicial.',
    path: ['end_date'],
  })

export type RecurrenceRuleInput = z.infer<typeof recurrenceRuleInputSchema>

const baseItemSchema = z.object({
  title: titleSchema,
  category_id: z.string().uuid().nullable().default(null),
  visibility: visibilitySchema.default('shared'),
  owner_id: z.string().uuid().nullable().default(null),
})

export const eventInputSchema = baseItemSchema
  .extend({
    description: z.string().trim().max(2000).nullable().default(null),
    location: z.string().trim().max(200).nullable().default(null),
    start_at: isoDateTimeSchema,
    end_at: isoDateTimeSchema.nullable().default(null),
    all_day: z.boolean().default(false),
  })
  .refine((event) => event.end_at === null || event.end_at >= event.start_at, {
    message: 'O término deve ser posterior ao início.',
    path: ['end_at'],
  })

export type EventInput = z.infer<typeof eventInputSchema>

export const taskInputSchema = baseItemSchema.extend({
  notes: z.string().trim().max(2000).nullable().default(null),
  due_at: isoDateTimeSchema.nullable().default(null),
  priority: prioritySchema.default('medium'),
})

export type TaskInput = z.infer<typeof taskInputSchema>

export const reminderInputSchema = baseItemSchema.extend({
  notes: z.string().trim().max(2000).nullable().default(null),
  remind_at: isoDateTimeSchema,
})

export type ReminderInput = z.infer<typeof reminderInputSchema>

export const categoryInputSchema = z.object({
  domain: z.enum(['agenda', 'finance', 'diary', 'board']).default('agenda'),
  name: z.string().trim().min(1).max(40),
  kind: z.string().trim().max(40).nullable().default(null),
  color: z.string().trim().max(16).nullable().default(null),
  icon: z.string().trim().max(40).nullable().default(null),
})

export type CategoryInput = z.input<typeof categoryInputSchema>

export type AgendaError = { error: string | null }

function mapError(message: string): string {
  if (/row-level security/i.test(message)) return 'Sem permissão para esta operação.'
  if (/duplicate key|unique constraint/i.test(message)) return 'Já existe um registro equivalente.'
  if (/violates (check|foreign key|not-null)/i.test(message)) return 'Dados inválidos para o banco.'
  return message
}

export async function zodInsert<T extends Record<string, unknown>>(
  supabase: SupabaseClient,
  table: string,
  householdId: string,
  userId: string,
  payload: T,
): Promise<AgendaError> {
  const { error } = await supabase
    .from(table)
    .insert({ ...payload, household_id: householdId, created_by: userId })
  return { error: error ? mapError(error.message) : null }
}

export async function zodUpdate(
  supabase: SupabaseClient,
  table: string,
  id: string,
  payload: Record<string, unknown>,
): Promise<AgendaError> {
  const { data, error } = await supabase.from(table).update(payload).eq('id', id).select('id').maybeSingle()
  if (error) return { error: mapError(error.message) }
  if (!data) return { error: 'Nenhum registro foi atualizado. Ele pode não existir mais ou você não ter permissão para editá-lo.' }
  return { error: null }
}

export async function zodRemove(
  supabase: SupabaseClient,
  table: string,
  id: string,
): Promise<AgendaError> {
  const { error } = await supabase.from(table).delete().eq('id', id)
  return { error: error ? mapError(error.message) : null }
}

export function validate<T>(schema: z.ZodType<T>, raw: unknown): { data: T; error: null } | { data: null; error: string } {
  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return { data: null, error: first ? `${first.path.join('.')}: ${first.message}` : 'Dados inválidos.' }
  }
  return { data: parsed.data, error: null }
}
