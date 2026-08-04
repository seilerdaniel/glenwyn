import React, { useState } from 'react';
import { displayFont, bodyFont, monoFont, motion } from '../theme';
import { truncateLabel, countWords, getPageMaturity, getPageAge } from '../lib/pageUtils';
import { Trash2, Flag, Repeat, FilePlus, ArrowUpRight, X, ChevronRight } from 'lucide-react';

// Cheap hex→rgba once-alpha helper so badges/tints can reuse theme tokens at low
// opacity (light & dark both work because the source hex is mode-aware).
function hexToRgba(hex, alpha) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '');
  if (!m) return hex;
  const [, r, g, b] = m;
  return `rgba(${parseInt(r, 16)}, ${parseInt(g, 16)}, ${parseInt(b, 16)}, ${alpha})`;
}

export function TasksView({ t, tasks, today, onToggle, onOpenPage }) {
  const [closedGroups, setClosedGroups] = useState(() => new Set(['done']));

  const parsedToday = today || new Date().toISOString().slice(0, 10);
  // Horizon = today + 7 days, computed in UTC so it stays consistent with the
  // YYYY-MM-DD strings that `today` already uses (toISOString is UTC).
  const horizon = (() => {
    const [y, m, d] = parsedToday.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d + 7)).toISOString().slice(0, 10);
  })();

  const pending = tasks.filter((tsk) => !tsk.checked);
  const overdue = pending.filter((tsk) => tsk.dueDate && tsk.dueDate < parsedToday);
  const todayList = pending.filter((tsk) => tsk.dueDate === parsedToday);
  const nextSeven = pending.filter((tsk) => tsk.dueDate && tsk.dueDate > parsedToday && tsk.dueDate <= horizon);
  const later = pending.filter((tsk) => !tsk.dueDate || tsk.dueDate > horizon);
  const done = tasks.filter((tsk) => tsk.checked);

  const groups = [
    { id: 'overdue', label: 'Vencidas', items: overdue, color: t.error },
    { id: 'today', label: 'Hoy', items: todayList, color: t.moss },
    { id: 'next7', label: 'Próximos 7 días', items: nextSeven, color: t.fern },
    { id: 'later', label: 'Sin fecha / Más adelante', items: later, color: t.fern },
  ];

  const toggleGroup = (id) =>
    setClosedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });

  const anyPending = pending.length > 0;

  return (
    <div>
      <div style={{ fontFamily: displayFont, fontWeight: 600, fontSize: 30, color: t.bark, marginBottom: 28 }}>
        Mis tareas
      </div>

      {!anyPending && !done.length && (
        <div style={{ fontSize: 13.5, color: t.fern, marginBottom: 24 }}>
          No tenés tareas todavía. Creá una tarea desde cualquier página (o convertila marcando `- [ ]`)
        </div>
      )}

      {groups.map((group) =>
        group.items.length > 0 ? (
          <div key={group.id} style={{ marginBottom: 22 }}>
            <button
              onClick={() => toggleGroup(group.id)}
              className="glenwyn-focus"
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: group.color,
                textAlign: 'left',
                padding: '4px 0',
                marginBottom: 6,
              }}
            >
              <ChevronRight
                size={13}
                strokeWidth={2}
                style={{ transition: `transform ${motion.fast}`, transform: closedGroups.has(group.id) ? 'none' : 'rotate(90deg)', flexShrink: 0 }}
              />
              <span style={{ fontSize: 11, letterSpacing: '0.04em', textTransform: 'uppercase', fontFamily: monoFont }}>
                {group.label} · {group.items.length}
              </span>
            </button>
            {!closedGroups.has(group.id) &&
              group.items.map((tsk) => (
                <TaskRow key={tsk.blockId} t={t} task={tsk} onToggle={onToggle} onOpenPage={onOpenPage} />
              ))}
          </div>
        ) : null
      )}

      {done.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <button
            onClick={() => toggleGroup('done')}
            aria-expanded={!closedGroups.has('done')}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: t.fern,
              textAlign: 'left',
              padding: '4px 0',
              marginBottom: 6,
              opacity: 0.8,
            }}
          >
            <ChevronRight
              size={13}
              strokeWidth={2}
              style={{ transform: closedGroups.has('done') ? 'rotate(0deg)' : 'rotate(90deg)', transition: `transform ${motion.fast}`, flexShrink: 0 }}
            />
            <span style={{ fontSize: 11, letterSpacing: '0.04em', textTransform: 'uppercase', fontFamily: monoFont }}>
              Completadas · {done.length}
            </span>
          </button>
          {!closedGroups.has('done') &&
            done.map((tsk) => (
              <TaskRow key={tsk.blockId} t={t} task={tsk} onToggle={onToggle} onOpenPage={onOpenPage} />
            ))}
        </div>
      )}
    </div>
  );
}

