import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const canvas = '#F6F3EC';
const canvasAlt = '#EFEAE0';
const bark = '#2E2A24';
const fern = '#7C8B6F';
const moss = '#4A5D45';
const clay = '#E8E2D3';
const errorColor = '#994530';

// Traduce los mensajes de error más comunes de Supabase Auth a algo legible.
function translateError(message) {
  const map = {
    'Invalid login credentials': 'Email o contraseña incorrectos.',
    'User already registered': 'Ya existe una cuenta con ese email — probá iniciar sesión.',
    'Password should be at least 6 characters': 'La contraseña tiene que tener al menos 8 caracteres.',
    'Unable to validate email address: invalid format': 'Ese email no parece válido.',
    'Signup requires a valid password': 'Ingresá una contraseña.',
    'Token has expired or is invalid': 'El código venció o no es válido — pedí uno nuevo.',
  };
  return map[message] || message || 'Algo salió mal. Probá de nuevo.';
}

const fieldWrapStyle = { display: 'flex', flexDirection: 'column', gap: 4 };

const labelStyle = {
  fontSize: 11,
  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  color: fern,
};

const inputStyle = {
  width: '100%',
  border: `1px solid ${clay}`,
  borderRadius: 8,
  padding: '12px',
  // 16px es el mínimo para que iOS Safari no haga zoom automático al enfocar el campo —
  // con menos, la pantalla salta cada vez que tocás un input. No es solo estética.
  fontSize: 16,
  background: '#fff',
  color: bark,
  outline: 'none',
  fontFamily: 'inherit',
  minHeight: 44, // mínimo recomendado de área táctil (Apple: 44pt, Material: 48dp)
};

const primaryButtonStyle = (disabled) => ({
  width: '100%',
  padding: '13px 16px',
  minHeight: 44,
  borderRadius: 8,
  border: 'none',
  background: moss,
  color: canvas,
  fontSize: 15,
  fontWeight: 600,
  cursor: disabled ? 'default' : 'pointer',
  opacity: disabled ? 0.7 : 1,
});

const linkButtonStyle = {
  background: 'none',
  border: 'none',
  color: moss,
  fontSize: 13,
  cursor: 'pointer',
  padding: '6px 0', // hace que el área táctil real sea más alta que el texto solo
  textDecoration: 'underline',
};

const oauthButtonStyle = (disabled) => ({
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 7,
  padding: '12px 8px',
  minHeight: 44,
  borderRadius: 8,
  border: `1px solid ${clay}`,
  background: '#fff',
  color: bark,
  fontSize: 13,
  fontWeight: 500,
  cursor: disabled ? 'default' : 'pointer',
  opacity: disabled ? 0.6 : 1,
});

