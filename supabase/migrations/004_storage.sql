-- Glenwyn — bucket de Storage para upload real de imágenes
-- Corré esto en el SQL Editor de Supabase después de las migraciones anteriores.
-- Requiere permisos de owner en el proyecto (el SQL Editor de Supabase ya corre con eso).

insert into storage.buckets (id, name, public)
values ('glenwyn-images', 'glenwyn-images', true)
on conflict (id) do nothing;

-- El bucket es público para lectura (así las imágenes se ven sin necesidad de estar logueado,
-- por si más adelante compartís una página), pero solo cada usuario puede subir/editar/borrar
-- dentro de su propia carpeta, identificada por su user_id como primer segmento del path
-- (convención: "{user_id}/{archivo}").

drop policy if exists "Public can view glenwyn images" on storage.objects;
create policy "Public can view glenwyn images"
  on storage.objects for select
  using (bucket_id = 'glenwyn-images');

drop policy if exists "Users can upload their own images" on storage.objects;
create policy "Users can upload their own images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'glenwyn-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can update their own images" on storage.objects;
create policy "Users can update their own images"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'glenwyn-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can delete their own images" on storage.objects;
create policy "Users can delete their own images"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'glenwyn-images' and (storage.foldername(name))[1] = auth.uid()::text);
