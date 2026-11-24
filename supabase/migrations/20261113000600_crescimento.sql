-- =====================================================================
-- NINHO — crescimento: Passe Gestação, teste grátis, presente, indicação
-- e modo família.
--
-- Ideia central: além da assinatura recorrente (public.assinaturas), o
-- Ninho+ pode ser liberado por "concessões" com prazo (teste de 7 dias,
-- Passe Gestação, presente, indicação, cortesia manual). Concessões se
-- empilham: uma nova começa quando a anterior termina.
-- =====================================================================

-- ---------- concessões de Ninho+ com prazo ----------
create table public.concessoes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  origem      text not null check (origem in ('teste','passe','presente','indicacao','manual')),
  ref         text,                       -- id do pagamento, do presente ou da indicação (idempotência)
  inicio      timestamptz not null default now(),
  fim         timestamptz not null,
  created_at  timestamptz not null default now(),
  check (fim > inicio)
);
create index concessoes_user_fim on public.concessoes (user_id, fim);
create unique index concessoes_um_teste on public.concessoes (user_id) where origem = 'teste';
create unique index concessoes_ref_unica on public.concessoes (origem, ref) where ref is not null;
alter table public.concessoes enable row level security;
create policy concessoes_select on public.concessoes for select to authenticated using (user_id = (select auth.uid()));
revoke insert, update, delete on public.concessoes from anon, authenticated;

-- ---------- o plano é ativo se houver assinatura OU concessão vigente ----------
create or replace function privado.plano_ativo(uid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
      select 1 from public.assinaturas a
      where a.user_id = uid and a.plano = 'plus'
        and a.status in ('active','trialing','past_due')
        and (a.periodo_fim is null or a.periodo_fim > now()))
    or exists (
      select 1 from public.concessoes c
      where c.user_id = uid and c.inicio <= now() and c.fim > now());
$$;

-- DPP da gestação ativa (mesma regra do app: 1º USG, DPP informada ou DUM)
create or replace function privado.dpp_atual(uid uuid)
returns date language sql stable security definer set search_path = '' as $$
  select case g.metodo_ig
           when 'usg' then g.usg_data - (g.usg_ig_semanas * 7 + coalesce(g.usg_ig_dias, 0)) + 280
           when 'dpp' then g.dpp_informada
           else g.dum + 280 end
  from public.gestacoes g
  where g.user_id = uid and g.ativa and g.deleted_at is null
  order by g.created_at desc limit 1;
$$;

-- concede dias de Ninho+, empilhando depois do acesso já existente.
-- p_ate: data-alvo (ex.: DPP + 90 dias no Passe); p_dias: duração mínima.
create or replace function privado.conceder(uid uuid, p_origem text, p_ref text, p_dias int, p_ate timestamptz default null)
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare base timestamptz; f timestamptz; existente timestamptz;
begin
  if p_ref is not null then
    select c.fim into existente from public.concessoes c where c.origem = p_origem and c.ref = p_ref;
    if found then return existente; end if;                  -- já concedido (webhook repetido)
  end if;
  select greatest(now(), coalesce(max(c.fim), now())) into base
    from public.concessoes c where c.user_id = uid and c.fim > now();
  f := greatest(coalesce(p_ate, base), base + make_interval(days => p_dias));
  insert into public.concessoes (user_id, origem, ref, inicio, fim) values (uid, p_origem, p_ref, base, f)
    on conflict do nothing;
  return f;
end $$;
revoke execute on function privado.conceder(uuid, text, text, int, timestamptz) from public, anon, authenticated;
revoke execute on function privado.dpp_atual(uuid) from public, anon, authenticated;

-- usada só pelo webhook de pagamento (service_role): Passe Gestação pago
create or replace function public.conceder_passe(uid uuid, p_ref text)
returns timestamptz language sql security definer set search_path = '' as $$
  select privado.conceder(uid, 'passe', p_ref, 60,
           coalesce(privado.dpp_atual(uid) + 90, (now() + interval '300 days')::date)::timestamptz);
$$;
-- estorno / chargeback: encerra a concessão daquele pagamento
create or replace function public.encerrar_concessao(p_origem text, p_ref text)
returns void language sql security definer set search_path = '' as $$
  update public.concessoes set fim = greatest(inicio + interval '1 second', now())
  where origem = p_origem and ref = p_ref and fim > now();
$$;
revoke execute on function public.conceder_passe(uuid, text) from public, anon, authenticated;
revoke execute on function public.encerrar_concessao(text, text) from public, anon, authenticated;
grant execute on function public.conceder_passe(uuid, text) to service_role;
grant execute on function public.encerrar_concessao(text, text) to service_role;

