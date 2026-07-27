-- Tarea 4/4 (observabilidad) — hasta ahora, si a un usuario real le salía un
-- error en producción, no había forma de enterarse salvo que escribiera. Esta
-- tabla guarda errores del cliente (JS no capturado, promesas rechazadas sin
-- catch, errores de render de React) para poder revisarlos después desde el
-- Table Editor de Supabase — sin necesitar una cuenta nueva en un servicio
-- externo tipo Sentry.

create table public.error_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  message text not null,
  stack text,
  source text, -- 'window-error' | 'unhandled-rejection' | 'react-boundary'
  url text,
  user_agent text,
  created_at timestamptz not null default now()
);

alter table public.error_logs enable row level security;

-- Cualquiera que esté logueado puede insertar un error propio — es lo único
-- que necesita esta tabla (nunca se lee desde el cliente). No hace falta
-- una política de "solo insertar los propios" tan estricta acá: reportar un
-- error no es información sensible en el mismo sentido que el contenido de
-- una nota, y sobre-restringir esto arriesga que un error real, silenciado
-- por una política de RLS mal armada, nunca llegue a guardarse.
create policy "authenticated users can insert error logs"
  on public.error_logs for insert
  to authenticated
  with check (true);

-- Nadie puede leer desde el cliente — esto se revisa a mano desde el Table
-- Editor de Supabase (o una consulta SQL directa), nunca desde la app.
-- No hace falta una política de select: sin una, RLS deniega todo por
-- defecto, que es exactamente el comportamiento buscado.
