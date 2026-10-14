-- FH-SQL-004 (espelho de banco.sql) - manter sincronizado com o livro banco.sql
-- Fonte autoritativa: banco.sql, secao FH-SQL-004

begin;

-- ---------------------------------------------------------------------
-- 1. Posts e midia
-- ---------------------------------------------------------------------
create table if not exists public.posts_fh (
  id          uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households_fh (id) on delete cascade,
  author_id   uuid references auth.users (id) on delete set null,
  title       text check (title is null or char_length(btrim(title)) between 1 and 120),
  body        text not null check (char_length(btrim(body)) between 1 and 10000),
  memory_date date not null default CURRENT_DATE,
  category_id uuid references public.categories_fh (id) on delete set null,
  tags        text[] not null default '{}',
  visibility  text not null default 'shared' check (visibility in ('shared', 'personal')),
  owner_id    uuid references auth.users (id) on delete set null,
  created_by  uuid,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists posts_fh_household_idx on public.posts_fh (household_id);
create index if not exists posts_fh_memory_idx on public.posts_fh (memory_date desc);
create index if not exists posts_fh_tags_idx on public.posts_fh using gin (tags);

create table if not exists public.post_media_fh (
  id           uuid primary key default gen_random_uuid(),
  post_id      uuid not null references public.posts_fh (id) on delete cascade,
  storage_path text not null,
  mime         text not null,
  size_bytes   integer not null check (size_bytes > 0),
  created_by   uuid,
  created_at   timestamptz not null default now()
);

create index if not exists post_media_fh_post_idx on public.post_media_fh (post_id);

-- ---------------------------------------------------------------------
-- 2. Espacos de fotos (5 por usuario)
-- ---------------------------------------------------------------------
create table if not exists public.user_photos_fh (
  user_id      uuid not null references auth.users (id) on delete cascade,
  slot         integer not null check (slot between 1 and 5),
  storage_path text not null,
  updated_at   timestamptz not null default now(),
  primary key (user_id, slot)
);

-- ---------------------------------------------------------------------
-- 3. Humores: catalogo + registros individuais
-- ---------------------------------------------------------------------
create table if not exists public.moods_fh (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid references public.households_fh (id) on delete cascade,
  name         text not null check (char_length(btrim(name)) between 1 and 40),
  emoji        text not null,
  color        text,
  created_by   uuid,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create unique index if not exists moods_fh_household_uniq
  on public.moods_fh (household_id, name) where household_id is not null;
create unique index if not exists moods_fh_global_uniq
  on public.moods_fh (name) where household_id is null;

create table if not exists public.user_moods_fh (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  household_id uuid not null references public.households_fh (id) on delete cascade,
  mood_id      uuid not null references public.moods_fh (id) on delete restrict,
  note         text check (note is null or char_length(note) <= 280),
  date         date not null default CURRENT_DATE,
  created_at   timestamptz not null default now()
);

create index if not exists user_moods_fh_user_idx
  on public.user_moods_fh (user_id, date desc);

-- ---------------------------------------------------------------------
-- 4. Dicas, anuncios (+leitura) e fofocas
-- ---------------------------------------------------------------------
create table if not exists public.tips_fh (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households_fh (id) on delete cascade,
  title        text not null check (char_length(btrim(title)) between 1 and 120),
  body         text not null check (char_length(btrim(body)) between 1 and 5000),
  category_id  uuid references public.categories_fh (id) on delete set null,
  visibility   text not null default 'shared' check (visibility in ('shared', 'personal')),
  owner_id     uuid references auth.users (id) on delete set null,
  created_by   uuid,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists tips_fh_household_idx on public.tips_fh (household_id);

create table if not exists public.announcements_fh (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households_fh (id) on delete cascade,
  title        text not null check (char_length(btrim(title)) between 1 and 120),
  body         text not null check (char_length(btrim(body)) between 1 and 5000),
  pinned       boolean not null default false,
  expires_at   timestamptz,
  created_by   uuid,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists announcements_fh_household_idx
  on public.announcements_fh (household_id);

create table if not exists public.announcement_reads_fh (
  announcement_id uuid not null references public.announcements_fh (id) on delete cascade,
  user_id         uuid not null references auth.users (id) on delete cascade,
  read_at         timestamptz not null default now(),
  primary key (announcement_id, user_id)
);

create table if not exists public.gossip_fh (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households_fh (id) on delete cascade,
  title        text check (title is null or char_length(btrim(title)) between 1 and 120),
  body         text not null check (char_length(btrim(body)) between 1 and 5000),
  owner_id     uuid references auth.users (id) on delete set null,
  created_by   uuid,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists gossip_fh_household_idx on public.gossip_fh (household_id);

-- ---------------------------------------------------------------------
-- 5. Bucket privado de midia
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('media_fh', 'media_fh', false)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- 6. Triggers de updated_at
-- ---------------------------------------------------------------------
drop trigger if exists t_posts_fh_updated on public.posts_fh;
create trigger t_posts_fh_updated
  before update on public.posts_fh
  for each row execute function public.set_updated_at_fh();

drop trigger if exists t_user_photos_fh_updated on public.user_photos_fh;
create trigger t_user_photos_fh_updated
  before update on public.user_photos_fh
  for each row execute function public.set_updated_at_fh();

drop trigger if exists t_moods_fh_updated on public.moods_fh;
create trigger t_moods_fh_updated
  before update on public.moods_fh
  for each row execute function public.set_updated_at_fh();

drop trigger if exists t_tips_fh_updated on public.tips_fh;
create trigger t_tips_fh_updated
  before update on public.tips_fh
  for each row execute function public.set_updated_at_fh();

drop trigger if exists t_announcements_fh_updated on public.announcements_fh;
create trigger t_announcements_fh_updated
  before update on public.announcements_fh
  for each row execute function public.set_updated_at_fh();

drop trigger if exists t_gossip_fh_updated on public.gossip_fh;
create trigger t_gossip_fh_updated
  before update on public.gossip_fh
  for each row execute function public.set_updated_at_fh();

-- ---------------------------------------------------------------------
-- 7. Row Level Security
-- ---------------------------------------------------------------------
alter table public.posts_fh enable row level security;
alter table public.post_media_fh enable row level security;
alter table public.user_photos_fh enable row level security;
alter table public.moods_fh enable row level security;
alter table public.user_moods_fh enable row level security;
alter table public.tips_fh enable row level security;
alter table public.announcements_fh enable row level security;
alter table public.announcement_reads_fh enable row level security;
alter table public.gossip_fh enable row level security;

drop policy if exists posts_fh_select on public.posts_fh;
create policy posts_fh_select on public.posts_fh
  for select to authenticated
  using (public.is_household_member_fh(household_id)
    and (visibility = 'shared' or owner_id = auth.uid() or created_by = auth.uid()));
drop policy if exists posts_fh_insert on public.posts_fh;
create policy posts_fh_insert on public.posts_fh
  for insert to authenticated
  with check (public.is_household_member_fh(household_id)
    and (visibility = 'shared' or owner_id = auth.uid()));
drop policy if exists posts_fh_update on public.posts_fh;
create policy posts_fh_update on public.posts_fh
  for update to authenticated
  using (created_by = auth.uid() or owner_id = auth.uid()
    or public.is_household_owner_fh(household_id))
  with check (public.is_household_member_fh(household_id)
    and (visibility = 'shared' or owner_id = auth.uid()));
drop policy if exists posts_fh_delete on public.posts_fh;
create policy posts_fh_delete on public.posts_fh
  for delete to authenticated
  using (created_by = auth.uid() or owner_id = auth.uid()
    or public.is_household_owner_fh(household_id));

drop policy if exists post_media_fh_select on public.post_media_fh;
create policy post_media_fh_select on public.post_media_fh
  for select to authenticated
  using (exists (select 1 from public.posts_fh p
    where p.id = post_id and public.is_household_member_fh(p.household_id)
    and (p.visibility = 'shared' or p.owner_id = auth.uid() or p.created_by = auth.uid())));
drop policy if exists post_media_fh_insert on public.post_media_fh;
create policy post_media_fh_insert on public.post_media_fh
  for insert to authenticated
  with check (exists (select 1 from public.posts_fh p
    where p.id = post_id and public.is_household_member_fh(p.household_id)));
drop policy if exists post_media_fh_update on public.post_media_fh;
create policy post_media_fh_update on public.post_media_fh
  for update to authenticated
  using (created_by = auth.uid()
    or exists (select 1 from public.posts_fh p
      where p.id = post_media_fh.post_id
        and public.is_household_owner_fh(p.household_id)))
  with check (exists (select 1 from public.posts_fh p
    where p.id = post_media_fh.post_id
      and public.is_household_member_fh(p.household_id)));
drop policy if exists post_media_fh_delete on public.post_media_fh;
create policy post_media_fh_delete on public.post_media_fh
  for delete to authenticated
  using (created_by = auth.uid()
    or exists (select 1 from public.posts_fh p
      where p.id = post_media_fh.post_id
        and public.is_household_owner_fh(p.household_id)));

-- Fotos: cada usuario gerencia os proprios 5 espacos; a casa visualiza.
drop policy if exists user_photos_fh_select on public.user_photos_fh;
create policy user_photos_fh_select on public.user_photos_fh
  for select to authenticated
  using (user_id = auth.uid()
    or exists (select 1 from public.profiles_fh me
      join public.profiles_fh other on other.household_id = me.household_id
      where me.id = auth.uid() and other.id = user_photos_fh.user_id
        and me.household_id is not null));
drop policy if exists user_photos_fh_insert on public.user_photos_fh;
create policy user_photos_fh_insert on public.user_photos_fh
  for insert to authenticated
  with check (user_id = auth.uid());
drop policy if exists user_photos_fh_update on public.user_photos_fh;
create policy user_photos_fh_update on public.user_photos_fh
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
drop policy if exists user_photos_fh_delete on public.user_photos_fh;
create policy user_photos_fh_delete on public.user_photos_fh
  for delete to authenticated
  using (user_id = auth.uid());

-- Catalogo de humores: leitura global + da casa; escrita da casa.
drop policy if exists moods_fh_select on public.moods_fh;
create policy moods_fh_select on public.moods_fh
  for select to authenticated
  using (household_id is null or public.is_household_member_fh(household_id));
drop policy if exists moods_fh_insert on public.moods_fh;
create policy moods_fh_insert on public.moods_fh
  for insert to authenticated
  with check (household_id is not null and public.is_household_member_fh(household_id));
drop policy if exists moods_fh_update on public.moods_fh;
create policy moods_fh_update on public.moods_fh
  for update to authenticated
  using (household_id is not null
    and (created_by = auth.uid() or public.is_household_owner_fh(household_id)))
  with check (household_id is not null
    and (created_by = auth.uid() or public.is_household_owner_fh(household_id)));
drop policy if exists moods_fh_delete on public.moods_fh;
create policy moods_fh_delete on public.moods_fh
  for delete to authenticated
  using (household_id is not null
    and (created_by = auth.uid() or public.is_household_owner_fh(household_id)));

-- Registros de humor: visiveis na casa; escrita do proprio usuario.
drop policy if exists user_moods_fh_select on public.user_moods_fh;
create policy user_moods_fh_select on public.user_moods_fh
  for select to authenticated
  using (public.is_household_member_fh(household_id));
drop policy if exists user_moods_fh_insert on public.user_moods_fh;
create policy user_moods_fh_insert on public.user_moods_fh
  for insert to authenticated
  with check (user_id = auth.uid() and public.is_household_member_fh(household_id));
drop policy if exists user_moods_fh_update on public.user_moods_fh;
create policy user_moods_fh_update on public.user_moods_fh
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.is_household_member_fh(household_id));
drop policy if exists user_moods_fh_delete on public.user_moods_fh;
create policy user_moods_fh_delete on public.user_moods_fh
  for delete to authenticated
  using (user_id = auth.uid());

drop policy if exists tips_fh_select on public.tips_fh;
create policy tips_fh_select on public.tips_fh
  for select to authenticated
  using (public.is_household_member_fh(household_id)
    and (visibility = 'shared' or owner_id = auth.uid() or created_by = auth.uid()));
drop policy if exists tips_fh_insert on public.tips_fh;
create policy tips_fh_insert on public.tips_fh
  for insert to authenticated
  with check (public.is_household_member_fh(household_id)
    and (visibility = 'shared' or owner_id = auth.uid()));
drop policy if exists tips_fh_update on public.tips_fh;
create policy tips_fh_update on public.tips_fh
  for update to authenticated
  using (created_by = auth.uid() or owner_id = auth.uid()
    or public.is_household_owner_fh(household_id))
  with check (public.is_household_member_fh(household_id)
    and (visibility = 'shared' or owner_id = auth.uid()));
drop policy if exists tips_fh_delete on public.tips_fh;
create policy tips_fh_delete on public.tips_fh
  for delete to authenticated
  using (created_by = auth.uid() or owner_id = auth.uid()
    or public.is_household_owner_fh(household_id));

drop policy if exists announcements_fh_select on public.announcements_fh;
create policy announcements_fh_select on public.announcements_fh
  for select to authenticated
  using (public.is_household_member_fh(household_id));
drop policy if exists announcements_fh_insert on public.announcements_fh;
create policy announcements_fh_insert on public.announcements_fh
  for insert to authenticated
  with check (public.is_household_member_fh(household_id));
drop policy if exists announcements_fh_update on public.announcements_fh;
create policy announcements_fh_update on public.announcements_fh
  for update to authenticated
  using (created_by = auth.uid() or public.is_household_owner_fh(household_id))
  with check (public.is_household_member_fh(household_id));
drop policy if exists announcements_fh_delete on public.announcements_fh;
create policy announcements_fh_delete on public.announcements_fh
  for delete to authenticated
  using (created_by = auth.uid() or public.is_household_owner_fh(household_id));

drop policy if exists announcement_reads_fh_select on public.announcement_reads_fh;
create policy announcement_reads_fh_select on public.announcement_reads_fh
  for select to authenticated
  using (user_id = auth.uid());
drop policy if exists announcement_reads_fh_insert on public.announcement_reads_fh;
create policy announcement_reads_fh_insert on public.announcement_reads_fh
  for insert to authenticated
  with check (user_id = auth.uid());
drop policy if exists announcement_reads_fh_delete on public.announcement_reads_fh;
create policy announcement_reads_fh_delete on public.announcement_reads_fh
  for delete to authenticated
  using (user_id = auth.uid());

drop policy if exists gossip_fh_select on public.gossip_fh;
create policy gossip_fh_select on public.gossip_fh
  for select to authenticated
  using (public.is_household_member_fh(household_id));
drop policy if exists gossip_fh_insert on public.gossip_fh;
create policy gossip_fh_insert on public.gossip_fh
  for insert to authenticated
  with check (public.is_household_member_fh(household_id));
drop policy if exists gossip_fh_update on public.gossip_fh;
create policy gossip_fh_update on public.gossip_fh
  for update to authenticated
  using (created_by = auth.uid() or owner_id = auth.uid()
    or public.is_household_owner_fh(household_id))
  with check (public.is_household_member_fh(household_id));
drop policy if exists gossip_fh_delete on public.gossip_fh;
create policy gossip_fh_delete on public.gossip_fh
  for delete to authenticated
  using (created_by = auth.uid() or owner_id = auth.uid()
    or public.is_household_owner_fh(household_id));

-- ---------------------------------------------------------------------
-- 8. Policies do Storage (bucket media_fh, por pasta da casa)
-- ---------------------------------------------------------------------
drop policy if exists "media_fh_read" on storage.objects;
create policy "media_fh_read" on storage.objects
  for select to authenticated
  using (bucket_id = 'media_fh'
    and public.is_household_member_fh(((storage.foldername(name))[2])::uuid));

drop policy if exists "media_fh_write" on storage.objects;
create policy "media_fh_write" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'media_fh'
    and public.is_household_member_fh(((storage.foldername(name))[2])::uuid));

drop policy if exists "media_fh_remove" on storage.objects;
create policy "media_fh_remove" on storage.objects
  for delete to authenticated
  using (bucket_id = 'media_fh'
    and public.is_household_member_fh(((storage.foldername(name))[2])::uuid));

commit