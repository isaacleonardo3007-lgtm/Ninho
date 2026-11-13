# Referências clínicas

Todos os números ficam em `js/clinical.js` — um lugar só para a revisão da equipe clínica.
Fonte principal: **Caderneta Brasileira da Gestante, Ministério da Saúde, 2026** (gov.br/saude).

| Tema | Regra no app | Fonte |
|---|---|---|
| Idade gestacional | Métodos: **1º USG** (data do exame + IG do laudo), DUM ou DPP. USG ideal entre 7 e 12 sem; aviso se ≥ 14 sem | Caderneta 2026 |
| DUM × USG | USG prevalece se a diferença passar de 5 d (USG ≤ 8s6d), 7 d (≤ 15s6d), 10 d (≤ 21s6d), 14 d (≤ 27s6d), 21 d (≥ 28 s) | ACOG Committee Opinion 700 (usada por FEBRASGO/Einstein) |
| Trimestres | 1º = sem 1–14 · 2º = 15–28 · 3º = 29–42 (semana em curso) | Caderneta 2026 |
| Consultas | Mínimo **7**; início até 12 sem; mensais até 28, quinzenais 28–36, semanais ≥ 37; sem “alta” do pré-natal | Caderneta 2026 |
| Exames | Lista por trimestre da tabela “Exames pré-natal” (ABO/Rh, hemograma, eletroforese, Coombs se Rh−, glicemia, TOTG 24–28 sem, sífilis, HIV, hepatites B e C, toxoplasmose, HTLV, EAS, urocultura, USG, Chagas/malária se indicado) | Caderneta 2026 |
| Pressão | ≥ 140/90 = elevada (repetir); **≥ 160/110 = urgência**; ≥ 140/90 + cefaleia/visão/epigástrio = urgência | Caderneta 2026 |
| Glicemia (exame) | Jejum 92–125 = DMG; ≥ 126 = diabetes. TOTG 75 g: jejum ≥ 92, 1 h ≥ 180, 2 h ≥ 153 | OPAS/MS/FEBRASGO/SBD 2017 |
| Glicemia capilar | Metas: jejum < 95, 1 h < 140, 2 h < 120; < 70 = baixa | SBD / MS |
| Hemoglobina | < 11 g/dL anemia; < 8 prioridade | OMS / MS (Cadernos de Atenção Básica 32) |
| TSH | > 4,0 mUI/L sinaliza (sem referência local) | ATA 2017 |
| BCF | 110–160 bpm | — |
| Febre | > 37,8 °C (fora da axila) | Caderneta 2026 |
| Movimentos | Sinal de perigo: diminuição ou > 4 h sem mexer após 20 sem. Contagem ativa a partir de 28 sem: 10 em até 2 h | Caderneta 2026 |
| Altura uterina | Faixa P10–P90 por IG, 16–40 sem | **Pendente:** a Caderneta 2026 usa a curva de Assis et al., 2021, sem tabela numérica aberta. Enquanto isso: INTERGROWTH‑21st (Papageorghiou et al., BMJ 2016). Para trocar, preencha `AU_TABELA_OFICIAL` em `js/clinical.js` |
| Ganho de peso | IMC pré: < 18,5 baixo peso (9,7–12,2 kg) · 18,5–24,9 eutrofia (8–12) · 25–29,9 sobrepeso (7–9) · ≥ 30 obesidade (5–7,2). Faixas cumulativas em 13/27/40 sem; acima do máximo, manter 242/200/175/125 g/sem. Adolescentes e gemelares: orientação individual | Caderneta 2026; Kac et al., AJCN 2021; Femina 2023 |
| Vacinas | dTpa ≥ 20 sem (toda gestação); dT se esquema incompleto; hepatite B (3 doses); influenza (temporada); COVID‑19 (1 dose/gestação); **VSR ≥ 28 sem**; febre amarela só área de risco | Caderneta 2026 / PNI |
| Sinais de perigo | 13 itens da seção 2.6 (sangramento, líquido, PA, cefaleia, visão, epigástrio, dor abdominal, febre, inchaço súbito, movimentos, falta de ar, convulsão/desmaio, saúde mental) | Caderneta 2026 |

**Para revisão clínica antes do lançamento:** a tabela numérica oficial da curva de altura uterina; os textos dos alertas; a aplicabilidade das regras para gestação de alto risco.
