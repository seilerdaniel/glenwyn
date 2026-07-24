import { supabase } from './supabaseClient';

// Loads every database the user owns, keyed by page_id for easy lookup
// (a page either is a database or it isn't — page_id is the natural key here).
export async function loadDatabases() {
  const { data, error } = await supabase.from('databases').select('*');
  if (error) throw error;
  return (data || []).map(rowToDatabase);
}

// Creates the `databases` row for a page that's being turned into a database.
// The page itself (title, blocks, etc.) is saved through the normal pages flow —
// this only creates the property-schema record that makes it a database at all.
export async function createDatabase(userId, pageId, properties) {
  const { data, error } = await supabase
    .from('databases')
    .insert({ user_id: userId, page_id: pageId, properties })
    .select()
    .single();
  if (error) throw error;
  return rowToDatabase(data);
}

// Replaces the whole property schema (add/remove/rename/reorder a column).
// Fase A keeps this simple — no migration of existing record values when a
// property is removed; they just stop showing since nothing reads them anymore.
export async function updateDatabaseProperties(databaseId, properties) {
  const { error } = await supabase.from('databases').update({ properties }).eq('id', databaseId);
  if (error) throw error;
}

export async function deleteDatabase(databaseId) {
  const { error } = await supabase.from('databases').delete().eq('id', databaseId);
  if (error) throw error;
}

function rowToDatabase(row) {
  return {
    id: row.id,
    pageId: row.page_id,
    properties: row.properties || [],
  };
}
