// Focus mode on a modal the moment it opens.
//
// Every modal in the app opens without moving focus into it — someone using a
// keyboard or screen reader would open "Compartir" or "Ajustes" and still have
// focus sitting wherever it was on the page behind it. This hook fixes that
// once, reused across every modal instead of patching each one separately:
// focus lands on the modal's own container the moment it opens, which is
// enough for a screen reader to announce the dialog and its label, and lets
// Tab naturally reach the first real control inside from there.

import { useRef, useEffect } from 'react';

export function useAutoFocusOnOpen(isOpen) {
  const ref = useRef(null);
  useEffect(() => {
    if (isOpen && ref.current) {
      ref.current.focus();
    }
  }, [isOpen]);
  return ref;
}