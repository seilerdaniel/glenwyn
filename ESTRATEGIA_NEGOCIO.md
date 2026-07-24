# Glenwyn — Estrategia de negocio

**Decisión tomada: Glenwyn es un SaaS, con modelo de monetización freemium.**

51 versiones construidas hasta acá. Este documento ya no plantea si convertirlo en producto — eso quedó resuelto. Lo que sigue es la definición concreta de cómo se traduce esa decisión: para quién es, qué queda gratis, qué queda pago, y qué hace falta técnicamente para cobrar de verdad.

**Aviso honesto:** no soy asesor financiero ni de negocios. Los números y límites de abajo son un punto de partida razonable para discutir, no una recomendación de qué hacer con tu dinero.

---

## 1. Dónde está Glenwyn hoy, en serio (no marketing)

### Lo que ya alcanzó paridad real
- **Jerarquía + bloques** — la base de Notion, completa
- **Backlinks + menciones inline** — el diferencial central de Obsidian, con vista de grafo local
- **Tareas con fecha/prioridad/recurrencia/lenguaje natural** — el corazón de Todoist
- **Bases de datos con relaciones y rollups** — la pieza más compleja de Notion, las 4 fases completas
- **Identidad visual propia** — cozy, verde, natural — nada parecido a los defaults de ningún competidor

### Lo que ningún competidor grande tiene, exactamente así
- Modo Zen / Deep Work con la estética calma integrada, no pegada encima
- Bandeja de entrada, notas huérfanas, indicador de madurez, pátina del tiempo — herramientas de Zettelkasten reales

### Lo que sigue siendo una brecha de verdad
- **IA / búsqueda semántica** — el mayor diferencial pendiente
- **Colaboración en tiempo real** — hoy es de un usuario por workspace
- **App nativa / offline** — web responsive, sin PWA instalable todavía
- **Captura externa** (web clipper, compartir desde el celular) — cero todavía

---

## 2. Para quién es (dado que ya se decidió: SaaS freemium)

El público que mejor calza con lo que ya existe: gente que valora específicamente la estética cozy y el enfoque de second brain — no "todo el mundo que usa Notion", sino el mismo tipo de público chico y fiel que sostiene apps como Bear, Craft, o Reflect. Freemium funciona bien acá porque el "aha moment" (backlinks + la estética + lo cozy) se puede sentir completo sin pagar nada — el pago viene después, cuando alguien ya se enganchó y quiere más volumen o más poder.

---

## 3. Propuesta concreta de línea gratis / paga

Esto es lo que más importa definir bien antes de tocar código de "modo de pago" — corregirlo después de que la gente ya se acostumbró a un límite es mucho más incómodo que definirlo bien de entrada.

**Principio guía:** todo lo que hace que alguien se enamore del producto (backlinks, menciones, la estética, Zen/Deep Work) queda gratis. Lo que se paga es **volumen** y **el feature más caro de mantener** (bases de datos avanzadas), no la esencia del producto.

### Plan gratis
- Páginas ilimitadas de texto/bloques (nada de "hasta 50 páginas" — eso ahuyenta a alguien que recién está migrando su segundo cerebro entero)
- Backlinks, menciones inline, mini-mapa de vecinos — completo
- Tareas con fecha, prioridad, recurrencia, lenguaje natural — completo
- **Una (1) base de datos**, hasta 50 registros, sin relaciones ni rollups (Fase A y B nada más — tabla/tablero/calendario, no galería)
- Historial de versiones: últimas 5 por página (hoy guarda hasta 20)
- Storage de imágenes: 50 MB
- Modo Zen y Deep Work — completo, es barato de dar y es buen gancho de marca
- Compartir por link — completo

### Plan pago ("Glenwyn Plus" o el nombre que prefieras)
- **Bases de datos ilimitadas, con relaciones y rollups** (Fase C y D completas) — el ancla principal, es la feature más compleja y más cara de haber construido
- Historial de versiones completo (20 por página + snapshots más frecuentes)
- Storage de imágenes ampliado (ej. 5 GB)
- Vista de galería
- Cuando exista: búsqueda semántica / IA (se suma acá directo, es el ancla natural del plan pago a futuro)
- Soporte prioritario

**Por qué esta línea y no otra:** deja el corazón del "second brain" (backlinks, menciones, tareas) completamente gratis — es lo que genera el boca en boca — y pone el límite justo en la feature que más costó construir y que un usuario power-user (el que más valor saca y más dispuesto está a pagar) es quien más la va a usar.

---

## 4. Lo que esto implica técnicamente (todavía no construido)

Freemium real necesita infraestructura que hoy no existe:

1. **Un campo de plan por usuario** — tabla nueva o columna en Supabase (`profiles.plan = 'free' | 'plus'`)
2. **Enforcement de límites en la app** — chequear el plan antes de dejar crear la segunda base de datos, el registro 51, etc., con una pantalla clara de "necesitás Plus para esto" en vez de un error confuso
3. **Cobro real** — la forma más directa es Stripe. Dato útil: **ya existe un conector de Stripe disponible** para usar desde acá si querés que te ayude a integrarlo cuando llegue el momento
4. **Manejo de estado de suscripción** — qué pasa si alguien no paga (¿se degrada a free? ¿se bloquea?), típicamente vía webhooks de Stripe hacia una función serverless
5. **Una página de precios** dentro o cerca de la landing/guía que ya existe

---

## 5. Antes de construir nada de la sección 4

- **Hablar con 5-10 personas reales** que se identifiquen con "second brain" o Zettelkasten, mostrarles Glenwyn tal cual está, y ver qué dicen sin venderles nada — confirmar que la línea gratis/paga de la sección 3 realmente refleja lo que estarían dispuestos a pagar
- Confirmar el nombre del plan pago y el precio (este documento no propone un número — es la parte que más vale la pena validar con gente real antes de fijarla)

---

## Resumen de una línea
La decisión de negocio ya está tomada (SaaS freemium); lo que falta es validar la línea propuesta en la sección 3 con usuarios reales, y después construir el enforcement técnico (plan por usuario + Stripe) — en ese orden, no al revés.
