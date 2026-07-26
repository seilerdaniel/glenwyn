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

## v0.54 — Flag de administrador

- **`008_admin.sql`:** columna `profiles.is_admin`, separada del plan a propósito — `plan` es de qué suscripción pagás, `is_admin` es de si sos el dueño/operador de Glenwyn. Se le otorga `is_admin = true` y `plan = 'business'` a `dseiler.dev@gmail.com`
- El sidebar y el panel de Ajustes muestran "Administrador" en vez del plan cuando corresponde
- **`DISENO_MONETIZACION.md` actualizado:** el ejemplo de trigger de límites ahora chequea `is_admin` primero — un administrador nunca debería toparse con ningún límite de plan cuando esos triggers se construyan de verdad en el Paso 4

`npm run build` y `npm run lint` siguen en **0 errores, 0 warnings**.

---

## v0.55 — Fix: la migración de admin comparaba el email en modo sensible a mayúsculas

Bug real encontrado probando en vivo: la primera versión de `008_admin.sql` comparaba el email con `=` exacto — si el email quedó guardado con alguna variación de mayúsculas/minúsculas (posible según el proveedor de login), el `update` no encontraba ninguna fila y no aplicaba el flag, **sin tirar ningún error**. Corregido a `lower(email) = lower(...)`, insensible a mayúsculas. El archivo en el repo ya quedó con el fix — si alguna vez se recrea el proyecto de Supabase desde cero, esta vez funciona a la primera.

`npm run build` y `npm run lint` siguen en **0 errores, 0 warnings**.

---

## v0.56 — Re-auditoría de accesibilidad (6ª auditoría)

Enfocada en toda la superficie agregada desde la última auditoría completa: bases de datos (tabla/tablero/calendario/galería), Modo Zen/Deep Work, panel de Ajustes, páginas legales. Primero, un chequeo gratis: `npm audit` sobre las dependencias — **0 vulnerabilidades**.

**4 problemas reales encontrados y arreglados:**

1. **Calendario, tarjetas de tareas del día:** tenían `role="button"` y `tabIndex={0}` pero les faltaba el `onKeyDown` — alguien navegando por teclado llegaba, el lector de pantalla lo anunciaba como botón, pero apretar Enter no hacía nada. Peor que no tener el rol, porque prometía algo que no cumplía
2. **`RelationCell`, botón de editar relaciones:** cuando ya había relaciones, el botón mostraba solo "✎" sin `aria-label` ni `title` — un lector de pantalla lo anunciaba como "botón" sin decir para qué sirve
3. **`RelationCell`, popover de relaciones:** solo se podía cerrar tocando de nuevo el mismo botón que lo abrió — sin `Escape`, sin click afuera. Agregado ambos
4. **Selector de duración de Deep Work:** se cerraba con click afuera pero no con `Escape` — agregado al manejador global, para que sea consistente con el resto de menús de la app

`npm run build` y `npm run lint` siguen en **0 errores, 0 warnings**.

---

## v0.57 — Paleta de comandos ampliada

Convierte el `⌘/Ctrl+K` (antes solo buscador de páginas) en una paleta de comandos real, al estilo Linear/Raycast — todos los atajos que se fueron acumulando (Zen, Deep Work, captura rápida, extraer a nota) ya no dependen de que alguien se acuerde de memorizarlos.

- **~13 comandos ejecutables** mezclados con los resultados de búsqueda de páginas en una sola lista: nueva página, nueva base de datos, ir a la Bandeja de entrada, Mis tareas, Notas huérfanas, activar/salir de Modo Zen, iniciar/terminar Deep Work, cambiar tema, Papelera, Ajustes, atajos de teclado, y (si hay una página abierta) compartir/historial
- **Navegación por flechas ↑↓ + Enter**, algo que el buscador original tampoco tenía — se corrige de paso
- Los comandos se filtran por lo que escribís, igual que las páginas — buscar "zen" encuentra el comando, buscar el título de una nota encuentra la página, mezclados según relevancia
- El texto de cada comando cambia según el estado actual (dice "Salir del Modo Zen" si ya está activo, no siempre "Activar")

`npm run build` y `npm run lint` siguen en **0 errores, 0 warnings**.

---

## v0.58 — Backup completo del workspace

De la lista de recomendaciones guardadas hace algunas tandas — con bases de datos y relaciones ya adentro, la confianza de que los datos no quedan atrapados pesa cada vez más.

- **Un botón en Ajustes** ("⬇ Exportar todo mi workspace") arma un `.zip` con todas las páginas como Markdown, en carpetas que respetan la misma jerarquía del sidebar
- **Las imágenes se bajan de verdad y se empaquetan adentro del zip** — no quedan como links a Supabase que podrían dejar de funcionar si el proyecto cambia o se borra algún día. Si una imagen puntual falla al bajarse (red, archivo borrado), esa página conserva el link original en vez de romper todo el export
- **Duplicados manejados:** dos páginas hermanas con el mismo título no se pisan entre sí al exportar — se desambiguan con "(2)", "(3)", etc.
- Barra de progreso simple mientras arma el backup, ya que bajar todas las imágenes puede tardar un poco en un workspace grande
- Se agregó `jszip` como dependencia nueva — `npm audit` sigue en 0 vulnerabilidades después de agregarla
- Probado con un caso simulado antes de entregar: jerarquía anidada, colisión de títulos, sanitización de caracteres inválidos para el sistema de archivos, y protección contra un ciclo corrupto de páginas — los 4 casos pasaron

