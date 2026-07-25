import React, { useState, useRef } from 'react';
import { bodyFont } from '../theme';
import { isHttpUrl, parseEmbedUrl } from '../lib/pageUtils';
import { X, Image as ImageIcon, ExternalLink, FileText } from 'lucide-react';

export function ImageBlock({ block, t, onUrlChange, onCaptionChange, onDelete, onUploadFile }) {
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
          <ImageIcon size={15} strokeWidth={1.75} color={t.fern} />
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
        <X size={13} strokeWidth={1.75} />
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

export function TableBlock({ block, t, onCellChange, onAddRow, onAddColumn, onRemoveRow, onRemoveColumn, onDelete }) {
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
                      <X size={13} strokeWidth={1.75} />
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
                    <X size={13} strokeWidth={1.75} />
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

export function EmbedBlock({ block, t, onUrlChange, onDelete }) {
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
        <X size={13} strokeWidth={1.75} />
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
          <div style={{ fontSize: 11.5, color: t.fern, marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
            Abrir enlace <ExternalLink size={11} strokeWidth={1.75} />
          </div>
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

export function PageLinkBlock({ block, t, allPages, onNavigate, onSetPageLink, onDelete }) {
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
                <FileText size={14} strokeWidth={1.75} />
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
        <FileText size={14} strokeWidth={1.75} />
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
      <FileText size={14} strokeWidth={1.75} />
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
        <X size={13} strokeWidth={1.75} />
      </button>
    </div>
  );
}

export function SlashMenu({ t, commands, index, onPick }) {
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