// Idea #16 del banco de ideas — no es una lista para "obligarte" a conectar todo,
// solo visibilidad de qué páginas no tienen ninguna conexión entrante todavía,
// para decidir vos si enlazarlas, archivarlas, o dejarlas así a propósito.
export function OrphanPagesView({ t, pages, onOpenPage, onArchive }) {
  return (
    <div>
      <div style={{ fontFamily: displayFont, fontWeight: 600, fontSize: 30, color: t.bark, marginBottom: 10 }}>
        Notas huérfanas
      </div>
      <div style={{ fontSize: 13.5, color: t.fern, marginBottom: 28 }}>
        Páginas que ninguna otra enlaza ni menciona todavía — no hace falta conectarlas todas, es solo para que sepas cuáles existen sin red.
      </div>
      {pages.length === 0 ? (
        <div style={{ fontSize: 13.5, color: t.fern }}>Ninguna — todo tu workspace está conectado de alguna forma.</div>
      ) : (
        pages.map((p) => (
          <div
            key={p.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 4px',
              borderBottom: `1px solid ${t.clay}`,
            }}
          >
            <button
              onClick={() => onOpenPage(p.id)}
              className="glenwyn-focus"
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: 14,
                color: t.bark,
                textAlign: 'left',
                overflow: 'hidden',
              }}
            >
              <span>{p.icon || '📄'}</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {p.title || 'Sin título'}
              </span>
            </button>
            <button
              onClick={() => onArchive(p.id)}
              title="Mover a la papelera"
              className="glenwyn-focus"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.fern, flexShrink: 0, display: 'flex' }}
            >
              <Trash2 size={13} strokeWidth={1.75} />
            </button>
          </div>
        ))
      )}
    </div>
  );
}

export function TaskRow({ t, task, onToggle, onOpenPage }) {
  // Priority badges — Todoist-flavored: a soft tinted pill per level instead of a
  // lone flag. Colors derive from the theme tokens (warm red / honey / neutral)
  // with alpha, so they read as "tenue" and survive both light and dark mode.
  const PRIORITY_BADGES = {
    1: { label: 'P1 · Urgente', color: t.error, bg: hexToRgba(t.error, 0.12) },
    2: { label: 'P2 · Alta', color: t.moss, bg: hexToRgba(t.sun, 0.16) },
    3: { label: 'P3 · Normal', color: t.fern, bg: hexToRgba(t.fern, 0.12) },
  };
  const badge = task.priority ? PRIORITY_BADGES[task.priority] : null;

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
      {badge && (
        <span
          title={badge.label}
          style={{
            flexShrink: 0,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 10.5,
            fontFamily: monoFont,
            letterSpacing: '0.02em',
            color: badge.color,
            background: badge.bg,
            border: `1px solid ${hexToRgba(badge.color, 0.28)}`,
            borderRadius: 5,
            padding: '1px 6px',
          }}
        >
          <Flag size={10} strokeWidth={2} fill="currentColor" />
          {badge.label}
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
        {task.recurrence && (
          <Repeat size={11} strokeWidth={1.75} color={t.moss} style={{ marginLeft: 6, verticalAlign: 'middle' }} />
        )}
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

// A small, local map of a page's direct neighbors — not the whole workspace graph,
// just who links here and who this page links out to. Cheap to render (plain SVG,
// no layout library) and more useful in the moment than a global graph would be,
// since you're already looking at one specific idea, not the whole workspace.
export function MiniGraphMap({ t, centerPage, incoming, outgoing, onNavigate }) {
  const MAX_NEIGHBORS = 7;

  const neighbors = [];
  const seenIds = new Set();
  for (const p of incoming) {
    if (seenIds.has(p.id) || neighbors.length >= MAX_NEIGHBORS) continue;
    seenIds.add(p.id);
    neighbors.push({ page: p, direction: 'in' });
  }
  for (const p of outgoing) {
    if (seenIds.has(p.id) || neighbors.length >= MAX_NEIGHBORS) continue;
    seenIds.add(p.id);
    neighbors.push({ page: p, direction: 'out' });
  }

  if (neighbors.length === 0) return null;

  const width = 600;
  const height = 220;
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) / 2 - 50;

  const positioned = neighbors.map((n, i) => {
    const angle = (2 * Math.PI * i) / neighbors.length - Math.PI / 2;
    return { ...n, x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) };
  });

  return (
    <div style={{ marginTop: 40, paddingTop: 20, borderTop: `1px solid ${t.clay}` }}>
      <div
        style={{
          fontSize: 11,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: t.fern,
          fontFamily: monoFont,
          marginBottom: 6,
        }}
      >
        vecinos directos
      </div>
      <svg width="100%" viewBox={`0 0 ${width} ${height}`} style={{ display: 'block', maxWidth: 600 }}>
        {positioned.map((n) => (
          <line
            key={`line-${n.page.id}`}
            x1={cx}
            y1={cy}
            x2={n.x}
            y2={n.y}
            stroke={n.direction === 'in' ? t.sun : t.moss}
            strokeWidth={1.5}
            opacity={0.5}
          />
        ))}
        <circle cx={cx} cy={cy} r={9} fill={t.moss} />
        <text x={cx} y={cy + 24} textAnchor="middle" fontSize={12} fontFamily={bodyFont} fill={t.bark} fontWeight={600}>
          {truncateLabel(centerPage.title || 'Sin título', 22)}
        </text>
        {positioned.map((n) => (
          <g
            key={n.page.id}
            onClick={() => onNavigate(n.page.id)}
            style={{ cursor: 'pointer' }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') onNavigate(n.page.id);
            }}
          >
            <circle cx={n.x} cy={n.y} r={6} fill={n.direction === 'in' ? t.sun : t.moss} opacity={0.85} />
            <text
              x={n.x}
              y={n.y + (n.y > cy ? 18 : -12)}
              textAnchor="middle"
              fontSize={11}
              fontFamily={bodyFont}
              fill={t.fern}
            >
              {truncateLabel(n.page.title || 'Sin título', 16)}
            </text>
          </g>
        ))}
      </svg>
      <div style={{ display: 'flex', gap: 16, fontSize: 11, color: t.fern, marginTop: 4 }}>
        <span><span style={{ color: t.sun }}>●</span> te mencionan</span>
        <span><span style={{ color: t.moss }}>●</span> mencionás</span>
      </div>
    </div>
  );
}

