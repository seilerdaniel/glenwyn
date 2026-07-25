import { pageToMarkdown } from './pageUtils';

// Filesystem-unsafe characters replaced with a dash; titles are the natural
// folder/file names since that's what a person actually recognizes their
// content by once it's unzipped on their own computer.
function sanitizeSegment(name) {
  const cleaned = (name || 'Sin título').replace(/[\\/:*?"<>|]/g, '-').trim().slice(0, 80);
  return cleaned || 'Sin título';
}

// Walks up parentId to rebuild the page's folder path — mirrors the sidebar's
// nesting, so the exported .zip reads the same way the workspace already looks.
// Guards against a corrupt parent cycle (shouldn't happen, but a backup export
// is exactly the wrong place to hang forever on bad data).
function getPagePathSegments(page, allPages) {
  const segments = [];
  let current = page;
  const visited = new Set();
  while (current) {
    if (visited.has(current.id)) break;
    visited.add(current.id);
    segments.unshift(sanitizeSegment(current.title));
    current = current.parentId ? allPages.find((p) => p.id === current.parentId) : null;
  }
  return segments;
}

// Two sibling pages can have the exact same title — rather than silently
// overwrite one on export, disambiguate with a " (2)", " (3)"... suffix.
function uniquePath(segments, extension, usedPaths) {
  let path = segments.join('/') + extension;
  let attempt = 2;
  while (usedPaths.has(path)) {
    const disambiguated = [...segments.slice(0, -1), `${segments[segments.length - 1]} (${attempt})`];
    path = disambiguated.join('/') + extension;
    attempt++;
  }
  usedPaths.add(path);
  return path;
}

// Downloads an image's actual bytes and returns them for embedding in the zip —
// falls back to `null` on any failure (network hiccup, deleted file, CORS),
// so one broken image doesn't sink the whole export.
async function fetchImageBytes(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch {
    return null;
  }
}

// The full export — every live page as Markdown, nested in folders matching
// the workspace's own hierarchy, with images embedded as actual files (not
// links back to Supabase) so the backup still means something even if the
// Glenwyn project it came from is long gone. Reports progress via onProgress
// since bundling every image can take a moment on a large workspace.
export async function exportWorkspaceToZip(pages, onProgress) {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  const assets = zip.folder('assets');
  const livePages = pages.filter((p) => !p.isArchived);
  const usedPagePaths = new Set();
  const usedAssetNames = new Set();
  const imageUrlToAssetPath = new Map(); // dedupes the same image reused across pages/blocks

  let done = 0;
  const total = livePages.length;

  for (const page of livePages) {
    const segments = getPagePathSegments(page, livePages);
    const filePath = uniquePath(segments, '.md', usedPagePaths);

    // Embed each image block's actual bytes, rewriting the markdown link to a
    // relative path inside the zip — this is what makes it a real backup
    // rather than a document full of links that could go dead later.
    for (const block of page.blocks) {
      if (block.type !== 'image' || !block.url) continue;
      if (imageUrlToAssetPath.has(block.url)) continue;

      const bytes = await fetchImageBytes(block.url);
      if (!bytes) continue; // keeps the original external link in the markdown as a fallback

      const extMatch = block.url.match(/\.(png|jpe?g|gif|webp|svg)(\?|$)/i);
      const ext = extMatch ? extMatch[1].toLowerCase() : 'png';
      let assetName = `imagen-${imageUrlToAssetPath.size + 1}.${ext}`;
      let n = 2;
      while (usedAssetNames.has(assetName)) {
        assetName = `imagen-${imageUrlToAssetPath.size + 1}-${n}.${ext}`;
        n++;
      }
      usedAssetNames.add(assetName);
      assets.file(assetName, bytes);
      imageUrlToAssetPath.set(block.url, `assets/${assetName}`);
    }

    let markdown = pageToMarkdown(page, livePages);
    for (const [originalUrl, assetPath] of imageUrlToAssetPath) {
      // Every page lives one folder level deep from the zip root at minimum,
      // so "../" gets back to root before descending into assets/.
      const depth = segments.length;
      const relativePrefix = '../'.repeat(depth - 1);
      markdown = markdown.split(originalUrl).join(`${relativePrefix}${assetPath}`);
    }

    zip.file(filePath, markdown);
    done++;
    if (onProgress) onProgress(done, total);
  }

  return zip.generateAsync({ type: 'blob' });
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
