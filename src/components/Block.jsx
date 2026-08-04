import React, { useState, useRef, useEffect } from 'react';
import { displayFont, bodyFont, monoFont, elevation } from '../theme';
import { Flag, Calendar as CalendarIcon, Lightbulb, FilePlus, Plus, GripVertical } from 'lucide-react';
import {
  SLASH_COMMANDS,
  detectMarkdownShortcut,
  hasMentions,
  parseMentions,
  parseNaturalDateFromText,
} from '../lib/pageUtils';
import { ImageBlock, TableBlock, EmbedBlock, PageLinkBlock, SlashMenu } from './SpecializedBlocks';

// Measures where the caret would sit inside a <textarea> by mirroring its text
// up to that index in a hidden div with identical metrics. Lets the floating
// "convert selection" bar anchor right above the selected text, like Notion.
function measureCaret(el, caretIndex) {
  const text = el.value.slice(0, caretIndex);
  const cs = window.getComputedStyle(el);
  const contentWidth = el.clientWidth;
  const mirror = document.createElement('div');
  const props = [
    'font', 'fontStyle', 'fontWeight', 'fontSize', 'lineHeight', 'letterSpacing',
    'fontFamily', 'whiteSpace', 'wordWrap', 'overflowWrap', 'paddingTop',
    'paddingLeft', 'paddingRight', 'margin', 'border', 'textAlign',
  ];
  props.forEach((p) => {
    if (cs[p]) mirror.style[p] = cs[p];
  });
  mirror.style.position = 'fixed';
  mirror.style.visibility = 'hidden';
  mirror.style.left = '-9999px';
  mirror.style.top = '-9999px';
  mirror.style.width = `${contentWidth}px`;
  mirror.style.boxSizing = 'border-box';
  mirror.style.height = 'auto';
  mirror.textContent = text;
  const marker = document.createElement('ins');
  marker.style.cssText = 'position:relative;visibility:hidden;width:0;height:0;display:inline-block;';
  marker.textContent = '.';
  mirror.appendChild(marker);
  document.body.appendChild(mirror);
  const markerRect = marker.getBoundingClientRect();
  const elRect = el.getBoundingClientRect();
  document.body.removeChild(mirror);
  return { x: markerRect.left - elRect.left, y: markerRect.top - elRect.top };
}

// Left-hand hover controls for a block: a "+" that opens the block's slash menu
// and a drag handle (⋮⋮) prepared for future drag-to-reorder. Revealed on hover
// via .glenwyn-block-row:hover (see the inline <style> in App.jsx), same
// pattern as the sidebar's page actions and the media delete buttons.
function BlockHoverControls({ t, onAdd, onFocusBlock, locked }) {
  if (locked) return null;
  return (
    <div
      className="glenwyn-block-controls"
      style={{
        position: 'absolute',
        left: -38,
        top: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 1,
        padding: '4px 0',
      }}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onAdd();
        }}
        title="Agregar un bloque"
        aria-label="Agregar un bloque"
        className="glenwyn-focus"
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.fern, display: 'flex', padding: 2, borderRadius: 4 }}
      >
        <Plus size={15} strokeWidth={2} />
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onFocusBlock();
        }}
        title="Arrastrar para mover el bloque"
        aria-label="Mover el bloque"
        className="glenwyn-focus"
        style={{ background: 'none', border: 'none', cursor: 'grab', color: t.fern, display: 'flex', padding: 2, borderRadius: 4 }}
      >
        <GripVertical size={14} strokeWidth={2} />
      </button>
    </div>
  );
}

