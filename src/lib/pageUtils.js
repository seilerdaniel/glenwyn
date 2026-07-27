// Pure logic helpers for pages/blocks — no React, no JSX, no hooks.
// Extracted from App.jsx so this logic can be read and reasoned about on its own.

// Genera un UUID real (no un string corto cualquiera) — necesario porque este mismo
// id termina en la columna `pages.id`, que en Postgres es de tipo `uuid` estricto.
// Un string corto tipo "mnh2lfhl" lo rechaza con "invalid input syntax for type uuid".
export const uid = () => crypto.randomUUID();

export const emptyPage = (title = 'Sin título', parentId = null, order = 0) => ({
  id: uid(),
  title,
  icon: null,
  parentId,
  order,
  blocks: [{ id: uid(), type: 'text', content: '' }],
  createdAt: Date.now(),
  pinned: false,
});

// Tarea 3/4 (revisión de la experiencia de un usuario nuevo) — hasta ahora,
// una cuenta recién creada arrancaba con esta misma página, pero completamente
// vacía: un solo bloque de texto sin nada escrito. Alguien que se registra a
// un "second brain" con funciones ricas no tenía ninguna guía de por dónde
// empezar. Este contenido reemplaza ese bloque en blanco.
export function welcomePageBlocks() {
  return [
    tplBlock('heading', 'Bienvenido a Glenwyn'),
    tplBlock('text', 'Esto es un segundo cerebro, pensado para escribir sin ruido — no para organizar por organizar. Esta página es tuya para editar o borrar cuando quieras.'),
    tplBlock('heading', 'Para probar en los primeros minutos'),
    tplBlock('todo', 'Escribí [[así]] en medio de una oración para conectar dos páginas'),
    tplBlock('todo', 'Probá el Modo Zen (⌘/Ctrl + .) para escribir sin distracciones'),
    tplBlock('todo', 'Creá una base de datos desde "+ Nueva página" en el sidebar'),
    tplBlock('todo', 'Mirá la Bandeja de entrada — el lugar para anotar algo rápido sin pensar dónde va'),
    tplBlock('callout', 'Todo lo que escribas es privado — solo vos podés verlo, ni siquiera nosotros.'),
    tplBlock('heading', 'Si querés profundizar'),
    tplBlock('text', 'La guía de uso completa está en /guia.html, siempre disponible desde Ajustes.'),
  ];
}

export const tplBlock = (type, content = '', extra = {}) => ({ id: uid(), type, content, ...extra });

// Predefined starting points for a new page — pure structure, no backend involved.
export const PAGE_TEMPLATES = [
  {
    id: 'journal',
    label: 'Diario',
    icon: '📔',
    desc: 'Un espacio para cerrar el día',
    title: 'Diario',
    blocks: () => [
      tplBlock('heading', 'Cómo estuvo el día'),
      tplBlock('text', ''),
      tplBlock('heading', 'Agradecido por'),
      tplBlock('bullet', ''),
      tplBlock('bullet', ''),
      tplBlock('heading', 'Pendientes para mañana'),
      tplBlock('todo', ''),
      tplBlock('todo', ''),
    ],
  },
  {
    id: 'meeting',
    label: 'Notas de reunión',
    icon: '🗒️',
    desc: 'Temas, decisiones y acciones',
    title: 'Notas de reunión',
    blocks: () => [
      tplBlock('text', 'Asistentes: '),
      tplBlock('text', 'Fecha: '),
      tplBlock('divider'),
      tplBlock('heading', 'Temas'),
      tplBlock('bullet', ''),
      tplBlock('bullet', ''),
      tplBlock('heading', 'Acciones'),
      tplBlock('todo', ''),
      tplBlock('todo', ''),
    ],
  },
  {
    id: 'brainstorm',
    label: 'Brainstorm',
    icon: '💡',
    desc: 'Ideas sueltas alrededor de una pregunta',
    title: 'Brainstorm',
    blocks: () => [
      tplBlock('heading', 'Pregunta central'),
      tplBlock('text', ''),
      tplBlock('divider'),
      tplBlock('bullet', ''),
      tplBlock('bullet', ''),
      tplBlock('bullet', ''),
      tplBlock('callout', 'Mejor idea hasta ahora'),
    ],
  },
];

// ---- Tree helpers ----
export function childrenOf(pages, parentId) {
  return pages.filter((p) => p.parentId === parentId).sort((a, b) => a.order - b.order);
}