`npm run build` y `npm run lint` siguen en **0 errores, 0 warnings**.

---

## v0.59 — Página de validación de precios (Paso 3 de monetización, hecho herramienta)

No construye Stripe ni cobra nada — es la herramienta para juntar señal real antes de decidir si la línea gratis/paga propuesta en `ESTRATEGIA_NEGOCIO.md` tiene sentido.

- **`/planes`:** página pública, sin login, muestra el plan Free y Plus lado a lado, con un formulario que junta el email y si la persona pagaría por Plus o le alcanza con Free
- **`009_waitlist.sql`:** tabla `waitlist_signups` con RLS que permite insertar a cualquiera (sin cuenta) pero **no permite leer a nadie desde el cliente, ni siquiera a quien se anotó** — la lista solo se ve desde el Table Editor de Supabase
- Implementada como ruta pública dentro de la misma app (`window.location.pathname.startsWith('/planes')`, mismo patrón que `/share/`) en vez de una página estática aparte — así reutiliza la configuración de Supabase que ya existe, sin duplicar ninguna credencial a mano
- `DISENO_MONETIZACION.md` actualizado con esto como "paso 0", antes de los 5 pasos de construir Stripe de verdad

`npm run build` y `npm run lint` siguen en **0 errores, 0 warnings**.

---

## v0.60 — Landing page pública + comparación de planes

- **`LandingPage.jsx`:** Header (wordmark + "Iniciar sesión"/"Crear cuenta" arriba a la derecha), Hero, 4 secciones de features (notas conectadas, bases de datos reales, foco real con Zen/Deep Work, herramientas de segundo cerebro), sección de precios, preguntas frecuentes, y footer con los links legales
- **Insertada como el estado inicial de `AuthGate`**, no como una ruta aparte — aprovecha que `AuthGate` ya distingue "cargando sesión" / "autenticado" / "formulario de login": la landing solo se muestra en el tercer caso, así que nunca aparece para alguien con sesión activa y no hay parpadeo mientras se confirma
- **`PlansComparison.jsx`:** la tabla Free/Plus como componente reutilizable — la misma vive en la landing pública y en el panel de Ajustes ("↓ Ver todos los planes", para quien ya tiene cuenta), una sola fuente de verdad
- El plan Plus se muestra como "Próximamente" con un botón "Avisame cuando esté" que lleva a `/planes` — a propósito no dice ningún precio final todavía, ya que el Paso 3 de validación sigue en curso
- El wordmark "Glenwyn" en el formulario de login ahora es clickeable y vuelve a la landing (excepto durante el flujo de restablecer contraseña, para no interrumpirlo por accidente)

`npm run build` y `npm run lint` siguen en **0 errores, 0 warnings**.

---

## v0.61 — Auditoría de promesas vs. realidad (primera vez que hacemos este tipo de revisión)

Distinta a todas las auditorías anteriores: en vez de revisar el código en sí, se comparó cada afirmación de `privacidad.html`/`terminos.html` contra lo que el código realmente hacía.

**El hallazgo principal:** la política de privacidad prometía "eliminar tu cuenta y todos tus datos" — pero no existía ningún botón ni función que lo hiciera de verdad en ningún lugar de la app.

- **`supabase/functions/delete-account/index.ts`:** Edge Function nueva — necesaria porque borrar un usuario requiere la Service Role Key, que nunca puede vivir en el navegador. Borra las imágenes subidas del usuario en Storage (lo único que no se limpia solo, ya que `storage.objects` no tiene relación de llave foránea con `on delete cascade` hacia `auth.users`) y después borra el usuario — lo que sí dispara cascada automática sobre `pages`, `page_versions`, `databases`, `database_views`, y `profiles`, porque esas tablas ya tenían `on delete cascade` desde que se crearon
- **"Zona de peligro" en Ajustes:** botón "Eliminar mi cuenta" con confirmación fuerte — hay que escribir "ELIMINAR" a mano antes de que el botón de borrado final se habilite. Se resetea solo si cerrás el panel sin confirmar
- **Segundo hallazgo, mismo tipo de gap:** los Términos de servicio decían "los pagos se procesan a través de Stripe" como si ya estuviera activo — pero hoy no hay ningún plan pago disponible para comprar (Stripe es el Paso 4 de monetización, todavía no arrancado). Corregido para reflejar el estado real: plan gratis disponible hoy, planes pagos en desarrollo
- README actualizado con el paso de deploy de la Edge Function (`supabase functions deploy delete-account`)

`npm run build` y `npm run lint` siguen en **0 errores, 0 warnings**.

---

## v0.62 — Reducción del bundle principal (665KB → 551KB)

Vite viene avisando "chunks larger than 500 kB" en cada build desde hace muchísimas tandas, y nunca lo habíamos atendido.

