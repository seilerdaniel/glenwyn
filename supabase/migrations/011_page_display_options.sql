-- Idea #60 del banco de ideas — dos de las opciones del menú "..." de una
-- página en Notion que se evaluaron como más simples y útiles de entrar:
-- ancho completo (el contenido ocupa toda la pantalla, no solo una columna
-- angosta) y bloquear página (evita ediciones por accidente).

alter table public.pages add column if not exists full_width boolean not null default false;
alter table public.pages add column if not exists locked boolean not null default false;

comment on column public.pages.full_width is
  'Si es true, el contenido de la página ocupa todo el ancho disponible en vez del máximo angosto de siempre.';
comment on column public.pages.locked is
  'Si es true, la página no se puede editar — protección simple contra ediciones por accidente, no es un permiso real de solo-lectura entre usuarios distintos.';