// FASE 2 — Sugerencias de vínculos automáticos. Una sección discreta al pie de la
// página que propone otras notas del workspace con solapamiento de contenido, sin
// llegar a conectar nada por vos: cada sugerencia ofrece insertar el [[enlace]] o
// navegar directo. Los datos ya llegan calculados desde App.jsx (findRelatedPages,
// debounced) — este componente solo los pinta.
export function RelatedNotesSuggestions({ t, suggestions, onInsertLink, onNavigate }) {
  if (!suggestions || suggestions.length === 0) return null;

  return (
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
        Notas relacionadas sugeridas
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {suggestions.map((s) => (
          <div
            key={s.page.id}
            role="button"
            tabIndex={0}
            className="glenwyn-focus"
            onClick={() => onNavigate(s.page.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onNavigate(s.page.id);
              }
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 10px',
              borderRadius: 7,
              cursor: 'pointer',
              background: 'transparent',
              transition: `background ${motion.fast}`,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = t.clay)}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <span style={{ fontSize: 15, flexShrink: 0 }}>{s.page.icon || '📄'}</span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span
                style={{
                  display: 'block',
                  fontSize: 13.5,
                  color: t.bark,
                  fontWeight: 500,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {s.page.title || 'Sin título'}
              </span>
              <span
                style={{
                  display: 'block',
                  fontSize: 11.5,
                  color: t.fern,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {s.matchedTerms && s.matchedTerms.length > 0
                ? `coincide en: ${s.matchedTerms.map((m) => truncateLabel(m, 22)).join(' · ')}`
                : s.page.title}
              </span>
            </span>
            <span
              style={{
                fontSize: 10.5,
                color: t.fern,
                fontFamily: monoFont,
                flexShrink: 0,
                minWidth: 34,
                textAlign: 'right',
              }}
            >
              {(s.score || 0).toFixed(1)}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onInsertLink(s.page);
              }}
              title={`Insertar [[${s.page.title || 'Sin título'}]] en el bloque actual`}
              aria-label={`Insertar enlace a ${s.page.title || 'Sin título'}`}
              className="glenwyn-focus"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                background: t.canvasAlt,
                border: `1px solid ${t.clay}`,
                borderRadius: 6,
                color: t.moss,
                padding: '3px 8px',
                cursor: 'pointer',
                fontSize: 11.5,
                flexShrink: 0,
                transition: `background ${motion.fast}, color ${motion.fast}`,
              }}
            >
              <FilePlus size={12} strokeWidth={1.75} />
              enlazar
            </button>
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                color: t.fern,
                flexShrink: 0,
              }}
              title="Abrir la nota"
            >
              <ArrowUpRight size={13} strokeWidth={1.75} />
            </span>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 11, color: t.fern, marginTop: 6, opacity: 0.75 }}>
        Sugerencias por solapamiento de contenido — click para abrir, o "enlazar" para insertar el [[enlace]].
      </div>
    </div>
  );
}

