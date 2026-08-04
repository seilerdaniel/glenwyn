import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { displayFont, motion, elevation } from '../theme';
import { Star, Trash2, MoreHorizontal, Copy, Link2, Download, History, FolderInput } from 'lucide-react';

export function PageRow({
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
  isHub,
  hubCount,
  maturity,
  age,
  onClick,
  onToggleExpand,
  onDelete,
  onAddSubpage,
  onTogglePin,
  onDuplicate,
  onShare,
  onExport,
  onViewHistory,
  onCopyLink,
  onCopyContent,
  onMoveTo,
  onSetIcon,
  onDragStart,
  onDragEnd,
  onDragOverRow,
  onDropRow,
}) {
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [actionsMenuOpen, setActionsMenuOpen] = useState(false);
  const [actionsMenuPos, setActionsMenuPos] = useState(null);
  const [rowHovered, setRowHovered] = useState(false);
  const actionsButtonRef = useRef(null);

  useEffect(() => {
    if (!iconPickerOpen) return;
    const closeIt = () => setIconPickerOpen(false);
    window.addEventListener('click', closeIt);
    return () => window.removeEventListener('click', closeIt);
  }, [iconPickerOpen]);

  useEffect(() => {
    if (!actionsMenuOpen) return;
    const closeIt = () => setActionsMenuOpen(false);
    window.addEventListener('click', closeIt);
    // El menú se renderiza en un portal, fuera del árbol que scrollea — si el
    // árbol se mueve mientras está abierto, el botón ya no está donde el menú
    // cree que está, así que lo más simple y correcto es cerrarlo.
    window.addEventListener('scroll', closeIt, true);
    window.addEventListener('resize', closeIt);
    return () => {
      window.removeEventListener('click', closeIt);
      window.removeEventListener('scroll', closeIt, true);
      window.removeEventListener('resize', closeIt);
    };
  }, [actionsMenuOpen]);
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
          borderRadius: 6,
          cursor: 'grab',
          background: isDropInside
            ? t.moss + '33'
            : isActive
              ? t.clay
              : rowHovered && sidebarOpen
                ? t.clay + '77'
                : 'transparent',
          transition: `background-color ${motion.fast}`,
          outline: isDropInside ? `1.5px dashed ${t.moss}` : 'none',
          outlineOffset: -1.5,
          marginBottom: 1,
          opacity: isDragging ? 0.4 : 1,
        }}
        onMouseEnter={() => setRowHovered(true)}
        onMouseLeave={() => setRowHovered(false)}
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
          {sidebarOpen && maturity !== 'fugaz' && (
            <span
              title={maturity === 'permanente' ? 'Madura — conectada y con contenido sustancial' : 'En proceso — ya conectada, todavía corta'}
              style={{
                width: 5,
                height: 5,
                borderRadius: '50%',
                background: maturity === 'permanente' ? t.moss : t.sun,
                flexShrink: 0,
              }}
            />
          )}
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
            <span
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                opacity: isActive ? 1 : age === 'old' ? 0.6 : age === 'aging' ? 0.8 : 1,
              }}
              title={age === 'old' ? 'No la tocás hace más de 90 días' : age === 'aging' ? 'No la tocás hace más de 30 días' : undefined}
            >
              {p.title || 'Sin título'}
              {isHub && (
                <span
                  title={`Página muy conectada — ${hubCount} páginas la referencian`}
                  style={{ color: t.sun, fontSize: 10, flexShrink: 0 }}
                >
                  ●
                </span>
              )}
            </span>
          )}
        </div>
        {sidebarOpen && (
          <div
            className="glenwyn-page-actions"
            style={{
              position: 'relative',
              opacity: actionsMenuOpen || rowHovered ? 1 : 0,
              transition: `opacity ${motion.fast}`,
            }}
          >
            <button
              ref={actionsButtonRef}
              onClick={(e) => {
                e.stopPropagation();
                if (!actionsMenuOpen) {
                  const rect = actionsButtonRef.current.getBoundingClientRect();
                  const estimatedMenuHeight = 7 * 37; // 7 ítems, ~37px cada uno
                  const notEnoughSpaceBelow = window.innerHeight - rect.bottom < estimatedMenuHeight;
                  setActionsMenuPos(
                    notEnoughSpaceBelow
                      ? { bottom: window.innerHeight - rect.top + 4, right: window.innerWidth - rect.right }
                      : { top: rect.bottom + 4, right: window.innerWidth - rect.right }
                  );
                }
                setActionsMenuOpen((o) => !o);
              }}
              title="Más acciones"
              aria-label="Más acciones"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: t.fern,
                padding: '2px 4px',
                borderRadius: 4,
                display: 'flex',
              }}
            >
              <MoreHorizontal size={14} strokeWidth={1.75} />
            </button>
            {actionsMenuOpen &&
              actionsMenuPos &&
              createPortal(
                <div
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    position: 'fixed',
                    top: actionsMenuPos.top,
                    bottom: actionsMenuPos.bottom,
                    right: actionsMenuPos.right,
                    width: 190,
                    background: t.canvas,
                    border: `1px solid ${t.clay}`,
                    borderRadius: 8,
                    boxShadow: elevation.menu,
                    zIndex: 50,
                    overflow: 'hidden',
                    animation: 'glenwyn-popper 160ms ease-out',
                  }}
                >
                  {[
                    {
                      key: 'pin',
                      Icon: Star,
                      label: p.pinned ? 'Quitar de favoritos' : 'Agregar a favoritos',
                      onClick: onTogglePin,
                      iconProps: { fill: p.pinned ? t.sun : 'none', color: p.pinned ? t.sun : t.fern },
                    },
                    { key: 'subpage', Icon: undefined, label: 'Agregar subpágina', onClick: onAddSubpage, glyph: '+' },
                    { key: 'duplicate', Icon: Copy, label: 'Duplicar página', onClick: onDuplicate },
                    { key: 'copy-link', Icon: Copy, label: 'Copiar enlace', onClick: onCopyLink },
                    { key: 'share', Icon: Link2, label: 'Compartir', onClick: onShare },
                    { key: 'export', Icon: Download, label: 'Exportar a Markdown', onClick: onExport },
                    { key: 'copy-content', Icon: Copy, label: 'Copiar contenido', onClick: onCopyContent },
                    { key: 'move-to', Icon: FolderInput, label: 'Mover a…', onClick: onMoveTo },
                    { key: 'history', Icon: History, label: 'Historial de versiones', onClick: onViewHistory },
                    { key: 'delete', Icon: Trash2, label: 'Mover a la Papelera', onClick: onDelete },
                  ].map((item) => (
                    <button
                      key={item.key}
                      onClick={(e) => {
                        item.onClick(e);
                        setActionsMenuOpen(false);
                      }}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 9,
                        padding: '8px 12px',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: t.bark,
                        fontSize: 13,
                        textAlign: 'left',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = t.clay)}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      {item.Icon ? (
                        <item.Icon size={14} strokeWidth={1.75} {...(item.iconProps || {})} />
                      ) : (
                        <span style={{ width: 14, textAlign: 'center', color: t.fern }}>{item.glyph}</span>
                      )}
                      {item.label}
                    </button>
                  ))}
                </div>,
                document.body
              )}
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

export function IconPicker({ t, current, onPick }) {
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
        boxShadow: elevation.menu,
        zIndex: 8,
        padding: 8,
        animation: 'glenwyn-popper 160ms ease-out',
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

export function EmptyState({ t, onCreate }) {
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

