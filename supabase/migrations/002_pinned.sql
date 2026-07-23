-- Glenwyn — agrega favoritos/pins a las páginas
-- Corré esto en el SQL Editor de Supabase después de 001_init.sql

alter table public.pages
  add column if not exists pinned boolean not null default false;

create index if not exists pages_user_pinned_idx on public.pages (user_id, pinned);