// Maturity stages for the Inspector's note summary — a Zettelkasten-flavored
// read on how developed a note is, combining its length and how long it's been
// around. Emoji + short label, decided purely from signals that already exist.
function maturityStage(page, backlinkCount) {
  const words = countWords(page);
  const maturity = getPageMaturity(page, backlinkCount);
  const age = getPageAge(page);
  if (age === 'old' && words >= 40) return { emoji: '📜', label: 'Añeja', desc: 'vieja y asentada' };
  if (maturity === 'permanente') return { emoji: '🌳', label: 'Árbol', desc: 'conectada y extensa' };
  if (maturity === 'en_proceso') return { emoji: '🌿', label: 'Brote', desc: 'con conexiones, creciendo' };
  if (words >= 20) return { emoji: '🌱', label: 'Semilla', desc: 'todavía corta' };
  return { emoji: '🌱', label: 'Semilla', desc: 'recién plantada' };
}

// Right-hand Inspector drawer — the Second Brain views (local graph, backlinks,
// related notes) plus a quick maturity/readability summary, moved off the bottom
// of the editor into a retractable right-side panel so the canvas stays clean.
// Slides in from the right with a CSS transform transition. On narrow screens it
// acts as a full-height overlay drawer with a backdrop; on wide screens it's a
// persistent panel that pushes the canvas left.
export function InspectorDrawer({
  t,
  showInspector,
  isNarrow,
  onClose,
  activePage,
  backlinks,
  outgoingLinks,
  relatedSuggestions,
  onNavigate,
  onInsertLink,
  backlinkCount,
}) {
  if (!showInspector) return null;

  const words = activePage ? countWords(activePage) : 0;
  const readMinutes = Math.max(1, Math.ceil(words / 200)); // ~200 words/min
  const stage = activePage ? maturityStage(activePage, backlinkCount) : { emoji: '🌱', label: 'Semilla', desc: '' };

  const panel = (
    <div
      role="complementary"
      aria-label="Inspector de la página"
      style={{
        width: 320,
        flexShrink: 0,
        height: '100%',
        background: t.canvas,
        borderLeft: `1px solid ${t.clay}`,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        animation: 'glenwyn-slide-in-right 150ms ease-out',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px 10px', borderBottom: `1px solid ${t.clay}` }}>
        <span style={{ fontSize: 11, fontFamily: monoFont, textTransform: 'uppercase', letterSpacing: '0.04em', color: t.fern }}>
          Inspector
        </span>
        <button
          onClick={onClose}
          title="Cerrar inspector (Esc)"
          aria-label="Cerrar inspector"
          className="glenwyn-focus"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.fern, display: 'flex', padding: 2 }}
        >
          <X size={15} strokeWidth={1.75} />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '14px' }}>
        {activePage && (
          <div style={{ background: t.canvasAlt, border: `1px solid ${t.clay}`, borderRadius: 10, padding: '12px 14px', marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: t.bark, fontWeight: 600, marginBottom: 8 }}>
              <span>{stage.emoji}</span>
              <span>{stage.label}</span>
              <span style={{ fontWeight: 400, color: t.fern, marginLeft: 'auto', fontSize: 11.5 }}>
                {words} palabras · {readMinutes} min de lectura
              </span>
            </div>
            <div style={{ fontSize: 11.5, color: t.fern }}>
              {stage.desc}
              {backlinkCount > 0 && ` · ${backlinkCount === 1 ? '1 página te menciona' : `${backlinkCount} páginas te mencionan`}`}
            </div>
          </div>
        )}

        {activePage && (backlinks.length > 0 || outgoingLinks.length > 0) && (
          <div style={{ marginBottom: 18 }}>
            <MiniGraphMap
              t={t}
              centerPage={activePage}
              incoming={backlinks}
              outgoing={outgoingLinks}
              onNavigate={onNavigate}
            />
          </div>
        )}

        {activePage && backlinks.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <div
              style={{
                fontSize: 11,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                color: t.fern,
                fontFamily: monoFont,
                marginBottom: 8,
                paddingBottom: 8,
                borderBottom: `1px solid ${t.clay}`,
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
                onClick={() => onNavigate(p.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onNavigate(p.id);
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

        <RelatedNotesSuggestions
          t={t}
          suggestions={relatedSuggestions}
          onInsertLink={onInsertLink}
          onNavigate={onNavigate}
        />
      </div>
    </div>
  );

  if (isNarrow) {
    return (
      <>
        <div
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(20,20,15,0.35)',
            zIndex: 11,
            animation: 'glenwyn-popper 160ms ease-out',
          }}
        />
        <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 12 }}>{panel}</div>
      </>
    );
  }

  return panel;
}