- **`jszip` con dynamic import:** solo se descarga cuando alguien realmente exporta el backup completo, en vez de venir empaquetado siempre — pasa de sumar al bundle principal a ser su propio archivo de 96KB, cargado bajo demanda
- **`LandingPage`, `WaitlistPage`, y `SharedPageView` con `React.lazy()` + `Suspense`:** cada una es una pantalla que la mayoría de las sesiones nunca visita (alguien que ya tiene sesión iniciada nunca ve la landing; `/planes` y `/share/...` son rutas puntuales) — ahora cada una es su propio archivo chico (4-7KB), no peso muerto en la carga principal
- **Resultado:** bundle principal de 665KB a 551KB — sigue arriba del umbral de 500KB de Vite, pero es una reducción real, sin haber tocado ninguna funcionalidad
- Se podría seguir bajando dividiendo `Block.jsx` o `DatabaseViews.jsx` de forma similar, si hace falta más adelante

`npm run build` y `npm run lint` siguen en **0 errores, 0 warnings**.

---

## v0.63 — Protección contra abuso en formularios públicos

Investigado antes de construir: Supabase Auth sí tiene rate limiting incorporado para signup/login (token bucket, capacidad de 30 requests), pero eso **no cubre `waitlist_signups`** — esa tabla se inserta directo vía PostgREST con la anon key, sin pasar nunca por el limitador de Auth. Cero protección hasta ahora.

- **`010_waitlist_hardening.sql`:** constraint de formato de email válido + índice único insensible a mayúsculas (mismo email no se puede anotar dos veces)
- **Campo señuelo (honeypot)** en el formulario de `/planes` — invisible para una persona real, pero un bot que llena todos los campos que encuentra también llena este. Si viene lleno, se simula éxito sin tocar la base de datos, para no darle ninguna pista al bot
- Mensaje amigable si alguien intenta anotarse dos veces con el mismo email, en vez de un error genérico

**Hallazgo importante, no arreglable en código:** el SMTP por defecto de Supabase solo manda 2 emails de auth por hora (confirmación de cuenta, restablecer contraseña). Con una ola de interés real, la mayoría ni llegaría a confirmar su cuenta. Anotado en `CHECKLIST.md` como paso obligatorio antes de cualquier lanzamiento — hace falta conectar un SMTP propio (Resend, SendGrid, AWS SES).

`npm run build` y `npm run lint` siguen en **0 errores, 0 warnings**.

---

## v0.64 — Foco automático en todos los modales (cierra el último hallazgo de la auditoría de accesibilidad)

Quedaba pendiente desde la última re-auditoría: ningún modal de la app movía el foco al abrirse — alguien con teclado o lector de pantalla abría "Compartir" o "Ajustes" y el foco se quedaba en donde estaba antes, atrás del modal.

- **`useAutoFocusOnOpen()`:** un hook chico y reutilizable, aplicado una sola vez en vez de parchear cada modal por separado — mueve el foco al contenedor del modal apenas se abre, suficiente para que un lector de pantalla anuncie el diálogo y su nombre, y para que `Tab` alcance el primer control real desde ahí
- Aplicado a los 5 modales que les faltaba: Papelera, Historial de versiones, Compartir página, Ajustes, y Atajos de teclado — el buscador/paleta de comandos ya enfocaba su input directo, un patrón mejor todavía, sin cambios ahí

`npm run build` y `npm run lint` siguen en **0 errores, 0 warnings**.

---

## v0.65 — Barra superior consolidada + primera auditoría de diseño visual

Primera vez que se audita específicamente el diseño visual (íconos y paleta), a pedido — distinto de las auditorías de UX/accesibilidad/datos anteriores.

- **Barra superior:** Compartir/Exportar/Historial ya no se muestran sueltos en pantallas anchas — ahora usan el mismo menú "⋯" que antes solo existía para pantallas angostas, sumando Ajustes y Atajos de teclado ahí también
- **Hallazgo de iconografía:** ~48 emoji distintos usados como íconos en toda la app, mezclando estilos. El problema real no es solo estético — los emoji se renderizan distinto según el sistema operativo (Windows usa "Segoe UI Emoji", notablemente distinto de Apple), así que el mismo ícono se ve distinto para cada persona. Pendiente de decidir: reemplazar por un set de íconos vectoriales consistente (ej. `lucide-react`)
- **Paleta de colores:** revisada, pendiente de dirección antes de tocarla — un rediseño de color a ciegas arriesgaría deshacer trabajo

`npm run build` y `npm run lint` siguen en **0 errores, 0 warnings**.

---

## v0.66 — Rediseño de íconos con lucide-react (en curso)

Instalado `lucide-react` (0 vulnerabilidades) para reemplazar los ~48 emoji usados como iconografía de la app — el problema real no era solo estético: los emoji se renderizan distinto según el sistema operativo (Windows usa un set notablemente distinto de Apple).

