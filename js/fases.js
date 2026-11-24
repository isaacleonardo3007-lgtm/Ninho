/* =====================================================================
   NINHO — fases depois da gestação: puerpério e perda gestacional
   O desfecho fica em gestacoes.desfecho = { tipo, data, ... }.
     · nascimento → modo puerpério: cuidado com a mãe (consultas pós-parto,
       sinais de alerta, emoções, direitos). O bebê é acompanhado na
       Caderneta da Criança (e, no futuro, no app do bebê).
     · perda → modo acolhedor: sem semanas, frutas, bebê, gotas, ofertas ou
       lembretes de pré-natal. Convites da família ficam em pausa.
   Conteúdo: Caderneta da Gestante 2026 (Partes VI e VII). Usa utilitários de app.js.
   ===================================================================== */
'use strict';

function fase() { const d = S() && S().gestacao && S().gestacao.desfecho; return d && d.tipo === 'perda' ? 'perda' : d && d.tipo === 'nascimento' ? 'puerperio' : 'gestacao'; }
function desfecho() { return (S().gestacao && S().gestacao.desfecho) || {}; }
function diaPuerperio() { return Math.max(1, C.diffDays(todayISO(), desfecho().data) + 1); }
function nBebes() { return C.bebesDe(S().gestacao && S().gestacao.tipo_gravidez); }
function tonsBebes() { const t = (Store.prefs.tons || {}).bebe || []; return Array.from({ length: nBebes() }, (_, i) => t[i] != null ? t[i] : (t[0] != null ? t[0] : Ilustra.PADRAO)); }
function puerp() { return Store.prefs.puerperio || {}; }
function patchPuerp(p) { Store.patchPrefs({ puerperio: Object.assign({}, puerp(), p) }); }

/* =================== tom de pele das ilustrações =================== */
function modalTons() {
  const t = Store.prefs.tons || {}, n = nBebes(), tb = tonsBebes();
  openModal('🎨 Ilustrações', `<p class="muted" style="font-size:13px;margin:0 0 10px">Escolha como o app desenha ${n > 1 ? 'os bebês' : 'o bebê'} e a família. Fica só no seu app.</p>
    <div style="display:flex;justify-content:center;margin:4px 0 10px" id="tn-prev">${Ilustra.bebes(tb, { w: 120 })}</div>
    ${tb.map((v, i) => `<label class="lbl">${n > 1 ? `Bebê ${i + 1}` : 'Bebê'}</label>${Ilustra.seletor(v, `escolherTom.bind(null,'bebe',${i})`, 'Tom de pele do bebê ' + (i + 1))}`).join('')}
    <label class="lbl">Você</label>${Ilustra.seletor(t.mae != null ? t.mae : Ilustra.PADRAO, "escolherTom.bind(null,'mae',0)", 'Seu tom de pele')}
    <label class="lbl">Parceria (se houver)</label>${Ilustra.seletor(t.parceria != null ? t.parceria : 2, "escolherTom.bind(null,'parceria',0)", 'Tom de pele da parceria')}
    <button class="btn full" style="margin-top:14px" onclick="closeModal();renderAll()">Pronto</button>`);
}
function escolherTom(quem, i, v) {
  const t = Object.assign({}, Store.prefs.tons || {});
  if (quem === 'bebe') { const b = (t.bebe || []).slice(); b[i] = v; t.bebe = b; } else t[quem] = v;
  Store.patchPrefs({ tons: t }); modalTons();
}

