-- Glenwyn — compartir páginas por link (solo lectura, sin necesidad de login)
-- Corré esto en el SQL Editor de Supabase después de las migraciones anteriores.

alter table public.pages
  add column if not exists share_token uuid;

-- Un token no puede repetirse entre páginas (ignorando los nulls, que son la mayoría).
create unique index if not exists pages_share_token_idx
  on public.pages (share_token)
  where share_token is not null;

-- IMPORTANTE: no agregamos una policy de RLS que permita "select a anon donde share_token
-- is not null", porque eso dejaría que cualquiera sin login liste TODAS las páginas
-- compartidas de TODOS los usuarios con un simple `select *` (RLS no valida que conozcas
-- el token exacto, solo que la columna no sea null). En cambio, exponemos una función seguridad-definer
-- que sí exige el token exacto como parámetro y devuelve una sola fila.

create or replace function public.get_shared_page(p_token uuid)
returns table (id uuid, title text, blocks jsonb, updated_at timestamptz)
language sql
security definer
set search_path = public
stable
as $$
  select id, title, blocks, updated_at
  from public.pages
  where share_token = p_token
    and is_archived = false
  limit 1;
$$;

-- Cualquiera (logueado o no) puede ejecutar la función — pero solo obtiene datos
-- si conoce el token exacto (es un uuid random, no adivinable).
grant execute on function public.get_shared_page(uuid) to anon, authenticated;