**Reemplazado hasta ahora:**
- Sidebar completo: Mis tareas, Bandeja de entrada, Notas huérfanas, modo claro/oscuro, Atajos de teclado, Guía de uso, Ajustes, Deep Work, Cerrar sesión
- Barra superior: todo el menú "⋯" (Compartir, Exportar, Historial, Ajustes, Atajos)
- Bases de datos: las 4 pestañas de vista (Tabla/Tablero/Calendario/Galería), ícono principal, quitar columna, abrir como página, eliminar fila, editar relaciones, badge de checkbox en galería
- Bloques especializados: los 5 botones de cerrar/eliminar, ícono de imagen vacía, "Abrir enlace", los 3 íconos de página vinculada

**Decisión de alcance, encontrada a mitad de camino:** los íconos de página (📄 por defecto, o el emoji que cada usuario elige desde la paleta de personalización) **quedan como emoji, a propósito** — son parte de una función de personalización de páginas, no iconografía de la app, y mezclar un ícono de línea con emoji elegidos por el usuario en la misma lista se vería inconsistente entre sí.

**Pendiente para una próxima tanda:** `Block.jsx` (prioridad de tarea, recurrencia), `SecondBrainViews.jsx`, `SharedPageView.jsx`, `LandingPage.jsx`, `AuthGate.jsx` (mostrar/ocultar contraseña).

`npm run build` y `npm run lint` siguen en **0 errores, 0 warnings**.

---

## v0.67 — Rediseño de íconos, tanda 3

- **`Block.jsx`:** prioridad de tarea (bandera rellena con el color de prioridad), fecha vacía, ícono de callout (fijo, no personalizable por instancia — a diferencia de los íconos de página, así que sí cuenta como iconografía de la app)
- **`SecondBrainViews.jsx`:** eliminar en notas huérfanas, prioridad y recurrencia en cada fila de tarea
- **`AuthGate.jsx`:** mostrar/ocultar contraseña, continuar con teléfono

`npm run build` y `npm run lint` siguen en **0 errores, 0 warnings**.

---

## v0.68 — Nueva paleta: "Miel dorada"

Reemplaza el verde/tierra original por dorado como acento principal — elegida específicamente para diferenciar a Glenwyn de la competencia: Notion (gris), Obsidian (violeta), Todoist (rojo), Bear (rojo), Craft (azul), Reflect (oscuro) — ninguno usa dorado/miel.

- **Verificación real de contraste antes de aplicar**, no a ojo: la primera versión de la propuesta fallaba WCAG AA en el texto secundario (`fern/canvas`, 2.87:1) y quedaba al límite en links/botones (`moss/canvas`, 3.16:1, solo válido para UI/texto grande, no para texto normal). Se oscurecieron esos dos tonos manteniendo el mismo matiz dorado — ambos ahora pasan 4.5:1 en modo claro y oscuro
- Aplicada en todos lados: `theme.js`, la paleta hardcodeada de `AuthGate.jsx` (que vive aparte porque se renderiza antes de que exista el contexto de tema autenticado), y las 4 páginas estáticas (`guia.html`, `privacidad.html`, `terminos.html`, `cookies.html`)
- Confirmado con una búsqueda final que no quedó ningún hex del paleta anterior en ningún archivo

`npm run build` y `npm run lint` siguen en **0 errores, 0 warnings**.

---

## v0.69 — Rediseño de íconos, tanda 4 (App.jsx casi completo)

- **Paleta de comandos (⌘K):** el campo `icon` pasó de texto suelto a componentes reales de `lucide-react` — mismo cambio de fondo que ya se había hecho para las pestañas de bases de datos
- Favorito, ordenar páginas, menú hamburguesa mobile, base de datos en el selector de plantillas, Papelera, toggle "Ver todos los planes", modo oscuro/claro del panel de Ajustes (uno distinto al del sidebar, se había pasado en la tanda anterior), botón flotante de Zen/Deep Work, y el título de la barra superior cuando "Mis tareas"/"Notas huérfanas" está abierto

`npm run build` y `npm run lint` siguen en **0 errores, 0 warnings**.

---

## v0.70 — Rediseño de íconos completo

Última tanda — `LandingPage.jsx` (las 4 tarjetas de features), `SharedPageView.jsx` (prioridad, callout, "ir a Glenwyn"), y dos que se habían pasado en `SidebarViews.jsx` (el pin de favorito ⭐/☆ y el botón de eliminar 🗑 de cada fila del árbol, distintos a los que ya se habían arreglado en la sección de Favoritos).

**Verificación final:** búsqueda de emoji en todo `src/`, confirmando que lo único que queda son los casos intencionales: la paleta de emoji para personalizar páginas (`EMOJI_PALETTE`), los íconos de página por defecto/elegidos por el usuario (mismo sistema), las opciones de recurrencia dentro de un `<select>` nativo (no pueden contener componentes React), y un par de menciones descriptivas en texto plano (atajos de teclado, una frase explicando qué es el ícono de calendario).

`npm run build` y `npm run lint` siguen en **0 errores, 0 warnings**.

---

## v0.71 — 🔒 Fix de seguridad: tokens de OAuth quedaban visibles en la URL

Encontrado en producción: después de iniciar sesión con Google, el `access_token`, `refresh_token`, y el token de Google quedaban pegados en la URL (`#access_token=...`) de forma persistente, en vez de limpiarse apenas se confirmaba la sesión.

