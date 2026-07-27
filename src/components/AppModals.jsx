import React from 'react';
import { displayFont, monoFont, bodyFont } from '../theme';
import { FolderInput, FileText, Type, Check } from 'lucide-react';

// ---- Mover a ----
export function MoveToModal({
  t,
  moveToOpen,
  movingPageId,
  moveToQuery,
  setMoveToQuery,
  setMoveToOpen,
  moveToModalRef,
  pages,
  getDescendantIds,
  moveToNewParent,
}) {
  if (!(moveToOpen && movingPageId)) return null;

  const forbidden = new Set([movingPageId, ...getDescendantIds(pages, movingPageId)]);
  const movingPage = pages.find((p) => p.id === movingPageId);
  const candidates = pages.filter(
    (p) => !p.isArchived && !forbidden.has(p.id) && !p.databaseId &&
      (!moveToQuery || (p.title || '').toLowerCase().includes(moveToQuery.toLowerCase()))
  );
  const rootMatches = !moveToQuery || 'sin página superior'.includes(moveToQuery.toLowerCase());

  return (
    <div
      onClick={() => setMoveToOpen(false)}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20 }}
    >
      <div
        ref={moveToModalRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Mover página"
        style={{
          width: 380,
          maxWidth: '90vw',
          maxHeight: '70vh',
          display: 'flex',
          flexDirection: 'column',
          background: t.canvas,
          border: `1px solid ${t.clay}`,
          borderRadius: 10,
          boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '14px 16px', borderBottom: `1px solid ${t.clay}`, fontFamily: displayFont, fontSize: 16, fontWeight: 600, color: t.bark }}>
          Mover a…
        </div>
        <input
          className="glenwyn-focus"
          autoFocus
          value={moveToQuery}
          onChange={(e) => setMoveToQuery(e.target.value)}
          placeholder="Buscar una página…"
          style={{ border: 'none', borderBottom: `1px solid ${t.clay}`, outline: 'none', background: 'transparent', padding: '10px 16px', fontSize: 13.5, color: t.bark }}
        />
        <div className="glenwyn-scroll" style={{ overflowY: 'auto', padding: '4px 0' }}>
          {rootMatches && movingPage?.parentId !== null && (
            <button
              onClick={() => moveToNewParent(movingPageId, null)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: '9px 16px', background: 'none', border: 'none', cursor: 'pointer', color: t.fern, fontSize: 13.5, textAlign: 'left' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = t.clay)}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <FolderInput size={14} strokeWidth={1.75} />
              Sin página superior (nivel principal)
            </button>
          )}
          {candidates.length === 0 && !rootMatches && (
            <div style={{ padding: '12px 16px', fontSize: 12.5, color: t.fern }}>No encontramos ninguna página.</div>
          )}
          {candidates.map((p) => (
            <button
              key={p.id}
              onClick={() => moveToNewParent(movingPageId, p.id)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: '9px 16px', background: 'none', border: 'none', cursor: 'pointer', color: t.bark, fontSize: 13.5, textAlign: 'left' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = t.clay)}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              {p.icon ? <span style={{ fontSize: 14 }}>{p.icon}</span> : <FileText size={14} strokeWidth={1.75} />}
              {p.title || 'Sin título'}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---- Personalizar página ----
export function PersonalizeModal({
  t,
  personalizeOpen,
  setPersonalizeOpen,
  personalizeModalRef,
  activePage,
  setPageFontStyle,
  toggleSmallText,
}) {
  if (!(personalizeOpen && activePage)) return null;

  return (
    <div
      onClick={() => setPersonalizeOpen(false)}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20 }}
    >
      <div
        ref={personalizeModalRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Personalizar página"
        style={{ width: 320, maxWidth: '90vw', background: t.canvas, border: `1px solid ${t.clay}`, borderRadius: 10, boxShadow: '0 12px 40px rgba(0,0,0,0.25)', overflow: 'hidden' }}
      >
        <div style={{ padding: '14px 16px', borderBottom: `1px solid ${t.clay}`, fontFamily: displayFont, fontSize: 16, fontWeight: 600, color: t.bark }}>
          Personalizar página
        </div>
        <div style={{ padding: 16 }}>
          <div style={{ fontSize: 11, fontFamily: monoFont, textTransform: 'uppercase', color: t.fern, marginBottom: 8 }}>
            Fuente
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
            {[
              { id: 'default', label: 'Aa', name: 'Por defecto', family: bodyFont },
              { id: 'serif', label: 'Aa', name: 'Serif', family: displayFont },
              { id: 'mono', label: 'Aa', name: 'Mono', family: monoFont },
            ].map((opt) => (
              <button
                key={opt.id}
                onClick={() => setPageFontStyle(activePage.id, opt.id)}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                  padding: '10px 8px',
                  border: `1.5px solid ${(activePage.fontStyle || 'default') === opt.id ? t.moss : t.clay}`,
                  borderRadius: 8,
                  background: (activePage.fontStyle || 'default') === opt.id ? t.canvasAlt : 'transparent',
                  cursor: 'pointer',
                }}
              >
                <span style={{ fontFamily: opt.family, fontSize: 17, color: t.bark }}>{opt.label}</span>
                <span style={{ fontSize: 10.5, color: t.fern }}>{opt.name}</span>
              </button>
            ))}
          </div>
          <button
            onClick={() => toggleSmallText(activePage.id)}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', border: `1px solid ${t.clay}`, borderRadius: 8, background: 'none', cursor: 'pointer', color: t.bark, fontSize: 13.5 }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Type size={14} strokeWidth={1.75} />
              Texto pequeño
            </span>
            {activePage.smallText && <Check size={14} strokeWidth={2} color={t.moss} />}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- Keyboard shortcuts help ----
const SHORTCUT_SECTIONS = [
  { group: 'General', items: [
    ['⌘ / Ctrl + \\', 'Colapsar / expandir el sidebar'],
    ['⌘ / Ctrl + K', 'Buscar páginas o ejecutar un comando (↑↓ para navegar)'],
    ['⌘ / Ctrl + Shift + N', 'Nueva página'],
    ['⌘ / Ctrl + Shift + B', 'Nueva base de datos'],
    ['⌘ / Ctrl + Shift + I', 'Captura rápida — ir a la Bandeja de entrada y empezar a escribir'],
    ['⌘ / Ctrl + Shift + T', 'Ver Mis tareas'],
    ['⌘ / Ctrl + Shift + H', 'Ver Notas huérfanas'],
    ['⌘ / Ctrl + .', 'Modo Zen — oculta todo menos lo que estás escribiendo'],
    ['⌘ / Ctrl + Shift + D', 'Iniciar / terminar Deep Work'],
    ['⌘ / Ctrl + Shift + L', 'Cambiar modo claro / oscuro'],
    ['⌘ / Ctrl + Shift + P', 'Ver Papelera'],
    ['⌘ / Ctrl + ,', 'Abrir Ajustes'],
    ['⌘ / Ctrl + Shift + S', 'Compartir la página activa'],
    ['⌘ / Ctrl + Shift + V', 'Ver historial de versiones de la página activa'],
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
];

export function ShortcutsModal({ t, shortcutsOpen, setShortcutsOpen, shortcutsModalRef }) {
  if (!shortcutsOpen) return null;

  return (
    <div
      onClick={() => setShortcutsOpen(false)}
      style={{ position: 'fixed', inset: 0, background: 'rgba(20,20,15,0.35)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '10vh', zIndex: 10 }}
    >
      <div
        ref={shortcutsModalRef}
        tabIndex={-1}
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
        <div style={{ padding: '14px 16px', borderBottom: `1px solid ${t.clay}`, fontFamily: displayFont, fontSize: 17, fontWeight: 600, color: t.bark }}>
          Atajos de teclado
        </div>
        <div className="glenwyn-scroll" style={{ overflowY: 'auto', padding: '4px 0' }}>
          {SHORTCUT_SECTIONS.map((section) => (
            <div key={section.group} style={{ padding: '10px 16px' }}>
              <div style={{ fontSize: 10.5, letterSpacing: '0.04em', textTransform: 'uppercase', color: t.fern, fontFamily: monoFont, marginBottom: 6 }}>
                {section.group}
              </div>
              {section.items.map(([keys, desc]) => (
                <div key={keys} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '4px 0', fontSize: 12.5 }}>
                  <span style={{ color: t.fern, flex: 1 }}>{desc}</span>
                  <span style={{ fontFamily: monoFont, color: t.bark, background: t.clay, borderRadius: 4, padding: '1px 6px', flexShrink: 0, whiteSpace: 'nowrap' }}>
                    {keys}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
