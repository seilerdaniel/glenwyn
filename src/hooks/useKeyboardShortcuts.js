// Atajos de teclado globales, extraídos de App.jsx.
//
// Maneja la misma combinación de atajos que antes (⌘/Ctrl+\ sidebar, ⌘/Ctrl+K
// búsqueda, ⌘/Ctrl+Shift+? atajos, ⌘. Modo Zen, ⌘⇧N/B/T/H/D/Z/L/P nuevos, ⌘,
// ajustes, ⌘⇧S compartir, ⌘⇧V historial, y Escape para cerrar cualquier
// popover/modal abierto). Se monta una sola vez y nunca se re-arma: todos los
// setters de React son estables entre renders, y las acciones "pesadas" van
// por runPaletteCommandRef / activeIdRef (siempre frescos), igual que en el
// efecto original.

import { useEffect } from 'react';

export function useKeyboardShortcuts({
  setSidebarOpen,
  setSearchOpen,
  setZenMode,
  setDeepWorkActive,
  setShortcutsOpen,
  setTrashOpen,
  setTemplateMenuOpen,
  setHistoryOpen,
  setShareOpen,
  setTasksViewOpen,
  setTopbarMenuOpen,
  setOrphansViewOpen,
  setSettingsOpen,
  setDeepWorkMenuOpen,
  setShowInspector,
  quickCaptureToInbox,
  runPaletteCommandRef,
  activeIdRef,
}) {
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
      if (mod && e.shiftKey && e.key.toLowerCase() === 'g') {
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
      // Atajos nuevos — todos ⌘/Ctrl+Shift+[letra], salvo Ajustes que usa la
      // convención estándar de macOS (⌘,) para preferencias. Cada uno llama al
      // mismo dispatcher que ya usa la paleta de comandos, vía la ref para no
      // quedar pegado a datos viejos (ver comentario junto a runPaletteCommandRef).
      if (mod && e.shiftKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        runPaletteCommandRef.current('new-page');
      }
      if (mod && e.shiftKey && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        runPaletteCommandRef.current('new-database');
      }
      if (mod && e.shiftKey && e.key.toLowerCase() === 't') {
        e.preventDefault();
        runPaletteCommandRef.current('tasks');
      }
      if (mod && e.shiftKey && e.key.toLowerCase() === 'h') {
        e.preventDefault();
        runPaletteCommandRef.current('orphans');
      }
      if (mod && e.shiftKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        runPaletteCommandRef.current('deep-work');
      }
      if (mod && e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        runPaletteCommandRef.current('zen');
      }
      if (mod && e.shiftKey && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        runPaletteCommandRef.current('dark-mode');
      }
      if (mod && e.shiftKey && e.key.toLowerCase() === 'i') {
        e.preventDefault();
        setShowInspector((s) => !s);
      }
      if (mod && e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        runPaletteCommandRef.current('trash');
      }
      if (mod && !e.shiftKey && e.key === ',') {
        e.preventDefault();
        runPaletteCommandRef.current('settings');
      }
      if (mod && e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (activeIdRef.current) runPaletteCommandRef.current('share');
      }
      if (mod && e.shiftKey && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        if (activeIdRef.current) runPaletteCommandRef.current('history');
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
        setSettingsOpen(false);
        setDeepWorkMenuOpen(false);
        setShowInspector(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- quickCaptureToInbox only touches stable setters and refs; every other action goes through runPaletteCommandRef, always safe to close over once
  }, []);
}