-- Alinhamento à Caderneta da Gestante 2026: vacina antirrábica pré-exposição (situações específicas)
alter table public.vacinas drop constraint if exists vacinas_codigo_check;
alter table public.vacinas add constraint vacinas_codigo_check
  check (codigo in ('dtpa','dt','hepb','influenza','covid','vsr','febre_amarela','raiva','outra'));
