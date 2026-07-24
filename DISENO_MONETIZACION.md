# Glenwyn — Diseño técnico: planes y monetización (freemium)

Documento de diseño, sin código todavía. Explica el mecanismo completo para bloquear/desbloquear features según el plan pago de cada usuario — Free / Plus / Business (o los nombres que se terminen eligiendo).

Ver `ESTRATEGIA_NEGOCIO.md` para la decisión de negocio (SaaS freemium) y la propuesta de qué queda en cada plan. Este documento es el "cómo", no el "qué".

---

## Las tres piezas que tienen que existir

### 1. Una fuente de verdad de qué plan tiene cada usuario

No puede vivir solo en el navegador — si el "plan" solo existiera en el estado de React, cualquiera podría abrir la consola del navegador y cambiarlo. Tiene que estar en la base de datos:

```sql
create table public.profiles (
  user_id uuid primary key references auth.users(id),
  plan text not null default 'free',  -- 'free' | 'plus' | 'business'
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_end timestamptz
);
```

### 2. Cómo se mantiene esa tabla sincronizada con lo que la persona pagó (Stripe)

Flujo típico:

1. La persona hace click en "Pasar a Plus" → la app la manda a un checkout de Stripe (hosted — nunca se tocan números de tarjeta directamente)
2. Stripe procesa el pago y manda un **webhook** (un POST) avisando "este usuario se suscribió"
3. Ese webhook llega a una función serverless (una Supabase Edge Function) que hace `UPDATE profiles SET plan = 'plus' WHERE user_id = ...`
4. Lo mismo al revés: si cancela o una tarjeta falla, Stripe manda otro webhook, y esa misma función baja el plan a `'free'`

**Importante:** la base de datos nunca "decide" el plan por sí sola — solo refleja lo que Stripe informa. Stripe es la fuente de verdad del dinero; `profiles` es un espejo de eso.

**Nota de conector:** ya hay un conector de Stripe disponible para usar desde el entorno de trabajo — cuando se arranque esta parte, se puede usar directo en vez de armar la integración desde cero.

### 3. Cómo se aplica el límite en la app — dos niveles, hacen falta los dos

**Nivel 1 — en la interfaz (UX, no seguridad real)**

Cuando alguien en plan `free` intenta crear una segunda base de datos, el botón muestra un mensaje tipo *"Las bases de datos ilimitadas son parte de Glenwyn Plus"* en vez de dejarlo pasar:

```jsx
{userPlan === 'free' && databases.length >= 1 ? (
  <UpgradePrompt feature="una segunda base de datos" />
) : (
  <button onClick={createDatabasePage}>+ Base de datos</button>
)}
```

Esto por sí solo se puede saltear (cualquiera con conocimientos técnicos podría llamar directo a la API de Supabase sin pasar por el botón).

**Nivel 2 — en el servidor (el que de verdad importa)**

El límite real tiene que estar en Postgres, vía un trigger que corre antes de cualquier inserción:

```sql
create or replace function public.check_database_limit()
returns trigger as $$
declare
  user_plan text;
  database_count int;
begin
  select plan into user_plan from public.profiles where user_id = new.user_id;
  select count(*) into database_count from public.databases where user_id = new.user_id;

  if user_plan = 'free' and database_count >= 1 then
    raise exception 'Límite del plan gratis: una base de datos. Pasate a Plus para más.';
  end if;

  return new;
end;
$$ language plpgsql;

create trigger enforce_database_limit
  before insert on public.databases
  for each row execute function check_database_limit();
```

Con esto, aunque alguien se salte la interfaz por completo, Postgres mismo rechaza el intento.

## Por qué hacen falta los dos niveles, no uno solo

| Solo Nivel 1 (interfaz) | Solo Nivel 2 (servidor) | Los dos juntos |
|---|---|---|
| Se puede saltear fácil | Funciona, pero el usuario ve un error feo de Postgres en vez de un mensaje claro | Nadie se salta el límite, y además la experiencia es prolija |

## El flujo completo, de punta a punta

```
Usuario paga en Stripe
      ↓
Webhook de Stripe → función serverless → UPDATE profiles.plan
      ↓
App carga profiles.plan junto con el resto de los datos
      ↓
Interfaz: oculta/muestra features según el plan (UX)
Postgres: bloquea de verdad si alguien se pasa del límite (seguridad real)
```

## Aplicado a los límites concretos ya propuestos en ESTRATEGIA_NEGOCIO.md

Cada límite del plan gratis necesita su propio trigger (o una función genérica reutilizable que reciba el nombre de la tabla y el límite):

- **1 base de datos** → trigger en `databases` (el ejemplo de arriba)
- **50 registros por base de datos** → trigger en `pages` cuando `database_id is not null`
- **Historial de 5 versiones** (vs. 20 actuales) → ya existe un trigger de recorte (`trim_page_versions`, de la migración `003_page_versions.sql`) — este necesitaría leer el plan para decidir el número, en vez del `20` fijo que tiene hoy
- **50 MB de imágenes** → este no se puede hacer con un trigger de Postgres — necesita revisarse en el momento de la subida (client-side antes de subir, y opcionalmente confirmado en una función serverless), sumando el tamaño total ya usado

## Orden de construcción sugerido

1. Tabla `profiles` + función que la cree automáticamente cuando alguien se registra (trigger en `auth.users`)
2. Integración de Stripe: checkout + webhook + función serverless que actualiza `profiles`
3. Los triggers de límite, uno por uno, empezando por el de bases de datos (es el ancla del plan pago)
4. La interfaz de "esto es Plus" en cada punto donde aplica un límite
5. Página de precios / pantalla de upgrade

## Riesgos y decisiones abiertas para cuando se arranque

- **Qué pasa con los datos si alguien baja de plan** (por ejemplo, tenía 3 bases de datos en Plus y cancela) — ¿se bloquean las 2 de más sin borrarlas, o se sigue permitiendo verlas pero no crear más? Recomendable: nunca borrar datos por un cambio de plan, solo restringir crear cosas nuevas
- **Período de gracia** si un pago falla — Stripe ya maneja reintentos automáticos, pero hay que decidir cuánto tiempo tarda en degradar el plan
- **Testeo:** Stripe tiene modo de pruebas completo (tarjetas falsas, webhooks simulables) — todo esto se puede construir y probar sin mover dinero real hasta el final
