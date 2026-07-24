-- Un flag de administrador separado del plan a propósito: "plan" es de qué
-- pagás (o no), "is_admin" es de quién sos (el dueño/operador de Glenwyn). Un
-- admin siempre tiene acceso a todo, sin importar qué plan tenga asignado —
-- así el día que se activen límites reales (Paso 4 del plan de monetización),
-- alcanza con revisar este único flag antes de aplicar cualquier restricción.

alter table public.profiles add column if not exists is_admin boolean not null default false;

comment on column public.profiles.is_admin is
  'Si es true, la cuenta salta todos los límites de plan — es sobre ser el dueño/operador de Glenwyn, no sobre qué suscripción tiene.';

-- Otorga admin (y el plan más alto, para que cualquier feature "solo Business"
-- también se vea habilitada) a la cuenta de Daniel específicamente.
update public.profiles
set is_admin = true, plan = 'business'
where user_id = (select id from auth.users where email = 'dseiler.dev@gmail.com');
