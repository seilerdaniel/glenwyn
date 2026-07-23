-- Glenwyn — esquema inicial
-- Corré esto en el SQL Editor de tu proyecto de Supabase (una sola vez).

create extension if not exists "pgcrypto";

create table if not exists public.pages (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text not null default '',
  icon        text,
  parent_id   uuid references public.pages(id) on delete set null,
  "order"     integer not null default 0,
  blocks      jsonb not null default '[]'::jsonb,
  is_archived boolean not null default false,
  archived_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists pages_user_id_idx on public.pages (user_id);
create index if not exists pages_parent_id_idx on public.pages (parent_id);
create index if not exists pages_user_archived_idx on public.pages (user_id, is_archived);

-- updated_at se mantiene solo, sin depender de que el cliente lo mande
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists pages_set_updated_at on public.pages;
create trigger pages_set_updated_at
  before update on public.pages
  for each row execute function public.set_updated_at();

-- Row Level Security: cada usuario solo ve y toca sus propias páginas
alter table public.pages enable row level security;

drop policy if exists "Users can view their own pages" on public.pages;
create policy "Users can view their own pages"
  on public.pages for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own pages" on public.pages;
create policy "Users can insert their own pages"
  on public.pages for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own pages" on public.pages;
create policy "Users can update their own pages"
  on public.pages for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own pages" on public.pages;
create policy "Users can delete their own pages"
  on public.pages for delete
  to authenticated
  using (auth.uid() = user_id);
