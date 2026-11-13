-- =====================================================================
-- NINHO — endurecimento (recomendações do Security Advisor do Supabase)
-- * funções auxiliares das políticas saem do schema exposto pela API
-- * search_path fixo nas funções de gatilho
-- =====================================================================
create schema if not exists privado;
revoke all on schema privado from public, anon;
grant usage on schema privado to authenticated;   -- as políticas RLS rodam como a usuária

alter function public.plano_ativo(uuid) set schema privado;
alter function public.is_plus() set schema privado;
alter function public.gestacao_e_minha(uuid) set schema privado;

create or replace function privado.is_plus()
returns boolean language sql stable security definer set search_path = '' as $$
  select privado.plano_ativo(auth.uid());
$$;
revoke execute on function privado.plano_ativo(uuid) from public, anon, authenticated;
revoke execute on function privado.is_plus() from public, anon;
grant execute on function privado.is_plus() to authenticated;
revoke execute on function privado.gestacao_e_minha(uuid) from public, anon;
grant execute on function privado.gestacao_e_minha(uuid) to authenticated;

-- meu_plano é a única chamada pelo app: roda com os direitos da própria usuária
create or replace function public.meu_plano()
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'plano', case when privado.is_plus() then 'plus' else 'free' end,
    'status', coalesce(a.status, 'active'), 'ciclo', a.ciclo, 'periodo_fim', a.periodo_fim)
  from (select 1) x left join public.assinaturas a on a.user_id = auth.uid();
$$;
revoke execute on function public.meu_plano() from public, anon;
grant execute on function public.meu_plano() to authenticated;

alter function public.tg_set_updated_at() set search_path = '';
alter function public.tg_profiles_updated_at() set search_path = '';
