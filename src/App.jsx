import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { storage } from './lib/storage';
import { loadPages, savePages, enableSharing, disableSharing, rotateSharing } from './lib/pagesRepo';
import { loadDatabases, createDatabase, updateDatabaseProperties } from './lib/databasesRepo';
import { loadProfile } from './lib/profileRepo';
import { saveVersion, listVersions } from './lib/versionsRepo';
import { uploadImage, deleteUploadedImagesForBlocks } from './lib/storageRepo';
import { supabase } from './lib/supabaseClient';
import AuthGate from './components/AuthGate';
import { tokens, displayFont, bodyFont, monoFont } from './theme';
import SharedPageView from './components/SharedPageView';
import { DatabaseView } from './components/DatabaseViews';
import { TasksView, OrphanPagesView, MiniGraphMap } from './components/SecondBrainViews';
import { PageRow, IconPicker, EmptyState } from './components/SidebarViews';
import Block from './components/Block';

import {
  uid,
  emptyPage,
  PAGE_TEMPLATES,
  getDescendantIds,
  TRASH_RETENTION_MS,
  VERSION_SNAPSHOT_INTERVAL_MS,
  numberedListPosition,
  countWords,
  pageMatchesQuery,
  pageToMarkdown,
  downloadTextFile,
  buildVisibleTree,
  getAncestorChain,
  getBacklinks,
  getBacklinkCounts,
  getOrphanPages,
  getPageMaturity,
  getPageAge,
  truncateLabel,
  getOutgoingLinks,
  newProperty,
  getDatabaseRecords,
  getDefaultPropertyValues,
  getAllTasks,
  computeNextDueDate,
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
  const [databases, setDatabases] = useState([]);
  const [profile, setProfile] = useState(null); // { userId, plan, stripeCustomerId, stripeSubscriptionId, currentPeriodEnd }
  const [databaseViewModes, setDatabaseViewModes] = useState({}); // databaseId -> 'table' | 'board' | 'calendar'
  const [activeId, setActiveId] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [saveState, setSaveState] = useState('idle'); // idle | saving | saved
  const [saveError, setSaveError] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedIds, setExpandedIds] = useState({});
  const [sortMode, setSortMode] = useState('manual'); // 'manual' | 'alphabetical' | 'updated'
  const [inboxPageId, setInboxPageId] = useState(null);
  const [navigationTrail, setNavigationTrail] = useState([]); // idea #36 — last few pages visited this session, most recent first
  const [zenMode, setZenMode] = useState(false); // idea #42, "Modo Zen" — hides sidebar + top bar chrome while writing
  const [deepWorkActive, setDeepWorkActive] = useState(false); // Modo Deep Work — same hiding treatment, but time-boxed
  const [deepWorkSecondsLeft, setDeepWorkSecondsLeft] = useState(0);
  const [deepWorkMenuOpen, setDeepWorkMenuOpen] = useState(false);
  const hideChrome = zenMode || deepWorkActive; // either mode hides the sidebar/top bar the same way
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
  const [orphansViewOpen, setOrphansViewOpen] = useState(false);
  const [topbarMenuOpen, setTopbarMenuOpen] = useState(false);
  const [titleIconPickerOpen, setTitleIconPickerOpen] = useState(false);
  const searchInputRef = useRef(null);
  const saveTimer = useRef(null);
  const knownIds = useRef(new Set()); // ids present in Supabase as of the last successful save
  const blockRefs = useRef({}); // blockId -> focusable DOM node, used to focus the previous block after a delete
  const pagesRef = useRef(pages); // always holds the latest `pages`, so a queued retry never saves stale data
  const activeIdRef = useRef(activeId); // same idea, for knowing which page to auto-snapshot
  const inboxPageIdRef = useRef(null); // same idea again — the global shortcut effect below only runs once
  const isSavingRef = useRef(false);
  const pendingSaveRef = useRef(false);
  const lastVersionAtRef = useRef({}); // pageId -> timestamp of the last snapshot taken this session

  useEffect(() => {
    pagesRef.current = pages;
  }, [pages]);

  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  useEffect(() => {
    inboxPageIdRef.current = inboxPageId;
  }, [inboxPageId]);

  const registerBlockRef = (blockId) => (el) => {
    if (el) blockRefs.current[blockId] = el;
    else delete blockRefs.current[blockId];
  };


  const t = dark ? tokens.dark : tokens.light;

  // ---- Load persisted state ----
  useEffect(() => {
    (async () => {
      try {
        const [loadedPagesResult, prefsResult, databasesResult, profileResult] = await Promise.allSettled([
          loadPages(),
          storage.get('glenwyn:prefs'),
          loadDatabases(),
          loadProfile(),
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
        setDatabases(databasesResult.status === 'fulfilled' ? databasesResult.value : []);
        setProfile(
          profileResult.status === 'fulfilled'
            ? profileResult.value
            : { userId: user.id, plan: 'free', stripeCustomerId: null, stripeSubscriptionId: null, currentPeriodEnd: null }
        );
        if (profileResult.status === 'rejected') {
          console.error('Glenwyn: failed to load profile (falling back to free plan locally)', profileResult.reason);
        }

        const prefs =
          prefsResult.status === 'fulfilled' && prefsResult.value ? JSON.parse(prefsResult.value.value) : null;

        if (prefs) {
          setDark(!!prefs.dark);
          setSidebarOpen(prefs.sidebarOpen !== false);
          setExpandedIds(prefs.expandedIds || {});
          setSortMode(prefs.sortMode || 'manual');
        } else {
          const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
          setDark(prefersDark);
        }

        // Idea #14 — a standing "Bandeja de entrada" page for quick fugitive
        // notes, distinct from wherever you're deliberately organizing things.
        // Remembered by id in local prefs (not a new column) — if that page is
        // ever archived/deleted, or this is the first run, a fresh one is made.
        const inboxExists = prefs?.inboxPageId && loadedPages.some((p) => p.id === prefs.inboxPageId && !p.isArchived);
        if (inboxExists) {
          setInboxPageId(prefs.inboxPageId);
        } else {
          const newInbox = emptyPage('Bandeja de entrada', null, loadedPages.filter((p) => p.parentId === null).length);
          setPages((prev) => [...prev, newInbox]);
          setInboxPageId(newInbox.id);
        }
      } catch (e) {
        console.error('Glenwyn: failed to load pages/prefs', e);
        setPages([emptyPage('Bienvenida')]);
      } finally {
        setLoaded(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `user` only changes via a full remount of Glenwyn, never goes stale here
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
    storage.set('glenwyn:prefs', JSON.stringify({ dark, sidebarOpen, expandedIds, sortMode, inboxPageId })).catch(() => {});
  }, [dark, sidebarOpen, expandedIds, sortMode, inboxPageId, loaded]);


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
      if (mod && e.shiftKey && e.key.toLowerCase() === 'i') {
        e.preventDefault();
        quickCaptureToInbox();
      }
      if (mod && e.key === '.') {
        e.preventDefault();
        setZenMode((f) => !f);
        setDeepWorkActive(false);
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
        setOrphansViewOpen(false);
        setZenMode(false);
        setDeepWorkActive(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- quickCaptureToInbox only touches stable setters and refs, safe to close over once
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
    if (!deepWorkMenuOpen) return;
    const closeIt = () => setDeepWorkMenuOpen(false);
    window.addEventListener('click', closeIt);
    return () => window.removeEventListener('click', closeIt);
  }, [deepWorkMenuOpen]);

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
    setOrphansViewOpen(false);
    if (isNarrow) setSidebarOpen(false);
    setNavigationTrail((prev) => [id, ...prev.filter((x) => x !== id)].slice(0, 8));
  };
  const breadcrumbChain = useMemo(
    () => (activePage ? getAncestorChain(pages, activePage.id) : []),
    [pages, activePage]
  );

  const backlinks = useMemo(
    () => (activePage ? getBacklinks(pages, activePage.id) : []),
    [pages, activePage]
  );

  const outgoingLinks = useMemo(
    () => (activePage ? getOutgoingLinks(pages, activePage.id) : []),
    [pages, activePage]
  );

  // "Hub" pages — highlighted in the sidebar when referenced by 3+ other pages.
  // No AI, no new infra: just a single pass over the backlinks that already exist.
  const backlinkCounts = useMemo(() => getBacklinkCounts(pages), [pages]);
  const HUB_THRESHOLD = 3;

  const allTasks = useMemo(() => getAllTasks(pages), [pages]);
  const orphanPages = useMemo(() => getOrphanPages(pages), [pages]);
  const trailPages = useMemo(
    () =>
      navigationTrail
        .filter((id) => id !== activeId)
        .map((id) => pages.find((p) => p.id === id))
        .filter((p) => p && !p.isArchived)
        .slice(0, 5),
    [navigationTrail, activeId, pages]
  );
  const today = new Date().toISOString().slice(0, 10);

  const activeDatabase = useMemo(
    () => (activePage ? databases.find((d) => d.pageId === activePage.id) : null),
    [databases, activePage]
  );
  const databaseRecords = useMemo(
    () => (activeDatabase ? getDatabaseRecords(pages, activeDatabase.id) : []),
    [pages, activeDatabase]
  );

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

  // Idea #15 del banco de ideas — reduce la fricción de practicar Zettelkasten a
  // un solo atajo: el texto seleccionado se convierte en su propia página nueva,
  // y donde vivía antes queda una mención `[[así]]` apuntando ahí, vía el mismo
  // sistema de menciones que ya existe. Se queda en la página de origen — no
  // navega a la nueva, para no interrumpir en qué estabas trabajando.
  const extractSelectionToPage = (sourcePageId, blockId, selectedText, selectionStart, selectionEnd) => {
    const trimmed = selectedText.trim();
    if (!trimmed) return;

    const newTitle = truncateLabel(trimmed.split('\n')[0], 60);
    const newPageId = uid();
    const newPage = {
      ...emptyPage(newTitle, null, pages.filter((p) => p.parentId === null).length),
      id: newPageId,
      blocks: [{ id: uid(), type: 'text', content: trimmed }],
    };

    setPages((prev) => [
      ...prev.map((p) => {
        if (p.id !== sourcePageId) return p;
        return {
          ...p,
          blocks: p.blocks.map((b) => {
            if (b.id !== blockId) return b;
            const before = b.content.slice(0, selectionStart);
            const after = b.content.slice(selectionEnd);
            return { ...b, content: `${before}[[${newTitle}]]${after}` };
          }),
        };
      }),
      newPage,
    ]);
  };


  // Creates a new page and immediately turns it into a database (Fase A: table
  // view, basic property types). The page has to actually exist in `pages` in
  // Postgres before `databases.page_id` can reference it as a foreign key, so
  // this saves it directly and awaits that — going through the normal debounced
  // autosave here would very likely race and fail with a foreign-key violation.
  const createDatabasePage = async (parentId = null) => {
    const siblings = pages.filter((p) => p.parentId === parentId);
    const newPage = emptyPage('Base de datos sin título', parentId, siblings.length);

    try {
      await savePages(user.id, [newPage], new Set());
    } catch (e) {
      console.error('Glenwyn: failed to save new database page', e);
      setSaveError('No se pudo crear la base de datos. Revisá tu conexión.');
      return;
    }

    const defaultProperties = [
      newProperty('select'),
      newProperty('date'),
    ];
    defaultProperties[0].name = 'Estado';
    defaultProperties[0].options = ['Por hacer', 'En progreso', 'Hecho'];
    defaultProperties[1].name = 'Fecha';

    try {
      const db = await createDatabase(user.id, newPage.id, defaultProperties);
      setDatabases((prev) => [...prev, db]);
      setPages((prev) => [...prev, newPage]);
      setActiveId(newPage.id);
      if (parentId) setExpandedIds((e) => ({ ...e, [parentId]: true }));
    } catch (e) {
      console.error('Glenwyn: failed to create database', e);
      setSaveError('No se pudo crear la base de datos.');
    }
  };

  // Property-schema edits (add/rename/remove a column) persist immediately —
  // they're infrequent, structural changes, not worth batching into the regular
  // debounced page autosave.
  const persistDatabaseProperties = async (databaseId, properties) => {
    setDatabases((prev) => prev.map((d) => (d.id === databaseId ? { ...d, properties } : d)));
    try {
      await updateDatabaseProperties(databaseId, properties);
    } catch (e) {
      console.error('Glenwyn: failed to save database properties', e);
      setSaveError('No se pudieron guardar las propiedades.');
    }
  };

  const addDatabaseProperty = (databaseId) => {
    const db = databases.find((d) => d.id === databaseId);
    if (!db) return;
    persistDatabaseProperties(databaseId, [...db.properties, newProperty('text')]);
  };

  const renameDatabaseProperty = (databaseId, propertyId, name) => {
    const db = databases.find((d) => d.id === databaseId);
    if (!db) return;
    persistDatabaseProperties(
      databaseId,
      db.properties.map((prop) => (prop.id === propertyId ? { ...prop, name } : prop))
    );
  };

  const changeDatabasePropertyType = (databaseId, propertyId, type) => {
    const db = databases.find((d) => d.id === databaseId);
    if (!db) return;
    persistDatabaseProperties(
      databaseId,
      db.properties.map((prop) =>
        prop.id === propertyId
          ? { ...prop, type, options: type === 'select' ? prop.options || ['Opción 1'] : undefined }
          : prop
      )
    );
  };

  const removeDatabaseProperty = (databaseId, propertyId) => {
    const db = databases.find((d) => d.id === databaseId);
    if (!db) return;
    const ok = window.confirm('Esto quita la columna para todos los registros. ¿Continuar?');
    if (!ok) return;
    persistDatabaseProperties(databaseId, db.properties.filter((prop) => prop.id !== propertyId));
  };

  // Fase C — which OTHER database a 'relation' property points to.
  const setPropertyRelatedDatabase = (databaseId, propertyId, relatedDatabaseId) => {
    const db = databases.find((d) => d.id === databaseId);
    if (!db) return;
    persistDatabaseProperties(
      databaseId,
      db.properties.map((prop) => (prop.id === propertyId ? { ...prop, relatedDatabaseId } : prop))
    );
  };

  // Fase C — a rollup needs to know which of THIS database's relation properties
  // to walk, which property on the related records to read, and how to aggregate.
  const setPropertyRollupConfig = (databaseId, propertyId, config) => {
    const db = databases.find((d) => d.id === databaseId);
    if (!db) return;
    persistDatabaseProperties(
      databaseId,
      db.properties.map((prop) => (prop.id === propertyId ? { ...prop, ...config } : prop))
    );
  };

  // Fase D — every new record picks up each property's default value automatically.
  const setPropertyDefaultValue = (databaseId, propertyId, defaultValue) => {
    const db = databases.find((d) => d.id === databaseId);
    if (!db) return;
    persistDatabaseProperties(
      databaseId,
      db.properties.map((prop) => (prop.id === propertyId ? { ...prop, defaultValue } : prop))
    );
  };

  // Record cell edits go through the normal `pages` state and the existing
  // debounced autosave — a record is just a page, so it gets that machinery for free.
  const updateRecordProperty = (recordId, propertyId, value) => {
    setPages((prev) =>
      prev.map((p) => (p.id === recordId ? { ...p, properties: { ...(p.properties || {}), [propertyId]: value } } : p))
    );
  };

  // Toggles a single related record in/out of a 'relation' property's value —
  // the value itself is just an array of page ids, same updateRecordProperty path.
  const toggleRecordRelation = (recordId, propertyId, relatedId) => {
    setPages((prev) =>
      prev.map((p) => {
        if (p.id !== recordId) return p;
        const current = (p.properties && p.properties[propertyId]) || [];
        const next = current.includes(relatedId)
          ? current.filter((id) => id !== relatedId)
          : [...current, relatedId];
        return { ...p, properties: { ...(p.properties || {}), [propertyId]: next } };
      })
    );
  };

  const addDatabaseRecord = (databaseId, parentPageId, initialProperties = {}) => {
    const db = databases.find((d) => d.id === databaseId);
    const siblings = pages.filter((p) => p.databaseId === databaseId);
    const record = {
      ...emptyPage('', parentPageId, siblings.length),
      databaseId,
      // Defaults apply first; an explicit value (e.g. the board's "+ agregar" in a
      // specific column, or the calendar's "+" on a specific day) always wins.
      properties: { ...(db ? getDefaultPropertyValues(db.properties) : {}), ...initialProperties },
    };
    setPages((prev) => [...prev, record]);
  };


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
    // Generated up front (not inside the state updater) so we have a stable id to
    // focus once the new block actually mounts.
    const newId = uid();
    setPages((prev) =>
      prev.map((p) => {
        if (p.id !== pageId) return p;
        const idx = p.blocks.findIndex((b) => b.id === afterId);
        const newBlock = { id: newId, type, content: '' };
        const blocks = [...p.blocks];
        blocks.splice(idx + 1, 0, newBlock);
        return { ...p, blocks };
      })
    );
    // Enter previously created the new block but left focus behind on the old one —
    // repeated Enter presses just kept stacking empty blocks underneath without ever
    // moving there. requestAnimationFrame waits for React to actually mount the new
    // block (and register its ref) before trying to focus it.
    requestAnimationFrame(() => {
      const node = blockRefs.current[newId];
      if (node) node.focus();
    });
  };

  // Idea #14 — the whole point of an inbox is zero friction: jump there and
  // land with the cursor ready to type, in one shortcut, without having to
  // think about where a fleeting thought belongs yet.
  const quickCaptureToInbox = () => {
    const targetId = inboxPageIdRef.current;
    if (!targetId) return;
    selectPage(targetId);
    const inbox = pagesRef.current.find((p) => p.id === targetId);
    if (!inbox || inbox.blocks.length === 0) return;
    addBlock(targetId, inbox.blocks[inbox.blocks.length - 1].id, 'text');
  };

  // Modo Deep Work — a time-boxed session, same visual treatment as Modo Zen
  // (hides sidebar + top bar), but ends on its own when the clock runs out
  // instead of staying hidden until you remember to come back.
  const startDeepWork = (minutes) => {
    setDeepWorkSecondsLeft(minutes * 60);
    setDeepWorkActive(true);
    setDeepWorkMenuOpen(false);
    setZenMode(false); // the two are mutually exclusive, not stacked
  };

  const stopDeepWork = () => {
    setDeepWorkActive(false);
    setDeepWorkSecondsLeft(0);
  };

  useEffect(() => {
    if (!deepWorkActive) return;
    const interval = setInterval(() => {
      setDeepWorkSecondsLeft((s) => {
        if (s <= 1) {
          setDeepWorkActive(false);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [deepWorkActive]);

  // Ctrl/Cmd+D — clones a block (type, content, checked state) directly below itself.
  const duplicateBlock = (pageId, blockId) => {
    const newId = uid();
    setPages((prev) =>
      prev.map((p) => {
        if (p.id !== pageId) return p;
        const idx = p.blocks.findIndex((b) => b.id === blockId);
        if (idx === -1) return p;
        const copy = { ...p.blocks[idx], id: newId };
        const blocks = [...p.blocks];
        blocks.splice(idx + 1, 0, copy);
        return { ...p, blocks };
      })
    );
    requestAnimationFrame(() => {
      const node = blockRefs.current[newId];
      if (node) node.focus();
    });
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

      {/* Modo Zen y Modo Deep Work (idea #42, con temporizador) — sidebar y barra
          superior se ocultan/apagan vía sus propios estilos; este botón queda como
          la única forma visible de salir, para no dejar a nadie atrapado sin saber
          cómo volver — y en Deep Work, también muestra cuánto falta. */}
      {hideChrome && (
        <button
          onClick={() => {
            setZenMode(false);
            stopDeepWork();
          }}
          className="glenwyn-focus"
          title={deepWorkActive ? 'Terminar la sesión de Deep Work (Esc)' : 'Salir del Modo Zen (Esc)'}
          style={{
            position: 'fixed',
            bottom: 18,
            right: 18,
            zIndex: 20,
            background: t.canvasAlt,
            border: `1px solid ${t.clay}`,
            borderRadius: 20,
            padding: '7px 14px',
            fontSize: 12,
            fontFamily: deepWorkActive ? monoFont : 'inherit',
            color: t.fern,
            cursor: 'pointer',
            opacity: 0.55,
            transition: 'opacity 150ms ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = 1)}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = 0.55)}
        >
          {deepWorkActive
            ? `⏱ ${String(Math.floor(deepWorkSecondsLeft / 60)).padStart(2, '0')}:${String(deepWorkSecondsLeft % 60).padStart(2, '0')} · terminar`
            : '↺ salir del Zen'}
        </button>
      )}

      {/* ---- Sidebar ---- */}
      <div
        className={`glenwyn-sidebar${!sidebarOpen ? ' glenwyn-sidebar-closed' : ''}`}
        style={{
          width: sidebarOpen ? 240 : 56,
          background: t.sidebarBg,
          borderRight: `1px solid ${t.clay}`,
          transition: 'width 200ms ease, background-color 150ms ease',
          display: hideChrome ? 'none' : 'flex',
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
                setOrphansViewOpen(false);
                if (isNarrow) setSidebarOpen(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setTasksViewOpen(true);
                  setOrphansViewOpen(false);
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
          {!searchQuery && inboxPageId && (
            <div
              role="button"
              tabIndex={0}
              className="glenwyn-focus"
              title="Notas fugaces — anotá rápido, organizá después"
              onClick={() => selectPage(inboxPageId)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  selectPage(inboxPageId);
                }
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: sidebarOpen ? 'flex-start' : 'center',
                gap: 8,
                padding: '7px 8px',
                borderRadius: 7,
                cursor: 'pointer',
                background: activeId === inboxPageId ? t.clay : 'transparent',
                fontSize: 13.5,
                color: activeId === inboxPageId ? t.bark : t.fern,
                marginBottom: 6,
              }}
            >
              <span style={{ fontSize: 14 }}>📥</span>
              {sidebarOpen && <span>Bandeja de entrada</span>}
            </div>
          )}
          {!searchQuery && (
            <div
              role="button"
              tabIndex={0}
              className="glenwyn-focus"
              title="Páginas que nadie enlaza ni menciona todavía"
              onClick={() => {
                setOrphansViewOpen(true);
                setTasksViewOpen(false);
                if (isNarrow) setSidebarOpen(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setOrphansViewOpen(true);
                  setTasksViewOpen(false);
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
                background: orphansViewOpen ? t.clay : 'transparent',
                fontSize: 13.5,
                color: orphansViewOpen ? t.bark : t.fern,
                marginBottom: 6,
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 14 }}>🝓</span>
                {sidebarOpen && <span>Notas huérfanas</span>}
              </span>
              {sidebarOpen && orphanPages.length > 0 && (
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
                  {orphanPages.length}
                </span>
              )}
            </div>
          )}
          {!searchQuery && sidebarOpen && trailPages.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div
                style={{
                  fontSize: 10.5,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  color: t.fern,
                  fontFamily: monoFont,
                  padding: '4px 8px 2px',
                  opacity: 0.75,
                }}
              >
                Recorrido reciente
              </div>
              {trailPages.map((p) => (
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
                    padding: '5px 8px',
                    borderRadius: 7,
                    cursor: 'pointer',
                    fontSize: 12.5,
                    color: t.fern,
                  }}
                >
                  <span style={{ fontSize: 12.5 }}>{p.icon || '📄'}</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.title || 'Sin título'}
                  </span>
                </div>
              ))}
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
                  isHub={(backlinkCounts[p.id] || 0) >= HUB_THRESHOLD}
                  hubCount={backlinkCounts[p.id] || 0}
                  maturity={getPageMaturity(p, backlinkCounts[p.id] || 0)}
                  age={getPageAge(p)}
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
              <div
                onClick={() => {
                  createDatabasePage(null);
                  setTemplateMenuOpen(false);
                }}
                style={{
                  display: 'flex',
                  gap: 9,
                  alignItems: 'center',
                  padding: '8px 10px',
                  cursor: 'pointer',
                  borderTop: `1px solid ${t.clay}`,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = t.clay)}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <span style={{ fontSize: 14 }}>🗄</span>
                <span>
                  <div style={{ fontSize: 12.5, color: t.bark }}>Base de datos</div>
                  <div style={{ fontSize: 10.5, color: t.fern }}>Tabla con propiedades — estado, fecha, y más</div>
                </span>
              </div>
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
          <div style={{ position: 'relative' }}>
            <button
              className="glenwyn-focus"
              onClick={(e) => {
                e.stopPropagation();
                setDeepWorkMenuOpen((o) => !o);
              }}
              title="Modo Deep Work — sesión de enfoque con temporizador"
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
              <span style={{ fontSize: 14 }}>⏱</span>
              {sidebarOpen && <span>Deep Work</span>}
            </button>
            {deepWorkMenuOpen && (
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  position: 'absolute',
                  bottom: '100%',
                  left: 8,
                  marginBottom: 6,
                  width: 170,
                  background: t.canvas,
                  border: `1px solid ${t.clay}`,
                  borderRadius: 8,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
                  overflow: 'hidden',
                  zIndex: 6,
                }}
              >
                <div style={{ padding: '8px 10px 4px', fontSize: 10.5, color: t.fern, fontFamily: monoFont, textTransform: 'uppercase' }}>
                  Duración de la sesión
                </div>
                {[25, 50, 90].map((minutes) => (
                  <div
                    key={minutes}
                    onClick={() => startDeepWork(minutes)}
                    style={{ padding: '8px 10px', fontSize: 13, color: t.bark, cursor: 'pointer' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = t.clay)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    {minutes} minutos
                  </div>
                ))}
              </div>
            )}
          </div>
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
          {profile && sidebarOpen && (
            <div
              title="Tu plan actual"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '5px 8px',
                fontSize: 11,
                fontFamily: monoFont,
                color: t.fern,
                textTransform: 'uppercase',
                letterSpacing: '0.03em',
              }}
            >
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: profile.plan === 'free' ? t.fern : t.sun }} />
              Plan {profile.plan}
            </div>
          )}
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
            opacity: hideChrome ? 0.12 : 1,
            pointerEvents: hideChrome ? 'none' : 'auto',
            transition: 'opacity 200ms ease',
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
              {tasksViewOpen ? '✓ Mis tareas' : orphansViewOpen ? '🝓 Notas huérfanas' : activePage ? activePage.title || 'Sin título' : ''}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, position: 'relative' }}>
            {!isNarrow && !tasksViewOpen && !orphansViewOpen && activePage && (
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
            {isNarrow && !tasksViewOpen && !orphansViewOpen && activePage && (
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
          <div style={{ width: '100%', maxWidth: activeDatabase ? 920 : 720 }}>
            {tasksViewOpen ? (
              <TasksView
                t={t}
                tasks={allTasks}
                today={today}
                onToggle={(pageId, blockId) => toggleTodo(pageId, blockId)}
                onOpenPage={(pageId) => selectPage(pageId)}
              />
            ) : orphansViewOpen ? (
              <OrphanPagesView t={t} pages={orphanPages} onOpenPage={(pageId) => selectPage(pageId)} onArchive={(pageId) => archivePage(pageId)} />
            ) : !activePage ? (
              <EmptyState t={t} onCreate={() => createPage(null)} />
            ) : activeDatabase ? (
              <DatabaseView
                t={t}
                page={activePage}
                database={activeDatabase}
                databases={databases}
                allPages={pages}
                records={databaseRecords}
                viewMode={databaseViewModes[activeDatabase.id] || 'table'}
                onChangeViewMode={(mode) =>
                  setDatabaseViewModes((prev) => ({ ...prev, [activeDatabase.id]: mode }))
                }
                onRenameProperty={(propId, name) => renameDatabaseProperty(activeDatabase.id, propId, name)}
                onChangePropertyType={(propId, type) => changeDatabasePropertyType(activeDatabase.id, propId, type)}
                onRemoveProperty={(propId) => removeDatabaseProperty(activeDatabase.id, propId)}
                onAddProperty={() => addDatabaseProperty(activeDatabase.id)}
                onSetRelatedDatabase={(propId, relatedDatabaseId) =>
                  setPropertyRelatedDatabase(activeDatabase.id, propId, relatedDatabaseId)
                }
                onSetRollupConfig={(propId, config) => setPropertyRollupConfig(activeDatabase.id, propId, config)}
                onSetDefaultValue={(propId, value) => setPropertyDefaultValue(activeDatabase.id, propId, value)}
                onUpdateCell={updateRecordProperty}
                onToggleRelation={toggleRecordRelation}
                onRenameRecord={renamePage}
                onAddRecord={(overrides) => addDatabaseRecord(activeDatabase.id, activePage.id, overrides)}
                onOpenRecord={(id) => selectPage(id)}
                onDeleteRecord={(id) => archivePage(id)}
              />
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
                    onExtractSelection={(text, start, end) => extractSelectionToPage(activePage.id, b.id, text, start, end)}
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
                {(backlinks.length > 0 || outgoingLinks.length > 0) && (
                  <MiniGraphMap
                    t={t}
                    centerPage={activePage}
                    incoming={backlinks}
                    outgoing={outgoingLinks}
                    onNavigate={selectPage}
                  />
                )}
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
                  ['⌘ / Ctrl + Shift + I', 'Captura rápida — ir a la Bandeja de entrada y empezar a escribir'],
                  ['⌘ / Ctrl + .', 'Modo Zen — oculta todo menos lo que estás escribiendo'],
                  ['?', 'Mostrar esta ayuda'],
                  ['Esc', 'Cerrar el panel abierto'],
                ]},
                { group: 'Dentro de un bloque', items: [
                  ['Enter', 'Nuevo bloque (o salir de una lista si está vacío)'],
                  ['Shift + Enter', 'Salto de línea dentro del bloque'],
                  ['Backspace (línea vacía)', 'Eliminar el bloque y mover el foco arriba'],
                  ['⌘ / Ctrl + D', 'Duplicar el bloque'],
                  ['⌘ / Ctrl + Shift + E (con texto seleccionado)', 'Extraer la selección a una página nueva'],
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


export default function App() {
  // No router dependency — a shared page is just a plain, unauthenticated
  // read-only view keyed off the URL path, entirely separate from the main app.
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/share/')) {
    const token = window.location.pathname.split('/share/')[1];
    return <SharedPageView token={token} />;
  }
  return <AuthGate>{(user) => <Glenwyn user={user} />}</AuthGate>;
}
