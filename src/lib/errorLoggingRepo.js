import { supabase } from './supabaseClient';

// Best-effort en el sentido más literal: si esto mismo falla (sin conexión,
// RLS mal configurado, lo que sea), se traga el error en vez de generar un
// segundo error a partir del primero. El objetivo es enterarse de problemas
// reales, no crear una cadena de fallos silenciosos.
export async function logError(error, source) {
  try {
    const { data } = await supabase.auth.getUser();
    await supabase.from('error_logs').insert({
      user_id: data?.user?.id || null,
      message: String(error?.message || error || 'Error desconocido').slice(0, 2000),
      stack: error?.stack ? String(error.stack).slice(0, 4000) : null,
      source,
      url: typeof window !== 'undefined' ? window.location.href : null,
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    });
  } catch (e) {
    // A propósito, solo en consola — nunca relanzar desde acá.
    console.error('Glenwyn: failed to log error to Supabase', e);
  }
}
