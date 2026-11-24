-- =====================================================================
-- NINHO v2.2 — painel de administração, configuração editável sem código,
-- recados da família e desfecho da gestação (nascimento ou perda).
-- =====================================================================

-- ---------- configuração do app (lida por todos, editada só pelo painel) ----------
create table public.app_config (
  id          smallint primary key default 1 check (id = 1),
  dados       jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  updated_by  uuid
);
insert into public.app_config (dados) values (jsonb_build_object(
  'precos', jsonb_build_object('passe', 89.90, 'reta_final', 59.90, 'mensal', 14.90),
  'reta_final_desde', 28,          -- semana a partir da qual vale o Passe Reta Final
  'teste_dias', 7,
  'indicacao_dias', 30,
  'aviso', null,                   -- faixa de aviso no topo do app (texto curto) ou null
  'recursos', '{}'::jsonb          -- sobrescreve RECURSOS do config.js: { "exames": "free" }
)) on conflict do nothing;
alter table public.app_config enable row level security;
create policy app_config_ler on public.app_config for select to anon, authenticated using (true);
revoke insert, update, delete on public.app_config from anon, authenticated;
grant select on public.app_config to anon, authenticated;

-- ---------- administradoras ----------
create table privado.admins (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now()
);
create table privado.admin_log (
  id          bigserial primary key,
  admin_id    uuid,
  acao        text not null,
  alvo        uuid,
  detalhes    jsonb,
  created_at  timestamptz not null default now()
);
revoke all on privado.admins, privado.admin_log from public, anon, authenticated;

-- ---------- recurso liberado? (Plus ou recurso marcado como "free" no painel) ----------
create or replace function privado.pode(recurso text)
returns boolean language sql stable security definer set search_path = '' as $$
  select privado.is_plus()
      or coalesce((select c.dados -> 'recursos' ->> recurso from public.app_config c where c.id = 1), '') = 'free';
$$;
revoke execute on function privado.pode(text) from public, anon;
grant execute on function privado.pode(text) to authenticated;

-- As políticas das tabelas do Plus passam a consultar privado.pode(<recurso>),
-- para que liberar um recurso no painel valha também no banco.
do $$
declare t text; r text;
begin
  for t, r in values
    ('exames', 'exames'), ('ultrassons', 'ultrassons'), ('monitores', 'monitores'), ('medicoes', 'monitores'),
    ('sintomas', 'sintomas'), ('medicamentos', 'medicacao'), ('doses', 'medicacao'), ('notas', 'notas'), ('memorias', 'memorias')
  loop
    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (user_id = (select auth.uid()) and privado.gestacao_e_minha(gestacao_id) and privado.pode(%L))',
                   t || '_insert', t, r);
    execute format('create policy %I on public.%I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and privado.gestacao_e_minha(gestacao_id) and (privado.pode(%L) or deleted_at is not null))',
                   t || '_update', t, r);
  end loop;
end $$;

-- ---------- desfecho da gestação: nascimento ou perda ----------
-- gestacoes.desfecho (jsonb) já existe: { "tipo": "nascimento"|"perda", "data": "AAAA-MM-DD", ... }
alter table public.gestacoes drop constraint if exists desfecho_valido;
alter table public.gestacoes add constraint desfecho_valido check (
  desfecho is null or (
    desfecho ->> 'tipo' in ('nascimento', 'perda')
    and (desfecho ->> 'data') ~ '^\d{4}-\d{2}-\d{2}$'
    and pg_column_size(desfecho) < 4000));

-- ---------- família: papel de quem recebe o convite e recados ----------
alter table public.familia_convites add column if not exists papel text not null default 'familia'
  check (papel in ('parceria', 'avos', 'tios', 'irmaos', 'amigos', 'familia'));

