import React from 'react';
import { displayFont, monoFont } from '../theme';

// Shared between the public landing page and any future in-app "ver planes"
// view — one source of truth for what's in Free vs Plus, so the two never
// drift out of sync with each other. Numbers match ESTRATEGIA_NEGOCIO.md §3.
export default function PlansComparison({ t, onJoinWaitlist }) {
  const cardStyle = {
    flex: 1,
    minWidth: 240,
    border: `1px solid ${t.clay}`,
    borderRadius: 14,
    padding: '26px 26px 22px',
    background: t.canvasAlt,
  };

  return (
    <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
      <div style={cardStyle}>
        <div style={{ fontFamily: monoFont, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', color: t.fern, marginBottom: 8 }}>
          Free
        </div>
        <div style={{ fontFamily: displayFont, fontSize: 28, fontWeight: 600, color: t.bark, marginBottom: 4 }}>$0</div>
        <div style={{ fontSize: 12.5, color: t.fern, marginBottom: 18 }}>para siempre, sin tarjeta</div>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, lineHeight: 2, color: t.bark }}>
          <li>Páginas ilimitadas</li>
          <li>Backlinks y menciones completo</li>
          <li>Tareas completo</li>
          <li>1 base de datos, hasta 50 registros</li>
          <li>Modo Zen y Deep Work</li>
          <li>Compartir por link</li>
        </ul>
      </div>

      <div style={{ ...cardStyle, border: `1.5px solid ${t.moss}`, position: 'relative' }}>
        <div
          style={{
            position: 'absolute',
            top: -11,
            right: 22,
            background: t.moss,
            color: t.canvas,
            fontSize: 10.5,
            fontFamily: monoFont,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            padding: '3px 10px',
            borderRadius: 20,
          }}
        >
          Próximamente
        </div>
        <div style={{ fontFamily: monoFont, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', color: t.moss, marginBottom: 8 }}>
          Plus
        </div>
        <div style={{ fontFamily: displayFont, fontSize: 28, fontWeight: 600, color: t.bark, marginBottom: 4 }}>A confirmar</div>
        <div style={{ fontSize: 12.5, color: t.fern, marginBottom: 18 }}>todavía estamos validando el precio</div>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, lineHeight: 2, color: t.bark, marginBottom: 20 }}>
          <li>Bases de datos ilimitadas</li>
          <li>Relaciones y rollups entre bases de datos</li>
          <li>Vista de galería</li>
          <li>Historial de versiones completo</li>
          <li>Más almacenamiento de imágenes</li>
        </ul>
        <button
          onClick={onJoinWaitlist}
          className="glenwyn-focus"
          style={{
            width: '100%',
            padding: '10px 16px',
            fontSize: 13.5,
            fontWeight: 600,
            border: 'none',
            borderRadius: 8,
            background: t.moss,
            color: t.canvas,
            cursor: 'pointer',
          }}
        >
          Avisame cuando esté
        </button>
      </div>
    </div>
  );
}
