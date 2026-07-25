# Glenwyn — Banco de ideas: ambiciosas, innovadoras, y de second brain

Documento único que reemplaza a `IDEAS_AMBICIOSAS.md` y `IDEAS_SECOND_BRAIN.md` (unificados acá). Reúne **49 ideas** que van más allá de igualar features de Notion/Obsidian/Todoist/Evernote — las que podrían hacer que Glenwyn tenga algo que ningún competidor tiene, y las que están ancladas específicamente en la metodología real de "second brain" (no en qué botón tiene cada app). Organizado por tema, no por el orden en que se pensaron.

**Convención:** 🟢 esfuerzo chico · 🟡 medio · 🟠 grande · 🔴 proyecto en sí mismo

---

## El marco de referencia

Para que las ideas de las secciones B y C tengan sentido sin tener que explicarlo cada vez:

**CODE — Capturar, Organizar, Destilar, Expresar.** El marco de Tiago Forte para todo el ciclo de vida de una nota. Casi todas las apps de notas (Glenwyn incluida, hoy) resuelven bien **Capturar** y **Organizar** — escribís, guardás, jerarquizás. Muy pocas dan herramientas reales para **Destilar** (comprimir una nota vieja a su esencia) o **Expresar** (usar lo acumulado para producir algo nuevo). Ahí está el espacio en blanco.

**PARA — Proyectos, Áreas, Recursos, Archivo.** Organiza por qué tan accionable es algo *ahora*, no por tema. Un proyecto tiene fecha de fin; un área es responsabilidad continua (salud, finanzas); un recurso es referencia futura; el archivo es todo lo que ya no es accionable pero no querés borrar.

**Zettelkasten — notas atómicas y conectadas.** Cada nota contiene una sola idea, escrita con tus propias palabras, y el valor está en la red de conexiones que se arma entre ellas — no en la carpeta donde vive cada una.

**Resaltado progresivo.** La técnica de Forte para comprimir una nota larga en capas: texto completo → lo importante en negrita → lo más importante resaltado → un resumen ejecutivo de una línea. La idea es que, meses después, volvés a la nota y la entendés en 10 segundos, no la releés entera.

**Lo que ya tiene Glenwyn que encaja acá:** los backlinks y las menciones inline (`[[así]]`) ya son, sin haberlo llamado así, una implementación real de Zettelkasten — notas atómicas conectadas por significado, no por carpeta. Es una base más sólida de lo que parece.

---

## A. Infraestructura común a casi todo lo demás

La mayoría de las ideas de la sección B comparten la misma pieza técnica de fondo: un *embedding* (un vector numérico que representa el significado de un texto) por página, guardado en Postgres con la extensión **pgvector** (Supabase la soporta nativamente) en una tabla `page_embeddings (page_id, embedding vector(1536), content_hash, updated_at)`, recalculado solo cuando el contenido cambió de verdad. Conviene pensarlas como una sola apuesta de infraestructura, no features sueltas — el día que se decida construir embeddings para una, el resto quedan mucho más cerca.

**Lo que hay que decidir antes de construir cualquiera de estas:** el contenido de las notas viajaría a una API externa para generar los embeddings — es una decisión de privacidad que hay que comunicar claramente (opt-in, no automático desde el día uno), y necesita una función serverless para no exponer ninguna API key en el cliente.

---

## B. Inteligencia nativa (con embeddings o IA)

### 1. Sugerencias de vínculo automáticas 🟠
*La idea que más se siente "second brain de verdad" en vez de "otra app de notas".* Mientras escribís, Glenwyn detecta "este párrafo se parece a tu página X" sin que tengas que escribir `[[manualmente]]`. Al abrir una página, busca las N más parecidas por similitud de coseno (excluyendo las ya enlazadas) y las muestra en un panel separado de "Referenciado por": *"Quizás quieras enlazar..."*

### 2. Búsqueda semántica 🟡
Encontrar "esa nota sobre sentirme ansioso antes de una presentación" aunque nunca hayas escrito la palabra "ansioso". Reutiliza exactamente la misma infraestructura de la idea #1 — si ya se construyó una, esta es casi gratis.

