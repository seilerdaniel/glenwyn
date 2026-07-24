import React, { useState, useEffect } from 'react';
import { tokens, displayFont, bodyFont, monoFont } from '../theme';
import { fetchSharedPage } from '../lib/sharedPageRepo';
import { parseEmbedUrl } from '../lib/pageUtils';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function SharedPageView({ token }) {
  const [state, setState] = useState('loading'); // loading | ready | not-found | error
  const [page, setPage] = useState(null);
  const dark = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const t = dark ? tokens.dark : tokens.light;

  useEffect(() => {
    // A malformed token (missing, truncated, or with extra path segments) can never
    // match a real share — treat it as "not found" instead of hitting the RPC and
    // surfacing a raw Postgres type error to a visitor.
    if (!UUID_PATTERN.test(token || '')) {
      setState('not-found');
      return;
    }
    let cancelled = false;
    fetchSharedPage(token)
      .then((result) => {
        if (cancelled) return;
        if (!result) {
          setState('not-found');
        } else {
          setPage(result);
          setState('ready');
        }
      })
      .catch((e) => {
        console.error('Glenwyn: failed to load shared page', e);
        if (!cancelled) setState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  // Best-effort SEO/social metadata for this specific shared page. Important caveat:
  // most social crawlers (Facebook, Twitter, Slack, WhatsApp link previews) don't run
  // JavaScript, so they'll only ever see the generic tags baked into index.html —
  // this only helps clients that do render JS before reading the page.
  useEffect(() => {
    if (!page) return;
    document.title = `${page.title || 'Sin título'} · Glenwyn`;

    const excerpt = page.blocks
      .map((b) => b.content || '')
      .join(' ')
      .trim()
      .slice(0, 160);
    const description = excerpt || 'Una página compartida desde Glenwyn.';

    const setMeta = (selector, content) => {
      const el = document.querySelector(selector);
      if (el) el.setAttribute('content', content);
    };
    setMeta('meta[name="description"]', description);
    setMeta('meta[property="og:title"]', page.title || 'Sin título');
    setMeta('meta[property="og:description"]', description);
    setMeta('meta[name="twitter:title"]', page.title || 'Sin título');
    setMeta('meta[name="twitter:description"]', description);

    return () => {
      document.title = 'Glenwyn';
      setMeta('meta[name="description"]', 'Glenwyn — un espacio de trabajo inmersivo y distraction-free para tus notas, inspirado en Notion. Cozy, minimalista, sin ruido visual.');
      setMeta('meta[property="og:title"]', 'Glenwyn');
      setMeta('meta[property="og:description"]', 'Un espacio de trabajo inmersivo y distraction-free para tus notas.');
      setMeta('meta[name="twitter:title"]', 'Glenwyn');
      setMeta('meta[name="twitter:description"]', 'Un espacio de trabajo inmersivo y distraction-free para tus notas.');
    };
  }, [page]);

  if (state === 'loading') {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: t.canvas, color: t.fern, fontFamily: bodyFont }}>
        cargando…
      </div>
    );
  }

  if (state === 'not-found' || state === 'error') {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: t.canvas, fontFamily: bodyFont, textAlign: 'center', padding: 24 }}>
        <div>
          <div style={{ fontFamily: displayFont, fontSize: 20, color: t.bark, marginBottom: 8 }}>
            {state === 'not-found' ? 'Este link ya no está disponible' : 'Algo salió mal'}
          </div>
          <div style={{ fontSize: 13, color: t.fern }}>
            {state === 'not-found'
              ? 'Puede que quien la compartió haya desactivado el link, o la página ya no exista.'
              : 'Probá recargar la página en un rato.'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: t.canvas, color: t.bark, fontFamily: bodyFont }}>
      <style>{`
        @media (max-width: 640px) {
          .glenwyn-canvas-content { padding-left: 20px !important; padding-right: 20px !important; }
          .glenwyn-topbar { padding-left: 16px !important; padding-right: 16px !important; }
        }
      `}</style>
      <div
        className="glenwyn-topbar"
        style={{
          padding: '10px 28px',
          borderBottom: `1px solid ${t.clay}`,
          fontSize: 12,
          color: t.fern,
          fontFamily: monoFont,
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <span>vista de solo lectura · Glenwyn</span>
        <a href="/" style={{ color: t.moss, textDecoration: 'none' }}>
          ir a Glenwyn →
        </a>
      </div>
      <div className="glenwyn-canvas-content" style={{ maxWidth: 720, margin: '0 auto', padding: '48px 32px 120px' }}>
        <div style={{ fontFamily: displayFont, fontWeight: 600, fontSize: 34, color: t.bark, marginBottom: 28 }}>
          {page.title || 'Sin título'}
        </div>
        {page.blocks.map((b) => (
          <ReadOnlyBlock key={b.id} block={b} t={t} />
        ))}
      </div>
    </div>
  );
}

