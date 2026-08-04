// Webhook de Stripe — mantiene la tabla `profiles` en sincronía con el estado
// real de la suscripción de cada cliente.
//
// Por qué esto tiene que ser una Edge Function y no una llamada directa desde
// el cliente: Stripe firma cada evento con el webhook secret, que nunca puede
// vivir en el navegador. Además, el webhook solo actualiza columnas (plan,
// stripe_subscription_id, current_period_end) que el RLS de `profiles` permite
// que el propio usuario edite en un update selectivo — pero queremos un único
// lugar server-side que sea la fuente de esa escritura, usando la Service Role
// Key, para que Stripe (no el cliente) decida el estado de la suscripción.
//
// Advertencia importante sobre la verificación del secret: en producción
// DEBES configurar la variable de entorno `STRIPE_WEBHOOK_SECRET` con el
// "signing secret" del webhook que creás en el dashboard de Stripe. Sin ella,
// esta función registra una advertencia y sigue (hay un branch de "modo
// desarrollo" abajo) — NO la dejes así en producción.
//
// Flujo:
// 1. Stripe POSTea el evento firmado acá (`RawBody` en lugar de `Body` para
//    poder re-verificar la firma en el HTML).
// 2. Verificamos la firma con Stripe y el secret.
// 3. Según el tipo de evento, determinamos el plan que toca:
//      - `customer.subscription.created`    -> plan según el producto
//      - `customer.subscription.updated`    -> plan según el producto
//      - `customer.subscription.deleted`    -> vuelve a 'free'
//    (los tres mapean el `plan` y el `current_period_end`; algunos también
//    `stripe_subscription_id`).
// 4. Buscamos el `user_id` por `stripe_customer_id` en `profiles` y lo
//    actualizamos con el cliente admin (service_role).
//
// La convención de plan: el ID del producto configurado en el dashboard de
// Stripe se mapea acá. Dejá la tabla `PLAN_BY_PRODUCT` con los IDs reales de
// tus productos Luoyana.
//
// Deploy: `supabase functions deploy stripe-webhook`
// Luego configurá el webhook en Stripe apuntando a
// `https://<ref>.functions.supabase.co/stripe-webhook` con los eventos listados.
// Necesita las variables de entorno: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// (automáticas en Supabase) y STRIPE_WEBHOOK_SECRET (debes configurarla).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
// Usamos una importación aleatoria de la SDK de Stripe (Stripe 17 escribe la
// firma de los webhooks en la de `https://esm.sh/stripe@17`).
import Stripe from 'https://esm.sh/stripe@17?target=deno';

// El conjunto de eventos que este webhook sabe interpretar y actualizar.
const SUBSCRIPTION_EVENTS = new Set([
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
]);

// Mapeo: un ID real de producto de Stripe -> plan ('plus' | 'business').
// Completá acá los IDs de los productos de tu cuenta de Stripe.
const PLAN_BY_PRODUCT = {
  // 'prod_XXXXX': 'plus',
  // 'prod_YYYYY': 'business',
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, stripe-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Deriva el plan y los metadatos de suscripción a partir de un objeto
// `customer.subscription.*`. Devuelve un objeto parcial de `profiles`.
function planFromSubscription(sub: any) {
  const productId = sub?.items?.data?.[0]?.price?.product ?? null;
  const plan = productId ? (PLAN_BY_PRODUCT[productId] ?? 'free') : 'free';
  const currentPeriodEnd = sub?.current_period_end
    ? new Date(sub.current_period_end * 1000).toISOString()
    : null;

  // `deleted` llega en los eventos de cancelación (la suscripción ya no existe),
  // así que es importante usarlo como señal para desproveer. Para created/updated,
  // `sub` ya trae los items.
  if (sub?.cancel_at_period_end === true || sub?.status === 'canceled') {
    return { plan: 'free', current_period_end: currentPeriodEnd };
  }

  return { plan, current_period_end: currentPeriodEnd };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Método no permitido' }, 405);
  }

  const stripe = Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
    apiVersion: '2024-10-28.acacia',
  });

  const signature = req.headers.get('stripe-signature');
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  const body = await req.text();

  let event: any;
  if (signature && webhookSecret) {
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error('Firma de webhook inválida:', err);
      return json({ error: 'Firma de webhook inválida' }, 400);
    }
  } else {
    // Modo "desarrollo": sin STRIPE_WEBHOOK_SECRET no podemos verificar la firma,
    // pero permitimos que parsers locales prueben el flujo. ADVERTENCIA: nunca
    // desplegues esto a producción sin el secret configurado — cualquiera que
    // conozca la URL podría falsificar eventos y mutar planes.
    console.warn('STRIPE_WEBHOOK_SECRET no configurado — verificando firma omitida (¡solo desarrollo!).');
    try {
      event = JSON.parse(body);
    } catch {
      return json({ error: 'Body inválido' }, 400);
    }
  }

  // Respondemos rápido a cualquier evento que no manejemos (200 con
  // "ignored": Stripe no reintenta y no nos importa).
  if (!event || !SUBSCRIPTION_EVENTS.has(event.type)) {
    return json({ received: true, ignored: true });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  try {
    const sub = event.data.object;
    const customerId = sub?.customer ?? null;
    if (!customerId) {
      return json({ error: 'No hay customer en el evento' }, 400);
    }

    // Buscar el perfil por stripe_customer_id. Si el cliente aún no tiene
    // stripe_customer_id guardado (p.ej. la primera vez que paga), se
    // registra y se ignora — el cliente debió guardarlo al crear la sesión
    // de checkout.
    const { data: profile } = await adminClient
      .from('profiles')
      .select('user_id')
      .eq('stripe_customer_id', customerId)
      .single();

    if (!profile) {
      console.error('No se encontró un perfil para el cliente de Stripe:', customerId);
      return json({ received: true, ignored: false, note: 'cliente no encontrado' }, 200);
    }

    const patch = planFromSubscription(sub);

    if (event.type === 'customer.subscription.deleted') {
      // No existe más, limpiamos la referencia de Stripe.
      await adminClient
        .from('profiles')
        .update({
          plan: 'free',
          stripe_subscription_id: null,
          current_period_end: null,
        })
        .eq('user_id', profile.user_id);
    } else {
      await adminClient
        .from('profiles')
        .update({
          ...patch,
          stripe_subscription_id: sub?.id ?? null,
          stripe_customer_id: customerId,
        })
        .eq('user_id', profile.user_id);
    }

    console.log(`[stripe-webhook] ${event.type} -> user ${profile.user_id}, plan ${patch.plan ?? 'free'}`);
    return json({ received: true, ignored: false });
  } catch (err) {
    console.error('stripe-webhook failed:', err);
    return json({ error: 'No pudimos procesar el webhook' }, 500);
  }
});