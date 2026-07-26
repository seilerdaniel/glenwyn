-- Idea #60 del banco de ideas — "Personalizar página", inspirado en el menú
-- equivalente de Notion: estilo de fuente (por defecto/serif/mono) y texto
-- pequeño, dos preferencias de lectura guardadas por página.

alter table public.pages add column if not exists font_style text not null default 'default';
alter table public.pages add column if not exists small_text boolean not null default false;

alter table public.pages add constraint pages_font_style_check
  check (font_style in ('default', 'serif', 'mono'));

comment on column public.pages.font_style is
  'Fuente del contenido de esta página: default (Public Sans), serif (Fraunces), o mono (JetBrains Mono).';
comment on column public.pages.small_text is
  'Si es true, el texto del contenido se muestra en un tamaño más chico.';