// Renders a single block for the public share view — no inputs, no handlers, just markup.
function ReadOnlyBlock({ block: b, t }) {
  switch (b.type) {
    case 'heading':
      return <div style={{ fontFamily: displayFont, fontWeight: 500, fontSize: 22, marginTop: 18, marginBottom: 6 }}>{b.content}</div>;
    case 'todo':
      return (
        <div style={{ display: 'flex', gap: 10, marginBottom: 6, alignItems: 'flex-start' }}>
          <input type="checkbox" checked={!!b.checked} readOnly style={{ marginTop: 5, accentColor: t.moss }} />
          {b.priority && (
            <span style={{ color: { 1: t.error, 2: t.sun, 3: t.fern }[b.priority], fontSize: 12, marginTop: 3 }}>⚑</span>
          )}
          <span style={{ flex: 1, color: b.checked ? t.fern : t.bark, textDecoration: b.checked ? 'line-through' : 'none' }}>{b.content}</span>
          {b.dueDate && (
            <span style={{ fontSize: 11.5, fontFamily: monoFont, color: t.fern, flexShrink: 0, marginTop: 2 }}>
              {new Date(b.dueDate + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
            </span>
          )}
        </div>
      );
    case 'bullet':
      return (
        <div style={{ display: 'flex', gap: 10, marginBottom: 2 }}>
          <span style={{ color: t.fern }}>•</span>
          <span>{b.content}</span>
        </div>
      );
    case 'numbered':
      return <div style={{ marginBottom: 2 }}>{b.content}</div>;
    case 'quote':
      return (
        <div style={{ borderLeft: `2.5px solid ${t.moss}`, paddingLeft: 14, margin: '10px 0', fontStyle: 'italic', color: t.fern }}>
          {b.content}
        </div>
      );
    case 'callout':
      return (
        <div style={{ display: 'flex', gap: 10, background: t.clay, borderRadius: 8, padding: '10px 14px', margin: '10px 0' }}>
          <span>💡</span>
          <span>{b.content}</span>
        </div>
      );
    case 'toggle':
      return (
        <details style={{ margin: '6px 0' }}>
          <summary style={{ cursor: 'pointer', fontWeight: 500 }}>{b.content || 'Desplegable'}</summary>
          <div style={{ paddingLeft: 12, marginTop: 4, color: t.fern, whiteSpace: 'pre-wrap' }}>{b.body || ''}</div>
        </details>
      );
    case 'divider':
      return <div style={{ height: 1, background: t.clay, margin: '14px 0' }} />;
    case 'image':
      return b.url ? (
        <div style={{ margin: '10px 0' }}>
          <img src={b.url} alt={b.content || ''} style={{ maxWidth: '100%', borderRadius: 8, display: 'block' }} />
          {b.content && <div style={{ fontSize: 12.5, color: t.fern, marginTop: 6, textAlign: 'center' }}>{b.content}</div>}
        </div>
      ) : null;
    case 'table': {
      const rows = b.rows || [];
      return (
        <table style={{ borderCollapse: 'collapse', width: '100%', margin: '12px 0' }}>
          <tbody>
            {rows.map((row, r) => (
              <tr key={r}>
                {row.map((cell, c) => (
                  <td key={c} style={{ border: `1px solid ${t.clay}`, padding: '6px 8px', background: r === 0 ? t.clay : 'transparent', fontWeight: r === 0 ? 600 : 400 }}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );
    }
    case 'embed': {
      if (!b.url) return null;
      const { kind, embedSrc, ratio } = parseEmbedUrl(b.url);
      if (kind === 'generic') {
        return (
          <a href={b.url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', border: `1px solid ${t.clay}`, borderRadius: 8, padding: '12px 14px', margin: '10px 0', color: t.bark, textDecoration: 'none' }}>
            {b.url}
          </a>
        );
      }
      return (
        <div style={{ position: 'relative', width: '100%', paddingTop: ratio || '30%', borderRadius: 8, overflow: 'hidden', margin: '10px 0' }}>
          <iframe src={embedSrc} title="embed" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }} allowFullScreen />
        </div>
      );
    }
    case 'page-link':
      return (
        <div style={{ display: 'flex', gap: 8, padding: '8px 12px', border: `1px dashed ${t.clay}`, borderRadius: 8, margin: '8px 0', color: t.fern, fontSize: 13 }}>
          <span>📄</span>
          <span>Página enlazada (no disponible en este link)</span>
        </div>
      );
    case 'text':
    default: {
      // The shared view doesn't have the rest of the workspace to resolve mentions
      // against, so [[Title]] just becomes plain "Title" text here — clean, not raw syntax.
      const cleanContent = b.content ? b.content.replace(/\[\[([^[\]]+)\]\]/g, '$1') : '';
      return cleanContent ? <div style={{ marginBottom: 4, lineHeight: 1.7 }}>{cleanContent}</div> : <div style={{ height: 20 }} />;
    }
  }
}

export default SharedPageView;
