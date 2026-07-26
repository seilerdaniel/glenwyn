import { supabase } from './supabaseClient';

// Reads every page belonging to the signed-in user.
// Row Level Security already scopes this to auth.uid() = user_id, but we
// don't rely on that alone — this only ever runs for a signed-in user.
export async function loadPages() {
  const { data, error } = await supabase
    .from('pages')
    .select('*')
    .order('order', { ascending: true });

  if (error) throw error;

  return (data || []).map(rowToPage);
}

// Persists the in-memory `pages` array: upserts everything currently present,
// and deletes any row that used to exist but is gone from the array now
// (this mirrors how the old localStorage version saved the whole array at once).
// Note: `share_token` is intentionally NOT part of this payload — PostgREST only
// updates columns present in the upsert body, so sharing state is managed
// separately below and never gets clobbered by a regular content save.
export async function savePages(userId, pages, previousIds) {
  const currentIds = new Set(pages.map((p) => p.id));
  const removedIds = [...previousIds].filter((id) => !currentIds.has(id));

  if (removedIds.length > 0) {
    const { error } = await supabase.from('pages').delete().in('id', removedIds);
    if (error) throw error;
  }

  if (pages.length > 0) {
    const rows = pages.map((p) => pageToRow(p, userId));
    const { error } = await supabase.from('pages').upsert(rows, { onConflict: 'id' });
    if (error) throw error;
  }
}

// Turns sharing on for a page (generating a token if it doesn't have one yet) and
// returns that token. Safe to call repeatedly — it won't rotate an existing token.
export async function enableSharing(pageId, existingToken) {
  if (existingToken) return existingToken;
  const token = crypto.randomUUID();
  const { error } = await supabase.from('pages').update({ share_token: token }).eq('id', pageId);
  if (error) throw error;
  return token;
}

// Generates a brand new token for a page that's already shared, immediately
// invalidating the old one — for when a link was shared with the wrong person,
// or just posted somewhere more publicly than intended.
export async function rotateSharing(pageId) {
  const token = crypto.randomUUID();
  const { error } = await supabase.from('pages').update({ share_token: token }).eq('id', pageId);
  if (error) throw error;
  return token;
}

export async function disableSharing(pageId) {
  const { error } = await supabase.from('pages').update({ share_token: null }).eq('id', pageId);
  if (error) throw error;
}

function rowToPage(row) {
  return {
    id: row.id,
    title: row.title ?? '',
    icon: row.icon ?? null,
    parentId: row.parent_id,
    order: row.order,
    blocks: row.blocks ?? [],
    isArchived: row.is_archived,
    archivedAt: row.archived_at ? new Date(row.archived_at).getTime() : null,
    createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
    updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : null,
    pinned: !!row.pinned,
    shareToken: row.share_token ?? null,
    databaseId: row.database_id ?? null,
    properties: row.properties ?? null,
    fullWidth: !!row.full_width,
    locked: !!row.locked,
    fontStyle: row.font_style || 'default',
    smallText: !!row.small_text,
  };
}

function pageToRow(page, userId) {
  return {
    id: page.id,
    user_id: userId,
    title: page.title ?? '',
    icon: page.icon ?? null,
    parent_id: page.parentId,
    order: page.order,
    blocks: page.blocks ?? [],
    is_archived: !!page.isArchived,
    archived_at: page.archivedAt ? new Date(page.archivedAt).toISOString() : null,
    pinned: !!page.pinned,
    database_id: page.databaseId ?? null,
    properties: page.properties ?? null,
    full_width: !!page.fullWidth,
    locked: !!page.locked,
    font_style: page.fontStyle || 'default',
    small_text: !!page.smallText,
  };
}
