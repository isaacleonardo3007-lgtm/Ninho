-- Rode UMA VEZ no SQL Editor do Supabase (não é migration: contém segredos).
-- Requer as extensões pg_cron e pg_net (Database → Extensions).
-- 1) guarde os segredos no Vault
select vault.create_secret('https://SEU-PROJETO.supabase.co', 'ninho_url');
select vault.create_secret('TROQUE-POR-UM-SEGREDO-LONGO', 'ninho_cron_secret');  -- mesmo valor do secret CRON_SECRET da função

-- 2) envio de lembretes a cada 5 minutos
select cron.schedule('ninho-send-reminders', '*/5 * * * *', $$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'ninho_url') || '/functions/v1/send-reminders',
    headers := jsonb_build_object('Content-Type', 'application/json',
               'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'ninho_cron_secret')),
    body    := '{}'::jsonb);
$$);

-- 3) limpeza diária da fila de lembretes (03:15 UTC)
select cron.schedule('ninho-limpar-lembretes', '15 3 * * *', $$ select public.limpar_lembretes(); $$);
