# Glenwyn

Un espacio de trabajo inmersivo y distraction-free, inspirado en Notion. Cozy, minimalista, canvas/verde inspirado en naturaleza.

## Stack
- React 19 + Vite
- Supabase (Auth con Google OAuth + Postgres con Row Level Security) para el contenido (páginas y bloques)
- `src/lib/storage.js` (shim sobre `localStorage`) solo para preferencias de UI locales (modo oscuro, sidebar, expandidos) — no se sincronizan entre dispositivos a propósito

## Setup

### 1. Base de datos
Andá al **SQL Editor** de tu proyecto en supabase.com y corré, en orden, `001_init.sql`, `002_pinned.sql`, `003_page_versions.sql`, `004_storage.sql`, `005_sharing.sql`, `006_databases.sql`, `007_profiles.sql`, `008_admin.sql`, `009_waitlist.sql` y `010_waitlist_hardening.sql`. El primero crea la tabla `pages` con Row Level Security habilitado (cada usuario solo ve sus propias páginas); el segundo agrega la columna `pinned` para favoritos; el tercero crea la tabla de historial de versiones; el cuarto crea el bucket de Storage para subir imágenes de verdad; el quinto habilita compartir páginas por link de solo lectura; el sexto agrega las bases de datos estilo Notion; el séptimo agrega el plan de usuario (Free/Plus/Business) para el modelo freemium; el octavo agrega el flag de administrador y se lo otorga a `dseiler.dev@gmail.com`; el noveno agrega la tabla de interesados para la página de validación de precios; el décimo agrega protección básica contra spam a esa tabla.

El proyecto ya incluye `vercel.json` con un rewrite necesario para que los links de `/share/...` funcionen en producción (sin esto, abrir un link compartido directamente daría 404). Ese mismo rewrite excluye explícitamente `/guia.html`, para que la guía de uso se sirva como archivo estático real en vez de redirigir a la app.

### 2. Variables de entorno
```bash
cp .env.example .env.local
```
Completá `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` con los valores de **Project Settings → API** en Supabase.

En Vercel: **Project Settings → Environment Variables**, agregá las mismas dos claves, y hacé un redeploy.

### 3. Auth — Google OAuth
Esto sí necesita un par de pasos, en dos consolas distintas:

**En Google Cloud Console** (console.cloud.google.com → APIs & Services → Credentials):
1. Creá un **OAuth client ID** de tipo "Web application"
2. En **Authorized redirect URIs** agregá: `https://TU_PROYECTO.supabase.co/auth/v1/callback`
   (reemplazá `TU_PROYECTO` por la referencia real de tu proyecto — la encontrás en Project Settings → API)
3. Copiá el **Client ID** y el **Client Secret**

**En Supabase** (Authentication → Providers → Google):
1. Activá el proveedor Google
2. Pegá el Client ID y Client Secret del paso anterior
3. En **Authentication → URL Configuration**, agregá tu dominio de Vercel y `http://localhost:5173` a **Redirect URLs**

