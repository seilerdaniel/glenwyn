import React from 'react';
import { displayFont, monoFont } from '../theme';
import { truncateLabel } from '../lib/pageUtils';

export function TasksView({ t, tasks, today, onToggle, onOpenPage }) {
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
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.fern, fontSize: 12.5, flexShrink: 0 }}
            >
              🗑
            </button>
          </div>
        ))
      )}
    </div>
  );
}

export function TaskRow({ t, task, onToggle, onOpenPage }) {
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


