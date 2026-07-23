import { supabase } from './supabaseClient';

const BUCKET = 'glenwyn-images';
const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024; // 8MB — generous for notes, keeps uploads fast

// Uploads a file to the user's own folder in the bucket (path: "{userId}/{uuid}.{ext}")
// and returns its public URL. Throws on anything invalid or on upload failure.
export async function uploadImage(file, userId) {
  if (!file.type.startsWith('image/')) {
    throw new Error('El archivo tiene que ser una imagen.');
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error('La imagen es demasiado grande (máximo 8MB).');
  }

  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const path = `${userId}/${id}.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  });
  if (error) throw error;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

// Recovers the storage object path from one of our own public URLs, or null if the
// URL isn't one of ours (e.g. the user pasted an external image link instead of uploading).
function extractStoragePath(url) {
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return url.slice(idx + marker.length);
}

// Deletes any uploaded (not externally-linked) images referenced by a set of blocks.
// Best-effort by design: called when a page is gone for good (permanent delete, or the
// 30-day trash auto-purge) so storage doesn't silently accumulate orphaned files forever.
export async function deleteUploadedImagesForBlocks(blocks) {
  const paths = (blocks || [])
    .filter((b) => b.type === 'image' && b.url)
    .map((b) => extractStoragePath(b.url))
    .filter(Boolean);
  if (paths.length === 0) return;
  const { error } = await supabase.storage.from(BUCKET).remove(paths);
  if (error) throw error;
}
