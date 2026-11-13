-- =====================================================================
-- NINHO — Storage privado para fotos (ultrassom, laudos, memórias)
-- Caminho obrigatório: <user_id>/<tabela>/<id>.jpg
-- Bucket PRIVADO: o app usa URLs assinadas de curta duração.
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ninho', 'ninho', false, 5242880, array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy ninho_ler on storage.objects for select to authenticated
  using (bucket_id = 'ninho' and (storage.foldername(name))[1] = auth.uid()::text);

-- enviar arquivos é recurso Plus (fotos de ultrassom, laudos e memórias)
create policy ninho_enviar on storage.objects for insert to authenticated
  with check (bucket_id = 'ninho' and (storage.foldername(name))[1] = auth.uid()::text and public.is_plus());

create policy ninho_atualizar on storage.objects for update to authenticated
  using (bucket_id = 'ninho' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'ninho' and (storage.foldername(name))[1] = auth.uid()::text and public.is_plus());

create policy ninho_apagar on storage.objects for delete to authenticated
  using (bucket_id = 'ninho' and (storage.foldername(name))[1] = auth.uid()::text);
