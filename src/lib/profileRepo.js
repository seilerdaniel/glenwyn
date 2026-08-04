import { supabase } from './supabaseClient';

// ---- Plan limits (pure logic, no Supabase) ----
//
// Source of truth for what each plan is allowed to do. `PLAN_LIMITS[plan]`
// holds the cap for each gated resource; a value of `Infinity` means "no
// limit". Everything here is exported pure so it can be unit-tested without
// touching Supabase at all (see profileRepo.test.js).

export const PLANS = { FREE: 'free', PLUS: 'plus', BUSINESS: 'business' };

export const PLAN_LABELS = {
  [PLANS.FREE]: 'Free',
  [PLANS.PLUS]: 'Plus',
  [PLANS.BUSINESS]: 'Business',
};

// 50 registros por base de datos en Free (ver DISENO_MONETIZACION.md /
// ESTRATEGIA_NEGOCIO.md). Se exporta suelta para poder mostrarla en UI.
export const MAX_DB_ROWS = 50;

export const PLAN_LIMITS = {
  // 1 base de datos en Free (ver DISENO_MONETIZACION.md / ESTRATEGIA_NEGOCIO.md).
  [PLANS.FREE]: {
    maxDatabases: 1,
    maxDbRows: MAX_DB_ROWS, // 50 registros por base de datos
    maxFileSizeBytes: 5 * 1024 * 1024, // 5 MB por archivo adjunto
  },
  // Plus / Business: ilimitado.
  [PLANS.PLUS]: {
    maxDatabases: Infinity,
    maxDbRows: Infinity,
    maxFileSizeBytes: Infinity,
  },
  [PLANS.BUSINESS]: {
    maxDatabases: Infinity,
    maxDbRows: Infinity,
    maxFileSizeBytes: Infinity,
  },
};

// Normaliza cualquier valor de `plan` a un plan conocido; cualquier cosa rara o
// inesperada cae a 'free'. Es lo que se usa como fallback cuando el perfil no
// existe o no llega (offline / error).
export function normalizePlan(plan) {
  if (plan === PLANS.PLUS || plan === PLANS.BUSINESS) return plan;
  return PLANS.FREE;
}

// Devuelve el límite numérico para un recurso según un plan normalizado.
export function limitFor(plan, key) {
  return PLAN_LIMITS[normalizePlan(plan)][key];
}

// ¿Al cantro puede crear OTRA base de datos? Admins y planes pagos siempre sí.
// `currentCount` es cuántas bases de datos tiene hoy el usuario.
export function canCreateDatabase(profile, currentCount) {
  const count = Number(currentCount) || 0;
  if (profile?.isAdmin) return true;
  const max = limitFor(profile?.plan, 'maxDatabases');
  return count < max;
}

// ¿Puede agregar OTRO registro a una base de datos? Admins y planes pagos siempre sí.
// `currentRowCount` es cuántos registros tiene hoy la base de datos.
export function canAddDatabaseRow(profile, currentRowCount) {
  const count = Number(currentRowCount) || 0;
  if (profile?.isAdmin) return true;
  return count < limitFor(profile?.plan, 'maxDbRows');
}

// ¿Puede subir un archivo de `fileSize` bytes? Admins y planes pagos siempre sí.
export function canUploadFile(profile, fileSize) {
  if (profile?.isAdmin) return true;
  const size = Number(fileSize) || 0;
  return size <= limitFor(profile?.plan, 'maxFileSizeBytes');
}

// Una manera tipada y única de construir el objeto fallback cuando no hay perfil.
export function defaultProfile(userId) {
  return {
    userId,
    plan: PLANS.FREE,
    isAdmin: false,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    currentPeriodEnd: null,
  };
}

function rowToProfile(row) {
  return {
    userId: row.user_id,
    plan: normalizePlan(row.plan),
    isAdmin: !!row.is_admin,
    stripeCustomerId: row.stripe_customer_id,
    stripeSubscriptionId: row.stripe_subscription_id,
    currentPeriodEnd: row.current_period_end ? new Date(row.current_period_end).getTime() : null,
  };
}

// Loads the signed-in user's own profile (plan + billing metadata). Every user
// should have exactly one row here — created automatically by the database
// trigger on signup, or by the migration's one-time backfill for accounts that
// existed before that trigger did. Falls back to the free plan if there's no
// profile row (or if the network/Supabase errors), so the app never hard-blocks
// a user just because the profile read failed.
export async function loadProfile() {
  const { data, error } = await supabase.from('profiles').select('*').single();
  if (error) throw error;
  return rowToProfile(data);
}