### 3. Preguntarle a tus notas, con citas 🟠
El paso "Expresar" del método CODE, hecho literal: Glenwyn contesta una pregunta en lenguaje natural citando de qué página específica sacó cada parte de la respuesta — igual que Recall o NotebookLM, pero solo sobre tu propio contenido. Sin citas verificables, esta feature no vale nada (y genera desconfianza si "alucina" algo que no dijiste).

### 4. Remixar — un borrador a partir de tus propias notas 🟠
Un paso más allá de responder preguntas: pedirle a Glenwyn que arme un primer borrador de algo (un posteo, un resumen, una decisión documentada) usando exclusivamente tus notas ya destiladas como material, con cada afirmación trazable a la página de origen.

### 5. Hablar con tu propio pasado 🟠
No "chatear con tus notas" genérico, sino preguntar específicamente *"¿qué pensaba yo de esto en marzo?"* y que la respuesta se arme **solo** con lo escrito hasta esa fecha — un filtro temporal sobre la misma infraestructura de embeddings. Emocionalmente mucho más potente que una búsqueda semántica sin fecha: te muestra cómo pensabas antes de saber lo que sabés ahora.

### 6. Detector de contradicciones internas 🟠
Escribiste algo en enero, y en agosto escribiste algo que lo contradice sin notarlo. Glenwyn detecta tensión semántica entre dos notas propias y la señala con cuidado: *"esto se parece, pero decís cosas distintas — ¿cambiaste de opinión, o es un matiz?"*.

### 7. El abogado del diablo de tus propias ideas 🟠
Para una nota con una opinión fuerte, pedirle a Glenwyn que muestre — con cuidado, sin ser predicador — el contraargumento más sólido que existe, sacado de conocimiento general, no de tus propios datos. La mayoría de las herramientas de "second brain" solo devuelven eco de lo que ya pensás; esto sería lo opuesto.

### 8. Plantillas generadas a partir de una descripción libre 🟠
En vez de elegir de una lista fija, escribís "necesito un tracker de hábitos para leer más" y un modelo de lenguaje arma la estructura de bloques al vuelo. Necesita una llamada a la API de Claude con un prompt que devuelva JSON estructurado (bloques válidos de Glenwyn), no solo texto libre.

### 9. Páginas vivas — resúmenes que se autogeneran 🔴
Un "Resumen semanal" que se arma solo, sin que preguntes nada — proactivo, no reactivo. Una función serverless con cron (por ejemplo, domingos a la noche) junta las páginas editadas esa semana y le pide a un modelo de lenguaje que genere un resumen. **Riesgo principal:** costo recurrente de la API — corre sola cada semana para cada usuario, hay que pensar el modelo de costos antes de lanzarlo a todos.

### 10. Un modelo corriendo en tu propio navegador 🔴
*Ningún competidor grande hace esto en serio todavía.* En vez de mandar contenido a una API externa, correr un modelo chico dentro del navegador (WebGPU + `transformers.js`) para embeddings o resúmenes 100% offline. A favor: privacidad real, sin costo recurrente. En contra: descarga inicial pesada, WebGPU no universal todavía, más lento que una API en la nube. Tendría sentido si "tus notas nunca salen de tu computadora" se vuelve un pilar central de cómo se vende Glenwyn — es una apuesta de posicionamiento, no una feature técnica más.

### 11. Memoria ambiental — patrones que Glenwyn nota sin que preguntes 🔴 *(tratar con mucho cuidado)*
Sin activar nada, Glenwyn observa y dice, una sola vez y con mucho tacto, algo como *"empezaste 3 proyectos en dos años y no terminaste ninguno"*. Regla no negociable: nunca diagnosticar, siempre opt-in, mostrarlo una sola vez, nunca por defecto.

### 12. Detección de patrones en el diario 🔴 *(tratar con mucho cuidado)*
La misma idea que #11, pero scopeada a páginas de journaling específicamente ("mencionaste sentirte abrumado por el trabajo 5 veces este mes"). Mismas reglas no negociables: nunca nombrar una condición clínica, solo reflejar patrones que la persona ya escribió con sus propias palabras.

