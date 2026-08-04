# AUDIT_REPORT — Auditoría General de Glenwyn

> **Fecha:** 2026-08-03 · **Alcance:** Frontend React 19 + Vite, Supabase (RLS/Storage/Auth), tests Vitest, migraciones SQL 001–013.
> **Comandos ejecutados:** `npm run lint` ✅ (0 errores / 0 warnings) · `npm run test` ✅ (1 archivo, 51 tests).

---

## 📊 Resumen Ejecutivo del Estado del Proyecto

| Área | Puntaje | Comentario breve |
|---|---|---|
| **1. Estructura y salud del código frontend** | **6/10** | Código limpio y bien comentado, pero `App.jsx` es un monolito de 3.895 líneas. |
| **2. Resiliencia y persistencia (Supabase + LocalStorage)** | **7/10** | Autoguardado con guard anti-race sólido; falta cola offline / retry con backoff. |
| **3. Cobertura y calidad de tests** | **4/10** | Solo `pageUtils` testeado. Cero tests de componentes, repos e integración. |
| **4. Base de datos y migraciones (RLS/índices/FK)** | **7/10** | Esquema sólido; **Riesgo de escalada de privilegios** en `profiles` (RLS sin `with check`). |
| **5. Estado de features de producto** | **7/10** | Bloque/tareas/`[[links]]`/DBs implementados. **Bug crítico** rompe el mapa de vínculos. |

### 🎯 Nota global: **6.2 / 10**

Proyecto con producto real, denso en features y arquitectura de datos correcta en su mayoría. El bloqueante no es "falta de producto", sino **dudoso tooling y un bug que puede tumbar la app completa**.

---

## 🚨 Hallazgos Críticos y Deuda Técnica

### 🔴 P1 — Crash de la app completa en `MiniGraphMap` (BUG REAL)
`src/components/SecondBrainViews.jsx` usa `bodyFont` en **líneas 283 y 303** pero solo importa `displayFont, monoFont` (línea 2). Esto lanza `ReferenceError: bodyFont is not defined` **en el render** de `MiniGraphMap`, que está atado a toda página con backlinks o enlaces salientes (`App.jsx:2955`). Resultado: el árbol entero de Glenwyn colapsa y el ErrorBoundary muestra "Algo salió mal".

- **Gatillo:** que una página tenga al menos una página que la mencione o un enlace saliente real (la Welcome de fábrica solo menciona `[[así]]`, que no resuelve).
- **Por qué pasó desapercibido:** `npm run lint` **no detecta variables indefinidas** — `.oxlintrc.json` solo activa `react/rules-of-hooks` y `react/only-export-components`; la regla `no-undef` no forma parte del perfil activo.

### 🔴 P1 — Escalación de privilegios vía RLS en `profiles`
`supabase/migrations/007_profiles.sql` define:

```sql
create policy "profiles update own" on public.profiles for update using (auth.uid() = user_id);
```

Sin cláusula `with check`, y aplicada sobre **todas las columnas** (`plan`, `is_admin`, `stripe_*`). Como la `anon key` es pública, **cualquier usuario autenticado puede autoasignarse `is_admin = true` / `plan = 'business'`** con una llamada directa a la API (consola o PostgREST), sin pasar por la UI (`profileRepo` no expone update, pero la policy sí lo permite).

- **Hoy:** `is_admin` ya otorga estatus visible y puerta de gating en UI.
- **Peor:** cuando se activen límites reales de plan (Paso 4 de monetización), esto es una escalación plena.
- **Fix:** restringir el update a columnas no sensibles (`with check` + explicit columns), o quitar update en cliente y manejarlo server-side (webhook Stripe).

### 🟠 P2 — `App.jsx` es un monolito de 3.895 líneas
Un solo componente concentra: ~40 handlers de estado, sidebar, topbar, canvas/editor, paleta de comandos y **5 modales** (Trash, Historial, Compartir, Ajustes, plus `MoveTo`/`Personalize`/`Shortcuts`). Efectos: closures recreados por render, imposible de testear por unidad y todos los `setState` + side-effects mezclados.

**Olor concreto:** efectos secundarios dentro de updaters de `setState` (patrón impuro):
- `setActiveId(...)` dentro del updater de `createPage` (`App.jsx:620`) y `archivePage` (`App.jsx:1101`).
- `setDeepWorkActive(false)` dentro del updater de `setDeepWorkSecondsLeft` (`App.jsx:1241`).
- Riesgo de doble invocación en `StrictMode` y viola el contrato funcional de los updaters.

### 🟠 P2 — Deuda de testing (el talón de Aquiles)
- **Un solo archivo de tests** (`src/lib/pageUtils.test.js`, 51 tests) → solo lógica pura de páginas/bloques.
- **Cero cobertura** para: flujo de persistencia/autosave+sync (repos), `backupExport.js`, y **ningún** componente de React (`Block`, `DatabaseView`, `AuthGate`, `App`) porque **no hay jsdom ni @testing-library instalados**.
- Consecuencia directa: el bug P1 existe pese a "51 tests en verde".