create table public.familia_recados (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,     -- a gestante (dona do convite)
  convite_id  uuid not null references public.familia_convites(id) on delete cascade,
  autor       text not null check (char_length(autor) between 1 and 60),
  texto       text not null check (char_length(texto) between 1 and 500),
  lido_em     timestamptz,
  deleted_at  timestamptz,
  created_at  timestamptz not null default now()
);
create index familia_recados_user on public.familia_recados (user_id, created_at desc);
create index familia_recados_convite on public.familia_recados (convite_id);
alter table public.familia_recados enable row level security;
create policy recados_select on public.familia_recados for select to authenticated using (user_id = (select auth.uid()));
create policy recados_update on public.familia_recados for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy recados_delete on public.familia_recados for delete to authenticated using (user_id = (select auth.uid()));
revoke insert on public.familia_recados from anon, authenticated;    -- só a função "familia" (service_role) cria
revoke all on public.familia_recados from anon;
-- a gestante só marca como lido ou apaga; não reescreve o recado de outra pessoa
create or replace function privado.tg_recado_fixo()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.user_id := old.user_id; new.convite_id := old.convite_id; new.autor := old.autor;
  new.texto := old.texto; new.created_at := old.created_at; return new;
end $$;
create trigger familia_recado_fixo before update on public.familia_recados
  for each row execute function privado.tg_recado_fixo();

-- ---------- funções do painel (só service_role, chamadas pela função "admin") ----------
create or replace function public.admin_resumo()
returns jsonb language sql stable security definer set search_path = '' as $$
  with u as (select id, created_at from auth.users),
  ativos as (
    select a.user_id from public.assinaturas a
     where a.plano = 'plus' and a.status in ('active','trialing','past_due') and (a.periodo_fim is null or a.periodo_fim > now())
    union
    select c.user_id from public.concessoes c where c.inicio <= now() and c.fim > now()),
  pagantes as (
    select a.user_id from public.assinaturas a
     where a.plano = 'plus' and a.status in ('active','trialing','past_due') and (a.periodo_fim is null or a.periodo_fim > now())
    union
    select c.user_id from public.concessoes c where c.origem in ('passe','presente') and c.inicio <= now() and c.fim > now()),
  g as (select distinct on (user_id) user_id, desfecho, dpp from public.gestacoes where ativa and deleted_at is null order by user_id, created_at desc)
  select jsonb_build_object(
    'contas', (select count(*) from u),
    'novas_7d', (select count(*) from u where created_at > now() - interval '7 days'),
    'novas_30d', (select count(*) from u where created_at > now() - interval '30 days'),
    'plus_ativas', (select count(*) from ativos),
    'pagantes', (select count(*) from pagantes),
    'gratuitas', (select count(*) from u) - (select count(*) from ativos),
    'por_origem', (select coalesce(jsonb_object_agg(origem, n), '{}'::jsonb) from (
        select c.origem, count(distinct c.user_id) n from public.concessoes c where c.inicio <= now() and c.fim > now() group by c.origem) x),
    'assinaturas_mensais', (select count(*) from public.assinaturas a where a.plano = 'plus' and a.status in ('active','trialing','past_due')),
    'passes_vendidos', (select count(*) from public.concessoes c where c.origem = 'passe'),
    'presentes_pagos', (select count(*) from public.concessoes c where c.origem = 'presente'),
    'testes_iniciados', (select count(*) from public.concessoes c where c.origem = 'teste'),
    'indicacoes', (select count(*) from public.indicacoes),
    'funil', jsonb_build_object(
        'cadastradas', (select count(*) from u),
        'com_gestacao', (select count(*) from g),
        'com_consulta', (select count(distinct user_id) from public.consultas where deleted_at is null),
        'testaram', (select count(*) from public.concessoes c where c.origem = 'teste'),
        'pagaram', (select count(distinct user_id) from public.concessoes c where c.origem in ('passe','presente'))
                 + (select count(*) from public.assinaturas a where a.provedor is not null and a.plano = 'plus')),
    'fases', jsonb_build_object(
        'gestando', (select count(*) from g where g.desfecho is null),
        'puerperio', (select count(*) from g where g.desfecho ->> 'tipo' = 'nascimento'),
        'perda', (select count(*) from g where g.desfecho ->> 'tipo' = 'perda')),
    'cadastros_dia', (select coalesce(jsonb_agg(jsonb_build_object('dia', d::date, 'n', (select count(*) from u where u.created_at::date = d::date)) order by d), '[]'::jsonb)
        from generate_series(current_date - 29, current_date, interval '1 day') d),
    'convites_familia', (select count(*) from public.familia_convites f where f.revogado_em is null),
    'interesse_app_bebe', (select count(*) from public.profiles p where (p.preferencias -> 'puerperio' ->> 'app_bebe') = 'true'),
    'atualizado_em', now());
