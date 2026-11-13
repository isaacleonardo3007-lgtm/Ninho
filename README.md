# 🪺 Ninho — Caderneta Digital da Gestante

> *sua gestação, no aconchego de um só lugar*

PWA mobile-first baseada na **Caderneta Brasileira da Gestante (Ministério da Saúde, 2026)**, com conta, banco de dados **Supabase** (PostgreSQL + RLS), sincronização offline-first, plano **Grátis** e **Ninho+**, alertas clínicos e lembretes por notificação.

> ⚠️ O Ninho apoia o acompanhamento e **não substitui a equipe de saúde**.

## Grátis × Ninho+
| Grátis (sempre) | Ninho+ |
|---|---|
| Conta e identificação da gestante | Exames da Caderneta com resultados, gráficos e alertas |
| Idade gestacional pelo **1º ultrassom**, DUM ou DPP | Ultrassons com fotos |
| Semana a semana e jornada por trimestre (exames, consultas, dicas) | Diário em casa: pressão, glicemia, peso, temperatura, personalizados |
| Registro de consultas (campos da Caderneta) | Medicação com lembrete na hora da dose |
| **Curvas da Caderneta**: altura uterina e ganho de peso + pressão | Sintomas e anotações para a consulta |
| Vacinas (inclui VSR) | Diário de memórias, plano de parto |
| Contador de movimentos, alertas, sinais de perigo, cartão de emergência | Resumo completo em PDF |
| Lembretes de consulta, vacina, exame e movimentos | Lembretes de medicação e medições |

A divisão fica em `js/config.js → RECURSOS` e é **imposta também no banco** (RLS), não só na tela.

## Estrutura
```
index.html               casca do app
css/app.css              estilos
js/config.js             Supabase, preços, grátis × Plus
js/clinical.js           todas as regras e números clínicos (Caderneta 2026)
js/alerts.js             motor de alertas (urgente / atenção / info)
js/notify.js             lembretes e notificações (locais + Web Push)
js/store.js              dados: IndexedDB + Supabase, sincronização, exportação
js/app.js                interface
sw.js                    service worker (offline + push)
supabase/migrations/     esquema, RLS e Storage
supabase/functions/      excluir conta, enviar lembretes, checkout e webhook (Mercado Pago)
supabase/sql/cron.sql    agendamento do envio de lembretes
tests/                   unitários, ponta a ponta (Playwright) e testes de segurança do banco
docs/                    guia Supabase/GitHub, relatório de testes, referências clínicas, LGPD
```

## Começar
1. Rodar localmente (modo local, sem servidor): `python3 -m http.server 8766` e abra <http://localhost:8766>.
2. Ligar ao Supabase e publicar: **[docs/SUPABASE-E-GITHUB.md](docs/SUPABASE-E-GITHUB.md)**.
3. Testes: `npm install && npx playwright install chromium && npm test` (159 verificações no total, ver **[docs/RELATORIO-DE-TESTES.md](docs/RELATORIO-DE-TESTES.md)**).

Também: **[docs/REFERENCIAS-CLINICAS.md](docs/REFERENCIAS-CLINICAS.md)** · **[docs/PRIVACIDADE-LGPD.md](docs/PRIVACIDADE-LGPD.md)**

Usuárias da versão anterior: ao entrar, o app oferece importar os dados que estavam no aparelho.

Feito com 💜