### 4. Edge Function — eliminar cuenta
El botón "Eliminar mi cuenta" (Ajustes → Zona de peligro) necesita una Edge Function desplegada, porque borrar un usuario requiere la Service Role Key, que nunca puede vivir en el navegador. Con el [Supabase CLI](https://supabase.com/docs/guides/cli) instalado y logueado:
```bash
supabase functions deploy delete-account
```
No hace falta configurar ninguna variable de entorno a mano — `SUPABASE_URL`, `SUPABASE_ANON_KEY`, y `SUPABASE_SERVICE_ROLE_KEY` ya están disponibles automáticamente dentro de cualquier Edge Function del proyecto.

### 5. Correr en local
```bash
npm install
npm run dev
```

## Estructura
```
src/
  App.jsx                  — componentes de React (sidebar, canvas, bloques, papelera)
  lib/pageUtils.js         — lógica pura de páginas/bloques (sin React, fácil de leer y testear sola)
  components/AuthGate.jsx  — pantalla de login (Google OAuth) que envuelve la app
  lib/supabaseClient.js    — cliente de Supabase
  lib/pagesRepo.js         — load/save de páginas contra Postgres
  lib/storage.js           — preferencias de UI locales (no contenido)
public/
  guia.html                — guía de uso, servida estática en /guia.html (link "📖 Guía de uso" en el sidebar)
supabase/migrations/
  001_init.sql             — esquema + políticas de RLS
  002_pinned.sql           — agrega columna "pinned" para favoritos
  003_page_versions.sql    — tabla de historial de versiones (guarda las últimas 20 por página)
  004_storage.sql          — bucket de Storage + políticas para upload real de imágenes
  005_sharing.sql          — columna share_token + función RPC segura para links de solo lectura
  006_databases.sql        — tablas databases/database_views + columnas database_id/properties en pages
  007_profiles.sql         — tabla profiles (plan de usuario) + trigger de auto-creación + backfill
  008_admin.sql            — flag is_admin en profiles + se lo otorga a dseiler.dev@gmail.com
  009_waitlist.sql         — tabla waitlist_signups para la página de validación de precios (/planes)
  010_waitlist_hardening.sql — email único + formato válido en waitlist_signups (protección básica contra spam)
```

## Features actuales
- Auth con Google OAuth, contenido persistido en Supabase (Postgres + RLS)
- Sidebar colapsable (⌘\\), búsqueda rápida (⌘K) que busca en títulos **y en el contenido** de los bloques, breadcrumbs clickeables de la jerarquía en la barra superior, y orden de páginas configurable (manual por drag / alfabético / recientes primero)
- Backlinks: al final de cada página, un panel "N páginas te mencionan" (solo visible en la app, nunca en el link público compartido, para no filtrar títulos de tus otras páginas)
- Menciones inline: escribí `[[` en un bloque de texto para buscar y enlazar otra página en medio de la oración — se muestra como link clickeable al perder el foco, y cuenta como backlink
- Páginas "hub": un punto dorado sutil junto al título, en el sidebar, para las páginas referenciadas por 3 o más — tus notas más centrales, sin necesitar IA
- Mini-mapa de vecinos: al final de cada página, un diagrama chico mostrando quién te menciona y a quién mencionás vos — la versión liviana de una vista de grafo, sin necesitar el workspace completo
- Notas huérfanas: vista en el sidebar que junta las páginas que nadie enlaza ni menciona todavía — no es una obligación de conectarlas todas, es solo visibilidad
- Extraer a nota atómica: seleccioná texto dentro de un párrafo y `⌘/Ctrl+Shift+E` lo convierte en su propia página, dejando una mención `[[así]]` enlazada donde estaba
- Bandeja de entrada: una página siempre disponible para notas fugaces — `⌘/Ctrl+Shift+I` desde cualquier lugar te lleva ahí y te deja escribiendo, sin tener que pensar dónde va a vivir la idea todavía
- Indicador de madurez: un punto de color chico junto al ícono de cada página en el sidebar — verde si está conectada y tiene contenido sustancial, ámbar si ya está conectada pero todavía es corta, sin marca si todavía no tiene ninguna conexión
- Recorrido reciente: las últimas páginas que visitaste esta sesión, en el sidebar — tu camino real saltando de mención en mención, no el árbol fijo
- Pátina del tiempo: las páginas que no tocás hace más de 30/90 días se ven un poco más apagadas en el sidebar — un timestamp convertido en algo cálido en vez de clínico, nunca para la página que tenés abierta en ese momento
- **Modo Zen** (`⌘/Ctrl+.`): oculta el sidebar y la barra superior por completo mientras escribís — ataca el fracaso más común de un second brain, terminar organizando en vez de creando. Un botón discreto abajo a la derecha (o `Esc`) para salir
- **Modo Deep Work**: la misma idea que el Modo Zen, pero con temporizador (25/50/90 min) desde el botón "⏱ Deep Work" en el sidebar — se ve la cuenta regresiva en el mismo botón flotante, y termina sola cuando se acaba el tiempo, sin tener que acordarte de salir vos
- **Plan de usuario** (Free / Plus / Business): infraestructura para el modelo freemium — todavía sin Stripe ni límites activos (ver `DISENO_MONETIZACION.md`), solo un indicador discreto del plan actual en el sidebar
- **Panel de Ajustes** (⚙ en el sidebar): cuenta, plan actual, modo claro/oscuro, links a privacidad/términos/cookies, y accesos a la guía de uso y los atajos de teclado — todo en un solo lugar
- **Barra superior consolidada**: Compartir/Exportar/Historial/Ajustes/Atajos ahora viven en un solo menú "⋯", en cualquier tamaño de pantalla — antes se mostraban todos sueltos en desktop, y solo se agrupaban en pantallas angostas
- **Acciones de cada página en el árbol, consolidadas**: favorito/agregar subpágina/duplicar/eliminar (antes 4 íconos sueltos al pasar el mouse) más 3 nuevas — compartir, exportar, historial — todo en un solo menú "⋯" por fila, sin tener que abrir la página primero
- **Rediseño de íconos con `lucide-react`** (completo): toda la app usa íconos de línea vectoriales en vez de emoji — sidebar, barra superior, paleta de comandos, bases de datos, bloques, tareas, callout, contraseña, favoritos, papelera, ordenar, landing page, vista pública compartida. Se ven igual en cualquier sistema operativo, a diferencia de los emoji (que Windows renderiza distinto que Mac). Los íconos de página elegidos por el usuario (la paleta de emoji para personalizar páginas) quedan como emoji a propósito — es una función de personalización, no iconografía de la app
- **Nueva paleta "Miel dorada"**: dorado como acento principal en vez de verde — elegida para diferenciarse de la competencia (ninguno de los competidores directos usa dorado/miel como color de marca). Verificada con contraste real WCAG AA en ambos modos (claro/oscuro) antes de aplicarla — la primera versión de la propuesta fallaba en el texto secundario (2.87:1) y quedaba al límite en los links/botones (3.16:1), corregido oscureciendo esos dos tonos sin perder el matiz dorado
- **Paleta de comandos** (`⌘/Ctrl+K`): ya no es solo buscador de páginas — ahora también ejecuta acciones (nueva página, nueva base de datos, Bandeja de entrada, Mis tareas, Notas huérfanas, Modo Zen, Deep Work, modo oscuro/claro, Papelera, Ajustes, atajos, y compartir/historial de la página activa), todo mezclado en una sola lista con navegación por flechas ↑↓
- **Backup completo del workspace** (Ajustes → Datos y privacidad): exporta todas tus páginas a un `.zip` de una sola vez, respetando la jerarquía de carpetas del sidebar, con las imágenes incluidas de verdad (no como links a Supabase que podrían dejar de funcionar algún día)
- **Página de validación de precios** (`/planes`): pública, sin login, muestra la línea gratis/Plus propuesta y junta emails de interés en `waitlist_signups` — el Paso 3 del plan de monetización, hecho herramienta. Nadie puede leer la lista desde el cliente, ni siquiera quien se anotó — solo vos, desde el Table Editor de Supabase
- **Landing page pública** antes del login: Hero, 4 secciones de features (notas conectadas, bases de datos, foco real, herramientas de segundo cerebro), comparación de planes, preguntas frecuentes, y footer con los links legales. Aparece como el estado inicial de `AuthGate` — nunca se le muestra a alguien que ya tiene sesión iniciada, y no hay parpadeo mientras se confirma la sesión
- **Comparación de planes reutilizable** (`PlansComparison.jsx`): la misma tabla Free/Plus vive en la landing y en el panel de Ajustes ("Ver todos los planes") — una sola fuente de verdad para que nunca queden desincronizadas
- **Eliminar cuenta, de verdad** (Ajustes → Zona de peligro): cierra una brecha real entre lo que prometía `privacidad.html` ("podés eliminar tu cuenta") y lo que el código hacía (nada) — ahora es autoservicio, con confirmación escribiendo "ELIMINAR". Corre en una Edge Function de Supabase (necesita la Service Role Key, que nunca puede vivir en el navegador) que borra las imágenes subidas (lo único que no se limpia solo) y el usuario de `auth.users` (que sí cascada automáticamente sobre páginas, bases de datos, y el perfil)
- **Bundle principal reducido de 665KB a 551KB**: `jszip`, `LandingPage`, `WaitlistPage`, y `SharedPageView` ahora se cargan de forma diferida (dynamic import) — nadie descarga ese código a menos que realmente exporte un backup, visite `/planes`, `/share/...`, o vea la landing sin sesión iniciada
- **Protección básica contra abuso en `/planes`**: campo señuelo (honeypot, invisible para personas pero que un bot llena igual), email único (no se puede anotar el mismo dos veces), y validación de formato a nivel de base de datos — la tabla `waitlist_signups` se inserta directo por PostgREST, sin pasar por el rate limiting de Supabase Auth, así que no tenía ninguna defensa hasta ahora
- **Flag de administrador** (`profiles.is_admin`, separado del plan): tu cuenta (`dseiler.dev@gmail.com`) queda marcada como admin desde `008_admin.sql` — cuando se activen límites reales de plan, un admin siempre los salta, sin importar qué plan tenga asignado
- **Páginas legales** (`/privacidad.html`, `/terminos.html`, `/cookies.html`): política de privacidad, términos de servicio, y política de cookies, enlazadas desde el panel de Ajustes y desde la pantalla de login. Son un punto de partida razonable, no una revisión legal profesional — conviene una revisión real antes de cobrar dinero de verdad o tener usuarios en la Unión Europea
- **Bases de datos** (Fase A + B + C + D): un tipo de página nueva con propiedades (texto/número/select/fecha/casilla/**relación**/**rollup**) como columnas — cada fila sigue siendo una página normal por dentro (hereda papelera, historial de versiones e íconos gratis). Cuatro formas de ver los mismos registros: **tabla**, **tablero** (por selección), **calendario** (por fecha), y **galería** (tarjetas con las propiedades como badges). Las **relaciones** conectan registros entre dos bases de datos, los **rollups** agregan (contar/sumar/promediar) una propiedad de los relacionados — con protección contra ciclos si dos rollups dependen uno del otro. Cada propiedad puede tener un **valor por defecto** que se aplica solo a cada registro nuevo. **Nombre e ícono editables** después de creada, con la misma paleta de emoji que cualquier página. **Elegís la vista de entrada al crear** (Tabla/Tablero/Calendario/Galería) desde el selector de plantillas, en vez de arrancar siempre en modo tabla. Las fórmulas quedaron deliberadamente afuera — el motor de expresiones propio que necesitarían es un proyecto en sí mismo
- Tareas con fecha de vencimiento (chip visual, rojo si está vencida), prioridad (⚑ 3 niveles) y recurrencia (diaria/semanal/mensual, se corre sola al vencimiento al completarla), más la vista global **"Mis tareas"** en el sidebar, agrupada en Vencidas / Hoy / Próximas / Completadas
- Lenguaje natural en español para fechas de tareas: escribí "mañana", "todos los lunes", "en 3 días", etc. y se convierte solo en fecha (y recurrencia si corresponde) al presionar Enter o salir del bloque
- Páginas anidadas con drag-to-reorder (antes / después / dentro de otra página)
- Papelera: archivar en cascada, restaurar, eliminar para siempre (una por una o toda de una vez), auto-purga a 30 días
- Bloques: texto, encabezado, tarea, lista con viñetas, lista numerada, cita, callout, desplegable (toggle), imagen (URL o **upload real** a Supabase Storage), tabla simple, embed (YouTube/Vimeo/Loom/Spotify + link genérico), **link a otra página** del workspace, divisor — Ctrl/Cmd+D duplica, Backspace en línea vacía elimina el bloque
- Favoritos: pin/unpin de páginas desde el sidebar (⭐ en el hover de cada página), sección propia arriba del árbol
- Plantillas al crear página: Diario, Notas de reunión, Brainstorm (▾ junto a "Nueva página")
- Historial de versiones: snapshot automático cada 10 min mientras editás (o manual con "Guardar versión ahora"), botón ⟲ historial en la barra superior de cada página
- Exportar página a Markdown (⬇ exportar en la barra superior) — descarga un .md con toda la estructura de bloques traducida
- Compartir página por link de solo lectura (🔗 en la barra superior) — genera una URL pública que no requiere login; activar/rotar/desactivar en cualquier momento
- Íconos de página (emoji, con paleta rápida o pegar cualquiera) — clickeable desde el sidebar o desde el título de la página
- Duplicar página (⎘ en el hover del sidebar) — clona título y bloques, la deja como copia justo al lado de la original
- Contador de palabras discreto en la barra superior de cada página
- Soporte para mobile/touch: sidebar como drawer superpuesto en pantallas angostas (≤640px), con botón ☰ para abrirlo y se cierra solo al elegir una página; todas las acciones que antes dependían de hover (pin, duplicar, eliminar, etc.) ahora también son visibles y usables en dispositivos táctiles
- Modal de atajos de teclado (tecla `?`, o desde el sidebar) con todos los atajos documentados
- Título de la pestaña dinámico — muestra el nombre de la página abierta, también en la vista compartida
- Comandos `/` y atajos de markdown (`# `, `- [ ] `, `---`)
- Modo claro/oscuro

## Auditoría (22 jul 2026)
Revisión completa del código con estos hallazgos y arreglos:
- **Eliminar bloques:** no existía forma de borrar un bloque, solo convertirlo. Ahora: Backspace en línea vacía borra y mueve el foco arriba; imagen y tabla tienen botón de borrar explícito; el "quitar" del divisor ahora elimina de verdad (antes solo lo vaciaba).
- **Datos fantasma al convertir tipo:** convertir un bloque (imagen→texto→imagen) dejaba campos viejos (`url`, `rows`, `body`, `open`) pegados, que podían reaparecer. Ahora se limpian en cada conversión.
- **Papelera no purgaba en Supabase:** el borrado automático a los 30 días solo ocultaba páginas viejas del estado local — seguían acumulándose en la base para siempre. Ahora el próximo autoguardado tras cargar la app también las borra en Supabase.
- **Condición de carrera en autoguardado:** ediciones muy rápidas con conexión lenta podían disparar dos guardados superpuestos compitiendo por el mismo diff de IDs. Ahora hay un guard con reintento en cola que siempre guarda el estado más reciente.
- Errores de carga/guardado ahora se loguean en consola en vez de tragarse en silencio.
- `npm run lint` (oxlint) queda en 0 warnings, 0 errores.

## Roadmap
- Bloques de Notion que faltan: lista con viñetas/numerada, cita, callout, código, toggle, imagen, tabla simple, embed
- Supabase Storage para el bloque de imagen con upload real
- Supabase Realtime para colaboración entre varios usuarios
- Comentarios (tabla `comments` vinculada a un bloque)