/* =================== registrar o desfecho =================== */
function modalNascimento() {
  const n = nBebes(), nomes = String(bebe() || '').split(/\s+e\s+|,\s*/).filter(Boolean);
  openModal('👶 Meu bebê nasceu', `<div style="display:flex;justify-content:center;margin:-6px 0 6px">${Ilustra.bebes(tonsBebes(), { w: 110 })}</div>
    <p class="muted" style="font-size:13px;text-align:center;margin:0 0 12px">Que alegria! O app passa a cuidar de você no pós-parto: consultas, sinais de alerta e emoções.</p>
    <label class="lbl" for="nb-d">Data do nascimento</label><input class="in" type="date" id="nb-d" value="${todayISO()}" max="${todayISO()}">
    ${Array.from({ length: n }, (_, i) => `<label class="lbl" for="nb-n${i}">Nome ${n > 1 ? `do bebê ${i + 1}` : 'do bebê'} (opcional)</label><input class="in" id="nb-n${i}" maxlength="40" value="${esc(nomes[i] || '')}">`).join('')}
    <label class="lbl" for="nb-p">Tipo de parto (opcional)</label><select class="in" id="nb-p">${opt([['', '—'], ['vaginal', 'Vaginal'], ['cesarea', 'Cesárea']], '')}</select>
    <button class="btn full" style="margin-top:12px" onclick="salvarNascimento()">Registrar nascimento</button>`);
}
function salvarNascimento() {
  const d = val('nb-d'), n = nBebes();
  if (!d || d > todayISO() || C.diffDays(d, C.gaStart(S().gestacao)) < 140) return fieldErr('nb-d', 'Confira a data do nascimento');
  const nomes = Array.from({ length: n }, (_, i) => val('nb-n' + i)).filter(Boolean);
  const patch = { desfecho: { tipo: 'nascimento', data: d, parto: val('nb-p') || null, ig_semanas: C.gaFrom(S().gestacao, d).w } };
  if (nomes.length) patch.nome_bebe = nomes.join(' e ');
  Store.setGestacao(patch); closeModal(); confetti(60); toast('Bem-vindo ao mundo 💜'); scheduleReminders(); go('home');
}
function modalPerda() {
  openModal('🤍 Registrar uma perda', `<div style="display:flex;justify-content:center;margin:-4px 0 4px">${Ilustra.cuidado({ w: 84 })}</div>
    <p style="font-size:14.5px;line-height:1.55;margin:0 0 10px">Sentimos muito. Você não está sozinha.</p>
    <p class="muted" style="font-size:13px;line-height:1.5;margin:0 0 12px">Ao registrar, o app deixa de mostrar semanas, tamanho do bebê, lembretes de pré-natal e ofertas. Os convites da família ficam em pausa. Seus registros e lembranças continuam guardados, e você pode desfazer isso depois.</p>
    <label class="lbl" for="pd-d">Data (aproximada, se preferir)</label><input class="in" type="date" id="pd-d" value="${todayISO()}" max="${todayISO()}">
    <button class="btn full" style="margin-top:12px" onclick="salvarPerda()">Registrar</button>
    <button class="btn sec full" style="margin-top:8px" onclick="closeModal()">Agora não</button>`);
}
function salvarPerda() {
  const d = val('pd-d'); if (!d || d > todayISO()) return fieldErr('pd-d', 'Confira a data');
  const sem = Math.max(0, C.gaFrom(S().gestacao, d).w);
  Store.setGestacao({ desfecho: { tipo: 'perda', data: d, semana: sem } });
  Notify.scheduleLocal([]); Notify.syncRemote(Store.backend, S().uid, []).catch(() => { });
  closeModal(); go('home');
}
function desfazerDesfecho() {
  confirmBox(fase() === 'perda' ? 'Desfazer o registro da perda e voltar ao acompanhamento da gestação?' : 'Desfazer o registro do nascimento e voltar ao acompanhamento da gestação?',
    () => { Store.setGestacao({ desfecho: null }); scheduleReminders(); go('home'); toast('Registro desfeito'); }, { yes: 'Desfazer' });
}
function iniciarNovaGestacao() {
  confirmBox('Começar o acompanhamento de uma nova gestação? Os registros anteriores ficam guardados na sua conta.', () => {
    Store.novaGestacao(); A.setupDraft = {}; showSetup('gest');
  }, { yes: 'Começar' });
}

