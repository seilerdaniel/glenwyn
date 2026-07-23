-- Glenwyn — historial de versiones
-- Corré esto en el SQL Editor de Supabase después de 001_init.sql y 002_pinned.sql

create table if not exists public.page_versions (
  id         uuid primary key default gen_random_uuid(),
  page_id    uuid not null references public.pages(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  title      text not null default '',
  blocks     jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists page_versions_page_id_idx on public.page_versions (page_id, created_at desc);
create index if not exists page_versions_user_id_idx on public.page_versions (user_id);

alter table public.page_versions enable row level security;

drop policy if exists "Users can view their own page versions" on public.page_versions;
create policy "Users can view their own page versions"
  on public.page_versions for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own page versions" on public.page_versions;
create policy "Users can insert their own page versions"
  on public.page_versions for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own page versions" on public.page_versions;
create policy "Users can delete their own page versions"
  on public.page_versions for delete
  to authenticated
  using (auth.uid() = user_id);

-- Nunca dejamos que una sola página acumule más de 20 versiones —
-- se borran solas las más viejas cuando se inserta una nueva.
create or replace function public.trim_page_versions()
returns trigger as $$
begin
  delete from public.page_versions
  where page_id = new.page_id
    and id not in (
      select id from public.page_versions
      where page_id = new.page_id
      order by created_at desc
      limit 20
    );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trim_page_versions_trigger on public.page_versions;
create trigger trim_page_versions_trigger
  after insert on public.page_versions
  for each row execute function public.trim_page_versions();
