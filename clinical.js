/* =====================================================================
   NINHO — Referências clínicas
   Base: Caderneta Brasileira da Gestante (Ministério da Saúde, 2026)
   + protocolos citados em cada bloco. Todos os limiares ficam aqui para
   facilitar revisão pela equipe clínica: nada de número "mágico" no app.
   ===================================================================== */
(function (g) {
  'use strict';
  const DAY = 86400000;
  /** números em mensagens no padrão brasileiro: 23.6 → 23,6 */
  const ptBR = r => (r && r.msg ? Object.assign(r, { msg: r.msg.replace(/(\d)\.(\d)/g, '$1,$2') }) : r);

  /* ---------- Datas (sempre em horário LOCAL, nunca UTC) ---------- */
  function parseDate(s) { if (!s) return null; const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
  function toISODate(d) { const z = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`; }
  function today() { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); }
  function addDays(s, n) { const d = parseDate(s); d.setDate(d.getDate() + n); return toISODate(d); }
  function diffDays(a, b) { return Math.round((parseDate(a) - parseDate(b)) / DAY); } // a - b

  /* ---------- Idade gestacional ----------
     Métodos: 'usg' (1º ultrassom: data do exame + IG no exame),
              'dum' (data da última menstruação), 'dpp' (DPP informada).
     Regra de redatação quando DUM e USG existem (ACOG Committee Opinion 700,
     adotada por FEBRASGO/Einstein): se a diferença ultrapassar o limite da
     faixa de IG em que o USG foi feito, a IG do USG prevalece. */
  const REDATING = [ // [IG máx do USG em dias, diferença máxima tolerada em dias]
    [8 * 7 + 6, 5], [13 * 7 + 6, 7], [15 * 7 + 6, 7], [21 * 7 + 6, 10], [27 * 7 + 6, 14], [Infinity, 21]];
  function redatingLimit(usgGaDays) { return REDATING.find(r => usgGaDays <= r[0])[1]; }

  /** Retorna a "DUM equivalente" (data em que a IG seria 0d) para cada método */
  function startFromDUM(dum) { return dum || null; }
  function startFromUSG(usgData, sem, dias) {
    if (!usgData || sem === '' || sem == null) return null;
    return addDays(usgData, -((+sem) * 7 + (+dias || 0)));
  }
  function startFromDPP(dpp) { return dpp ? addDays(dpp, -280) : null; }

  /** Calcula IG a partir da gestação; ref = data ISO (padrão hoje) */
  function gaFrom(gest, ref) {
    const start = gaStart(gest);
    if (!start) return { ok: false, w: 0, d: 0, days: 0 };
    const days = diffDays(ref || toISODate(today()), start);
    return { ok: true, start, days, w: Math.floor(days / 7), d: ((days % 7) + 7) % 7, dpp: addDays(start, 280) };
  }
  function gaStart(gest) {
    if (!gest) return null;
    const m = gest.metodo_ig;
    if (m === 'usg') return startFromUSG(gest.usg_data, gest.usg_ig_semanas, gest.usg_ig_dias);
    if (m === 'dpp') return startFromDPP(gest.dpp_informada);
    return startFromDUM(gest.dum);
  }
  /** Compara DUM x USG e diz qual a regra recomenda */
  function compareDUMxUSG(gest) {
    const a = startFromDUM(gest.dum), b = startFromUSG(gest.usg_data, gest.usg_ig_semanas, gest.usg_ig_dias);
    if (!a || !b) return null;
    const usgGa = (+gest.usg_ig_semanas) * 7 + (+gest.usg_ig_dias || 0);
    const diff = Math.abs(diffDays(a, b)), lim = redatingLimit(usgGa);
    return { diff, limite: lim, recomenda: diff > lim ? 'usg' : 'dum', usgGaDays: usgGa };
  }
  /** Validação de entrada. Retorna lista de erros (bloqueiam) e avisos */
  function validateGestation(gest) {
    const err = [], warn = [], hoje = toISODate(today());
    if (gest.metodo_ig === 'dum' || gest.dum) {
      if (!gest.dum && gest.metodo_ig === 'dum') err.push('Informe a data da última menstruação.');
      if (gest.dum && gest.dum > hoje) err.push('A DUM não pode ser uma data futura.');
      if (gest.dum && diffDays(hoje, gest.dum) > 44 * 7) err.push('Essa DUM indica mais de 44 semanas. Confira a data.');
    }
    if (gest.metodo_ig === 'usg') {
      if (!gest.usg_data) err.push('Informe a data do 1º ultrassom.');
      if (gest.usg_data && gest.usg_data > hoje) err.push('A data do ultrassom não pode ser futura.');
      const s = +gest.usg_ig_semanas, d = +gest.usg_ig_dias || 0;
      if (gest.usg_ig_semanas === '' || gest.usg_ig_semanas == null || isNaN(s)) err.push('Informe a idade gestacional que o laudo do ultrassom mostra (semanas e dias).');
      else if (s < 4 || s > 42) err.push('A IG do ultrassom deve estar entre 4 e 42 semanas.');
      if (d < 0 || d > 6) err.push('Os dias da IG vão de 0 a 6.');
      if (!isNaN(s) && s >= 14) warn.push('O ultrassom mais preciso para datar a gestação é o do 1º trimestre (idealmente entre 7 e 12 semanas, segundo a Caderneta). Depois de 14 semanas a datação fica menos precisa.');
      const st = startFromUSG(gest.usg_data, gest.usg_ig_semanas, gest.usg_ig_dias);
      if (st && diffDays(hoje, st) > 44 * 7) err.push('Com esses dados a gestação passaria de 44 semanas. Confira a data e a IG do laudo.');
    }
    if (gest.metodo_ig === 'dpp') {
      if (!gest.dpp_informada) err.push('Informe a data provável do parto.');
      else if (diffDays(gest.dpp_informada, hoje) > 300) err.push('A DPP está a mais de 300 dias. Confira a data.');
      else if (diffDays(hoje, gest.dpp_informada) > 28) err.push('Essa DPP já passou há mais de 4 semanas. Confira a data.');
    }
    return { err, warn };
  }
  /* Trimestres (Caderneta 2026: 1º = semanas 1–14, 2º = 15–28, 3º = 29–42,
     contadas como semana em curso; equivale a 0s–13s6d / 14s–27s6d / 28s+) */
  function trimester(w) { return w < 14 ? 1 : w < 28 ? 2 : 3; }

  /* ---------- Consultas de pré-natal (Caderneta 2026) ----------
     Mínimo de 7 consultas; início até a 12ª semana; mensais até 28 sem,
     quinzenais da 28ª à 36ª, semanais a partir da 36ª; ao menos 1 consulta
     odontológica; no mínimo 2 consultas puerperais. */
  const CONSULTAS = { minimo: 7, inicioAte: 12, odonto: 1, puerperais: 2 };
  function intervaloConsulta(w) { return w < 28 ? 28 : w < 36 ? 14 : 7; }

  /* ---------- Exames (Caderneta 2026, "Exames pré-natal") ----------
     tri: trimestres em que é solicitado; cond: só se condição;
     tipo: 'num' (valor numérico) | 'qual' (reagente / não reagente) | 'opt' */
  const QUAL = ['Não reagente', 'Reagente', 'Indeterminado'];
  const EXAMES = [
    { id: 'teste_gravidez', nome: 'Teste rápido de gravidez', tri: [1], tipo: 'opt', opcoes: ['Positivo', 'Negativo'] },
    { id: 'abo_rh', nome: 'Tipagem sanguínea ABO/Rh', tri: [1], tipo: 'opt', opcoes: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] },
    { id: 'hb', nome: 'Hemograma — hemoglobina', tri: [1, 3], tipo: 'num', unidade: 'g/dL' },
    { id: 'ht', nome: 'Hemograma — hematócrito', tri: [1, 3], tipo: 'num', unidade: '%' },
    { id: 'eletroforese', nome: 'Eletroforese de hemoglobina', tri: [1], tipo: 'opt', opcoes: ['AA', 'AS', 'AC', 'SS', 'SC', 'Outro'] },
    { id: 'coombs', nome: 'Coombs indireto (se Rh negativo)', tri: [1, 2, 3], cond: 'rh_neg', nota: 'No 2º e 3º trimestres, repete se o resultado do 1º trimestre foi negativo.', tipo: 'opt', opcoes: ['Negativo', 'Positivo'] },
    { id: 'glicemia_jejum', nome: 'Glicemia em jejum', tri: [1, 3], nota: 'Se a 1ª consulta for depois de 24 semanas, a Caderneta indica o TOTG 75 g.', tipo: 'num', unidade: 'mg/dL' },
    { id: 'totg_0', nome: 'TOTG 75 g — jejum', tri: [2], janela: [24, 28], tipo: 'num', unidade: 'mg/dL', grupo: 'totg' },
    { id: 'totg_1h', nome: 'TOTG 75 g — 1 hora', tri: [2], janela: [24, 28], tipo: 'num', unidade: 'mg/dL', grupo: 'totg' },
    { id: 'totg_2h', nome: 'TOTG 75 g — 2 horas', tri: [2], janela: [24, 28], tipo: 'num', unidade: 'mg/dL', grupo: 'totg' },
    { id: 'sifilis', nome: 'Sífilis (teste rápido ou VDRL/RPR)', tri: [1, 3], tipo: 'qual', opcoes: QUAL },
    { id: 'hiv', nome: 'HIV (teste rápido ou anti-HIV I/II)', tri: [1, 3], tipo: 'qual', opcoes: QUAL },
    { id: 'hepb', nome: 'Hepatite B (teste rápido ou HBsAg)', tri: [1], tipo: 'qual', opcoes: QUAL },
    { id: 'hepc', nome: 'Hepatite C (teste rápido ou anti-HCV)', tri: [1], tipo: 'qual', opcoes: QUAL },
    { id: 'toxo_igg', nome: 'Toxoplasmose IgG', tri: [1, 2, 3], tipo: 'qual', opcoes: QUAL, nota: 'Se IgG não reagente (suscetível), repete no 2º e 3º trimestres.' },
    { id: 'toxo_igm', nome: 'Toxoplasmose IgM', tri: [1, 2, 3], nota: 'No 2º e 3º trimestres, só se a IgG não for reagente.', tipo: 'qual', opcoes: QUAL },
    { id: 'htlv', nome: 'HTLV (triagem)', tri: [1], tipo: 'qual', opcoes: QUAL },
    { id: 'eas', nome: 'Urina tipo I (EAS)', tri: [1, 3], tipo: 'opt', opcoes: ['Normal', 'Alterado'] },
    { id: 'urocultura', nome: 'Urocultura com antibiograma', tri: [1, 3], tipo: 'opt', opcoes: ['Negativa', 'Positiva'] },
    { id: 'usg_1tri', nome: 'Ultrassom obstétrico (idealmente 7–12 sem)', tri: [1], janela: [7, 12], tipo: 'texto' },
    { id: 'chagas', nome: 'Doença de Chagas (se suspeita)', tri: [1], cond: 'indicacao', tipo: 'qual', opcoes: QUAL },
    { id: 'malaria', nome: 'Malária (gota espessa ou teste rápido — regiões endêmicas)', tri: [1, 2, 3], cond: 'indicacao', tipo: 'qual', opcoes: ['Negativo', 'Positivo'] },
    /* Com indicação clínica (Caderneta 2026, 4.2.1) */
    { id: 'tsh', nome: 'TSH (se indicado)', tri: [], cond: 'indicacao', tipo: 'num', unidade: 'mUI/L' },
    { id: 'tuberculose', nome: 'Teste para tuberculose', tri: [], cond: 'indicacao', tipo: 'qual', opcoes: QUAL },
    { id: 'proteinuria', nome: 'Proteinúria (teste rápido na urina)', tri: [], cond: 'indicacao', tipo: 'opt', opcoes: ['Negativa', 'Traços', '+', '++', '+++'] },
    { id: 'clamidia_gono', nome: 'Clamídia e gonorreia', tri: [], cond: 'indicacao', tipo: 'opt', opcoes: ['Não detectado', 'Detectado'] },
    { id: 'colo_utero', nome: 'Rastreamento do câncer do colo do útero (Papanicolau ou teste de HPV)', tri: [], cond: 'indicacao', tipo: 'opt', opcoes: ['Normal', 'Alterado'] },
    { id: 'parasitologico', nome: 'Parasitológico de fezes', tri: [], cond: 'indicacao', tipo: 'opt', opcoes: ['Negativo', 'Positivo'] },
    { id: 'secrecao_vaginal', nome: 'Exame de secreção vaginal', tri: [], cond: 'indicacao', tipo: 'opt', opcoes: ['Normal', 'Alterado'] },
    /* Pré-natal de alto risco, conforme critério clínico (Caderneta 2026, 4.2.2) */
    { id: 'plaquetas', nome: 'Contagem de plaquetas', tri: [], cond: 'alto_risco', tipo: 'num', unidade: 'mil/mm³' },
    { id: 'proteinuria_24h', nome: 'Proteínas na urina de 24 horas', tri: [], cond: 'alto_risco', tipo: 'num', unidade: 'mg/24 h' },
    { id: 'funcao_renal', nome: 'Ureia, creatinina e ácido úrico', tri: [], cond: 'alto_risco', tipo: 'texto' },
    { id: 'ecg', nome: 'Eletrocardiograma', tri: [], cond: 'alto_risco', tipo: 'texto' },
    { id: 'doppler', nome: 'Ultrassom obstétrico com Doppler', tri: [], cond: 'alto_risco', tipo: 'texto' },
    { id: 'ctg', nome: 'Cardiotocografia anteparto', tri: [], cond: 'alto_risco', tipo: 'texto' },
    { id: 'outro', nome: 'Outro exame', tri: [], cond: 'indicacao', tipo: 'texto' },
  ];
  const EXAME = Object.fromEntries(EXAMES.map(e => [e.id, e]));
  /** No parto ou pós-parto imediato (Caderneta 2026, 4.2.1) — feitos na maternidade */
  const EXAMES_PARTO = ['Teste rápido para HIV', 'Teste rápido para sífilis ou VDRL/RPR', 'Teste rápido para hepatite B (se não feito no pré-natal)', 'Teste rápido para hepatite C (se não feito no pré-natal)'];

  /* ---------- Interpretação de exames ----------
     Hb: OMS/MS — anemia < 11 g/dL; < 8 g/dL é critério de encaminhamento (MS, CAB 32).
     Glicemia: OPAS/MS/FEBRASGO/SBD (2017) — jejum 92–125 = DMG; ≥ 126 = diabetes;
     TOTG 75 g: jejum ≥ 92, 1h ≥ 180, 2h ≥ 153 (um valor basta).
     TSH: sem referência local, ATA 2017 sugere limite superior 4,0 mUI/L. */
  function interpretExam(...a) { return ptBR(_interpretExam(...a)); }
  function _interpretExam(id, v) {
    const n = parseFloat(String(v).replace(',', '.'));
    switch (id) {
      case 'hb': if (isNaN(n)) return null;
        if (n < 8) return { sev: 'alta', msg: `Hemoglobina ${n} g/dL indica anemia importante. Procure sua equipe com prioridade.` };
        if (n < 11) return { sev: 'media', msg: `Hemoglobina ${n} g/dL está abaixo de 11 (anemia na gestação). Mostre à sua equipe — o tratamento costuma ser simples.` };
        return { sev: 'ok' };
      case 'glicemia_jejum': if (isNaN(n)) return null;
        if (n >= 126) return { sev: 'alta', msg: `Glicemia de jejum ${n} mg/dL (≥ 126) sugere diabetes. Leve o resultado à equipe o quanto antes.` };
        if (n >= 92) return { sev: 'media', msg: `Glicemia de jejum ${n} mg/dL (92 a 125) é critério de diabetes gestacional. Converse com sua equipe.` };
        return { sev: 'ok' };
      case 'totg_0': if (isNaN(n)) return null; return n >= 92 ? { sev: 'media', msg: `TOTG jejum ${n} mg/dL (≥ 92): critério de diabetes gestacional.` } : { sev: 'ok' };
      case 'totg_1h': if (isNaN(n)) return null; return n >= 180 ? { sev: 'media', msg: `TOTG 1 hora ${n} mg/dL (≥ 180): critério de diabetes gestacional.` } : { sev: 'ok' };
      case 'totg_2h': if (isNaN(n)) return null; return n >= 153 ? { sev: 'media', msg: `TOTG 2 horas ${n} mg/dL (≥ 153): critério de diabetes gestacional.` } : { sev: 'ok' };
      case 'tsh': if (isNaN(n)) return null; return n > 4 ? { sev: 'media', msg: `TSH ${n} mUI/L acima do esperado para a gestação. Mostre à sua equipe.` } : { sev: 'ok' };
      case 'sifilis': return v === 'Reagente' ? { sev: 'alta', msg: 'Sífilis reagente: o tratamento com penicilina precisa começar o quanto antes, e a parceria também deve ser testada e tratada. É gratuito no SUS.' } : v ? { sev: 'ok' } : null;
      case 'hiv': return v === 'Reagente' ? { sev: 'alta', msg: 'HIV reagente: com acompanhamento e tratamento, a chance de transmissão para o bebê fica muito baixa. Procure sua equipe para iniciar o cuidado.' } : v ? { sev: 'ok' } : null;
      case 'hepb': case 'hepc': case 'htlv': case 'chagas': case 'tuberculose':
        return v === 'Reagente' ? { sev: 'media', msg: `${EXAME[id].nome}: resultado reagente. Sua equipe vai orientar os próximos passos e os cuidados com o bebê.` } : v ? { sev: 'ok' } : null;
      case 'toxo_igm': return v === 'Reagente' ? { sev: 'alta', msg: 'Toxoplasmose IgM reagente pode indicar infecção recente. Procure sua equipe para avaliação e tratamento.' } : v ? { sev: 'ok' } : null;
      case 'toxo_igg': return v === 'Não reagente' ? { sev: 'info', msg: 'Toxoplasmose IgG não reagente: você ainda não teve contato. Capriche nos cuidados (carne bem passada, lavar bem frutas e verduras, evitar fezes de gato) e repita o exame no 2º e 3º trimestres.' } : v ? { sev: 'ok' } : null;
      case 'abo_rh': return /-$/.test(v || '') ? { sev: 'info', msg: 'Rh negativo: você precisa do Coombs indireto no pré-natal e pode precisar de imunoglobulina anti-D. Confirme com sua equipe.' } : v ? { sev: 'ok' } : null;
      case 'coombs': return v === 'Positivo' ? { sev: 'alta', msg: 'Coombs indireto positivo precisa de avaliação especializada. Procure sua equipe.' } : v ? { sev: 'ok' } : null;
      case 'urocultura': return v === 'Positiva' ? { sev: 'media', msg: 'Urocultura positiva: na gestação, infecção urinária deve ser tratada mesmo sem sintomas. Leve à equipe.' } : v ? { sev: 'ok' } : null;
      case 'eletroforese': return v && v !== 'AA' ? { sev: 'info', msg: `Eletroforese ${v}: converse com sua equipe sobre o significado para você e o bebê.` } : v ? { sev: 'ok' } : null;
      case 'proteinuria': return v && v !== 'Negativa' ? { sev: v === 'Traços' ? 'info' : 'media', msg: `Proteinúria ${v}: leve à equipe, principalmente se a pressão estiver alta ou houver inchaço.` } : v ? { sev: 'ok' } : null;
      case 'clamidia_gono': return v === 'Detectado' ? { sev: 'media', msg: 'Clamídia/gonorreia detectada: o tratamento é simples e a parceria também deve ser tratada. Procure sua equipe.' } : v ? { sev: 'ok' } : null;
      case 'plaquetas': if (isNaN(n)) return null; return n < 100 ? { sev: 'alta', msg: `Plaquetas ${n} mil/mm³ (abaixo de 100 mil): mostre à equipe com prioridade.` } : { sev: 'ok' };
      case 'malaria': return v === 'Positivo' ? { sev: 'alta', msg: 'Malária positiva: procure atendimento para tratamento imediato.' } : v ? { sev: 'ok' } : null;
      default: return null;
    }
  }

  /* ---------- Pressão arterial (Caderneta 2026) ----------
     ≥ 140/90 (confirmada em nova medida) = elevada; ≥ 160/110 = urgente. */
  const PA = { alerta: [140, 90], grave: [160, 110] };
  function classifyBP(s, d) {
    s = +s; d = +d; if (!s || !d) return null;
    if (s >= PA.grave[0] || d >= PA.grave[1]) return 'grave';
    if (s >= PA.alerta[0] || d >= PA.alerta[1]) return 'alta';
    return 'ok';
  }
  /** Aceita "120/80", "120x80" e a forma popular "12 por 8" / "12x8" (cmHg) */
  function parseBP(txt) {
    const m = String(txt || '').match(/(\d{1,3})\s*(?:\/|x|×|por)\s*(\d{1,3})/i); if (!m) return null;
    let s = +m[1], d = +m[2]; if (s < 30) s *= 10; if (d < 20) d *= 10;
    return s >= 50 && s <= 260 && d >= 30 && d <= 180 && s > d ? { sis: s, dia: d } : null;
  }

  /* ---------- Glicemia capilar (metas no DMG — SBD 2023 / MS) ----------
     jejum < 95; 1h pós-refeição < 140; 2h pós-refeição < 120; < 70 = hipoglicemia */
  const GLI_MOMENTOS = [
    { id: 'jejum', nome: 'Jejum', meta: 95 }, { id: 'pre', nome: 'Antes da refeição', meta: 100 },
    { id: 'pos1h', nome: '1 h após refeição', meta: 140 }, { id: 'pos2h', nome: '2 h após refeição', meta: 120 },
    { id: 'outro', nome: 'Outro horário', meta: 140 }];
  function classifyGlucose(...a) { return ptBR(_classifyGlucose(...a)); }
  function _classifyGlucose(v, momento) {
    v = +v; if (!v) return null;
    if (v < 70) return { sev: 'media', msg: `Glicemia ${v} mg/dL está baixa (abaixo de 70). Siga a orientação que sua equipe deu para hipoglicemia e avise-a.` };
    const m = GLI_MOMENTOS.find(x => x.id === momento) || GLI_MOMENTOS[4];
    if (v >= m.meta) return { sev: 'media', msg: `Glicemia ${v} mg/dL (${m.nome.toLowerCase()}) acima da meta (< ${m.meta}).` };
    return { sev: 'ok' };
  }

  /* ---------- Batimentos cardíacos fetais: 110–160 bpm ---------- */
  const BCF = [110, 160];

  /* ---------- Febre (Caderneta 2026): acima de 37,8 °C ---------- */
  const FEBRE = 37.8;

  /* ---------- Movimentos fetais ----------
     Caderneta 2026: sinal de perigo "diminuição ou ausência de movimentos,
     especialmente mais de 4 horas sem mexer após as 20 semanas".
     Contagem ativa ("conte até 10"): a partir de 28 semanas, 10 movimentos em até 2 h. */
  const MOV = { desde: 28, alvo: 10, minutos: 120, semMexerHoras: 4, perigoDesde: 20 };

  /* ---------- Altura uterina ----------
     A Caderneta 2026 traz a "Curva da altura uterina para a idade gestacional"
     (fonte: Assis GP et al., 2021). Os valores numéricos dessa curva não estão
     publicados em formato aberto; até a equipe inserir a tabela oficial em
     AU_TABELA_OFICIAL, usamos o padrão INTERGROWTH‑21st (Papageorghiou et al.,
     BMJ 2016), mesma metodologia de percentis (P10–P90).
     Média = 5,133374 + 0,1058353119·IG² − 0,0231295·IG²·ln(IG); DP = 0,9922667 + 0,0258087·IG */
  const AU_TABELA_OFICIAL = null; // { 16:[p10,p50,p90], ... } — cole aqui a tabela da Caderneta
  const Z = { p3: -1.8808, p10: -1.2816, p50: 0, p90: 1.2816, p97: 1.8808 };
  function auRef(w) {
    if (AU_TABELA_OFICIAL && AU_TABELA_OFICIAL[w]) { const [a, b, c] = AU_TABELA_OFICIAL[w]; return { p10: a, p50: b, p90: c, fonte: 'Caderneta 2026' }; }
    const mu = 5.133374 + 0.1058353119 * w * w - 0.0231295 * w * w * Math.log(w), sd = 0.9922667 + 0.0258087 * w;
    const r = {}; for (const k in Z) r[k] = +(mu + Z[k] * sd).toFixed(1); r.fonte = 'INTERGROWTH-21st'; return r;
  }
  const AU_SEMANAS = [16, 40];
  /** Curva da altura uterina impressa na Caderneta 2026 (encarte; Assis GP et al., 2021):
      linha única por mês de gestação, com o peso fetal correspondente. */
  const AU_CADERNETA = [{ mes: 4, cm: 15, g: 282 }, { mes: 5, cm: 21, g: 483 }, { mes: 6, cm: 25, g: 845 }, { mes: 7, cm: 28, g: 1576 }, { mes: 8, cm: 32, g: 2331 }, { mes: 9, cm: 34, g: 2995 }];
  function classifyAU(...a) { return ptBR(_classifyAU(...a)); }
  function _classifyAU(w, cm) {
    if (w < AU_SEMANAS[0] || w > 42 || !cm) return null; const r = auRef(Math.min(w, 40));
    if (cm < r.p10) return { sev: 'media', pos: 'abaixo', msg: `Altura uterina ${cm} cm com ${w} semanas ficou abaixo do percentil 10 (${r.p10} cm). Pode ser variação da medida, mas vale avaliar o crescimento do bebê.` };
    if (cm > r.p90) return { sev: 'media', pos: 'acima', msg: `Altura uterina ${cm} cm com ${w} semanas ficou acima do percentil 90 (${r.p90} cm). Sua equipe pode investigar (líquido, crescimento, gemelaridade).` };
    return { sev: 'ok', pos: 'dentro' };
  }

  /* ---------- Ganho de peso gestacional (MS 2022 / Kac et al., 2021) ----------
     Faixas recomendadas (cumulativas) por IMC pré-gestacional, conforme a
     Caderneta e as "Orientações sobre como monitorar o ganho de peso"
     (Femina 2023): até 13, 27 e 40 semanas. Entre esses pontos, interpolação
     linear (aproximação das curvas P10–P90 da Caderneta).
     Se o ganho máximo já foi atingido, a Caderneta orienta manter a taxa
     semanal mínima (não se recomenda perder peso). */
  const GWG = {
    baixo: { nome: 'Baixo peso', imc: 'IMC < 18,5', faixa: 'P18–P34', total: [9.7, 12.2], pts: { 13: [0.2, 1.2], 27: [5.6, 7.2], 40: [9.7, 12.2] }, taxa: 0.242 },
    eutrofia: { nome: 'Eutrofia (peso adequado)', imc: 'IMC 18,5 a 24,9', faixa: 'P10–P34', total: [8.0, 12.0], pts: { 13: [-1.8, 0.7], 27: [3.1, 6.3], 40: [8.0, 12.0] }, taxa: 0.200 },
    sobrepeso: { nome: 'Sobrepeso', imc: 'IMC 25 a 29,9', faixa: 'P18–P27', total: [7.0, 9.0], pts: { 13: [-1.6, -0.05], 27: [2.3, 3.7], 40: [7.0, 9.0] }, taxa: 0.175 },
    obesidade: { nome: 'Obesidade', imc: 'IMC ≥ 30', faixa: 'P27–P38', total: [5.0, 7.2], pts: { 13: [-1.6, -0.05], 27: [1.1, 2.7], 40: [5.0, 7.2] }, taxa: 0.125 },
  };
  function bmi(pesoKg, alturaCm) { const p = +pesoKg, a = +alturaCm / 100; return p && a ? p / (a * a) : null; }
  function bmiCat(imc) { return imc < 18.5 ? 'baixo' : imc < 25 ? 'eutrofia' : imc < 30 ? 'sobrepeso' : 'obesidade'; }
  /* Faixa recomendada semana a semana (10 a 40), lida dos vetores das curvas
     oficiais da Caderneta 2026 (págs. 89–92; Kac et al. 2021). Antes de 10 semanas,
     interpolação linear a partir de 0 kg. Depois de 40, segue a taxa semanal. */
  const GWG_CURVA = {
    baixo: { min: [-0.7,-0.3,-0.1,0.2,0.6,0.9,1.2,1.6,2.0,2.4,2.8,3.2,3.6,4.0,4.5,4.9,5.3,5.7,6.0,6.4,6.8,7.1,7.5,7.8,8.1,8.4,8.7,9.0,9.3,9.5,9.7], max: [0.3,0.7,1.0,1.3,1.7,2.0,2.4,2.8,3.2,3.6,4.1,4.5,5.0,5.5,6.0,6.4,6.8,7.3,7.7,8.2,8.6,9.0,9.4,9.8,10.1,10.5,10.8,11.2,11.5,11.9,12.2] },
    eutrofia: { min: [-2.3,-2.1,-1.9,-1.7,-1.5,-1.3,-1.0,-0.7,-0.3,0.0,0.4,0.8,1.2,1.6,2.0,2.4,2.8,3.1,3.5,3.8,4.2,4.5,4.9,5.2,5.6,6.0,6.4,6.7,7.1,7.5,8.0], max: [0.1,0.3,0.5,0.7,1.0,1.2,1.6,1.9,2.3,2.7,3.2,3.7,4.1,4.6,5.1,5.5,5.9,6.3,6.8,7.2,7.6,8.0,8.4,8.8,9.3,9.7,10.2,10.6,11.1,11.6,12.0] },
    sobrepeso: { min: [-2.2,-2.0,-1.8,-1.6,-1.3,-1.1,-0.8,-0.5,-0.3,0.0,0.3,0.6,0.8,1.1,1.4,1.7,2.0,2.4,2.7,3.0,3.4,3.7,4.1,4.5,4.8,5.2,5.6,6.0,6.4,6.8,7.0], max: [-1.2,-1.0,-0.7,-0.5,-0.2,0.1,0.4,0.7,0.9,1.2,1.5,1.8,2.1,2.5,2.8,3.1,3.5,3.8,4.2,4.5,4.9,5.2,5.6,6.0,6.4,6.8,7.2,7.7,8.1,8.5,9.0] },
    obesidade: { min: [-1.7,-1.7,-1.6,-1.6,-1.5,-1.4,-1.3,-1.2,-1.1,-0.9,-0.7,-0.5,-0.3,0.0,0.2,0.5,0.8,1.1,1.4,1.8,2.1,2.4,2.7,3.1,3.4,3.7,4.0,4.4,4.7,5.0,5.0], max: [-0.7,-0.6,-0.5,-0.4,-0.3,-0.1,0.0,0.1,0.3,0.5,0.7,1.0,1.2,1.5,1.8,2.1,2.4,2.8,3.1,3.4,3.8,4.1,4.4,4.8,5.1,5.5,5.8,6.2,6.5,6.9,7.2] },
  };
  function gwgRange(cat, w) {
    const C = GWG_CURVA[cat];
    w = Math.max(0, Math.min(42, +w || 0));
    if (w >= 40) { const ex = w - 40; return [+(C.min[30] + ex * GWG[cat].taxa).toFixed(2), +(C.max[30] + ex * GWG[cat].taxa).toFixed(2)]; }
    if (w < 10) { const t = w / 10; return [+(t * C.min[0]).toFixed(2), +(t * C.max[0]).toFixed(2)]; }
    const i = Math.floor(w) - 10, t = w - Math.floor(w), j = Math.min(30, i + 1);
    return [+(C.min[i] + t * (C.min[j] - C.min[i])).toFixed(2), +(C.max[i] + t * (C.max[j] - C.max[i])).toFixed(2)];
  }
  /** Regra da Caderneta para marcar a semana no gráfico: 1–3 dias → semana completa; 4–6 dias → semana seguinte. */
  function semanaCurva(w, d) { return (+d || 0) >= 4 ? (+w) + 1 : +w; }
  /** idade em anos completos */
  function ageYears(nasc, ref) { if (!nasc) return null; const n = parseDate(nasc), r = ref ? parseDate(ref) : today(); let a = r.getFullYear() - n.getFullYear(); if (r < new Date(r.getFullYear(), n.getMonth(), n.getDate())) a--; return a; }
  function classifyGWG(...a) { return ptBR(_classifyGWG(...a)); }
  function _classifyGWG(cat, w, ganho, { adolescente = false, gemelar = false } = {}) {
    if (adolescente || gemelar) return { sev: 'info', pos: 'individual', msg: 'As curvas da Caderneta foram feitas para gestação de um bebê em adultas. Para você, a orientação de ganho de peso é individualizada pela equipe.' };
    const [mn, mx] = gwgRange(cat, w);
    if (ganho > mx + 0.5) return { sev: 'media', pos: 'acima', mn, mx, msg: `Ganho de ${ganho.toFixed(1)} kg até ${w} semanas está acima da faixa recomendada (${mn.toFixed(1)} a ${mx.toFixed(1)} kg). Não é para perder peso: a Caderneta orienta ganhar cerca de ${Math.round(GWG[cat].taxa * 1000)} g por semana daqui em diante. Converse com sua equipe sobre alimentação e atividade física.` };
    if (ganho < mn - 0.5) return { sev: 'media', pos: 'abaixo', mn, mx, msg: `Ganho de ${ganho.toFixed(1)} kg até ${w} semanas está abaixo da faixa recomendada (${mn.toFixed(1)} a ${mx.toFixed(1)} kg). Vale conversar com sua equipe na próxima consulta.` };
    return { sev: 'ok', pos: 'dentro', mn, mx };
  }

  /* ---------- Vacinas (Caderneta 2026 / Calendário Nacional PNI) ---------- */
  const VACINAS = [
    { id: 'dtpa', nome: 'dTpa (difteria, tétano e coqueluche)', desde: 20, doses: 1, quando: 'A partir da 20ª semana, em toda gestação — mesmo que já tenha tomado antes.', porque: 'Protege você e o bebê contra tétano, difteria e coqueluche. Mesmo quem tomou em gravidez anterior precisa repetir.' },
    { id: 'dt', nome: 'dT (dupla adulto)', desde: 0, doses: 2, cond: true, quando: 'Se você tomou apenas 1 dose anterior: 1 dose de dT e 1 dose de dTpa a partir da 20ª semana. A dTpa continua essencial.', porque: 'Previne o tétano na mãe e no recém-nascido.' },
    { id: 'hepb', nome: 'Hepatite B', desde: 0, doses: 3, quando: 'Em qualquer fase, se o esquema estiver incompleto (3 doses: 0, 1 e 6 meses). Se não der tempo, termina até 45 dias após o parto.', porque: 'Reduz o risco de transmissão para o bebê.' },
    { id: 'influenza', nome: 'Influenza (gripe)', desde: 0, doses: 1, quando: '1 dose por temporada, em qualquer trimestre (ou até 45 dias após o parto).', porque: 'Gestantes têm mais risco de complicações da gripe.' },
    { id: 'covid', nome: 'COVID-19', desde: 0, doses: 1, quando: '1 dose por gestação, pelo menos 6 meses após a última dose, conforme orientação vigente.', porque: 'Protege a mãe e transfere anticorpos ao bebê.' },
    { id: 'vsr', nome: 'VSR (vírus sincicial respiratório)', desde: 28, doses: 1, quando: 'Dose única a partir da 28ª semana, em cada gestação. Disponível no SUS.', porque: 'Protege o bebê contra bronquiolite e pneumonia nos primeiros meses. Se o bebê nascer prematuro, recebe o nirsevimabe na maternidade (SUS).' },
    { id: 'febre_amarela', nome: 'Febre amarela', desde: 0, doses: 1, cond: true, quando: 'Só para quem mora ou vai para área de risco, com avaliação individual.', porque: 'Avaliação individual do serviço de saúde.' },
    { id: 'raiva', nome: 'Raiva — pré-exposição', desde: 0, doses: 1, cond: true, quando: 'Apenas para grupos específicos, orientados pela equipe (situações específicas).', porque: 'Proteção em áreas com risco aumentado de raiva. Consulte a UBS.' },
  ];

  /* ---------- Sinais de alerta (Caderneta 2026, seção 2.6 — 16 itens, na ordem oficial)
     + 2 complementares marcados com "extra": perda de líquido (seção do trabalho de
     parto: "se houver dúvida sobre a ruptura da bolsa, procure um serviço de saúde")
     e sinais emocionais (seção 6.8.4). ---------- */
  const SINAIS_PERIGO = [
    { id: 'pa', ic: '🩺', t: 'Pressão mais alta que o habitual', s: 'Ou mais alta que 140 x 90 mmHg (14 por 9).' },
    { id: 'sangramento', ic: '🩸', t: 'Sangramento vaginal', s: '' },
    { id: 'abdome', ic: '😣', t: 'Dor abdominal forte ou persistente', s: '' },
    { id: 'febre', ic: '🌡️', t: 'Febre', s: 'Temperatura maior ou igual a 37,8 °C.' },
    { id: 'cefaleia', ic: '🤕', t: 'Dor de cabeça intensa ou que não melhora', s: '' },
    { id: 'visao', ic: '👁️', t: 'Alterações na visão', s: 'Visão turva, sensibilidade à luz, flashes, pontos cegos ou perda de visão.' },
    { id: 'epigastrio', ic: '🔥', t: 'Dor forte na região do estômago', s: 'Logo abaixo da linha entre as mamas.' },
    { id: 'urina', ic: '🚻', t: 'Dor ou ardência ao urinar', s: '' },
    { id: 'inchaco', ic: '🖐️', t: 'Inchaço repentino', s: 'No rosto, nas mãos ou nas pernas.' },
    { id: 'movimento', ic: '👶', t: 'Bebê mexendo menos ou sem mexer', s: 'Especialmente se ficar mais de 4 horas sem se mexer após as 20 semanas.' },
    { id: 'pele', ic: '🔴', t: 'Manchas vermelhas na pele ou vermelhidão nos olhos', s: '' },
    { id: 'malestar', ic: '😵', t: 'Mal-estar intenso', s: 'Ou sensação de que algo não está bem.' },
    { id: 'peito', ic: '💔', t: 'Dor forte no peito', s: '' },
    { id: 'falta_ar', ic: '🫁', t: 'Falta de ar', s: '' },
    { id: 'convulsao', ic: '⚡', t: 'Convulsões', s: '' },
    { id: 'desmaio', ic: '🌀', t: 'Desmaio', s: '' },
    { id: 'liquido', ic: '💧', t: 'Perda de líquido pela vagina', s: 'Pode ser a bolsa rompida. Na dúvida, procure um serviço de saúde. Líquido verde ou amarelo exige avaliação.', extra: true },
    { id: 'mental', ic: '💜', t: 'Tristeza intensa, desespero ou pensamentos de se machucar', s: 'Sinais de alerta emocionais (Caderneta, 6.8.4). Pedir ajuda é um direito. CVV 188 (24 h).', extra: true },
  ];

  /* ---------- Conteúdo por trimestre (Jornada) ---------- */
  const TRIMESTRES = [
    { tri: 1, min: 0, max: 13, title: '1º Trimestre', emoji: '🌱', faixa: 'semanas 1 a 14',
      baby: 'O coraçãozinho começa a bater por volta da 6ª semana. Formam-se órgãos, braços e pernas.',
      tips: ['Comece o pré-natal até a 12ª semana', 'Ácido fólico todos os dias (orientação da equipe)', 'Enjoo é comum: coma pouco e várias vezes', 'Evite álcool, cigarro e remédios por conta própria'] },
    { tri: 2, min: 14, max: 27, title: '2º Trimestre', emoji: '🌷', faixa: 'semanas 15 a 28',
      baby: 'A barriga aparece! O bebê começa a se mexer (em geral entre 18 e 22 semanas) e já ouve sua voz.',
      tips: ['Consultas mensais', 'dTpa a partir de 20 semanas', 'TOTG entre 24 e 28 semanas', 'Atividade física leve, se liberada'] },
    { tri: 3, min: 28, max: 42, title: '3º Trimestre', emoji: '🌻', faixa: 'semanas 29 a 42',
      baby: 'O bebê ganha peso, os pulmões amadurecem e ele se posiciona para o nascimento.',
      tips: ['Consultas a cada 15 dias até 36 semanas, depois semanais', 'Vacina VSR a partir de 28 semanas', 'Preste atenção aos movimentos do bebê todos os dias', 'Prepare a mala e conheça a maternidade de referência'] },
  ];

  g.Clin = {
    parseDate, toISODate, today, addDays, diffDays, gaFrom, gaStart, compareDUMxUSG, validateGestation, redatingLimit,
    startFromUSG, startFromDUM, startFromDPP, trimester, CONSULTAS, intervaloConsulta, EXAMES, EXAME, EXAMES_PARTO, interpretExam,
    PA, classifyBP, parseBP, GLI_MOMENTOS, classifyGlucose, BCF, FEBRE, MOV, auRef, AU_SEMANAS, AU_CADERNETA, classifyAU,
    GWG, GWG_CURVA, bmi, bmiCat, gwgRange, semanaCurva, classifyGWG, ageYears, VACINAS, SINAIS_PERIGO, TRIMESTRES,
  };
})(typeof window !== 'undefined' ? window : globalThis);
