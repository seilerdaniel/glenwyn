import React from 'react';
import { logError } from '../lib/errorLoggingRepo';

// Sin esto, un error de render en cualquier parte de la app deja la pantalla
// completamente en blanco, sin ningún mensaje — la peor experiencia posible
// para alguien que ni sabe que Glenwyn tiene un problema, y para nosotros,
// ninguna forma de enterarnos que pasó. Este componente es la única forma en
// React de capturar esos errores (no existe un hook equivalente todavía).
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    logError(error, 'react-boundary');
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
            padding: 32,
            fontFamily: "'Public Sans', sans-serif",
            background: '#FCF6EA',
            color: '#362916',
            textAlign: 'center',
          }}
        >
          <div style={{ fontFamily: "'Fraunces', serif", fontSize: 22, fontWeight: 600 }}>
            Algo salió mal
          </div>
          <div style={{ fontSize: 14, color: '#7A6647', maxWidth: 420 }}>
            Encontramos un error inesperado. Ya quedó registrado — probá recargar la página.
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: '#8C5F1E',
              color: '#FCF6EA',
              border: 'none',
              borderRadius: 8,
              padding: '10px 20px',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Recargar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