### 13. Las preguntas activas (técnica de Feynman/Forte) 🟡
Forte recomienda mantener una lista corta (10-12) de las preguntas o problemas que más te importan ahora, y filtrar todo lo que capturás contra esa lista — evita que el second brain se llene de trivia sin filtro. Una página especial fijada arriba del todo con esa lista; cuando escribís algo nuevo que se conecta semánticamente con una pregunta activa, Glenwyn te lo señala — la idea #1 de arriba, pero scopeada a esta lista corta en vez de todo el workspace.

---

## C. Organización del conocimiento (Zettelkasten y PARA, sin IA)

### 14. Bandeja de entrada — notas fugaces separadas de las permanentes 🟢
El Zettelkasten distingue entre **notas fugaces** (una idea a mitad de escribir) y **notas permanentes** (ya destiladas). Una página especial de sistema donde un atajo nuevo crea una nota directo, sin pedirte elegir dónde va — la procesás cuando quieras. Cero backend nuevo.

### 15. Extraer a nota atómica 🟢
Si un párrafo dentro de una página larga merece ser su propia idea: seleccionás → "Extraer a nota nueva" → se crea una página con ese contenido, enlazada automáticamente desde donde la sacaste (vía el sistema de menciones ya existente). Reduce la fricción de practicar Zettelkasten de un click, en vez de cuatro pasos manuales.

### 16. Notas huérfanas — limpieza del grafo 🟢
El fracaso más común de un second brain: acumulás todo y no encontrás nada, porque la mitad de las notas no están conectadas a ninguna otra. Una vista que lista las páginas con cero backlinks y cero menciones — no para obligarte a conectarlas, sino para que sepas cuáles existen sin red.

### 17. Indicador de madurez de una nota 🟢
Un puntito de color, no un campo manual: refleja automáticamente en qué etapa Zettelkasten está cada página — fugaz (sin conexiones), en proceso (con backlinks, corta), permanente (con backlinks y contenido sustancial).

### 18. Modo "biblioteca" para recursos externos (la R de PARA) 🟡
Un tipo de página especial para material de referencia (artículos, libros) con campos propios (autor, fuente, fecha) — la distinción central de Zettelkasten entre "una idea tuya" y "algo que guardaste".

### 19. Modo PARA como plantilla de arranque, no como imposición 🟢
En vez de forzar una estructura, una plantilla opcional (como Diario o Notas de reunión, que ya existen) que crea las 4 páginas raíz — Proyectos, Áreas, Recursos, Archivo — con una breve explicación de cada una. Quien conoce el método la reconoce; quien no, la ignora.

### 20. Índice de conceptos automático 🟡
Si mencionás "Proyecto Aurora" en 12 páginas a lo largo de meses, un índice detecta términos que se repiten seguido (reutilizando el mecanismo de menciones ya construido) y arma solo una página de referencia por cada uno — un glosario que se mantiene solo.

### 21. Capas de confianza epistémica 🟢
Un campo chico y opcional: *"esto lo sé con certeza"* vs *"es una hipótesis mía"* vs *"lo escuché en algún lado, no lo verifiqué"*. Con el tiempo, filtrás el workspace por "todo lo que doy por hecho pero nunca confirmé" — honestidad intelectual incorporada a la herramienta.

