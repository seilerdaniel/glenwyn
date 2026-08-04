# DESIGN_AUDIT.md — Micro-ajustes de UI/UX para Glenwyn

> Objetivo: acercar Glenwyn a la fluidez minimalista de Notion/Obsidian **sin** perder la
> identidad cozy "Miel dorada" (verde-canvas + acento dorado). Se priorizan micro-ajustes:
> solo CSS-tokens o estilo inline, de bajo riesgo, sin tocar lógica, modelo de datos ni
> la suite de tests. Todos los cambios respetan la paleta en `src/theme.js`.

## Contexto técnico relevante para el audit

- **Paleta y tipografía** viven en `src/theme.js` (`tokens` light/dark, `displayFont` Fraunces,
  `bodyFont` Public Sans, `monoFont` JetBrains Mono). No hay archivo CSS global excepto un
  reset mínimo en `src/index.css` (14 líneas).
- **Todos los estilos son inline** en los componentes, definidos en `style={{...}}`. No hay
  hojas de estilos por componente ni PostCSS/Tailwind.
- **Los menús `/` (SlashMenu) y `[[` (menciones)** se renderizan condicionalmente en
  `src/components/Block.jsx`; los estados hover se alternan vía
  `onMouseEnter/onMouseLeave` escribiendo `background` manualmente
  (patrón: `src/components/SpecializedBlocks.jsx:569`, `src/components/Block.jsx:862`).
- **El sidebar** (`src/components/SidebarViews.jsx`) y los **modales**
  (`src/components/AppModals.jsx`) usan `onMouseEnter/onMouseLeave` para el hover; no tienen
  transición → el cambio de color es instantáneo y se siente rígido frente a Notion.
- **Jerarquía tipográfica de página**: el título de página usa `fontSize: 34, fontWeight 600`
  con `displayFont` (Fraunces) en `src/App.jsx` (~2924-2939). Los párrafos de bloque usan
  `fontSize: 15.5, lineHeight 1.7, bodyFont` en `src/components/Block.jsx` (`sharedTextareaStyle`).

---

## Propuesta 1 — Transición suave (150 ms) en hover/focus de sidebar y menús

**Dónde:** `src/components/SidebarViews.jsx`, `src/components/SpecializedBlocks.jsx`,
`src/components/AppModals.jsx`.

**Por qué:** hoy el cambio de `background` en hover con
`onMouseEnter={(e) => e.currentTarget.style.background = t.clay}` es instantáneo y áspero.
Notion/Obsidian usan transiciones cortas que hacen que la UI se sienta viva. Glenwyn tiene
una identidad cozy que se beneficia de un fade sutil.

**Qué cambiar (micro):** añadir un token de transición reutilizable en `src/theme.js`:

```js
export const motion = {
  fast: '150ms ease',
  base: '200ms ease',
  // micro-interacciones (hover, focus, menús) → 150ms; paneles grandes → 200ms
};
```

Y aplicarlo al patrón de hover existente:

```js
onMouseEnter={(e) => {
  e.currentTarget.style.background = t.clay;
  e.currentTarget.style.transition = `background ${motion.fast}`;
}}
```

**Riesgo:** nulo (solo CSS). **Beneficio:** la app se siente mucho más viva al navegar.

---

## Propuesta 2 — Jerarquía tipográfica más clara (fluidez Notion en el encabezado)

**Dónde:** `src/App.jsx` (título de página, ~línea 2926) y `src/components/Block.jsx`
(`sharedTextareaStyle`).

**Por qué:** el encabezado de página es `fontSize 34 / fontWeight 600` con Fraunces; los
párrafos de bloque son `fontSize 15.5 / lineHeight 1.7`. La separación tipográfica ya existe,
pero el título flota sobre el cuerpo y el ritmo vertical es apretado. Notion da un ritmo
más aéreo: título con `letterSpacing` ligeramente negativo y cuerpo con `lineHeight` mayor.

**Qué cambiar (pequeño):**
- Título: `letterSpacing: '-0.015em'` y `lineHeight: 1.15` (Fraunces es una óptica grande).
- Cuerpo: `lineHeight: 1.75` (de 1.7) y `letterSpacing: '0.005em'`.
- Opcional: `marginBottom` del título de `28px` a `24px` para estrechar el paso al cuerpo.

**Riesgo:** nulo (solo estilo). **Beneficio:** la escala visual se lee de un vistazo.

