import { useCallback, useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { useAuth } from '../auth/context'
import { useHousehold } from '../household/context'
import {
  categoryInputSchema,
  eventInputSchema,
  recurrenceRuleInputSchema,
  reminderInputSchema,
  taskInputSchema,
  validate,
  zodInsert,
  zodRemove,
  zodUpdate,
  type CategoryInput,
  type EventInput,
  type RecurrenceRuleInput,
  type ReminderInput,
  type TaskInput,
} from '../data/agenda'
import { expandRecurrence, type RecurrenceException } from './recurrence'
import { buildDueNotifications, type DueItem } from './dueNotifications'

export type Category = {
  id: string
  household_id: string | null
  domain: string
  name: string
  color: string | null
  icon: string | null
}

export type AgendaEvent = {
  id: string
  household_id: string
  title: string
  description: string | null
  location: string | null
  start_at: string
  end_at: string | null
  all_day: boolean
  category_id: string | null
  visibility: 'shared' | 'personal'
  owner_id: string | null
  created_by: string | null
  recurrence_rule_id: string | null
  updated_at: string | null
}

export type AgendaTask = {
  id: string
  household_id: string
  title: string
  notes: string | null
  due_at: string | null
  priority: 'low' | 'medium' | 'high' | 'urgent'
  status: 'open' | 'in_progress' | 'done' | 'cancelled'
  completed_at: string | null
  category_id: string | null
  visibility: 'shared' | 'personal'
  owner_id: string | null
  created_by: string | null
  recurrence_rule_id: string | null
  updated_at: string | null
}

export type AgendaReminder = {
  id: string
  household_id: string
  title: string
  remind_at: string
  notes: string | null
  category_id: string | null
  visibility: 'shared' | 'personal'
  owner_id: string | null
  created_by: string | null
  recurrence_rule_id: string | null
  dismissed_at: string | null
}

export type AgendaNotification = {
  id: string
  type: string
  title: string
  body: string | null
  ref_type: string | null
  ref_id: string | null
  read_at: string | null
  created_at: string
}

export type RecurrenceRuleRow = {
  id: string
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly'
  interval_n: number
  days_of_week: number[] | null
  month_day: number | null
  start_date: string
  end_date: string | null
  occurrence_count: number | null
  timezone: string
}

type LoadState = 'idle' | 'loading' | 'ready' | 'error'

const DEFAULT_CATEGORIES: CategoryInput[] = [
  { domain: 'agenda', name: 'casa', color: '#1d4ed8', icon: 'home' },
  { domain: 'agenda', name: 'pessoal', color: '#7c3aed', icon: 'user' },
  { domain: 'agenda', name: 'finanças', color: '#047857', icon: 'wallet' },
  { domain: 'agenda', name: 'compartilhado', color: '#b45309', icon: 'users' },
]

async function ensureDefaultCategories(
  supabase: SupabaseClient,
  householdId: string,
  userId: string,
): Promise<void> {
  // Idempotente: a unicidade (household_id, domain, name) impede duplicatas.
  for (const category of DEFAULT_CATEGORIES) {
    await supabase.from('categories_fh').upsert(
      { ...category, household_id: householdId, created_by: userId },
      { onConflict: 'household_id,domain,name', ignoreDuplicates: true },
    )
  }
}

export function useAgendaData() {
  const { supabase, user } = useAuth()
  const { state: householdState } = useHousehold()

  const householdId =
    householdState.kind === 'ready' ? householdState.household.id : null

  const [status, setStatus] = useState<LoadState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [events, setEvents] = useState<AgendaEvent[]>([])
  const [tasks, setTasks] = useState<AgendaTask[]>([])
  const [reminders, setReminders] = useState<AgendaReminder[]>([])
  const [notifications, setNotifications] = useState<AgendaNotification[]>([])
  const [rules, setRules] = useState<RecurrenceRuleRow[]>([])
  const [exceptions, setExceptions] = useState<(RecurrenceException & { rule_id: string })[]>([])
  const [reloadToken, setReloadToken] = useState(0)

  const reload = useCallback(() => setReloadToken((token) => token + 1), [])

  useEffect(() => {
    let cancelled = false
    // Todo setState é deferido para fora do corpo síncrono do efeito.
    queueMicrotask(() => {
      if (cancelled) return
      if (!supabase || !user || !householdId) {
        setStatus('idle')
        return
      }
      setStatus('loading')
      setError(null)
      void loadAll(supabase, user.id, householdId)
    })

    async function loadAll(
      client: NonNullable<typeof supabase>,
      userId: string,
      household: string,
    ) {
      try {
        await ensureDefaultCategories(client, household, userId)

        const [cats, evts, tsks, rms, notifs, rls, excs] = await Promise.all([
          client
            .from('categories_fh')
            .select('id,household_id,domain,name,color,icon')
            .eq('domain', 'agenda')
            .or(`household_id.is.null,household_id.eq.${household}`)
            .order('name'),
          client
            .from('events_fh')
            .select('*')
            .eq('household_id', household)
            .order('start_at', { ascending: true })
            .limit(500),
          client
            .from('tasks_fh')
            .select('*')
            .eq('household_id', household)
            .order('due_at', { ascending: true, nullsFirst: false })
            .limit(500),
          client
            .from('reminders_fh')
            .select('*')
            .eq('household_id', household)
            .order('remind_at', { ascending: true })
            .limit(500),
          client
            .from('notifications_fh')
            .select('id,type,title,body,ref_type,ref_id,read_at,created_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(100),
          client
            .from('recurrence_rules_fh')
            .select(
              'id,frequency,interval_n,days_of_week,month_day,start_date,end_date,occurrence_count,timezone',
            )
            .eq('household_id', household)
            .limit(200),
          client
            .from('recurrence_exceptions_fh')
            .select('rule_id,original_date,action,new_start_at')
            .limit(1000),
        ])

        if (cancelled) return
        const firstError =
          cats.error ??
          evts.error ??
          tsks.error ??
          rms.error ??
          notifs.error ??
          rls.error ??
          excs.error
        if (firstError) {
          setError(firstError.message)
          setStatus('error')
          return
        }
        setCategories((cats.data ?? []) as Category[])
        setEvents((evts.data ?? []) as AgendaEvent[])
        setTasks((tsks.data ?? []) as AgendaTask[])
        setReminders((rms.data ?? []) as AgendaReminder[])
        setNotifications((notifs.data ?? []) as AgendaNotification[])
        setRules((rls.data ?? []) as RecurrenceRuleRow[])
        setExceptions(
          ((excs.data ?? []) as { rule_id: string; original_date: string; action: 'skipped' | 'postponed'; new_start_at: string | null }[]).map(
            (row) => ({
              original_date: row.original_date,
              action: row.action,
              new_start_at: row.new_start_at,
              rule_id: row.rule_id,
            }),
          ),
        )
        setStatus('ready')
      } catch (unknownError) {
        if (!cancelled) {
          setError(unknownError instanceof Error ? unknownError.message : String(unknownError))
          setStatus('error')
        }
      }
    }

    return () => {
      cancelled = true
    }
  }, [supabase, user, householdId, reloadToken])

  async function createRule(
    supabaseClient: SupabaseClient,
    household: string,
    userId: string,
    input: RecurrenceRuleInput,
  ): Promise<{ ruleId: string | null; error: string | null }> {
    const validated = validate(recurrenceRuleInputSchema, input)
    if (validated.error) return { ruleId: null, error: validated.error }
    const { data, error: insertError } = await supabaseClient
      .from('recurrence_rules_fh')
      .insert({ ...validated.data, household_id: household, created_by: userId })
      .select('id')
      .single()
    if (insertError) return { ruleId: null, error: insertError.message }
    return { ruleId: (data as { id: string }).id, error: null }
  }

  async function saveItem(
    table: 'events_fh' | 'tasks_fh' | 'reminders_fh',
    schema: typeof eventInputSchema | typeof taskInputSchema | typeof reminderInputSchema,
    raw: unknown,
    rule: RecurrenceRuleInput | null,
    editingId: string | null,
  ): Promise<{ error: string | null }> {
    if (!supabase || !user || !householdId) return { error: 'Supabase não configurado.' }
    const validated = validate(
      schema as typeof eventInputSchema,
      raw,
    ) as { data: EventInput | TaskInput | ReminderInput | null; error: string | null }
    if (validated.error || !validated.data) return { error: validated.error ?? 'Dados inválidos.' }

    let recurrenceId: string | null = null
    if (rule) {
      const created = await createRule(supabase, householdId, user.id, rule)
      if (created.error || !created.ruleId) return { error: created.error ?? 'Falha na recorrência.' }
      recurrenceId = created.ruleId
    }

    const payload = { ...validated.data, recurrence_rule_id: recurrenceId }
    const result = editingId
      ? await zodUpdate(supabase, table, editingId, payload)
      : await zodInsert(supabase, table, householdId, user.id, payload)
    if (!result.error) reload()
    return result
  }

  async function removeItem(
    table: 'events_fh' | 'tasks_fh' | 'reminders_fh',
    id: string,
  ): Promise<{ error: string | null }> {
    if (!supabase) return { error: 'Supabase não configurado.' }
    const result = await zodRemove(supabase, table, id)
    if (!result.error) reload()
    return result
  }

  async function skipOccurrence(ruleId: string, date: string): Promise<{ error: string | null }> {
    if (!supabase || !user) return { error: 'Supabase não configurado.' }
    const { error } = await supabase.from('recurrence_exceptions_fh').upsert(
      { rule_id: ruleId, original_date: date, action: 'skipped', created_by: user.id },
      { onConflict: 'rule_id,original_date', ignoreDuplicates: false },
    )
    if (!error) reload()
    return { error: error ? error.message : null }
  }

  async function postponeOccurrence(
    ruleId: string,
    date: string,
    newStartAt: string,
  ): Promise<{ error: string | null }> {
    if (!supabase || !user) return { error: 'Supabase não configurado.' }
    const { error } = await supabase.from('recurrence_exceptions_fh').upsert(
      {
        rule_id: ruleId,
        original_date: date,
        action: 'postponed',
        new_start_at: newStartAt,
        created_by: user.id,
      },
      { onConflict: 'rule_id,original_date', ignoreDuplicates: false },
    )
    if (!error) reload()
    return { error: error ? error.message : null }
  }

  async function markNotificationsRead(ids: string[] | 'all'): Promise<void> {
    if (!supabase || !user) return
    const now = new Date().toISOString()
    if (ids === 'all') {
      await supabase
        .from('notifications_fh')
        .update({ read_at: now })
        .eq('user_id', user.id)
        .is('read_at', null)
    } else if (ids.length > 0) {
      await supabase
        .from('notifications_fh')
        .update({ read_at: now })
        .eq('user_id', user.id)
        .in('id', ids)
    }
    reload()
  }

  async function generateDueNotifications(leadHours: number): Promise<{ error: string | null }> {
    if (!supabase || !user || !householdId) return { error: 'Supabase não configurado.' }
    const now = Date.now()
    const items: DueItem[] = [
      ...tasks
        .filter((task) => task.status === 'open' || task.status === 'in_progress')
        .map((task) => ({
          kind: 'task' as const,
          id: task.id,
          title: task.title,
          dueAt: task.due_at,
          done: false,
        })),
      ...reminders
        .filter((reminder) => !reminder.dismissed_at)
        .map((reminder) => ({
          kind: 'reminder' as const,
          id: reminder.id,
          title: reminder.title,
          dueAt: reminder.remind_at,
          done: false,
        })),
      ...events.map((event) => ({
        kind: 'event' as const,
        id: event.id,
        title: event.title,
        dueAt: event.start_at,
        done: false,
      })),
    ]
    const drafts = buildDueNotifications(items, now, leadHours)
    if (drafts.length === 0) return { error: null }
    const { error } = await supabase.from('notifications_fh').upsert(
      drafts.map((draft) => ({
        household_id: householdId,
        user_id: user.id,
        type: draft.type,
        title: draft.title,
        body: draft.body,
        ref_type: draft.ref_type,
        ref_id: draft.ref_id,
        dedupe_key: draft.dedupe_key,
      })),
      { onConflict: 'user_id,dedupe_key', ignoreDuplicates: true },
    )
    if (!error) reload()
    return { error: error ? error.message : null }
  }

  async function createCategory(input: CategoryInput): Promise<{ error: string | null }> {
    if (!supabase || !user || !householdId) return { error: 'Supabase não configurado.' }
    const validated = validate(categoryInputSchema, input)
    if (validated.error || !validated.data) return { error: validated.error ?? 'Dados inválidos.' }
    const result = await zodInsert(supabase, 'categories_fh', householdId, user.id, validated.data)
    if (!result.error) reload()
    return result
  }

  async function setTaskStatus(
    id: string,
    status: 'open' | 'in_progress' | 'done' | 'cancelled',
  ): Promise<{ error: string | null }> {
    if (!supabase) return { error: 'Supabase não configurado.' }
    const { error } = await supabase.rpc('set_task_status_fh', { p_task_id: id, p_status: status })
    if (!error) reload()
    return { error: error?.message ?? null }
  }

  async function dismissReminder(id: string): Promise<{ error: string | null }> {
    if (!supabase) return { error: 'Supabase não configurado.' }
    const result = await zodUpdate(supabase, 'reminders_fh', id, {
      dismissed_at: new Date().toISOString(),
    })
    if (!result.error) reload()
    return result
  }

  return {
    status,
    error,
    categories,
    events,
    tasks,
    reminders,
    notifications,
    rules,
    exceptions,
    householdId,
    reload,
    saveItem,
    removeItem,
    skipOccurrence,
    postponeOccurrence,
    markNotificationsRead,
    generateDueNotifications,
    createCategory,
    setTaskStatus,
    dismissReminder,
  }
}

export function upcomingOccurrences(
  items: { recurrence_rule_id: string | null; start_at?: string; due_at?: string | null; remind_at?: string }[],
  rules: Map<string, { frequency: 'daily' | 'weekly' | 'monthly' | 'yearly'; interval_n: number; days_of_week: number[] | null; month_day: number | null; start_date: string; end_date: string | null; occurrence_count: number | null; timezone: string }>,
  exceptions: Map<string, RecurrenceException[]>,
  from: string,
  to: string,
): Map<string, { date: string; postponedTo: string | null }[]> {
  const result = new Map<string, { date: string; postponedTo: string | null }[]>()
  items.forEach((item, index) => {
    if (!item.recurrence_rule_id) return
    const rule = rules.get(item.recurrence_rule_id)
    if (!rule) return
    const key = `${index}`
    result.set(
      key,
      expandRecurrence(rule, exceptions.get(item.recurrence_rule_id) ?? [], from, to),
    )
  })
  return result
}
