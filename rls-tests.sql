-- Testes de segurança e regras do banco. Rodar após supabase-stub.sql + migrations.
\set ON_ERROR_STOP 1
create or replace function pg_temp.ok(cond boolean, nome text) returns void language plpgsql as $$
begin if not coalesce(cond,false) then raise exception 'FALHOU: %', nome; end if; raise notice 'ok — %', nome; end $$;
create or replace function pg_temp.falha(sql text, nome text) returns void language plpgsql as $$
begin
  begin execute sql; exception when others then raise notice 'ok — % (bloqueado: %)', nome, sqlerrm; return; end;
  raise exception 'FALHOU (deveria bloquear): %', nome;
end $$;
grant execute on all functions in schema pg_temp to authenticated;

-- 1) cadastro cria perfil, assinatura grátis e consentimentos
insert into auth.users (id, email, raw_user_meta_data) values
 ('11111111-1111-1111-1111-111111111111', 'ana@ex.com', '{"nome_completo":"Ana Souza","data_nascimento":"1995-04-02","telefone":"(11) 98888-7777","consentimentos":[{"tipo":"termos","versao":"2026-11","aceito":true},{"tipo":"privacidade","versao":"2026-11","aceito":true},{"tipo":"dados_saude","versao":"2026-11","aceito":true}]}'),
 ('22222222-2222-2222-2222-222222222222', 'bia@ex.com', '{"nome_completo":"Bia Lima"}');
select pg_temp.ok((select nome_completo from profiles where id='11111111-1111-1111-1111-111111111111') = 'Ana Souza', 'perfil criado no cadastro');
select pg_temp.ok((select telefone from profiles where id='11111111-1111-1111-1111-111111111111') = '11988887777', 'telefone normalizado');
select pg_temp.ok((select count(*) from consentimentos where user_id='11111111-1111-1111-1111-111111111111') = 3, '3 consentimentos gravados');
select pg_temp.ok((select plano from assinaturas where user_id='22222222-2222-2222-2222-222222222222') = 'free', 'assinatura grátis criada');

-- ===== como ANA (grátis) =====
set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
select pg_temp.ok((select meu_plano()->>'plano') = 'free', 'meu_plano = free');
select pg_temp.ok((select count(*) from profiles) = 1, 'Ana vê só o próprio perfil');
insert into gestacoes (id, metodo_ig, usg_data, usg_ig_semanas, usg_ig_dias, nome_bebe)
  values ('aaaaaaaa-0000-0000-0000-000000000001', 'usg', current_date - 30, 9, 2, 'Leo');
select pg_temp.ok((select user_id from gestacoes) = '11111111-1111-1111-1111-111111111111', 'user_id preenchido por auth.uid()');
select pg_temp.falha($$insert into gestacoes (metodo_ig) values ('usg')$$, 'gestação por USG exige data e IG');
select pg_temp.falha($$insert into gestacoes (metodo_ig, dum) values ('dum', current_date - 10)$$, 'só uma gestação ativa');
insert into consultas (gestacao_id, data, pa_sis, pa_dia, peso_kg, altura_uterina_cm, bcf_bpm, edema)
  values ('aaaaaaaa-0000-0000-0000-000000000001', current_date, 120, 80, 62.5, 12, 150, 'ausente');
select pg_temp.ok((select count(*) from consultas) = 1, 'grátis registra consulta');
insert into vacinas (gestacao_id, codigo, data_aplicacao) values ('aaaaaaaa-0000-0000-0000-000000000001', 'dtpa', current_date);
insert into movimentos (gestacao_id, inicio, duracao_min, contagem) values ('aaaaaaaa-0000-0000-0000-000000000001', now(), 30, 10);
select pg_temp.falha($$insert into exames (gestacao_id, data, codigo, valor_num) values ('aaaaaaaa-0000-0000-0000-000000000001', current_date, 'hb', 11.2)$$, 'grátis NÃO cria exame (Plus)');
select pg_temp.falha($$insert into medicoes (gestacao_id, tipo, medido_em, sis, dia) values ('aaaaaaaa-0000-0000-0000-000000000001','pressao', now(), 120, 80)$$, 'grátis NÃO cria medição (Plus)');
select pg_temp.falha($$update assinaturas set plano='plus'$$, 'usuária não se promove a Plus');
select pg_temp.falha($$insert into assinaturas (user_id, plano) values (auth.uid(), 'plus')$$, 'usuária não insere assinatura');
select pg_temp.falha($$select privado.plano_ativo('22222222-2222-2222-2222-222222222222')$$, 'não consulta plano de outra pessoa');
select pg_temp.falha($$insert into consultas (gestacao_id, data, pa_sis, pa_dia) values ('aaaaaaaa-0000-0000-0000-000000000001', current_date, 80, 120)$$, 'PA invertida (80/120) bloqueada');
select pg_temp.falha($$insert into consultas (gestacao_id, data, bcf_bpm) values ('aaaaaaaa-0000-0000-0000-000000000001', current_date, 900)$$, 'BCF absurdo bloqueado');
select pg_temp.falha($$update consentimentos set aceito = false$$, 'consentimento é imutável (só nova linha)');
insert into consentimentos (tipo, versao, aceito, origem) values ('notificacoes', '2026-11', false, 'configuracoes');
select pg_temp.ok((select aceito from consentimentos_vigentes where tipo = 'notificacoes') = false, 'revogação registrada');
insert into lembretes (chave, tipo, enviar_em, titulo, corpo) values ('c1', 'consulta', now() + interval '1 day', 'Ninho', 'Você tem um lembrete');
select pg_temp.falha($$insert into storage.objects (bucket_id, name) values ('ninho', '11111111-1111-1111-1111-111111111111/exames/x.jpg')$$, 'grátis não envia fotos');
reset role;

