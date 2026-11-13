/* =====================================================================
   NINHO — configuração
   Preencha SUPABASE_URL e SUPABASE_ANON_KEY (Supabase → Project Settings → API).
   A chave "anon" é pública por definição: a segurança vem das políticas RLS.
   NUNCA coloque a service_role key aqui.
   Sem Supabase configurado, o app roda em MODO LOCAL (dados só no aparelho)
   para desenvolvimento e testes.
   ===================================================================== */
window.NINHO_CONFIG = {
  SUPABASE_URL: 'https://vrdssjlkqopuypihgxxy.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZyZHNzamxrcW9wdXlwaWhneHh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ0MzkxMjgsImV4cCI6MjExMDAxNTEyOH0.WphBX225tFKDnHNthu1W7AWuZRMiXZ4dop9k29qBhew',   // chave pública (anon)
  VAPID_PUBLIC_KEY: '',          // chave pública Web Push (npx web-push generate-vapid-keys)

  VERSAO_TERMOS: '2026-11',      // mude quando os textos legais mudarem: o app pede novo aceite
  CONTATO_PRIVACIDADE: 'privacidade@seudominio.com.br',   // encarregado(a) de dados (LGPD art. 41)

  PRECOS: { mensal: 'R$ 14,90', anual: 'R$ 119,00' },

  /* Grátis x Plus. Mudar aqui muda o app; o banco (RLS) precisa da mesma regra:
     supabase/migrations/..._rls.sql (lista "plus" das tabelas). */
  RECURSOS: {
    // ---- grátis: acompanhamento + curvas da Caderneta + informações básicas
    consultas: 'free', curvas: 'free', jornada: 'free', vacinas: 'free', alertas: 'free',
    sinais_perigo: 'free', emergencia: 'free', movimentos: 'free', duvidas: 'free',
    saude_basica: 'free', lembretes_basicos: 'free', missoes: 'free', backup: 'free',
    // ---- Ninho+
    exames: 'plus', ultrassons: 'plus', casa: 'plus', monitores: 'plus', medicacao: 'plus',
    sintomas: 'plus', notas: 'plus', memorias: 'plus', plano_parto: 'plus', resumo_pdf: 'plus', fotos: 'plus',
  },
};
