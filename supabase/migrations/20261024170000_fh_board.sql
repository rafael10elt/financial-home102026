-- FH-SQL-013: enable the in-progress task state used by the household board.
begin;

alter table public.tasks_fh
  drop constraint if exists tasks_fh_status_check;

alter table public.tasks_fh
  add constraint tasks_fh_status_check
  check (status in ('open', 'in_progress', 'done', 'cancelled'));

create or replace function public.set_task_status_fh(p_task_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := public.current_profile_id_fh();
begin
  if p_status not in ('open', 'in_progress', 'done', 'cancelled') then
    raise exception 'Invalid task status';
  end if;

  update public.tasks_fh task
     set status = p_status,
         completed_at = case when p_status = 'done' then now() else null end
   where task.id = p_task_id
     and public.is_household_member_fh(task.household_id)
     and (task.visibility = 'shared'
       or task.owner_id = actor_id
       or task.created_by = actor_id
       or public.is_household_owner_fh(task.household_id));

  if not found then
    raise exception 'Task not found or access denied';
  end if;
end;
$$;

revoke all on function public.set_task_status_fh(uuid, text) from public;
grant execute on function public.set_task_status_fh(uuid, text) to anon, authenticated;

commit;