---

## Propuesta 3 — Hover states en el sidebar: reveal de acciones con fade

**Dónde:** `src/components/SidebarViews.jsx` (filas del árbol, ~línea 194 y ~360-366).

**Por qué:** Notion muestra el botón de acciones (⋯) solo cuando la fila está en hover, con un
suave fade. Glenwyn ya tiene el patrón de "reveal on hover" para bloques (por ejemplo, los
botones de imagen con `opacity: 0 → 1` en `SpecializedBlocks.jsx:538`), pero en el sidebar
las acciones aparecen y desaparecen de golpe.

**Micro-cambio concreto:**
- Fila: hover background = `t.clay` con `transition: background ${motion.fast}`.
- Botón de acciones (⋯): de `opacity: 0` a `1` sobre hover con `transition: opacity ${motion.fast}`.

**Riesgo:** CSS inline, nulo. **Beneficio:** feedback inmediato y exploración más cómoda.

---

## Propuesta 4 — Animación de entrada en los menús `/` y `[[` (fade + slide)

**Dónde:** `src/components/Block.jsx` (menú de menciones `[[`, ~línea 717) y
`src/components/SpecializedBlocks.jsx` (`SlashMenu`, ~línea 548).

**Por qué:** hoy el menú slash y el menú de menciones aparecen y desaparecen sin transición.
Notion y Obsidian los despliegan con un pequeño fade ~120–160 ms y un desplazamiento de ~4px.
Esa micro-animación es exactamente lo que hace que la herramienta se sienta fluida.

**Micro-cambio concreto (pseudo-CSS, aplicable inline):**

```js
// en src/theme.js, junto a motion:
export const popoverMotion = {
  animation: 'glenwyn-popper 160ms ease-out',
};
```

```css
@keyframes glenwyn-popper {
  from { opacity: 0; transform: translateY(-4px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

Aplicarlo al contenedor del `SlashMenu`, al menú de selección `[[ ]]` y al nuevo toolbar de
"Crear nota atómica".

**Riesgo:** nulo. **Beneficio:** los comandos se leen como parte de la edición, no como
popups separados.

---

## Propuesta 5 — Sombra y elevación coherente en menús/tooltips (consolidar `boxShadow`)

**Dónde:** `src/components/Block.jsx` (menú `[[` y nuevo toolbar), `src/components/SpecializedBlocks.jsx`
(`SlashMenu`), `src/components/AppModals.jsx`.

**Por qué:** cada menú define su propia `boxShadow` (p. ej. `'0 8px 24px rgba(0,0,0,0.18)'` en
`SpecializedBlocks.jsx:560`). Con un token de sombra, cualquier menú futuro usa el mismo
"vocabulario visual" y la superficie `t.canvas` se separa limpiamente del fondo.

**Micro-cambio concreto:**

```js
export const elevation = {
  menu: '0 6px 16px rgba(0,0,0,0.12)',
  modal: '0 18px 50px rgba(0,0,0,0.28)',
};
```

Reemplazar el `boxShadow` literal en SlashMenu, menú de menciones y menú de nota atómica nuevo.

**Riesgo:** nulo. **Beneficio:** más legibilidad de superficie y un lenguaje visual coherente
entre modales y popovers.

---

## Priorización

| # | Propuesta | Esfuerzo | Retorno percibido | Ficheros |
|---|-----------|----------|-------------------|----------|
| 1 | Transiciones hover 150 ms | Bajo | Alto | SidebarViews, SpecializedBlocks, AppModals |
| 2 | Jerarquía tipográfica (letterSpacing/lineHeight) | Muy bajo | Medio | `App.jsx`, `Block.jsx` |
| 3 | Hover sidebar con reveal de acciones + fade | Bajo | Medio | `SidebarViews.jsx` |
| 4 | Animación de entrada de menús `/` + `[[` (fade/slide) | Bajo | Medio | `Block.jsx`, `SpecializedBlocks.jsx` |
| 5 | Tokens de shadow/elevation unificados | Muy bajo | Medio | `theme.js` + componentes |

> **Recomendación:** implementar primero la **Propuesta 1 + 5** (añadir `motion` y `elevation`
> en `src/theme.js` y aplicarlos en `Block.jsx` + `SpecializedBlocks.jsx`) — es la de mayor
> impacto por esfuerzo, y no toca lógica, datos ni tests.