- **Causa: un bug conocido y documentado de `supabase-js`/`auth-js`** (no algo específico de esta configuración) — una condición de carrera entre el momento en que se dispara el evento de login y el momento en que la librería intenta reescribir la URL para sacar el hash
- **Fix:** se fuerza la limpieza manualmente, apenas se confirma la sesión (tanto en la carga inicial como en cada evento de `onAuthStateChange`), sin depender de que la librería lo haga por su cuenta
- **Por qué importaba de verdad:** esos tokens quedaban en el historial del navegador, y alguien podría compartir el link por accidente (copiar la URL, mandarla por chat) exponiendo su propia sesión

`npm run build` y `npm run lint` siguen en **0 errores, 0 warnings**.

---

## v0.72 — Fix de seguimiento: quedaba un `#` vacío después de limpiar la URL

Confirmado en producción por el usuario: el fix anterior sacaba los tokens, pero dejaba un `#` solo en la URL. Causa: la condición original solo limpiaba si el hash todavía contenía `access_token` — pero `supabase-js` a veces alcanza a borrar el contenido del hash (dejando el símbolo `#` solo) antes de que el chequeo llegara a correr, así que nunca se activaba. Ampliado para limpiar cualquier resto de hash, sin importar el contenido.

`npm run build` y `npm run lint` siguen en **0 errores, 0 warnings**.

---

## v0.73 — Fix de seguimiento #2: el `#` seguía volviendo — era un problema de orden, no de condición

Confirmado por el usuario que el `#` seguía apareciendo después del fix anterior. Nueva hipótesis, más probable: `supabase-js` intenta su propia limpieza del hash *después* de que corre nuestro código, probablemente con algo como `location.hash = ''` — que en JavaScript dice "vacío" pero técnicamente deja el símbolo `#` colgando, no lo saca del todo. Si esa limpieza tardía de la librería corre después de la nuestra, pisa el resultado.

**Fix:** la limpieza ahora corre con un pequeño retraso (100ms) a propósito, para asegurarse de ser la última palabra sobre el estado de la URL, después de cualquier intento de la librería.

`npm run build` y `npm run lint` siguen en **0 errores, 0 warnings**.

---

## v0.74 — La causa real, confirmada con datos: `location.hash` miente sobre un `#` colgado

Los dos fixes anteriores (v0.72, v0.73) apuntaban a la causa equivocada. Confirmado con una prueba directa (`new URL('https://glenwyn.vercel.app/#').hash` devuelve `""`, string vacío) que `window.location.hash` **reporta vacío cuando la URL termina en un `#` solo**, sin nada después — aunque la barra de direcciones lo siga mostrando. El chequeo `if (window.location.hash)` de los fixes anteriores nunca se disparaba en este caso específico, porque estaba revisando la propiedad equivocada.

**Fix real:** ahora se revisa `window.location.href` completo (buscando el carácter `#` en cualquier parte de la URL), en vez de confiar en `.hash` — es la única forma confiable de detectar un `#` colgado sin contenido.

`npm run build` y `npm run lint` siguen en **0 errores, 0 warnings**.

---

## v0.75 — Fix: el triángulo sin contexto junto a "Nueva página"

Reportado como si no tuviera función — en realidad sí abre el menú de plantillas (incluida la opción de crear base de datos), pero un carácter suelto "▾" sin texto ni ícono reconocible es indistinguible de un adorno roto. Reemplazado por `ChevronDown` de `lucide-react`, con `aria-label` explícito.

También se guardaron en `BANCO_DE_IDEAS.md` (sección L) varias ideas y tareas nuevas surgidas de comparar capturas de Notion: personalización de bases de datos (nombre/ícono editable, soporte para insertarlas inline en vez de solo como página completa, selector de tipo al crear), una auditoría pendiente de la arquitectura de información del sidebar (reorganizar en menús, como hace Notion), y un catálogo de features de la Configuración de Notion para evaluar cuáles construir en Glenwyn (2FA, passkeys, gestión de dispositivos, preferencias de idioma/fecha/zona horaria, panel de cookies personalizable, etc.)

`npm run build` y `npm run lint` siguen en **0 errores, 0 warnings**.

---

## v0.76 — Bases de datos: nombre e ícono editables

Primer paso de la idea #55 del banco — inspirado en una revisión detallada de cómo Notion permite configurar una base de datos (capturas de julio 2026), guardada como referencia completa para las fases siguientes.

- **El título de la base de datos ahora es un input editable**, no texto fijo — mismo estilo que el título de cualquier página normal
- **El ícono es clickeable** y abre el mismo selector de emoji que ya existía para páginas — sin ícono elegido, muestra el ícono de base de datos por defecto (`Database` de lucide); con uno elegido, muestra el emoji
- Reutiliza `IconPicker` de `SidebarViews.jsx` en vez de duplicar el selector — una base de datos es, por dentro, la misma página normal de siempre, así que la función de personalización ya existía, solo faltaba conectarla en esta vista

`npm run build` y `npm run lint` siguen en **0 errores, 0 warnings**.

---

## v0.77 — Bases de datos: elegir la vista de entrada al crear

