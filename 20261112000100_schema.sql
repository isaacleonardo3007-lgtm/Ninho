-- =====================================================================
-- NINHO — Esquema do banco (Supabase / PostgreSQL 15+)
-- Tudo que é dado de saúde fica em tabelas com RLS por usuária.
-- Convenções:
--   * id uuid gerado no aparelho (permite uso offline e sincronização)
--   * user_id preenchido automaticamente com auth.uid()
--   * updated_at mantido pelo servidor (base da sincronização incremental)
--   * deleted_at = exclusão lógica (propaga a exclusão entre aparelhos)
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- utilitário: updated_at sempre do servidor ----------
create or replace function public.tg_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  if tg_op = 'UPDATE' then
    new.created_at := old.created_at;      -- imutável
    new.user_id    := old.user_id;         -- dona não muda
  end if;
  return new;
end $$;

-- =====================================================================
-- IDENTIFICAÇÃO DA GESTANTE (campos da Caderneta 2026 — "Identificação")
-- =====================================================================
create table public.profiles (
  id                          uuid primary key references auth.users(id) on delete cascade,
  user_id                     uuid generated always as (id) stored,
  nome_completo               text not null check (char_length(btrim(nome_completo)) between 2 and 160),
  nome_social                 text check (char_length(nome_social) <= 160),
  data_nascimento             date check (data_nascimento between date '1920-01-01' and current_date),
  telefone                    text check (telefone ~ '^\+?[0-9]{10,14}$'),
  cpf                         text check (cpf ~ '^[0-9]{11}$'),           -- opcional
  cns                         text check (cns ~ '^[0-9]{15}$'),           -- Cartão Nacional de Saúde, opcional
  raca_cor                    text check (raca_cor in ('branca','preta','parda','amarela','indigena','nao_informar')),
  escolaridade                text,
  ocupacao                    text,
  estado_civil                text,
  municipio                   text,
  uf                          char(2) check (uf ~ '^[A-Z]{2}$'),
  ubs_referencia              text,
  maternidade_referencia      text,
  contato_emergencia_nome     text,
  contato_emergencia_tel      text,
  contato_emergencia_relacao  text,
  tipo_sanguineo              text check (tipo_sanguineo in ('A+','A-','B+','B-','AB+','AB-','O+','O-')),
  doenca_falciforme           text check (doenca_falciforme in ('sim','nao','nao_sei')),
  deficiencia                 text,
  alergias                    text[] not null default '{}',
  condicoes                   text[] not null default '{}',
  medicamentos_uso            text[] not null default '{}',
  preferencias                jsonb  not null default '{}'::jsonb,   -- notificações, privacidade, monitores ativos
  gamificacao                 jsonb  not null default '{}'::jsonb,   -- gotas, conquistas, missões
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);
comment on table public.profiles is 'Identificação da gestante (Caderneta Brasileira da Gestante, 2026). Dado pessoal sensível (LGPD art. 5º, II).';

create or replace function public.tg_profiles_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); new.created_at := old.created_at; return new; end $$;
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.tg_profiles_updated_at();

-- =====================================================================
-- GESTAÇÃO
-- =====================================================================
create table public.gestacoes (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  ativa           boolean not null default true,
  nome_bebe       text check (char_length(nome_bebe) <= 80),
  metodo_ig       text not null check (metodo_ig in ('usg','dum','dpp')),
  dum             date,
  usg_data        date,
  usg_ig_semanas  smallint check (usg_ig_semanas between 4 and 42),
  usg_ig_dias     smallint check (usg_ig_dias between 0 and 6),
  dpp_informada   date,
  dpp             date,                                   -- calculada (cache p/ relatórios e lembretes)
  tipo_gravidez   text not null default 'unica' check (tipo_gravidez in ('unica','gemelar','tripla_mais')),
  planejada       boolean,
  gesta           smallint check (gesta between 0 and 30),
  para            smallint check (para between 0 and 30),
  abortos         smallint check (abortos between 0 and 30),
  risco           text not null default 'habitual' check (risco in ('habitual','alto')),
  altura_cm       numeric(4,1) check (altura_cm between 120 and 220),
  peso_pre_kg     numeric(5,2) check (peso_pre_kg between 30 and 250),
  antecedentes    jsonb not null default '{}'::jsonb,
  plano_parto     jsonb not null default '{}'::jsonb,
  desfecho        jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,
  constraint metodo_ig_completo check (
       (metodo_ig = 'dum' and dum is not null)
    or (metodo_ig = 'usg' and usg_data is not null and usg_ig_semanas is not null)
    or (metodo_ig = 'dpp' and dpp_informada is not null)),
  constraint datas_nao_futuras check (
    (dum is null or dum <= current_date + 1) and (usg_data is null or usg_data <= current_date + 1))
);
create unique index gestacoes_uma_ativa on public.gestacoes(user_id) where ativa and deleted_at is null;
create index gestacoes_sync on public.gestacoes(user_id, updated_at);
create trigger gestacoes_updated_at before insert or update on public.gestacoes
  for each row execute function public.tg_set_updated_at();