/* =================== cabeçalho e início por fase =================== */
function renderHeaderFase() {
  const nome = esc(nomeExibicao());
  if (fase() === 'perda') {
    $('header').innerHTML = `<div class="top calma"><div class="hi">Oi, ${nome} 🤍</div><div class="name">Estamos aqui com você</div><div class="sub">No seu tempo, do seu jeito.</div></div>`;
    return;
  }
  const d = desfecho(), dia = diaPuerperio(), nomes = bebe();
  if (A.page && A.page !== 'home') { $('header').innerHTML = `<div class="top compact"><div style="flex:1;min-width:0"><div class="wk">Pós-parto · ${dia}º dia</div><div class="ft">${nomes ? esc(cap(nomes)) + ' · ' : ''}nascimento em ${fmt(d.data)}</div></div></div>`; return; }
  $('header').innerHTML = `<div class="top"><div class="hi">Oi, ${nome} 💜</div><div class="name">${nomes ? esc(cap(nomes)) + ' chegou' + (nBebes() > 1 ? 'am' : '') : 'Seu pós-parto'}</div>
    <div class="sub">Nascimento em ${fmt(d.data)} · ${dia}º dia do puerpério</div>
    <div class="weekbig"><div class="ilu-wrap">${Ilustra.bebes(tonsBebes(), { w: 64 })}</div><div style="flex:1"><div class="wk">${dia <= C.PUERPERIO.dias ? 'Puerpério' : 'Depois do puerpério'}</div>
      <div class="ft">${dia <= C.PUERPERIO.dias ? `O corpo leva cerca de ${C.PUERPERIO.dias} dias para se recuperar. Cuide de você também.` : 'A recuperação física costuma terminar por volta de 45 dias; o emocional pode levar mais tempo.'}</div>
      <div class="progbar"><i style="width:${Math.min(100, Math.round(dia / C.PUERPERIO.dias * 100))}%"></i></div></div></div></div>`;
}