export function isDescendant(pages, ancestorId, id) {
  let current = pages.find((p) => p.id === id);
  while (current && current.parentId) {
    if (current.parentId === ancestorId) return true;
    current = pages.find((p) => p.id === current.parentId);
  }
  return false;
}

export function getDescendantIds(pages, id) {
  const result = [];
  const stack = [id];
  while (stack.length) {
    const current = stack.pop();
    for (const k of pages.filter((p) => p.parentId === current)) {
      result.push(k.id);
      stack.push(k.id);
    }
  }
  return result;
}

export const TRASH_RETENTION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
export const VERSION_SNAPSHOT_INTERVAL_MS = 10 * 60 * 1000; // don't auto-snapshot the same page more than once per 10 min

// Slash-menu commands available when typing "/" in a block
export const SLASH_COMMANDS = [
  { type: 'text', label: 'Texto', desc: 'Un párrafo simple', icon: '¶', keywords: ['texto', 'parrafo', 'párrafo', 'p'] },
  { type: 'heading', label: 'Encabezado', desc: 'Título de sección', icon: 'H', keywords: ['encabezado', 'titulo', 'título', 'heading', 'h1'] },
  { type: 'todo', label: 'Tarea', desc: 'Casilla de verificación', icon: '☑', keywords: ['tarea', 'todo', 'pendiente', 'checkbox'] },
  { type: 'bullet', label: 'Lista', desc: 'Lista con viñetas', icon: '•', keywords: ['lista', 'vineta', 'viñeta', 'bullet'] },
  { type: 'numbered', label: 'Lista numerada', desc: 'Lista ordenada', icon: '1.', keywords: ['numerada', 'numero', 'número', 'ordenada', 'numbered'] },
  { type: 'quote', label: 'Cita', desc: 'Texto destacado con borde', icon: '❝', keywords: ['cita', 'quote', 'blockquote'] },
  { type: 'callout', label: 'Callout', desc: 'Nota destacada con ícono', icon: '💡', keywords: ['callout', 'nota', 'destacado', 'tip', 'aviso'] },
  { type: 'toggle', label: 'Desplegable', desc: 'Contenido que se puede ocultar', icon: '▸', keywords: ['toggle', 'desplegable', 'colapsable', 'expandir'] },
  { type: 'image', label: 'Imagen', desc: 'Pegá el link de una imagen', icon: '🖼️', keywords: ['imagen', 'foto', 'image', 'picture'] },
  { type: 'table', label: 'Tabla', desc: 'Grilla simple de filas y columnas', icon: '▦', keywords: ['tabla', 'table', 'grilla'] },
  { type: 'embed', label: 'Embed', desc: 'Video o link incrustado', icon: '▶', keywords: ['embed', 'video', 'youtube', 'vimeo', 'link', 'incrustado'] },
  { type: 'page-link', label: 'Página', desc: 'Link a otra página del workspace', icon: '📄', keywords: ['pagina', 'página', 'link', 'mention', 'referencia', 'subpagina'] },
  { type: 'divider', label: 'Divisor', desc: 'Línea de separación', icon: '—', keywords: ['divisor', 'linea', 'línea', 'separador', 'hr'] },
];

export const IMAGE_URL_PATTERN = /^https?:\/\/\S+\.(png|jpe?g|gif|webp|svg)(\?\S*)?$/i;
export const EMBEDDABLE_URL_PATTERN =
  /^https?:\/\/(www\.)?(youtube\.com|youtu\.be|vimeo\.com|loom\.com|open\.spotify\.com)\/\S+$/i;

// Only http(s) links are ever accepted for image/embed URLs (blocks javascript:, data:, etc.).
// Low-risk today since this is single-user content, but cheap to enforce now and it stops being
// optional the moment a "share this page" feature exists.
export function isHttpUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

// Recognizes a handful of common embed providers and turns their URLs into an
// iframe embed source. Anything else falls back to a plain clickable link card —
// there's no backend here to fetch link previews (title/thumbnail) for arbitrary URLs.
export function parseEmbedUrl(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');

    if (host === 'youtube.com' || host === 'youtu.be') {
      const id = host === 'youtu.be' ? u.pathname.slice(1) : u.searchParams.get('v') || u.pathname.split('/embed/')[1];
      if (id) return { kind: 'youtube', embedSrc: `https://www.youtube.com/embed/${id}`, ratio: '56.25%' };
    }
    if (host === 'vimeo.com') {
      const id = u.pathname.split('/').filter(Boolean)[0];
      if (id) return { kind: 'vimeo', embedSrc: `https://player.vimeo.com/video/${id}`, ratio: '56.25%' };
    }
    if (host === 'loom.com') {
      const id = u.pathname.split('/share/')[1];
      if (id) return { kind: 'loom', embedSrc: `https://www.loom.com/embed/${id}`, ratio: '56.25%' };
    }
    if (host === 'open.spotify.com') {
      return { kind: 'spotify', embedSrc: `https://open.spotify.com/embed${u.pathname}`, ratio: null };
    }
  } catch {
    // Not a valid URL — falls through to the generic link-card treatment below.
  }
  return { kind: 'generic', embedSrc: null, ratio: null };
}

