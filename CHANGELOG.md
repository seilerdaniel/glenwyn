# Changelog — Glenwyn

Todo lo construido hasta ahora, en orden. Para setup pendiente (lo que falta correr/configurar en Supabase, Google Cloud y Vercel), ver la sección **Pendiente de configurar** al final — eso es lo único que sí o sí necesita que estés frente a la computadora.

---

## v0.1 — Base del workspace
**Commit:** `6a85e42`

- Sidebar colapsable (`⌘\` o `Ctrl+\`) con árbol de páginas anidadas
- Búsqueda rápida (`⌘K` / `Ctrl+K`)
- Páginas anidadas (subpáginas) con expandir/colapsar
- Drag-to-reorder de páginas: soltar antes / después / dentro de otra página (reparenting), con protección contra ciclos
- Papelera: archivar en cascada (una página y sus subpáginas se van juntas), restaurar (incluyendo ancestros archivados, para que nunca quede una página huérfana e invisible), eliminar para siempre, auto-purga a los 30 días
- Bloques iniciales: texto, encabezado, tarea, divisor
- Comandos `/` con menú navegable por teclado (↑↓ Enter Esc)
- Atajos de markdown: `# ` → encabezado, `- [ ] ` → tarea, `---` → divisor
- Modo claro/oscuro con detección de preferencia del sistema
- Autoguardado con indicador discreto ("guardando…" / "guardado")
- Diseño: paleta cozy/verde-canvas, tipografía Fraunces + Public Sans + JetBrains Mono

## v0.2 — Fix de tareas + duplicar bloque
**Commit:** `2a6eb4b`

- **Fix:** presionar Enter dentro de una tarea creaba un bloque de texto genérico en vez de otra tarea
- **Nuevo:** `Ctrl/Cmd + D` duplica el bloque actual (mismo tipo y contenido) justo debajo

## v0.3 — Conexión a Supabase
**Commits:** `4668703`, `b22882f`

- Migración SQL inicial (`001_init.sql`): tabla `pages` (título, ícono, jerarquía, bloques como jsonb, archivado) con **Row Level Security** — cada usuario solo ve y toca sus propias páginas
- `pagesRepo.js`: capa de persistencia real contra Postgres (antes vivía todo en `window.storage`/localStorage)
- Login con **Google OAuth** vía Supabase Auth (se probó primero con magic link, se cambió por decisión explícita)
- Preferencias de UI (modo oscuro, sidebar abierto, expandido) siguen siendo locales por dispositivo — a propósito no viajan entre sesiones

## v0.4 — Bloques nuevos + favoritos
**Commit:** `56fe6fd`

- Bloques nuevos: **lista con viñetas**, **lista numerada** (se autonumera sola), **cita**, **callout**
- Atajos de markdown ampliados: `- ` / `* ` → lista, `1. ` → numerada, `> ` → cita
- Enter en un bloque de lista/tarea/cita sigue creando el mismo tipo; un segundo Enter sobre uno vacío lo saca de la lista (como en Notion)
- **Favoritos/pins:** botón ⭐ al hacer hover sobre cualquier página, sección "Favoritos" propia arriba del árbol
- Migración SQL `002_pinned.sql`: agrega columna `pinned` a `pages`

## v0.5 — Desplegable + plantillas
**Commit:** `369326d`

- Bloque **toggle/desplegable**: título siempre visible + cuerpo oculto que se expande/colapsa (el cuerpo es texto libre, Enter hace salto de línea normal ahí adentro)
- **Plantillas de página** al crear una nueva: Diario, Notas de reunión, Brainstorm — cada una con su estructura de bloques ya armada. Se accede con la flechita `▾` junto a "Nueva página"

## v0.6 — Imagen y tabla
**Commit:** `1299c2b`

- Bloque de **imagen** vía URL (pegás el link, se detecta automáticamente si escribís una URL de imagen sola en una línea de texto). Maneja links rotos con un mensaje y opción de cambiar el link
- Bloque de **tabla** simple: agregar/quitar filas y columnas, primera fila estilo encabezado

## v0.7 — Auditoría completa
**Commit:** `8c053c5`

Revisión a fondo de todo el código. Hallazgos y fixes:

| # | Problema encontrado | Fix |
|---|---|---|
| 1 | No existía forma de **eliminar** un bloque, solo convertirlo a otro tipo | Backspace en línea vacía borra el bloque y mueve el foco al anterior; botones explícitos de borrar en imagen, tabla y divisor |
| 2 | Convertir un bloque de ida y vuelta (imagen→texto→imagen) dejaba campos viejos pegados (`url`, `rows`, `body`, `open`), que podían reaparecer con datos viejos | Esos campos se limpian en cada conversión de tipo |
| 3 | La papelera "purgaba" páginas de más de 30 días solo del estado local — en Supabase quedaban para siempre | El próximo autoguardado tras cargar la app ahora también las borra de la base |
| 4 | Ediciones muy rápidas con conexión lenta podían disparar dos guardados superpuestos compitiendo por el mismo diff de IDs | Guard de guardado en curso + reintento en cola, siempre con el estado más reciente |
| 5 | Errores de carga/guardado se tragaban en silencio (`catch` vacío) | Ahora se loguean en consola para poder diagnosticarlos |

`npm run build` y `npm run lint` (oxlint) quedan en **0 errores, 0 warnings**.

---

## v0.8 — Historial de versiones

- Nueva tabla `page_versions` (migración `003_page_versions.sql`) con RLS y un trigger que mantiene automáticamente solo las últimas 20 versiones por página
- Snapshot automático de la página abierta cada 10 minutos mientras editás (throttled, no satura la tabla)
- Botón **"Guardar versión ahora"** para forzar un snapshot manual
- Panel de historial (ícono ⟲ en la barra superior de cada página): lista de versiones con fecha/hora, botón **Restaurar** por entrada (con confirmación, ya que reemplaza el contenido actual)

---

## v0.9 — Bloque de embed

- Bloque de **embed**: pegás un link y se detecta el proveedor automáticamente
  - YouTube, Vimeo, Loom → iframe reproducible dentro de la página
  - Spotify → reproductor embebido
  - Cualquier otro link → tarjeta clickeable simple (no hay backend para traer título/thumbnail de links arbitrarios)
- Auto-detección: pegar una URL de YouTube/Vimeo/Loom/Spotify sola en una línea de texto la convierte en embed automáticamente

---

## v0.10 — Segunda auditoría

Revisión enfocada en lo agregado desde la última auditoría (historial de versiones + embed), más una pasada general.

| # | Problema encontrado | Fix |
|---|---|---|
| 1 | Restaurar una versión anterior no guardaba primero un snapshot del estado actual — si restaurabas por error, no había forma fácil de deshacerlo | Ahora se guarda automáticamente una versión del estado actual antes de aplicar la restauración |
| 2 | Los campos de link de imagen y embed no validaban el esquema de la URL (aceptaban `javascript:`, `data:`, etc.) | Se valida que sea `http://` o `https://` antes de guardar, con mensaje de error inline si no lo es. Bajo riesgo hoy (contenido de un solo usuario), pero se vuelve importante en cuanto exista "compartir por link" |

Limpieza menor: las clases CSS `glenwyn-image-*` (compartidas entre imagen y embed) se renombraron a `glenwyn-media-*` para que el nombre no sea engañoso.

`npm run build` y `npm run lint` siguen en **0 errores, 0 warnings**.

---

## v0.11 — Subpágina inline + upload real de imágenes

- **Bloque de link a página:** desde `/` → "Página", buscás y elegís cualquier página del workspace; queda como un bloque clickeable que te lleva directo ahí. Si la página enlazada se borra para siempre, el bloque lo avisa y te deja quitarlo
- **Upload real de imágenes:** en el bloque de imagen ahora hay un botón "subir archivo" además de pegar un link — sube el archivo a Supabase Storage (bucket `glenwyn-images`, público para lectura, con políticas de RLS para que cada usuario solo pueda subir/editar/borrar dentro de su propia carpeta)
- Límite de 8MB por archivo, con validación de tipo (debe ser imagen) y manejo de error inline si algo falla
- Nueva migración `004_storage.sql`: crea el bucket y sus políticas

Con esto quedan cubiertas las dos últimas piezas pendientes de la lista original.

---

## v0.12 — Exportar a Markdown

- Botón **⬇ exportar** en la barra superior de cada página, descarga un archivo `.md` con toda la estructura traducida: encabezados, listas, tareas (con checkbox real de markdown), citas, callouts, tablas, imágenes, y los desplegables como `<details>` (compatible con GitHub-flavored markdown)
- Los links a otras páginas se exportan como texto (`→ **Título****`), ya que un archivo Markdown suelto no tiene forma de linkear a otra página del workspace
- 100% del lado del cliente — no necesita ninguna migración ni configuración nueva

---

## v0.13 — Compartir por link (solo lectura)

- Botón **🔗 compartir** en la barra superior: genera una URL pública (`/share/{token}`) que cualquiera puede abrir sin necesidad de cuenta, en modo solo lectura
- Se puede desactivar en cualquier momento — el link deja de funcionar al instante
- **Decisión de seguridad importante:** no se implementó con una policy de RLS de `select` para el rol `anon`, porque eso permitiría que cualquiera sin login liste *todas* las páginas compartidas de *todos* los usuarios con un simple `select *` (RLS no valida que conozcas el token exacto, solo que la columna no sea null). En cambio, se usa una función RPC `security definer` (`get_shared_page`) que exige el token exacto como parámetro y devuelve una sola fila — mucho más seguro
- Las subpáginas y los bloques de "link a otra página" no son navegables desde la vista compartida (se ve un aviso en su lugar), ya que solo se comparte esa página puntual
- Nueva migración `005_sharing.sql`: agrega la columna `share_token` y la función RPC
- Se agregó `vercel.json` con un rewrite necesario para que las URLs de `/share/...` no den 404 en producción al abrirlas directamente (no solo navegando desde dentro de la app)

---

## v0.14 — Tercera auditoría

Revisión enfocada en las 3 tandas desde la última auditoría (link a página + upload de imágenes, exportar a Markdown, compartir por link).

| # | Problema encontrado | Fix |
|---|---|---|
| 1 | Al eliminar una página para siempre (o al purgarse sola de la papelera a los 30 días), las imágenes subidas a Supabase Storage para esa página **nunca se borraban** — quedaban acumulándose para siempre | Ahora se limpian automáticamente (best-effort) en ambos casos. Las imágenes externas (pegadas por URL, no subidas) nunca se tocan, solo las que son de nuestro propio bucket |
| 2 | El botón "copiar" del link para compartir no manejaba errores del portapapeles — si fallaba, no pasaba nada visible | Ahora hay manejo de error con un fallback: selecciona el texto del link para copiarlo manualmente con Ctrl/Cmd+C |
| 3 | Un link de compartir malformado (sin token, o con texto extra) mostraba "Algo salió mal" — la función RPC fallaba con un error de tipo en Postgres en vez de simplemente no encontrar nada | Se valida el formato del token en el cliente antes de llamar a la función; si no es un UUID válido, se muestra directamente "este link ya no está disponible" |

También se agregó un link "ir a Glenwyn →" en la vista compartida, que antes era un callejón sin salida para quien la visitaba.

`npm run build` y `npm run lint` siguen en **0 errores, 0 warnings**.

---

## v0.15 — Íconos, duplicar página, contador de palabras

Tres "quick wins" que habían quedado pendientes desde la primera lista de ideas.

- **Íconos de página:** click en el ícono (sidebar o título de la página abierta) abre una paleta de 32 emojis comunes + un campo para pegar cualquier otro. Se puede quitar el ícono en cualquier momento
- **Duplicar página:** botón ⎘ en el hover del sidebar — clona la página (título + bloques, con IDs nuevos) como copia justo al lado de la original. No duplica subpáginas
- **Contador de palabras:** discreto, en la barra superior de cada página, cuenta el contenido de todos los bloques (incluyendo el cuerpo de los desplegables y las celdas de tablas)

100% del lado del cliente — no necesita ninguna migración nueva (la columna `icon` ya existía desde el schema inicial).

---

## v0.16 — Búsqueda de contenido + breadcrumbs

Dos piezas que estaban en el diseño original desde el arranque y nunca se habían implementado.

- **Búsqueda de contenido:** ⌘K y la búsqueda del sidebar ahora buscan en el título **y también dentro de los bloques** (texto, encabezados, tareas, listas, citas, callouts, desplegables, celdas de tabla). Antes solo miraba el título. Los resultados que coinciden solo por contenido muestran una etiqueta "en el contenido"
- **Breadcrumbs:** la barra superior de cada página ahora muestra la cadena completa de ancestros (`Padre / Abuelo / Página actual`), cada uno clickeable para saltar directo ahí — esto estaba en los documentos de diseño original ("breadcrumb/título flota sobre el canvas") pero nunca se había construido

100% del lado del cliente — no necesita ninguna migración nueva.

---

## v0.17 — Cuarta auditoría

Revisión enfocada en las 2 tandas desde la última auditoría (íconos/duplicar/contador, búsqueda de contenido/breadcrumbs), adelantada por acumulación de superficie nueva.

| # | Problema encontrado | Fix |
|---|---|---|
| 1 | **Real, con impacto en producción:** duplicar una página que tenía el link de compartir activado copiaba también su `share_token` — dos páginas con el mismo token viola el índice único de la migración de sharing, y el guardado de la copia habría fallado por completo | La copia ahora siempre resetea `shareToken` a `null` (y, defensivamente, también el estado de archivado) |
| 2 | La búsqueda de contenido no miraba la URL de bloques de imagen/embed | Ahora también se busca ahí — encontrar "ese video de youtube que pegué" funciona |
| 3 | `getAncestorChain` (breadcrumbs) y `buildVisibleTree` caminan la jerarquía sin protección contra ciclos — si alguna vez los datos quedaran corruptos con un ciclo, congelarían o tirarían abajo la pestaña | Ambas funciones ahora llevan un set de visitados y cortan si detectan un ciclo, en vez de loopear para siempre |

`npm run build` y `npm run lint` siguen en **0 errores, 0 warnings**.

---

## v0.18 — Auditoría de diseño y UX/UI

Primera auditoría enfocada específicamente en frontend, estilos y accesibilidad (no en lógica de datos).

| # | Problema encontrado | Fix |
|---|---|---|
| 1 | **8 inputs agregados en distintas tandas** (buscador ⌘K, link de compartir, selector de emoji personalizado, link de imagen, pie de foto, celdas de tabla, link de embed, buscador de página) quitaban el outline nativo sin poner ningún estilo de foco visible en su lugar — un usuario navegando con teclado no podía saber dónde estaba parado | Los 8 recibieron la clase `glenwyn-focus` (contorno verde musgo visible al tabular) |
| 2 | El color de error (`#B5533C`) estaba hardcodeado en 6 lugares, sin variante para modo oscuro, y con contraste insuficiente en ambos modos (4.44:1 en claro, 3.39:1 en oscuro — la norma AA pide 4.5:1) | Se agregó un token `error` propio con una variante por tema (`#994530` en claro, `#E08A65` en oscuro), ambas con contraste ≥5.3:1 verificado |

**Hallazgo más importante, no arreglado en esta pasada (requiere su propia tanda dedicada):**
La app no tiene ningún manejo de pantallas angostas — el sidebar tiene ancho fijo (240px/56px), el canvas usa paddings fijos, y **10 acciones distintas dependen exclusivamente de `:hover`** (pin, agregar subpágina, duplicar, eliminar, quitar divisor/imagen/embed). En un celular o tablet sin mouse, esas 10 acciones son literalmente inalcanzables — no hay forma de activarlas. Arreglar esto bien implica: sidebar como drawer superpuesto en pantallas angostas, breakpoints de padding, y una alternativa a los hovers (por ejemplo, un botón "⋯" siempre visible en touch, o acciones accesibles con un tap largo). Es un trabajo de UX considerable, no un parche rápido — lo dejo identificado y priorizado para cuando se aborde.

`npm run build` y `npm run lint` siguen en **0 errores, 0 warnings**.

---

## v0.19 — Soporte mobile/touch

Se aborda el hallazgo más grande de la auditoría anterior.

- **Sidebar como drawer:** en pantallas ≤640px, el sidebar deja de empujar el contenido y pasa a flotar por encima (`position: fixed`) como un panel deslizable, con fondo semitransparente detrás que lo cierra al tocarlo
- **Botón ☰** en la barra superior para abrir el drawer cuando está cerrado (en pantallas angostas arranca cerrado, sin importar la preferencia guardada de una sesión de escritorio)
- Elegir una página desde el sidebar en pantalla angosta **cierra el drawer automáticamente** — si no, quedaría tapando el contenido recién abierto
- **Las 10 acciones que dependían de `:hover`** (pin, agregar subpágina, duplicar, eliminar, quitar divisor/imagen/embed) ahora se muestran siempre en dispositivos táctiles, vía `@media (hover: none)` — se limpió además el código JS que manejaba la visibilidad manualmente, quedó 100% resuelto por CSS
- Padding reducido en pantallas angostas, tanto en la app principal como en la vista pública de compartir (que vive en un árbol de componentes separado y necesitó sus propias reglas)
- Los modales (búsqueda, papelera, historial, compartir) siempre quedan por encima del drawer del sidebar, incluso si ambos estuvieran abiertos a la vez

100% del lado del cliente — no necesita ninguna migración nueva. `npm run build` y `npm run lint` siguen en **0 errores, 0 warnings**.

---

## v0.20 — Ayuda de atajos + título dinámico

- **Modal de atajos de teclado:** tecla `?` (solo cuando no estás escribiendo, para no interferir con notas que usen ese carácter) o botón dedicado en el sidebar. Documenta los atajos generales, los de dentro de un bloque, y los de markdown — nada de esto estaba escrito en ningún lado hasta ahora
- **Título de pestaña dinámico:** muestra `Nombre de la página · Glenwyn` en vez de siempre "glenwyn", tanto en la app como en la vista pública compartida — ayuda a encontrar la pestaña correcta entre varias, y le da un nombre real a los favoritos del navegador

100% del lado del cliente — no necesita ninguna migración nueva. `npm run build` y `npm run lint` siguen en **0 errores, 0 warnings**.

---

## v0.21 — Auditoría de seguridad

Primera auditoría enfocada específicamente en seguridad: políticas de RLS, la función pública de compartir, Storage, auth, y vectores de inyección.

**Revisado y confirmado que ya estaba bien (sin cambios necesarios):**
- Las 3 superficies con RLS (`pages`, `page_versions`, `storage.objects`) están todas correctamente scopeadas por `auth.uid()` — ninguna tabla quedó expuesta sin RLS
- La función `get_shared_page` (RPC de compartir) proyecta solo las columnas necesarias (`id, title, blocks, updated_at`) — nunca expone `user_id` ni la jerarquía de páginas de nadie
- No es posible robar/colisionar el link de otro usuario ni siquiera manipulando la API directamente — el índice único sobre `share_token` lo previene a nivel de base de datos, no solo en el código del cliente
- Ningún contenido de usuario se renderiza nunca vía `dangerouslySetInnerHTML` — todo pasa por el escapado automático de React, incluso en los iframes de embed (la URL se arma en el servidor... en realidad en el cliente, pero solo como string interpolado, nunca como HTML)
- Las URLs de imagen/embed ya estaban restringidas a `http(s)` desde la auditoría de diseño anterior — previene `javascript:`/`data:` URIs

**Arreglado:**
- **Faltaban headers de seguridad HTTP por completo.** Se agregaron a `vercel.json`: `X-Frame-Options` (previene que Glenwyn se embeba en un iframe ajeno para clickjacking), `X-Content-Type-Options: nosniff`, `Referrer-Policy`, y un `Permissions-Policy` que desactiva explícitamente geolocalización/micrófono/cámara (funcionalidades que la app no usa)

**Recomendación operativa (no es código, es configuración de Supabase):**
- Activar el rate limiting de Supabase para la función RPC pública `get_shared_page` y para el bucket público de imágenes, como capa extra de defensa contra abuso — no es crítico (los tokens son UUIDs de 122 bits, imposibles de adivinar por fuerza bruta) pero es una buena práctica estándar para cualquier endpoint sin autenticación

`npm run build` y `npm run lint` siguen en **0 errores, 0 warnings**.

---

## v0.22 — Auditorías de performance, accesibilidad, SEO y calidad de código

Las 4 auditorías que quedaban pendientes, todas en una tanda.

### Performance
- **0 usos de `useMemo` en todo el archivo.** Las listas derivadas (`livePages`, `archivedPages`, `pinnedPages`, `filteredPages`, `visibleTree`, `breadcrumbChain`) se recalculaban en cada render, incluso los disparados por cosas sin relación (abrir un modal, arrastrar, cambiar de tema). Ya están todas memoizadas.

### Accesibilidad (a fondo)
**El hallazgo más grande de toda la sesión:** todo el árbol de páginas del sidebar era invisible para navegación por teclado — eran `<div onClick>` sin `tabIndex` ni `role`. Alguien navegando solo con teclado no podía ni llegar ahí, mucho menos abrir una página.

- `PageRow`, la lista de Favoritos, los resultados de búsqueda del sidebar, el modal ⌘K, y el selector de página del bloque "link a página" — todos ahora son `role="button"` + `tabIndex={0}` + activables con Enter/Espacio
- Los 5 modales (buscar, papelera, historial, compartir, atajos) ahora tienen `role="dialog"`, `aria-modal`, y `aria-label`
- `aria-label` en los botones de solo-ícono más usados (pin, agregar subpágina, duplicar, eliminar) y en la casilla de tareas
- El foco visible ahora gana siempre con `!important`, sin importar qué outline inline haya encima

### SEO / metadata
- `lang="en"` en una app 100% en español — corregido a `lang="es"` (afecta SEO y qué motor de voz usa un lector de pantalla)
- Se agregaron meta description, Open Graph y Twitter Card básicos a `index.html` (no existía ninguno)
- La vista compartida actualiza esas mismas tags dinámicamente con el contenido real de la página
- **Salvedad importante:** la mayoría de los crawlers sociales (Facebook, WhatsApp, Slack) no ejecutan JavaScript, así que esto solo ayuda en los clientes que sí lo hacen. Una solución completa necesitaría una función serverless que pre-renderice HTML para bots — queda anotado como mejora futura, no se implementó ahora

### Calidad de código
- `App.jsx` tenía 4117 líneas en un solo archivo. Se extrajo toda la lógica pura de páginas/bloques (sin React, sin JSX, sin hooks) a `src/lib/pageUtils.js` — 365 líneas que ahora se pueden leer y eventualmente testear de forma completamente aislada
- `App.jsx` quedó en 3782 líneas — sigue siendo grande (son muchos componentes de UI), pero separar la lógica de negocio del árbol de componentes es un paso real hacia algo más mantenible
- **Recomendación no aplicada todavía** (por riesgo/alcance): dividir también los componentes de bloque (`ImageBlock`, `TableBlock`, `EmbedBlock`, `PageLinkBlock`, etc.) en archivos propios. Es una refactorización más grande, con más superficie para introducir un bug sutil sin poder probarlo en vivo — mejor abordarla en su propia tanda dedicada, no de paso en una auditoría

`npm run build` y `npm run lint` siguen en **0 errores, 0 warnings** después de las 4 auditorías.

---

## v0.23 — Backlinks (Nivel 1)

Primera pieza del roadmap de brechas frente a Obsidian.

- **Panel "Referenciado por"** al final de cada página: lista todas las demás páginas que tienen un bloque de "link a página" apuntando a la que estás viendo, clickeables para saltar directo
- Se calcula 100% del lado del cliente a partir del bloque "link a página" que ya existía — **cero migraciones, cero tablas nuevas**
- A propósito **no aparece en la vista pública compartida** — mostrar "quién te menciona" ahí filtraría títulos de otras páginas privadas a un visitante anónimo
- Reutiliza el mismo patrón de fila navegable por teclado (`role="button"`, `tabIndex`, Enter/Espacio) que ya se estandarizó en la auditoría de accesibilidad

Con esto queda cubierto el "Nivel 1" de backlinks del documento de diseño. El "Nivel 2" (menciones inline con `[[doble corchete]]` dentro del texto corrido) queda para una tanda propia, ya que requiere resolver primero cómo un bloque de texto puede mostrar un link clickeable sin dejar de ser editable.

100% del lado del cliente — no necesita ninguna migración nueva. `npm run build` y `npm run lint` siguen en **0 errores, 0 warnings**.

---

## v0.24 — Tareas con fecha + vista global "Mis tareas"

Segunda pieza priorizada del roadmap, inspirada en Todoist.

- **Fecha de vencimiento en tareas:** cada bloque de tarea ahora tiene un campo `dueDate` opcional (nuevo campo en el bloque jsonb — sin migración). Chip visual junto al texto: rojo si está vencida, verde musgo si es hoy, discreto si es futura. Selector de fecha nativo, también visible (sin poder editarla) en la vista pública compartida
- **Vista global "Mis tareas":** nuevo destino en el sidebar (con contador de vencidas+hoy) que junta todas las tareas con fecha de todo el workspace, agrupadas en Vencidas / Hoy / Próximas / Completadas — igual que la vista Today/Upcoming de Todoist. Click en una tarea la tilda desde ahí mismo; click en el nombre de la página te lleva directo a editarla
- Se calcula 100% del lado del cliente escaneando todas las páginas — mismo principio que los backlinks, ninguna tabla ni consulta nueva

Quedan pendientes del documento de diseño de tareas: prioridad, recurrencia, y lenguaje natural para fechas en español — cada una queda para su propia tanda.

100% del lado del cliente — no necesita ninguna migración nueva. `npm run build` y `npm run lint` siguen en **0 errores, 0 warnings**.

---

## v0.25 — Prioridad y recurrencia en tareas

Cierra el documento de diseño de tareas (excepto lenguaje natural para fechas, que queda deliberadamente para el final).

- **Prioridad:** un ⚑ clickeable junto a cada tarea cicla entre alta / media / baja / sin prioridad. Se usaron 3 niveles en vez de los 4 de Todoist, para mapear directo a los 3 colores de acento que ya existían en la paleta (rojo/ámbar/verde) sin inventar uno nuevo
- **Recurrencia:** un selector junto a la fecha (diaria / semanal / mensual). Al completar una tarea recurrente, en vez de quedar tildada, la fecha se corre sola al próximo vencimiento y vuelve a aparecer sin marcar — igual que en Todoist
- Ambos campos se muestran también en la vista global "Mis tareas" (⚑ + ↻) y en la vista pública compartida (sin poder editarlos ahí, claro)
- Se integran a la limpieza de campos al convertir un bloque, siguiendo el mismo patrón que ya usábamos para imagen/embed/link

100% del lado del cliente — no necesita ninguna migración nueva. `npm run build` y `npm run lint` siguen en **0 errores, 0 warnings**.

---

## v0.26 — Lenguaje natural para fechas (en español)

Última pieza del documento de diseño de tareas — la que se había dejado para el final a propósito por ser la más incierta técnicamente.

- Escribís algo como "Llamar al contador mañana" o "Pagar el alquiler todos los lunes" en una tarea, presionás Enter o salís del bloque, y la fecha (y recurrencia si corresponde) se completa sola, sacando la frase del texto
- **Se escribió un parser propio a medida en vez de usar una librería** (como habíamos anotado en el diseño): las librerías de fechas en lenguaje natural más conocidas están pensadas para inglés y no manejan bien el español
- Frases soportadas: `hoy`, `mañana`, `pasado mañana`, `en N días`, `en N semanas`, un día de la semana suelto (`el viernes`), y las recurrentes `cada día`/`todos los días`, `cada lunes`/`todos los lunes` (cualquier día), `cada semana`, `cada mes`
- Se dispara solo al terminar de escribir la línea (Enter o perder el foco), nunca en cada tecla — así "mañana" no te corta la palabra a mitad de camino mientras seguís escribiendo "mañanita" o cualquier frase más larga
- Probado con 10 casos representativos, todos correctos, incluyendo que un texto sin ninguna frase de fecha no dispara nada

**Fuera de alcance a propósito, por ahora:** fechas con día del mes explícito ("el 15 de agosto"), horarios ("mañana a las 3pm"), y frases más ambiguas o compuestas. El selector de fecha manual sigue ahí para esos casos.

100% del lado del cliente — no necesita ninguna migración nueva. `npm run build` y `npm run lint` siguen en **0 errores, 0 warnings**.

---

## v0.27 — Vaciar papelera + ordenar páginas

Cierra la Fase 1 completa del roadmap priorizado.

- **Vaciar papelera de una sola vez:** botón en el panel de la papelera, con confirmación (avisa cuántas páginas se van a eliminar para siempre), y limpia también las imágenes subidas de todas ellas — mismo mecanismo que ya usaba el borrado individual
- **Ordenar páginas:** botón ⇅ arriba del árbol del sidebar, cicla entre **orden manual** (el de siempre, por drag), **alfabético**, y **recientes primero**. El orden alternativo es solo visual — nunca toca el campo de orden manual subyacente, así que volver a "orden manual" te devuelve exactamente donde estaba
- Mientras el orden no sea manual, arrastrar páginas se desactiva (evita la confusión de arrastrar algo a un lugar que después no coincide con lo que se ve)
- Se sumó el campo `updated_at` (ya existía en la tabla desde el principio, pero no se leía del lado del cliente) para poder ordenar por "recientes primero"

100% del lado del cliente — no necesita ninguna migración nueva. `npm run build` y `npm run lint` siguen en **0 errores, 0 warnings**.

---

## v0.28 — Rotar link de compartir

- Botón **"Rotar link"** en el panel de compartir: genera un token nuevo al instante, invalidando el anterior sin tener que desactivar y reactivar (lo que además hubiera dejado el link viejo activo un momento entre medio)
- Con confirmación, ya que el link viejo deja de funcionar de inmediato para cualquiera que lo tuviera guardado
- No necesita ninguna migración nueva — usa la misma columna `share_token` de siempre

`npm run build` y `npm run lint` siguen en **0 errores, 0 warnings**.

---

## v0.29 — Menciones inline `[[página]]` (Backlinks Nivel 2)

Cierra el documento de diseño de backlinks — la parte que requería resolver primero cómo un bloque de texto podía mostrar un link clickeable sin dejar de ser editable.

- **Modo dual en bloques de texto:** mientras el bloque no tiene foco, una mención `[[Título]]` se muestra como link clickeable (verde musgo si la página existe, subrayado punteado si no se encontró); al hacer click, entra en modo edición y muestra los corchetes crudos para poder editarlos
- **Autocompletado:** escribir `[[` abre un buscador de páginas en vivo, con navegación por teclado (↑↓ Enter Esc) — mismo mecanismo que el menú `/`
- **Las menciones ahora también cuentan como backlinks:** el panel "Referenciado por" de una página incluye tanto los bloques de "link a página" como cualquier mención `[[así]]` resuelta hacia ella
- La vista pública compartida no tiene el resto del workspace para resolver menciones, así que ahí una mención se muestra como texto plano limpio (sin corchetes, no clickeable) en vez de sintaxis cruda o un link roto

**Fuera de alcance a propósito por ahora:** resolución difusa de títulos parecidos (hoy es coincidencia por substring, no fuzzy matching), y renombrar una página no actualiza automáticamente las menciones existentes que la referenciaban con el título viejo.

100% del lado del cliente — no necesita ninguna migración nueva. `npm run build` y `npm run lint` siguen en **0 errores, 0 warnings**.

---

## v0.30 — Quinta auditoría (datos/lógica + UX/UI)

Revisión enfocada en las 3 tandas desde la última auditoría de datos (compartir con rotación, y las dos partes de backlinks).

| # | Problema encontrado | Fix |
|---|---|---|
| 1 | **Confirmado con test:** una tarea mensual recurrente con vencimiento el 31 de enero saltaba al 3 de marzo en vez del 28 de febrero — JavaScript "desborda" el mes en lugar de ajustar al último día válido | Se clampa al último día real del mes destino, igual que hacen Todoist y Google Calendar. Verificado también con año bisiesto (29 de febrero) |
| 2 | La detección de menciones `[[` buscaba la *última* aparición en todo el bloque de texto, no la más cercana al cursor — con dos menciones en un mismo párrafo, editar la primera después de que la segunda ya estuviera cerrada podía detectar la mención equivocada | Ahora busca hacia atrás *desde la posición del cursor*, no en todo el string |
| 3 | Si un bloque ya tenía una mención resuelta y arrancabas a escribir una segunda sin llegar a elegirla, y hacías click afuera, el buscador de páginas quedaba flotando huérfano sobre la vista de solo lectura del bloque | El buscador ahora se cierra también al perder el foco del bloque |

**Revisado y confirmado que ya estaba bien:** el orden alternativo de páginas (alfabético/recientes) nunca toca el campo de orden manual; vaciar la papelera reutiliza correctamente la limpieza de imágenes; rotar el link de compartir invalida el anterior de inmediato a nivel de base de datos, no solo en el cliente.

`npm run build` y `npm run lint` siguen en **0 errores, 0 warnings**.

---

## v0.31 — Guía de uso como página propia

- **`public/guia.html`:** guía completa de uso, servida como página estática real en `/guia.html` — con la identidad visual de Glenwyn (misma paleta, tipografías, textura de grano), modo claro/oscuro propio, y un sidebar de navegación que imita al de la app (colapsable, resalta la sección activa mientras scrolleás)
- Cubre 12 secciones: primeros pasos, navegación, escribir, atajos de markdown, los 11 tipos de bloque (cada tarjeta se ve como el bloque real, no solo un ícono), tareas, backlinks y menciones, papelera e historial, compartir y exportar, personalización, mobile y atajos, y recursos
- Link **"📖 Guía de uso"** agregado al sidebar de la app, abre en una pestaña nueva
- El `vercel.json` existente redirigía *todo* a `index.html` — se ajustó el rewrite para excluir explícitamente `/guia.html`, así se sirve como archivo estático real en vez de redirigir a la app

`npm run build` y `npm run lint` siguen en **0 errores, 0 warnings**.

---

## v0.32 — Login con múltiples métodos

- **Pantalla de login rediseñada por completo:** email + contraseña (con "olvidé mi contraseña" y crear cuenta), Google, Facebook, Microsoft (Azure), y teléfono por SMS
- Flujo completo de restablecer contraseña, incluyendo la pantalla que aparece al volver desde el link del email
- El botón "Cerrar sesión" ahora muestra el email o el teléfono según cómo te hayas logueado, en vez de asumir que siempre hay un email (las cuentas por teléfono no tienen uno)
- Cada proveedor nuevo (Facebook, Microsoft, teléfono) necesita su propia configuración externa antes de funcionar — documentado paso a paso en `CHECKLIST.md`. El de teléfono es el único que además necesita un proveedor de SMS de terceros (Twilio) con costo propio

`npm run build` y `npm run lint` siguen en **0 errores, 0 warnings**.

---

## v0.33 — Auditoría UX/UI de la pantalla de login

- **Reordenamiento con base en evidencia real:** los métodos de un click (Google, Facebook, Microsoft, teléfono) ahora van primero — convierten mejor y piden menos esfuerzo que un formulario de contraseña. Email+contraseña quedó como alternativa "o con tu email", no como default
- **Labels de verdad en cada campo** (antes solo había placeholder, que desaparece al escribir — problema de accesibilidad real)
- **Mostrar/ocultar contraseña** en todos los campos de contraseña
- **Botones OAuth con texto**, no solo ícono — con Microsoft en particular, el logo de cuadraditos no se reconoce tan rápido sin la palabra al lado
- **`autoComplete` en todos los campos**, incluyendo `one-time-code` en el del SMS — permite que el navegador sugiera contraseñas guardadas, y que iOS/Android autocompleten el código recibido por SMS
- Los botones OAuth ahora se deshabilitan mientras cargan, para que no se puedan clickear varias veces seguidas
- Mensajes de error con `role="alert"` para que un lector de pantalla los anuncie solo
- Contraseña mínima subida de 6 a 8 caracteres
- El formulario ahora vive dentro de una tarjeta con borde y sombra, consistente con el resto de los paneles de Glenwyn (antes flotaba directo sobre el fondo, sin ese tratamiento)

`npm run build` y `npm run lint` siguen en **0 errores, 0 warnings**.

---

## v0.34 — Auditoría mobile-first de la pantalla de login

Revisión explícita contra 320px de ancho (el punto de referencia clásico para mobile-first), no solo contra un celular grande donde todo entra fácil.

- **Fix real, no cosmético:** los inputs tenían `font-size: 14px` — iOS Safari hace zoom automático en cualquier campo con menos de 16px al tocarlo. Subido a 16px en todos
- **Botones por debajo del área táctil mínima recomendada** (44×44pt Apple / 48×48dp Material) — ahora todos los botones e inputs tienen `min-height: 44px`
- El toggle de mostrar/ocultar contraseña tenía un área táctil real de ~20px, la mitad del mínimo, y pegado al borde del campo — ahora ocupa los 44px completos de alto del input
- **Media query real agregada** (antes todo dependía solo de flexbox, sin ningún breakpoint): en pantallas ≤360px, Facebook y Microsoft pasan de compartir fila a apilarse verticalmente, y el padding de la tarjeta se reduce — a 320px, antes quedaban apretadísimos; ahora cada botón usa el ancho completo

`npm run build` y `npm run lint` siguen en **0 errores, 0 warnings**.

---

## v0.35 — Fix mobile: barra superior de la app amontonada

Bug real reportado con captura de pantalla: en mobile, "compartir / exportar / historial / palabras" y el indicador de guardado se amontonaban y se superponían — el mismo problema de "sin estrategia responsive" que ya se había auditado en la pantalla de login, pero nunca se aplicó a esta barra.

- En pantallas angostas, esos 4 elementos se juntan en un solo botón **"⋯ Más acciones"** que abre un menú desplegable — en vez de competir todos por el mismo espacio horizontal
- El indicador de guardado, que antes podía mostrar un texto largo ("No se pudo guardar. Revisá tu conexión.") justo en el lugar más apretado de toda la barra, ahora es un punto de color compacto en mobile (rojo = error, ámbar = guardando, verde = guardado), con el texto completo disponible al tocarlo
- El título/breadcrumb ahora trunca correctamente en vez de empujar a los botones de al lado

`npm run build` y `npm run lint` siguen en **0 errores, 0 warnings**.

---

## v0.36 — Fix crítico: las páginas nunca se guardaban de verdad

Bug encontrado en producción, con el error real de Postgres en la consola: `invalid input syntax for type uuid: "mnh2lfhl"`.

- **La causa:** la función `uid()` generaba strings cortos (`Math.random().toString(36)`) pensados para IDs de bloques y `key` de React — pero se reutilizaba también para el `id` de cada página, y `pages.id` en Postgres es de tipo `uuid` estricto. Cada intento de guardar una página nueva fallaba con un 400
- **El impacto real:** ninguna página se guardaba nunca en Supabase — todo vivía solo en el estado local del navegador, por eso siempre volvía a aparecer "Bienvenida" como si nada se hubiera guardado jamás
- **El fix:** `uid()` ahora genera un UUID real con `crypto.randomUUID()` (el mismo mecanismo que ya se usaba en otras partes del código, como los tokens de compartir). Una sola línea de cambio, sin necesidad de migrar datos — como ninguna página se había guardado exitosamente antes, no hay nada que arreglar del lado de la base

`npm run build` y `npm run lint` siguen en **0 errores, 0 warnings**.

---

## v0.37 — Borde visible al seleccionar un bloque

- Los bloques de texto no mostraban ningún indicador visual al hacer click adentro con el mouse — solo se veía algo navegando con `Tab` (`:focus-visible` no se activa con click en la mayoría de los navegadores). Se agregó un borde izquierdo sutil, propio, que sí aparece con click normal — la forma en que la gente edita la mayor parte del tiempo
- Implementado con `box-shadow` en vez de un `border` real, para que no empuje ni desplace el texto ni un píxel al aparecer/desaparecer

`npm run build` y `npm run lint` siguen en **0 errores, 0 warnings**.

---

## v0.38 — Fix: Enter y duplicar bloque no movían el foco

Bug real reportado con captura de pantalla: escribir, apretar Enter, y en vez de pasar al bloque nuevo, el cursor se quedaba en el mismo — cada Enter de más solo apilaba otro bloque vacío abajo sin moverse nunca ahí.

- **`addBlock` (Enter para crear un bloque nuevo):** nunca movía el foco al bloque recién creado. Ahora sí, con el mismo mecanismo (`blockRefs` + `requestAnimationFrame`) que ya usaba `deleteBlock` para volver al bloque anterior al borrar
- **`duplicateBlock` (⌘/Ctrl+D):** mismo bug exacto, mismo fix — encontrado al revisar si había más lugares con el mismo patrón antes de que alguien lo reportara por separado

`npm run build` y `npm run lint` siguen en **0 errores, 0 warnings**.

---

## v0.39 — Páginas "hub" (vínculos dorados)

Idea #24 del banco de ideas — la de menor esfuerzo con impacto real: destacar visualmente qué páginas son las más conectadas del workspace, sin ninguna IA.

- Un punto dorado sutil junto al título, en el árbol del sidebar, para las páginas referenciadas por **3 o más** (bloque de link o mención inline, cuenta cualquiera de los dos)
- `getBacklinkCounts()` calcula todos los conteos en **una sola pasada** sobre el workspace, no llamando a `getBacklinks()` en un loop por cada página — eso hubiera sido O(n²) sin necesidad
- Al pasar el mouse por el punto, un tooltip dice cuántas páginas la referencian
- 100% del lado del cliente, cero infraestructura nueva — reutiliza exactamente los backlinks que ya existían

`npm run build` y `npm run lint` siguen en **0 errores, 0 warnings**.

---

## v0.40 — Mini-mapa de vecinos (vista de grafo, versión chica)

La versión liviana de "vista de grafo" del roadmap — en vez del grafo completo del workspace (🔴, un proyecto en sí mismo), el mini-mapa local (🟢) que ya estaba priorizado como mejor punto de partida.

- **`getOutgoingLinks()`:** la pieza que faltaba — hasta ahora solo existían los backlinks (quién te menciona a vos), nunca el sentido contrario (a quién mencionás vos). Necesario para que el mapa tenga las dos direcciones
- Al final de cada página, un diagrama SVG chico (sin ninguna librería de layout) con hasta 7 vecinos directos — quién te referencia (punto ámbar) y a quién referenciás (punto verde musgo), cada uno clickeable para saltar directo
- Mismo lugar que el panel "Referenciado por" — nunca aparece en la vista pública compartida, por la misma razón de privacidad (no filtrar la estructura del resto del workspace a un visitante anónimo)
- Deliberadamente NO es el grafo completo del workspace — mostrar solo los vecinos directos de la página que estás mirando es más útil en el momento, y muchísimo más barato de construir

`npm run build` y `npm run lint` siguen en **0 errores, 0 warnings**.

---

## v0.41 — Bases de datos estilo Notion (Fase A)

Arranca la Fase 3 del roadmap — el proyecto grande que ya tenía su propio documento de diseño. Esta primera fase: una sola vista de tabla, tipos de propiedad básicos, sin relaciones todavía (eso es Fase C).

- **`006_databases.sql`:** tablas `databases` (esquema de propiedades) y `database_views` (para cuando existan más vistas que tabla), más `database_id`/`properties` en `pages`. RLS completo en las dos tablas nuevas
- **La decisión central del diseño, aplicada tal cual:** un registro de base de datos es simplemente una página normal con `parentId` apuntando a la página-base-de-datos — hereda papelera, historial de versiones e íconos gratis, sin código adicional
- **Crear una:** opción "🗄 Base de datos" en el selector de plantillas. La página se guarda directamente en Postgres *antes* de crear el registro en `databases` — si no, la relación de llave foránea fallaría porque la página todavía no existiría del lado del servidor
- **`DatabaseTableView`:** columnas editables (nombre, tipo, quitar), 5 tipos de propiedad (texto, número, selección, fecha, casilla), agregar/eliminar filas, abrir cualquier registro como página completa con su propio contenido de bloques
- Los cambios de esquema (agregar/renombrar/quitar una propiedad) se guardan al instante, no por el autoguardado debounced normal — son cambios estructurales poco frecuentes, no vale la pena esperar

**Fuera de alcance a propósito en esta fase** (documentado desde el diseño original): vistas de tablero/calendario (Fase B), relaciones y rollups entre bases de datos (Fase C), plantillas de registro y fórmulas (Fase D, la última probablemente ni se construya).

`npm run build` y `npm run lint` siguen en **0 errores, 0 warnings**.

---

## v0.42 — Bases de datos: Fase B (tablero + calendario)

Sin ningún cambio de esquema — exactamente como estaba planeado en el diseño original: las tres vistas muestran los mismos registros, solo cambia cómo se organizan.

- **Selector de vistas** (Tabla / Tablero / Calendario) arriba de cada base de datos, con pestañas
- **Tablero:** agrupa por la primera propiedad de tipo "Selección" que tenga la base de datos — columnas tipo kanban, "+ agregar" en cada columna crea un registro con ese valor ya puesto. Si la base de datos no tiene ninguna propiedad de selección, lo dice claro en vez de adivinar
- **Calendario:** agrupa por la primera propiedad de tipo "Fecha" — grilla mensual con navegación ‹ ›, hasta 3 registros visibles por día ("+N más" si hay más), click en un día agrega un registro con esa fecha ya puesta. Deliberadamente una agenda simple, no un widget de scheduling completo
- La elección de vista se recuerda por base de datos mientras la sesión sigue abierta (no persiste todavía entre sesiones — quedaría para cuando se implemente `database_views` a fondo)

`npm run build` y `npm run lint` siguen en **0 errores, 0 warnings**.

---

## v0.43 — Bases de datos: Fase C (relaciones + rollups)

La pieza más compleja del diseño original — y la única de las 4 fases que traía un riesgo anotado desde el principio: los rollups pueden formar ciclos (rollup A depende de rollup B que depende de rollup A).

- **Propiedades de tipo "Relación":** conectan registros de una base de datos con registros de otra — el valor es simplemente un array de IDs de página, mostrado como chips con un checklist para agregar/quitar
- **Propiedades de tipo "Rollup":** agregan (contar, sumar, promediar) una propiedad de los registros relacionados a través de una relación — de solo lectura, siempre calculado al mostrar, nunca guardado
- **Protección contra ciclos, probada con un caso real:** armé un escenario de prueba con dos rollups que dependen uno del otro (A→B→A) — la primera versión detectaba el ciclo en el nivel más profundo de la recursión, pero `Number(null) === 0` en JavaScript hacía que el error se perdiera al burbujear hacia arriba, mostrando "0" en silencio en vez de señalar el problema. Corregido propagando el error explícitamente en cada nivel, no solo en el que lo detecta
- Encabezado de columna con la configuración inline: para una relación, elegís con qué base de datos conectar; para un rollup, elegís a través de qué relación, qué propiedad de los registros relacionados, y cómo agregarla

`npm run build` y `npm run lint` siguen en **0 errores, 0 warnings**.

---

## v0.44 — Bases de datos: Fase D (plantillas + galería) — cierra el proyecto de bases de datos

Última fase del documento de diseño original. Con esto, las 4 fases planeadas hace varias tandas ya están todas construidas.

- **Plantillas para registros nuevos, versión simple:** en vez de un sistema de plantillas con nombre separado, cada propiedad puede tener un **valor por defecto** que se aplica solo a todo registro nuevo — un select "Prioridad" que arranca en "Media", una casilla que arranca marcada, una fecha que arranca en "hoy". Si el tablero o el calendario ya le pasan un valor explícito al crear (por ejemplo, la columna donde tocaste "+ agregar"), ese valor explícito siempre gana sobre el default
- **Vista de galería:** tarjetas en grilla con las propiedades como badges chicos, para hojear registros de un vistazo en vez de scrollear una tabla ancha de lado a lado
- **Fórmulas: deliberadamente afuera**, tal como decía el diseño original desde el principio — construir un motor de expresiones propio (con su propio lenguaje, parser, y validación) es un proyecto en sí mismo, no una fase más de este

`npm run build` y `npm run lint` siguen en **0 errores, 0 warnings**.

---

## v0.45 — Notas huérfanas

Idea #16 del banco de ideas — de las de menor esfuerzo, sin ninguna dependencia de IA.

- **`getOrphanPages()`:** reutiliza el mismo `getBacklinkCounts()` de las páginas hub — cualquier página con cero backlinks es huérfana, calculado en la misma pasada, cero costo extra
- Nueva vista en el sidebar ("🝓 Notas huérfanas", con contador) — mismo patrón visual y de estado que "Mis tareas", incluida la exclusión mutua entre las dos (abrir una cierra la otra) y el mismo tratamiento en la barra superior (título, oculta los botones específicos de página)
- A propósito **no es una lista de tareas pendientes** — el texto de la vista aclara que no hace falta conectarlas todas, es solo para saber cuáles existen sin red antes de decidir enlazarlas, archivarlas, o dejarlas así

`npm run build` y `npm run lint` siguen en **0 errores, 0 warnings**.

---

## v0.46 — Extraer a nota atómica

Idea #15 del banco de ideas — reduce la fricción de practicar Zettelkasten de verdad a un solo atajo, en vez de copiar/crear página/pegar/enlazar a mano.

- Seleccionás texto dentro de un párrafo → `⌘/Ctrl+Shift+E` → se crea una página nueva con ese texto, y donde estaba la selección queda una mención `[[Título]]` enlazada, vía el mismo sistema de menciones que ya existe
- El título de la página nueva se toma de la primera línea del texto seleccionado, truncado si es muy largo
- Se queda en la página de origen — no navega a la nueva, para no interrumpir en qué estabas trabajando
- Agregado a la ayuda de atajos (`?`) para que sea descubrible, ya que no tiene ningún botón visible

`npm run build` y `npm run lint` siguen en **0 errores, 0 warnings**.

---

## v0.47 — Bandeja de entrada

Idea #14 del banco de ideas — la distinción de Zettelkasten entre notas fugaces y permanentes, hecha herramienta concreta.

- Una página "Bandeja de entrada" que se crea sola la primera vez, recordada por ID en las preferencias locales del dispositivo — **sin ninguna migración nueva**
- Botón propio en el sidebar para ir directo, y un atajo global **`⌘/Ctrl+Shift+I`** que funciona desde cualquier lugar de la app: te lleva a la bandeja y deja el cursor listo para escribir, en un solo paso
- **Bug real encontrado y arreglado antes de llegar a producción:** el `useEffect` de atajos globales solo se registra una vez al montar la app (dependencias `[]`), así que la función de captura rápida hubiera quedado con un cierre obsoleto de `inboxPageId` — siempre `null`, el valor inicial, nunca hubiera andado. Se arregló con el mismo patrón de `ref` que el código ya usa para mantener `pages`/`activeId` frescos dentro de cierres de larga duración (`inboxPageIdRef`)

`npm run build` y `npm run lint` siguen en **0 errores, 0 warnings**.

---

## v0.48 — Indicador de madurez de una nota

Idea #17 del banco de ideas — de las de menor esfuerzo, cero campos manuales que mantener.

- **`getPageMaturity()`:** calcula la etapa Zettelkasten de cada página a partir de señales que ya existen — sin backlinks todavía = "fugaz"; con backlinks pero menos de 40 palabras = "en proceso"; con backlinks y contenido sustancial = "permanente"
- Un punto de color chico antes del ícono de cada página en el sidebar (verde = permanente, ámbar = en proceso) — **fugaz no muestra nada a propósito**, ya que es el estado por defecto de casi toda página nueva y marcarlo siempre sería puro ruido visual sin agregar información
- Cero campo nuevo que llenar a mano — se recalcula solo con cada cambio, como los backlinks y las páginas hub

`npm run build` y `npm run lint` siguen en **0 errores, 0 warnings**.

---

## v0.49 — Rastro de navegación

Idea #36 del banco de ideas — de las de menor esfuerzo.

- Nueva sección "Recorrido reciente" en el sidebar, arriba de Favoritos: las últimas 5 páginas que visitaste esta sesión, sin repetir, sin la que tenés abierta ahora mismo
- Deliberadamente **no es el árbol fijo** — es tu camino real saltando de mención en mención o de backlink en backlink, para volver sobre tus pasos después de una sesión de investigación larga
- Solo dura la sesión (no se guarda entre visitas) — es un rastro de "recién estuve acá", no un historial permanente

`npm run build` y `npm run lint` siguen en **0 errores, 0 warnings**.

---

## v0.50 — Pátina del tiempo

Idea #33 del banco de ideas.

- **`getPageAge()`:** a partir de `updatedAt` (o `createdAt` si nunca se editó), clasifica cada página en reciente / envejeciendo (30+ días sin tocar) / vieja (90+ días)
- Las páginas envejeciendo y viejas se ven un poco más apagadas en el sidebar (opacidad reducida) — no es una advertencia de "desactualizado", es más parecido a cómo se ve una foto vieja
- A propósito **nunca se aplica a la página que tenés abierta en ese momento** — verla apagada mientras la estás mirando y editando sería confuso, no cálido

`npm run build` y `npm run lint` siguen en **0 errores, 0 warnings**.

---

## v0.51 — Modo Zen (renombrado) + Modo Deep Work

Idea #42 del banco de ideas, renombrada a pedido a "Modo Zen", más una versión nueva con temporizador.

- **Modo Zen** (antes "modo enfoque") — mismo comportamiento de siempre, solo el nombre visible cambió, en la UI y en la ayuda de atajos
- **Modo Deep Work:** la misma idea, pero con temporizador — elegís 25/50/90 minutos desde un botón nuevo en el sidebar, y mientras corre se ve la cuenta regresiva en el mismo botón flotante que antes solo decía "salir del Zen". Termina sola cuando se acaba el tiempo, sin depender de que te acuerdes de salir
- Los dos modos son mutuamente excluyentes — activar uno corta el otro, nunca quedan superpuestos
- `Esc` sigue sirviendo para salir de cualquiera de los dos en cualquier momento

`npm run build` y `npm run lint` siguen en **0 errores, 0 warnings**.

---

## v0.52 — División de `App.jsx` + tabla `profiles` (Pasos 1 y 2 de monetización)

### Refactor: `App.jsx` dividido en 7 archivos
Pasó de 6191 a 3194 líneas (**-48%**), en 6 extracciones seguras, cada una compilada y con lint limpio antes de commitear:

| Archivo nuevo | Contenido |
|---|---|
| `src/theme.js` | Tokens de color y fuentes |
| `src/components/SharedPageView.jsx` | Vista pública compartida |
| `src/components/DatabaseViews.jsx` | Tabla/tablero/calendario/galería + celdas |
| `src/components/SecondBrainViews.jsx` | Mis tareas/huérfanas/mini-mapa |
| `src/components/SidebarViews.jsx` | `PageRow`/`IconPicker`/`EmptyState` |
| `src/components/SpecializedBlocks.jsx` | Imagen/tabla/embed/link/menú `/` |
| `src/components/Block.jsx` | El editor de bloque principal |

De paso se encontró y arregló una duplicación real: `truncateLabel` estaba definido dos veces en componentes distintos — ahora vive una sola vez en `pageUtils.js`. Lo que queda en `App.jsx` es el componente `Glenwyn` — el núcleo con todo el estado y los handlers, deliberadamente no dividido más allá de esto por el riesgo de tocar algo tan interconectado para un beneficio marginal.

### Paso 2 de monetización: tabla `profiles`
Ver `DISENO_MONETIZACION.md` para el diseño completo.

- **`007_profiles.sql`:** tabla `profiles` (plan Free/Plus/Business + metadata de Stripe para más adelante), con un trigger que crea el perfil automáticamente para cualquier usuario nuevo, sin importar qué método de login use
- **Backfill incluido en la misma migración** para cuentas que ya existían antes de correrla — ninguna cuenta se queda sin perfil
- La app carga el perfil junto con páginas y bases de datos al iniciar sesión, con un plan "free" local de respaldo si por algún motivo la fila todavía no existe (nunca rompe la carga de la app por esto)
- Indicador discreto del plan actual en el sidebar — **todavía sin Stripe conectado y sin ningún límite activo**, eso queda para los pasos 3 y 4

`npm run build` y `npm run lint` siguen en **0 errores, 0 warnings**.

---

## v0.53 — Páginas legales + panel de Ajustes

- **3 páginas legales nuevas**, servidas estáticas (excluidas del rewrite de la SPA, mismo mecanismo que ya usaba `guia.html`): `privacidad.html`, `terminos.html`, `cookies.html` — con navegación cruzada entre las tres y la misma identidad visual del resto de Glenwyn. **Son un punto de partida razonable, no una revisión legal real** — antes de cobrar dinero de verdad o tener usuarios en la UE, conviene que las revise un abogado
- Enlazadas desde tres lugares: el panel de Ajustes nuevo, la pantalla de login (pie de página), y el formulario de crear cuenta ("al crear una cuenta aceptás...")
- **Panel de Ajustes** (⚙ en el sidebar): cuenta (email/teléfono + plan actual), modo claro/oscuro, los links legales, y accesos directos a la guía de uso y los atajos de teclado — todo consolidado en un solo lugar, como en cualquier app

`npm run build` y `npm run lint` siguen en **0 errores, 0 warnings**.

---

## Todos los bloques disponibles hoy
Texto, encabezado, tarea, lista con viñetas, lista numerada, cita, callout, desplegable (toggle), imagen (URL o upload real), tabla simple, embed (YouTube/Vimeo/Loom/Spotify/genérico), link a otra página, divisor.

---

## Pendiente de configurar (esto sí necesita que estés en la computadora)

1. **SQL en Supabase** — correr en el SQL Editor, en este orden:
   - `supabase/migrations/001_init.sql`
   - `supabase/migrations/002_pinned.sql`
   - `supabase/migrations/003_page_versions.sql`
   - `supabase/migrations/004_storage.sql`
   - `supabase/migrations/005_sharing.sql`
2. **Google OAuth** — dos consolas:
   - **Google Cloud Console** → Credentials → crear OAuth Client ID (Web application) → *Authorized redirect URIs*: `https://TU_PROYECTO.supabase.co/auth/v1/callback`
   - **Supabase** → Authentication → Providers → Google → activar, pegar Client ID/Secret. En Authentication → URL Configuration, agregar tu dominio de Vercel y `http://localhost:5173`
3. **Variables de entorno**
   - Local: copiar `.env.example` a `.env.local` y completar `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`
   - Vercel: las mismas dos variables en Project Settings → Environment Variables, luego redeploy
4. **Probar**
   - Local: `npm install && npm run dev`, probar "Continuar con Google", crear una página, refrescar y confirmar que persiste
   - Luego repetir la prueba en el deploy de Vercel
