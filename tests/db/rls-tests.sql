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

-- ===== crescimento: teste grátis, indicação, presente, passe, família =====
insert into auth.users (id, email, raw_user_meta_data) values ('33333333-3333-3333-3333-333333333333', 'cris@ex.com', '{"nome_completo":"Cris"}');
select pg_temp.ok((select codigo_indicacao from profiles where id='22222222-2222-2222-2222-222222222222') ~ '^[A-Z2-9]{6}$', 'perfil ganha código de indicação');
set role authenticated;
select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', false);
insert into gestacoes (metodo_ig, dum) values ('dum', current_date - 70);
select pg_temp.ok((select meu_plano()->>'teste_disponivel') = 'true', 'teste disponível para conta nova');
select pg_temp.ok((select iniciar_teste()->>'ok') = 'true', 'teste de 7 dias iniciado');
select pg_temp.ok((select meu_plano()->>'plano') = 'plus', 'teste libera o Plus');
select pg_temp.ok((select iniciar_teste()->>'motivo') = 'usado', 'teste só uma vez');
select pg_temp.falha($$insert into concessoes (user_id, origem, fim) values (auth.uid(), 'manual', now() + interval '1 year')$$, 'usuária não cria concessão');
update profiles set codigo_indicacao = 'XXXXXX' where id = auth.uid();
select pg_temp.ok((select codigo_indicacao from profiles) <> 'XXXXXX', 'código de indicação não muda');
select pg_temp.ok((select usar_indicacao((select meu_plano()->>'codigo_indicacao'))->>'motivo') = 'proprio', 'não usa o próprio código');
select pg_temp.ok((select usar_indicacao('ZZZZZZ')->>'motivo') = 'invalido', 'código inexistente recusado');
reset role;
select set_config('x.cod_bia', (select codigo_indicacao from profiles where id='22222222-2222-2222-2222-222222222222'), false) is not null;
set role authenticated;
select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', false);
select pg_temp.ok((select usar_indicacao(lower(current_setting('x.cod_bia')))->>'ok') = 'true', 'indicação aceita (sem diferenciar maiúsculas)');
select pg_temp.ok((select usar_indicacao(current_setting('x.cod_bia'))->>'motivo') = 'ja_usou', 'indicação só uma vez');
select pg_temp.ok((select (meu_plano()->>'acesso_ate')::timestamptz) > now() + interval '36 days', 'dias da indicação somam depois do teste');
select pg_temp.ok((select count(*) from concessoes) = 2, 'Cris vê só as próprias concessões');
select pg_temp.ok((select resgatar_presente('AAAAA-BBBBB')->>'motivo') = 'invalido', 'presente inexistente');
select pg_temp.falha($$select * from presentes$$, 'usuária não lê presentes');
insert into familia_convites (nome) values ('Vovó');
select pg_temp.ok((select length(token) from familia_convites) = 64, 'convite da família com token longo');
update familia_convites set token = 'abc', ver_fotos = true;
select pg_temp.ok((select length(token) from familia_convites) = 64 and (select ver_fotos from familia_convites), 'token não pode ser trocado');
reset role;
select pg_temp.ok((select meu_plano_bia.p from (select 1) x, lateral (select count(*) p from concessoes where user_id='22222222-2222-2222-2222-222222222222' and origem='indicacao') meu_plano_bia) = 1, 'quem indicou ganha 30 dias');
set role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
select pg_temp.ok((select count(*) from familia_convites) = 0, 'Bia não vê convites da Cris');
select pg_temp.falha($$select conceder_passe(auth.uid(), 'x')$$, 'usuária não concede Passe a si mesma');
reset role;
-- presente pago pelo webhook e resgatado pela Bia
insert into presentes (codigo, token, comprador_nome, comprador_email, valor, status, mensagem) values ('PRES123456', 'tok1', 'Vó Lu', 'lu@ex.com', 89.90, 'pago', 'Com amor');
insert into presentes (codigo, token, comprador_nome, comprador_email, valor) values ('PEND123456', 'tok2', 'Tio', 'tio@ex.com', 89.90);
set role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
select pg_temp.ok((select resgatar_presente('pend1-23456')->>'motivo') = 'nao_pago', 'presente não pago não resgata');
select pg_temp.ok((select resgatar_presente('pres1-23456')->>'de') = 'Vó Lu', 'presente pago resgatado');
select pg_temp.ok((select resgatar_presente('PRES123456')->>'motivo') = 'usado', 'presente só resgata uma vez');
reset role;
-- Passe Gestação (webhook): vai até DPP + 90 dias e é idempotente
select conceder_passe('33333333-3333-3333-3333-333333333333', 'mp:1') is not null;
select conceder_passe('33333333-3333-3333-3333-333333333333', 'mp:1') is not null;
select pg_temp.ok((select count(*) from concessoes where ref = 'mp:1') = 1, 'pagamento repetido não duplica o Passe');
select pg_temp.ok((select fim::date from concessoes where ref = 'mp:1') = current_date - 70 + 280 + 90, 'Passe vale até DPP + 90 dias');
select encerrar_concessao('passe', 'mp:1') is null;
select pg_temp.ok((select fim <= greatest(inicio + interval '1 second', now()) from concessoes where ref = 'mp:1'), 'estorno encerra o Passe');

