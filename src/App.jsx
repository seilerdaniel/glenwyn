import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { storage } from './lib/storage';
import { loadPages, savePages, enableSharing, disableSharing, rotateSharing } from './lib/pagesRepo';
import { saveVersion, listVersions } from './lib/versionsRepo';
import { uploadImage, deleteUploadedImagesForBlocks } from './lib/storageRepo';
import { fetchSharedPage } from './lib/sharedPageRepo';
import { supabase } from './lib/supabaseClient';
import AuthGate from './components/AuthGate';

// ---- Design tokens ----
const tokens = {
  light: {
    canvas: '#F6F3EC',
    canvasAlt: '#EFEAE0',
    bark: '#2E2A24',
    fern: '#7C8B6F',
    moss: '#4A5D45',
    clay: '#E8E2D3',
    sun: '#C9A876',
    sidebarBg: '#EFEAE0',
    error: '#994530',
  },
  dark: {
    canvas: '#1C1F1A',
    canvasAlt: '#20241D',
    bark: '#E8E4D9',
    fern: '#8FA085',
    moss: '#6B8060',
    clay: '#2E332A',
    sun: '#D4B483',
    sidebarBg: '#181B15',
    error: '#E08A65',
  },
};

const displayFont = "'Fraunces', Georgia, serif";
const bodyFont = "'Public Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const monoFont = "'JetBrains Mono', ui-monospace, monospace";

import {
  uid,
  emptyPage,
  PAGE_TEMPLATES,
  getDescendantIds,
  TRASH_RETENTION_MS,
  VERSION_SNAPSHOT_INTERVAL_MS,
  SLASH_COMMANDS,
  isHttpUrl,
  parseEmbedUrl,
  detectMarkdownShortcut,
  numberedListPosition,
  countWords,
  pageMatchesQuery,
  pageToMarkdown,
  downloadTextFile,
  buildVisibleTree,
  getAncestorChain,
  getBacklinks,
  hasMentions,
  parseMentions,
  getAllTasks,
  computeNextDueDate,
  parseNaturalDateFromText,
  movePage,
  movePageToRootEnd,
} from './lib/pageUtils';


function topbarMenuItemStyle(t) {
  return {
    display: 'block',
    width: '100%',
    textAlign: 'left',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: t.bark,
    fontSize: 13,
    fontFamily: bodyFont,
    padding: '9px 12px',
    borderBottom: `1px solid ${t.clay}`,
  };
}