$$;

create or replace function public.admin_contas(p_busca text default '', p_filtro text default 'todas', p_limite int default 50, p_offset int default 0)
returns jsonb language sql stable security definer set search_path = '' as $$
  with base as (
    select u.id, u.email, u.created_at, u.last_sign_in_at, u.email_confirmed_at,
           coalesce(p.nome_social, p.nome_completo) as nome,
           privado.plano_ativo(u.id) as plus,
           (select max(c.fim) from public.concessoes c where c.user_id = u.id and c.fim > now()) as acesso_ate,
           (select c.origem from public.concessoes c where c.user_id = u.id and c.inicio <= now() and c.fim > now() order by c.fim desc limit 1) as origem,
           (select a.status from public.assinaturas a where a.user_id = u.id and a.plano = 'plus') as assinatura,
           (select g.desfecho ->> 'tipo' from public.gestacoes g where g.user_id = u.id and g.ativa and g.deleted_at is null order by g.created_at desc limit 1) as desfecho,
           privado.dpp_atual(u.id) as dpp,
           exists (select 1 from privado.admins ad where ad.user_id = u.id) as admin
      from auth.users u left join public.profiles p on p.id = u.id
     where coalesce(p_busca, '') = ''
        or u.email ilike '%' || p_busca || '%'
        or coalesce(p.nome_completo, '') ilike '%' || p_busca || '%'
        or coalesce(p.nome_social, '') ilike '%' || p_busca || '%'),
  f as (
    select * from base where case p_filtro
      when 'plus' then plus when 'gratis' then not plus
      when 'perda' then desfecho = 'perda' when 'puerperio' then desfecho = 'nascimento'
      when 'admin' then admin else true end)
  select jsonb_build_object(
    'total', (select count(*) from f),
    'contas', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (
        select * from f order by created_at desc limit least(greatest(p_limite, 1), 200) offset greatest(p_offset, 0)) x), '[]'::jsonb));
$$;

create or replace function public.admin_concessoes(uid uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'origem', c.origem, 'inicio', c.inicio, 'fim', c.fim, 'ref', c.ref) order by c.inicio desc), '[]'::jsonb)
  from public.concessoes c where c.user_id = uid;
$$;

create or replace function public.admin_conceder(uid uuid, p_dias int)
returns timestamptz language sql security definer set search_path = '' as $$
  select privado.conceder(uid, 'manual', null, greatest(1, least(p_dias, 3650)));
$$;

create or replace function public.admin_encerrar(p_id uuid)
returns void language sql security definer set search_path = '' as $$
  update public.concessoes set inicio = least(inicio, now() - interval '1 second'), fim = now() where id = p_id and fim > now();
$$;

create or replace function public.admin_eh(uid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from privado.admins a where a.user_id = uid);
$$;

create or replace function public.admin_definir(uid uuid, p_admin boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_admin then insert into privado.admins (user_id) values (uid) on conflict do nothing;
  else
    if (select count(*) from privado.admins) <= 1 and exists (select 1 from privado.admins where user_id = uid) then
      raise exception 'precisa existir pelo menos uma administradora';
    end if;
    delete from privado.admins where user_id = uid;
  end if;
end $$;

create or replace function public.admin_registrar(p_admin uuid, p_acao text, p_alvo uuid, p_detalhes jsonb)
returns void language sql security definer set search_path = '' as $$
  insert into privado.admin_log (admin_id, acao, alvo, detalhes) values (p_admin, p_acao, p_alvo, p_detalhes);
$$;

create or replace function public.admin_historico(p_limite int default 100)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc), '[]'::jsonb) from (
    select l.id, l.acao, l.alvo, l.detalhes, l.created_at, u.email as admin_email, t.email as alvo_email
      from privado.admin_log l left join auth.users u on u.id = l.admin_id left join auth.users t on t.id = l.alvo
     order by l.created_at desc limit least(greatest(p_limite, 1), 500)) x;
