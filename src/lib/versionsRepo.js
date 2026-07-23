import { supabase } from './supabaseClient';

// Saves a snapshot of a page's current title + blocks.
// Old versions beyond the 20 most recent are trimmed automatically by a DB trigger.
export async function saveVersion(userId, page) {
  const { error } = await supabase.from('page_versions').insert({
    page_id: page.id,
    user_id: userId,
    title: page.title ?? '',
    blocks: page.blocks ?? [],
  });
  if (error) throw error;
}

// Lists the saved snapshots for a page, most recent first.
export async function listVersions(pageId) {
  const { data, error } = await supabase
    .from('page_versions')
    .select('id, title, blocks, created_at')
    .eq('page_id', pageId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data || []).map((row) => ({
    id: row.id,
    title: row.title ?? '',
    blocks: row.blocks ?? [],
    createdAt: new Date(row.created_at).getTime(),
  }));
}
