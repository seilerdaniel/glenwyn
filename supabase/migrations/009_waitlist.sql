-- Paso 3 del plan de monetización — validar la línea gratis/paga con gente real
-- antes de construir nada de Stripe. Esta tabla junta emails de interés desde
-- una página pública (/planes), sin requerir que nadie inicie sesión.

create table public.waitlist_signups (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  interested_plan text, -- 'free' | 'plus' | null si no lo especificó
  created_at  timestamptz not null default now()
);

comment on table public.waitlist_signups is
  'Emails de interés recolectados desde /planes, para validar precios antes de conectar Stripe (Paso 3 de DISENO_MONETIZACION.md). Solo vos podés leer esta tabla desde el dashboard de Supabase — el cliente público solo puede insertar, nunca leer.';

alter table public.waitlist_signups enable row level security;

-- Cualquiera puede anotarse (la página es pública, sin login) — pero nadie,
-- ni siquiera el que se anotó, puede leer la lista desde el cliente. Sin
-- política de select, la tabla queda invisible vía la API pública; solo se ve
-- desde el Table Editor de Supabase (que usa una llave con más privilegios).
create policy "anyone can join the waitlist"
  on public.waitlist_signups for insert
  with check (true);