-- =====================================================================
-- Tabelas de registros (filhas da gestação). Macro manual: mesmas colunas
-- de controle em todas.
-- =====================================================================

-- CONSULTAS — colunas da tabela "Consulta pré-natal" da Caderneta (GRÁTIS)
create table public.consultas (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null default auth.uid() references auth.users(id) on delete cascade,
  gestacao_id        uuid not null references public.gestacoes(id) on delete cascade,
  data               date not null,
  ig_semanas         smallint check (ig_semanas between 0 and 44),
  ig_dias            smallint check (ig_dias between 0 and 6),
  local              text,
  profissional       text,
  pa_sis             smallint check (pa_sis between 50 and 260),
  pa_dia             smallint check (pa_dia between 30 and 180),
  peso_kg            numeric(5,2) check (peso_kg between 30 and 250),
  altura_uterina_cm  numeric(4,1) check (altura_uterina_cm between 5 and 60),
  bcf_bpm            smallint check (bcf_bpm between 50 and 240),
  movimentos_fetais  text check (movimentos_fetais in ('presentes','diminuidos','ausentes','nao_avaliado')),
  apresentacao       text check (apresentacao in ('cefalica','pelvica','transversa','nao_avaliada')),
  edema              text check (edema in ('ausente','+','++','+++')),
  queixas_urinarias  boolean,
  perdas_vaginais    boolean,
  observacoes        text check (char_length(observacoes) <= 4000),
  proxima_consulta   date,
  constraint pa_coerente check (pa_sis is null or pa_dia is null or pa_sis > pa_dia),
  constraint pa_completa check ((pa_sis is null) = (pa_dia is null)),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  deleted_at         timestamptz
);