function Block({
  block,
  t,
  locked,
  onChange,
  onEnter,
  onExtractSelection,
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
  // Idea #60 — "Bloquear página" neutralizes every content-mutating handler
  // right here, once, instead of touching each block type's JSX individually.
  // onToggleOpen (expand/collapse a toggle block) and onNavigate (follow a link)
  // stay active on purpose — those are navigation, not edits.
  const noop = () => {};
  if (locked) {
    onChange = noop;
    onEnter = noop;
    onExtractSelection = noop;
    onToggle = noop;
    onDueDateChange = noop;
    onCyclePriority = noop;
    onRecurrenceChange = noop;
    onConvert = noop;
    onDuplicate = noop;
    onToggleBodyChange = noop;
    onImageUrlChange = noop;
    onUploadFile = noop;
    onEmbedUrlChange = noop;
    onTableCellChange = noop;
    onTableAddRow = noop;
    onTableAddColumn = noop;
    onTableRemoveRow = noop;
    onTableRemoveColumn = noop;
    onDelete = noop;
    onSetPageLink = noop;
  }

  const ref = useRef(null);
  const bodyRef = useRef(null);
  const [slashOpen, setSlashOpen] = useState(false);
  const [slashIndex, setSlashIndex] = useState(0);
  const [isTextFocused, setIsTextFocused] = useState(false);
  const [mentionTrigger, setMentionTrigger] = useState(null); // { startIndex, query } | null
  const [mentionIndex, setMentionIndex] = useState(0);
  const [selectionBar, setSelectionBar] = useState(null); // { start, end, x, y } | null

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

  // Opens the slash menu from the left-hand "+" hover control, and focuses the
  // block itself so the very next keystroke keeps typing in it. Same menu the
  // user gets by typing "/", just triggered by pointer instead.
  const openSlashMenu = () => {
    setSlashOpen(true);
    setSlashIndex(0);
    if (ref.current) ref.current.focus();
  };

  const focusBlock = () => {
    if (ref.current) ref.current.focus();
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
    // Idea #15 — select some text in a paragraph and pull it out into its own
    // atomic page in one shortcut, instead of copy/create-page/paste/link by hand.
    if (block.type === 'text' && (e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'E' || e.key === 'e')) {
      const { selectionStart, selectionEnd } = e.target;
      if (selectionStart !== selectionEnd) {
        e.preventDefault();
        onExtractSelection(block.content.slice(selectionStart, selectionEnd), selectionStart, selectionEnd);
      }
      return;
    }
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
    if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'd') {
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

  // Updates the floating "convert selection" bar whenever the textarea's active
  // selection changes (drag select, double-click, arrow keys). Reads the DOM
  // textarea's selectionStart/selectionEnd because the controlled value alone
  // can't tell us where the selection sits.
  const refreshSelectionBar = (input) => {
    if (!input || locked || block.type !== 'text') {
      setSelectionBar(null);
      return;
    }
    const start = input.selectionStart;
    const end = input.selectionEnd;
    if (start == null || end == null || start === end || !block.content.slice(start, end).trim()) {
      setSelectionBar(null);
      return;
    }
    const pos = measureCaret(input, end);
    setSelectionBar({ start, end, x: pos.x, y: pos.y });
  };

  const convertSelection = () => {
    if (!selectionBar) return;
    onExtractSelection(
      block.content.slice(selectionBar.start, selectionBar.end),
      selectionBar.start,
      selectionBar.end
    );
    setSelectionBar(null);
  };

  const sharedTextareaStyle = {
    width: '100%',
    border: 'none',
    outline: 'none',
    background: 'transparent',
    fontFamily: bodyFont,
    fontSize: 15.5,
    lineHeight: 1.75,
    letterSpacing: '0.005em',
    color: t.bark,
    marginBottom: 4,
  };

  if (block.type === 'divider') {
    return (
      <div
        className="glenwyn-divider-row glenwyn-block-row"
        style={{ position: 'relative', display: 'flex', alignItems: 'center', margin: '14px 0' }}
      >
        <BlockHoverControls t={t} onAdd={openSlashMenu} onFocusBlock={focusBlock} locked={locked} />
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
      <div className="glenwyn-block-row" style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 6, position: 'relative' }}>
        <BlockHoverControls t={t} onAdd={openSlashMenu} onFocusBlock={focusBlock} locked={locked} />
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
          readOnly={locked}
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
            marginTop: 6,
            padding: 0,
            flexShrink: 0,
            display: 'flex',
          }}
        >
          <Flag size={13} strokeWidth={1.75} fill={priorityColor} />
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
          <span style={{ display: 'flex', alignItems: 'center' }}>
            {block.dueDate ? (
              new Date(block.dueDate + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
            ) : (
              <CalendarIcon size={12} strokeWidth={1.75} />
            )}
          </span>
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
      <div className="glenwyn-block-row" style={{ position: 'relative' }}>
        <BlockHoverControls t={t} onAdd={openSlashMenu} onFocusBlock={focusBlock} locked={locked} />
        <textarea
          ref={setMainRef}
          className="glenwyn-block glenwyn-focus"
          readOnly={locked}
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
            marginTop: 24,
            marginBottom: 6,
          }}
        />
        {slashOpen && <SlashMenu t={t} commands={filteredCommands} index={slashIndex} onPick={runCommand} />}
      </div>
    );
  }

  if (block.type === 'bullet' || block.type === 'numbered') {
    return (
      <div className="glenwyn-block-row" style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 2, position: 'relative' }}>
        <BlockHoverControls t={t} onAdd={openSlashMenu} onFocusBlock={focusBlock} locked={locked} />
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
          readOnly={locked}
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
        className="glenwyn-block-row"
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
        <BlockHoverControls t={t} onAdd={openSlashMenu} onFocusBlock={focusBlock} locked={locked} />
        <textarea
          ref={setMainRef}
          className="glenwyn-block glenwyn-focus"
          readOnly={locked}
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
        className="glenwyn-block-row"
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
        <BlockHoverControls t={t} onAdd={openSlashMenu} onFocusBlock={focusBlock} locked={locked} />
        <Lightbulb size={16} strokeWidth={1.75} style={{ marginTop: 2, flexShrink: 0 }} color={t.fern} />
        <textarea
          ref={setMainRef}
          className="glenwyn-block glenwyn-focus"
          readOnly={locked}
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
      <div className="glenwyn-block-row" style={{ margin: '2px 0', position: 'relative' }}>
        <BlockHoverControls t={t} onAdd={openSlashMenu} onFocusBlock={focusBlock} locked={locked} />
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
            readOnly={locked}
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
    <div className="glenwyn-block-row" style={{ position: 'relative' }}>
      <BlockHoverControls t={t} onAdd={openSlashMenu} onFocusBlock={focusBlock} locked={locked} />
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
          readOnly={locked}
          rows={1}
          value={block.content}
          onChange={(e) => handleChange(e.target.value, e.target.selectionStart)}
          onKeyDown={handleKeyDown}
          onSelect={(e) => refreshSelectionBar(e.target)}
          onMouseUp={(e) => refreshSelectionBar(e.currentTarget)}
          onKeyUp={(e) => refreshSelectionBar(e.currentTarget)}
          onFocus={() => setIsTextFocused(true)}
          onBlur={() => {
            setIsTextFocused(false);
            setMentionTrigger(null);
            setSelectionBar(null);
          }}
          placeholder="Escribe algo, '/' para comandos, [[ para mencionar una página, o Enter para una línea nueva…"
          style={sharedTextareaStyle}
        />
      )}
      {selectionBar && (
        <div
          role="toolbar"
          aria-label="Convertir selección"
          onMouseDown={(e) => e.preventDefault()}
          style={{
            position: 'absolute',
            left: Math.max(0, Math.min(selectionBar.x, 400)),
            top: selectionBar.y - 44,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '3px',
            background: t.bark,
            color: t.canvas,
            borderRadius: 7,
            boxShadow: elevation.menu,
            zIndex: 6,
            fontSize: 12,
            animation: 'glenwyn-popper 160ms ease-out',
          }}
        >
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={convertSelection}
            title="Crear nota atómica con el texto seleccionado"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 8px',
              background: 'transparent',
              border: 'none',
              color: t.canvas,
              cursor: 'pointer',
              borderRadius: 4,
            }}
          >
            <FilePlus size={14} />
            <span>Crear nota atómica</span>
          </button>
        </div>
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
            boxShadow: elevation.menu,
            zIndex: 5,
            overflow: 'hidden',
            animation: 'glenwyn-popper 160ms ease-out',
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



export default Block;