Segundo paso de la idea #55 — en vez de arrancar siempre en modo tabla, el selector de plantillas ahora ofrece las 4 vistas como puntos de partida directos: Tabla, Tablero, Calendario, Galería.

- El esquema de propiedades por defecto ya incluye "Estado" (selección) y "Fecha" — exactamente lo que necesitan Tablero (agrupa por selección) y Calendario (ubica por fecha) para funcionar de entrada, sin pedir ninguna configuración extra
- `createDatabasePage()` ahora acepta el modo de vista inicial, aplicado apenas se crea la base de datos
- El comando "Nueva base de datos" de la paleta (⌘K) sigue creando en modo tabla por defecto, para mantener esa acción como un atajo rápido de un solo paso

**Sigue pendiente de la idea #55:** soporte para insertar una base de datos inline (como bloque dentro de otra página, no solo como página completa) — el cambio más grande de los tres, para una tanda aparte.

`npm run build` y `npm run lint` siguen en **0 errores, 0 warnings**.

---

## v0.78 — Fix: el borde dorado al escribir en un bloque

El indicador que marca en qué bloque estás escribiendo (un borde fino a la izquierda) usaba `moss` — el acento principal de la paleta, que con "Miel dorada" es un tono dorado/miel bien visible. Cambiado a `fern`, el gris-marrón apagado que ya se usa para texto secundario en toda la app — sigue marcando dónde estás escribiendo, sin ser un dorado protagonista.

`npm run build` y `npm run lint` siguen en **0 errores, 0 warnings**.

---

## v0.79 — Idea #59 construida: acciones de página consolidadas en el árbol

Los 4 íconos sueltos que aparecían al pasar el mouse sobre una página (favorito, agregar subpágina, duplicar, eliminar) ahora viven en un solo menú "⋯" — mismo patrón que ya se aplicó a la barra superior (v0.65). Se sumaron 3 acciones más, ya que existían en otro lado de la app pero no acá: **Compartir**, **Exportar a Markdown**, **Historial de versiones**.

- **Bug real encontrado y arreglado al conectar "Historial" desde el árbol:** el botón "Restaurar" del modal de historial usaba `activePage.id` en vez de la página cuyo historial se estaba mirando — invisible mientras el historial solo se podía abrir para la página activa (topbar, paleta de comandos), pero real y peligroso apenas se agregó una forma de abrir el historial de OTRA página sin navegar primero. Se arregló haciendo que "Historial" (y "Compartir", que tenía el mismo riesgo) naveguen a esa página antes de abrir el modal correspondiente
- El menú se mantiene visible mientras está abierto, sin importar si el mouse se aleja de la fila — si no, moverse hacia una opción del menú podría hacerlo desaparecer antes de poder tocarla

`npm run build` y `npm run lint` siguen en **0 errores, 0 warnings**.

---

## v0.80 — Idea #56: primera pasada de la auditoría del sidebar

**El hallazgo real, no solo falta de organización — duplicación de verdad:** "Atajos de teclado" existía en 3 lugares (fila suelta del sidebar, menú "⋯" de la barra superior, y dentro de Ajustes → Ayuda); "Guía de uso" en 2 (fila suelta + Ajustes); "Modo oscuro/claro" en 2 (fila suelta + Ajustes → Apariencia). Eso era lo que inflaba el footer del sidebar a 7 filas.

- Sacadas las filas sueltas de **"Atajos de teclado"** y **"Guía de uso"** — siguen 100% disponibles desde Ajustes, el menú "⋯", el atajo `?`, y la paleta de comandos (`⌘K`). Cero pérdida de acceso, solo se sacó la fila duplicada
- **"Modo oscuro/claro" se mantiene como toggle rápido**, a propósito — es una preferencia que se cambia seguido (según la luz del día), a diferencia de las otras dos que son consultas ocasionales
- Footer del sidebar: de 7 filas a 5 (Modo oscuro/claro, Deep Work, Papelera, Ajustes, Cerrar sesión + el badge de plan, no interactivo)