$$;

create or replace function public.admin_config_salvar(p_admin uuid, p_dados jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare novo jsonb;
begin
  if jsonb_typeof(p_dados) <> 'object' then raise exception 'configuração inválida'; end if;
  update public.app_config set dados = dados || p_dados, updated_at = now(), updated_by = p_admin where id = 1
    returning dados into novo;
  return novo;
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'admin_resumo()', 'admin_contas(text, text, int, int)', 'admin_concessoes(uuid)', 'admin_conceder(uuid, int)',
    'admin_encerrar(uuid)', 'admin_eh(uuid)', 'admin_definir(uuid, boolean)', 'admin_registrar(uuid, text, uuid, jsonb)',
    'admin_historico(int)', 'admin_config_salvar(uuid, jsonb)']
  loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;

-- DPP para a função de pagamento escolher entre Passe Gestação e Passe Reta Final
create or replace function public.dpp_atual_servico(uid uuid)
returns date language sql stable security definer set search_path = '' as $$ select privado.dpp_atual(uid); $$;
revoke execute on function public.dpp_atual_servico(uuid) from public, anon, authenticated;
grant execute on function public.dpp_atual_servico(uuid) to service_role;

-- prazos do teste grátis e do bônus de indicação vêm do painel (app_config)
create or replace function privado.cfg_int(chave text, padrao int)
returns int language sql stable security definer set search_path = '' as $$
  select coalesce((select (c.dados ->> chave)::int from public.app_config c where c.id = 1), padrao);
$$;
revoke execute on function privado.cfg_int(text, int) from public, anon, authenticated;

create or replace function public.iniciar_teste()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); f timestamptz; dias int := privado.cfg_int('teste_dias', 7);
begin
  if uid is null then raise exception 'não autenticada' using errcode = '42501'; end if;
  if dias < 1 then return jsonb_build_object('ok', false, 'motivo', 'indisponivel'); end if;
  if exists (select 1 from public.concessoes c where c.user_id = uid and c.origem = 'teste') then
    return jsonb_build_object('ok', false, 'motivo', 'usado'); end if;
  if privado.plano_ativo(uid) then return jsonb_build_object('ok', false, 'motivo', 'ja_plus'); end if;
  f := privado.conceder(uid, 'teste', null, dias);
  return jsonb_build_object('ok', true, 'ate', f);
end $$;

create or replace function public.usar_indicacao(p_codigo text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); cod text := upper(regexp_replace(coalesce(p_codigo, ''), '[^A-Za-z0-9]', '', 'g'));
        ind uuid; criada timestamptz; f timestamptz; premiadas int; dias int := greatest(privado.cfg_int('indicacao_dias', 30), 1);
begin
  if uid is null then raise exception 'não autenticada' using errcode = '42501'; end if;
  if exists (select 1 from public.indicacoes i where i.indicada_id = uid) then return jsonb_build_object('ok', false, 'motivo', 'ja_usou'); end if;
  select p.id into ind from public.profiles p where p.codigo_indicacao = cod;
  if ind is null then return jsonb_build_object('ok', false, 'motivo', 'invalido'); end if;
  if ind = uid then return jsonb_build_object('ok', false, 'motivo', 'proprio'); end if;
  select u.created_at into criada from auth.users u where u.id = uid;
  if criada < now() - interval '30 days' then return jsonb_build_object('ok', false, 'motivo', 'prazo'); end if;
  select count(*) into premiadas from public.indicacoes i where i.indicadora_id = ind and i.premiou_indicadora;
  insert into public.indicacoes (indicada_id, indicadora_id, codigo, premiou_indicadora) values (uid, ind, cod, premiadas < 12);
  f := privado.conceder(uid, 'indicacao', 'indicada:' || uid, dias);
  if premiadas < 12 then perform privado.conceder(ind, 'indicacao', 'indicou:' || uid, dias); end if;
  return jsonb_build_object('ok', true, 'ate', f);
end $$;
