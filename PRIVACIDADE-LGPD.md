# Privacidade e LGPD

Dados de gestação são **dados pessoais sensíveis** (LGPD art. 5º, II e art. 11).

## O que foi implementado
| Requisito | Como |
|---|---|
| Base legal para dados de saúde | Consentimento **específico e destacado** no cadastro (art. 11, I), separado de Termos e Privacidade |
| Registro do consentimento | Tabela `consentimentos` (só inserção), com tipo, versão, data e origem |
| Nova versão dos termos | Mudar `VERSAO_TERMOS` em `js/config.js` faz o app pedir novo aceite |
| Revogação | Notificações e pesquisa revogáveis a qualquer momento; dados de saúde → exclusão da conta |
| Acesso e portabilidade (art. 18, II e V) | “Baixar meus dados” gera JSON completo |
| Eliminação (art. 18, VI) | “Excluir minha conta” apaga tudo (banco em cascata + fotos do Storage) |
| Minimização | CPF e CNS **opcionais**; só nome, nascimento e celular são pedidos no cadastro |
| Isolamento | RLS em todas as tabelas; Storage privado por pasta; URLs de foto assinadas |
| Notificações discretas | Por padrão a tela de bloqueio mostra só “Ninho — você tem um lembrete” |
| Aparelho compartilhado | “Sair” apaga o cache local (IndexedDB) |
| Segurança do app | Escape de todo texto (XSS), CSP, senha forte, sem `service_role` no cliente |
| Menores de 18 | Aviso no cadastro; < 14 anos inclui Disque 100 |
| Localização dos dados | Recomendado projeto Supabase em São Paulo |

## Pendências antes de lançar (não técnicas)
1. **Revisão jurídica** dos textos (resumos em `js/app.js → showLegal`). Os textos são rascunhos.
2. Nomear o(a) **encarregado(a) de dados** (art. 41) e atualizar `CONTATO_PRIVACIDADE`.
3. **RIPD** (Relatório de Impacto à Proteção de Dados) — recomendado para dados de saúde em escala.
4. Contrato/DPA com operadores: Supabase e Mercado Pago (este não recebe dados de saúde).
5. Plano de resposta a incidentes (comunicação à ANPD e às titulares).
6. Fontes e bibliotecas por CDN expõem o IP a terceiros (Google Fonts, jsDelivr, cdnjs): para máxima privacidade, hospedar esses arquivos junto do app.
7. GitHub Pages não envia cabeçalhos de segurança (HSTS, `frame-ancestors`). Em produção, considere Cloudflare Pages/Netlify/Vercel para configurá-los.
8. Política para adolescentes (consentimento de responsável) a definir com o jurídico.
