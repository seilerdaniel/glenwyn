-- Fase A de "bases de datos estilo Notion" — ver docs de diseño para el porqué de
-- cada decisión. Resumen: una base de datos es una página especial que define un
-- esquema de propiedades; sus "registros" son páginas normales (reutilizan toda la
-- jerarquía, papelera, historial y RLS que ya existen) con database_id apuntando acá.

create table public.databases (
  id          uuid primary key default gen_random_uuid(),
  page_id     uuid not null references public.pages(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  properties  jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now()
);
-- properties: [{ id, name, type, options }]
-- type: 'text' | 'number' | 'select' | 'date' | 'checkbox' (Fase A)
--       | 'relation' | 'rollup' (Fase C — sin cambio de esquema, todo vive en este mismo jsonb)

comment on column public.databases.properties is
  'Esquema de columnas de esta base de datos, no los valores — los valores viven en pages.properties de cada registro.';

create unique index databases_page_id_idx on public.databases(page_id);
create index databases_user_id_idx on public.databases(user_id);

alter table public.databases enable row level security;

create policy "databases select own"
  on public.databases for select
  using (auth.uid() = user_id);

create policy "databases insert own"
  on public.databases for insert
  with check (auth.uid() = user_id);

create policy "databases update own"
  on public.databases for update
  using (auth.uid() = user_id);

create policy "databases delete own"
  on public.databases for delete
  using (auth.uid() = user_id);

-- Vistas guardadas de una base de datos (tabla/tablero/calendario en fases futuras;
-- Fase A solo usa 'table', pero la tabla ya soporta las demás sin migrar de nuevo).
create table public.database_views (
  id           uuid primary key default gen_random_uuid(),
  database_id  uuid not null references public.databases(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  name         text not null default 'Vista',
  type         text not null default 'table',
  config       jsonb not null default '{}'::jsonb,
  "order"      integer not null default 0
);
-- config: { filters: [...], sorts: [...], groupBy: "propertyId", visibleProperties: [...] }

create index database_views_database_id_idx on public.database_views(database_id, "order");

alter table public.database_views enable row level security;

create policy "database_views select own"
  on public.database_views for select
  using (auth.uid() = user_id);

create policy "database_views insert own"
  on public.database_views for insert
  with check (auth.uid() = user_id);

create policy "database_views update own"
  on public.database_views for update
  using (auth.uid() = user_id);

create policy "database_views delete own"
  on public.database_views for delete
  using (auth.uid() = user_id);

-- En pages: database_id marca "esta página es un REGISTRO de esa base de datos"
-- (distinto de databases.page_id, que marca "esta página ES la base de datos").
-- properties guarda los valores de ese registro según el esquema del punto anterior.
alter table public.pages add column if not exists database_id uuid references public.databases(id) on delete set null;
alter table public.pages add column if not exists properties jsonb;

create index if not exists pages_database_id_idx on public.pages(database_id);
