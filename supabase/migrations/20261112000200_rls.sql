-- =====================================================================
-- NINHO — Row Level Security
-- Regra geral: cada usuária só enxerga e altera o que é dela.
-- Tabelas do plano Plus: leitura sempre (os dados continuam dela mesmo se
-- a assinatura acabar), mas criar/alterar exige public.is_plus().
-- =====================================================================

-- a gestação informada pertence à usuária logada?
create or replace function public.gestacao_e_minha(gid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.gestacoes g where g.id = gid and g.user_id = auth.uid());
$$;

-- ---------- profiles ----------
alter table public.profiles enable row level security;
create policy profiles_select on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy profiles_update on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy profiles_insert on public.profiles for insert to authenticated with check (id = (select auth.uid()));
-- exclusão do perfil só via exclusão da conta (Edge Function delete-account)

-- ---------- gestacoes ----------
alter table public.gestacoes enable row level security;
create policy gest_select on public.gestacoes for select to authenticated using (user_id = (select auth.uid()));
create policy gest_insert on public.gestacoes for insert to authenticated with check (user_id = (select auth.uid()));
create policy gest_update on public.gestacoes for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy gest_delete on public.gestacoes for delete to authenticated using (user_id = (select auth.uid()));

-- ---------- tabelas filhas ----------
do $$
declare t text; plus boolean;
begin
  for t, plus in values
    ('consultas', false), ('vacinas', false), ('movimentos', false),
    ('exames', true), ('ultrassons', true), ('monitores', true), ('medicoes', true),
    ('sintomas', true), ('medicamentos', true), ('doses', true), ('notas', true), ('memorias', true)
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to authenticated using (user_id = (select auth.uid()))', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (user_id = (select auth.uid()) and public.gestacao_e_minha(gestacao_id)%s)',
                   t || '_insert', t, case when plus then ' and public.is_plus()' else '' end);
    -- update: exclusão lógica (deleted_at) é sempre permitida, mesmo sem Plus
    execute format('create policy %I on public.%I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and public.gestacao_e_minha(gestacao_id)%s)',
                   t || '_update', t, case when plus then ' and (public.is_plus() or deleted_at is not null)' else '' end);
    execute format('create policy %I on public.%I for delete to authenticated using (user_id = (select auth.uid()))', t || '_delete', t);
  end loop;
end $$;

-- referências cruzadas também precisam ser da própria usuária
create or replace function public.tg_check_dose_ref()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.medicamentos m where m.id = new.medicamento_id and m.user_id = new.user_id) then
    raise exception 'medicamento não pertence à usuária' using errcode = '42501';
  end if;
  return new;
end $$;
create or replace function public.tg_check_monitor_ref()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.monitor_id is not null and not exists (select 1 from public.monitores m where m.id = new.monitor_id and m.user_id = new.user_id) then
    raise exception 'monitor não pertence à usuária' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger doses_refs before insert or update on public.doses for each row execute function public.tg_check_dose_ref();
create trigger medicoes_refs before insert or update on public.medicoes for each row execute function public.tg_check_monitor_ref();

-- ---------- consentimentos: só inserir e ler (trilha de auditoria) ----------
alter table public.consentimentos enable row level security;
create policy cons_select on public.consentimentos for select to authenticated using (user_id = (select auth.uid()));
create policy cons_insert on public.consentimentos for insert to authenticated with check (user_id = (select auth.uid()));
revoke update, delete on public.consentimentos from anon, authenticated;

-- ---------- assinaturas: só leitura pela usuária ----------
alter table public.assinaturas enable row level security;
create policy ass_select on public.assinaturas for select to authenticated using (user_id = (select auth.uid()));
revoke insert, update, delete on public.assinaturas from anon, authenticated;

alter table public.pagamentos_eventos enable row level security;   -- sem políticas: só service_role
revoke all on public.pagamentos_eventos from anon, authenticated;

-- ---------- push + lembretes ----------
alter table public.push_subscriptions enable row level security;
create policy push_all on public.push_subscriptions for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

alter table public.lembretes enable row level security;
create policy lem_select on public.lembretes for select to authenticated using (user_id = (select auth.uid()));
create policy lem_insert on public.lembretes for insert to authenticated with check (user_id = (select auth.uid()) and enviado_em is null);
create policy lem_update on public.lembretes for update to authenticated using (user_id = (select auth.uid()) and enviado_em is null) with check (user_id = (select auth.uid()) and enviado_em is null);
create policy lem_delete on public.lembretes for delete to authenticated using (user_id = (select auth.uid()));

-- anônimos não acessam nada
revoke all on all tables in schema public from anon;
grant execute on function public.meu_plano() to authenticated;
grant execute on function public.is_plus() to authenticated;
revoke execute on function public.plano_ativo(uuid) from public, anon, authenticated;
revoke execute on function public.limpar_lembretes() from public, anon, authenticated;
-- funções security definer: nada para anônimos
revoke execute on function public.meu_plano() from public, anon;
revoke execute on function public.is_plus() from public, anon;
revoke execute on function public.gestacao_e_minha(uuid) from public, anon;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.tg_check_dose_ref() from public, anon, authenticated;
revoke execute on function public.tg_check_monitor_ref() from public, anon, authenticated;
grant execute on function public.gestacao_e_minha(uuid) to authenticated;