Documentado en `BANCO_DE_IDEAS.md` (idea #56) qué quedó deliberadamente sin tocar en esta pasada (Deep Work y el badge de plan, ambos con uso genuinamente frecuente) para quien quiera profundizar más adelante.

`npm run build` y `npm run lint` siguen en **0 errores, 0 warnings**.

---

## v0.81 — Encontrado un cuarto duplicado + idea #60: Ancho completo y Bloquear página

**Un cuarto duplicado del sidebar, encontrado en una revisión posterior:** "Cerrar sesión" también existía suelto y dentro de Ajustes → Cuenta. Sacada la fila suelta — footer del sidebar de 5 filas a 4 (Modo oscuro/claro, Deep Work, Papelera, Ajustes).

**Idea #60 — dos opciones nuevas del menú "⋯" de la barra superior:**
- **Ancho completo:** el contenido ocupa todo el ancho disponible en vez de la columna angosta de siempre. Guardado por página (`full_width`, migración `011_page_display_options.sql`)
- **Bloquear página:** protección simple contra ediciones por accidente. Neutraliza todos los handlers que modifican contenido en un solo lugar dentro de `Block.jsx` (en vez de tocar cada tipo de bloque por separado), y agrega `readOnly` a los textareas como refuerzo visual. Un candado visible junto al título en la barra superior cuando está activo

`npm run build` y `npm run lint` siguen en **0 errores, 0 warnings**.

---

## v0.82 — Fix: el menú "⋯" de cada página se cortaba cerca del final del árbol

Reportado directamente, con una causa técnica confirmada antes de arreglar: el árbol de páginas vive dentro de un contenedor con `overflowY: 'auto'` — cualquier contenido que se extendiera más allá de ese borde se recortaba, y el menú (antes `position: absolute` respecto a la fila) caía justo ahí cuando la fila estaba cerca del final visible. No era el footer tapándolo por z-index, era el `overflow` del contenedor padre cortándolo antes.

- **Solución: portal.** El menú ahora se renderiza vía `createPortal` directo en `document.body`, con posición calculada a partir de `getBoundingClientRect()` del botón — nunca más se corta, sin importar cuántas páginas haya en el árbol
- **Apertura inteligente hacia arriba** si no hay espacio suficiente debajo en la ventana completa (no solo dentro del sidebar)
- El menú se cierra solo si el árbol scrollea mientras está abierto, para no quedar desalineado del botón que ya se movió

`npm run build` y `npm run lint` siguen en **0 errores, 0 warnings**.

---

## v0.83 — Fix: faltaba el ícono de Bandeja de entrada en la barra superior

Señalado directamente: "Mis tareas" y "Notas huérfanas" ya mostraban su ícono junto al título en la barra superior, pero "Bandeja de entrada" no. Causa: esas dos son vistas especiales con su propio caso en el código; Bandeja de entrada en cambio es una página común (con un ícono especial en el sidebar) — el título de la barra superior nunca tuvo un caso para reconocerla como tal. Agregado: cuando la página activa es la Bandeja de entrada, se muestra el mismo ícono `Inbox` que ya usa en el sidebar.

`npm run build` y `npm run lint` siguen en **0 errores, 0 warnings**.

---

## v0.84 — Atajos de teclado en la paleta de comandos

Solo se muestran junto a los comandos que **de verdad** tienen un atajo global asignado — nada inventado. De toda la lista, son 3: "Ir a la Bandeja de entrada" (`⌘⇧I`), "Activar/Salir del Modo Zen" (`⌘.`), y "Ver atajos de teclado" (`?`). El resto (incluida "Nueva página" y "Nueva base de datos") no tienen ningún atajo asignado hoy — quedan sin la etiqueta, en vez de mostrar algo falso.

`npm run build` y `npm run lint` siguen en **0 errores, 0 warnings**.

---

## v0.85 — 9 atajos de teclado nuevos, para todos los comandos que no tenían

- **Nueva página** `⌘⇧N` · **Nueva base de datos** `⌘⇧B` · **Ver Mis tareas** `⌘⇧T` · **Ver Notas huérfanas** `⌘⇧H` · **Deep Work** `⌘⇧D` · **Modo claro/oscuro** `⌘⇧L` · **Papelera** `⌘⇧P` · **Ajustes** `⌘,` (la convención estándar de macOS para preferencias) · **Compartir** `⌘⇧S` · **Historial** `⌘⇧V`

**Dos problemas reales, encontrados y arreglados antes de terminar:**
- **Riesgo de datos desactualizados:** el manejador de atajos se crea una sola vez al montar la app — llamar directo a funciones como `createDatabasePage` desde ahí las hubiera dejado pegadas a `pages` como estaba en ese primer instante (casi vacío). Se resolvió con una `ref` que siempre apunta a la versión más nueva del mismo despachador que ya usa la paleta de comandos, sin tener que auditar la seguridad de cada función una por una
- **Choque real de atajos:** `⌘D` (sin Shift) ya duplicaba el bloque actual estando adentro de un texto — no revisaba si Shift también estaba apretado, así que `⌘⇧D` (el atajo nuevo de Deep Work) hubiera disparado las dos acciones a la vez mientras se escribe. Arreglado agregando esa condición

Documentados todos en el modal de "Atajos de teclado" y como etiqueta junto a cada comando en la paleta (`⌘K`).

`npm run build` y `npm run lint` siguen en **0 errores, 0 warnings**.

---

## v0.86 — Fix: la barra superior variaba de alto según la página

Señalado directamente con las herramientas de desarrollador: `div.glenwyn-topbar` medía 44.8px de alto con "Mis tareas" activo, pero 60px con "Bandeja de entrada" — mismo padding declarado (`14px 28px`) en los dos casos, así que algo en el contenido estaba empujando la altura.

**Fix aplicado:** altura fija de 45px en la barra superior (`box-sizing: border-box` para que el padding no la exceda), más `whiteSpace: nowrap` y `flexWrap: nowrap` explícitos en los dos contenedores internos (migas de pan a la izquierda, botones a la derecha) — así, sin importar qué tan largo sea el título o cuántas migas de pan haya, la barra nunca puede crecer en alto, solo recortar contenido horizontalmente si hace falta (ya tenía `overflow: hidden` para eso). Confirmado que el área de contenido debajo ya tenía margen de sobra (64px fijos) para no superponerse en ningún caso, incluso con la altura vieja más alta.

`npm run build` y `npm run lint` siguen en **0 errores, 0 warnings**.

---

## v0.87 — Auditoría de interacciones: 4 huecos reales entre Bloquear página / Ancho completo y el resto de la app

Auditoría enfocada, a pedido, en cómo las funciones más nuevas (Bloquear página, Ancho completo, los 9 atajos, el selector de vista al crear, la consolidación de menús) interactúan con el resto de la app — no una revisión general, sino específicamente los cruces entre lo nuevo y lo viejo.

1. **"Bloquear página" no bloqueaba nada en una base de datos** — `DatabaseView` nunca revisaba `page.locked`. Arreglado con el mismo patrón ya usado en `Block.jsx`: todos los handlers que mutan contenido (renombrar propiedades, cambiar tipos, agregar/quitar propiedades, relaciones, rollups, valores por defecto, editar celdas, alternar relaciones, renombrar registros, agregar/eliminar registros) neutralizados en un solo lugar. `onOpenRecord` queda activo — abrir un registro es navegación, no una edición
2. **"Ancho completo" no tenía efecto en una base de datos** — el ancho estaba fijo en 920px sin importar la preferencia. El toggle marcaba como activo, pero visualmente no pasaba nada. Arreglado: `fullWidth` ahora tiene prioridad
3. **"Restaurar" en el historial de versiones ignoraba el bloqueo** — reemplazaba todo el contenido igual, aunque la página estuviera bloqueada. Justo el tipo de edición que "Bloquear página" debería evitar. Arreglado con una alerta clara y el botón visualmente deshabilitado
4. **Duplicar una página bloqueada bloqueaba la copia también** — arreglado con el mismo razonamiento que ya se aplicaba a `pinned`/`shareToken` al duplicar

Documentado en `BANCO_DE_IDEAS.md` (idea #60) un quinto hueco, cosmético y no bloqueante: los inputs de celda y el botón de agregar propiedad no muestran un estado visualmente deshabilitado cuando la página está bloqueada (la protección funciona igual, solo se ve raro).

`npm run build` y `npm run lint` siguen en **0 errores, 0 warnings**.

---

## v0.88 — Idea #60: Copiar enlace y Copiar contenido

Dos más de la lista de acciones estilo Notion, en la barra superior y en el menú de cada fila del árbol.

- **Copiar enlace:** genera un link con `#page=<id>` — Glenwyn no tiene routing por URL para navegación interna (todo vive en `activeId`), así que en vez de construir un sistema de rutas completo solo para esto, se usa un hash liviano que la app ya sabe leer al cargar, navegando directo a esa página y limpiando la URL después
- **Copiar contenido:** copia la página al portapapeles como Markdown, reutilizando la misma conversión que ya usa "Exportar"
- Aviso visual chico ("Enlace copiado" / "Contenido copiado" / "No se pudo copiar") que se desvanece solo a los 2 segundos

`npm run build` y `npm run lint` siguen en **0 errores, 0 warnings**.

---

## v0.89 — Idea #60: Mover a — y un bug crítico encontrado antes de llegar a producción

**⚠️ Bug crítico, evitado a tiempo:** la función nueva se llamó `movePage` al principio — mismo nombre que una función ya existente e importada de `pageUtils.js` (la que reordena páginas al arrastrar y soltar). Como mi definición vivía dentro del mismo componente, tapaba silenciosamente a la importada — el arrastrar-y-soltar en el árbol hubiera quedado roto (llamando a la función equivocada, con los argumentos en el orden equivocado) sin ningún error de compilación. El lint avisó que la importación había quedado "sin usar" — esa fue la pista de que algo la estaba tapando. Renombrada a `moveToNewParent` antes de que llegara a producción.

**La feature en sí:**
- Modal con buscador para elegir un nuevo padre para una página (o "Sin página superior" para el nivel principal), reutilizando el mismo patrón de búsqueda que ya existía para vincular páginas
- Filtra la propia página y todos sus descendientes de los destinos posibles — moverla dentro de sí misma crearía un ciclo imposible de recorrer
- Disponible en los dos menús "⋯" (barra superior y cada fila del árbol)

`npm run build` y `npm run lint` siguen en **0 errores, 0 warnings**.

---

## v0.90 — Idea #60: Personalizar página (estilo de fuente + texto pequeño)

Última de las candidatas razonables de la lista original de acciones estilo Notion, cerrando esta ronda de la idea #60.

- **Estilo de fuente** (Por defecto/Serif/Mono) y **Texto pequeño**, guardados por página (migración `012_page_personalization.sql`)
- En vez de auditar y tocar cada `fontFamily` puesta a mano en `Block.jsx`/`SpecializedBlocks.jsx` (son muchas, repartidas entre distintos tipos de bloque), se sobreescribe con `!important` desde una clase en el contenedor — mucho menos riesgoso
- Son preferencias de lectura, no ediciones — no las bloquea "Bloquear página", igual que el modo claro/oscuro

**Pendiente, anotado en el banco de ideas:** la vista pública compartida no respeta todavía estas dos preferencias — queda con su propio estilo fijo, sin urgencia.

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
