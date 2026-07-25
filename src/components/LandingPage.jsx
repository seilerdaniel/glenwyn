import React from 'react';
import { tokens, displayFont, bodyFont, monoFont } from '../theme';
import PlansComparison from './PlansComparison';

const FEATURES = [
  {
    icon: '🔗',
    title: 'Notas conectadas de verdad',
    body: 'Escribí [[así]] en medio de una oración y Glenwyn arma el link solo. Cada página lleva un panel de "quién te menciona" y un mini-mapa de vecinos — el diferencial de Obsidian, sin salir de tu flujo de escritura.',
  },
  {
    icon: '🗄',
    title: 'Bases de datos reales',
    body: 'Tabla, tablero, calendario, galería — cuatro formas de ver los mismos registros. Relaciones entre bases de datos, y rollups que agregan (contar, sumar, promediar) sin que armes una fórmula.',
  },
  {
    icon: '◐',
    title: 'Foco real, no solo una promesa',
    body: 'Modo Zen oculta todo menos lo que estás escribiendo. Deep Work suma un temporizador de verdad, con cuenta regresiva, para sesiones que empiezan y terminan solas.',
  },
  {
    icon: '📥',
    title: 'Un espacio que entiende cómo pensás',
    body: 'Bandeja de entrada para lo fugaz, notas huérfanas para lo que quedó sin conectar, un indicador de madurez que distingue un borrador de una idea asentada — herramientas de Zettelkasten real, no solo jerarquía con otro nombre.',
  },
];

const FAQ = [
  {
    q: '¿Mis notas son privadas?',
    a: 'Sí. Cada cuenta tiene sus datos aislados a nivel de base de datos (Row Level Security) — técnicamente, nadie más puede leer tu contenido, ni siquiera si hubiera un error en el código de la app.',
  },
  {
    q: '¿Puedo sacar mis datos si me quiero ir?',
    a: 'Sí, en cualquier momento — un botón exporta todo tu workspace a un .zip con Markdown real e imágenes incluidas, no solo links que podrían dejar de funcionar.',
  },
  {
    q: '¿Hace falta tarjeta para el plan gratis?',
    a: 'No. El plan Free es gratis para siempre, sin tarjeta, y ya incluye páginas ilimitadas, backlinks, menciones, tareas, y una base de datos.',
  },
];

