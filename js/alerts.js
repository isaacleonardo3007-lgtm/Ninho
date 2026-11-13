/* =====================================================================
   NINHO — motor de alertas (Centro de cuidado)
   Níveis:
     urgente  → procurar atendimento AGORA (SAMU 192 / maternidade)
     atencao  → falar com a equipe em breve (hoje ou na próxima consulta)
     info     → lembrete de cuidado (exame, vacina, consulta)
   Função pura: recebe um "contexto" e devolve a lista ordenada por gravidade.
   Os limiares vêm de js/clinical.js.
   ===================================================================== */
(function (g) {
  'use strict';
  const C = g.Clin, H = 3600000;
  const ORD = { urgente: 0, atencao: 1, info: 2 };
  const SINT_PE = ['Dor de cabeça', 'Visão embaçada', 'Dor no estômago', 'Inchaço'];

  /** ctx: { gest, ga, profile, list(t), plus, now:Date } */
  function compute(ctx) {
    const a = [], { ga, list, plus, profile = {}, gest = {} } = ctx, now = ctx.now || new Date(), w = ga.w;
    const byDateDesc = (x, y) => String(y.data || y.medido_em || y.inicio || '').localeCompare(String(x.data || x.medido_em || x.inicio || ''));
    const consultas = list('consultas').slice().sort(byDateDesc);
    const ult = consultas[0];
    const igAt = d => C.gaFrom(gest, String(d).slice(0, 10));
    const recente = (iso, horas) => iso && (now - new Date(iso)) < horas * H;
    const sintomasRecentes = plus ? list('sintomas').filter(s => recente(s.registrado_em, 24) && (s.intensidade || 0) >= 2) : [];
    const temSintomaPE = sintomasRecentes.some(s => SINT_PE.includes(s.nome));

    /* ---------- Pressão arterial (consulta e casa) ---------- */
    const pas = [];
    if (ult && ult.pa_sis) pas.push({ s: ult.pa_sis, d: ult.pa_dia, quando: ult.data, origem: 'consulta' });
    if (plus) list('medicoes').filter(m => m.tipo === 'pressao' && recente(m.medido_em, 72)).sort(byDateDesc).slice(0, 1)
      .forEach(m => pas.push({ s: m.sis, d: m.dia, quando: m.medido_em, origem: 'casa' }));
    pas.sort((x, y) => String(y.quando).localeCompare(String(x.quando)));
    const pa = pas[0];
    if (pa) {
      const cl = C.classifyBP(pa.s, pa.d);
      if (cl === 'grave' || (cl === 'alta' && temSintomaPE)) a.push({
        id: 'pa-urgente', sev: 'urgente', ic: '🩺', titulo: cl === 'grave' ? 'Pressão muito alta' : 'Pressão alta com sintomas',
        msg: `Sua última medida foi ${pa.s}/${pa.d} mmHg${cl === 'alta' ? ' e você registrou sintomas como dor de cabeça, visão alterada ou inchaço' : ''}. Isso pode ser pré-eclâmpsia: procure a maternidade agora.`,
        acts: [['Ligar 192', 'call192', 'pri'], ['Sinais de perigo', 'go:help']], fonte: 'Caderneta da Gestante 2026 — ≥ 160/110 é situação de urgência' });
      else if (cl === 'alta') a.push({
        id: 'pa-alta', sev: 'atencao', ic: '🩺', titulo: 'Pressão acima de 140/90',
        msg: `Medida de ${pa.s}/${pa.d} mmHg (${pa.origem === 'casa' ? 'em casa' : 'na consulta'}). Repita após 15 minutos sentada e em repouso. Se continuar alta, fale com sua equipe hoje. Se tiver dor de cabeça forte, alteração da visão ou dor no estômago, vá à maternidade.`,
        acts: [['Anotar p/ consulta', 'note:Pressão ' + pa.s + '/' + pa.d], ['Sinais de perigo', 'go:help']], fonte: 'Caderneta da Gestante 2026' });
    }

    /* ---------- Movimentos do bebê ---------- */
    if (w >= C.MOV.desde) {
      const k = list('movimentos').slice().sort(byDateDesc)[0];
      if (k && recente(k.inicio, 24) && k.contagem < C.MOV.alvo && k.duracao_min < C.MOV.minutos) a.push({
        id: 'mov-incompleta', sev: 'atencao', ic: '👶', titulo: 'Contagem com poucos movimentos',
        msg: `A última contagem parou com ${k.contagem} movimento(s) em ${k.duracao_min} min. Faça uma contagem completa (até sentir ${C.MOV.alvo} ou por 2 horas). Se você sente que o bebê está mexendo menos que o normal, não espere: procure a maternidade.`,
        acts: [['Contar de novo', 'kick'], ['Ligar 192', 'call192']], fonte: 'Caderneta da Gestante 2026 — sinais de perigo' });
      else if (k && recente(k.inicio, 24) && k.contagem < C.MOV.alvo) a.push({
        id: 'mov-baixo', sev: 'urgente', ic: '👶', titulo: 'Bebê mexendo menos',
        msg: `Na última contagem foram ${k.contagem} movimentos em ${k.duracao_min} min (o esperado é sentir ${C.MOV.alvo} em até 2 horas). Movimento diminuído é sinal de alerta: procure a maternidade hoje, sem esperar a próxima consulta.`,
        acts: [['Ligar 192', 'call192', 'pri'], ['Contar de novo', 'kick']], fonte: 'Caderneta da Gestante 2026 — sinais de perigo' });
      else if (!k || !recente(k.inicio, 48)) a.push({
        id: 'mov-contar', sev: 'info', ic: '👶', titulo: 'Conte os movimentos hoje',
        msg: 'A partir de 28 semanas, reserve um momento por dia, deitada de lado, para perceber os movimentos do bebê. Se notar que ele está mexendo menos, procure atendimento.',
        acts: [['Iniciar contagem', 'kick']], fonte: 'Caderneta da Gestante 2026', dispensavel: true });
    }
    if (ult && ult.movimentos_fetais === 'diminuidos' && recente(ult.data + 'T12:00:00', 7 * 24)) a.push({
      id: 'mov-consulta', sev: 'atencao', ic: '👶', titulo: 'Movimentos diminuídos na consulta',
      msg: 'Na última consulta foi anotado que o bebê estava mexendo menos. Siga a orientação da equipe e procure atendimento se perceber diminuição.', acts: [['Contar movimentos', 'kick']] });

    /* ---------- BCF, AU e edema da última consulta ---------- */
    if (ult && ult.bcf_bpm && (ult.bcf_bpm < C.BCF[0] || ult.bcf_bpm > C.BCF[1])) a.push({
      id: 'bcf', sev: 'atencao', ic: '💓', titulo: 'Batimentos do bebê fora da faixa',
      msg: `BCF registrado de ${ult.bcf_bpm} bpm (esperado entre ${C.BCF[0]} e ${C.BCF[1]}). Confira se o valor foi digitado certo; se sim, confirme com sua equipe.`, acts: [['Ver consulta', 'go:record:consultas']] });
    if (ult && ult.altura_uterina_cm) {
      const ig = igAt(ult.data), r = C.classifyAU(ig.w, +ult.altura_uterina_cm);
      if (r && r.sev !== 'ok') a.push({ id: 'au', sev: 'atencao', ic: '📏', titulo: `Altura uterina ${r.pos} da curva`, msg: r.msg, acts: [['Ver curva', 'go:record:curvas']], fonte: 'Curva de altura uterina (P10–P90)' });
    }
    if (ult && (ult.edema === '++' || ult.edema === '+++') && recente(ult.data + 'T12:00:00', 14 * 24)) a.push({
      id: 'edema', sev: 'atencao', ic: '🖐️', titulo: 'Inchaço importante', msg: 'Foi registrado edema ++ ou mais. Inchaço que aparece de repente no rosto ou nas mãos é sinal de perigo — procure atendimento.', acts: [['Sinais de perigo', 'go:help']] });
    if (ult && ult.perdas_vaginais && recente(ult.data + 'T12:00:00', 3 * 24)) a.push({
      id: 'perdas', sev: 'atencao', ic: '💧', titulo: 'Perdas pela vagina', msg: 'Sangramento ou perda de líquido são sinais de perigo. Se estiver acontecendo agora, procure a maternidade.', acts: [['Ligar 192', 'call192', 'pri']] });

    /* ---------- Ganho de peso (curva da Caderneta) ---------- */
    if (gest.peso_pre_kg && gest.altura_cm) {
      const pesos = consultas.filter(c => c.peso_kg).map(c => ({ d: c.data, p: +c.peso_kg }))
        .concat(plus ? list('medicoes').filter(m => m.tipo === 'peso').map(m => ({ d: String(m.medido_em).slice(0, 10), p: +m.valor })) : [])
        .sort((x, y) => y.d.localeCompare(x.d));
      if (pesos[0]) {
        const ig = igAt(pesos[0].d), cat = C.bmiCat(C.bmi(gest.peso_pre_kg, gest.altura_cm));
        const idade = C.ageYears(profile.data_nascimento);
        const r = C.classifyGWG(cat, ig.w, pesos[0].p - gest.peso_pre_kg, { adolescente: idade != null && idade < 19, gemelar: gest.tipo_gravidez && gest.tipo_gravidez !== 'unica' });
        if (r.sev === 'media') a.push({ id: 'gwg-' + r.pos, sev: 'atencao', ic: '⚖️', titulo: `Ganho de peso ${r.pos} da faixa`, msg: r.msg, acts: [['Ver curva', 'go:record:curvas']], fonte: 'Caderneta 2026 / Kac et al. 2021' });
      }
    }

    /* ---------- Medições em casa (Plus) ---------- */
    if (plus) {
      const gl = list('medicoes').filter(m => m.tipo === 'glicemia' && recente(m.medido_em, 7 * 24)).sort(byDateDesc);
      const fora = gl.map(m => C.classifyGlucose(m.valor, m.momento)).filter(r => r && r.sev !== 'ok');
      const hipo = gl.slice(0, 1).map(m => +m.valor).filter(v => v < 70)[0];
      if (hipo) a.push({ id: 'gli-hipo', sev: 'atencao', ic: '🩸', titulo: 'Glicemia baixa', msg: `Sua última glicemia foi ${hipo} mg/dL. Siga a orientação da sua equipe para hipoglicemia e avise-a. Se tiver confusão, desmaio ou convulsão, ligue 192.`, acts: [['Ligar 192', 'call192']] });
      else if (fora.length >= 2) a.push({ id: 'gli-meta', sev: 'atencao', ic: '🩸', titulo: 'Glicemias acima da meta', msg: `${fora.length} das suas medições dos últimos 7 dias ficaram acima da meta (jejum < 95, 1 h após < 140, 2 h após < 120 mg/dL). Mostre esse diário à sua equipe.`, acts: [['Ver diário', 'go:record:casa'], ['Anotar p/ consulta', 'note:Glicemias acima da meta']], fonte: 'Metas para diabetes na gestação (SBD/MS)' });
      else if (fora.length === 1 && gl[0] && C.classifyGlucose(gl[0].valor, gl[0].momento).sev !== 'ok') a.push({ id: 'gli-1', sev: 'info', ic: '🩸', titulo: 'Uma glicemia acima da meta', msg: fora[0].msg + ' Continue medindo nos horários combinados.', acts: [['Ver diário', 'go:record:casa']] });
      const temp = list('medicoes').filter(m => m.tipo === 'temperatura' && recente(m.medido_em, 24)).sort(byDateDesc)[0];
      if (temp && +temp.valor > C.FEBRE) a.push({ id: 'febre', sev: 'urgente', ic: '🌡️', titulo: 'Febre', msg: `Temperatura de ${temp.valor} °C (acima de 37,8 °C) é sinal de perigo na gestação. Procure atendimento.`, acts: [['Ligar 192', 'call192', 'pri']], fonte: 'Caderneta da Gestante 2026' });
      // sintomas fortes isolados
      sintomasRecentes.filter(s => s.intensidade >= 3 && SINT_PE.includes(s.nome)).slice(0, 1).forEach(s => {
        if (!a.some(x => x.id === 'pa-urgente')) a.push({ id: 'sint-' + s.nome, sev: 'atencao', ic: s.emoji || '📝', titulo: `${s.nome} forte`, msg: `${s.nome} forte pode estar ligada à pressão. Meça a pressão se puder; se vier com alteração da visão, dor no estômago ou inchaço repentino, procure a maternidade.`, acts: [['Sinais de perigo', 'go:help']] });
      });
      // exames: resultado mais recente de cada código
      const ex = {}; list('exames').forEach(e => { if (!ex[e.codigo] || e.data > ex[e.codigo].data) ex[e.codigo] = e; });
      Object.values(ex).forEach(e => {
        const r = C.interpretExam(e.codigo, e.valor_num != null ? e.valor_num : e.valor_txt);
        if (r && r.sev !== 'ok') a.push({ id: 'ex-' + e.codigo, sev: r.sev === 'info' ? 'info' : 'atencao', ic: '🔬', titulo: (C.EXAME[e.codigo] || {}).nome || e.nome || 'Exame', msg: r.msg, acts: [['Ver exames', 'go:record:exames']], fonte: 'Protocolos MS/FEBRASGO', dispensavel: r.sev === 'info' });
      });
      // exames da janela atual ainda não registrados
      pendentes(ctx).slice(0, 2).forEach(p => a.push({ id: 'exp-' + p.id, sev: 'info', ic: '🧪', titulo: `Exame desta fase: ${p.nome}`, msg: p.janela ? `Indicado entre ${p.janela[0]} e ${p.janela[1]} semanas.` : `Indicado no ${p.tri}º trimestre. Se já fez, registre o resultado.`, acts: [['Registrar', 'exam:' + p.id]], dispensavel: true }));
    }

    /* ---------- Rh negativo ---------- */
    if (/-$/.test(profile.tipo_sanguineo || '') && w >= 24 && w <= 30) a.push({ id: 'rh', sev: 'info', ic: '🅾️', titulo: 'Rh negativo', msg: 'Com Rh negativo, você precisa do Coombs indireto no pré-natal e pode precisar de imunoglobulina anti-D por volta de 28 semanas e após o parto. Confirme com sua equipe.', acts: [], dispensavel: true });

    /* ---------- Agenda de consultas (mínimo 7; início até 12 semanas) ---------- */
    if (!consultas.length && w >= 6) a.push({ id: 'pn-inicio', sev: w > C.CONSULTAS.inicioAte ? 'atencao' : 'info', ic: '🩺', titulo: w > C.CONSULTAS.inicioAte ? 'Registre seu pré-natal' : 'Comece o pré-natal',
      msg: w > C.CONSULTAS.inicioAte ? 'O ideal é começar o pré-natal até a 12ª semana. Se você já está em acompanhamento, registre sua última consulta para o app acompanhar suas curvas.' : 'A Caderneta recomenda iniciar o pré-natal até a 12ª semana, na UBS mais próxima. Registre suas consultas aqui.',
      acts: [['Registrar consulta', 'consulta']] });
    else if (ult) {
      const dias = C.diffDays(C.toISODate(now), ult.data), lim = C.intervaloConsulta(w) + 7;
      const prox = ult.proxima_consulta;
      if (prox && prox < C.toISODate(now) && C.diffDays(C.toISODate(now), prox) >= 2) a.push({ id: 'pn-registrar', sev: 'info', ic: '📅', titulo: 'Como foi a consulta?', msg: `Sua consulta estava marcada para ${prox.split('-').reverse().join('/')}. Registre os dados para manter sua caderneta e as curvas em dia.`, acts: [['Registrar consulta', 'consulta']], dispensavel: true });
      else if (!prox && dias > lim) a.push({ id: 'pn-atraso', sev: 'info', ic: '📅', titulo: 'Próxima consulta', msg: `Sua última consulta registrada foi há ${dias} dias. Nesta fase, as consultas são ${w < 28 ? 'mensais' : w < 36 ? 'a cada 15 dias' : 'semanais'}.`, acts: [['Registrar consulta', 'consulta']], dispensavel: true });
    }
    if (w >= 41) a.push({ id: 'pos-datismo', sev: 'atencao', ic: '📆', titulo: '41 semanas ou mais', msg: 'Com 41 semanas ou mais, é preciso avaliação na maternidade. Converse com sua equipe hoje.', acts: [['Ligar para a maternidade', 'emerg']] });

    /* ---------- Vacinas por idade gestacional ---------- */
    const vac = new Set(list('vacinas').map(v => v.codigo));
    if (w >= 20 && !vac.has('dtpa')) a.push({ id: 'vac-dtpa', sev: 'info', ic: '💉', titulo: 'Vacina dTpa', msg: 'A partir de 20 semanas, a dTpa protege o bebê contra a coqueluche. É recomendada em toda gestação, na UBS.', acts: [['Marcar como feita', 'vac:dtpa']], dispensavel: true });
    if (w >= 28 && !vac.has('vsr')) a.push({ id: 'vac-vsr', sev: 'info', ic: '💉', titulo: 'Vacina VSR', msg: 'A partir de 28 semanas, a vacina contra o vírus sincicial respiratório protege o bebê contra bronquiolite. Disponível no SUS.', acts: [['Marcar como feita', 'vac:vsr']], dispensavel: true });

    // dispensados (só "info"): somem por 7 dias
    const disp = (ctx.dismissed || {});
    const out = a.filter(x => !(x.sev === 'info' && disp[x.id] && (now - new Date(disp[x.id])) < 7 * 24 * H));
    return out.sort((x, y) => ORD[x.sev] - ORD[y.sev]);
  }

  /** exames da Caderneta do trimestre atual (ou janela) ainda sem resultado registrado */
  function pendentes(ctx) {
    const { ga, list, gest, profile = {} } = ctx, w = ga.w, tri = C.trimester(w);
    const feitos = new Set(list('exames').filter(e => C.trimester(C.gaFrom(gest, e.data).w) === tri).map(e => e.codigo));
    const rhNeg = /-$/.test(profile.tipo_sanguineo || '');
    const igg = list('exames').filter(e => e.codigo === 'toxo_igg').sort((a, b) => b.data.localeCompare(a.data))[0];
    const imune = igg && igg.valor_txt === 'Reagente';   // já teve contato: não repete no 2º/3º tri
    return C.EXAMES.filter(e => e.tri.includes(tri) && !feitos.has(e.id) && (!e.cond || (e.cond === 'rh_neg' && rhNeg)) && e.id !== 'outro')
      .filter(e => !(imune && tri > 1 && /^toxo_/.test(e.id)))
      .filter(e => !e.janela || (w >= e.janela[0] - 1 && w <= e.janela[1]))
      .filter(e => !(e.grupo === 'totg' && e.id !== 'totg_0'))
      .map(e => ({ ...e, nome: e.grupo === 'totg' ? 'TOTG 75 g (curva glicêmica)' : e.nome }));
  }

  g.Alerts = { compute, pendentes, ORD };
})(window);
