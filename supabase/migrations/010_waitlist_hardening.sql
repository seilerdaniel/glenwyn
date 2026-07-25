-- La tabla waitlist_signups se inserta directo vía PostgREST con la anon key,
-- sin pasar nunca por el rate limiter de Supabase Auth (ese solo cubre signup/
-- login reales) — así que hoy no tiene ninguna protección contra un script
-- que mande miles de filas basura. Esto agrega las defensas más baratas:
-- formato de email válido, y no permitir el mismo email dos veces.

-- Nota: esto NO reemplaza un CAPTCHA si en algún momento se vuelve un problema
-- real — es la primera línea de defensa, barata y sin dependencias nuevas.

alter table public.waitlist_signups
  add constraint waitlist_email_format check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$');

-- Insensible a mayúsculas/minúsculas a propósito — "a@b.com" y "A@B.COM" son
-- la misma persona anotándose dos veces, no dos personas distintas.
create unique index waitlist_email_unique_idx on public.waitlist_signups (lower(email));