// Detects markdown-style shortcuts typed at the start of a text block.
export function detectMarkdownShortcut(value) {
  const heading = value.match(/^#{1,2}\s(.*)$/);
  if (heading) return { type: 'heading', content: heading[1] };
  const todo = value.match(/^-\s?\[\s?\]\s(.*)$/);
  if (todo) return { type: 'todo', content: todo[1] };
  const bullet = value.match(/^[-*]\s(.*)$/);
  if (bullet) return { type: 'bullet', content: bullet[1] };
  const numbered = value.match(/^\d+[.)]\s(.*)$/);
  if (numbered) return { type: 'numbered', content: numbered[1] };
  const quote = value.match(/^>\s(.*)$/);
  if (quote) return { type: 'quote', content: quote[1] };
  if (value === '---') return { type: 'divider', content: '' };
  if (IMAGE_URL_PATTERN.test(value.trim())) return { type: 'image', content: '', extra: { url: value.trim() } };
  if (EMBEDDABLE_URL_PATTERN.test(value.trim())) return { type: 'embed', content: '', extra: { url: value.trim() } };
  return null;
}

// How many consecutive 'numbered' blocks precede (and include) the block at `index`,
// so numbered lists count themselves correctly without a separate list-group concept.
export function numberedListPosition(blocks, index) {
  let count = 1;
  for (let i = index - 1; i >= 0; i--) {
    if (blocks[i].type === 'numbered') count++;
    else break;
  }
  return count;
}

// Converts a page's blocks into plain Markdown text for export/download.
// `allPages` is used only to resolve titles for page-link blocks.
// Rough word count across a page's blocks (content + toggle bodies + table cells + captions).
// Not meant to be precise — just a discreet, at-a-glance sense of how much is written.
export function countWords(page) {
  const text = page.blocks
    .map((b) => {
      if (b.type === 'table') return (b.rows || []).flat().join(' ');
      return `${b.content || ''} ${b.body || ''}`;
    })
    .join(' ');
  const words = text.trim().split(/\s+/).filter(Boolean);
  return words.length;
}

// Search matches a page's title OR any text inside its blocks — not just the title,
// so "buscar una página" actually finds things you wrote, not just how you named it.
export function pageMatchesQuery(page, query) {
  const q = query.toLowerCase();
  if ((page.title || '').toLowerCase().includes(q)) return true;
  return page.blocks.some((b) => {
    if (b.type === 'table') return (b.rows || []).flat().some((cell) => cell.toLowerCase().includes(q));
    const text = `${b.content || ''} ${b.body || ''} ${b.url || ''}`.toLowerCase();
    return text.includes(q);
  });
}

