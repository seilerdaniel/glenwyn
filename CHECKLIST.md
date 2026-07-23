# Glenwyn — Checklist de configuración pendiente

Todo lo que falta para que Glenwyn quede funcionando de punta a punta. En orden — cada paso depende del anterior.

---

## 1. Actualizar tu carpeta local

- [ ] Descomprimir el último `glenwyn-project.zip` y reemplazar tu carpeta local (o copiar `src/App.jsx`, `src/lib/`, y `supabase/migrations/` si preferís no tocar tu `.git` local)
- [ ] `cd glenwyn && npm install`

## 2. Correr las migraciones SQL en Supabase

Andá a tu proyecto en supabase.com → **SQL Editor** → pegá y ejecutá **en este orden exacto** (cada una depende de que la anterior ya haya corrido):

- [ ] `supabase/migrations/001_init.sql` — crea la tabla `pages` con Row Level Security
- [ ] `supabase/migrations/002_pinned.sql` — agrega la columna `pinned` (favoritos)
- [ ] `supabase/migrations/003_page_versions.sql` — crea la tabla de historial de versiones
- [ ] `supabase/migrations/004_storage.sql` — crea el bucket de Storage para upload de imágenes
- [ ] `supabase/migrations/005_sharing.sql` — habilita compartir páginas por link de solo lectura

Después de correr las cuatro, confirmá en el **Table Editor** que ves las tablas `pages` y `page_versions`, y en **Storage** que existe el bucket `glenwyn-images`.

## 3. Configurar Google OAuth

**En Google Cloud Console** (console.cloud.google.com → APIs & Services → Credentials):
- [ ] Crear un proyecto (si no tenés uno ya para esto)
- [ ] Configurar la pantalla de consentimiento OAuth (External, nombre "Glenwyn", tu email de contacto)
- [ ] Crear credenciales → **OAuth Client ID** → tipo **Web application**
- [ ] En **Authorized redirect URIs** agregar: `https://TU_PROYECTO.supabase.co/auth/v1/callback`
  (tu referencia de proyecto está en Supabase → Project Settings → API, en la Project URL)
- [ ] Copiar el **Client ID** y el **Client Secret**

**En Supabase** (Authentication → Providers):
- [ ] Activar el proveedor **Google**
- [ ] Pegar el Client ID y Client Secret
- [ ] Ir a Authentication → **URL Configuration** y agregar en *Redirect URLs*:
  - `http://localhost:5173`
  - tu dominio de Vercel (ej. `https://glenwyn.vercel.app`)

## 4. Variables de entorno

**Local:**
- [ ] `cp .env.example .env.local`
- [ ] Completar `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` (Supabase → Project Settings → API)

**Vercel:**
- [ ] Project Settings → Environment Variables → agregar las mismas dos claves
- [ ] Redeploy (Vercel no las toma hasta el próximo deploy)

## 5. Probar en local

- [ ] `npm run dev` → abrir `http://localhost:5173`
- [ ] Botón "Continuar con Google" → confirmar que el login funciona
- [ ] Crear una página, escribir algo, refrescar el navegador → confirmar que persiste
- [ ] Probar un par de bloques nuevos (tabla, imagen, embed) para asegurarte que todo renderiza bien
- [ ] Subir una imagen con el botón "subir archivo" → confirmar que aparece en Storage → Supabase

## 6. Probar en Vercel

- [ ] Abrir tu dominio de Vercel
- [ ] Repetir la prueba de login + crear página + refrescar
- [ ] Si el login falla acá pero funcionó en local, el problema casi siempre es que falta agregar el dominio de Vercel en las Redirect URLs de Supabase (paso 3) — revisar eso primero
- [ ] Probar "🔗 compartir" en una página, copiar el link, abrirlo en una ventana de incógnito (sin login) → confirmar que se ve el contenido de solo lectura
- [ ] Abrir `tu-dominio.vercel.app/guia.html` directamente → confirmar que carga la guía (no un 404, no la app)

---

## 7. Opcional — endurecer seguridad (recomendado, no bloqueante)

- [ ] En Supabase → Settings → API, activar el rate limiting para la función RPC `get_shared_page` y para el bucket `glenwyn-images`, como capa extra de defensa contra abuso

---

## Si algo falla

- **Login no redirige / da error de "redirect_uri_mismatch"** → la URL en Google Cloud Console no coincide exactamente con la de Supabase (revisar que no falte o sobre una barra `/` al final)
- **La app carga pero no guarda páginas** → revisar la consola del navegador (F12); los errores de guardado y carga ahora quedan logueados ahí con el prefijo `Glenwyn:`
- **Imágenes no suben** → confirmar que corriste `004_storage.sql` y que el bucket `glenwyn-images` existe en Storage
- **El link de compartir da 404 en Vercel** → confirmar que `vercel.json` está en la raíz del proyecto y que Vercel lo tomó en el último deploy (puede necesitar un redeploy manual la primera vez)