function Glenwyn({ user }) {
  const [dark, setDark] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isNarrow, setIsNarrow] = useState(
    typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(max-width: 640px)').matches : false
  );

  // Tracks whether we're in "narrow screen" layout (sidebar becomes an overlay drawer).
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(max-width: 640px)');
    const handler = (e) => setIsNarrow(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // On a narrow screen, the sidebar should start closed (it's a full overlay there,
  // not a slim rail) regardless of what was persisted from a desktop session.
  useEffect(() => {
    if (isNarrow) setSidebarOpen(false);
  }, [isNarrow]);
  const [pages, setPages] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [saveState, setSaveState] = useState('idle'); // idle | saving | saved
  const [saveError, setSaveError] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedIds, setExpandedIds] = useState({});
  const [sortMode, setSortMode] = useState('manual'); // 'manual' | 'alphabetical' | 'updated'
  const [dragId, setDragId] = useState(null);
  const [dropTarget, setDropTarget] = useState(null); // { id, position: 'before'|'after'|'inside' }
  const [trashOpen, setTrashOpen] = useState(false);
  const [templateMenuOpen, setTemplateMenuOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyEntries, setHistoryEntries] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [shareOpen, setShareOpen] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareError, setShareError] = useState('');
  const [shareCopied, setShareCopied] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [tasksViewOpen, setTasksViewOpen] = useState(false);
  const [topbarMenuOpen, setTopbarMenuOpen] = useState(false);
  const [titleIconPickerOpen, setTitleIconPickerOpen] = useState(false);
  const searchInputRef = useRef(null);
  const saveTimer = useRef(null);
  const knownIds = useRef(new Set()); // ids present in Supabase as of the last successful save
  const blockRefs = useRef({}); // blockId -> focusable DOM node, used to focus the previous block after a delete
  const pagesRef = useRef(pages); // always holds the latest `pages`, so a queued retry never saves stale data
  const activeIdRef = useRef(activeId); // same idea, for knowing which page to auto-snapshot
  const isSavingRef = useRef(false);
  const pendingSaveRef = useRef(false);
  const lastVersionAtRef = useRef({}); // pageId -> timestamp of the last snapshot taken this session

  useEffect(() => {
    pagesRef.current = pages;
  }, [pages]);

  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  const registerBlockRef = (blockId) => (el) => {
    if (el) blockRefs.current[blockId] = el;
    else delete blockRefs.current[blockId];
  };


  const t = dark ? tokens.dark : tokens.light;

  // ---- Load persisted state ----
  useEffect(() => {
    (async () => {
      try {
        const [loadedPagesResult, prefsResult] = await Promise.allSettled([
          loadPages(),
          storage.get('glenwyn:prefs'),
        ]);

        let loadedPages =
          loadedPagesResult.status === 'fulfilled' ? loadedPagesResult.value : [];

        if (!loadedPages || loadedPages.length === 0) {
          loadedPages = [emptyPage('Bienvenida')];
        }
        const now = Date.now();
        const beforePurgeIds = new Set(loadedPages.map((p) => p.id));
        const purgedPages = loadedPages.filter(
          (p) => p.isArchived && p.archivedAt && now - p.archivedAt > TRASH_RETENTION_MS
        );
        loadedPages = loadedPages.filter((p) => !purgedPages.includes(p));
        // `knownIds` is set from the *unfiltered* list on purpose: pages purged just above
        // still exist in Supabase, so the next autosave's diff needs to see them as
        // "known but no longer present" in order to actually delete them there too —
        // otherwise they'd just be hidden locally and pile up in the database forever.
        knownIds.current = beforePurgeIds;
        // Same idea for their uploaded images — best-effort, doesn't block loading the app.
        purgedPages.forEach((p) => {
          deleteUploadedImagesForBlocks(p.blocks).catch((e) =>
            console.error('Glenwyn: failed to clean up images for auto-purged page', e)
          );
        });
        setPages(loadedPages);
        setActiveId((loadedPages.find((p) => !p.isArchived) || loadedPages[0] || {}).id || null);

        if (prefsResult.status === 'fulfilled' && prefsResult.value) {
          const prefs = JSON.parse(prefsResult.value.value);
          setDark(!!prefs.dark);
          setSidebarOpen(prefs.sidebarOpen !== false);
          setExpandedIds(prefs.expandedIds || {});
          setSortMode(prefs.sortMode || 'manual');
        } else {
          const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
          setDark(prefersDark);
        }
      } catch (e) {
        console.error('Glenwyn: failed to load pages/prefs', e);
        setPages([emptyPage('Bienvenida')]);
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  // Saves `pagesRef.current` (always the latest state) to Supabase. Guarded against overlapping
  // calls: if a save is already in flight when this fires again, it just flags a pending retry
  // instead of racing two saves against the same `knownIds` snapshot.
  const flushSave = useCallback(async () => {
    if (isSavingRef.current) {
      pendingSaveRef.current = true;
      return;
    }
    isSavingRef.current = true;
    try {
      await savePages(user.id, pagesRef.current, knownIds.current);
      knownIds.current = new Set(pagesRef.current.map((p) => p.id));
      setSaveError('');
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 1500);

      // Best-effort version snapshot of whatever page is currently open — throttled so
      // typing doesn't spam the versions table. Never blocks or fails the actual save.
      const current = pagesRef.current.find((p) => p.id === activeIdRef.current);
      if (current && !current.isArchived) {
        const lastAt = lastVersionAtRef.current[current.id] || 0;
        if (Date.now() - lastAt > VERSION_SNAPSHOT_INTERVAL_MS) {
          lastVersionAtRef.current[current.id] = Date.now();
          saveVersion(user.id, current).catch((e) =>
            console.error('Glenwyn: failed to save version snapshot', e)
          );
        }
      }
    } catch (e) {
      console.error('Glenwyn: failed to save pages', e);
      setSaveState('idle');
      setSaveError('No se pudo guardar. Revisá tu conexión.');
    } finally {
      isSavingRef.current = false;
      if (pendingSaveRef.current) {
        pendingSaveRef.current = false;
        flushSave();
      }
    }
  }, [user.id]);

  // ---- Persist pages to Supabase (debounced autosave) ----
  useEffect(() => {
    if (!loaded) return;
    setSaveState('saving');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      flushSave();
    }, 500);
    return () => clearTimeout(saveTimer.current);
  }, [pages, loaded, flushSave]);

  // ---- Persist prefs (device-local UI state — not synced to Supabase) ----
  useEffect(() => {
    if (!loaded) return;
    storage.set('glenwyn:prefs', JSON.stringify({ dark, sidebarOpen, expandedIds, sortMode })).catch(() => {});
  }, [dark, sidebarOpen, expandedIds, sortMode, loaded]);


  // ---- Keyboard shortcuts ----
  useEffect(() => {
    const handler = (e) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === '\\') {
        e.preventDefault();
        setSidebarOpen((s) => !s);
      }
      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((s) => !s);
      }
      if (e.key === '?' && !mod) {
        // Only toggle when not actively typing — otherwise typing a literal "?" in a
        // note would hijack the keystroke and pop this open instead.
        const el = document.activeElement;
        const isTyping = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
        if (!isTyping) {
          e.preventDefault();
          setShortcutsOpen((s) => !s);
        }
      }
      if (e.key === 'Escape') {
        setSearchOpen(false);
        setTrashOpen(false);
        setTemplateMenuOpen(false);
        setHistoryOpen(false);
        setShareOpen(false);
        setShortcutsOpen(false);
        setTasksViewOpen(false);
        setTopbarMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [searchOpen]);

  // Close the template popover on any click outside of it (the popover itself stops propagation).
  useEffect(() => {
    if (!templateMenuOpen) return;
    const closeIt = () => setTemplateMenuOpen(false);
    window.addEventListener('click', closeIt);
    return () => window.removeEventListener('click', closeIt);
  }, [templateMenuOpen]);

  useEffect(() => {
    if (!topbarMenuOpen) return;
    const closeIt = () => setTopbarMenuOpen(false);
    window.addEventListener('click', closeIt);
    return () => window.removeEventListener('click', closeIt);
  }, [topbarMenuOpen]);

  useEffect(() => {
    if (!titleIconPickerOpen) return;
    const closeIt = () => setTitleIconPickerOpen(false);
    window.addEventListener('click', closeIt);
    return () => window.removeEventListener('click', closeIt);
  }, [titleIconPickerOpen]);

  const activePage = pages.find((p) => p.id === activeId) || null;

  // Keep the browser tab title in sync with whatever page is open — makes it much
  // easier to find the right tab among several, and gives bookmarks a real name.
  useEffect(() => {
    document.title = activePage ? `${activePage.title || 'Sin título'} · Glenwyn` : 'Glenwyn';
    return () => {
      document.title = 'Glenwyn';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only title/id should retrigger this, not every block edit
  }, [activePage?.title, activePage?.id]);

  // Navigating from the sidebar should also close it on narrow screens — it's an
  // overlay drawer there, not a persistent rail, so it'd otherwise cover the page.
  const selectPage = (id) => {
    setActiveId(id);
    setTasksViewOpen(false);
    if (isNarrow) setSidebarOpen(false);
  };
  const breadcrumbChain = useMemo(
    () => (activePage ? getAncestorChain(pages, activePage.id) : []),
    [pages, activePage]
  );

  const backlinks = useMemo(
    () => (activePage ? getBacklinks(pages, activePage.id) : []),
    [pages, activePage]
  );

  const allTasks = useMemo(() => getAllTasks(pages), [pages]);
  const today = new Date().toISOString().slice(0, 10);

  const createPage = useCallback((parentId = null, templateId = null) => {
    setPages((prev) => {
      const siblings = prev.filter((p) => p.parentId === parentId);
      const template = templateId ? PAGE_TEMPLATES.find((t) => t.id === templateId) : null;
      const p = template
        ? {
            id: uid(),
            title: template.title,
            icon: null,
            parentId,
            order: siblings.length,
            blocks: template.blocks(),
            createdAt: Date.now(),
            pinned: false,
          }
        : emptyPage('Sin título', parentId, siblings.length);
      setActiveId(p.id);
      if (parentId) {
        setExpandedIds((e) => ({ ...e, [parentId]: true }));
      }
      return [...prev, p];
    });
  }, []);

  const renamePage = (id, title) => {
    setPages((prev) => prev.map((p) => (p.id === id ? { ...p, title } : p)));
  };

  const setPageIcon = (id, icon) => {
    setPages((prev) => prev.map((p) => (p.id === id ? { ...p, icon } : p)));
  };

  const togglePin = (id) => {
    setPages((prev) => prev.map((p) => (p.id === id ? { ...p, pinned: !p.pinned } : p)));
  };

  // Duplicates a single page (not its subpages) as a sibling right after the original.
  const duplicatePage = (id) => {
    setPages((prev) => {
      const original = prev.find((p) => p.id === id);
      if (!original) return prev;

      const copy = {
        ...original,
        id: uid(),
        title: `${original.title || 'Sin título'} (copia)`,
        pinned: false,
        createdAt: Date.now(),
        blocks: original.blocks.map((b) => ({ ...b, id: uid() })),
        // A duplicate must never inherit the original's share link — two pages can't
        // share one token (there's a unique index on it), and even if they could,
        // a "copy" silently being publicly readable via someone else's old link would
        // be a real surprise. Also reset archive state defensively, in case this
        // function is ever called on an archived page from somewhere else later.
        shareToken: null,
        isArchived: false,
        archivedAt: null,
      };

      // Insert right after the original, then renormalize sibling order to clean integers
      // (consistent with how drag-reorder keeps `order` tidy elsewhere in the app).
      const others = prev.filter((p) => p.parentId === original.parentId);
      const idx = others.findIndex((p) => p.id === original.id);
      const siblings = [...others];
      siblings.splice(idx + 1, 0, copy);
      const reordered = siblings.map((p, i) => ({ ...p, order: i }));

      const rest = prev.filter((p) => p.parentId !== original.parentId);
      setActiveId(copy.id);
      return [...rest, ...reordered];
    });
  };

  const openHistory = async (pageId) => {
    setHistoryOpen(true);
    setHistoryLoading(true);
    setHistoryError('');
    try {
      const entries = await listVersions(pageId);
      setHistoryEntries(entries);
    } catch (e) {
      console.error('Glenwyn: failed to load version history', e);
      setHistoryError('No pudimos cargar el historial.');
    } finally {
      setHistoryLoading(false);
    }
  };

  const exportPageAsMarkdown = (page) => {
    const markdown = pageToMarkdown(page, livePages);
    const safeName = (page.title || 'sin-titulo').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'pagina';
    downloadTextFile(`${safeName}.md`, markdown);
  };

  const handleEnableSharing = async (page) => {
    setShareLoading(true);
    setShareError('');
    try {
      const token = await enableSharing(page.id, page.shareToken);
      setPages((prev) => prev.map((p) => (p.id === page.id ? { ...p, shareToken: token } : p)));
    } catch (e) {
      console.error('Glenwyn: failed to enable sharing', e);
      setShareError('No pudimos activar el link. Revisá tu conexión.');
    } finally {
      setShareLoading(false);
    }
  };

  const handleDisableSharing = async (page) => {
    setShareLoading(true);
    setShareError('');
    try {
      await disableSharing(page.id);
      setPages((prev) => prev.map((p) => (p.id === page.id ? { ...p, shareToken: null } : p)));
    } catch (e) {
      console.error('Glenwyn: failed to disable sharing', e);
      setShareError('No pudimos desactivar el link.');
    } finally {
      setShareLoading(false);
    }
  };

  const handleRotateSharing = async (page) => {
    const ok = window.confirm('El link anterior deja de funcionar de inmediato. ¿Generar uno nuevo?');
    if (!ok) return;
    setShareLoading(true);
    setShareError('');
    try {
      const token = await rotateSharing(page.id);
      setPages((prev) => prev.map((p) => (p.id === page.id ? { ...p, shareToken: token } : p)));
      setShareCopied(false);
    } catch (e) {
      console.error('Glenwyn: failed to rotate sharing token', e);
      setShareError('No pudimos generar un link nuevo.');
    } finally {
      setShareLoading(false);
    }
  };

  // Snapshots the page right now, regardless of the throttle, and refreshes the list —
  // used by the "Guardar versión ahora" button in the history panel.
  const saveVersionNow = async (page) => {
    try {
      await saveVersion(user.id, page);
      lastVersionAtRef.current[page.id] = Date.now();
      const entries = await listVersions(page.id);
      setHistoryEntries(entries);
    } catch (e) {
      console.error('Glenwyn: failed to save version snapshot', e);
      setHistoryError('No pudimos guardar la versión.');
    }
  };

  const restoreVersion = (pageId, entry) => {
    const ok = window.confirm(
      'Esto va a reemplazar el contenido actual de la página con esta versión anterior. ¿Continuar?'
    );
    if (!ok) return;

    // Snapshot the current state first, so restoring is itself undoable from the history panel —
    // best-effort: if this fails (e.g. offline), we still proceed with the restore the user asked for.
    const current = pagesRef.current.find((p) => p.id === pageId);
    if (current) {
      saveVersion(user.id, current).catch((e) =>
        console.error('Glenwyn: failed to snapshot pre-restore state', e)
      );
    }

    setPages((prev) =>
      prev.map((p) => (p.id === pageId ? { ...p, title: entry.title, blocks: entry.blocks } : p))
    );
    setHistoryOpen(false);
  };

  // Sending a page to trash cascades to its descendants, so a whole branch moves together.
  const archivePage = (id) => {
    setPages((prev) => {
      const idsToArchive = new Set([id, ...getDescendantIds(prev, id)]);
      const now = Date.now();
      const next = prev.map((p) => (idsToArchive.has(p.id) ? { ...p, isArchived: true, archivedAt: now } : p));
      if (idsToArchive.has(activeId)) {
        const firstAvailable = next.find((p) => !p.isArchived);
        setActiveId(firstAvailable ? firstAvailable.id : null);
      }
      return next;
    });
  };

  const restorePage = (id) => {
    setPages((prev) => {
      // Also restore any archived ancestors, so the page isn't left invisible/orphaned.
      const idsToRestore = new Set([id]);
      let current = prev.find((p) => p.id === id);
      while (current && current.parentId) {
        const parent = prev.find((p) => p.id === current.parentId);
        if (parent && parent.isArchived) idsToRestore.add(parent.id);
        current = parent;
      }
      return prev.map((p) => (idsToRestore.has(p.id) ? { ...p, isArchived: false, archivedAt: null } : p));
    });
  };

  const permanentlyDeletePage = (id) => {
    const idsToRemove = new Set([id, ...getDescendantIds(pagesRef.current, id)]);
    const removedPages = pagesRef.current.filter((p) => idsToRemove.has(p.id));

    setPages((prev) => prev.filter((p) => !idsToRemove.has(p.id)));

    // Best-effort: clean up any uploaded images so Storage doesn't accumulate
    // orphaned files forever. Doesn't block the deletion itself if it fails.
    removedPages.forEach((p) => {
      deleteUploadedImagesForBlocks(p.blocks).catch((e) =>
        console.error('Glenwyn: failed to clean up images for deleted page', e)
      );
    });
  };

  const emptyTrash = () => {
    const archived = pagesRef.current.filter((p) => p.isArchived);
    if (archived.length === 0) return;
    const ok = window.confirm(
      archived.length === 1
        ? 'Esto elimina para siempre la página de la papelera. No se puede deshacer. ¿Continuar?'
        : `Esto elimina para siempre las ${archived.length} páginas de la papelera. No se puede deshacer. ¿Continuar?`
    );
    if (!ok) return;

    const idsToRemove = new Set(archived.map((p) => p.id));
    setPages((prev) => prev.filter((p) => !idsToRemove.has(p.id)));

    archived.forEach((p) => {
      deleteUploadedImagesForBlocks(p.blocks).catch((e) =>
        console.error('Glenwyn: failed to clean up images while emptying trash', e)
      );
    });
  };

  const toggleExpanded = (id) => {
    setExpandedIds((prev) => ({ ...prev, [id]: prev[id] === false ? true : false }));
  };

  const handleDrop = (targetId, position) => {
    if (!dragId) return;
    setPages((prev) => movePage(prev, dragId, targetId, position));
    setDragId(null);
    setDropTarget(null);
  };

  const handleDropToRoot = () => {
    if (!dragId) return;
    setPages((prev) => movePageToRootEnd(prev, dragId));
    setDragId(null);
    setDropTarget(null);
  };

  const updateBlock = (pageId, blockId, content) => {
    setPages((prev) =>
      prev.map((p) =>
        p.id === pageId
          ? { ...p, blocks: p.blocks.map((b) => (b.id === blockId ? { ...b, content } : b)) }
          : p
      )
    );
  };

  const addBlock = (pageId, afterId, type = 'text') => {
    setPages((prev) =>
      prev.map((p) => {
        if (p.id !== pageId) return p;
        const idx = p.blocks.findIndex((b) => b.id === afterId);
        const newBlock = { id: uid(), type, content: '' };
        const blocks = [...p.blocks];
        blocks.splice(idx + 1, 0, newBlock);
        return { ...p, blocks };
      })
    );
  };

  // Ctrl/Cmd+D — clones a block (type, content, checked state) directly below itself.
  const duplicateBlock = (pageId, blockId) => {
    setPages((prev) =>
      prev.map((p) => {
        if (p.id !== pageId) return p;
        const idx = p.blocks.findIndex((b) => b.id === blockId);
        if (idx === -1) return p;
        const copy = { ...p.blocks[idx], id: uid() };
        const blocks = [...p.blocks];
        blocks.splice(idx + 1, 0, copy);
        return { ...p, blocks };
      })
    );
  };

  // Removes a block outright. A page can never end up with zero blocks — deleting
  // the last one resets it to a single empty paragraph instead of vanishing.
  // Best-effort: also moves focus to the previous block's input, if we have a ref for it.
  const deleteBlock = (pageId, blockId) => {
    const page = pages.find((p) => p.id === pageId);
    const idx = page ? page.blocks.findIndex((b) => b.id === blockId) : -1;
    const prevBlock = page && idx > 0 ? page.blocks[idx - 1] : null;

    setPages((prev) =>
      prev.map((p) => {
        if (p.id !== pageId) return p;
        if (p.blocks.length <= 1) {
          return { ...p, blocks: [{ id: uid(), type: 'text', content: '' }] };
        }
        return { ...p, blocks: p.blocks.filter((b) => b.id !== blockId) };
      })
    );

    if (prevBlock) {
      const node = blockRefs.current[prevBlock.id];
      if (node) {
        requestAnimationFrame(() => {
          node.focus();
          if (typeof node.setSelectionRange === 'function') {
            const len = node.value.length;
            node.setSelectionRange(len, len);
          }
        });
      }
    }
  };

  const toggleTodo = (pageId, blockId) => {
    setPages((prev) =>
      prev.map((p) =>
        p.id === pageId
          ? {
              ...p,
              blocks: p.blocks.map((b) => {
                if (b.id !== blockId) return b;
                const willBeChecked = !b.checked;
                // Checking off a recurring task rolls its due date forward instead
                // of leaving it marked done forever — same idea as Todoist.
                if (willBeChecked && b.recurrence && b.dueDate) {
                  return { ...b, checked: false, dueDate: computeNextDueDate(b.dueDate, b.recurrence) };
                }
                return { ...b, checked: willBeChecked };
              }),
            }
          : p
      )
    );
  };

  const updateTodoDueDate = (pageId, blockId, dueDate) => {
    setPages((prev) =>
      prev.map((p) =>
        p.id === pageId
          ? { ...p, blocks: p.blocks.map((b) => (b.id === blockId ? { ...b, dueDate } : b)) }
          : p
      )
    );
  };

  // Cycles a task through no-priority → high → medium → low → back to none.
  const cycleTodoPriority = (pageId, blockId) => {
    setPages((prev) =>
      prev.map((p) =>
        p.id === pageId
          ? {
              ...p,
              blocks: p.blocks.map((b) => {
                if (b.id !== blockId) return b;
                const next = { 1: 2, 2: 3, 3: null }[b.priority] ?? 1;
                return { ...b, priority: next };
              }),
            }
          : p
      )
    );
  };

  const updateTodoRecurrence = (pageId, blockId, recurrence) => {
    setPages((prev) =>
      prev.map((p) =>
        p.id === pageId
          ? { ...p, blocks: p.blocks.map((b) => (b.id === blockId ? { ...b, recurrence } : b)) }
          : p
      )
    );
  };

  // The toggle block keeps its hidden text in `body` and its expand/collapse state in `open`,
  // separate from `content` (which is the always-visible summary line).
  const updateToggleBody = (pageId, blockId, body) => {
    setPages((prev) =>
      prev.map((p) =>
        p.id === pageId
          ? { ...p, blocks: p.blocks.map((b) => (b.id === blockId ? { ...b, body } : b)) }
          : p
      )
    );
  };

  const toggleOpen = (pageId, blockId) => {
    setPages((prev) =>
      prev.map((p) =>
        p.id === pageId
          ? {
              ...p,
              blocks: p.blocks.map((b) =>
                b.id === blockId ? { ...b, open: b.open === false ? true : false } : b
              ),
            }
          : p
      )
    );
  };

  // Image blocks keep the URL separate from `content` (which is used as the caption).
  const updateImageUrl = (pageId, blockId, url) => {
    setPages((prev) =>
      prev.map((p) =>
        p.id === pageId
          ? { ...p, blocks: p.blocks.map((b) => (b.id === blockId ? { ...b, url } : b)) }
          : p
      )
    );
  };

  // Uploads a file to Supabase Storage and, on success, sets it as the image block's URL.
  // Left to throw on failure — the ImageBlock component catches it to show an inline error.
  const uploadImageFile = async (pageId, blockId, file) => {
    const url = await uploadImage(file, user.id);
    updateImageUrl(pageId, blockId, url);
  };

  // Embed blocks also keep their URL in `url` (same field name, different block type).
  const updateEmbedUrl = (pageId, blockId, url) => {
    setPages((prev) =>
      prev.map((p) =>
        p.id === pageId
          ? { ...p, blocks: p.blocks.map((b) => (b.id === blockId ? { ...b, url } : b)) }
          : p
      )
    );
  };

  const setPageLink = (pageId, blockId, linkedPageId) => {
    setPages((prev) =>
      prev.map((p) =>
        p.id === pageId
          ? { ...p, blocks: p.blocks.map((b) => (b.id === blockId ? { ...b, linkedPageId } : b)) }
          : p
      )
    );
  };

  // Table blocks store their grid as `rows`: an array of arrays of cell strings.
  const updateTableCell = (pageId, blockId, r, c, value) => {
    setPages((prev) =>
      prev.map((p) =>
        p.id === pageId
          ? {
              ...p,
              blocks: p.blocks.map((b) => {
                if (b.id !== blockId) return b;
                const rows = b.rows.map((row) => [...row]);
                rows[r][c] = value;
                return { ...b, rows };
              }),
            }
          : p
      )
    );
  };

  const addTableRow = (pageId, blockId) => {
    setPages((prev) =>
      prev.map((p) =>
        p.id === pageId
          ? {
              ...p,
              blocks: p.blocks.map((b) => {
                if (b.id !== blockId) return b;
                const cols = b.rows[0]?.length || 2;
                return { ...b, rows: [...b.rows, Array(cols).fill('')] };
              }),
            }
          : p
      )
    );
  };

  const addTableColumn = (pageId, blockId) => {
    setPages((prev) =>
      prev.map((p) =>
        p.id === pageId
          ? {
              ...p,
              blocks: p.blocks.map((b) =>
                b.id === blockId ? { ...b, rows: b.rows.map((row) => [...row, '']) } : b
              ),
            }
          : p
      )
    );
  };

  const removeTableRow = (pageId, blockId, r) => {
    setPages((prev) =>
      prev.map((p) =>
        p.id === pageId
          ? {
              ...p,
              blocks: p.blocks.map((b) => {
                if (b.id !== blockId || b.rows.length <= 1) return b;
                return { ...b, rows: b.rows.filter((_, i) => i !== r) };
              }),
            }
          : p
      )
    );
  };

  const removeTableColumn = (pageId, blockId, c) => {
    setPages((prev) =>
      prev.map((p) =>
        p.id === pageId
          ? {
              ...p,
              blocks: p.blocks.map((b) => {
                if (b.id !== blockId || (b.rows[0]?.length || 0) <= 1) return b;
                return { ...b, rows: b.rows.map((row) => row.filter((_, i) => i !== c)) };
              }),
            }
          : p
      )
    );
  };

  // Converts a block's type in place — used by both the "/" command menu and markdown shortcuts.
  const convertBlock = (pageId, blockId, newType, newContent = '', extra = {}) => {
    setPages((prev) =>
      prev.map((p) =>
        p.id === pageId
          ? {
              ...p,
              blocks: p.blocks.map((b) => {
                if (b.id !== blockId) return b;
                // Strip fields that only make sense for specific types, so converting
                // away and later back to the same type never resurrects stale data
                // (e.g. an old image URL reappearing on a block that's now text).
                // eslint-disable-next-line no-unused-vars
                const { url, rows, body, open, linkedPageId, dueDate, priority, recurrence, ...rest } = b;
                return {
                  ...rest,
                  type: newType,
                  content: newContent,
                  checked: newType === 'todo' ? false : b.checked,
                  ...extra,
                };
              }),
            }
          : p
      )
    );
  };

  // Archived pages never appear in the live tree, search, or quick switcher.
  // Memoized: these otherwise recompute on *every* render — including ones triggered
  // by unrelated state like opening a modal, dragging, or toggling dark mode.
  const livePages = useMemo(() => pages.filter((p) => !p.isArchived), [pages]);
  const archivedPages = useMemo(
    () => pages.filter((p) => p.isArchived).sort((a, b) => (b.archivedAt || 0) - (a.archivedAt || 0)),
    [pages]
  );

  // Favoritos — flat, regardless of where the page lives in the hierarchy.
  const pinnedPages = useMemo(() => livePages.filter((p) => p.pinned), [livePages]);

  // While searching, show a flat match list (hierarchy doesn't matter for search).
  // Matches title OR any text inside the page's blocks.
  const filteredPages = useMemo(
    () => (searchQuery ? livePages.filter((p) => pageMatchesQuery(p, searchQuery)) : livePages),
    [searchQuery, livePages]
  );

  // Otherwise, render the actual nested tree, respecting collapsed branches.
  const visibleTree = useMemo(
    () => (searchQuery ? null : buildVisibleTree(livePages, expandedIds, sortMode)),
    [searchQuery, livePages, expandedIds, sortMode]
  );

  if (!loaded) {
    return (
      <div
        style={{
          height: '100vh',
          background: t.canvas,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: bodyFont,
          color: t.fern,
          transition: 'background-color 150ms ease, color 150ms ease',
        }}
      >
        cargando tu espacio…
      </div>
    );
  }

  return (
    <div
      style={{
        height: '100vh',
        width: '100%',
        display: 'flex',
        background: t.canvas,
        color: t.bark,
        fontFamily: bodyFont,
        transition: 'background-color 150ms ease, color 150ms ease',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Fonts */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Public+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; }
        .glenwyn-scroll::-webkit-scrollbar { width: 6px; }
        .glenwyn-scroll::-webkit-scrollbar-thumb { background: ${t.clay}; border-radius: 3px; }
        .glenwyn-page-actions { opacity: 0; transition: opacity 120ms ease; }
        .glenwyn-page-row:hover .glenwyn-page-actions { opacity: 1; }
        .glenwyn-divider-row:hover .glenwyn-divider-delete { opacity: 1; }
        .glenwyn-media-row:hover .glenwyn-media-delete { opacity: 1; }
        textarea.glenwyn-block { resize: none; }
        /* :focus-visible (used elsewhere in the app) mostly only fires on keyboard
           navigation — for the actual writing area, people click in with the mouse far
           more often, so this uses plain :focus instead, on purpose. inset box-shadow
           draws entirely inside the existing box, so it never shifts the text. */
        textarea.glenwyn-block:focus {
          outline: none;
          box-shadow: inset 3px 0 0 0 ${t.moss};
          border-radius: 3px;
        }
        .glenwyn-focus:focus-visible { outline: 2px solid ${t.moss} !important; outline-offset: 2px; }
        /* Devices whose primary input has no hover (touch) never get a hover state to
           reveal these actions with — so show them all the time there instead. */
        @media (hover: none) {
          .glenwyn-page-actions,
          .glenwyn-divider-delete,
          .glenwyn-media-delete {
            opacity: 1 !important;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          * { transition: none !important; }
        }
        @media (max-width: 640px) {
          .glenwyn-sidebar {
            position: fixed;
            top: 0;
            bottom: 0;
            left: 0;
            width: min(82vw, 280px) !important;
            z-index: 9;
            box-shadow: 4px 0 24px rgba(0,0,0,0.2);
            transition: transform 200ms ease;
          }
          .glenwyn-sidebar.glenwyn-sidebar-closed {
            transform: translateX(-100%);
          }
          .glenwyn-canvas-content {
            padding-left: 20px !important;
            padding-right: 20px !important;
          }
          .glenwyn-topbar {
            padding-left: 16px !important;
            padding-right: 16px !important;
          }
        }
      `}</style>

      {/* Backdrop behind the sidebar drawer on narrow screens — tapping it closes the drawer. */}
      {isNarrow && sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(20,20,15,0.35)', zIndex: 9 }}
        />
      )}

      {/* ---- Sidebar ---- */}
      <div
        className={`glenwyn-sidebar${!sidebarOpen ? ' glenwyn-sidebar-closed' : ''}`}
        style={{
          width: sidebarOpen ? 240 : 56,
          background: t.sidebarBg,
          borderRight: `1px solid ${t.clay}`,
          transition: 'width 200ms ease, background-color 150ms ease',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: sidebarOpen ? 'space-between' : 'center',
            padding: sidebarOpen ? '16px 12px 8px' : '16px 0 8px',
          }}
        >
          {sidebarOpen && (
            <span
              style={{
                fontFamily: displayFont,
                fontWeight: 600,
                fontSize: 17,
                letterSpacing: '-0.01em',
                color: t.moss,
              }}
            >
              Glenwyn
            </span>
          )}
          <button
            className="glenwyn-focus"
            onClick={() => setSidebarOpen((s) => !s)}
            title={sidebarOpen ? 'Colapsar (⌘\\)' : 'Expandir (⌘\\)'}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: t.fern,
              padding: 6,
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M2 3h12M2 8h12M2 13h12"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <div
          className="glenwyn-scroll"
          style={{ flex: 1, overflowY: 'auto', padding: sidebarOpen ? '4px 8px' : '4px 4px' }}
          onDragOver={(e) => sidebarOpen && e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (sidebarOpen) handleDropToRoot();
          }}
        >
          {!searchQuery && (
            <div
              role="button"
              tabIndex={0}
              className="glenwyn-focus"
              onClick={() => {
                setTasksViewOpen(true);
                if (isNarrow) setSidebarOpen(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setTasksViewOpen(true);
                  if (isNarrow) setSidebarOpen(false);
                }
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: sidebarOpen ? 'space-between' : 'center',
                gap: 8,
                padding: '7px 8px',
                borderRadius: 7,
                cursor: 'pointer',
                background: tasksViewOpen ? t.clay : 'transparent',
                fontSize: 13.5,
                color: tasksViewOpen ? t.bark : t.fern,
                marginBottom: 6,
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 14 }}>✓</span>
                {sidebarOpen && <span>Mis tareas</span>}
              </span>
              {sidebarOpen && allTasks.filter((tsk) => !tsk.checked && tsk.dueDate <= today).length > 0 && (
                <span
                  style={{
                    fontSize: 11,
                    fontFamily: monoFont,
                    color: t.fern,
                    background: t.clay,
                    borderRadius: 10,
                    padding: '1px 6px',
                  }}
                >
                  {allTasks.filter((tsk) => !tsk.checked && tsk.dueDate <= today).length}
                </span>
              )}
            </div>
          )}
          {!searchQuery && sidebarOpen && pinnedPages.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div
                style={{
                  fontSize: 10.5,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  color: t.fern,
                  padding: '4px 8px',
                  fontFamily: monoFont,
                }}
              >
                Favoritos
              </div>
              {pinnedPages.map((p) => (
                <div
                  key={p.id}
                  role="button"
                  tabIndex={0}
                  aria-current={p.id === activeId ? 'page' : undefined}
                  className="glenwyn-focus"
                  onClick={() => selectPage(p.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      selectPage(p.id);
                    }
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 8px',
                    borderRadius: 7,
                    cursor: 'pointer',
                    background: p.id === activeId ? t.clay : 'transparent',
                    fontSize: 13.5,
                    color: p.id === activeId ? t.bark : t.fern,
                  }}
                >
                  <span style={{ fontSize: 12.5 }}>⭐</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.title || 'Sin título'}
                  </span>
                </div>
              ))}
              <div style={{ height: 1, background: t.clay, margin: '6px 4px 2px' }} />
            </div>
          )}
          {!searchQuery && sidebarOpen && (
            <button
              className="glenwyn-focus"
              onClick={() =>
                setSortMode((m) => (m === 'manual' ? 'alphabetical' : m === 'alphabetical' ? 'updated' : 'manual'))
              }
              title="Cambiar el orden de las páginas"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: t.fern,
                fontSize: 10.5,
                fontFamily: monoFont,
                padding: '2px 8px 6px',
              }}
            >
              <span>⇅</span>
              <span>
                {sortMode === 'manual' ? 'orden manual' : sortMode === 'alphabetical' ? 'alfabético' : 'recientes primero'}
              </span>
            </button>
          )}
          {searchQuery
            ? filteredPages.map((p) => (
                <div
                  key={p.id}
                  role="button"
                  tabIndex={0}
                  aria-current={p.id === activeId ? 'page' : undefined}
                  className="glenwyn-focus"
                  onClick={() => selectPage(p.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      selectPage(p.id);
                    }
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '7px 8px',
                    borderRadius: 7,
                    cursor: 'pointer',
                    background: p.id === activeId ? t.clay : 'transparent',
                    fontSize: 13.5,
                    color: p.id === activeId ? t.bark : t.fern,
                  }}
                >
                  <span style={{ fontSize: 14 }}>{p.icon || '📄'}</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.title || 'Sin título'}
                  </span>
                  {!(p.title || '').toLowerCase().includes(searchQuery.toLowerCase()) && (
                    <span style={{ fontSize: 10.5, color: t.fern, opacity: 0.7, flexShrink: 0 }}>en el contenido</span>
                  )}
                </div>
              ))
            : visibleTree.map(({ page: p, depth, hasChildren, isExpanded }) => (
                <PageRow
                  key={p.id}
                  page={p}
                  depth={depth}
                  hasChildren={hasChildren}
                  isExpanded={isExpanded}
                  t={t}
                  sidebarOpen={sidebarOpen}
                  isActive={p.id === activeId}
                  isDragging={dragId === p.id}
                  dropTarget={dropTarget}
                  dragEnabled={sortMode === 'manual'}
                  onClick={() => selectPage(p.id)}
                  onToggleExpand={(e) => {
                    e.stopPropagation();
                    toggleExpanded(p.id);
                  }}
                  onDelete={(e) => {
                    e.stopPropagation();
                    archivePage(p.id);
                  }}
                  onAddSubpage={(e) => {
                    e.stopPropagation();
                    createPage(p.id);
                  }}
                  onTogglePin={(e) => {
                    e.stopPropagation();
                    togglePin(p.id);
                  }}
                  onDuplicate={(e) => {
                    e.stopPropagation();
                    duplicatePage(p.id);
                  }}
                  onSetIcon={(icon) => setPageIcon(p.id, icon)}
                  onDragStart={() => setDragId(p.id)}
                  onDragEnd={() => {
                    setDragId(null);
                    setDropTarget(null);
                  }}
                  onDragOverRow={(position) => setDropTarget({ id: p.id, position })}
                  onDropRow={(position) => handleDrop(p.id, position)}
                />
              ))}
          {/* Drop zone below the list: drag here to move a page back to the root level */}
          {sidebarOpen && dragId && (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                handleDropToRoot();
              }}
              style={{ height: 24 }}
            />
          )}
        </div>

        <div style={{ padding: sidebarOpen ? '8px' : '8px 4px', borderTop: `1px solid ${t.clay}`, position: 'relative' }}>
          {templateMenuOpen && sidebarOpen && (
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'absolute',
                bottom: '100%',
                left: 8,
                marginBottom: 6,
                width: 230,
                background: t.canvas,
                border: `1px solid ${t.clay}`,
                borderRadius: 8,
                boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
                overflow: 'hidden',
                zIndex: 6,
              }}
            >
              {PAGE_TEMPLATES.map((tpl) => (
                <div
                  key={tpl.id}
                  onClick={() => {
                    createPage(null, tpl.id);
                    setTemplateMenuOpen(false);
                  }}
                  style={{ display: 'flex', gap: 9, alignItems: 'center', padding: '8px 10px', cursor: 'pointer' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = t.clay)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <span style={{ fontSize: 14 }}>{tpl.icon}</span>
                  <span>
                    <div style={{ fontSize: 12.5, color: t.bark }}>{tpl.label}</div>
                    <div style={{ fontSize: 10.5, color: t.fern }}>{tpl.desc}</div>
                  </span>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: sidebarOpen ? 2 : 0 }}>
            <button
              className="glenwyn-focus"
              onClick={() => createPage(null)}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: sidebarOpen ? 'flex-start' : 'center',
                gap: 8,
                padding: '7px 8px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: t.fern,
                fontSize: 13.5,
                borderRadius: 7,
              }}
            >
              <span style={{ fontSize: 15 }}>+</span>
              {sidebarOpen && <span>Nueva página</span>}
            </button>
            {sidebarOpen && (
              <button
                className="glenwyn-focus"
                onClick={() => setTemplateMenuOpen((o) => !o)}
                title="Nueva página desde una plantilla"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: t.fern,
                  fontSize: 11,
                  padding: '7px 8px',
                  borderRadius: 7,
                }}
              >
                ▾
              </button>
            )}
          </div>
          <button
            className="glenwyn-focus"
            onClick={() => setDark((d) => !d)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: sidebarOpen ? 'flex-start' : 'center',
              gap: 8,
              padding: '7px 8px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: t.fern,
              fontSize: 13.5,
              borderRadius: 7,
            }}
          >
            <span style={{ fontSize: 14 }}>{dark ? '☾' : '☀'}</span>
            {sidebarOpen && <span>{dark ? 'Modo claro' : 'Modo oscuro'}</span>}
          </button>
          <button
            className="glenwyn-focus"
            onClick={() => setShortcutsOpen(true)}
            title="Atajos de teclado"
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: sidebarOpen ? 'flex-start' : 'center',
              gap: 8,
              padding: '7px 8px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: t.fern,
              fontSize: 13.5,
              borderRadius: 7,
            }}
          >
            <span style={{ fontSize: 14 }}>⌨</span>
            {sidebarOpen && <span>Atajos de teclado</span>}
          </button>
          <a
            href="/guia.html"
            target="_blank"
            rel="noopener noreferrer"
            className="glenwyn-focus"
            title="Guía de uso"
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: sidebarOpen ? 'flex-start' : 'center',
              gap: 8,
              padding: '7px 8px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: t.fern,
              fontSize: 13.5,
              borderRadius: 7,
              textDecoration: 'none',
            }}
          >
            <span style={{ fontSize: 14 }}>📖</span>
            {sidebarOpen && <span>Guía de uso</span>}
          </a>
          <button
            className="glenwyn-focus"
            onClick={() => setTrashOpen(true)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: sidebarOpen ? 'space-between' : 'center',
              gap: 8,
              padding: '7px 8px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: t.fern,
              fontSize: 13.5,
              borderRadius: 7,
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 14 }}>🗑</span>
              {sidebarOpen && <span>Papelera</span>}
            </span>
            {sidebarOpen && archivedPages.length > 0 && (
              <span
                style={{
                  fontSize: 11,
                  fontFamily: monoFont,
                  color: t.fern,
                  background: t.clay,
                  borderRadius: 10,
                  padding: '1px 6px',
                }}
              >
                {archivedPages.length}
              </span>
            )}
          </button>
          <button
            className="glenwyn-focus"
            onClick={() => supabase.auth.signOut()}
            title={user.email || user.phone || 'Tu cuenta'}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: sidebarOpen ? 'flex-start' : 'center',
              gap: 8,
              padding: '7px 8px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: t.fern,
              fontSize: 12.5,
              borderRadius: 7,
              marginTop: 2,
              borderTop: sidebarOpen ? `1px solid ${t.clay}` : 'none',
              paddingTop: 10,
            }}
          >
            <span style={{ fontSize: 13 }}>⎋</span>
            {sidebarOpen && (
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                Cerrar sesión · {user.email || user.phone || 'tu cuenta'}
              </span>
            )}
          </button>
        </div>
      </div>
      <div
        style={{
          flex: 1,
          position: 'relative',
          overflow: 'hidden',
          backgroundImage:
            'radial-gradient(circle at 1px 1px, rgba(120,120,90,0.05) 1px, transparent 0)',
          backgroundSize: '18px 18px',
        }}
      >
        {/* Top bar: breadcrumb + save state */}
        <div
          className="glenwyn-topbar"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 28px',
            fontSize: 12.5,
            color: t.fern,
            fontFamily: monoFont,
            zIndex: 2,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden', minWidth: 0 }}>
            {isNarrow && !sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(true)}
                title="Abrir el menú"
                className="glenwyn-focus"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: t.fern,
                  fontSize: 15,
                  padding: 2,
                  flexShrink: 0,
                }}
              >
                ☰
              </button>
            )}
            {breadcrumbChain.map((ancestor) => (
              <span key={ancestor.id} style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                <span
                  onClick={() => setActiveId(ancestor.id)}
                  style={{ cursor: 'pointer', opacity: 0.7 }}
                  onMouseEnter={(e) => (e.currentTarget.style.opacity = 1)}
                  onMouseLeave={(e) => (e.currentTarget.style.opacity = 0.7)}
                >
                  {ancestor.icon || '📄'} {ancestor.title || 'Sin título'}
                </span>
                <span style={{ opacity: 0.4 }}>/</span>
              </span>
            ))}
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
              {tasksViewOpen ? '✓ Mis tareas' : activePage ? activePage.title || 'Sin título' : ''}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, position: 'relative' }}>
            {!isNarrow && !tasksViewOpen && activePage && (
              <>
                <button
                  onClick={() => {
                    setShareError('');
                    setShareCopied(false);
                    setShareOpen(true);
                  }}
                  title="Compartir esta página"
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: activePage.shareToken ? t.moss : t.fern,
                    fontSize: 12.5,
                    fontFamily: monoFont,
                    padding: 0,
                  }}
                >
                  🔗 {activePage.shareToken ? 'compartida' : 'compartir'}
                </button>
                <button
                  onClick={() => exportPageAsMarkdown(activePage)}
                  title="Exportar a Markdown"
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: t.fern,
                    fontSize: 12.5,
                    fontFamily: monoFont,
                    padding: 0,
                  }}
                >
                  ⬇ exportar
                </button>
                <button
                  onClick={() => openHistory(activePage.id)}
                  title="Ver historial de versiones"
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: t.fern,
                    fontSize: 12.5,
                    fontFamily: monoFont,
                    padding: 0,
                  }}
                >
                  ⟲ historial
                </button>
                <span style={{ color: t.fern, opacity: 0.7 }}>{countWords(activePage)} palabras</span>
              </>
            )}

            {/* En pantallas angostas, compartir/exportar/historial/palabras se juntan en un
                solo menú — mostrarlos todos sueltos es lo que causaba que se amontonaran y
                se superpusieran con el indicador de guardado. */}
            {isNarrow && !tasksViewOpen && activePage && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setTopbarMenuOpen((o) => !o);
                }}
                title="Más acciones"
                aria-label="Más acciones"
                className="glenwyn-focus"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: t.fern,
                  fontSize: 18,
                  width: 32,
                  height: 32,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                ⋯
              </button>
            )}
            {isNarrow && topbarMenuOpen && activePage && (
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: 6,
                  width: 180,
                  background: t.canvas,
                  border: `1px solid ${t.clay}`,
                  borderRadius: 8,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
                  zIndex: 6,
                  overflow: 'hidden',
                }}
              >
                <button
                  onClick={() => {
                    setShareError('');
                    setShareCopied(false);
                    setShareOpen(true);
                    setTopbarMenuOpen(false);
                  }}
                  style={topbarMenuItemStyle(t)}
                >
                  🔗 {activePage.shareToken ? 'Compartida' : 'Compartir'}
                </button>
                <button
                  onClick={() => {
                    exportPageAsMarkdown(activePage);
                    setTopbarMenuOpen(false);
                  }}
                  style={topbarMenuItemStyle(t)}
                >
                  ⬇ Exportar
                </button>
                <button
                  onClick={() => {
                    openHistory(activePage.id);
                    setTopbarMenuOpen(false);
                  }}
                  style={topbarMenuItemStyle(t)}
                >
                  ⟲ Historial
                </button>
                <div style={{ padding: '8px 12px', fontSize: 12, color: t.fern, borderTop: `1px solid ${t.clay}` }}>
                  {countWords(activePage)} palabras
                </div>
              </div>
            )}

            {/* Estado de guardado: texto completo en desktop, un punto de color compacto en
                mobile (el mensaje de error largo era exactamente lo que se superponía antes). */}
            {!isNarrow ? (
              <span
                style={{
                  opacity: saveError || saveState !== 'idle' ? 0.8 : 0,
                  transition: 'opacity 300ms ease',
                  color: saveError ? t.error : t.fern,
                }}
              >
                {saveError || (saveState === 'saving' ? 'guardando…' : saveState === 'saved' ? 'guardado' : '')}
              </span>
            ) : (
              (saveError || saveState !== 'idle') && (
                <span
                  title={saveError || (saveState === 'saving' ? 'Guardando…' : 'Guardado')}
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: saveError ? t.error : saveState === 'saving' ? t.sun : t.moss,
                    flexShrink: 0,
                  }}
                />
              )
            )}
          </div>
        </div>

        <div
          className="glenwyn-scroll glenwyn-canvas-content"
          style={{
            height: '100%',
            overflowY: 'auto',
            display: 'flex',
            justifyContent: 'center',
            padding: '64px 32px 120px',
          }}
        >
          <div style={{ width: '100%', maxWidth: 720 }}>
            {tasksViewOpen ? (
              <TasksView
                t={t}
                tasks={allTasks}
                today={today}
                onToggle={(pageId, blockId) => toggleTodo(pageId, blockId)}
                onOpenPage={(pageId) => selectPage(pageId)}
              />
            ) : !activePage ? (
              <EmptyState t={t} onCreate={() => createPage(null)} />
            ) : (
              <>
                <div style={{ position: 'relative', display: 'inline-block', marginBottom: 8 }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setTitleIconPickerOpen((o) => !o);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: 34,
                      padding: 0,
                      lineHeight: 1,
                    }}
                    title="Cambiar el ícono de la página"
                  >
                    {activePage.icon || '📄'}
                  </button>
                  {titleIconPickerOpen && (
                    <IconPicker
                      t={t}
                      current={activePage.icon}
                      onPick={(icon) => {
                        setPageIcon(activePage.id, icon);
                        setTitleIconPickerOpen(false);
                      }}
                    />
                  )}
                </div>
                <input
                  className="glenwyn-focus"
                  value={activePage.title}
                  onChange={(e) => renamePage(activePage.id, e.target.value)}
                  placeholder="Sin título"
                  style={{
                    width: '100%',
                    border: 'none',
                    background: 'transparent',
                    fontFamily: displayFont,
                    fontWeight: 600,
                    fontSize: 34,
                    color: t.bark,
                    marginBottom: 28,
                    outline: 'none',
                  }}
                />
                {activePage.blocks.map((b, i) => (
                  <Block
                    key={b.id}
                    block={b}
                    t={t}
                    listNumber={b.type === 'numbered' ? numberedListPosition(activePage.blocks, i) : null}
                    onChange={(content) => updateBlock(activePage.id, b.id, content)}
                    onEnter={(nextType) => addBlock(activePage.id, b.id, nextType)}
                    onToggle={() => toggleTodo(activePage.id, b.id)}
                    onDueDateChange={(dueDate) => updateTodoDueDate(activePage.id, b.id, dueDate)}
                    onCyclePriority={() => cycleTodoPriority(activePage.id, b.id)}
                    onRecurrenceChange={(recurrence) => updateTodoRecurrence(activePage.id, b.id, recurrence)}
                    onConvert={(newType, newContent, extra) => convertBlock(activePage.id, b.id, newType, newContent, extra)}
                    onDuplicate={() => duplicateBlock(activePage.id, b.id)}
                    onToggleBodyChange={(body) => updateToggleBody(activePage.id, b.id, body)}
                    onToggleOpen={() => toggleOpen(activePage.id, b.id)}
                    onImageUrlChange={(url) => updateImageUrl(activePage.id, b.id, url)}
                    onUploadFile={(file) => uploadImageFile(activePage.id, b.id, file)}
                    onEmbedUrlChange={(url) => updateEmbedUrl(activePage.id, b.id, url)}
                    allPages={livePages}
                    onNavigate={(id) => setActiveId(id)}
                    onSetPageLink={(linkedPageId) => setPageLink(activePage.id, b.id, linkedPageId)}
                    onTableCellChange={(r, c, value) => updateTableCell(activePage.id, b.id, r, c, value)}
                    onTableAddRow={() => addTableRow(activePage.id, b.id)}
                    onTableAddColumn={() => addTableColumn(activePage.id, b.id)}
                    onTableRemoveRow={(r) => removeTableRow(activePage.id, b.id, r)}
                    onTableRemoveColumn={(c) => removeTableColumn(activePage.id, b.id, c)}
                    onDelete={() => deleteBlock(activePage.id, b.id)}
                    registerRef={registerBlockRef(b.id)}
                  />
                ))}
                {backlinks.length > 0 && (
                  <div style={{ marginTop: 48, paddingTop: 20, borderTop: `1px solid ${t.clay}` }}>
                    <div
                      style={{
                        fontSize: 11,
                        letterSpacing: '0.04em',
                        textTransform: 'uppercase',
                        color: t.fern,
                        fontFamily: monoFont,
                        marginBottom: 10,
                      }}
                    >
                      {backlinks.length === 1 ? '1 página te menciona' : `${backlinks.length} páginas te mencionan`}
                    </div>
                    {backlinks.map((p) => (
                      <div
                        key={p.id}
                        role="button"
                        tabIndex={0}
                        className="glenwyn-focus"
                        onClick={() => selectPage(p.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            selectPage(p.id);
                          }
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '8px 10px',
                          borderRadius: 7,
                          cursor: 'pointer',
                          fontSize: 13.5,
                          color: t.bark,
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = t.clay)}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <span>{p.icon || '📄'}</span>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {p.title || 'Sin título'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* ---- Quick search ---- */}
      {searchOpen && (
        <div
          onClick={() => setSearchOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(20,20,15,0.35)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            paddingTop: '15vh',
            zIndex: 10,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Buscar página"
            style={{
              width: 480,
              maxWidth: '90vw',
              background: t.canvas,
              border: `1px solid ${t.clay}`,
              borderRadius: 10,
              boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
              overflow: 'hidden',
            }}
          >
            <input
              className="glenwyn-focus"
              ref={searchInputRef}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar una página…"
              style={{
                width: '100%',
                border: 'none',
                outline: 'none',
                background: 'transparent',
                padding: '14px 16px',
                fontSize: 15,
                color: t.bark,
                fontFamily: bodyFont,
                borderBottom: `1px solid ${t.clay}`,
              }}
            />
            <div style={{ maxHeight: 280, overflowY: 'auto' }}>
              {filteredPages.length === 0 && (
                <div style={{ padding: 16, fontSize: 13, color: t.fern }}>
                  no encontramos ninguna página
                </div>
              )}
              {filteredPages.map((p) => (
                <div
                  key={p.id}
                  role="button"
                  tabIndex={0}
                  className="glenwyn-focus"
                  onClick={() => {
                    setActiveId(p.id);
                    setSearchOpen(false);
                    setSearchQuery('');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setActiveId(p.id);
                      setSearchOpen(false);
                      setSearchQuery('');
                    }
                  }}
                  style={{
                    padding: '10px 16px',
                    fontSize: 13.5,
                    color: t.bark,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = t.clay)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <span>{p.icon || '📄'}</span>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.title || 'Sin título'}
                  </span>
                  {!(p.title || '').toLowerCase().includes(searchQuery.toLowerCase()) && (
                    <span style={{ fontSize: 10.5, color: t.fern, opacity: 0.7, flexShrink: 0 }}>en el contenido</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ---- Trash panel ---- */}
      {trashOpen && (
        <div
          onClick={() => setTrashOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(20,20,15,0.35)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            paddingTop: '12vh',
            zIndex: 10,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Papelera"
            style={{
              width: 460,
              maxWidth: '90vw',
              maxHeight: '65vh',
              display: 'flex',
              flexDirection: 'column',
              background: t.canvas,
              border: `1px solid ${t.clay}`,
              borderRadius: 10,
              boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '14px 16px',
                borderBottom: `1px solid ${t.clay}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
              }}
            >
              <div>
                <div style={{ fontFamily: displayFont, fontSize: 17, fontWeight: 600, color: t.bark }}>
                  Papelera
                </div>
                <div style={{ fontSize: 11, color: t.fern, fontFamily: monoFont, marginTop: 2 }}>
                  se eliminan solas a los 30 días
                </div>
              </div>
              {archivedPages.length > 0 && (
                <button
                  onClick={emptyTrash}
                  className="glenwyn-focus"
                  style={{
                    fontSize: 12,
                    color: t.error,
                    background: 'none',
                    border: `1px solid ${t.error}`,
                    borderRadius: 6,
                    padding: '4px 8px',
                    cursor: 'pointer',
                    flexShrink: 0,
                    whiteSpace: 'nowrap',
                  }}
                >
                  Vaciar papelera
                </button>
              )}
            </div>
            <div className="glenwyn-scroll" style={{ overflowY: 'auto' }}>
              {archivedPages.length === 0 ? (
                <div style={{ padding: 24, textAlign: 'center', fontSize: 13, color: t.fern }}>
                  La papelera está vacía.
                </div>
              ) : (
                archivedPages.map((p) => (
                  <div
                    key={p.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 10,
                      padding: '10px 16px',
                      borderBottom: `1px solid ${t.clay}`,
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 13.5,
                          color: t.bark,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        📄 {p.title || 'Sin título'}
                      </div>
                      <div style={{ fontSize: 11, color: t.fern, marginTop: 2 }}>
                        eliminada el {new Date(p.archivedAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button
                        onClick={() => restorePage(p.id)}
                        style={{
                          fontSize: 12,
                          color: t.moss,
                          background: 'none',
                          border: `1px solid ${t.moss}`,
                          borderRadius: 6,
                          padding: '4px 8px',
                          cursor: 'pointer',
                        }}
                      >
                        Restaurar
                      </button>
                      <button
                        onClick={() => permanentlyDeletePage(p.id)}
                        title="Eliminar para siempre"
                        style={{
                          fontSize: 12,
                          color: t.fern,
                          background: 'none',
                          border: 'none',
                          padding: '4px 6px',
                          cursor: 'pointer',
                        }}
                      >
                        Eliminar para siempre
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ---- Version history panel ---- */}
      {historyOpen && activePage && (
        <div
          onClick={() => setHistoryOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(20,20,15,0.35)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            paddingTop: '12vh',
            zIndex: 10,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Historial de versiones"
            style={{
              width: 460,
              maxWidth: '90vw',
              maxHeight: '65vh',
              display: 'flex',
              flexDirection: 'column',
              background: t.canvas,
              border: `1px solid ${t.clay}`,
              borderRadius: 10,
              boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '14px 16px',
                borderBottom: `1px solid ${t.clay}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span style={{ fontFamily: displayFont, fontSize: 17, fontWeight: 600, color: t.bark }}>
                Historial
              </span>
              <button
                onClick={() => saveVersionNow(activePage)}
                style={{
                  fontSize: 12,
                  color: t.moss,
                  background: 'none',
                  border: `1px solid ${t.moss}`,
                  borderRadius: 6,
                  padding: '4px 8px',
                  cursor: 'pointer',
                }}
              >
                Guardar versión ahora
              </button>
            </div>
            <div className="glenwyn-scroll" style={{ overflowY: 'auto' }}>
              {historyLoading ? (
                <div style={{ padding: 24, textAlign: 'center', fontSize: 13, color: t.fern }}>Cargando…</div>
              ) : historyError ? (
                <div style={{ padding: 24, textAlign: 'center', fontSize: 13, color: t.error }}>{historyError}</div>
              ) : historyEntries.length === 0 ? (
                <div style={{ padding: 24, textAlign: 'center', fontSize: 13, color: t.fern }}>
                  Todavía no hay versiones guardadas de esta página. Se guardan solas cada 10 minutos
                  mientras editás, o con el botón de arriba.
                </div>
              ) : (
                historyEntries.map((entry) => (
                  <div
                    key={entry.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 10,
                      padding: '10px 16px',
                      borderBottom: `1px solid ${t.clay}`,
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 13.5,
                          color: t.bark,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {entry.title || 'Sin título'}
                      </div>
                      <div style={{ fontSize: 11, color: t.fern, marginTop: 2 }}>
                        {new Date(entry.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <button
                      onClick={() => restoreVersion(activePage.id, entry)}
                      style={{
                        fontSize: 12,
                        color: t.moss,
                        background: 'none',
                        border: `1px solid ${t.moss}`,
                        borderRadius: 6,
                        padding: '4px 8px',
                        cursor: 'pointer',
                        flexShrink: 0,
                      }}
                    >
                      Restaurar
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ---- Share panel ---- */}
      {shareOpen && activePage && (
        <div
          onClick={() => setShareOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(20,20,15,0.35)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            paddingTop: '12vh',
            zIndex: 10,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Compartir página"
            style={{
              width: 420,
              maxWidth: '90vw',
              background: t.canvas,
              border: `1px solid ${t.clay}`,
              borderRadius: 10,
              boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
              overflow: 'hidden',
              padding: '18px 18px 16px',
            }}
          >
            <div style={{ fontFamily: displayFont, fontSize: 17, fontWeight: 600, color: t.bark, marginBottom: 6 }}>
              Compartir "{activePage.title || 'Sin título'}"
            </div>
            <div style={{ fontSize: 12.5, color: t.fern, marginBottom: 14 }}>
              Cualquiera con el link puede ver esta página, sin necesidad de una cuenta. No puede editarla.
              Las subpáginas y páginas enlazadas no son visibles desde este link.
            </div>

            {activePage.shareToken ? (
              <>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    border: `1px solid ${t.clay}`,
                    borderRadius: 8,
                    padding: '8px 10px',
                    marginBottom: 10,
                  }}
                >
                  <input
                    className="glenwyn-focus"
                    readOnly
                    value={`${window.location.origin}/share/${activePage.shareToken}`}
                    onFocus={(e) => e.target.select()}
                    style={{
                      flex: 1,
                      border: 'none',
                      outline: 'none',
                      background: 'transparent',
                      fontSize: 12.5,
                      color: t.bark,
                      fontFamily: monoFont,
                    }}
                  />
                  <button
                    onClick={async (e) => {
                      const link = `${window.location.origin}/share/${activePage.shareToken}`;
                      try {
                        await navigator.clipboard.writeText(link);
                        setShareCopied(true);
                        setTimeout(() => setShareCopied(false), 1500);
                      } catch (err) {
                        console.error('Glenwyn: clipboard copy failed', err);
                        // Fallback: select the text in the input so the person can copy manually (Ctrl/Cmd+C).
                        const input = e.currentTarget.parentElement?.querySelector('input');
                        if (input) {
                          input.focus();
                          input.select();
                        }
                        setShareError('No pudimos copiar automáticamente — seleccionamos el link, copialo con Ctrl/Cmd+C.');
                      }
                    }}
                    style={{
                      fontSize: 12,
                      color: t.moss,
                      background: 'none',
                      border: `1px solid ${t.moss}`,
                      borderRadius: 6,
                      padding: '4px 8px',
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    {shareCopied ? '¡copiado!' : 'copiar'}
                  </button>
                </div>
                <div style={{ display: 'flex', gap: 14 }}>
                  <button
                    onClick={() => handleRotateSharing(activePage)}
                    disabled={shareLoading}
                    style={{
                      fontSize: 12.5,
                      color: t.moss,
                      background: 'none',
                      border: 'none',
                      cursor: shareLoading ? 'default' : 'pointer',
                      padding: 0,
                    }}
                  >
                    {shareLoading ? 'generando…' : 'Rotar link'}
                  </button>
                  <button
                    onClick={() => handleDisableSharing(activePage)}
                    disabled={shareLoading}
                    style={{
                      fontSize: 12.5,
                      color: t.error,
                      background: 'none',
                      border: 'none',
                      cursor: shareLoading ? 'default' : 'pointer',
                      padding: 0,
                    }}
                  >
                    {shareLoading ? 'desactivando…' : 'Desactivar link'}
                  </button>
                </div>
              </>
            ) : (
              <button
                onClick={() => handleEnableSharing(activePage)}
                disabled={shareLoading}
                style={{
                  background: t.moss,
                  color: t.canvas,
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: 8,
                  fontSize: 13,
                  cursor: shareLoading ? 'default' : 'pointer',
                  opacity: shareLoading ? 0.7 : 1,
                }}
              >
                {shareLoading ? 'activando…' : 'Activar link para compartir'}
              </button>
            )}
            {shareError && <div style={{ fontSize: 12, color: t.error, marginTop: 10 }}>{shareError}</div>}
          </div>
        </div>
      )}

      {/* ---- Keyboard shortcuts help ---- */}
      {shortcutsOpen && (
        <div
          onClick={() => setShortcutsOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(20,20,15,0.35)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            paddingTop: '10vh',
            zIndex: 10,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Atajos de teclado"
            style={{
              width: 440,
              maxWidth: '90vw',
              maxHeight: '75vh',
              display: 'flex',
              flexDirection: 'column',
              background: t.canvas,
              border: `1px solid ${t.clay}`,
              borderRadius: 10,
              boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '14px 16px',
                borderBottom: `1px solid ${t.clay}`,
                fontFamily: displayFont,
                fontSize: 17,
                fontWeight: 600,
                color: t.bark,
              }}
            >
              Atajos de teclado
            </div>
            <div className="glenwyn-scroll" style={{ overflowY: 'auto', padding: '4px 0' }}>
              {[
                { group: 'General', items: [
                  ['⌘ / Ctrl + \\', 'Colapsar / expandir el sidebar'],
                  ['⌘ / Ctrl + K', 'Búsqueda rápida'],
                  ['?', 'Mostrar esta ayuda'],
                  ['Esc', 'Cerrar el panel abierto'],
                ]},
                { group: 'Dentro de un bloque', items: [
                  ['Enter', 'Nuevo bloque (o salir de una lista si está vacío)'],
                  ['Shift + Enter', 'Salto de línea dentro del bloque'],
                  ['Backspace (línea vacía)', 'Eliminar el bloque y mover el foco arriba'],
                  ['⌘ / Ctrl + D', 'Duplicar el bloque'],
                  ['/', 'Abrir el menú de comandos'],
                  ['↑ ↓ (con el menú "/" abierto)', 'Navegar las opciones'],
                ]},
                { group: 'Atajos de markdown', items: [
                  ['# o ## + espacio', 'Convertir a encabezado'],
                  ['- o * + espacio', 'Convertir a lista con viñetas'],
                  ['1. + espacio', 'Convertir a lista numerada'],
                  ['- [ ] + espacio', 'Convertir a tarea'],
                  ['> + espacio', 'Convertir a cita'],
                  ['---', 'Convertir a divisor'],
                ]},
              ].map((section) => (
                <div key={section.group} style={{ padding: '10px 16px' }}>
                  <div
                    style={{
                      fontSize: 10.5,
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                      color: t.fern,
                      fontFamily: monoFont,
                      marginBottom: 6,
                    }}
                  >
                    {section.group}
                  </div>
                  {section.items.map(([keys, desc]) => (
                    <div
                      key={keys}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 12,
                        padding: '4px 0',
                        fontSize: 12.5,
                      }}
                    >
                      <span style={{ color: t.fern, flex: 1 }}>{desc}</span>
                      <span
                        style={{
                          fontFamily: monoFont,
                          color: t.bark,
                          background: t.clay,
                          borderRadius: 4,
                          padding: '1px 6px',
                          flexShrink: 0,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {keys}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PageRow({
  page: p,
  depth,
  hasChildren,
  isExpanded,
  t,
  sidebarOpen,
  isActive,
  isDragging,
  dropTarget,
  dragEnabled,
  onClick,
  onToggleExpand,
  onDelete,
  onAddSubpage,
  onTogglePin,
  onDuplicate,
  onSetIcon,
  onDragStart,
  onDragEnd,
  onDragOverRow,
  onDropRow,
}) {
  const [iconPickerOpen, setIconPickerOpen] = useState(false);

  useEffect(() => {
    if (!iconPickerOpen) return;
    const closeIt = () => setIconPickerOpen(false);
    window.addEventListener('click', closeIt);
    return () => window.removeEventListener('click', closeIt);
  }, [iconPickerOpen]);
  const isDropBefore = dropTarget && dropTarget.id === p.id && dropTarget.position === 'before';
  const isDropAfter = dropTarget && dropTarget.id === p.id && dropTarget.position === 'after';
  const isDropInside = dropTarget && dropTarget.id === p.id && dropTarget.position === 'inside';

  const handleDragOver = (e) => {
    e.preventDefault();
    if (!sidebarOpen) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const ratio = y / rect.height;
    let position;
    if (ratio < 0.25) position = 'before';
    else if (ratio > 0.75) position = 'after';
    else position = 'inside';
    onDragOverRow(position);
  };

  return (
    <div style={{ position: 'relative' }}>
      {isDropBefore && (
        <div style={{ height: 2, background: t.moss, marginLeft: 12 + depth * 14, borderRadius: 1 }} />
      )}
      <div
        className="glenwyn-page-row glenwyn-focus"
        role="button"
        tabIndex={0}
        aria-current={isActive ? 'page' : undefined}
        draggable={sidebarOpen && dragEnabled}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragOver={handleDragOver}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (dropTarget && dropTarget.id === p.id) onDropRow(dropTarget.position);
        }}
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick();
          }
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: sidebarOpen ? 'space-between' : 'center',
          gap: 6,
          padding: sidebarOpen ? '7px 8px' : '7px 0',
          paddingLeft: sidebarOpen ? 8 + depth * 14 : 0,
          borderRadius: 7,
          cursor: 'grab',
          background: isDropInside ? t.moss + '33' : isActive ? t.clay : 'transparent',
          outline: isDropInside ? `1.5px dashed ${t.moss}` : 'none',
          outlineOffset: -1.5,
          marginBottom: 1,
          opacity: isDragging ? 0.4 : 1,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            minWidth: 0,
            fontSize: 13.5,
            color: isActive ? t.bark : t.fern,
          }}
        >
          {sidebarOpen ? (
            <span
              onClick={onToggleExpand}
              style={{
                width: 14,
                height: 14,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                cursor: hasChildren ? 'pointer' : 'default',
                transform: hasChildren && isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                transition: 'transform 120ms ease',
                color: t.fern,
              }}
            >
              {hasChildren ? '›' : ''}
            </span>
          ) : null}
          <span
            onClick={(e) => {
              e.stopPropagation();
              if (sidebarOpen) setIconPickerOpen((o) => !o);
            }}
            style={{ fontSize: 14, flexShrink: 0, cursor: sidebarOpen ? 'pointer' : 'default', position: 'relative' }}
          >
            {p.icon || '📄'}
            {iconPickerOpen && (
              <IconPicker
                t={t}
                current={p.icon}
                onPick={(icon) => {
                  onSetIcon(icon);
                  setIconPickerOpen(false);
                }}
              />
            )}
          </span>
          {sidebarOpen && (
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {p.title || 'Sin título'}
            </span>
          )}
        </div>
        {sidebarOpen && (
          <div
            className="glenwyn-page-actions"
            style={{ display: 'flex', gap: 2 }}
          >
            <button
              onClick={onTogglePin}
              title={p.pinned ? 'Quitar de favoritos' : 'Agregar a favoritos'}
              aria-label={p.pinned ? 'Quitar de favoritos' : 'Agregar a favoritos'}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: p.pinned ? t.sun : t.fern,
                fontSize: 12,
                padding: '2px 4px',
                borderRadius: 4,
              }}
            >
              {p.pinned ? '⭐' : '☆'}
            </button>
            <button
              onClick={onAddSubpage}
              title="Agregar subpágina"
              aria-label="Agregar subpágina"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: t.fern,
                fontSize: 13,
                padding: '2px 4px',
                borderRadius: 4,
              }}
            >
              +
            </button>
            <button
              onClick={onDuplicate}
              title="Duplicar página"
              aria-label="Duplicar página"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: t.fern,
                fontSize: 12,
                padding: '2px 4px',
                borderRadius: 4,
              }}
            >
              ⎘
            </button>
            <button
              onClick={onDelete}
              title="Mover a la papelera"
              aria-label="Mover a la papelera"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: t.fern,
                fontSize: 13,
                padding: '2px 4px',
                borderRadius: 4,
              }}
            >
              🗑
            </button>
          </div>
        )}
      </div>
      {isDropAfter && (
        <div style={{ height: 2, background: t.moss, marginLeft: 12 + depth * 14, borderRadius: 1 }} />
      )}
    </div>
  );
}

const EMOJI_PALETTE = [
  '📄', '📝', '📌', '📎', '📚', '📖', '🔖', '🗒️',
  '💡', '🎯', '✅', '📅', '⏰', '🔥', '⭐', '❤️',
  '🌿', '🌱', '🌙', '☀️', '☕', '🎨', '🎧', '🧠',
  '💰', '🏠', '✈️', '🎓', '💼', '🔧', '📊', '🗂️',
];

function IconPicker({ t, current, onPick }) {
  const [custom, setCustom] = useState('');

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'absolute',
        top: '100%',
        left: 0,
        marginTop: 4,
        width: 208,
        background: t.canvas,
        border: `1px solid ${t.clay}`,
        borderRadius: 8,
        boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
        zIndex: 8,
        padding: 8,
      }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 2, marginBottom: 8 }}>
        {EMOJI_PALETTE.map((emoji) => (
          <button
            key={emoji}
            onClick={() => onPick(emoji)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: 15,
              padding: 3,
              borderRadius: 4,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = t.clay)}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            {emoji}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        <input
          className="glenwyn-focus"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && custom.trim()) {
              e.preventDefault();
              onPick(custom.trim().slice(0, 4));
            }
          }}
          placeholder="pegar cualquier emoji…"
          style={{
            flex: 1,
            border: `1px solid ${t.clay}`,
            borderRadius: 6,
            padding: '4px 6px',
            fontSize: 12,
            background: 'transparent',
            color: t.bark,
            outline: 'none',
          }}
        />
        {current && (
          <button
            onClick={() => onPick(null)}
            title="Quitar ícono"
            style={{ fontSize: 11, color: t.fern, background: 'none', border: 'none', cursor: 'pointer' }}
          >
            quitar
          </button>
        )}
      </div>
    </div>
  );
}

function EmptyState({ t, onCreate }) {
  return (
    <div style={{ textAlign: 'center', paddingTop: 80 }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>🌿</div>
      <div
        style={{
          fontFamily: displayFont,
          fontSize: 22,
          fontWeight: 500,
          color: t.bark,
          marginBottom: 8,
        }}
      >
        Este espacio está esperando tu primera idea
      </div>
      <div style={{ fontSize: 13.5, color: t.fern, marginBottom: 20 }}>
        Crea una página para empezar a escribir.
      </div>
      <button
        onClick={onCreate}
        style={{
          background: t.moss,
          color: t.canvas,
          border: 'none',
          padding: '9px 18px',
          borderRadius: 8,
          fontSize: 13.5,
          cursor: 'pointer',
        }}
      >
        + Nueva página
      </button>
    </div>
  );
}

function TasksView({ t, tasks, today, onToggle, onOpenPage }) {
  const overdue = tasks.filter((tsk) => !tsk.checked && tsk.dueDate < today);
  const dueToday = tasks.filter((tsk) => !tsk.checked && tsk.dueDate === today);
  const upcoming = tasks.filter((tsk) => !tsk.checked && tsk.dueDate > today);
  const done = tasks.filter((tsk) => tsk.checked);

  const groups = [
    { label: 'Vencidas', items: overdue, color: t.error },
    { label: 'Hoy', items: dueToday, color: t.moss },
    { label: 'Próximas', items: upcoming, color: t.fern },
  ];

  const hasAnyPending = overdue.length + dueToday.length + upcoming.length > 0;

  return (
    <div>
      <div style={{ fontFamily: displayFont, fontWeight: 600, fontSize: 30, color: t.bark, marginBottom: 28 }}>
        Mis tareas
      </div>

      {!hasAnyPending && (
        <div style={{ fontSize: 13.5, color: t.fern, marginBottom: 24 }}>
          No tenés tareas pendientes con fecha. Agregá una fecha de vencimiento desde cualquier tarea (📅) para
          verla acá.
        </div>
      )}

      {groups.map(
        (group) =>
          group.items.length > 0 && (
            <div key={group.label} style={{ marginBottom: 28 }}>
              <div
                style={{
                  fontSize: 11,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  color: group.color,
                  fontFamily: monoFont,
                  marginBottom: 8,
                }}
              >
                {group.label} · {group.items.length}
              </div>
              {group.items.map((tsk) => (
                <TaskRow key={tsk.blockId} t={t} task={tsk} onToggle={onToggle} onOpenPage={onOpenPage} />
              ))}
            </div>
          )
      )}

      {done.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div
            style={{
              fontSize: 11,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              color: t.fern,
              fontFamily: monoFont,
              marginBottom: 8,
              opacity: 0.7,
            }}
          >
            Completadas · {done.length}
          </div>
          {done.map((tsk) => (
            <TaskRow key={tsk.blockId} t={t} task={tsk} onToggle={onToggle} onOpenPage={onOpenPage} />
          ))}
        </div>
      )}
    </div>
  );
}

function TaskRow({ t, task, onToggle, onOpenPage }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 4px',
        borderBottom: `1px solid ${t.clay}`,
      }}
    >
      <input
        type="checkbox"
        checked={task.checked}
        onChange={() => onToggle(task.pageId, task.blockId)}
        aria-label={`Tarea: ${task.content}`}
        style={{ accentColor: t.moss, cursor: 'pointer', flexShrink: 0 }}
      />
      {task.priority && (
        <span
          style={{ color: { 1: t.error, 2: t.sun, 3: t.fern }[task.priority], fontSize: 12, flexShrink: 0 }}
          title={{ 1: 'Prioridad alta', 2: 'Prioridad media', 3: 'Prioridad baja' }[task.priority]}
        >
          ⚑
        </span>
      )}
      <span
        style={{
          flex: 1,
          fontSize: 14,
          color: task.checked ? t.fern : t.bark,
          textDecoration: task.checked ? 'line-through' : 'none',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {task.content || 'Tarea sin descripción'}
        {task.recurrence && <span style={{ color: t.moss, marginLeft: 6 }}>↻</span>}
      </span>
      <button
        onClick={() => onOpenPage(task.pageId)}
        className="glenwyn-focus"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: t.fern,
          fontSize: 12,
          flexShrink: 0,
        }}
        title="Ir a la página"
      >
        <span>{task.pageIcon || '📄'}</span>
        <span style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {task.pageTitle}
        </span>
      </button>
      <span
        style={{
          fontSize: 11.5,
          fontFamily: monoFont,
          color: t.fern,
          flexShrink: 0,
          minWidth: 44,
          textAlign: 'right',
        }}
      >
        {new Date(task.dueDate + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
      </span>
    </div>
  );
}

function Block({
  block,
  t,
  onChange,
  onEnter,
  onToggle,
  onDueDateChange,
  onCyclePriority,
  onRecurrenceChange,
  onConvert,
  onDuplicate,
  listNumber,
  onToggleBodyChange,
  onToggleOpen,
  onImageUrlChange,
  onUploadFile,
  onEmbedUrlChange,
  onTableCellChange,
  onTableAddRow,
  onTableAddColumn,
  onTableRemoveRow,
  onTableRemoveColumn,
  onDelete,
  registerRef,
  allPages,
  onNavigate,
  onSetPageLink,
}) {
  const ref = useRef(null);
  const bodyRef = useRef(null);
  const [slashOpen, setSlashOpen] = useState(false);
  const [slashIndex, setSlashIndex] = useState(0);
  const [isTextFocused, setIsTextFocused] = useState(false);
  const [mentionTrigger, setMentionTrigger] = useState(null); // { startIndex, query } | null
  const [mentionIndex, setMentionIndex] = useState(0);

  // Combines the local auto-resize ref with the parent's registry (used to move focus
  // to this block from a sibling after a delete).
  const setMainRef = (el) => {
    ref.current = el;
    if (registerRef) registerRef(el);
  };

  // When a click on the "resolved mentions" display view switches a text block
  // back into edit mode, focus the textarea once it's actually mounted.
  useEffect(() => {
    if (isTextFocused && ref.current) ref.current.focus();
  }, [isTextFocused]);

  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = 'auto';
      ref.current.style.height = ref.current.scrollHeight + 'px';
    }
  }, [block.content]);

  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.style.height = 'auto';
      bodyRef.current.style.height = bodyRef.current.scrollHeight + 'px';
    }
  }, [block.body, block.open]);

  const filteredCommands = slashOpen
    ? SLASH_COMMANDS.filter((c) => {
        const q = block.content.slice(1).toLowerCase();
        if (!q) return true;
        return c.label.toLowerCase().includes(q) || c.keywords.some((k) => k.includes(q));
      })
    : [];

  const filteredMentionPages = mentionTrigger
    ? (allPages || [])
        .filter((p) => !p.isArchived)
        .filter((p) => (p.title || '').toLowerCase().includes(mentionTrigger.query.toLowerCase()))
        .slice(0, 8)
    : [];

  const runCommand = (cmd) => {
    if (!cmd) return;
    setSlashOpen(false);
    setSlashIndex(0);
    if (cmd.type === 'table') {
      onConvert(cmd.type, '', { rows: [['', ''], ['', '']] });
    } else {
      onConvert(cmd.type, '');
    }
    if (cmd.type === 'divider') onEnter();
  };

  const handleChange = (value, cursorPos = value.length) => {
    onChange(value);

    if (value.startsWith('/')) {
      setSlashOpen(true);
      setSlashIndex(0);
      return;
    }
    if (slashOpen) setSlashOpen(false);

    // Mentions: only for plain text blocks. Looks for an unclosed "[[" working
    // backward *from the cursor* (not just anywhere in the whole string) — with
    // more than one mention in a paragraph, a whole-string search can find the
    // wrong pair if you go back and edit earlier text after a later one is
    // already closed.
    if (block.type === 'text') {
      const beforeCursor = value.slice(0, cursorPos);
      const openIdx = beforeCursor.lastIndexOf('[[');
      if (openIdx !== -1 && !beforeCursor.slice(openIdx + 2).includes(']]')) {
        setMentionTrigger({ startIndex: openIdx, query: beforeCursor.slice(openIdx + 2) });
        setMentionIndex(0);
      } else if (mentionTrigger) {
        setMentionTrigger(null);
      }
    }

    // Markdown-style shortcuts only apply to plain text blocks.
    if (block.type === 'text') {
      const shortcut = detectMarkdownShortcut(value);
      if (shortcut) {
        onConvert(shortcut.type, shortcut.content, shortcut.extra);
        if (shortcut.type === 'divider') onEnter();
      }
    }
  };

  const pickMention = (page) => {
    if (!mentionTrigger) return;
    const before = block.content.slice(0, mentionTrigger.startIndex);
    const after = block.content.slice(mentionTrigger.startIndex + 2 + mentionTrigger.query.length);
    onChange(`${before}[[${page.title || 'Sin título'}]]${after}`);
    setMentionTrigger(null);
  };

  // Looks for a Spanish natural-language date phrase in a task's text ("mañana",
  // "todos los lunes"...) and, if found, strips it from the text and sets the due
  // date/recurrence instead. Deliberately only runs on blur/Enter — not on every
  // keystroke — so it doesn't yank text out from under someone still typing
  // (e.g. "mañana" shouldn't get eaten mid-word while typing "mañanita").
  const applyNaturalDateIfFound = () => {
    if (block.type !== 'todo' || !block.content) return;
    const result = parseNaturalDateFromText(block.content);
    if (!result) return;
    onChange(result.cleanedText);
    onDueDateChange(result.dueDate);
    if (result.recurrence) onRecurrenceChange(result.recurrence);
  };

  const handleKeyDown = (e) => {
    if (mentionTrigger) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex((i) => Math.min(i + 1, Math.max(filteredMentionPages.length - 1, 0)));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === 'Enter' && filteredMentionPages.length > 0) {
        e.preventDefault();
        pickMention(filteredMentionPages[mentionIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setMentionTrigger(null);
        return;
      }
    }
    if (slashOpen) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSlashIndex((i) => Math.min(i + 1, Math.max(filteredCommands.length - 1, 0)));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSlashIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        runCommand(filteredCommands[slashIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setSlashOpen(false);
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const listLike = ['todo', 'bullet', 'numbered', 'quote'];
      if (listLike.includes(block.type) && block.content.trim() === '') {
        // A second Enter on an empty list item exits the list, like Notion.
        onConvert('text', '');
        return;
      }
      if (block.type === 'todo') applyNaturalDateIfFound();
      // List-like blocks keep making the same type on Enter; others fall back to plain text.
      onEnter(listLike.includes(block.type) ? block.type : 'text');
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd') {
      e.preventDefault();
      onDuplicate();
      return;
    }
    if (e.key === 'Backspace' && block.content === '' && !slashOpen) {
      // Backspace on an empty line removes the block and moves focus up, like most editors.
      e.preventDefault();
      onDelete();
    }
  };

  const sharedTextareaStyle = {
    width: '100%',
    border: 'none',
    outline: 'none',
    background: 'transparent',
    fontFamily: bodyFont,
    fontSize: 15.5,
    lineHeight: 1.7,
    color: t.bark,
    marginBottom: 4,
  };

  if (block.type === 'divider') {
    return (
      <div
        className="glenwyn-divider-row"
        style={{ position: 'relative', display: 'flex', alignItems: 'center', margin: '14px 0' }}
      >
        <div style={{ flex: 1, height: 1, background: t.clay }} />
        <button
          className="glenwyn-divider-delete"
          onClick={onDelete}
          title="Quitar divisor"
          style={{
            position: 'absolute',
            right: 0,
            fontSize: 11,
            color: t.fern,
            background: t.canvas,
            border: 'none',
            cursor: 'pointer',
            opacity: 0,
            padding: '2px 6px',
          }}
        >
          quitar
        </button>
      </div>
    );
  }

  if (block.type === 'todo') {
    const today = new Date().toISOString().slice(0, 10);
    const isOverdue = block.dueDate && block.dueDate < today && !block.checked;
    const isToday = block.dueDate === today;
    const dueDateColor = block.checked ? t.fern : isOverdue ? t.error : isToday ? t.moss : t.fern;
    const priorityColor = { 1: t.error, 2: t.sun, 3: t.fern }[block.priority] || t.clay;
    const priorityLabel = { 1: 'Prioridad alta', 2: 'Prioridad media', 3: 'Prioridad baja' }[block.priority] || 'Sin prioridad — click para agregar';

    return (
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 6, position: 'relative' }}>
        <input
          type="checkbox"
          checked={!!block.checked}
          onChange={onToggle}
          aria-label={block.content ? `Tarea: ${block.content}` : 'Tarea sin descripción'}
          style={{ marginTop: 5, accentColor: t.moss, cursor: 'pointer' }}
        />
        <textarea
          ref={setMainRef}
          className="glenwyn-block glenwyn-focus"
          rows={1}
          value={block.content}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={applyNaturalDateIfFound}
          placeholder="Tarea pendiente (ej. 'mañana', 'todos los lunes', 'en 3 días')"
          style={{
            ...sharedTextareaStyle,
            flex: 1,
            marginBottom: 0,
            color: block.checked ? t.fern : t.bark,
            textDecoration: block.checked ? 'line-through' : 'none',
          }}
        />
        <button
          onClick={onCyclePriority}
          title={priorityLabel}
          aria-label={priorityLabel}
          className="glenwyn-focus"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: priorityColor,
            fontSize: 13,
            marginTop: 6,
            padding: 0,
            flexShrink: 0,
          }}
        >
          ⚑
        </button>
        {block.dueDate && (
          <select
            value={block.recurrence?.freq || ''}
            onChange={(e) =>
              onRecurrenceChange(e.target.value ? { freq: e.target.value, interval: 1 } : null)
            }
            title="Repetir"
            className="glenwyn-focus"
            style={{
              marginTop: 6,
              fontSize: 11,
              fontFamily: monoFont,
              color: block.recurrence ? t.moss : t.fern,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <option value="">no se repite</option>
            <option value="daily">↻ diaria</option>
            <option value="weekly">↻ semanal</option>
            <option value="monthly">↻ mensual</option>
          </select>
        )}
        <label
          title={block.dueDate ? 'Cambiar fecha de vencimiento' : 'Agregar fecha de vencimiento'}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 3,
            marginTop: 6,
            fontSize: 11.5,
            fontFamily: monoFont,
            color: dueDateColor,
            cursor: 'pointer',
            flexShrink: 0,
            whiteSpace: 'nowrap',
          }}
        >
          <span>{block.dueDate ? new Date(block.dueDate + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '📅'}</span>
          <input
            type="date"
            value={block.dueDate || ''}
            onChange={(e) => onDueDateChange(e.target.value || null)}
            className="glenwyn-focus"
            style={{
              position: 'absolute',
              width: 1,
              height: 1,
              opacity: 0,
              overflow: 'hidden',
            }}
          />
        </label>
        {slashOpen && <SlashMenu t={t} commands={filteredCommands} index={slashIndex} onPick={runCommand} />}
      </div>
    );
  }

  if (block.type === 'heading') {
    return (
      <div style={{ position: 'relative' }}>
        <textarea
          ref={setMainRef}
          className="glenwyn-block glenwyn-focus"
          rows={1}
          value={block.content}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Encabezado"
          style={{
            width: '100%',
            border: 'none',
            outline: 'none',
            background: 'transparent',
            fontFamily: displayFont,
            fontWeight: 500,
            fontSize: 22,
            color: t.bark,
            marginTop: 18,
            marginBottom: 6,
          }}
        />
        {slashOpen && <SlashMenu t={t} commands={filteredCommands} index={slashIndex} onPick={runCommand} />}
      </div>
    );
  }

  if (block.type === 'bullet' || block.type === 'numbered') {
    return (
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 2, position: 'relative' }}>
        <span
          style={{
            marginTop: 6,
            fontSize: block.type === 'bullet' ? 18 : 15,
            lineHeight: 1,
            color: t.fern,
            fontFamily: block.type === 'numbered' ? monoFont : bodyFont,
            minWidth: 14,
            textAlign: block.type === 'numbered' ? 'right' : 'left',
            flexShrink: 0,
          }}
        >
          {block.type === 'bullet' ? '•' : `${listNumber}.`}
        </span>
        <textarea
          ref={setMainRef}
          className="glenwyn-block glenwyn-focus"
          rows={1}
          value={block.content}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={block.type === 'bullet' ? 'Elemento de lista' : 'Elemento numerado'}
          style={{ ...sharedTextareaStyle, flex: 1, marginBottom: 0 }}
        />
        {slashOpen && <SlashMenu t={t} commands={filteredCommands} index={slashIndex} onPick={runCommand} />}
      </div>
    );
  }

  if (block.type === 'quote') {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
          borderLeft: `2.5px solid ${t.moss}`,
          paddingLeft: 14,
          margin: '10px 0',
          position: 'relative',
        }}
      >
        <textarea
          ref={setMainRef}
          className="glenwyn-block glenwyn-focus"
          rows={1}
          value={block.content}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Cita"
          style={{
            ...sharedTextareaStyle,
            fontStyle: 'italic',
            color: t.fern,
            marginBottom: 0,
          }}
        />
        {slashOpen && <SlashMenu t={t} commands={filteredCommands} index={slashIndex} onPick={runCommand} />}
      </div>
    );
  }

  if (block.type === 'callout') {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 10,
          background: t.clay,
          borderRadius: 8,
          padding: '10px 14px',
          margin: '10px 0',
          position: 'relative',
        }}
      >
        <span style={{ fontSize: 16, marginTop: 2 }}>💡</span>
        <textarea
          ref={setMainRef}
          className="glenwyn-block glenwyn-focus"
          rows={1}
          value={block.content}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Nota destacada"
          style={{ ...sharedTextareaStyle, flex: 1, marginBottom: 0 }}
        />
        {slashOpen && <SlashMenu t={t} commands={filteredCommands} index={slashIndex} onPick={runCommand} />}
      </div>
    );
  }

  if (block.type === 'toggle') {
    const isOpen = block.open !== false;
    return (
      <div style={{ margin: '2px 0', position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
          <span
            onClick={onToggleOpen}
            style={{
              width: 16,
              height: 22,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              cursor: 'pointer',
              color: t.fern,
              fontSize: 11,
              transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
              transition: 'transform 120ms ease',
            }}
          >
            ▸
          </span>
          <textarea
            ref={setMainRef}
            className="glenwyn-block glenwyn-focus"
            rows={1}
            value={block.content}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Título del desplegable"
            style={{ ...sharedTextareaStyle, flex: 1, marginBottom: 0, fontWeight: 500 }}
          />
          {slashOpen && <SlashMenu t={t} commands={filteredCommands} index={slashIndex} onPick={runCommand} />}
        </div>
        {isOpen && (
          <div style={{ paddingLeft: 22, marginTop: 2 }}>
            <textarea
              ref={bodyRef}
              rows={1}
              value={block.body || ''}
              onChange={(e) => onToggleBodyChange(e.target.value)}
              placeholder="Escribí el contenido oculto acá — Enter hace un salto de línea normal"
              style={{ ...sharedTextareaStyle, color: t.fern, fontSize: 14.5 }}
            />
          </div>
        )}
      </div>
    );
  }

  if (block.type === 'image') {
    return (
      <ImageBlock
        block={block}
        t={t}
        onUrlChange={onImageUrlChange}
        onCaptionChange={handleChange}
        onDelete={onDelete}
        onUploadFile={onUploadFile}
      />
    );
  }

  if (block.type === 'table') {
    return (
      <TableBlock
        block={block}
        t={t}
        onCellChange={onTableCellChange}
        onAddRow={onTableAddRow}
        onAddColumn={onTableAddColumn}
        onRemoveRow={onTableRemoveRow}
        onRemoveColumn={onTableRemoveColumn}
        onDelete={onDelete}
      />
    );
  }

  if (block.type === 'embed') {
    return <EmbedBlock block={block} t={t} onUrlChange={onEmbedUrlChange} onDelete={onDelete} />;
  }

  if (block.type === 'page-link') {
    return (
      <PageLinkBlock
        block={block}
        t={t}
        allPages={allPages}
        onNavigate={onNavigate}
        onSetPageLink={onSetPageLink}
        onDelete={onDelete}
      />
    );
  }

  const showMentionDisplay = block.type === 'text' && !isTextFocused && hasMentions(block.content);

  return (
    <div style={{ position: 'relative' }}>
      {showMentionDisplay ? (
        <div
          role="button"
          tabIndex={0}
          className="glenwyn-focus"
          onClick={() => setIsTextFocused(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              setIsTextFocused(true);
            }
          }}
          style={{ ...sharedTextareaStyle, cursor: 'text', minHeight: '1.7em', whiteSpace: 'pre-wrap' }}
        >
          {parseMentions(block.content, allPages).map((seg, i) =>
            seg.type === 'text' ? (
              <span key={i}>{seg.value}</span>
            ) : (
              <span
                key={i}
                onClick={(e) => {
                  e.stopPropagation();
                  if (seg.pageId) onNavigate(seg.pageId);
                }}
                title={seg.pageId ? 'Ir a la página' : 'Esta página no existe (o cambió de nombre)'}
                style={{
                  color: seg.pageId ? t.moss : t.fern,
                  textDecoration: 'underline',
                  textDecorationStyle: seg.pageId ? 'solid' : 'dashed',
                  textDecorationColor: t.clay,
                  cursor: seg.pageId ? 'pointer' : 'default',
                }}
              >
                {seg.value}
              </span>
            )
          )}
        </div>
      ) : (
        <textarea
          ref={setMainRef}
          className="glenwyn-block glenwyn-focus"
          rows={1}
          value={block.content}
          onChange={(e) => handleChange(e.target.value, e.target.selectionStart)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsTextFocused(true)}
          onBlur={() => {
            setIsTextFocused(false);
            setMentionTrigger(null);
          }}
          placeholder="Escribe algo, '/' para comandos, [[ para mencionar una página, o Enter para una línea nueva…"
          style={sharedTextareaStyle}
        />
      )}
      {slashOpen && <SlashMenu t={t} commands={filteredCommands} index={slashIndex} onPick={runCommand} />}
      {mentionTrigger && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: 2,
            width: 240,
            background: t.canvas,
            border: `1px solid ${t.clay}`,
            borderRadius: 8,
            boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
            zIndex: 5,
            overflow: 'hidden',
          }}
        >
          {filteredMentionPages.length === 0 ? (
            <div style={{ padding: '10px 12px', fontSize: 12.5, color: t.fern }}>
              sin páginas que coincidan
            </div>
          ) : (
            filteredMentionPages.map((p, i) => (
              <div
                key={p.id}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pickMention(p);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 12px',
                  cursor: 'pointer',
                  background: i === mentionIndex ? t.clay : 'transparent',
                  fontSize: 13,
                }}
              >
                <span>{p.icon || '📄'}</span>
                <span style={{ color: t.bark, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.title || 'Sin título'}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function ImageBlock({ block, t, onUrlChange, onCaptionChange, onDelete, onUploadFile }) {
  const [draft, setDraft] = useState(block.url || '');
  const [broken, setBroken] = useState(false);
  const [urlError, setUrlError] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileChosen = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = ''; // allow re-picking the same file later
    if (!file) return;
    setUploading(true);
    setUrlError('');
    try {
      await onUploadFile(file);
    } catch (err) {
      setUrlError(err.message || 'No pudimos subir la imagen.');
    } finally {
      setUploading(false);
    }
  };

  if (!block.url) {
    return (
      <div style={{ margin: '10px 0' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            border: `1px dashed ${t.clay}`,
            borderRadius: 8,
            padding: '10px 12px',
          }}
        >
          <span style={{ fontSize: 14 }}>🖼️</span>
          <input
            className="glenwyn-focus"
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              if (urlError) setUrlError('');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && draft.trim()) {
                e.preventDefault();
                if (!isHttpUrl(draft.trim())) {
                  setUrlError('Tiene que ser un link http(s) válido.');
                  return;
                }
                onUrlChange(draft.trim());
              }
              if (e.key === 'Backspace' && draft === '') {
                e.preventDefault();
                onDelete();
              }
            }}
            placeholder={uploading ? 'Subiendo imagen…' : 'Pegá el link de una imagen…'}
            disabled={uploading}
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontFamily: bodyFont,
              fontSize: 13.5,
              color: t.bark,
            }}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChosen}
            style={{ display: 'none' }}
          />
          <button
            onClick={() => fileInputRef.current && fileInputRef.current.click()}
            disabled={uploading}
            style={{
              flexShrink: 0,
              fontSize: 12,
              color: t.moss,
              background: 'none',
              border: `1px solid ${t.moss}`,
              borderRadius: 6,
              padding: '4px 8px',
              cursor: uploading ? 'default' : 'pointer',
              opacity: uploading ? 0.6 : 1,
            }}
          >
            {uploading ? 'subiendo…' : 'subir archivo'}
          </button>
        </div>
        {urlError && <div style={{ fontSize: 11, color: t.error, marginTop: 4, paddingLeft: 4 }}>{urlError}</div>}
      </div>
    );
  }

  return (
    <div className="glenwyn-media-row" style={{ margin: '10px 0', position: 'relative' }}>
      <button
        className="glenwyn-media-delete"
        onClick={onDelete}
        title="Quitar imagen"
        style={{
          position: 'absolute',
          top: 6,
          right: 6,
          fontSize: 11,
          color: '#fff',
          background: 'rgba(20,20,15,0.55)',
          border: 'none',
          borderRadius: 5,
          cursor: 'pointer',
          opacity: 0,
          padding: '3px 7px',
          zIndex: 1,
        }}
      >
        ✕
      </button>
      {broken ? (
        <div
          style={{
            border: `1px dashed ${t.clay}`,
            borderRadius: 8,
            padding: '16px 12px',
            fontSize: 12.5,
            color: t.fern,
            textAlign: 'center',
          }}
        >
          No pudimos cargar esta imagen — revisá el link.
          <button
            onClick={() => {
              setBroken(false);
              onUrlChange('');
            }}
            style={{
              display: 'block',
              margin: '8px auto 0',
              background: 'none',
              border: 'none',
              color: t.moss,
              cursor: 'pointer',
              fontSize: 12.5,
            }}
          >
            cambiar link
          </button>
        </div>
      ) : (
        <img
          src={block.url}
          alt={block.content || ''}
          onError={() => setBroken(true)}
          style={{ maxWidth: '100%', borderRadius: 8, display: 'block' }}
        />
      )}
      <input
        className="glenwyn-focus"
        value={block.content}
        onChange={(e) => onCaptionChange(e.target.value)}
        placeholder="Agregar un pie de foto (opcional)"
        style={{
          width: '100%',
          border: 'none',
          outline: 'none',
          background: 'transparent',
          fontFamily: bodyFont,
          fontSize: 12.5,
          color: t.fern,
          marginTop: 6,
          textAlign: 'center',
        }}
      />
    </div>
  );
}

function TableBlock({ block, t, onCellChange, onAddRow, onAddColumn, onRemoveRow, onRemoveColumn, onDelete }) {
  const rows = block.rows || [['', '']];
  const [hoveredRow, setHoveredRow] = useState(null);
  const [hoveredCol, setHoveredCol] = useState(null);

  return (
    <div style={{ margin: '12px 0', overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r} onMouseEnter={() => setHoveredRow(r)} onMouseLeave={() => setHoveredRow(null)}>
              {row.map((cell, c) => (
                <td
                  key={c}
                  onMouseEnter={() => setHoveredCol(c)}
                  onMouseLeave={() => setHoveredCol(null)}
                  style={{
                    border: `1px solid ${t.clay}`,
                    padding: 0,
                    background: r === 0 ? t.clay : 'transparent',
                    position: 'relative',
                    minWidth: 90,
                  }}
                >
                  <input
                    className="glenwyn-focus"
                    value={cell}
                    onChange={(e) => onCellChange(r, c, e.target.value)}
                    style={{
                      width: '100%',
                      border: 'none',
                      outline: 'none',
                      background: 'transparent',
                      padding: '6px 8px',
                      fontSize: 13,
                      fontWeight: r === 0 ? 600 : 400,
                      color: t.bark,
                      fontFamily: bodyFont,
                    }}
                  />
                  {r === 0 && c === row.length - 1 && hoveredCol === c && row.length > 1 && (
                    <button
                      onClick={() => onRemoveColumn(c)}
                      title="Quitar columna"
                      style={{
                        position: 'absolute',
                        top: 2,
                        right: 2,
                        fontSize: 9,
                        border: 'none',
                        background: 'none',
                        color: t.fern,
                        cursor: 'pointer',
                      }}
                    >
                      ✕
                    </button>
                  )}
                </td>
              ))}
              <td style={{ border: 'none', padding: '0 4px', width: 24 }}>
                {hoveredRow === r && rows.length > 1 && (
                  <button
                    onClick={() => onRemoveRow(r)}
                    title="Quitar fila"
                    style={{ border: 'none', background: 'none', color: t.fern, cursor: 'pointer', fontSize: 11 }}
                  >
                    ✕
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
        <button
          onClick={onAddRow}
          style={{ border: 'none', background: 'none', color: t.fern, cursor: 'pointer', fontSize: 12 }}
        >
          + fila
        </button>
        <button
          onClick={onAddColumn}
          style={{ border: 'none', background: 'none', color: t.fern, cursor: 'pointer', fontSize: 12 }}
        >
          + columna
        </button>
        <button
          onClick={onDelete}
          style={{ border: 'none', background: 'none', color: t.fern, cursor: 'pointer', fontSize: 12, marginLeft: 'auto' }}
        >
          quitar tabla
        </button>
      </div>
    </div>
  );
}

function EmbedBlock({ block, t, onUrlChange, onDelete }) {
  const [draft, setDraft] = useState(block.url || '');
  const [urlError, setUrlError] = useState('');

  if (!block.url) {
    return (
      <div style={{ margin: '10px 0' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            border: `1px dashed ${t.clay}`,
            borderRadius: 8,
            padding: '10px 12px',
          }}
        >
          <span style={{ fontSize: 14 }}>▶</span>
          <input
            className="glenwyn-focus"
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              if (urlError) setUrlError('');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && draft.trim()) {
                e.preventDefault();
                if (!isHttpUrl(draft.trim())) {
                  setUrlError('Tiene que ser un link http(s) válido.');
                  return;
                }
                onUrlChange(draft.trim());
              }
              if (e.key === 'Backspace' && draft === '') {
                e.preventDefault();
                onDelete();
              }
            }}
            placeholder="Pegá un link de YouTube, Vimeo, Loom, Spotify, o cualquier URL"
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontFamily: bodyFont,
              fontSize: 13.5,
              color: t.bark,
            }}
          />
        </div>
        {urlError && <div style={{ fontSize: 11, color: t.error, marginTop: 4, paddingLeft: 4 }}>{urlError}</div>}
      </div>
    );
  }

  const { kind, embedSrc, ratio } = parseEmbedUrl(block.url);

  return (
    <div className="glenwyn-media-row" style={{ margin: '10px 0', position: 'relative' }}>
      <button
        className="glenwyn-media-delete"
        onClick={onDelete}
        title="Quitar embed"
        style={{
          position: 'absolute',
          top: 6,
          right: 6,
          fontSize: 11,
          color: '#fff',
          background: 'rgba(20,20,15,0.55)',
          border: 'none',
          borderRadius: 5,
          cursor: 'pointer',
          opacity: 0,
          padding: '3px 7px',
          zIndex: 1,
        }}
      >
        ✕
      </button>

      {kind === 'generic' ? (
        <a
          href={block.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'block',
            border: `1px solid ${t.clay}`,
            borderRadius: 8,
            padding: '12px 14px',
            textDecoration: 'none',
          }}
        >
          <div style={{ fontSize: 13, color: t.bark, fontWeight: 500 }}>{block.url}</div>
          <div style={{ fontSize: 11.5, color: t.fern, marginTop: 2 }}>Abrir enlace ↗</div>
        </a>
      ) : kind === 'spotify' ? (
        <iframe
          src={embedSrc}
          title="embed"
          width="100%"
          height="152"
          style={{ border: 'none', borderRadius: 8, display: 'block' }}
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        />
      ) : (
        <div style={{ position: 'relative', width: '100%', paddingTop: ratio, borderRadius: 8, overflow: 'hidden' }}>
          <iframe
            src={embedSrc}
            title="embed"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}
    </div>
  );
}

function PageLinkBlock({ block, t, allPages, onNavigate, onSetPageLink, onDelete }) {
  const [query, setQuery] = useState('');
  const linkedPage = block.linkedPageId ? allPages.find((p) => p.id === block.linkedPageId) : null;

  // Not linked yet — show a small inline picker to search and pick a page.
  if (!block.linkedPageId) {
    const results = query
      ? allPages.filter((p) => p.title.toLowerCase().includes(query.toLowerCase()))
      : allPages;

    return (
      <div style={{ margin: '10px 0', border: `1px solid ${t.clay}`, borderRadius: 8, overflow: 'hidden' }}>
        <input
          className="glenwyn-focus"
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Backspace' && query === '') {
              e.preventDefault();
              onDelete();
            }
          }}
          placeholder="Buscar una página para enlazar…"
          style={{
            width: '100%',
            border: 'none',
            outline: 'none',
            background: 'transparent',
            padding: '9px 12px',
            fontFamily: bodyFont,
            fontSize: 13.5,
            color: t.bark,
            borderBottom: `1px solid ${t.clay}`,
          }}
        />
        <div style={{ maxHeight: 180, overflowY: 'auto' }}>
          {results.length === 0 ? (
            <div style={{ padding: '10px 12px', fontSize: 12.5, color: t.fern }}>No encontramos ninguna página.</div>
          ) : (
            results.map((p) => (
              <div
                key={p.id}
                role="button"
                tabIndex={0}
                className="glenwyn-focus"
                onClick={() => onSetPageLink(p.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSetPageLink(p.id);
                  }
                }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', cursor: 'pointer', fontSize: 13 }}
                onMouseEnter={(e) => (e.currentTarget.style.background = t.clay)}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <span>📄</span>
                <span style={{ color: t.bark }}>{p.title || 'Sin título'}</span>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  // Linked page no longer exists (deleted for good) — offer to clear the link.
  if (!linkedPage) {
    return (
      <div
        style={{
          margin: '8px 0',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 12px',
          border: `1px dashed ${t.clay}`,
          borderRadius: 8,
          fontSize: 13,
          color: t.fern,
        }}
      >
        <span>📄</span>
        <span style={{ flex: 1 }}>Esta página ya no existe.</span>
        <button onClick={onDelete} style={{ border: 'none', background: 'none', color: t.fern, cursor: 'pointer', fontSize: 12 }}>
          quitar
        </button>
      </div>
    );
  }

  return (
    <div
      className="glenwyn-media-row"
      onClick={() => onNavigate(linkedPage.id)}
      style={{
        margin: '8px 0',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 12px',
        border: `1px solid ${t.clay}`,
        borderRadius: 8,
        fontSize: 13.5,
        color: t.bark,
        cursor: 'pointer',
        position: 'relative',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = t.clay)}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      <span>📄</span>
      <span style={{ flex: 1, textDecoration: 'underline', textDecorationColor: t.clay }}>
        {linkedPage.title || 'Sin título'}
      </span>
      <button
        className="glenwyn-media-delete"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        title="Quitar link"
        style={{
          fontSize: 11,
          color: t.fern,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          opacity: 0,
        }}
      >
        ✕
      </button>
    </div>
  );
}

function SlashMenu({ t, commands, index, onPick }) {
  return (
    <div
      style={{
        position: 'absolute',
        top: '100%',
        left: 0,
        marginTop: 2,
        width: 240,
        background: t.canvas,
        border: `1px solid ${t.clay}`,
        borderRadius: 8,
        boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
        zIndex: 5,
        overflow: 'hidden',
      }}
    >
      {commands.length === 0 ? (
        <div style={{ padding: '10px 12px', fontSize: 12.5, color: t.fern }}>sin resultados</div>
      ) : (
        commands.map((c, i) => (
          <div
            key={c.type}
            onMouseDown={(e) => {
              e.preventDefault();
              onPick(c);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 12px',
              cursor: 'pointer',
              background: i === index ? t.clay : 'transparent',
            }}
          >
            <span
              style={{
                width: 22,
                height: 22,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 5,
                background: t.clay,
                color: t.moss,
                fontSize: 12,
                flexShrink: 0,
              }}
            >
              {c.icon}
            </span>
            <span>
              <div style={{ fontSize: 13, color: t.bark }}>{c.label}</div>
              <div style={{ fontSize: 11, color: t.fern }}>{c.desc}</div>
            </span>
          </div>
        ))
      )}
    </div>
  );
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function SharedPageView({ token }) {
  const [state, setState] = useState('loading'); // loading | ready | not-found | error
  const [page, setPage] = useState(null);
  const dark = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const t = dark ? tokens.dark : tokens.light;

  useEffect(() => {
    // A malformed token (missing, truncated, or with extra path segments) can never
    // match a real share — treat it as "not found" instead of hitting the RPC and
    // surfacing a raw Postgres type error to a visitor.
    if (!UUID_PATTERN.test(token || '')) {
      setState('not-found');
      return;
    }
    let cancelled = false;
    fetchSharedPage(token)
      .then((result) => {
        if (cancelled) return;
        if (!result) {
          setState('not-found');
        } else {
          setPage(result);
          setState('ready');
        }
      })
      .catch((e) => {
        console.error('Glenwyn: failed to load shared page', e);
        if (!cancelled) setState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  // Best-effort SEO/social metadata for this specific shared page. Important caveat:
  // most social crawlers (Facebook, Twitter, Slack, WhatsApp link previews) don't run
  // JavaScript, so they'll only ever see the generic tags baked into index.html —
  // this only helps clients that do render JS before reading the page.
  useEffect(() => {
    if (!page) return;
    document.title = `${page.title || 'Sin título'} · Glenwyn`;

    const excerpt = page.blocks
      .map((b) => b.content || '')
      .join(' ')
      .trim()
      .slice(0, 160);
    const description = excerpt || 'Una página compartida desde Glenwyn.';

    const setMeta = (selector, content) => {
      const el = document.querySelector(selector);
      if (el) el.setAttribute('content', content);
    };
    setMeta('meta[name="description"]', description);
    setMeta('meta[property="og:title"]', page.title || 'Sin título');
    setMeta('meta[property="og:description"]', description);
    setMeta('meta[name="twitter:title"]', page.title || 'Sin título');
    setMeta('meta[name="twitter:description"]', description);

    return () => {
      document.title = 'Glenwyn';
      setMeta('meta[name="description"]', 'Glenwyn — un espacio de trabajo inmersivo y distraction-free para tus notas, inspirado en Notion. Cozy, minimalista, sin ruido visual.');
      setMeta('meta[property="og:title"]', 'Glenwyn');
      setMeta('meta[property="og:description"]', 'Un espacio de trabajo inmersivo y distraction-free para tus notas.');
      setMeta('meta[name="twitter:title"]', 'Glenwyn');
      setMeta('meta[name="twitter:description"]', 'Un espacio de trabajo inmersivo y distraction-free para tus notas.');
    };
  }, [page]);

  if (state === 'loading') {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: t.canvas, color: t.fern, fontFamily: bodyFont }}>
        cargando…
      </div>
    );
  }

  if (state === 'not-found' || state === 'error') {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: t.canvas, fontFamily: bodyFont, textAlign: 'center', padding: 24 }}>
        <div>
          <div style={{ fontFamily: displayFont, fontSize: 20, color: t.bark, marginBottom: 8 }}>
            {state === 'not-found' ? 'Este link ya no está disponible' : 'Algo salió mal'}
          </div>
          <div style={{ fontSize: 13, color: t.fern }}>
            {state === 'not-found'
              ? 'Puede que quien la compartió haya desactivado el link, o la página ya no exista.'
              : 'Probá recargar la página en un rato.'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: t.canvas, color: t.bark, fontFamily: bodyFont }}>
      <style>{`
        @media (max-width: 640px) {
          .glenwyn-canvas-content { padding-left: 20px !important; padding-right: 20px !important; }
          .glenwyn-topbar { padding-left: 16px !important; padding-right: 16px !important; }
        }
      `}</style>
      <div
        className="glenwyn-topbar"
        style={{
          padding: '10px 28px',
          borderBottom: `1px solid ${t.clay}`,
          fontSize: 12,
          color: t.fern,
          fontFamily: monoFont,
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <span>vista de solo lectura · Glenwyn</span>
        <a href="/" style={{ color: t.moss, textDecoration: 'none' }}>
          ir a Glenwyn →
        </a>
      </div>
      <div className="glenwyn-canvas-content" style={{ maxWidth: 720, margin: '0 auto', padding: '48px 32px 120px' }}>
        <div style={{ fontFamily: displayFont, fontWeight: 600, fontSize: 34, color: t.bark, marginBottom: 28 }}>
          {page.title || 'Sin título'}
        </div>
        {page.blocks.map((b) => (
          <ReadOnlyBlock key={b.id} block={b} t={t} />
        ))}
      </div>
    </div>
  );
}

// Renders a single block for the public share view — no inputs, no handlers, just markup.
function ReadOnlyBlock({ block: b, t }) {
  switch (b.type) {
    case 'heading':
      return <div style={{ fontFamily: displayFont, fontWeight: 500, fontSize: 22, marginTop: 18, marginBottom: 6 }}>{b.content}</div>;
    case 'todo':
      return (
        <div style={{ display: 'flex', gap: 10, marginBottom: 6, alignItems: 'flex-start' }}>
          <input type="checkbox" checked={!!b.checked} readOnly style={{ marginTop: 5, accentColor: t.moss }} />
          {b.priority && (
            <span style={{ color: { 1: t.error, 2: t.sun, 3: t.fern }[b.priority], fontSize: 12, marginTop: 3 }}>⚑</span>
          )}
          <span style={{ flex: 1, color: b.checked ? t.fern : t.bark, textDecoration: b.checked ? 'line-through' : 'none' }}>{b.content}</span>
          {b.dueDate && (
            <span style={{ fontSize: 11.5, fontFamily: monoFont, color: t.fern, flexShrink: 0, marginTop: 2 }}>
              {new Date(b.dueDate + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
            </span>
          )}
        </div>
      );
    case 'bullet':
      return (
        <div style={{ display: 'flex', gap: 10, marginBottom: 2 }}>
          <span style={{ color: t.fern }}>•</span>
          <span>{b.content}</span>
        </div>
      );
    case 'numbered':
      return <div style={{ marginBottom: 2 }}>{b.content}</div>;
    case 'quote':
      return (
        <div style={{ borderLeft: `2.5px solid ${t.moss}`, paddingLeft: 14, margin: '10px 0', fontStyle: 'italic', color: t.fern }}>
          {b.content}
        </div>
      );
    case 'callout':
      return (
        <div style={{ display: 'flex', gap: 10, background: t.clay, borderRadius: 8, padding: '10px 14px', margin: '10px 0' }}>
          <span>💡</span>
          <span>{b.content}</span>
        </div>
      );
    case 'toggle':
      return (
        <details style={{ margin: '6px 0' }}>
          <summary style={{ cursor: 'pointer', fontWeight: 500 }}>{b.content || 'Desplegable'}</summary>
          <div style={{ paddingLeft: 12, marginTop: 4, color: t.fern, whiteSpace: 'pre-wrap' }}>{b.body || ''}</div>
        </details>
      );
    case 'divider':
      return <div style={{ height: 1, background: t.clay, margin: '14px 0' }} />;
    case 'image':
      return b.url ? (
        <div style={{ margin: '10px 0' }}>
          <img src={b.url} alt={b.content || ''} style={{ maxWidth: '100%', borderRadius: 8, display: 'block' }} />
          {b.content && <div style={{ fontSize: 12.5, color: t.fern, marginTop: 6, textAlign: 'center' }}>{b.content}</div>}
        </div>
      ) : null;
    case 'table': {
      const rows = b.rows || [];
      return (
        <table style={{ borderCollapse: 'collapse', width: '100%', margin: '12px 0' }}>
          <tbody>
            {rows.map((row, r) => (
              <tr key={r}>
                {row.map((cell, c) => (
                  <td key={c} style={{ border: `1px solid ${t.clay}`, padding: '6px 8px', background: r === 0 ? t.clay : 'transparent', fontWeight: r === 0 ? 600 : 400 }}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );
    }
    case 'embed': {
      if (!b.url) return null;
      const { kind, embedSrc, ratio } = parseEmbedUrl(b.url);
      if (kind === 'generic') {
        return (
          <a href={b.url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', border: `1px solid ${t.clay}`, borderRadius: 8, padding: '12px 14px', margin: '10px 0', color: t.bark, textDecoration: 'none' }}>
            {b.url}
          </a>
        );
      }
      return (
        <div style={{ position: 'relative', width: '100%', paddingTop: ratio || '30%', borderRadius: 8, overflow: 'hidden', margin: '10px 0' }}>
          <iframe src={embedSrc} title="embed" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }} allowFullScreen />
        </div>
      );
    }
    case 'page-link':
      return (
        <div style={{ display: 'flex', gap: 8, padding: '8px 12px', border: `1px dashed ${t.clay}`, borderRadius: 8, margin: '8px 0', color: t.fern, fontSize: 13 }}>
          <span>📄</span>
          <span>Página enlazada (no disponible en este link)</span>
        </div>
      );
    case 'text':
    default: {
      // The shared view doesn't have the rest of the workspace to resolve mentions
      // against, so [[Title]] just becomes plain "Title" text here — clean, not raw syntax.
      const cleanContent = b.content ? b.content.replace(/\[\[([^[\]]+)\]\]/g, '$1') : '';
      return cleanContent ? <div style={{ marginBottom: 4, lineHeight: 1.7 }}>{cleanContent}</div> : <div style={{ height: 20 }} />;
    }
  }
}