export default function LandingPage({ onLogin, onSignup }) {
  const dark = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const t = dark ? tokens.dark : tokens.light;

  const sectionStyle = { maxWidth: 880, margin: '0 auto', padding: '0 28px' };

  return (
    <div style={{ minHeight: '100vh', background: t.canvas, color: t.bark, fontFamily: bodyFont }}>
      {/* ---- Header ---- */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 5,
          background: t.canvas,
          borderBottom: `1px solid ${t.clay}`,
        }}
      >
        <div style={{ ...sectionStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 28px' }}>
          <div style={{ fontFamily: displayFont, fontWeight: 600, fontSize: 21, color: t.moss }}>Glenwyn</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={onLogin}
              className="glenwyn-focus"
              style={{ background: 'none', border: 'none', fontSize: 13.5, color: t.fern, cursor: 'pointer', padding: '8px 10px' }}
            >
              Iniciar sesión
            </button>
            <button
              onClick={onSignup}
              className="glenwyn-focus"
              style={{
                background: t.moss,
                border: 'none',
                borderRadius: 8,
                fontSize: 13.5,
                fontWeight: 600,
                color: t.canvas,
                cursor: 'pointer',
                padding: '9px 16px',
              }}
            >
              Crear cuenta
            </button>
          </div>
        </div>
      </header>

      {/* ---- Hero ---- */}
      <section style={{ ...sectionStyle, padding: '80px 28px 60px', textAlign: 'center' }}>
        <div
          style={{
            fontFamily: monoFont,
            fontSize: 11.5,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: t.fern,
            marginBottom: 18,
          }}
        >
          Un second brain, no otro clon de Notion
        </div>
        <h1 style={{ fontFamily: displayFont, fontWeight: 600, fontSize: 46, lineHeight: 1.15, margin: '0 0 20px', color: t.bark }}>
          Tu segundo cerebro,<br />con calma.
        </h1>
        <p style={{ fontSize: 17, lineHeight: 1.7, color: t.fern, maxWidth: 560, margin: '0 auto 32px' }}>
          Notas conectadas, bases de datos reales, y un espacio pensado para escribir sin ruido — no para organizar por organizar.
        </p>
        <button
          onClick={onSignup}
          className="glenwyn-focus"
          style={{
            background: t.moss,
            border: 'none',
            borderRadius: 10,
            fontSize: 15.5,
            fontWeight: 600,
            color: t.canvas,
            cursor: 'pointer',
            padding: '13px 28px',
          }}
        >
          Crear cuenta gratis
        </button>
        <div style={{ fontSize: 12, color: t.fern, marginTop: 10 }}>Gratis para siempre, sin tarjeta.</div>
      </section>

      {/* ---- Features ---- */}
      <section style={{ ...sectionStyle, padding: '40px 28px 70px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
          {FEATURES.map((f) => (
            <div
              key={f.title}
              style={{
                border: `1px solid ${t.clay}`,
                borderRadius: 14,
                padding: '26px 24px',
                background: t.canvasAlt,
              }}
            >
              <div style={{ fontSize: 26, marginBottom: 14 }}>{f.icon}</div>
              <div style={{ fontFamily: displayFont, fontWeight: 600, fontSize: 18, marginBottom: 8, color: t.bark }}>{f.title}</div>
              <div style={{ fontSize: 14, lineHeight: 1.7, color: t.fern }}>{f.body}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ---- Pricing ---- */}
      <section style={{ ...sectionStyle, padding: '20px 28px 70px' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h2 style={{ fontFamily: displayFont, fontWeight: 600, fontSize: 30, margin: '0 0 8px', color: t.bark }}>
            Simple, sin sorpresas
          </h2>
          <p style={{ fontSize: 14.5, color: t.fern }}>El plan gratis ya es completo para un second brain de verdad.</p>
        </div>
        <PlansComparison t={t} onJoinWaitlist={() => (window.location.href = '/planes')} />
      </section>

      {/* ---- FAQ ---- */}
      <section style={{ ...sectionStyle, padding: '20px 28px 80px' }}>
        <h2 style={{ fontFamily: displayFont, fontWeight: 600, fontSize: 26, margin: '0 0 24px', color: t.bark, textAlign: 'center' }}>
          Preguntas frecuentes
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {FAQ.map((item) => (
            <div key={item.q}>
              <div style={{ fontSize: 15, fontWeight: 600, color: t.bark, marginBottom: 5 }}>{item.q}</div>
              <div style={{ fontSize: 14, lineHeight: 1.7, color: t.fern }}>{item.a}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ---- Footer ---- */}
      <footer style={{ borderTop: `1px solid ${t.clay}`, padding: '28px 28px' }}>
        <div
          style={{
            ...sectionStyle,
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: 0,
          }}
        >
          <div style={{ fontSize: 12, color: t.fern }}>© {new Date().getFullYear()} Glenwyn</div>
          <div style={{ display: 'flex', gap: 18, fontSize: 12, flexWrap: 'wrap' }}>
            <a href="/guia.html" target="_blank" rel="noopener noreferrer" style={{ color: t.fern }}>Guía de uso</a>
            <a href="/privacidad.html" target="_blank" rel="noopener noreferrer" style={{ color: t.fern }}>Privacidad</a>
            <a href="/terminos.html" target="_blank" rel="noopener noreferrer" style={{ color: t.fern }}>Términos</a>
            <a href="/cookies.html" target="_blank" rel="noopener noreferrer" style={{ color: t.fern }}>Cookies</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