-- ===== v2.2: recursos liberados no painel, desfecho, recados, painel =====
insert into auth.users (id, email, raw_user_meta_data) values ('44444444-4444-4444-4444-444444444444', 'dani@ex.com', '{"nome_completo":"Dani Rocha"}');
set role authenticated;
select set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', false);
insert into gestacoes (id, metodo_ig, dum) values ('dddddddd-0000-0000-0000-000000000001', 'dum', current_date - 100);
select pg_temp.falha($$insert into notas (gestacao_id, texto) values ('dddddddd-0000-0000-0000-000000000001', 'x')$$, 'notas exigem Plus');
reset role;
select admin_config_salvar(null, '{"recursos":{"notas":"free"}}') is not null;
set role authenticated;
select set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', false);
insert into notas (gestacao_id, texto) values ('dddddddd-0000-0000-0000-000000000001', 'pergunta');
select pg_temp.ok((select count(*) from notas) = 1, 'recurso liberado no painel vale no banco');
select pg_temp.falha($$insert into exames (gestacao_id, codigo, data) values ('dddddddd-0000-0000-0000-000000000001', 'hemograma', current_date)$$, 'outros recursos continuam no Plus');
select pg_temp.falha($$update gestacoes set desfecho = '{"tipo":"outro","data":"2026-01-01"}'$$, 'desfecho com tipo inválido');
update gestacoes set desfecho = jsonb_build_object('tipo', 'perda', 'data', current_date::text, 'semana', 14);
select pg_temp.ok((select desfecho->>'tipo' from gestacoes) = 'perda', 'gestante registra o desfecho');
select pg_temp.falha($$update app_config set dados = '{}'$$, 'usuária não altera a configuração');
select pg_temp.ok((select count(*) from app_config) = 1, 'usuária lê a configuração');
insert into familia_convites (nome, papel) values ('Rafa', 'parceria');
select pg_temp.falha($$insert into familia_convites (nome, papel) values ('X', 'chefe')$$, 'papel do convite validado');
select pg_temp.falha($$insert into familia_recados (user_id, convite_id, autor, texto) select user_id, id, 'eu', 'oi' from familia_convites$$, 'gestante não cria recado em nome da família');
select pg_temp.falha($$select admin_resumo()$$, 'usuária não acessa o resumo do painel');
select pg_temp.falha($$select admin_conceder(auth.uid(), 30)$$, 'usuária não se concede Plus pelo painel');
reset role;
insert into familia_recados (user_id, convite_id, autor, texto) select user_id, id, 'Rafa', 'Estou com você' from familia_convites where nome = 'Rafa';
set role authenticated;
select set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', false);
update familia_recados set lido_em = now(), texto = 'alterado';
select pg_temp.ok((select texto from familia_recados) = 'Estou com você' and (select lido_em is not null from familia_recados), 'recado marcado como lido sem ser reescrito');
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
select pg_temp.ok((select count(*) from familia_recados) = 0, 'outra usuária não vê os recados');
reset role;
select pg_temp.ok((admin_resumo()->>'contas')::int >= 4 and (admin_resumo()->'fases'->>'perda')::int = 1, 'resumo do painel conta contas e fases');
select pg_temp.ok((admin_contas('dani', 'todas', 10, 0)->>'total')::int = 1, 'busca de contas por e-mail');
select admin_conceder('44444444-4444-4444-4444-444444444444', 30) is not null;
select pg_temp.ok((admin_contas('dani', 'plus', 10, 0)->>'total')::int = 1, 'Plus concedido pelo painel');
select admin_encerrar((select id from concessoes where user_id = '44444444-4444-4444-4444-444444444444' and origem = 'manual'));
select pg_temp.ok((admin_contas('dani', 'plus', 10, 0)->>'total')::int = 0, 'concessão encerrada pelo painel');
select admin_definir('44444444-4444-4444-4444-444444444444', true);
select pg_temp.ok(admin_eh('44444444-4444-4444-4444-444444444444'), 'administradora definida');
select pg_temp.falha($$select admin_definir('44444444-4444-4444-4444-444444444444', false)$$, 'não remove a última administradora');
select admin_config_salvar(null, '{"recursos":{}}') is not null;

