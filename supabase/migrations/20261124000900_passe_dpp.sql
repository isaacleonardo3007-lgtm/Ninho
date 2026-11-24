-- =====================================================================
-- Passe: preço protegido contra troca de datação e acesso que acompanha a DPP
--
-- 1) Preço. gestacoes.dpp_original guarda a DPP da primeira datação registrada
--    e não muda depois. O preço do Passe usa a datação "menos adiantada" entre a
--    original e a atual. Adiantar a datação para cair no Passe Reta Final não
--    baixa o preço; uma correção que atrasa a DPP é sempre respeitada.
-- 2) Acesso. O Passe e o presente valem até DPP + 90 dias. Quando a DPP é
--    corrigida (por exemplo, pelo ultrassom), o fim do acesso acompanha, com
--    mínimo de 60 dias desde o início e um teto fixado na compra:
--      Passe Gestação / presente: compra + 42 semanas + 90 dias
--      Passe Reta Final:          compra + 12 semanas + 90 dias
--    O teto impede que alguém compre o Reta Final e depois "volte" a DPP para
--    ganhar a gestação inteira pelo preço menor.
-- =====================================================================

-- DPP de uma linha de gestação (mesma regra do app: USG, DPP informada ou DUM)
create or replace function privado.dpp_de(metodo text, dum date, usg_data date, usg_s int, usg_d int, dpp_inf date)
returns date language sql immutable set search_path = '' as $$
  select case metodo
           when 'usg' then usg_data - (usg_s * 7 + coalesce(usg_d, 0)) + 280
           when 'dpp' then dpp_inf
           else dum + 280 end;
$$;

alter table public.gestacoes add column if not exists dpp_original date;

create or replace function privado.tg_dpp_original()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.dpp_original := privado.dpp_de(new.metodo_ig, new.dum, new.usg_data, new.usg_ig_semanas, new.usg_ig_dias, new.dpp_informada);
  else
    new.dpp_original := coalesce(old.dpp_original,
      privado.dpp_de(old.metodo_ig, old.dum, old.usg_data, old.usg_ig_semanas, old.usg_ig_dias, old.dpp_informada),
      privado.dpp_de(new.metodo_ig, new.dum, new.usg_data, new.usg_ig_semanas, new.usg_ig_dias, new.dpp_informada));
  end if;
  return new;
end $$;
drop trigger if exists gestacoes_dpp_original on public.gestacoes;
create trigger gestacoes_dpp_original before insert or update on public.gestacoes
  for each row execute function privado.tg_dpp_original();
update public.gestacoes set dpp_original = null where dpp_original is null;   -- preenche as existentes pelo gatilho

-- DPP usada no preço: a menos adiantada entre a original e a atual
create or replace function privado.dpp_preco(uid uuid)
returns date language sql stable security definer set search_path = '' as $$
  select greatest(g.dpp_original,
                  privado.dpp_de(g.metodo_ig, g.dum, g.usg_data, g.usg_ig_semanas, g.usg_ig_dias, g.dpp_informada))
  from public.gestacoes g
  where g.user_id = uid and g.ativa and g.deleted_at is null
  order by g.created_at desc limit 1;
$$;
revoke execute on function privado.dpp_preco(uuid) from public, anon, authenticated;

create or replace function public.dpp_preco_servico(uid uuid)
returns date language sql stable security definer set search_path = '' as $$ select privado.dpp_preco(uid); $$;
revoke execute on function public.dpp_preco_servico(uuid) from public, anon, authenticated;
grant execute on function public.dpp_preco_servico(uuid) to service_role;

-- Passe Reta Final? (mesma conta da função de pagamento)
create or replace function privado.eh_reta_final(uid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(40 - ceil((privado.dpp_preco(uid) - current_date) / 7.0) >= privado.cfg_int('reta_final_desde', 28), false);
$$;

-- teto do acesso, fixado na compra
alter table public.concessoes add column if not exists teto timestamptz;

create or replace function public.conceder_passe(uid uuid, p_ref text, p_reta boolean default null)
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare reta boolean := coalesce(p_reta, privado.eh_reta_final(uid)); f timestamptz;
begin
  perform privado.conceder(uid, 'passe', p_ref, 60, coalesce(privado.dpp_atual(uid) + 90, (now() + interval '300 days')::date)::timestamptz);
  -- teto contado a partir do início desta concessão (ela pode começar depois de outra)
  update public.concessoes c
     set teto = c.inicio + (case when reta then interval '12 weeks' else interval '42 weeks' end) + interval '90 days',
         fim = greatest(c.inicio + interval '60 days', least(c.fim, c.inicio + (case when reta then interval '12 weeks' else interval '42 weeks' end) + interval '90 days'))
   where c.origem = 'passe' and c.ref = p_ref and c.teto is null
  returning c.fim into f;
  return coalesce(f, (select c.fim from public.concessoes c where c.origem = 'passe' and c.ref = p_ref));
end $$;
drop function if exists public.conceder_passe(uuid, text);
revoke execute on function public.conceder_passe(uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.conceder_passe(uuid, text, boolean) to service_role;

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
  perform privado.conceder(uid, 'presente', p.id::text, 60,
         coalesce(privado.dpp_atual(uid) + 90, (now() + interval '300 days')::date)::timestamptz);
  update public.concessoes c set teto = c.inicio + interval '42 weeks' + interval '90 days',
         fim = least(c.fim, c.inicio + interval '42 weeks' + interval '90 days')
   where c.origem = 'presente' and c.ref = p.id::text and c.teto is null
  returning c.fim into f;
  return jsonb_build_object('ok', true, 'ate', f, 'de', p.comprador_nome, 'mensagem', p.mensagem);
end $$;

-- quando a DPP da gestação ativa muda, o fim do Passe/presente acompanha
create or replace function privado.tg_passe_segue_dpp()
returns trigger language plpgsql security definer set search_path = '' as $$
declare novo date; velho date; cid uuid; c public.concessoes; nf timestamptz; delta interval;
begin
  novo := privado.dpp_de(new.metodo_ig, new.dum, new.usg_data, new.usg_ig_semanas, new.usg_ig_dias, new.dpp_informada);
  velho := privado.dpp_de(old.metodo_ig, old.dum, old.usg_data, old.usg_ig_semanas, old.usg_ig_dias, old.dpp_informada);
  if not new.ativa or new.deleted_at is not null or novo is null or novo is not distinct from velho then return null; end if;
  for cid in select x.id from public.concessoes x
              where x.user_id = new.user_id and x.teto is not null and x.fim > now() and x.origem in ('passe', 'presente')
              order by x.inicio loop
    select * into c from public.concessoes where id = cid;     -- lê de novo: pode ter sido deslocada no passo anterior
    nf := greatest(c.inicio + interval '60 days', least((novo + 90)::timestamptz, c.teto));
    if nf <> c.fim then
      delta := nf - c.fim;
      -- concessões que começariam depois desta andam junto, sem buraco nem sobreposição
      update public.concessoes set inicio = inicio + delta, fim = fim + delta, teto = teto + delta
       where user_id = new.user_id and id <> c.id and inicio >= c.fim;
      update public.concessoes set fim = nf where id = c.id;
    end if;
  end loop;
  return null;
end $$;
drop trigger if exists gestacoes_passe_segue_dpp on public.gestacoes;
create trigger gestacoes_passe_segue_dpp after update of metodo_ig, dum, usg_data, usg_ig_semanas, usg_ig_dias, dpp_informada on public.gestacoes
  for each row execute function privado.tg_passe_segue_dpp();
