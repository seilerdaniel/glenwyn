import { supabase } from './supabaseClient';

// Loads the signed-in user's own profile (plan + billing metadata). Every user
// should have exactly one row here — created automatically by the database
// trigger on signup, or by the migration's one-time backfill for accounts that
// existed before that trigger did.
export async function loadProfile() {
  const { data, error } = await supabase.from('profiles').select('*').single();
  if (error) throw error;
  return rowToProfile(data);
}

function rowToProfile(row) {
  return {
    userId: row.user_id,
    plan: row.plan,
    stripeCustomerId: row.stripe_customer_id,
    stripeSubscriptionId: row.stripe_subscription_id,
    currentPeriodEnd: row.current_period_end ? new Date(row.current_period_end).getTime() : null,
  };
}