const HUMOR = [['bem', '😊', 'Bem'], ['cansada', '🥱', 'Cansada'], ['triste', '😢', 'Triste'], ['ansiosa', '😰', 'Ansiosa'], ['ajuda', '🆘', 'Preciso de ajuda']];
function registrarHumor(k) {
  const h = (puerp().humor || []).filter(x => x.d !== todayISO()).concat({ d: todayISO(), h: k }).slice(-30);
  patchPuerp({ humor: h });
  if (k === 'ajuda') return modalApoio();
  renderHome(); toast('Obrigada por contar 💜');
}
function humorAlerta() {
  const ult = (puerp().humor || []).filter(x => C.diffDays(todayISO(), x.d) <= 14);
  const dificeis = ult.filter(x => ['triste', 'ansiosa', 'ajuda'].includes(x.h)).length;
  return dificeis >= 5 || (dificeis >= 3 && diaPuerperio() > 14);
}
function modalApoio() {
  const p = S().profile;
  openModal('💜 Você não está sozinha', `<p style="font-size:14px;line-height:1.55;margin:0 0 12px">Pedir ajuda é um gesto de cuidado. Se você tiver pensamentos de se machucar ou machucar o bebê, ou não conseguir cuidar de si ou dele, procure ajuda agora.</p>
    <a class="btn full" style="display:block;text-align:center;text-decoration:none;margin-bottom:8px" href="tel:188">📞 CVV 188 · 24 horas, gratuito</a>
    <a class="btn full" style="display:block;text-align:center;text-decoration:none;background:var(--bad);margin-bottom:8px" href="tel:192">📞 SAMU 192</a>
    ${p.contato_emergencia_tel ? `<a class="btn sec full" style="display:block;text-align:center;text-decoration:none" href="tel:${esc(p.contato_emergencia_tel)}">📞 ${esc(p.contato_emergencia_nome || 'Contato de confiança')}</a>` : ''}
    <p class="muted" style="font-size:12.5px;margin:12px 0 0">Orientação da Caderneta: procure sua UBS ou equipe de saúde para acompanhamento em saúde mental. Se já usava medicação, não pare por conta própria.</p>`);
}
function modalSinaisPuerperio() {
  openModal('🚨 O que você está sentindo?', `<p class="muted" style="font-size:13px;margin:0 0 12px">Marque o que estiver acontecendo <b>agora</b>:</p>
    ${C.PUERPERIO.sinais.map(([id, ic, t]) => `<label class="check" style="background:var(--bg);padding:10px;border-radius:12px;border:1px solid var(--line)"><input type="checkbox" class="dgp" value="${id}"><span><b>${ic} ${t}</b></span></label>`).join('')}
    <button class="btn full" onclick="sinaisPuerperioResultado()">Ver o que fazer</button>`);
}
function sinaisPuerperioResultado() {
  const ids = [...document.querySelectorAll('.dgp:checked')].map(e => e.value);
  if (!ids.length) { closeModal(); return toast('Nenhum sinal marcado. Se algo preocupa você, ligue para sua UBS ou maternidade 💜'); }
  if (ids.length === 1 && ids[0] === 'mental') return modalApoio();
  openModal('Procure atendimento', `<div class="alert urgente"><div class="ai">🚨</div><div><b class="t">Procure atendimento agora</b>
    <p>Pela Caderneta da Gestante, os sinais que você marcou pedem avaliação imediata no pós-parto. Vá à maternidade ou ao pronto atendimento, ou ligue para o SAMU.</p></div></div>
    <a class="btn full" style="display:block;text-align:center;text-decoration:none;background:var(--bad)" href="tel:192">📞 Ligar 192 (SAMU)</a>
    ${ids.includes('mental') ? '<a class="btn sec full" style="display:block;text-align:center;text-decoration:none;margin-top:8px" href="tel:188">📞 CVV 188</a>' : ''}`);
}
function registrarConsultaPuerp(id) {
  const c = Object.assign({}, puerp().consultas || {}); c[id] = c[id] ? null : todayISO(); patchPuerp({ consultas: c }); renderHome();
}
function toggleDocPuerp(i) { const d = Object.assign({}, puerp().docs || {}); d[i] = !d[i]; patchPuerp({ docs: d }); renderHome(); }
function interesseAppBebe() { patchPuerp({ app_bebe: true }); toast('Combinado! Avisaremos quando o app do bebê estiver pronto 💜'); renderHome(); }