-- ===== Ana vira Plus (webhook / service_role) =====
update assinaturas set plano='plus', status='active', periodo_fim = now() + interval '30 days' where user_id='11111111-1111-1111-1111-111111111111';
set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
select pg_temp.ok((select meu_plano()->>'plano') = 'plus', 'meu_plano = plus');
insert into exames (id, gestacao_id, data, codigo, valor_num, unidade) values ('eeeeeeee-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', current_date, 'hb', 10.4, 'g/dL');
select pg_temp.falha($$insert into exames (gestacao_id, data, codigo) values ('aaaaaaaa-0000-0000-0000-000000000001', current_date, 'hb')$$, 'exame sem resultado bloqueado');
insert into medicamentos (id, gestacao_id, nome, horarios) values ('dddddddd-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Sulfato ferroso', '{08:00,20:00}');
select pg_temp.falha($$insert into medicamentos (gestacao_id, nome, horarios) values ('aaaaaaaa-0000-0000-0000-000000000001', 'X', '{25:99}')$$, 'horário inválido bloqueado');
insert into doses (gestacao_id, medicamento_id, data, horario) values ('aaaaaaaa-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-000000000001', current_date, '08:00');
insert into storage.objects (bucket_id, name) values ('ninho', '11111111-1111-1111-1111-111111111111/exames/x.jpg');
select pg_temp.falha($$insert into storage.objects (bucket_id, name) values ('ninho', '22222222-2222-2222-2222-222222222222/exames/x.jpg')$$, 'não grava na pasta de outra usuária');
-- updated_at é do servidor e user_id não muda
update consultas set observacoes = 'ok', user_id = '22222222-2222-2222-2222-222222222222';
select pg_temp.ok((select user_id from consultas limit 1) = '11111111-1111-1111-1111-111111111111', 'dona do registro não muda');
reset role;

-- assinatura vence: dados continuam legíveis e podem ser excluídos, mas não editados
update assinaturas set periodo_fim = now() - interval '1 day' where user_id='11111111-1111-1111-1111-111111111111';
set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
select pg_temp.ok((select count(*) from exames) = 1, 'após vencer, ainda lê os exames');
select pg_temp.falha($$update exames set valor_num = 9 where id = 'eeeeeeee-0000-0000-0000-000000000001'$$, 'após vencer, não edita exame');
update exames set deleted_at = now() where id = 'eeeeeeee-0000-0000-0000-000000000001';
select pg_temp.ok((select deleted_at is not null from exames where id = 'eeeeeeee-0000-0000-0000-000000000001'), 'após vencer, pode excluir (exclusão lógica)');
reset role;

-- ===== como BIA: isolamento total =====
set role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
select pg_temp.ok((select count(*) from gestacoes) = 0, 'Bia não vê gestação da Ana');
select pg_temp.ok((select count(*) from consultas) = 0, 'Bia não vê consultas da Ana');
select pg_temp.ok((select count(*) from profiles) = 1, 'Bia vê só o próprio perfil');
select pg_temp.ok((select count(*) from storage.objects) = 0, 'Bia não vê fotos da Ana');
select pg_temp.ok((select count(*) from lembretes) = 0, 'Bia não vê lembretes da Ana');
select pg_temp.falha($$insert into consultas (gestacao_id, data) values ('aaaaaaaa-0000-0000-0000-000000000001', current_date)$$, 'Bia não grava na gestação da Ana');
update consultas set observacoes = 'hack';
reset role;
select pg_temp.ok((select observacoes from consultas limit 1) = 'ok', 'Bia não altera dados da Ana');

-- ===== anônimo =====
set role anon;
select pg_temp.falha($$select count(*) from profiles$$, 'anônimo sem acesso');
reset role;

-- exclusão da conta apaga tudo em cascata
delete from auth.users where id = '11111111-1111-1111-1111-111111111111';
select pg_temp.ok((select count(*) from gestacoes) + (select count(*) from consultas) + (select count(*) from exames) + (select count(*) from consentimentos where user_id='11111111-1111-1111-1111-111111111111') = 0, 'excluir conta remove todos os dados');
\echo 'TODOS OS TESTES DO BANCO PASSARAM'