### 🟠 P2 — Vista de base de datos no se persiste + esquema muerto
- `databaseViewModes` (`App.jsx:148`) es solo estado de React: **la vista elegida (tabla/tabler/calendar/gallería) de habla** al recargar.
- En `006_databases.sql` se creó la tabla `database_views` pero **nada en el front la usa** — superficie muerta que invita a implementar por el camino equivocado.

### 🟡 P3 — Fiestas de menor prioridad
1. **`lib/pageUtils.js` duplicado obsoleto, committeado** en la raíz (561 líneas vs 840 de `src/lib/pageUtils.js`). No se importa desde ningún lado — dead code que desvía. El `CHANGELOG.md` y `README.md` aún referencian `lib/pageUtils.js`.
2. Uso de `window.confirm`/`window.alert` bloqueantes (rotar link, borrar columna, restaurar, vaciar papelera) — mala a11y y UX; deberían ser controles inline o no-empañan.
3. `getPageAge` usa `updatedAt || createdAt`, pero `updatedAt` solo se setea al recargar desde DB (`rowToPage`); una página nueva sin guardar se ve "old" hasta el primer save. Menor.
4. En mobile, `saveError` se muestra como un puntito rojo sin tooltip (`App.jsx:2798`) — el usuario no sabe qué falló.

---

## ⚡ Evaluación de Quick-Wins (Bajo esfuerzo / Alto impacto)

| # | Quick-Win | Esfuerzo | Impacto | Archivos |
|---|---|---|---|---|
| 1 | **Importar `bodyFont`** en `SecondBrainViews.jsx` → elimina el crash P1 | 1 línea | ✅ Elimina app rota | `src/components/SecondBrainViews.jsx:2` |
| 2 | **Re-string linear** agregar `no-undef`/unused a `.oxlintrc.json` para que bugs así fallen en CI | 5 min | ✅ Evita recurrencia | `.oxlintrc.json` |
| 3 | **Hardening RLS** de `profiles` (evitar auto-promo a admin/plan) | 0.5 h | ✅ Cierra escalación P1 | `007_profiles.sql` |
| 4 | **Eliminar `lib/pageUtils.js`** duplicado y corregir referencias en docs | 10 min | ✅ Limpia dead code | raíz `lib/`, `README.md`, `CHANGELOG.md` |
| 5 | **Persistir `databaseViewModes`** en `glenwyn:prefs` (o en `database_views`) | 30 min | ✅ Mejora UX real | `App.jsx` |
| 6 | Sacar los side-effects fuera de los updaters de `setState` | 30-60 min | ✅ Robustez frente a StrictMode | `App.jsx` |

---

## 📋 Plan de Acción Inmediato recomendado

### Sprint 0 — Estabilizar (semana 1)
1. **Hotfix P1:** importar `bodyFont` en `SecondBrainViews.jsx`. Verificar con `npm run build` que `vite build` no se queje y que no existan otros `no-undef` ocultos.
2. **Hardenear `profiles`:** reescribir la policy `update` para restringir columnas de facturación/admin al server (o `with check` que regule el rol). Documentarlo en `007`/`008`.
3. **Activar `no-undef` (y `no-unused-vars`) en `.oxlintrc.json`** y correr `npm run lint` hasta llegar 0. Añadir un script de `ci`.

### Sprint 1 — Blindar calidad (semanas 1–2)
4. **Configurar jsdom + @testing-library/react** (agregar devDeps) y montar `vitest` con entorno DOM.
5. Escribir la **primera suite de componentes críticos**:
   - `Block` (todo tipo, shortcuts markdown, slash menu, mentions).
   - `DatabaseTableView` / `RelationsRouterCell` / `RollupCell` (ciclos).
   - `AuthGate` (flujo session/oauth).
6. Un primer test **de integración del autosave** (guard/race de `flushSave` + `knownIds`), mockeando `supabase-js`.

### Sprint 3 — Refactor + fechas (semanas 2–4)
7. **Splitter `label=` de `App.jsx`:** extraer `EditorCanvas`, `Topbar`, `SidebarNavigation`, `SaveIndicator` y cada modal (Trash/Historial/Compartir/Ajustes) a sus propios componentes, moviendo state relevante a pequeños hooks (`useSaveQueue`, `usePaletteCommand`).
8. **Persistir la vista de base de datos** elegida (prefs o `database_views`), y activar/usar la tabla `database_views` ya creada.
9. Reemplazar `window.confirm`/`alert` por diálogos inline accesibles.
10. (Opcional) Cola de persistencia offline con `navigator.onLine` + retry con backoff para el autogario.

---

## 🔍 Anexo — Detalle del hallazgo P1 (evidencia)

- `src/components/SecondBrainViews.jsx:2` → `import { displayFont, monoFont } from '../theme';`
- `src/components/SecondBrainViews.jsx:283` → `fontFamily={bodyFont}` (crash)
- `src/components/SecondBrainViews.jsx:303` → `fontFamily={bodyFont}` (crash)
- `bodyFont` solo se define en `src/theme.js:34`; verificado que no existe ningún global.
- `npm run lint` reportó 0 issues (la regla `no-undef` no está activa).