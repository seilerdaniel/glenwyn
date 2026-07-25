// Elimina la cuenta del usuario que llama, y todo lo que le pertenece.
//
// Por qué esto tiene que ser una Edge Function y no una llamada directa desde
// el cliente: borrar un usuario de auth.users requiere la Service Role Key de
// Supabase, que nunca puede vivir en el navegador (le daría a cualquiera con
// las herramientas de desarrollador acceso total a la base de datos de todos
// los usuarios). Esta función corre del lado del servidor, con esa llave
// guardada como variable de entorno — nunca en el bundle de la app.
//
// Qué borra, y en qué orden:
// 1. Las imágenes del usuario en Storage (bucket glenwyn-images/{user_id}/…) —
//    esto NO se limpia solo, porque storage.objects no tiene una relación de
//    llave foránea con auth.users con "on delete cascade".
// 2. El usuario en auth.users — esto sí dispara cascada automática sobre
//    pages, page_versions, databases, database_views, y profiles (todas esas
//    tablas ya tienen "on delete cascade" desde que se crearon).
//
// Deploy: `supabase functions deploy delete-account`
// Necesita estas variables de entorno ya disponibles automáticamente en
// cualquier Edge Function de Supabase: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
// SUPABASE_ANON_KEY. No hace falta configurar nada manual para esto.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Método no permitido' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Falta autenticación' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  // Cliente con el JWT de quien llama — solo para confirmar quién es, nunca
  // para borrar nada (el anon key no tiene permisos para eso).
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
    error: userError,
  } = await callerClient.auth.getUser();

  if (userError || !user) {
    return new Response(JSON.stringify({ error: 'No pudimos confirmar tu identidad' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Cliente con la Service Role Key — el único con permiso real para borrar
  // archivos de storage y usuarios de auth.users. Nunca sale de este servidor.
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  try {
    // 1. Borrar las imágenes del usuario en Storage — storage.objects no
    // cascada automáticamente, así que si no se hace acá quedan huérfanas.
    const { data: files } = await adminClient.storage.from('glenwyn-images').list(user.id);
    if (files && files.length > 0) {
      const paths = files.map((f) => `${user.id}/${f.name}`);
      await adminClient.storage.from('glenwyn-images').remove(paths);
    }

    // 2. Borrar el usuario — esto dispara la cascada sobre pages,
    // page_versions, databases, database_views, y profiles.
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);
    if (deleteError) throw deleteError;

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('delete-account failed:', err);
    return new Response(JSON.stringify({ error: 'No pudimos eliminar la cuenta. Probá de nuevo.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
