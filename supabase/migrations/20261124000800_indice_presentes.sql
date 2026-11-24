-- Índice da chave estrangeira presentes.resgatado_por (aviso de desempenho do Supabase)
create index if not exists presentes_resgatado_por on public.presentes (resgatado_por);
