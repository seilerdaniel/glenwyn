import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const canvas = '#F6F3EC';
const bark = '#2E2A24';
const fern = '#7C8B6F';
const moss = '#4A5D45';
const clay = '#E8E2D3';

// Gates the app behind Supabase Auth using Google OAuth.
// Renders children with `user` once there's a signed-in session.
export default function AuthGate({ children }) {
  const [session, setSession] = useState(undefined); // undefined = loading, null = signed out
  const [error, setError] = useState('');
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const handleGoogleSignIn = async () => {
    setError('');
    setSigningIn(true);
    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (signInError) {
      setSigningIn(false);
      setError('No pudimos abrir el login de Google. Probá de nuevo.');
    }
    // On success, the browser redirects to Google — no need to unset signingIn here.
  };

  if (session === undefined) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: canvas, color: fern, fontFamily: 'sans-serif' }}>
        cargando…
      </div>
    );
  }

  if (!session) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: canvas, fontFamily: 'sans-serif' }}>
        <div style={{ width: 320, textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 600, color: moss, marginBottom: 6 }}>Glenwyn</div>
          <div style={{ fontSize: 13, color: fern, marginBottom: 24 }}>
            Un espacio de trabajo tranquilo, esperándote.
          </div>
          <button
            onClick={handleGoogleSignIn}
            disabled={signingIn}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              padding: '10px 16px',
              borderRadius: 8,
              border: `1px solid ${clay}`,
              background: '#fff',
              color: bark,
              fontSize: 14,
              cursor: signingIn ? 'default' : 'pointer',
              opacity: signingIn ? 0.7 : 1,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18">
              <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.62z" />
              <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.96v2.33A9 9 0 0 0 9 18z" />
              <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.03z" />
              <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.97L3.95 7.3C4.66 5.17 6.65 3.58 9 3.58z" />
            </svg>
            {signingIn ? 'Abriendo Google…' : 'Continuar con Google'}
          </button>
          {error && <div style={{ color: '#B5533C', fontSize: 12, marginTop: 10 }}>{error}</div>}
        </div>
      </div>
    );
  }

  return children(session.user);
}