function renderHomeFase() {
  if (fase() === 'perda') return renderHomePerda();
  const d = desfecho(), dia = diaPuerperio(), pc = puerp().consultas || {}, docs = puerp().docs || {}, hoje = (puerp().humor || []).find(x => x.d === todayISO());
  const cons = C.PUERPERIO.consultas.map(c => {
    const feita = !!pc[c.id], prazo = C.addDays(d.data, c.ate), atrasada = !feita && todayISO() > prazo;
    return `<div class="mission ${feita ? 'done' : ''}" role="button" tabindex="0" onclick="registrarConsultaPuerp('${c.id}')"><div class="mi"><i class="ph ph-stethoscope"></i></div>
      <div class="mt"><b>${c.nome}</b><span>${feita ? 'Feita em ' + fmt(pc[c.id]) : (atrasada ? 'Orientação: agende assim que puder · ' : '') + c.quando + ' (até ' + fmt(prazo) + ')'}</span></div><div class="chk">${feita ? '✓' : ''}</div></div>`;
  }).join('');
  const alerta = humorAlerta() ? `<div class="alert atencao"><div class="ai">💭</div><div><b class="t">Como você tem se sentido?</b><p>Você registrou vários dias difíceis. A Caderneta orienta conversar com a equipe de saúde quando a tristeza ou a ansiedade são intensas ou não passam. Isso não é fraqueza: é cuidado.</p>
    <div class="acts"><button onclick="modalApoio()">Onde buscar apoio</button></div></div></div>` : '';
  $('pg-home').innerHTML = `<div class="section-t"><i class="ph ph-heartbeat"></i> Centro de cuidado</div>${alerta}
    <button class="btn sec full" style="margin-bottom:6px" onclick="modalSinaisPuerperio()">🚨 Estou sentindo algo diferente</button>
    <div class="section-t"><i class="ph ph-smiley"></i> Como você está hoje?</div>
    <div class="card"><div class="humor">${HUMOR.map(([k, e, t]) => `<button class="${hoje && hoje.h === k ? 'on' : ''}" onclick="registrarHumor('${k}')" aria-label="${t}"><span>${e}</span>${t}</button>`).join('')}</div>
      <p class="muted" style="font-size:12px;margin:10px 0 0">${esc(C.PUERPERIO.emocoes.blues)}</p></div>
    <div class="section-t"><i class="ph ph-calendar-check"></i> Consultas do pós-parto</div><div class="card" style="padding:8px 14px">${cons}</div>
    <div class="section-t"><i class="ph ph-info"></i> O que costuma ser esperado</div>
    <div class="card"><ul class="lista">${C.PUERPERIO.comuns.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
      <p class="muted" style="font-size:12px;margin:8px 0 0">Dor intensa ou que não melhora não é esperada: procure avaliação.</p></div>
    <details class="card"><summary style="cursor:pointer"><b>💭 Baby blues ou depressão pós-parto?</b></summary><p style="font-size:13.5px;line-height:1.55">${esc(C.PUERPERIO.emocoes.blues)}</p><p style="font-size:13.5px;line-height:1.55">${esc(C.PUERPERIO.emocoes.depressao)}</p></details>
    <div class="section-t"><i class="ph ph-files"></i> Documentos e direitos</div>
    <div class="card" style="padding:8px 14px">${C.PUERPERIO.direitos.map((x, i) => `<div class="mission ${docs[i] ? 'done' : ''}" role="button" tabindex="0" onclick="toggleDocPuerp(${i})"><div class="mi"><i class="ph ph-check-square"></i></div><div class="mt"><b>${esc(x)}</b></div><div class="chk">${docs[i] ? '✓' : ''}</div></div>`).join('')}</div>
    <div class="section-t"><i class="ph ph-baby"></i> E ${nBebes() > 1 ? 'os bebês' : 'o bebê'}?</div>
    <div class="card"><p style="font-size:13.5px;line-height:1.55;margin:0 0 10px">Vacinas, crescimento e consultas de puericultura ficam na <b>Caderneta da Criança</b>, entregue na maternidade ou na UBS.</p>
      ${puerp().app_bebe ? '<p class="muted" style="font-size:12.5px;margin:0">💜 Você será avisada quando o app do bebê estiver pronto.</p>' : '<button class="btn sec full sm" onclick="interesseAppBebe()">Quero saber quando o app do bebê chegar</button>'}</div>
    <p class="muted" style="font-size:11px;text-align:center;margin-top:12px">Orientações da ${esc(C.PUERPERIO.fonte)}. Não substituem a avaliação da sua equipe.</p>`;
}

