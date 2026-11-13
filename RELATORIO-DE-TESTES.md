# Relatório de testes — Ninho

Data: 12/11/2026 · Ambiente: Chrome headless (Playwright), fuso America/Sao_Paulo, tela 400×860.

## Parte 1 — Versão anterior (antes das mudanças)

44 verificações automatizadas cobrindo todas as telas e funções: **19 OK, 25 problemas.**

### Erros de funcionamento
| # | Problema | Gravidade | Situação na v2 |
|---|---|---|---|
| 1 | No modo **DPP**, o campo de data mantinha `max = hoje`: era impossível escolher a DPP (sempre futura) pelo calendário | Alta | Corrigido |
| 2 | **Fuso horário**: o “dia de hoje” usava UTC. No Brasil, a partir das **21h** o app já considerava o dia seguinte (missões, doses e datas padrão erradas) | Alta | Corrigido — tudo em horário local |
| 3 | DUM sem validação: uma data de 2000 gerava “1401 semanas” | Média | Corrigido — limites e avisos |
| 4 | Fotos guardadas em base64 no `localStorage` (~5 MB): uma foto grande estourava a cota, o erro não era tratado e o registro **sumia** ao recarregar | Alta | Corrigido — IndexedDB + compressão + Storage |
| 5 | Backup só exportava; **não havia como restaurar** | Média | Corrigido — importação + migração da versão anterior |
| 6 | Service worker registrado por `blob:` — o navegador recusa; app **não funcionava offline** nem era instalável de verdade | Média | Corrigido — `sw.js` real |
| 7 | **“Lembretes” de medicação não notificavam**: não havia nenhuma chamada à API de notificações | Alta | Corrigido — notificações locais + Web Push |
| 8 | Horário de medicação aceitava “25:99” e texto livre | Baixa | Corrigido |
| 9 | Exame salvo **sem nenhum valor** (e rendia gotas) | Baixa | Corrigido |
| 10 | Gotas “infinitas” marcando/desmarcando vacina | Baixa | Corrigido — recompensa única por item |
| 11 | Toast invisível bloqueava cliques na parte de baixo da tela (achado nos testes da v2) | Média | Corrigido |

### Segurança e privacidade
| # | Problema | Situação na v2 |
|---|---|---|
| 12 | **XSS**: qualquer texto digitado (ex.: nome) com HTML era executado — todo o app montava telas com texto cru | Corrigido — escape em 100% das entradas + CSP |
| 13 | Ninho+ liberado por uma flag no próprio aparelho (`premium=true`) | Corrigido — plano vem do servidor; banco recusa gravação Plus sem assinatura |
| 14 | Sem conta/login, sem consentimento LGPD, sem exclusão de dados | Corrigido |
| 15 | Botões só com ícone sem rótulo para leitor de tela | Corrigido |

### Pontos clínicos desatualizados
| # | Antes | Agora (Caderneta Brasileira da Gestante 2026) |
|---|---|---|
| 16 | Só DUM ou DPP | **1º ultrassom (padrão, recomendado)**, DUM ou DPP, com comparação DUM × USG e regra de redatação |
| 17 | Ganho de peso pelo IOM 2009 (eutrofia 11,5–16 kg) | Curvas brasileiras adotadas pelo MS (Kac et al.): eutrofia **8–12 kg**, por IMC, com pontos de 13/27/40 semanas |
| 18 | PA da **consulta** não gerava alerta (só a medida em casa) | Alerta por PA da consulta e de casa; **≥ 160/110 = urgente**; ≥ 140/90 + sintoma = urgente |
| 19 | BCF fora de 110–160 sem alerta | Alerta |
| 20 | Hemoglobina baixa sem alerta | Anemia < 11 g/dL; < 8 prioridade |
| 21 | Glicemia sem distinguir 1 h e 2 h pós-refeição | Metas jejum < 95, 1 h < 140, 2 h < 120 |
| 22 | Consulta sem edema, movimentação fetal, apresentação, queixas urinárias, perdas | Todos os campos da tabela da Caderneta |
| 23 | Exames incompletos (faltavam HTLV, eletroforese, hepatite C, Coombs condicional…) | Lista completa da Caderneta por trimestre |
| 24 | Vacinas sem **VSR** (SUS desde 2025) e sem dT | Calendário da Caderneta 2026 |
| 25 | Febre > 38 °C; “bebê parou de mexer após 28 sem” | **> 37,8 °C**; **> 4 h sem mexer após 20 sem** (Caderneta) |

## Parte 2 — Versão nova (v2)

| Suíte | Verificações | Resultado |
|---|---|---|
| Unitários das regras clínicas (`tests/unit`) | 21 | ✅ 21/21 |
| Ponta a ponta, modo local (`tests/e2e/app.test.mjs`) | 79 | ✅ 79/79 |
| Ponta a ponta, Supabase simulado com 2 aparelhos (`tests/e2e/supabase.test.mjs`) | 22 | ✅ 22/22 |
| Banco real PostgreSQL 16: RLS, Plus, cascata, restrições (`tests/db`) | 37 | ✅ 37/37 |
| **Total** | **159** | **✅ 159/159** |

Cobertura: cadastro e validações, consentimentos, datação por USG/DUM/DPP, identificação (CPF/CNS com dígito verificador), consultas, curvas, alertas (urgente/atenção/info), vacinas, exames, ultrassom com foto, diário em casa, movimentos, sinais de perigo, notificações (privacidade e horário de silêncio), exportação/importação, migração da versão anterior, exclusão de conta, modo escuro, offline e sincronização entre aparelhos.

## O que ainda não foi testado (precisa de credenciais reais)
- Projeto Supabase real (Auth com e-mail, Storage, Edge Functions). As regras do banco foram testadas num PostgreSQL com as mesmas migrations; o app foi testado contra um Supabase simulado.
- Envio de Web Push e o `pg_cron`.
- Fluxo de pagamento no Mercado Pago (use o ambiente de teste deles antes de produção).
- Aparelhos reais (Android/iPhone), leitores de tela e as bibliotecas de CDN (no ambiente de teste foram simuladas).
