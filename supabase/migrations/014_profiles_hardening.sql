-- Hardening RLS de `profiles` (auditoría 2026-08-03).
--
-- La policy "profiles update own" de 007 permitía que cualquier usuario
-- autenticado actualizara CUALQUIER columna de su propio perfil, porque una
-- policy UPDATE sin `with check` usa la expresión `using` como check del
-- resultado nuevo. Combinado con la anon key pública, eso dejaba que alguien
-- se autoasignara `is_admin = true` o `plan = 'business'` con una llamada
-- directa a PostgREST, sin pasar por la UI.
--
-- Esta migración reemplaza esa policy por una que:
--   * sigue dejando al usuario actualizar su propia fila (using),
--   * pero impide modificar las columnas sensibles comparando el valor NUEVO
--     contra el valor actualmente guardado en la base (with check).
-- `is not distinct from` maneja los NULL (stripe_* casi siempre son NULL).
-- `plan`/`is_admin`/`current_period_end` quedan reservados al servidor
-- (trigger de signup + futuro webhook de Stripe), nunca al cliente.

drop policy if exists "profiles update own" on public.profiles;

create policy "profiles update own"
  on public.profiles for update
  to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and is_admin = (select p.is_admin from public.profiles p where p.user_id = auth.uid())
    and plan = (select p.plan from public.profiles p where p.user_id = auth.uid())
    and current_period_end is not distinct from (select p.current_period_end from public.profiles p where p.user_id = auth.uid())
    and stripe_customer_id is not distinct from (select p.stripe_customer_id from public.profiles p where p.user_id = auth.uid())
    and stripe_subscription_id is not distinct from (select p.stripe_subscription_id from public.profiles p where p.user_id = auth.uid())
  );