// Un pequeño ícono de ojo — mostrar/ocultar contraseña, sin depender de ninguna librería.
function EyeToggle({ visible, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
      title={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
      style={{
        position: 'absolute',
        right: 0,
        top: 0,
        bottom: 0,
        width: 44,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        color: fern,
        fontSize: 14,
      }}
    >
      {visible ? '🙈' : '👁'}
    </button>
  );
}

function PasswordField({ id, label, value, onChange, placeholder, autoComplete, minLength }) {
  const [visible, setVisible] = useState(false);
  return (
    <div style={fieldWrapStyle}>
      <label htmlFor={id} style={labelStyle}>{label}</label>
      <div style={{ position: 'relative' }}>
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          minLength={minLength}
          style={{ ...inputStyle, paddingRight: 44 }}
          required
        />
        <EyeToggle visible={visible} onToggle={() => setVisible((v) => !v)} />
      </div>
    </div>
  );
}

// Gates the app behind Supabase Auth. Supports email+password (with sign up and
// password reset), Google/Facebook/Microsoft OAuth, and phone (SMS OTP).
// Renders children with `user` once there's a signed-in session.
export default function AuthGate({ children }) {
  const [session, setSession] = useState(undefined); // undefined = loading, null = signed out
  // signin | signup | forgot | phone | phone-otp | reset-password
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(null); // which provider, or null
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      // Supabase redirects back here after a password-reset email link with this event.
      if (event === 'PASSWORD_RECOVERY') setMode('reset-password');
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const clearFeedback = () => {
    setError('');
    setMessage('');
  };

  const switchMode = (next) => {
    clearFeedback();
    setMode(next);
  };

  const handleSignIn = async (e) => {
    e.preventDefault();
    clearFeedback();
    setLoading(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) setError(translateError(err.message));
    setLoading(false);
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    clearFeedback();
    setLoading(true);
    const { error: err } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin },
    });
    if (err) {
      setError(translateError(err.message));
    } else {
      setMessage('Te mandamos un email para confirmar tu cuenta — revisá tu bandeja de entrada.');
    }
    setLoading(false);
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    clearFeedback();
    setLoading(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    if (err) setError(translateError(err.message));
    else setMessage('Te mandamos un link para restablecer tu contraseña.');
    setLoading(false);
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    clearFeedback();
    if (newPassword.length < 8) {
      setError('La contraseña tiene que tener al menos 8 caracteres.');
      return;
    }
    setLoading(true);
    const { error: err } = await supabase.auth.updateUser({ password: newPassword });
    if (err) {
      setError(translateError(err.message));
    } else {
      setMessage('Contraseña actualizada. Ya podés seguir usando Glenwyn.');
    }
    setLoading(false);
  };

  const handlePhoneSubmit = async (e) => {
    e.preventDefault();
    clearFeedback();
    setLoading(true);
    const { error: err } = await supabase.auth.signInWithOtp({ phone });
    if (err) setError(translateError(err.message));
    else {
      setMessage('Te mandamos un código por SMS.');
      setMode('phone-otp');
    }
    setLoading(false);
  };

  const handleOtpSubmit = async (e) => {
    e.preventDefault();
    clearFeedback();
    setLoading(true);
    const { error: err } = await supabase.auth.verifyOtp({ phone, token: otp, type: 'sms' });
    if (err) setError(translateError(err.message));
    setLoading(false);
  };

  const handleOAuth = async (provider) => {
    clearFeedback();
    setOauthLoading(provider);
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin },
    });
    if (err) {
      setError(translateError(err.message));
      setOauthLoading(null);
    }
    // On success the browser navigates away to the provider — no need to reset here.
  };

  if (session === undefined) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: canvas, color: fern, fontFamily: 'sans-serif' }}>
        cargando…
      </div>
    );
  }

  // Signed in, and not in the middle of a password-reset flow triggered from an email link.
  if (session && mode !== 'reset-password') {
    return children(session.user);
  }

  const Feedback = () => (
    <div role="alert" aria-live="polite">
      {error && <div style={{ color: errorColor, fontSize: 12.5, marginTop: 12 }}>{error}</div>}
      {message && <div style={{ color: moss, fontSize: 12.5, marginTop: 12 }}>{message}</div>}
    </div>
  );

  return (
    <div
      className="glenwyn-auth-wrap"
      style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: canvas, fontFamily: 'sans-serif', padding: 20 }}
    >
      <style>{`
        /* Probado explícitamente contra 320px — el ancho de referencia clásico para
           mobile-first — no solo contra un celular grande donde todo entra fácil. */
        @media (max-width: 360px) {
          .glenwyn-auth-wrap { padding: 12px !important; }
          .glenwyn-auth-card { padding: 22px 16px !important; }
          .glenwyn-auth-oauth-secondary-row { flex-direction: column !important; }
        }
      `}</style>
      <div
        className="glenwyn-auth-card"
        style={{
          width: 380,
          maxWidth: '100%',
          background: canvasAlt,
          border: `1px solid ${clay}`,
          borderRadius: 12,
          boxShadow: '0 12px 40px rgba(0,0,0,0.08)',
          padding: '32px 28px',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 22 }}>
          <div style={{ fontSize: 22, fontWeight: 600, color: moss, marginBottom: 6 }}>Glenwyn</div>
          <div style={{ fontSize: 13, color: fern }}>Un espacio de trabajo tranquilo, esperándote.</div>
        </div>

        {/* ---- Restablecer contraseña (llegás acá desde el link del email) ---- */}
        {mode === 'reset-password' && (
          <form onSubmit={handleResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 13, color: bark, marginBottom: 2 }}>Elegí una contraseña nueva</div>
            <PasswordField
              id="new-password"
              label="Nueva contraseña"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              autoComplete="new-password"
              minLength={8}
            />
            <button type="submit" disabled={loading} style={primaryButtonStyle(loading)}>
              {loading ? 'Guardando…' : 'Guardar contraseña'}
            </button>
            <Feedback />
          </form>
        )}

        {/* ---- Iniciar sesión ---- */}
        {mode === 'signin' && (
          <>
            {/* Los métodos de un solo click van primero — convierten mejor y piden menos esfuerzo
                que un formulario de contraseña (evidencia consistente de investigación de UX). */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button onClick={() => handleOAuth('google')} disabled={!!oauthLoading} style={oauthButtonStyle(!!oauthLoading)}>
                <GoogleIcon /> {oauthLoading === 'google' ? 'Redirigiendo…' : 'Continuar con Google'}
              </button>
              <div className="glenwyn-auth-oauth-secondary-row" style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => handleOAuth('facebook')} disabled={!!oauthLoading} style={oauthButtonStyle(!!oauthLoading)}>
                  <FacebookIcon /> Facebook
                </button>
                <button onClick={() => handleOAuth('azure')} disabled={!!oauthLoading} style={oauthButtonStyle(!!oauthLoading)}>
                  <MicrosoftIcon /> Microsoft
                </button>
              </div>
              <button onClick={() => switchMode('phone')} disabled={!!oauthLoading} style={oauthButtonStyle(!!oauthLoading)}>
                📱 Continuar con teléfono
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '18px 0' }}>
              <div style={{ flex: 1, height: 1, background: clay }} />
              <span style={{ fontSize: 11.5, color: fern }}>o con tu email</span>
              <div style={{ flex: 1, height: 1, background: clay }} />
            </div>

            <form onSubmit={handleSignIn} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={fieldWrapStyle}>
                <label htmlFor="email" style={labelStyle}>Email</label>
                <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vos@ejemplo.com" autoComplete="email" style={inputStyle} required />
              </div>
              <PasswordField
                id="password"
                label="Contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Tu contraseña"
                autoComplete="current-password"
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => switchMode('forgot')} style={linkButtonStyle}>
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
              <button type="submit" disabled={loading} style={primaryButtonStyle(loading)}>
                {loading ? 'Ingresando…' : 'Iniciar sesión'}
              </button>
            </form>

            <div style={{ textAlign: 'center', marginTop: 18, fontSize: 12.5, color: fern }}>
              ¿No tenés cuenta?{' '}
              <button onClick={() => switchMode('signup')} style={linkButtonStyle}>
                Creá una
              </button>
            </div>

            <div style={{ textAlign: 'center', marginTop: 14, fontSize: 10.5, color: fern }}>
              <a href="/privacidad.html" target="_blank" rel="noopener noreferrer" style={{ color: fern }}>Privacidad</a>
              {' · '}
              <a href="/terminos.html" target="_blank" rel="noopener noreferrer" style={{ color: fern }}>Términos</a>
              {' · '}
              <a href="/cookies.html" target="_blank" rel="noopener noreferrer" style={{ color: fern }}>Cookies</a>
            </div>

            <Feedback />
          </>
        )}

        {/* ---- Crear cuenta ---- */}
        {mode === 'signup' && (
          <>
            <form onSubmit={handleSignUp} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={fieldWrapStyle}>
                <label htmlFor="signup-email" style={labelStyle}>Email</label>
                <input id="signup-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vos@ejemplo.com" autoComplete="email" style={inputStyle} required />
              </div>
              <PasswordField
                id="signup-password"
                label="Contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                autoComplete="new-password"
                minLength={8}
              />
              <button type="submit" disabled={loading} style={primaryButtonStyle(loading)}>
                {loading ? 'Creando cuenta…' : 'Crear cuenta'}
              </button>
            </form>
            <div style={{ textAlign: 'center', marginTop: 18, fontSize: 12.5, color: fern }}>
              ¿Ya tenés cuenta?{' '}
              <button onClick={() => switchMode('signin')} style={linkButtonStyle}>
                Iniciá sesión
              </button>
            </div>
            <div style={{ textAlign: 'center', marginTop: 10, fontSize: 11, color: fern }}>
              Al crear una cuenta aceptás nuestros{' '}
              <a href="/terminos.html" target="_blank" rel="noopener noreferrer" style={{ color: moss }}>Términos de servicio</a> y nuestra{' '}
              <a href="/privacidad.html" target="_blank" rel="noopener noreferrer" style={{ color: moss }}>Política de privacidad</a>.
            </div>
            <Feedback />
          </>
        )}

        {/* ---- Olvidé mi contraseña ---- */}
        {mode === 'forgot' && (
          <>
            <form onSubmit={handleForgotPassword} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 13, color: fern, marginBottom: 2 }}>
                Ingresá tu email y te mandamos un link para restablecer tu contraseña.
              </div>
              <div style={fieldWrapStyle}>
                <label htmlFor="forgot-email" style={labelStyle}>Email</label>
                <input id="forgot-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vos@ejemplo.com" autoComplete="email" style={inputStyle} required />
              </div>
              <button type="submit" disabled={loading} style={primaryButtonStyle(loading)}>
                {loading ? 'Enviando…' : 'Mandar link'}
              </button>
            </form>
            <div style={{ textAlign: 'center', marginTop: 18, fontSize: 12.5, color: fern }}>
              <button onClick={() => switchMode('signin')} style={linkButtonStyle}>
                Volver a iniciar sesión
              </button>
            </div>
            <Feedback />
          </>
        )}

        {/* ---- Teléfono: pedir código ---- */}
        {mode === 'phone' && (
          <>
            <form onSubmit={handlePhoneSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 13, color: fern, marginBottom: 2 }}>
                Ingresá tu número con código de país (ej. +54 9 11 1234 5678).
              </div>
              <div style={fieldWrapStyle}>
                <label htmlFor="phone" style={labelStyle}>Teléfono</label>
                <input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+54 9 11 1234 5678" autoComplete="tel" style={inputStyle} required />
              </div>
              <button type="submit" disabled={loading} style={primaryButtonStyle(loading)}>
                {loading ? 'Enviando…' : 'Mandar código por SMS'}
              </button>
            </form>
            <div style={{ textAlign: 'center', marginTop: 18, fontSize: 12.5, color: fern }}>
              <button onClick={() => switchMode('signin')} style={linkButtonStyle}>
                Volver a iniciar sesión
              </button>
            </div>
            <Feedback />
          </>
        )}

        {/* ---- Teléfono: verificar código ---- */}
        {mode === 'phone-otp' && (
          <>
            <form onSubmit={handleOtpSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 13, color: fern, marginBottom: 2 }}>Ingresá el código de 6 dígitos que te mandamos por SMS.</div>
              <div style={fieldWrapStyle}>
                <label htmlFor="otp" style={labelStyle}>Código</label>
                <input
                  id="otp"
                  type="text"
                  inputMode="numeric"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="123456"
                  autoComplete="one-time-code"
                  style={{ ...inputStyle, textAlign: 'center', letterSpacing: 4, fontSize: 18 }}
                  maxLength={6}
                  required
                />
              </div>
              <button type="submit" disabled={loading} style={primaryButtonStyle(loading)}>
                {loading ? 'Verificando…' : 'Verificar código'}
              </button>
            </form>
            <div style={{ textAlign: 'center', marginTop: 18, fontSize: 12.5, color: fern }}>
              <button onClick={() => switchMode('phone')} style={linkButtonStyle}>
                Cambiar número
              </button>
            </div>
            <Feedback />
          </>
        )}
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" style={{ flexShrink: 0 }}>
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.96v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.03z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.97L3.95 7.3C4.66 5.17 6.65 3.58 9 3.58z" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
      <path fill="#1877F2" d="M24 12.07C24 5.41 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.04V9.41c0-3.02 1.79-4.7 4.53-4.7 1.31 0 2.68.24 2.68.24v2.97h-1.5c-1.5 0-1.96.93-1.96 1.89v2.26h3.32l-.53 3.5h-2.8V24C19.62 23.1 24 18.1 24 12.07z" />
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 21 21" style={{ flexShrink: 0 }}>
      <rect x="1" y="1" width="9" height="9" fill="#F25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
      <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
      <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
    </svg>
  );
}