export function pageToMarkdown(page, allPages) {
  const lines = [`# ${page.title || 'Sin título'}`, ''];

  page.blocks.forEach((b, i) => {
    switch (b.type) {
      case 'heading':
        lines.push(`## ${b.content}`, '');
        break;
      case 'todo':
        lines.push(`- [${b.checked ? 'x' : ' '}] ${b.content}`);
        break;
      case 'bullet':
        lines.push(`- ${b.content}`);
        break;
      case 'numbered':
        lines.push(`${numberedListPosition(page.blocks, i)}. ${b.content}`);
        break;
      case 'quote':
        lines.push(`> ${b.content}`, '');
        break;
      case 'callout':
        lines.push(`> 💡 ${b.content}`, '');
        break;
      case 'toggle':
        lines.push('<details>', `<summary>${b.content || 'Desplegable'}</summary>`, '', b.body || '', '</details>', '');
        break;
      case 'divider':
        lines.push('---', '');
        break;
      case 'image':
        if (b.url) lines.push(`![${b.content || ''}](${b.url})`, '');
        break;
      case 'table': {
        const rows = b.rows || [];
        if (rows.length > 0) {
          lines.push(`| ${rows[0].join(' | ')} |`);
          lines.push(`| ${rows[0].map(() => '---').join(' | ')} |`);
          rows.slice(1).forEach((row) => lines.push(`| ${row.join(' | ')} |`));
          lines.push('');
        }
        break;
      }
      case 'embed':
        if (b.url) lines.push(`[${b.url}](${b.url})`, '');
        break;
      case 'page-link': {
        const linked = allPages.find((p) => p.id === b.linkedPageId);
        lines.push(`→ **${linked ? linked.title || 'Sin título' : 'Página eliminada'}**`, '');
        break;
      }
      case 'text':
      default:
        lines.push(b.content || '');
    }
  });

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

// Triggers a browser download of `text` as a file named `filename`.
export function downloadTextFile(filename, text) {
  const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Flatten the tree into a visible, ordered list respecting expand/collapse state.
// `sortMode`: 'manual' (drag order, the default), 'alphabetical', or 'updated'
// (most recently modified first). Sorting here is purely a *display* choice —
// it never touches the underlying `order` field that drag-and-drop relies on.
export function buildVisibleTree(pages, expandedIds, sortMode = 'manual', rootId = null, depth = 0, acc = [], visited = new Set()) {
  let kids = childrenOf(pages, rootId);
  if (sortMode === 'alphabetical') {
    kids = [...kids].sort((a, b) => (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base' }));
  } else if (sortMode === 'updated') {
    kids = [...kids].sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
  }
  for (const k of kids) {
    if (visited.has(k.id)) continue; // guards against a corrupted/cyclical parentId chain
    visited.add(k.id);
    const hasChildren = pages.some((p) => p.parentId === k.id);
    const isExpanded = expandedIds[k.id] !== false; // default expanded
    acc.push({ page: k, depth, hasChildren, isExpanded });
    if (hasChildren && isExpanded) {
      buildVisibleTree(pages, expandedIds, sortMode, k.id, depth + 1, acc, visited);
    }
  }
  return acc;
}

// Returns a page's ancestors, root-first (excluding the page itself) — used for breadcrumbs.
// `movePage` already prevents creating parent cycles through normal use, but this guards
// against ever infinite-looping (and freezing the tab) if data somehow ends up cyclical anyway.
export function getAncestorChain(pages, pageId) {
  const chain = [];
  const visited = new Set();
  let current = pages.find((p) => p.id === pageId);
  while (current && current.parentId && !visited.has(current.id)) {
    visited.add(current.id);
    const parent = pages.find((p) => p.id === current.parentId);
    if (!parent) break;
    chain.unshift(parent);
    current = parent;
  }
  return chain;
}

const MENTION_PATTERN = /\[\[([^[\]]+)\]\]/g;

// Quick check used to decide whether a text block needs the (more expensive)
// segment-by-segment mention rendering at all.
export function hasMentions(content) {
  return /\[\[([^[\]]+)\]\]/.test(content || '');
}

// Splits a block's text into plain-text and mention segments. A mention resolves
// to a page id by exact (case-insensitive) title match; unmatched mentions still
// render, just visually marked as "not found" rather than silently disappearing.
export function parseMentions(content, allPages) {
  const segments = [];
  let lastIndex = 0;
  let match;
  MENTION_PATTERN.lastIndex = 0;
  while ((match = MENTION_PATTERN.exec(content)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', value: content.slice(lastIndex, match.index) });
    }
    const title = match[1].trim();
    const page = allPages.find((p) => !p.isArchived && (p.title || '').trim().toLowerCase() === title.toLowerCase());
    segments.push({ type: 'mention', value: title, pageId: page ? page.id : null });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < content.length) {
    segments.push({ type: 'text', value: content.slice(lastIndex) });
  }
  return segments;
}

// Backlinks — every other page that either has a "page-link" block pointing at
// `pageId`, or a resolved `[[mention]]` of it inside a text block. Computed
// client-side from the in-memory workspace; no backend query or migration
// needed since we already load every page for the signed-in user up front.
export function getBacklinks(pages, pageId) {
  return pages.filter((p) => {
    if (p.id === pageId || p.isArchived) return false;
    return p.blocks.some((b) => {
      if (b.type === 'page-link' && b.linkedPageId === pageId) return true;
      if (b.type === 'text' && hasMentions(b.content)) {
        return parseMentions(b.content, pages).some((seg) => seg.type === 'mention' && seg.pageId === pageId);
      }
      return false;
    });
  });
}

// Backlink count for every page at once, in a single pass — used to highlight
// "hub" pages (the ones most referenced across the workspace) in the sidebar.
// Calling getBacklinks() per-page in a loop would be O(n²) for no reason; this
// walks every page's blocks exactly once and tallies as it goes.
export function getBacklinkCounts(pages) {
  const counts = {};
  for (const p of pages) {
    if (p.isArchived) continue;
    const targets = new Set(); // a page mentioning another twice still counts once
    for (const b of p.blocks) {
      if (b.type === 'page-link' && b.linkedPageId && b.linkedPageId !== p.id) {
        targets.add(b.linkedPageId);
      } else if (b.type === 'text' && hasMentions(b.content)) {
        for (const seg of parseMentions(b.content, pages)) {
          if (seg.type === 'mention' && seg.pageId && seg.pageId !== p.id) targets.add(seg.pageId);
        }
      }
    }
    for (const targetId of targets) {
      counts[targetId] = (counts[targetId] || 0) + 1;
    }
  }
  return counts;
}

// Pages that nobody links to or mentions — the most common failure mode of any
// second brain (you accumulate notes and can't find half of them because
// they're not connected to anything). Not a call to action to connect
// everything; just visibility into which pages currently have zero incoming
// connections, so you can decide yourself whether to link, archive, or leave
// them as intentionally standalone.
export function getOrphanPages(pages) {
  const counts = getBacklinkCounts(pages);
  return pages.filter((p) => !p.isArchived && !counts[p.id]);
}

// Idea #17 — a rough Zettelkasten-style maturity read on a page, purely from
// signals that already exist (no extra field to maintain by hand): a page with
// no incoming connections yet is "fugaz"; once something links to it but it's
// still short, it's "en proceso"; connected AND substantial is "permanente".
// A quick visual sense of what's still a draft vs. what's actually settled.
const MATURITY_WORD_THRESHOLD = 40;

export function getPageMaturity(page, backlinkCount) {
  if (!backlinkCount) return 'fugaz';
  if (countWords(page) < MATURITY_WORD_THRESHOLD) return 'en_proceso';
  return 'permanente';
}

// Idea #33 — how long since a page was last touched, in coarse buckets. Meant
// to drive a *warm* visual treatment (a slightly muted, aged look — like an old
// photo) rather than a clinical "last edited" timestamp or a staleness warning.
const DAY_MS = 24 * 60 * 60 * 1000;

// Small, shared, and used from more than one component (the extract-to-page
// shortcut and the mini neighbor map) — pure enough to live here rather than
// be duplicated in both places.
export function truncateLabel(text, max) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export function getPageAge(page, now = Date.now()) {
  const lastTouched = page.updatedAt || page.createdAt || now;
  const daysSince = (now - lastTouched) / DAY_MS;
  if (daysSince > 90) return 'old';
  if (daysSince > 30) return 'aging';
  return 'recent';
}

// The pages `pageId` links out TO — the mirror image of getBacklinks (which only
// looks at incoming links). Powers the local neighbor map at the foot of a page,
// which needs both directions to be useful, not just "who mentions me".
export function getOutgoingLinks(pages, pageId) {
  const page = pages.find((p) => p.id === pageId);
  if (!page) return [];
  const targetIds = new Set();
  for (const b of page.blocks) {
    if (b.type === 'page-link' && b.linkedPageId && b.linkedPageId !== pageId) {
      targetIds.add(b.linkedPageId);
    } else if (b.type === 'text' && hasMentions(b.content)) {
      for (const seg of parseMentions(b.content, pages)) {
        if (seg.type === 'mention' && seg.pageId && seg.pageId !== pageId) targetIds.add(seg.pageId);
      }
    }
  }
  return pages.filter((p) => targetIds.has(p.id) && !p.isArchived);
}

// ---- Bases de datos (Fase A: propiedades básicas, una sola vista de tabla) ----
// Ver el documento de diseño para el porqué: un "registro" es simplemente una
// página normal con parentId apuntando a la página-base-de-datos y databaseId
// apuntando al esquema — reutiliza toda la jerarquía/papelera/historial existente
// en vez de duplicar esa infraestructura para un sistema paralelo.

export const PROPERTY_TYPES = [
  { type: 'text', label: 'Texto' },
  { type: 'number', label: 'Número' },
  { type: 'select', label: 'Selección' },
  { type: 'date', label: 'Fecha' },
  { type: 'checkbox', label: 'Casilla' },
  { type: 'relation', label: 'Relación' },
  { type: 'rollup', label: 'Rollup' },
];

export const ROLLUP_AGGREGATIONS = [
  { type: 'count', label: 'Contar' },
  { type: 'sum', label: 'Sumar' },
  { type: 'average', label: 'Promediar' },
];

export function newProperty(type = 'text') {
  return {
    id: uid(),
    name: 'Nueva propiedad',
    type,
    options: type === 'select' ? ['Opción 1'] : undefined,
    relatedDatabaseId: undefined, // 'relation' only — which database it points to
    relationPropertyId: undefined, // 'rollup' only — which of THIS database's relation properties to read
    targetPropertyId: undefined, // 'rollup' only — which property, on the related records, to aggregate
    aggregation: type === 'rollup' ? 'count' : undefined,
    defaultValue: undefined, // Fase D — applied automatically to every new record (relation/rollup can't have one)
  };
}

// Fase D "plantillas para registros nuevos", the simple version: rather than a
// separate named-template system, every property can carry a default value that
// gets applied automatically whenever a new record is created — a "Prioridad"
// select defaulting to "Media", a checkbox defaulting to checked, etc.
export function getDefaultPropertyValues(properties) {
  const values = {};
  for (const prop of properties) {
    if (prop.defaultValue === undefined || prop.defaultValue === '') continue;
    values[prop.id] =
      prop.type === 'date' && prop.defaultValue === '__today__'
        ? new Date().toISOString().slice(0, 10)
        : prop.defaultValue;
  }
  return values;
}

// Every page that's a record of the given database — i.e. every row a table
// view needs to render. Archived records are excluded, same convention as the
// rest of the app (they live in the trash, not in any live view).
export function getDatabaseRecords(pages, databaseId) {
  return pages
    .filter((p) => p.databaseId === databaseId && !p.isArchived)
    .sort((a, b) => a.order - b.order);
}

// Reads a record's value for a given property id, with a type-appropriate
// default when the record has never had that property set (e.g. a property
// added to the schema after the record already existed).
export function getPropertyValue(record, propertyId, propertyType) {
  const value = record.properties ? record.properties[propertyId] : undefined;
  if (value !== undefined) return value;
  if (propertyType === 'checkbox') return false;
  if (propertyType === 'relation') return [];
  return '';
}

// The actual related record pages for a 'relation' property's current value
// (an array of page ids) — archived records are silently dropped, same as
// everywhere else a stale reference could otherwise resurrect a trashed page.
export function getRelatedRecords(pages, record, relationPropertyId) {
  const ids = getPropertyValue(record, relationPropertyId, 'relation') || [];
  return ids.map((id) => pages.find((p) => p.id === id)).filter((p) => p && !p.isArchived);
}

// Resolves any property's *displayed* value for a record — plain properties
// just read their stored value, but a 'rollup' has to walk its relation and
// aggregate a property on the *related* database, which might itself be
// another rollup. `visited` guards against A→B→A cycles (Fase C's one real
// risk, flagged from the original design doc) — a cycle resolves to null
// with a flag rather than recursing forever.
export function resolvePropertyValue(pages, databases, record, property, database, visited = new Set()) {
  if (property.type !== 'rollup') {
    return { value: getPropertyValue(record, property.id, property.type), error: null };
  }

  const cycleKey = `${database.id}:${property.id}:${record.id}`;
  if (visited.has(cycleKey)) return { value: null, error: 'ciclo' };
  visited.add(cycleKey);

  const relationProp = database.properties.find((p) => p.id === property.relationPropertyId);
  if (!relationProp) return { value: null, error: 'sin configurar' };
  const relatedDatabase = databases.find((d) => d.id === relationProp.relatedDatabaseId);
  if (!relatedDatabase) return { value: null, error: 'sin configurar' };
  const targetProp = relatedDatabase.properties.find((p) => p.id === property.targetPropertyId);
  if (!targetProp) return { value: null, error: 'sin configurar' };

  const relatedRecords = getRelatedRecords(pages, record, relationProp.id);

  if (property.aggregation === 'count') {
    return { value: relatedRecords.length, error: null };
  }

  const resolved = relatedRecords.map((r) =>
    resolvePropertyValue(pages, databases, r, targetProp, relatedDatabase, visited)
  );
  // If any recursive resolution hit a cycle (or missing config), surface that
  // here too instead of quietly treating it as zero — Number(null) === 0 in
  // JS, so without this check a real cycle would silently compute as "0"
  // instead of being visible as an error.
  const firstError = resolved.find((r) => r.error);
  if (firstError) return { value: null, error: firstError.error };

  const numbers = resolved.map((r) => r.value).map(Number).filter((n) => !Number.isNaN(n));

  if (property.aggregation === 'sum') {
    return { value: numbers.reduce((a, b) => a + b, 0), error: null };
  }
  if (property.aggregation === 'average') {
    return { value: numbers.length ? numbers.reduce((a, b) => a + b, 0) / numbers.length : 0, error: null };
  }
  return { value: null, error: null };
}


// Every todo block that has a due date, across every live page — the data behind
// the "Mis tareas" global view. Undated todos aren't included (same idea as
// Todoist: Today/Upcoming only show scheduled items, not the whole inbox).
export function getAllTasks(pages) {
  const tasks = [];
  for (const p of pages) {
    if (p.isArchived) continue;
    for (const b of p.blocks) {
      if (b.type === 'todo' && b.dueDate) {
        tasks.push({
          pageId: p.id,
          pageTitle: p.title || 'Sin título',
          pageIcon: p.icon || null,
          blockId: b.id,
          content: b.content,
          checked: !!b.checked,
          dueDate: b.dueDate,
          priority: b.priority || null,
          recurrence: b.recurrence || null,
        });
      }
    }
  }
  return tasks.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

// Given a task's current due date and its recurrence rule, returns the ISO date
// (YYYY-MM-DD) it should roll forward to once checked off. Kept intentionally
// simple — no days-of-week targeting yet, just "every N days/weeks/months from
// the date it was due" (not from today), which is how Todoist's simplest
// recurring tasks behave too.
export function computeNextDueDate(dueDate, recurrence) {
  const [y, m, d] = dueDate.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const interval = recurrence.interval || 1;

  if (recurrence.freq === 'daily') {
    date.setDate(date.getDate() + interval);
  } else if (recurrence.freq === 'weekly') {
    date.setDate(date.getDate() + 7 * interval);
  } else if (recurrence.freq === 'monthly') {
    // Naively doing setMonth() here would overflow a day that doesn't exist in the
    // target month (e.g. Jan 31 + 1 month becomes Mar 3, skipping February
    // entirely). Clamp to the target month's last real day instead, same as
    // Todoist/Google Calendar do for monthly recurrence.
    const targetMonthIndex = date.getMonth() + interval;
    const daysInTargetMonth = new Date(date.getFullYear(), targetMonthIndex + 1, 0).getDate();
    date.setDate(1); // avoid overflow while we change the month
    date.setMonth(targetMonthIndex);
    date.setDate(Math.min(d, daysInTargetMonth));
  } else {
    return dueDate; // unknown frequency — leave unchanged rather than guess
  }

  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function toIsoDate(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
// Accepts both accented and unaccented spellings, since typing without accents is common.
const WEEKDAY_PATTERN = '(?:domingo|lunes|martes|mi[ée]rcoles|jueves|viernes|s[áa]bado)';

function normalizeWeekday(word) {
  const w = word.toLowerCase().replace('é', 'e').replace('á', 'a');
  return WEEKDAYS.findIndex((day) => day.replace('é', 'e').replace('á', 'a') === w);
}

// Finds and parses a trailing Spanish natural-language date phrase in a task's text
// (e.g. "Llamar al contador mañana", "Pagar el alquiler todos los lunes",
// "Revisar en 3 días"). Returns { cleanedText, dueDate, recurrence } if something
// matched, or null otherwise. Deliberately narrow: a hand-written parser for common
// phrases rather than a general-purpose date library (those are built for English
// and don't handle Spanish phrasing well) — see the task design doc for why.
export function parseNaturalDateFromText(text, today = new Date()) {
  const patterns = [
    // Recurring — checked before the one-off equivalents so "cada lunes" doesn't
    // just get read as a plain "lunes".
    {
      regex: /\b(?:cada|todos los)\s+(d[ií]as?)\b/i,
      resolve: () => ({ date: today, recurrence: { freq: 'daily', interval: 1 } }),
    },
    {
      regex: new RegExp(`\\b(?:cada|todos los)\\s+(${WEEKDAY_PATTERN})\\b`, 'i'),
      resolve: (m) => {
        const targetIdx = normalizeWeekday(m[1]);
        const diff = (targetIdx - today.getDay() + 7) % 7;
        const date = new Date(today);
        date.setDate(date.getDate() + diff);
        return { date, recurrence: { freq: 'weekly', interval: 1 } };
      },
    },
    {
      regex: /\b(?:cada semana|semanalmente)\b/i,
      resolve: () => {
        const date = new Date(today);
        date.setDate(date.getDate() + 7);
        return { date, recurrence: { freq: 'weekly', interval: 1 } };
      },
    },
    {
      regex: /\b(?:cada mes|mensualmente|todos los meses)\b/i,
      resolve: () => {
        const date = new Date(today);
        date.setMonth(date.getMonth() + 1);
        return { date, recurrence: { freq: 'monthly', interval: 1 } };
      },
    },
    // One-off dates.
    {
      regex: /\bpasado ma[ñn]ana\b/i,
      resolve: () => {
        const date = new Date(today);
        date.setDate(date.getDate() + 2);
        return { date, recurrence: null };
      },
    },
    {
      regex: /\bma[ñn]ana\b/i,
      resolve: () => {
        const date = new Date(today);
        date.setDate(date.getDate() + 1);
        return { date, recurrence: null };
      },
    },
    {
      regex: /\bhoy\b/i,
      resolve: () => ({ date: new Date(today), recurrence: null }),
    },
    {
      regex: /\ben (\d{1,2}) semanas?\b/i,
      resolve: (m) => {
        const date = new Date(today);
        date.setDate(date.getDate() + 7 * Number(m[1]));
        return { date, recurrence: null };
      },
    },
    {
      regex: /\ben (\d{1,2}) d[ií]as?\b/i,
      resolve: (m) => {
        const date = new Date(today);
        date.setDate(date.getDate() + Number(m[1]));
        return { date, recurrence: null };
      },
    },
    {
      regex: new RegExp(`\\b(?:el |este )?(${WEEKDAY_PATTERN})\\b`, 'i'),
      resolve: (m) => {
        const targetIdx = normalizeWeekday(m[1]);
        const diff = (targetIdx - today.getDay() + 7) % 7;
        const date = new Date(today);
        date.setDate(date.getDate() + diff);
        return { date, recurrence: null };
      },
    },
  ];

  for (const { regex, resolve } of patterns) {
    const match = text.match(regex);
    if (match) {
      const { date, recurrence } = resolve(match);
      const cleanedText = (text.slice(0, match.index) + text.slice(match.index + match[0].length))
        .replace(/\s{2,}/g, ' ')
        .trim();
      return { cleanedText, dueDate: toIsoDate(date), recurrence };
    }
  }
  return null;
}

// Move dragId to be a sibling (before/after) of targetId, or a child (inside) of it.
export function movePage(pages, dragId, targetId, position) {
  if (dragId === targetId) return pages;
  const dragPage = pages.find((p) => p.id === dragId);
  const targetPage = pages.find((p) => p.id === targetId);
  if (!dragPage || !targetPage) return pages;
  if (isDescendant(pages, dragId, targetId)) return pages; // prevent cycles

  const newParentId = position === 'inside' ? targetId : targetPage.parentId;
  const others = pages.filter((p) => p.id !== dragId);
  const siblings = others.filter((p) => p.parentId === newParentId).sort((a, b) => a.order - b.order);

  let insertIndex;
  if (position === 'inside') {
    insertIndex = siblings.length;
  } else {
    const targetIndex = siblings.findIndex((p) => p.id === targetId);
    insertIndex = position === 'before' ? targetIndex : targetIndex + 1;
  }
  siblings.splice(insertIndex, 0, { ...dragPage, parentId: newParentId });
  const reordered = siblings.map((p, i) => ({ ...p, order: i }));

  const reorderedIds = new Set(reordered.map((p) => p.id));
  const rest = others.filter((p) => !reorderedIds.has(p.id));
  return [...rest, ...reordered];
}

// Move dragId to become a root-level page at the end of the root list.
export function movePageToRootEnd(pages, dragId) {
  const dragPage = pages.find((p) => p.id === dragId);
  if (!dragPage) return pages;
  const others = pages.filter((p) => p.id !== dragId);
  const rootSiblings = others.filter((p) => p.parentId === null).sort((a, b) => a.order - b.order);
  rootSiblings.push({ ...dragPage, parentId: null });
  const reordered = rootSiblings.map((p, i) => ({ ...p, order: i }));
  const reorderedIds = new Set(reordered.map((p) => p.id));
  const rest = others.filter((p) => !reorderedIds.has(p.id));
  return [...rest, ...reordered];
}