-- ---------- teste grátis de 7 dias (uma vez por conta) ----------
create or replace function public.iniciar_teste()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); f timestamptz;
begin
  if uid is null then raise exception 'não autenticada' using errcode = '42501'; end if;
  if exists (select 1 from public.concessoes c where c.user_id = uid and c.origem = 'teste') then
    return jsonb_build_object('ok', false, 'motivo', 'usado'); end if;
  if privado.plano_ativo(uid) then return jsonb_build_object('ok', false, 'motivo', 'ja_plus'); end if;
  f := privado.conceder(uid, 'teste', null, 7);
  return jsonb_build_object('ok', true, 'ate', f);
end $$;
revoke execute on function public.iniciar_teste() from public, anon;
grant execute on function public.iniciar_teste() to authenticated;

-- ---------- indicação: código por usuária; as duas ganham 30 dias ----------
create or replace function privado.novo_codigo(n int)
returns text language plpgsql volatile set search_path = '' as $$
declare abc text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; s text := ''; i int;
begin
  for i in 1..n loop s := s || substr(abc, 1 + floor(random() * length(abc))::int, 1); end loop;
  return s;
end $$;

alter table public.profiles add column if not exists codigo_indicacao text unique;
create or replace function privado.tg_codigo_indicacao()
returns trigger language plpgsql security definer set search_path = '' as $$
declare c text;
begin
  if new.codigo_indicacao is null then
    loop
      c := privado.novo_codigo(6);
      exit when not exists (select 1 from public.profiles p where p.codigo_indicacao = c);
    end loop;
    new.codigo_indicacao := c;
  end if;
  return new;
end $$;
create trigger profiles_codigo_indicacao before insert on public.profiles
  for each row execute function privado.tg_codigo_indicacao();
-- contas que já existem
do $$ declare r record; c text; begin
  for r in select id from public.profiles where codigo_indicacao is null loop
    loop c := privado.novo_codigo(6); exit when not exists (select 1 from public.profiles where codigo_indicacao = c); end loop;
    update public.profiles set codigo_indicacao = c where id = r.id;
  end loop;
end $$;
-- a usuária não pode trocar o próprio código
create or replace function privado.tg_codigo_fixo()
returns trigger language plpgsql set search_path = '' as $$
begin new.codigo_indicacao := old.codigo_indicacao; return new; end $$;
create trigger profiles_codigo_fixo before update on public.profiles
  for each row execute function privado.tg_codigo_fixo();

create table public.indicacoes (
  indicada_id    uuid primary key references auth.users(id) on delete cascade,
  indicadora_id  uuid references auth.users(id) on delete set null,
  codigo         text not null,
  premiou_indicadora boolean not null default false,
  created_at     timestamptz not null default now()
);
create index indicacoes_indicadora on public.indicacoes (indicadora_id);
alter table public.indicacoes enable row level security;
create policy indicacoes_select on public.indicacoes for select to authenticated
  using (indicada_id = (select auth.uid()) or indicadora_id = (select auth.uid()));
revoke insert, update, delete on public.indicacoes from anon, authenticated;

create or replace function public.usar_indicacao(p_codigo text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); cod text := upper(regexp_replace(coalesce(p_codigo, ''), '[^A-Za-z0-9]', '', 'g'));
        ind uuid; criada timestamptz; f timestamptz; premiadas int;
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
  f := privado.conceder(uid, 'indicacao', 'indicada:' || uid, 30);
  if premiadas < 12 then perform privado.conceder(ind, 'indicacao', 'indicou:' || uid, 30); end if;
  return jsonb_build_object('ok', true, 'ate', f);
end $$;
revoke execute on function public.usar_indicacao(text) from public, anon;
grant execute on function public.usar_indicacao(text) to authenticated;

-- ---------- presente: alguém compra, a gestante resgata o código ----------
create table public.presentes (
  id              uuid primary key default gen_random_uuid(),
  codigo          text not null unique,
  token           text not null unique,              -- só o comprador conhece (página de retorno)
  comprador_nome  text not null check (char_length(comprador_nome) between 1 and 80),
  comprador_email text not null check (char_length(comprador_email) between 5 and 200),
  para_nome       text check (char_length(para_nome) <= 80),
  mensagem        text check (char_length(mensagem) <= 300),
  valor           numeric(10,2) not null check (valor > 0),
  status          text not null default 'pendente' check (status in ('pendente','pago','resgatado','cancelado')),
  provedor_ref    text,
  pago_em         timestamptz,
  resgatado_por   uuid references auth.users(id) on delete set null,
  resgatado_em    timestamptz,
  created_at      timestamptz not null default now()
);
alter table public.presentes enable row level security;     -- sem políticas: só service_role e a função de resgate
revoke all on public.presentes from anon, authenticated;