-- ===== Passe: preço protegido e acesso que acompanha a DPP =====
insert into auth.users (id, email, raw_user_meta_data) values ('55555555-5555-5555-5555-555555555555', 'eva@ex.com', '{"nome_completo":"Eva Lima"}');
set role authenticated;
select set_config('request.jwt.claim.sub', '55555555-5555-5555-5555-555555555555', false);
insert into gestacoes (id, metodo_ig, dum) values ('eeeeeeee-0000-0000-0000-000000000001', 'dum', current_date - 105);   -- 15 semanas
select pg_temp.ok((select dpp_original from gestacoes) = current_date - 105 + 280, 'DPP da 1ª datação fica registrada');
update gestacoes set dum = current_date - 210, dpp_original = '2000-01-01';                                            -- "vira" 30 semanas
select pg_temp.ok((select dpp_original from gestacoes) = current_date - 105 + 280, 'usuária não altera a DPP original');
reset role;
select pg_temp.ok(not privado.eh_reta_final('55555555-5555-5555-5555-555555555555'), 'adiantar a datação não dá o preço do Reta Final');
update gestacoes set dum = current_date - 105 where user_id = '55555555-5555-5555-5555-555555555555';
select conceder_passe('55555555-5555-5555-5555-555555555555', 'mp:teste-1') is not null;
select pg_temp.ok((select fim::date from concessoes where ref = 'mp:teste-1') = current_date - 105 + 280 + 90, 'Passe vale até DPP + 90 dias');
update gestacoes set dum = current_date - 84 where user_id = '55555555-5555-5555-5555-555555555555';                -- ultrassom atrasa 3 semanas
select pg_temp.ok((select fim::date from concessoes where ref = 'mp:teste-1') = current_date - 84 + 280 + 90, 'DPP corrigida: o acesso acompanha');
select conceder_passe('55555555-5555-5555-5555-555555555555', 'mp:teste-2', true) is not null;
select pg_temp.ok((select teto = inicio + interval '12 weeks' + interval '90 days' from concessoes where ref = 'mp:teste-2'), 'Reta Final tem teto de 12 semanas + 90 dias');
update gestacoes set dum = current_date - 20 where user_id = '55555555-5555-5555-5555-555555555555';                -- tenta "voltar" a gestação
select pg_temp.ok((select fim from concessoes where ref = 'mp:teste-2') <= (select teto from concessoes where ref = 'mp:teste-2'), 'voltar a DPP não passa do teto do Reta Final');
select pg_temp.ok((select bool_and(fim > inicio) from concessoes where user_id = '55555555-5555-5555-5555-555555555555'), 'concessões continuam válidas depois do ajuste');

-- ===== anônimo =====
set role anon;
select pg_temp.ok((select count(*) from app_config) = 1, 'anônimo lê a configuração pública');
select pg_temp.falha($$select count(*) from profiles$$, 'anônimo sem acesso');
reset role;

-- exclusão da conta apaga tudo em cascata
delete from auth.users where id = '11111111-1111-1111-1111-111111111111';
select pg_temp.ok((select count(*) from gestacoes where user_id='11111111-1111-1111-1111-111111111111') + (select count(*) from consultas) + (select count(*) from exames) + (select count(*) from consentimentos where user_id='11111111-1111-1111-1111-111111111111') = 0, 'excluir conta remove todos os dados');
\echo 'TODOS OS TESTES DO BANCO PASSARAM'