function renderHomePerda() {
  const P = C.PERDA, p = Store.planInfo, pago = p && (p.origem === 'passe' || p.origem === 'presente' || p.assinatura);
  const lista = arr => `<ul class="lista">${arr.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`;
  $('pg-home').innerHTML = `<div class="card calma" style="text-align:center"><div style="display:flex;justify-content:center">${Ilustra.cuidado({ w: 92 })}</div>
      <p style="font-size:15px;line-height:1.6;margin:8px 0 0">Não existe forma certa ou errada de sentir a perda. Você tem direito a cuidado, informação e ao tempo que precisar.</p></div>
    <div class="section-t"><i class="ph ph-heartbeat"></i> Cuide do seu corpo</div>
    <div class="card"><p style="font-size:13.5px;margin:0 0 6px">Procure atendimento se tiver:</p>${lista(P.corpo)}
      <a class="btn full" style="display:block;text-align:center;text-decoration:none;background:var(--bad);margin-top:10px" href="tel:192">📞 SAMU 192</a>
      <p class="muted" style="font-size:12px;margin:10px 0 0">Orientação: procure sua equipe ou a UBS o quanto antes para o acompanhamento depois da perda.</p></div>
    <div class="section-t"><i class="ph ph-heart"></i> O luto</div>
    <div class="card"><p style="font-size:13.5px;margin:0 0 6px">É comum sentir:</p>${lista(P.lutoComum)}
      <p style="font-size:13.5px;margin:10px 0 6px">Procure a equipe de saúde se perceber:</p>${lista(P.procurar)}
      <a class="btn sec full" style="display:block;text-align:center;text-decoration:none;margin-top:10px" href="tel:188">💜 CVV 188 · 24 horas, gratuito</a></div>
    <details class="card"><summary style="cursor:pointer"><b>⚖️ Seus direitos</b></summary>
      <p style="font-size:13px;margin:10px 0 6px">No SUS:</p>${lista(P.direitosSaude)}
      <p style="font-size:13px;margin:10px 0 6px">No trabalho:</p><ul class="lista">${P.trabalho.map(([a, b]) => `<li><b>${esc(a)}:</b> ${esc(b)}</li>`).join('')}</ul></details>
    ${pago ? `<div class="card"><b>Sobre o seu Ninho+</b><p class="muted" style="font-size:13px;line-height:1.5;margin:6px 0 10px">Você pode manter o acesso para uma próxima gestação ou pedir o reembolso proporcional, sem precisar explicar nada.</p>
      <a class="btn sec full sm" style="display:block;text-align:center;text-decoration:none" href="mailto:${esc(CFG.CONTATO_SUPORTE || CFG.CONTATO_PRIVACIDADE)}?subject=${encodeURIComponent('Ninho+ — reembolso ou manter acesso')}">Escrever para o suporte</a></div>` : ''}
    <div class="section-t"><i class="ph ph-leaf"></i> Quando, e se, você quiser</div>
    <div class="card">${Store.can('memorias') ? '<button class="btn sec full sm" style="margin-bottom:8px" onclick="go(\'me\')">Ver minhas lembranças</button>' : ''}
      <button class="btn sec full sm" style="margin-bottom:8px" onclick="iniciarNovaGestacao()">Acompanhar uma nova gestação</button>
      <button class="btn sec full sm" onclick="desfazerDesfecho()">Registrei por engano</button></div>
    <p class="muted" style="font-size:11px;text-align:center;margin-top:12px">${esc(P.fonte)}.</p>`;
}

