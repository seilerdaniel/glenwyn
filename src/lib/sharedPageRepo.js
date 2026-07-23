import { supabase } from './supabaseClient';

// Fetches a shared page by its token via the `get_shared_page` RPC — this works
// without a signed-in session (the function is security-definer and grants
// EXECUTE to the anon role). Returns null if the token doesn't match anything
// shared (wrong token, sharing turned off, or the page was archived).
export async function fetchSharedPage(token) {
  const { data, error } = await supabase.rpc('get_shared_page', { p_token: token });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return {
    id: row.id,
    title: row.title ?? '',
    blocks: row.blocks ?? [],
    updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : null,
  };
}
