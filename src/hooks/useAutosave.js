// Autosave autoguardado (debounced) a Supabase, extraído de App.jsx.
//
// Qué encapsula:
//   - flushSave: guarda pagesRef.current con bloqueo anti-race (isSavingRef +
//     pendingSaveRef) y snapshots de versión de la página activa, throttled.
//   - estado de guardado para la UI (idle | saving | saved) + saveError.
//   - el efecto debounced que dispara flushSave 500ms después de cada cambio.
//
// Comparte unos refs con el componente padre (pagesRef, activeIdRef, knownIds)
// porque el resto de App.jsx también los usa para leer el estado más reciente
// sin re-renderizar. La persencia en Supabase (savePages) y el snapshot de
// versiones (saveVersion) quedan intactos — solo vive ahora su declaración en
// otro archivo.

import { useState, useRef, useEffect, useCallback } from 'react';
import { savePages } from '../lib/pagesRepo';
import { saveVersion } from '../lib/versionsRepo';
import { VERSION_SNAPSHOT_INTERVAL_MS } from '../lib/pageUtils';

export function useAutosave({ user, pages, loaded, pagesRef, activeIdRef, knownIds }) {
  const [saveState, setSaveState] = useState('idle'); // idle | saving | saved
  const [saveError, setSaveError] = useState('');
  const saveTimer = useRef(null);
  const isSavingRef = useRef(false);
  const pendingSaveRef = useRef(false);
  const lastVersionAtRef = useRef({}); // pageId -> timestamp of the last snapshot taken this session

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
  }, [user.id, pagesRef, activeIdRef, knownIds]);

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

  return { saveState, saveError, setSaveError, flushSave, lastVersionAtRef };
}