### 22. Preguntas que te hiciste y nunca contestaste 🟡
Si terminás un párrafo con una pregunta a vos mismo, Glenwyn la registra en silencio y podés ver cuántas quedaron abiertas — distinto de las preguntas activas (#13, que elegís mantener), estas son las que se te escaparon sin querer.

### 23. Linaje de una idea 🟡
Distinto de los backlinks (que muestran conexión) — esto muestra *evolución*: la nota A inspiró la B, que se convirtió en la C. Un árbol genealógico de una sola idea madurando de pensamiento suelto a algo formado.

### 24. Vínculos "dorados" — páginas hub 🟢
Sin necesitar IA: destacar visualmente qué páginas son las más conectadas del workspace (cantidad de backlinks). Ayuda a encontrar tus notas más importantes con datos que ya existen — cero infraestructura nueva.

---

## D. Rituales y hábitos

### 25. Revisión semanal guiada 🟡
La pieza ritual más citada de todo el método de Forte, y la que ninguna app hace bien todavía. Un botón "Revisión semanal" abre un asistente de 3-4 pasos: páginas editadas esta semana → huérfanas → tareas vencidas → pendientes de la Bandeja de entrada → un espacio para 2-3 líneas de reflexión (que queda como su propia nota fechada). Reutiliza datos que ya existen; el trabajo real es de interfaz.

### 26. Ritual de cierre del día 🟢
Contraparte liviana de la revisión semanal: tres preguntas cortas antes de cerrar (*"¿qué avanzó hoy? ¿qué quedó pendiente? ¿algo que no querés olvidar?"*) que arman solas una nota diaria, sin enfrentarte a una página en blanco.

### 27. Resurfacing pasivo — repaso espaciado aplicado a notas 🟡
La misma lógica de repetición espaciada de Anki, aplicada a notas: cada vez que abrís Glenwyn, una tarjeta chica muestra 1-2 notas viejas que no mirabas hace tiempo — con más peso para las que tienen pocas conexiones, justo las que más riesgo tienen de quedar olvidadas.

---

## E. Nuevas formas de ver el mismo conocimiento

### 28. Modo canvas — lienzo infinito 🔴
Páginas y bloques se vuelven tarjetas que arrastrás libremente en el espacio, como el Canvas de Obsidian. Conceptualmente parecido al diseño de "bases de datos estilo Notion" ya documentado en otro lado — una página especial que contiene referencias a otras páginas, pero con posición `{x, y}` libre en vez de una tabla. Necesita un motor de renderizado nuevo (librería de pan/zoom), no una extensión de lo que existe.

### 29. Línea de tiempo del historial 🟡
En vez de una lista de versiones, un control deslizante que "scrollea" cómo evolucionó una página en semanas. La data ya existe por completo (`page_versions`) — esto es casi 100% trabajo de interfaz. El esfuerzo más bajo de esta sección para el impacto visual que tiene.

### 30. Mini-mapa local al pie de cada página 🟢
La versión chica y barata de un grafo completo: al final de cada página, un diagrama mínimo mostrando solo los vecinos directos de *esta* página — 5-8 nodos, no el grafo entero. Más útil en el momento que estás mirando una idea puntual.

### 31. Vista de distillado — resaltado progresivo de verdad 🟡
Casi ninguna app implementa esto como una *vista*, solo como formato de texto suelto. Dos niveles de énfasis dentro de un bloque (negrita = capa 1, resaltador = capa 2), y un botón "Modo distillado" que oculta todo lo no marcado — la página entera se lee en 20 segundos en vez de 5 minutos. La feature que más fielmente representa la técnica real de Forte.

### 32. El grafo como jardín, no como red de nodos 🔴
Todos los competidores muestran su red de ideas como el mismo diagrama de puntos y líneas. Glenwyn ya tiene identidad "cozy, naturaleza" — llevarla al visualizador de conexiones: cada página es una planta que crece según qué tan conectada y madura está (idea #17, hecha literal y visual), con estaciones que pasan reflejando el tiempo real. El elemento que nadie podría copiar sin que se note.

### 33. Pátina del tiempo 🟢
Las páginas que no tocás hace mucho envejecen visualmente — un color más apagado, una textura suave — como una foto vieja, no como una advertencia. Un timestamp convertido en algo cálido en vez de clínico.

---

## F. Memoria, contexto y expresión

### 34. Anclas temporales — memoria disparada por contexto 🟡
Cada nota se etiqueta sola, al crearla, con un contexto ambiental mínimo (por ejemplo el clima del día) — no para analizarlo, sino como disparador de memoria tipo Proust: *"esto lo escribí el día que llovió tanto"*.

### 35. Semillas de ideas 🟢
Distinto de las notas fugaces (ya escritas) — capturar la chispa *antes* de tener palabras: un título solo, deliberadamente incompleto. Cada tanto, Glenwyn pregunta con suavidad si querés desarrollar alguna semilla vieja.

### 36. Rastro de navegación 🟢
Un historial de "las últimas 8 páginas que visitaste en esta sesión" — no el árbol fijo, sino tu recorrido real saltando de mención en mención.

### 37. Exportar con propósito 🟡
En vez de un "exportar a Markdown" genérico, elegís el destino ("preparar para una entrevista", "para compartir con un colega", "para publicar") y el formato cambia según el propósito.

### 38. Biografía automática del workspace 🔴
Una línea de tiempo de *todo* tu segundo cerebro — cuándo empezó tu proyecto más grande, tu período más prolífico, qué ideas tardaron años en conectarse. Como si Glenwyn escribiera un capítulo de tu propia biografía intelectual.

### 39. Tu año, visto desde adentro 🟡
Un resumen anual reflexivo — el "Wrapped" de tu propio pensamiento. Reutiliza datos que ya existen (backlinks, historial, fechas); el trabajo es de narrativa y diseño visual.

### 40. De tus notas a un libro 🔴
El paso "Expresar" en su forma más ambiciosa: un flujo guiado que ayuda a tomar un grupo de notas atómicas ya conectadas y ordenarlas en capítulos para algo largo de verdad.

---

## G. Enfoque y ritmo

### 41. Modo enfoque con temporizador 🟢 — ✅ construido como "Modo Deep Work" (v0.51)
Un temporizador (25/50/90 min) que, mientras corre, oculta todo menos lo que estás escribiendo. Mutuamente excluyente con Modo Zen.

**Pendiente para diferenciarlo mejor de Modo Zen (recomendaciones guardadas, sin implementar todavía):**
1. **Acento de color propio** — usar el tono ámbar (`sun`) en la cuenta regresiva y el botón flotante, en vez de compartir el verde musgo de Zen. El cambio más barato de los seis
2. **Preguntar la intención antes de empezar** — una sola línea, *"¿Qué vas a lograr en esta sesión?"*, antes de arrancar el temporizador. Zen nunca pregunta nada; Deep Work sí, porque el punto es un compromiso con un objetivo, no solo silencio
3. **Cierre con reflexión, no solo "se acabó el tiempo"** — al terminar, un mensaje breve tipo *"Sesión completa. ¿Cómo te fue?"* con un campo opcional de una línea que se guarda como nota fechada. Conecta con el "ritual de cierre del día" (#26) ya documentado
4. **Contador de sesiones del día** — algo chico tipo "3 sesiones hoy", el ángulo de logro que es propio de Deep Work y no tendría sentido en Zen
5. **Barra de progreso sutil arriba de la pantalla** — una línea fina que se va llenando con el tiempo, en vez de solo el número en la esquina — señal visual de "esto tiene un final", que Zen (abierto, sin final) no necesita
6. **Sugerir un descanso al terminar** — 5 minutos antes de la próxima sesión, la parte de la técnica Pomodoro que casi nadie respeta pero es la que más importa

Recomendación si se retoma: empezar por #1 (gratis) y #2+#3 juntos (son los que más le dan un propósito distinto a Deep Work en vez de ser "Zen con reloj").

### 42. Modo "solo esto existe" 🟢 — ✅ construido como "Modo Zen" (v0.51, renombrado de "modo enfoque")
Mientras escribís, se desactiva por completo la navegación (sidebar y barra superior ocultos). Ataca el fracaso más común de un second brain: terminás organizando en vez de crear. Un botón flotante discreto (o `Esc`) para salir.

### 43. Modo susurro 🟢
Las sugerencias de Glenwyn (patrones, huérfanas, vínculos posibles) no interrumpen mientras escribís — se juntan en un resumen diario o semanal que revisás cuando vos querés.

### 44. Notas con fecha de vencimiento de relevancia 🟡
Marcás una nota como "esto es temporal" o "este dato puede cambiar", y al pasar su fecha, Glenwyn pregunta suave si sigue vigente — en vez de dejarla ahí para siempre como verdad eterna.

### 45. Modo "cápsula del tiempo" 🟢
Programás que una página se "revele" en una fecha futura — un campo `revealDate`, oculta el contenido hasta que `hoy >= revealDate`. Cero backend nuevo.

---

## H. Puentes físicos y colaboración liviana

### 46. Código QR por página 🟢
Generás un QR (codificando la misma URL de "Compartir") y lo pegás en un cuaderno físico — escanearlo te lleva directo a la página viva. Reutiliza el sistema de compartir tal cual está; la más simple de construir de todo el documento.

### 47. Presencia en tiempo real, sin editar juntos 🟢
*"Juan está viendo esta página ahora"* en un link compartido. Supabase Realtime ya trae **Presence** como primitiva lista para usar — mucho menos esfuerzo que multiusuario real, pero ya se siente "vivo".

### 48. Tu segundo cerebro, accesible desde otras IA 🟠
En vez de un chat propio dentro de Glenwyn, exponer tu workspace como fuente de contexto que otras herramientas de IA puedan consultar con tu permiso explícito (vía MCP) — tu conocimiento se conecta con el resto de tu ecosistema, no queda encerrado en una isla.

### 49. Traducción automática en links compartidos 🟡
Alguien abre tu link compartido en otro idioma y ve la opción de traducir esa página puntual, al vuelo, sin guardar la traducción en ningún lado.

---

## I. Recomendaciones de la sesión — salud del código y features importantes

No son ideas de feature nuevas al estilo del resto del documento — son una lectura de conjunto de qué necesita Glenwyn ahora que ya tiene bases de datos completas, Zen/Deep Work, y la mayoría del banco de ideas de bajo esfuerzo construido.

### ⚠️ Prioridad más alta — no es una feature
**`App.jsx` ya tiene más de 6000 líneas.** Ya se había anotado en la auditoría de calidad de código (cuando tenía 4117 líneas) que convenía dividirlo, y se pospuso por el riesgo. Hoy es 50% más grande. Recomendación concreta para la próxima sesión grande: dividir en módulos (un archivo por componente grande — `DatabaseView`, `TasksView`, los bloques, etc.) *antes* de seguir agregando features, no porque algo esté roto hoy, sino porque cada tanda nueva lo hace más frágil de tocar y más propenso a que un archivo se corte al copiarlo.

### 1. Tests automáticos para la lógica más delicada 🟡
Ya se encontraron a mano dos bugs sutiles (`Number(null) === 0` enmascarando un ciclo en rollups; un cierre obsoleto de `inboxPageId`). Ese tipo de bug es justo lo que un test unitario chico atrapa solo. No hace falta una suite enorme — 15-20 tests sobre `pageUtils.js` (fechas recurrentes, resolución de rollups, detección de menciones) cubrirían la parte más propensa a errores silenciosos.

### 2. Paleta de comandos ampliada 🟡
Ya estaba en la lista original de 20 ideas, nunca se construyó. Ahora hay muchísimos atajos escondidos (Zen, Deep Work, captura rápida, extraer a nota) que solo viven en el panel de ayuda. Un `⌘K` que además de buscar páginas también *ejecute acciones* haría descubrible todo lo que ya existe.

### 3. Backup completo del workspace 🟡
Hoy se exporta una página a la vez. Con bases de datos, relaciones, y todo el resto ya adentro, un solo botón "exportar todo" a un `.zip` con Markdown + imágenes da tranquilidad real de que los datos no quedan atrapados.

### 4. Búsqueda semántica 🟠
Sigue siendo la pieza de mayor impacto sin construir de todo el banco — la diferencia entre "buscador de texto literal" y "second brain de verdad". Requiere la conversación de privacidad ya documentada (embeddings a una API externa).

### 5. Re-auditoría de accesibilidad 🟡
Desde la última auditoría completa se agregaron tablas de bases de datos, tablero, calendario, galería, y los modos Zen/Deep Work — mucha superficie nueva sin pasar por el mismo filtro que el resto de la app.

## J. Ideas nuevas — relevantes recién ahora que existen bases de datos

### 50. Exportar una base de datos a CSV 🟢
Hoy se exporta una página a Markdown, pero un registro con propiedades reales pide claramente un CSV, no Markdown — alguien va a querer sacar esos datos a Excel/Sheets tarde o temprano.

### 51. Importar CSV para crear registros en lote 🟡
La contraparte del anterior. Antes de que existieran las bases de datos esto no tenía sentido; ahora es la forma natural de arrancar una con datos que ya existían en otro lado.

### 52. Navegar atrás/adelante 🟢
Ya existe el "Recorrido reciente" registrando por dónde pasaste (idea #36, ya construida) — con esos mismos datos, dos botones `‹ ›` en la barra superior para moverte por ese historial son casi gratis.

### 53. Recordatorios de tareas por notificación del navegador 🟡
Si la pestaña está abierta y una tarea vence hoy, una notificación nativa (Web Notifications API) — sin backend nuevo.

### 54. Una vista de inicio real 🟡
Hoy la app abre en la última página activa. Una pantalla de bienvenida chica (páginas editadas esta semana, tareas de hoy, alguna estadística simple) le daría a "abrir Glenwyn" una sensación de punto de partida, no de "seguir donde quedé".

## L. Ideas y auditorías nuevas, comparando con Notion (capturas de julio 2026)

### 55. Bases de datos: personalización + inline vs. página completa 🟠
Hoy una base de datos siempre es una página completa aparte. Notion permite dos formas de insertar una:
- **Integrada (inline):** vive dentro de otra página, como un bloque más, sin ocupar toda la pantalla
- **Página completa:** lo que Glenwyn ya tiene hoy

Al crear, Notion muestra un modal con sugerencias (Seguimiento de tareas, Proyectos, Centro de documentos, Sesión de lluvia de ideas, Notas de reunión, Seguimiento de objetivos) o la opción de empezar vacía.

**Referencia detallada de la configuración de una base de datos en Notion** (capturas de julio 2026), para cuando se retome esto en profundidad:
- **Menú "Ir a la configuración" de una vista:** nombre de la vista, Diseño (el tipo de vista — ver abajo), Visibilidad de la propiedad, Filtrar, Ordenar, Agrupar, Color condicional, Copiar enlace a la vista
- **Diseño (tipos de vista) — 9 en total:** Tabla, Tablero, Cronograma, Calendario, Lista, Galería, Gráfico, Feed, Mapa, Panel de control. Glenwyn hoy tiene 4 (Tabla/Tablero/Calendario/Galería) — Cronograma, Lista, Gráfico, Feed, Mapa, y Panel de control quedan como candidatos futuros, sin orden de prioridad todavía
- **Configuración de fuente de datos:** Origen, Editar propiedades, Automatizaciones, Autocompletado con IA, Ver páginas archivadas, Más configuraciones (Subítems, Dependencias, Conexiones, Personalizar diseño de página, Convertir en Tareas)
- **Visibilidad de propiedad:** buscador + lista con toggle de mostrar/ocultar por columna, más un botón "Ocultar todo"
- **Plantillas de registro:** botón "Nuevo ▾" permite crear una plantilla de página reutilizable para los registros nuevos (más rico que los "valores por defecto por propiedad" que ya tiene Glenwyn — esto también pre-llena contenido de bloques, no solo propiedades)
- **Bloquear base de datos** para que no se pueda editar por accidente — mencionado, sin capturas detalladas

**En progreso ahora:** nombre e ícono editables después de creada (es el punto de partida elegido — ver commits siguientes)

Pendiente, sin arrancar: soporte inline (insertar como bloque dentro de una página existente, no solo como página completa), selector de tipo de vista al crear (en vez de arrancar siempre en modo tabla), y todo lo demás de la referencia de arriba.

### 56. Auditoría de arquitectura de información del sidebar 🟡 — **pendiente, sin hacer todavía**
Señalado directamente: las opciones del sidebar (Ajustes, Atajos, Guía de uso, Deep Work, Modo oscuro, Papelera, Cerrar sesión, plan actual) están todas sueltas, una debajo de la otra, sin ningún agrupamiento — a diferencia de Notion, que las organiza en menús (Cuenta, Espacio de trabajo, Funciones, Admin, Acceso y facturación — ver capturas). Vale una revisión completa de qué va en el sidebar directo, qué va agrupado dentro de Ajustes, y qué merecería su propio menú aparte — no es un ajuste chico, es repensar la organización completa.

### 57. Fix ya hecho: el triángulo sin contexto junto a "+ Nueva página" ✅
Reportado como si no tuviera función — en realidad sí abre el menú de plantillas, pero un carácter suelto "▾" sin ningún otro indicio visual es indistinguible de un adorno roto. Reemplazado por un ícono de línea (`ChevronDown` de lucide) con `aria-label` explícito, como parte de esta misma tanda.

### 58. Catálogo de features de Configuración de Notion, para evaluar cuáles construir 🟡
De las capturas de las preferencias/configuración de Notion — lista de qué existe ahí, para decidir cuáles tienen sentido en Glenwyn (no es una lista de "hay que construir todo esto", es un menú para elegir):

**Perfil y cuenta:**
- Foto de perfil / avatar personalizado
- Cambiar contraseña desde Ajustes (hoy solo existe "olvidé mi contraseña" en el login)
- Verificación en dos pasos (2FA)
- Passkeys (login biométrico)
- ID de usuario visible (para soporte/debugging)

**Sesión y dispositivos:**
- Lista de dispositivos con sesión activa (nombre, última actividad, ubicación aproximada)
- "Cerrar sesión en todos los dispositivos" (distinto de cerrar solo la sesión actual)

**Preferencias de la app:**
- Modo (sistema/claro/oscuro) — Glenwyn ya tiene claro/oscuro, falta la opción "seguir configuración del sistema"
- Idioma del corrector ortográfico
- Empezar la semana en lunes (afecta cómo se ven las fechas en el calendario de bases de datos)
- Formato de fecha (relativo vs. absoluto)
- Zona horaria (automática por ubicación, o manual)
- Formato de números/moneda

**Privacidad:**
- Configuración de cookies personalizable (hoy Glenwyn solo tiene la política informativa, sin un panel de preferencias real)
- Visibilidad del perfil (si otros usuarios ven tu nombre/foto al compartir espacio)

**Soporte:**
- Toggle de "permiso de acceso temporal para soporte técnico" (para cuando alguien necesite ayuda a resolver un problema)

**Facturación (cuando exista Stripe):**
- Página de "explorar los planes" separada de Ajustes, con la tabla comparativa completa (ya existe `PlansComparison.jsx`, pero podría ampliarse a esta vista dedicada)

## K. Tipos de auditoría todavía no hechos

Ya cubiertas: datos/lógica (5 veces), diseño/UX, seguridad, performance, accesibilidad, SEO. Pendientes, de otra naturaleza:

- **Arquitectura de bases de datos** — el subsistema más nuevo y complejo (relaciones, rollups, ciclos) merece una revisión propia, no asumir que quedó bien solo porque las auditorías generales no la tocaron a fondo
- **Consistencia de diseño** — componentes construidos en sesiones muy distintas; revisar si espaciados/colores/patrones de botón siguen coherentes o se acumuló deriva
- **Dependencias** — nunca se corrió un `npm audit` sobre las librerías del proyecto
- **Escala** — todo probado con un puñado de páginas; simular un workspace con cientos y ver qué empieza a sentirse lento
- **Mensajes de error** — revisar si cada error le dice al usuario algo específico y útil, o si varios caen en un genérico "algo salió mal"
- **Resiliencia** — qué pasa si Supabase se pausa, si se pierde acceso a la cuenta de Google, o si el export ya no alcanza como backup real — la pregunta de "peor caso" que nunca se hizo

## Cómo priorizar cuando llegue el momento

**Las de menor esfuerzo y sin ninguna dependencia de IA** — buenas para intercalar en cualquier tanda futura sin planificación extra: Bandeja de entrada (#14), Extraer a nota atómica (#15), Notas huérfanas (#16), Indicador de madurez (#17), Vínculos dorados (#24), Ritual de cierre del día (#26), Mini-mapa local (#30), Pátina del tiempo (#33), Rastro de navegación (#36), Modo "solo esto existe" (#42), Modo susurro (#43), Cápsula del tiempo (#45), Código QR (#46), Presencia en tiempo real (#47), Línea de tiempo del historial (#29), y Capas de confianza epistémica (#21).

**Las que definen una dirección de producto, no solo una feature** — conviene decidirlas con calma, no de paso: Sugerencias de vínculo automáticas (#1) y modelo local en el navegador (#10). La primera implica mandar contenido a una API externa (una conversación de privacidad real con quien use Glenwyn); la segunda es casi una apuesta de posicionamiento de marca completa.

**Las que exigen el mayor cuidado ético antes de escribir una sola línea de código:** memoria ambiental (#11) y detección de patrones en el diario (#12) — territorio sensible, nunca diagnosticar, siempre opt-in.
