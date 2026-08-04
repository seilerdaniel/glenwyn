# Contexto y Reglas para Agentes de IA — Glenwyn

## Stack Tecnológico
- Frontend: React 19 + Vite
- Backend/DB: Supabase (Postgres, Row Level Security, Storage, Auth)
- Estilos: CSS nativo / `src/theme.js` (Paleta Cozy/Verde-Canvas)
- Calidad: Oxlint (`npm run lint`), Vitest (`npm run test`)

## Reglas Principales
1. NO modificar dependencias del `package.json` sin autorización explícita.
2. Mantener 0 errores y 0 warnings en Oxlint en todo momento.
3. No romper la suite de tests existente en Vitest.
4. Respetar la modularidad en `/src/components/` y `/src/lib/`.