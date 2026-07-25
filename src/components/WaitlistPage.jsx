import React, { useState } from 'react';
import { tokens, displayFont, bodyFont, monoFont } from '../theme';
import { supabase } from '../lib/supabaseClient';

// Paso 3 del plan de monetización, hecho herramienta — ver ESTRATEGIA_NEGOCIO.md
// sección 3 para la línea gratis/paga completa. El objetivo de esta página no es
// vender todavía (no hay nada que cobrar — Stripe no está conectado), es juntar
// una señal real de interés antes de construir nada más de monetización.
export default function WaitlistPage() {
  const [dark] = useState(() => window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const t = dark ? tokens.dark : tokens.light;
  const [email, setEmail] = useState('');
  const [interestedPlan, setInterestedPlan] = useState('plus');
  const [website, setWebsite] = useState(''); // honeypot — invisible to people, bots fill every field they see
  const [status, setStatus] = useState('idle'); // idle | sending | done | duplicate | error

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    if (website) {
      // A bot filled the honeypot — pretend success without touching the
      // database at all, so it doesn't learn anything from the response.
      setStatus('done');
      return;
    }
    setStatus('sending');
    try {
      const { error } = await supabase
        .from('waitlist_signups')
        .insert({ email: email.trim(), interested_plan: interestedPlan });
      if (error) {
        if (error.code === '23505') {
          setStatus('duplicate');
          return;
        }
        throw error;
      }
      setStatus('done');
    } catch (err) {
      console.error('Glenwyn: failed to join waitlist', err);
      setStatus('error');
    }
  };

  const planCardStyle = {
    flex: 1,
    minWidth: 220,
    border: `1px solid ${t.clay}`,
    borderRadius: 12,
    padding: '20px 22px',
    background: t.canvasAlt,
  };

  return (
    <div style={{ minHeight: '100vh', background: t.canvas, color: t.bark, fontFamily: bodyFont }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '60px 28px 100px' }}>
        <div style={{ fontFamily: displayFont, fontWeight: 600, fontSize: 20, color: t.moss, marginBottom: 40 }}>
          Glenwyn
        </div>

        <h1 style={{ fontFamily: displayFont, fontWeight: 600, fontSize: 34, margin: '0 0 12px' }}>
          Glenwyn Plus está en camino
        </h1>
        <p style={{ fontSize: 15.5, color: t.fern, lineHeight: 1.7, marginBottom: 36 }}>
          Todavía no hay nada para pagar — estamos confirmando si esta línea gratis/paga tiene sentido antes de construirla de verdad. Dejanos tu email y te avisamos apenas esté disponible, sin compromiso.
        </p>

        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 40 }}>
          <div style={planCardStyle}>
            <div style={{ fontFamily: monoFont, fontSize: 11, textTransform: 'uppercase', color: t.fern, marginBottom: 8 }}>Free</div>
            <div style={{ fontFamily: displayFont, fontSize: 22, fontWeight: 600, marginBottom: 14 }}>Gratis</div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, lineHeight: 1.9, color: t.bark }}>
              <li>Páginas ilimitadas</li>
              <li>Backlinks y menciones completo</li>
              <li>Tareas completo</li>
              <li>1 base de datos, hasta 50 registros</li>
              <li>Modo Zen y Deep Work</li>
            </ul>
          </div>
          <div style={{ ...planCardStyle, border: `1.5px solid ${t.moss}` }}>
            <div style={{ fontFamily: monoFont, fontSize: 11, textTransform: 'uppercase', color: t.moss, marginBottom: 8 }}>Plus</div>
            <div style={{ fontFamily: displayFont, fontSize: 22, fontWeight: 600, marginBottom: 14 }}>A confirmar</div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, lineHeight: 1.9, color: t.bark }}>
              <li>Bases de datos ilimitadas</li>
              <li>Relaciones y rollups entre bases de datos</li>
              <li>Historial de versiones completo</li>
              <li>Más almacenamiento de imágenes</li>
              <li>Vista de galería</li>
            </ul>
          </div>
        </div>

        {status === 'done' ? (
          <div style={{ padding: '16px 18px', background: t.canvasAlt, border: `1px solid ${t.clay}`, borderRadius: 10, fontSize: 14, color: t.moss }}>
            Listo — te avisamos apenas esté disponible. Gracias por ayudarnos a confirmar esto.
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 380 }}>
            {/* Honeypot — invisible to a person, but a bot filling every field it
                sees will fill this one too. aria-hidden + tabIndex=-1 so it never
                confuses anyone using a screen reader or tabbing through the form. */}
            <input
              type="text"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              name="website"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }}
            />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              style={{
                padding: '11px 14px',
                fontSize: 14.5,
                border: `1px solid ${t.clay}`,
                borderRadius: 8,
                background: t.canvas,
                color: t.bark,
                fontFamily: bodyFont,
              }}
            />
            <div style={{ display: 'flex', gap: 16, fontSize: 13, color: t.fern }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input type="radio" name="plan" checked={interestedPlan === 'free'} onChange={() => setInterestedPlan('free')} />
                Me alcanza con Free
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input type="radio" name="plan" checked={interestedPlan === 'plus'} onChange={() => setInterestedPlan('plus')} />
                Pagaría por Plus
              </label>
            </div>
            <button
              type="submit"
              disabled={status === 'sending'}
              style={{
                padding: '11px 18px',
                fontSize: 14.5,
                fontWeight: 600,
                border: 'none',
                borderRadius: 8,
                background: t.moss,
                color: t.canvas,
                cursor: status === 'sending' ? 'default' : 'pointer',
                opacity: status === 'sending' ? 0.7 : 1,
              }}
            >
              {status === 'sending' ? 'Enviando…' : 'Avisame cuando esté'}
            </button>
            {status === 'duplicate' && (
              <div style={{ fontSize: 12.5, color: t.fern }}>Ese email ya está anotado — te vamos a avisar apenas esté disponible.</div>
            )}
            {status === 'error' && (
              <div style={{ fontSize: 12.5, color: t.error }}>No pudimos guardarlo. Probá de nuevo en un momento.</div>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