/* =================== Jornada e Ajuda por fase =================== */
function renderTimelineFase() {
  if (fase() === 'perda') {
    $('pg-timeline').innerHTML = `<div class="section-t"><i class="ph ph-leaf"></i> Seu caminho</div>
      <div class="card"><p style="font-size:14px;line-height:1.6;margin:0">O luto não tem um tempo certo. Algumas pessoas querem guardar lembranças, outras preferem um tempo longe de tudo. As duas escolhas são legítimas.</p></div>
      <div class="card"><b>Você tem direito a</b><ul class="lista">${C.PERDA.direitosSaude.slice(0, 5).map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>
      <p class="muted" style="font-size:11px;text-align:center">${esc(C.PERDA.fonte)}.</p>`;
    return;
  }
  const dia = diaPuerperio();
  const etapas = [[1, 7, '🩹', 'Primeira semana', 'Descanso, sangramento que diminui aos poucos, mamas cheias. 1ª consulta pós-parto.'],
    [8, 30, '🌿', 'Até 30 dias', 'O corpo se recupera. Por volta de 30 dias, 2ª consulta pós-parto: converse também sobre contracepção.'],
    [31, 45, '🌼', 'Até 45 dias', 'Fim do puerpério físico. Retome atividades aos poucos, conforme orientação.'],
    [46, 9999, '💜', 'Depois', 'O puerpério emocional pode durar até dois anos. Continue cuidando de você.']];
  $('pg-timeline').innerHTML = `<div class="section-t"><i class="ph ph-path"></i> Seu pós-parto</div>
    <p class="muted" style="margin:-6px 0 14px;font-size:13.5px">Você está no ${dia}º dia depois do nascimento.</p>
    ${etapas.map(([a, b, e, t, s]) => `<div class="card" style="${dia >= a && dia <= b ? 'border:2px solid var(--violet)' : ''}"><div style="display:flex;gap:10px;align-items:center"><div style="font-size:26px">${e}</div><div><b>${t}</b><p class="muted" style="font-size:13px;margin:2px 0 0">${s}</p></div></div></div>`).join('')}
    <p class="muted" style="font-size:11px;text-align:center">${esc(C.PUERPERIO.fonte)}.</p>`;
}
function renderHelpFase() {
  const perda = fase() === 'perda';
  $('pg-help').innerHTML = `<div class="section-t"><i class="ph ph-first-aid-kit"></i> Emergência</div>
    <div class="row" style="margin-bottom:12px"><a class="btn sec" style="text-align:center;text-decoration:none" href="tel:192">📞 SAMU 192</a><a class="btn sec" style="text-align:center;text-decoration:none" href="tel:188">💜 CVV 188</a></div>
    ${perda ? '' : '<button class="btn full" style="background:var(--bad);margin-bottom:10px" onclick="modalSinaisPuerperio()">🚨 Estou sentindo algo — o que faço?</button>'}
    <div class="section-t"><i class="ph ph-warning"></i> Procure atendimento se tiver</div>
    ${(perda ? C.PERDA.corpo.map(t => ['⚠️', t]) : C.PUERPERIO.sinais.map(([, ic, t]) => [ic, t])).map(([ic, t]) => `<div class="danger"><div class="di">${ic}</div><div><b>${esc(t)}</b></div></div>`).join('')}
    <p class="muted" style="font-size:12px;text-align:center;margin-top:14px;line-height:1.5">Orientações da Caderneta da Gestante 2026. Não substituem a avaliação da equipe de saúde.</p>`;
}

/* =================== cartão no "Eu" =================== */
function faseCardEu() {
  const f = fase(), g = ga();
  if (f === 'gestacao') return `${g.w >= 20 ? `<button class="qa" style="margin-bottom:12px" onclick="modalNascimento()"><span class="qi"><i class="ph ph-baby"></i></span><span class="qt"><b>Meu bebê nasceu</b><span>O app passa a cuidar de você no pós-parto</span></span><i class="ph ph-caret-right chev"></i></button>` : ''}`;
  return `<div class="card"><h3>${f === 'perda' ? '🤍 Registro da perda' : '👶 Nascimento'}</h3><p class="muted" style="font-size:13px;margin:6px 0 10px">${f === 'perda' ? 'Registrado em ' : 'Em '}${fmt(desfecho().data)}.</p>
    <button class="btn sec full sm" style="margin-bottom:8px" onclick="iniciarNovaGestacao()">Acompanhar uma nova gestação</button>
    <button class="btn sec full sm" onclick="desfazerDesfecho()">Desfazer este registro</button></div>`;
}
function modalPerdaPlano() {
  openModal('Ninho+', `<p style="font-size:14px;line-height:1.55">Neste momento, o app mostra só o que pode ajudar você. Se você pagou o Ninho+, pode manter o acesso para uma próxima gestação ou pedir o reembolso proporcional, sem precisar explicar nada.</p>
    <a class="btn full" style="display:block;text-align:center;text-decoration:none" href="mailto:${esc(CFG.CONTATO_SUPORTE || CFG.CONTATO_PRIVACIDADE)}">Escrever para o suporte</a>`);
}
