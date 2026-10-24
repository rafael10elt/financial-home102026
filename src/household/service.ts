import type { SupabaseClient } from '@supabase/supabase-js'

export type Household = {
  id: string
  name: string
  join_code: string | null
  created_by: string | null
  created_at: string
}

export type HouseholdMember = {
  user_id: string
  role: 'owner' | 'member'
  joined_at: string
  display_name: string | null
}

export type HouseholdState =
  | { kind: 'none' }
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; household: Household; members: HouseholdMember[]; joinCodeVisible: boolean }

function mapError(message: string): string {
  if (/duplicate key/i.test(message)) return 'Já existe um registro equivalente.'
  if (/row-level security/i.test(message)) return 'Sem permissão para esta operação.'
  if (/join_household_by_code_fh|could not find function/i.test(message)) {
    return 'Código de convite inválido ou função de entrada ausente no banco.'
  }
  return message
}

export async function fetchHousehold(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ data: Household | null; error: string | null }> {
  const { data, error } = await supabase
    .from('households_fh')
    .select('id, name, join_code, created_by, created_at')
    .eq('created_by', userId)
    .maybeSingle()

  if (error) {
    const { data: byMember, error: memberError } = await supabase
      .from('household_members_fh')
      .select('households_fh!inner(id, name, join_code, created_by, created_at)')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle()
    if (memberError) return { data: null, error: mapError(memberError.message) }
    const row = (byMember as { households_fh: Household } | null)?.households_fh ?? null
    return { data: row, error: null }
  }

  if (data) return { data, error: null }

  const { data: byMember, error: memberError } = await supabase
    .from('household_members_fh')
    .select('households_fh!inner(id, name, join_code, created_by, created_at)')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle()

  if (memberError) return { data: null, error: mapError(memberError.message) }
  const row = (byMember as { households_fh: Household } | null)?.households_fh ?? null
  return { data: row, error: null }
}

export async function fetchMembers(
  supabase: SupabaseClient,
  householdId: string,
): Promise<{ data: HouseholdMember[]; error: string | null }> {
  const { data, error } = await supabase
    .from('household_members_fh')
    .select('user_id, role, joined_at, profiles_fh!inner(display_name)')
    .eq('household_id', householdId)
    .order('joined_at', { ascending: true })

  if (error) return { data: [], error: mapError(error.message) }

  const members = ((data ?? []) as unknown[]).map((raw) => {
    const row = raw as {
      user_id: string
      role: 'owner' | 'member'
      joined_at: string
      profiles_fh: { display_name: string | null } | { display_name: string | null }[] | null
    }
    const profile = Array.isArray(row.profiles_fh) ? row.profiles_fh[0] : row.profiles_fh
    return {
      user_id: row.user_id,
      role: row.role,
      joined_at: row.joined_at,
      display_name: profile?.display_name ?? null,
    }
  })

  return { data: members, error: null }
}

export async function createHousehold(
  supabase: SupabaseClient,
  name: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('create_household_fh', { p_name: name })
  return { error: error ? mapError(error.message) : null }
}

export async function joinHousehold(
  supabase: SupabaseClient,
  code: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('join_household_by_code_fh', { p_code: code })
  return { error: error ? mapError(error.message) : null }
}