create or replace function public.resgatar_presente(p_codigo text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); cod text := upper(regexp_replace(coalesce(p_codigo, ''), '[^A-Za-z0-9]', '', 'g'));
        p public.presentes; f timestamptz;
begin
  if uid is null then raise exception 'não autenticada' using errcode = '42501'; end if;
  select * into p from public.presentes x where replace(x.codigo, '-', '') = cod for update;
  if not found then return jsonb_build_object('ok', false, 'motivo', 'invalido'); end if;
  if p.status = 'resgatado' then return jsonb_build_object('ok', false, 'motivo', 'usado'); end if;
  if p.status <> 'pago' then return jsonb_build_object('ok', false, 'motivo', 'nao_pago'); end if;
  update public.presentes set status = 'resgatado', resgatado_por = uid, resgatado_em = now() where id = p.id;
  f := privado.conceder(uid, 'presente', p.id::text, 60,
         coalesce(privado.dpp_atual(uid) + 90, (now() + interval '300 days')::date)::timestamptz);
  return jsonb_build_object('ok', true, 'ate', f, 'de', p.comprador_nome, 'mensagem', p.mensagem);
end $$;
revoke execute on function public.resgatar_presente(text) from public, anon;
grant execute on function public.resgatar_presente(text) to authenticated;

-- ---------- modo família: links de convite revogáveis ----------
create table public.familia_convites (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  token         text not null unique default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  nome          text not null check (char_length(nome) between 1 and 60),
  ver_fotos     boolean not null default false,
  revogado_em   timestamptz,
  ultimo_acesso timestamptz,
  created_at    timestamptz not null default now()
);
create index familia_convites_user on public.familia_convites (user_id);
alter table public.familia_convites enable row level security;
create policy fam_select on public.familia_convites for select to authenticated using (user_id = (select auth.uid()));
create or replace function privado.convites_ativos(uid uuid)
returns int language sql stable security definer set search_path = '' as $$
  select count(*)::int from public.familia_convites f where f.user_id = uid and f.revogado_em is null;
$$;
revoke execute on function privado.convites_ativos(uuid) from public, anon;
grant execute on function privado.convites_ativos(uuid) to authenticated;
create policy fam_insert on public.familia_convites for insert to authenticated
  with check (user_id = (select auth.uid()) and privado.convites_ativos((select auth.uid())) < 20);
create policy fam_update on public.familia_convites for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy fam_delete on public.familia_convites for delete to authenticated using (user_id = (select auth.uid()));
revoke all on public.familia_convites from anon;
-- o token não pode ser trocado pela usuária (só criado pelo banco)
create or replace function privado.tg_familia_token()
returns trigger language plpgsql set search_path = '' as $$
begin new.token := old.token; new.user_id := old.user_id; return new; end $$;
create trigger familia_token_fixo before update on public.familia_convites
  for each row execute function privado.tg_familia_token();

-- ---------- meu_plano: devolve também o que o app precisa para ofertas ----------
create or replace function public.meu_plano()
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'plano', case when privado.is_plus() then 'plus' else 'free' end,
    'status', coalesce(a.status, 'active'), 'ciclo', a.ciclo, 'periodo_fim', a.periodo_fim,
    'assinatura', coalesce(a.plano = 'plus' and a.status in ('active','trialing','past_due')
                           and (a.periodo_fim is null or a.periodo_fim > now()), false),
    'acesso_ate', (select max(c.fim) from public.concessoes c where c.user_id = auth.uid() and c.fim > now()),
    'origem', (select c.origem from public.concessoes c where c.user_id = auth.uid() and c.inicio <= now() and c.fim > now() order by c.fim desc limit 1),
    'teste_disponivel', not exists (select 1 from public.concessoes c where c.user_id = auth.uid() and c.origem = 'teste'),
    'codigo_indicacao', (select p.codigo_indicacao from public.profiles p where p.id = auth.uid()),
    'indicacao_usada', exists (select 1 from public.indicacoes i where i.indicada_id = auth.uid()),
    'indicadas', (select count(*) from public.indicacoes i where i.indicadora_id = auth.uid()))
  from (select 1) x left join public.assinaturas a on a.user_id = auth.uid();
$$;
revoke execute on function public.meu_plano() from public, anon;
grant execute on function public.meu_plano() to authenticated;
grant execute on function privado.dpp_atual(uuid) to service_role;

-- usada só pela função "familia" (service_role) para decidir se mostra fotos
create or replace function public.plano_ativo_servico(uid uuid)
returns boolean language sql stable security definer set search_path = '' as $$ select privado.plano_ativo(uid); $$;
revoke execute on function public.plano_ativo_servico(uuid) from public, anon, authenticated;
grant execute on function public.plano_ativo_servico(uuid) to service_role;