-- VACINAS (GRÁTIS)
create table public.vacinas (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  gestacao_id     uuid not null references public.gestacoes(id) on delete cascade,
  codigo          text not null check (codigo in ('dtpa','dt','hepb','influenza','covid','vsr','febre_amarela','outra')),
  dose            smallint not null default 1 check (dose between 1 and 5),
  data_aplicacao  date,
  lote            text,
  local           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

-- CONTAGEM DE MOVIMENTOS (GRÁTIS — recurso de segurança)
create table public.movimentos (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  gestacao_id   uuid not null references public.gestacoes(id) on delete cascade,
  inicio        timestamptz not null,
  duracao_min   integer not null check (duracao_min between 0 and 1440),
  contagem      integer not null check (contagem between 0 and 500),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

-- EXAMES (PLUS)
create table public.exames (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  gestacao_id   uuid not null references public.gestacoes(id) on delete cascade,
  data          date not null,
  codigo        text not null,                 -- catálogo em js/clinical.js (EXAMES)
  nome          text,
  valor_num     numeric,
  valor_txt     text check (char_length(valor_txt) <= 500),
  unidade       text,
  arquivo_path  text,                          -- storage: ninho/<user_id>/...
  observacoes   text check (char_length(observacoes) <= 4000),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz,
  constraint exame_tem_resultado check (valor_num is not null or nullif(btrim(valor_txt),'') is not null or arquivo_path is not null)
);

-- ULTRASSONS (PLUS) — campos do "Registro de ultrassonografia" da Caderneta
create table public.ultrassons (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  gestacao_id     uuid not null references public.gestacoes(id) on delete cascade,
  data            date not null,
  tipo            text,
  ig_usg_semanas  smallint check (ig_usg_semanas between 4 and 44),
  ig_usg_dias     smallint check (ig_usg_dias between 0 and 6),
  bcf_bpm         smallint check (bcf_bpm between 50 and 240),
  peso_fetal_g    integer check (peso_fetal_g between 1 and 7000),
  percentil       numeric(5,2) check (percentil between 0 and 100),
  placenta        text,
  liquido         text,
  observacoes     text check (char_length(observacoes) <= 4000),
  arquivo_path    text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

-- MONITORES PERSONALIZADOS (PLUS)
create table public.monitores (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  gestacao_id   uuid not null references public.gestacoes(id) on delete cascade,
  nome          text not null check (char_length(nome) between 1 and 60),
  unidade       text,
  minimo        numeric,
  maximo        numeric,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

-- MEDIÇÕES EM CASA (PLUS)
create table public.medicoes (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  gestacao_id   uuid not null references public.gestacoes(id) on delete cascade,
  tipo          text not null check (tipo in ('pressao','glicemia','peso','temperatura','custom')),
  monitor_id    uuid references public.monitores(id) on delete cascade,
  medido_em     timestamptz not null,
  sis           smallint check (sis between 50 and 260),
  dia           smallint check (dia between 30 and 180),
  valor         numeric,
  momento       text,
  nota          text check (char_length(nota) <= 500),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz,
  constraint medicao_valida check (
       (tipo = 'pressao' and sis is not null and dia is not null)
    or (tipo <> 'pressao' and valor is not null)),
  constraint pa_coerente check (sis is null or dia is null or sis > dia),
  constraint custom_tem_monitor check (tipo <> 'custom' or monitor_id is not null)
);

-- SINTOMAS (PLUS)
create table public.sintomas (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  gestacao_id    uuid not null references public.gestacoes(id) on delete cascade,
  registrado_em  timestamptz not null,
  nome           text not null,
  emoji          text,
  intensidade    smallint check (intensidade between 0 and 3),
  nota           text check (char_length(nota) <= 1000),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz
);

create or replace function public.horarios_validos(h text[])
returns boolean language sql immutable as $$
  select coalesce(bool_and(x ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'), true) from unnest(h) x;
$$;

-- MEDICAMENTOS COM LEMBRETE (PLUS)
create table public.medicamentos (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  gestacao_id   uuid not null references public.gestacoes(id) on delete cascade,
  nome          text not null check (char_length(nome) between 1 and 120),
  dose          text,
  horarios      text[] not null default '{}' check (public.horarios_validos(horarios)),
  ativo         boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

create table public.doses (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  gestacao_id     uuid not null references public.gestacoes(id) on delete cascade,
  medicamento_id  uuid not null references public.medicamentos(id) on delete cascade,
  data            date not null,
  horario         text not null check (horario ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  tomada          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,
  unique (medicamento_id, data, horario)
);

-- ANOTAÇÕES PARA A CONSULTA (PLUS)
create table public.notas (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  gestacao_id   uuid not null references public.gestacoes(id) on delete cascade,
  texto         text not null check (char_length(texto) between 1 and 1000),
  resolvida     boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

-- DIÁRIO DE MEMÓRIAS (PLUS)
create table public.memorias (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  gestacao_id   uuid not null references public.gestacoes(id) on delete cascade,
  tipo          text not null default 'momento' check (tipo in ('foto','momento')),
  titulo        text check (char_length(titulo) <= 120),
  semana        smallint check (semana between 0 and 44),
  texto         text check (char_length(texto) <= 2000),
  arquivo_path  text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

-- índices de sincronização + triggers de updated_at para todas as tabelas filhas
do $$
declare t text;
begin
  foreach t in array array['consultas','vacinas','movimentos','exames','ultrassons','monitores','medicoes',
                           'sintomas','medicamentos','doses','notas','memorias'] loop
    execute format('create index %I on public.%I(user_id, updated_at)', t || '_sync', t);
    execute format('create index %I on public.%I(gestacao_id)', t || '_gest', t);
    execute format('create trigger %I before insert or update on public.%I for each row execute function public.tg_set_updated_at()', t || '_updated_at', t);
  end loop;
end $$;

-- =====================================================================
-- CONSENTIMENTOS (LGPD art. 7º e 11) — trilha imutável
-- =====================================================================
create table public.consentimentos (
  id             bigint generated always as identity primary key,
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  tipo           text not null check (tipo in ('termos','privacidade','dados_saude','notificacoes','pesquisa')),
  versao         text not null,
  aceito         boolean not null,
  registrado_em  timestamptz not null default now(),
  origem         text            -- 'cadastro' | 'configuracoes'
);
create index consentimentos_user on public.consentimentos(user_id, tipo, registrado_em desc);

create or replace view public.consentimentos_vigentes with (security_invoker = true) as
  select distinct on (user_id, tipo) user_id, tipo, versao, aceito, registrado_em
  from public.consentimentos order by user_id, tipo, registrado_em desc;

-- =====================================================================
-- ASSINATURA (Grátis x Plus) — escrita só pelo servidor (webhook)
-- =====================================================================
create table public.assinaturas (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  plano         text not null default 'free' check (plano in ('free','plus')),
  status        text not null default 'active' check (status in ('active','trialing','past_due','canceled','expired')),
  ciclo         text check (ciclo in ('mensal','anual')),
  provedor      text,               -- 'mercadopago' | 'stripe' | 'manual'
  provedor_ref  text,
  periodo_fim   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger assinaturas_updated_at before update on public.assinaturas
  for each row execute function public.tg_profiles_updated_at();

create table public.pagamentos_eventos (     -- idempotência dos webhooks
  id           text primary key,
  provedor     text not null,
  payload      jsonb not null,
  recebido_em  timestamptz not null default now()
);

-- interna (service_role / outras funções): plano ativo de qualquer usuária
create or replace function public.plano_ativo(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.assinaturas a
    where a.user_id = uid and a.plano = 'plus'
      and a.status in ('active','trialing','past_due')
      and (a.periodo_fim is null or a.periodo_fim > now()));
$$;
-- pública: só da usuária logada (não permite consultar o plano de outras)
create or replace function public.is_plus()
returns boolean language sql stable security definer set search_path = public as $$
  select public.plano_ativo(auth.uid());
$$;

create or replace function public.meu_plano()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'plano', case when public.is_plus() then 'plus' else 'free' end,
    'status', coalesce(a.status, 'active'), 'ciclo', a.ciclo, 'periodo_fim', a.periodo_fim)
  from (select 1) x left join public.assinaturas a on a.user_id = auth.uid();
$$;

-- =====================================================================
-- NOTIFICAÇÕES
-- =====================================================================
create table public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  created_at  timestamptz not null default now()
);

-- fila de lembretes: o app grava os próximos dias; a Edge Function
-- send-reminders (pg_cron a cada 5 min) envia por Web Push.
create table public.lembretes (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  chave        text not null,                 -- ex.: 'med:<id>:2026-11-12T08:00'
  tipo         text not null,
  enviar_em    timestamptz not null,
  titulo       text not null check (char_length(titulo) <= 80),
  corpo        text not null check (char_length(corpo) <= 200),
  url          text default '/',
  enviado_em   timestamptz,
  tentativas   smallint not null default 0,
  created_at   timestamptz not null default now(),
  unique (user_id, chave)
);
create index lembretes_pendentes on public.lembretes(enviar_em) where enviado_em is null;

-- =====================================================================
-- Novo usuário: cria perfil, assinatura grátis e grava consentimentos
-- (dados vêm de options.data no supabase.auth.signUp)
-- =====================================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb); c jsonb;
begin
  insert into public.profiles (id, nome_completo, data_nascimento, telefone)
  values (new.id,
          coalesce(nullif(btrim(m->>'nome_completo'), ''), split_part(new.email, '@', 1)),
          nullif(m->>'data_nascimento', '')::date,
          nullif(regexp_replace(coalesce(m->>'telefone', ''), '[^0-9+]', '', 'g'), ''))
  on conflict (id) do nothing;

  insert into public.assinaturas (user_id) values (new.id) on conflict do nothing;

  for c in select * from jsonb_array_elements(coalesce(m->'consentimentos', '[]'::jsonb)) loop
    insert into public.consentimentos (user_id, tipo, versao, aceito, origem)
    values (new.id, c->>'tipo', coalesce(c->>'versao', '1'), coalesce((c->>'aceito')::boolean, false), 'cadastro');
  end loop;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- limpeza: lembretes enviados há mais de 30 dias (chamar via pg_cron diário)
create or replace function public.limpar_lembretes()
returns void language sql security definer set search_path = public as $$
  delete from public.lembretes where enviado_em < now() - interval '30 days'
     or (enviado_em is null and enviar_em < now() - interval '2 days');
$$;
