-- Paso 2 del plan de monetización — ver DISENO_MONETIZACION.md para el diseño completo.
-- Esta migración solo crea la infraestructura de "qué plan tiene cada usuario";
-- todavía no conecta Stripe ni bloquea ninguna feature (eso es a propósito, en
-- pasos separados — ver el documento).

create table public.profiles (
  user_id                 uuid primary key references auth.users(id) on delete cascade,
  plan                    text not null default 'free' check (plan in ('free', 'plus', 'business')),
  stripe_customer_id      text,
  stripe_subscription_id  text,
  current_period_end      timestamptz,
  created_at              timestamptz not null default now()
);

comment on table public.profiles is
  'Un registro por usuario con su plan actual. Es un espejo de lo que Stripe informa via webhook — nunca la fuente de verdad del dinero en sí.';

alter table public.profiles enable row level security;

-- Cada usuario puede ver y actualizar (parcialmente) su propio perfil — pero no
-- insertar ni borrar filas: esas dos acciones son responsabilidad exclusiva del
-- trigger de abajo y, a futuro, del código server-side que reacciona a Stripe.
create policy "profiles select own"
  on public.profiles for select
  using (auth.uid() = user_id);

create policy "profiles update own"
  on public.profiles for update
  using (auth.uid() = user_id);

-- Crea el perfil automáticamente apenas alguien se registra — sea cual sea el
-- método de login (email, Google, Facebook, Microsoft, teléfono), todos pasan
-- por esta misma tabla de auth.users, así que un solo trigger cubre todos los casos.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (user_id, plan)
  values (new.id, 'free')
  on conflict (user_id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- El trigger de arriba solo corre para usuarios NUEVOS a partir de ahora — así
-- que se hace un backfill único acá mismo para cualquier cuenta que ya existía
-- antes de correr esta migración (por ejemplo, la tuya).
insert into public.profiles (user_id, plan)
select id, 'free' from auth.users
on conflict (user_id) do nothing;
