/* =====================================================================
   NINHO — crescimento e Ninho+
   Planos (Passe Gestação, mensal, teste grátis), códigos (presente e
   indicação), modo família, kit do parto e diário da barriga.
   Usa funções e utilitários de app.js (carregado depois; tudo aqui só
   roda depois do boot). Regra de ouro mantida: texto da usuária → esc().
   ===================================================================== */
'use strict';

const appBase = () => location.origin + location.pathname.replace(/[^/]*$/, '');
const ORIGEM_PLANO = { teste: 'Teste grátis', passe: 'Passe Gestação', presente: 'Presente', indicacao: 'Bônus de indicação', manual: 'Cortesia' };

/* =================== PLANO =================== */
function planoResumo() {
  const p = Store.planInfo;
  if (p.assinatura) return p.periodo_fim ? 'Assinatura · renova em ' + fmt(p.periodo_fim) : 'Assinatura ativa';
  if (p.acesso_ate) return `${ORIGEM_PLANO[p.origem] || 'Ninho+'} · até ${fmt(p.acesso_ate)}`;
  return 'Todos os recursos liberados';
}

const PLUS_RECURSOS = [
  ['🔬', 'Exames da Caderneta', 'Resultados, gráficos e alertas de valores fora do esperado'],
  ['📸', 'Diário da barriga', 'Uma foto por semana e o vídeo da sua evolução'],
  ['👜', 'Kit do parto', 'Contador de contrações e mala da maternidade da Caderneta'],
  ['👨‍👩‍👧', 'Família por perto', 'Quem você convidar vê as fotos da barriga'],
  ['🖼️', 'Ultrassons com fotos', 'Álbum com os dados de cada laudo'],
  ['🏠', 'Diário em casa', 'Pressão, glicemia, peso e temperatura, com lembretes'],
  ['💊', 'Medicação', 'Aviso na hora de cada dose'],
  ['📝', 'Sintomas e perguntas', 'Tudo anotado para a próxima consulta'],
  ['🗒️', 'Plano de parto', 'Documento para levar à maternidade'],
  ['📄', 'Resumo em PDF', 'A gestação inteira num documento para a equipe'],
];

/** Passe Gestação até a semana RETA_FINAL_DESDE − 1; depois, Passe Reta Final (mais barato, porque falta menos tempo). */
/** Semana usada no preço: a datação menos adiantada entre a 1ª registrada e a atual (igual ao servidor). */
function semanaPreco() {
  const g = S() && S().gestacao; if (!g) return 0;
  const atual = ga().dpp, dpp = g.dpp_original && g.dpp_original > atual ? g.dpp_original : atual;
  return Math.floor((280 - C.diffDays(dpp, todayISO())) / 7);
}
function passeAtual() {
  const reta = S() && S().gestacao && semanaPreco() >= (CFG.RETA_FINAL_DESDE || 28) && CFG.PRECOS.reta_final;
  return reta ? { nome: 'Passe Reta Final', preco: CFG.PRECOS.reta_final, sub: `Para quem está a partir de ${CFG.RETA_FINAL_DESDE || 28} semanas` } : { nome: 'Passe Gestação', preco: CFG.PRECOS.passe, sub: '' };
}
function modalPremium() {
  if (fase() === 'perda') return modalPerdaPlano();
  const plus = Store.isPlus(), local = Store.backend.mode === 'local', p = Store.planInfo, ps = passeAtual();
  const lista = PLUS_RECURSOS.map(f => `<div class="list-item"><div class="li-ic">${f[0]}</div><div class="li-t"><b>${f[1]}</b><span>${f[2]}</span></div><div style="color:var(--violet)">✓</div></div>`).join('');
  const rodape = `<div class="row" style="margin-top:14px;gap:8px"><a class="btn sec sm" style="flex:1;text-align:center;text-decoration:none" href="presente.html" target="_blank" rel="noopener">🎁 Dar de presente</a><button class="btn sec sm" style="flex:1" onclick="modalCodigo()">🎟️ Tenho um código</button></div>
    <p class="muted" style="font-size:11.5px;text-align:center;margin-top:10px">Recursos de segurança são sempre gratuitos. Se o Ninho+ acabar, seus dados continuam seus para ver, baixar e excluir.</p>`;
  if (plus) {
    openModal('✨ Ninho+', `<div class="alert allgood"><div class="ai">💜</div><div><b class="t" style="color:var(--good)">Você tem o Ninho+</b><p style="margin:0">${esc(planoResumo())}</p></div></div>
      ${p.assinatura ? '<p class="muted" style="font-size:12.5px;text-align:center">Para cancelar ou trocar o cartão, use o link do Mercado Pago enviado por e-mail.</p>' : ''}
      ${!p.assinatura && p.acesso_ate && !local ? `<p class="muted" style="font-size:12.5px;text-align:center;margin:0 0 6px">Quer garantir até o fim da gestação?</p><button class="btn full" id="ck-p" onclick="checkout('passe')">${ps.nome} · ${esc(ps.preco)}</button>` : ''}
      ${local && p.assinatura ? '<button class="btn sec full" style="margin-top:8px" onclick="setDemoPlan(\'free\')">Voltar ao grátis (modo local)</button>' : ''}
      ${lista}${rodape}`);
    return;
  }
  openModal('✨ Ninho+', `<div class="card" style="background:var(--grad-soft)"><b>Grátis, para sempre</b><p class="muted" style="font-size:12.5px;margin:4px 0 0">Semana a semana, consultas, <b>curvas da Caderneta</b>, jornada com exames e vacinas, contador de movimentos, alertas, sinais de alerta, cartão de emergência e o card da semana para compartilhar.</p></div>
    ${Store.trialAvailable() ? `<button class="btn full" id="tr-b" onclick="startTrialUI()">🎁 Experimentar ${CFG.TESTE_DIAS || 7} dias grátis</button><p class="muted" style="font-size:11.5px;text-align:center;margin:6px 0 4px">Sem cartão e sem cobrança no fim. Uma vez por conta.</p>` : ''}
    <div class="price-card destaque"><span class="price-tag">Recomendado</span><b>${ps.nome}</b><div class="price">${esc(ps.preco)} <small>pagamento único</small></div>
      <span>${ps.sub ? ps.sub + ' · ' : ''}Pix ou cartão · vale até 3 meses depois do parto · sem renovação automática</span>
      ${local ? '' : `<button class="btn full" id="ck-p" style="margin-top:10px" onclick="checkout('passe')">Quero o ${ps.nome}</button>`}</div>
    <div class="price-card"><b>Mensal</b><div class="price">${esc(CFG.PRECOS.mensal)} <small>por mês</small></div><span>Cartão · cancele quando quiser</span>
      ${local ? '' : `<button class="btn sec full" id="ck-m" style="margin-top:10px" onclick="checkout('mensal')">Assinar mensal</button>`}</div>
    ${local ? `<button class="btn full" onclick="setDemoPlan('plus')">✨ Ativar Ninho+ (demonstração local)</button>` : ''}
    <div class="section-t" style="margin-top:16px"><i class="ph ph-sparkle"></i> O que vem no Ninho+</div>${lista}${rodape}`);
}
async function setDemoPlan(p) { await Store.backend.setDemoPlan(S().uid, p); await Store.refreshPlan(); closeModal(); toast(p === 'plus' ? '✨ Ninho+ ativado (demo)' : 'Plano grátis'); renderAll(); scheduleReminders(); }
async function checkout(ciclo) {
  await busy({ passe: 'ck-p', mensal: 'ck-m', anual: 'ck-a' }[ciclo], async () => {
    try { const url = await Store.backend.checkout(ciclo); if (!/^https:\/\//.test(url || '')) throw new Error('link'); location.href = url; }
    catch (e) { toast('Não foi possível abrir o pagamento agora. Tente novamente.'); }
  });
}
/** volta do Mercado Pago: o webhook pode levar alguns segundos; consulta o plano algumas vezes */
async function retornoPagamento(st) {
  if (st === 'falhou') return toast('O pagamento não foi concluído. Você pode tentar de novo quando quiser.');
  toast(st === 'pendente' ? 'Pagamento em processamento. Pix costuma confirmar em instantes.' : 'Confirmando seu pagamento…');
  for (let i = 0; i < 8; i++) {
    await new Promise(r => setTimeout(r, i ? 4000 : 1500));
    await Store.refreshPlan();
    if (Store.isPlus()) { renderAll(); confetti(40); return toast('✨ Ninho+ ativo! ' + planoResumo()); }
  }
  toast('Ainda não recebemos a confirmação. Assim que o pagamento for aprovado, o Ninho+ ativa sozinho.');
}

/* =================== TESTE GRÁTIS =================== */
async function startTrialUI() {
  await busy('tr-b', async () => {
    try {
      const r = await Store.startTrial();
      if (r && r.ok) { closeModal(); confetti(40); toast(`🎁 Ninho+ liberado até ${fmt(r.ate)}`); renderAll(); scheduleReminders(); }
      else toast(r && r.motivo === 'ja_plus' ? 'Você já tem o Ninho+ 💜' : 'O teste grátis já foi usado nesta conta.');
    } catch (e) { toast('Não foi possível iniciar o teste agora. Tente de novo.'); }
  });
}
const OFERTAS = {
  usg: { t: 'Seu 1º ultrassom já está aqui 💜', s: 'Para começar bem: use o Ninho+ por {d} dias, de graça. Guarde a foto do ultrassom, registre seus exames e comece o diário da barriga.' },
  s20: { t: 'Metade do caminho! 🎉', s: 'Você chegou às 20 semanas. Que tal registrar a barriga semana a semana e deixar a família acompanhar? Use o Ninho+ por {d} dias, de graça.' },
  s34: { t: 'A reta final chegou 👜', s: 'Contador de contrações, mala da maternidade da Caderneta e plano de parto: use o Ninho+ por {d} dias, de graça.' },
};
function offerTrial(m) {
  const o = OFERTAS[m]; if (!o || !Store.trialAvailable()) return;
  openModal(o.t, `<div style="text-align:center;font-size:52px;margin:-4px 0 6px">🎁</div><p style="text-align:center;margin:0 0 14px;line-height:1.5">${o.s.replace('{d}', CFG.TESTE_DIAS || 7)}</p>
    <button class="btn full" id="tr-b" onclick="startTrialUI()">Experimentar grátis</button><p class="muted" style="font-size:11.5px;text-align:center;margin:6px 0 8px">Sem cartão. Quando acabar, volta para o grátis sozinho.</p>
    <button class="btn sec full sm" onclick="closeModal()">Agora não</button>`);
}
/** no máximo uma oferta por abertura do app, só em momentos que fazem sentido */
function maybeOfferTrial() {
  if (fase() !== 'gestacao') return;
  if (A._ofertaFeita || !Store.trialAvailable() || $('modal-root').innerHTML) return;
  if ((A._alerts || []).some(a => a.sev === 'urgente')) return;
  const o = Store.prefs.ofertas || {}, g = ga(), gest = S().gestacao;
  const m = g.w >= 34 && !o.s34 ? 's34' : g.w >= 20 && g.w < 34 && !o.s20 ? 's20' : !o.usg && gest.metodo_ig === 'usg' && g.w < 20 ? 'usg' : null;
  if (!m) return;
  A._ofertaFeita = true;
  Store.patchPrefs({ ofertas: Object.assign({}, o, { [m]: todayISO() }) });
  setTimeout(() => { if (!$('modal-root').innerHTML) offerTrial(m); }, 1200);
}

/* =================== CÓDIGOS (presente e indicação) =================== */
function modalCodigo() {
  openModal('🎟️ Tenho um código', `<p class="muted" style="font-size:13px;margin:0 0 10px">Digite o código do <b>presente</b> (10 letras e números) ou o código de <b>indicação</b> de uma amiga (6).</p>
    <input class="in" id="cd-i" maxlength="14" autocapitalize="characters" autocomplete="off" placeholder="Ex.: ABCDE-23456" style="text-transform:uppercase;letter-spacing:2px;text-align:center;font-size:18px">
    <button class="btn full" id="cd-b" style="margin-top:10px" onclick="resgatarCodigo()">Ativar</button>`);
  setTimeout(() => { const i = $('cd-i'); if (i) i.focus(); }, 50);
}
const MOTIVO_CODIGO = {
  invalido: 'Código não encontrado. Confira as letras e números.', usado: 'Este presente já foi ativado.',
  nao_pago: 'O pagamento deste presente ainda não foi confirmado. Tente de novo em alguns minutos.',
  ja_usou: 'Você já usou um código de indicação.', proprio: 'Este é o seu próprio código 😉',
  prazo: 'Códigos de indicação valem nos primeiros 30 dias de conta.', online: 'Disponível na versão online do Ninho.',
};
async function resgatarCodigo() {
  const c = val('cd-i'); if (!c) return fieldErr('cd-i', 'Digite o código');
  await busy('cd-b', async () => {
    try {
      const r = await Store.redeemCode(c);
      if (!r.ok) return fieldErr('cd-i', MOTIVO_CODIGO[r.motivo] || 'Não foi possível usar este código.');
      closeModal(); confetti(50); renderAll();
      if (r.tipo === 'presente') openModal('🎁 Você ganhou um presente!', `<div style="text-align:center;font-size:56px">💝</div><p style="text-align:center;line-height:1.5"><b>${esc(r.de || 'Alguém especial')}</b> deu o Ninho+ para você.${r.mensagem ? `<br><i>“${esc(r.mensagem)}”</i>` : ''}</p><p class="muted" style="text-align:center;font-size:13px">Liberado até ${fmt(r.ate)}.</p><button class="btn full" onclick="closeModal()">Que lindo 💜</button>`);
      else toast(`💌 +${CFG.INDICACAO_DIAS || 30} dias de Ninho+, até ${fmt(r.ate)}. Sua amiga também ganhou!`);
    } catch (e) { toast('Não foi possível verificar o código agora. Tente de novo.'); }
  });
}

/* =================== INDICAÇÃO =================== */
async function compartilharTexto(texto, titulo) {
  try { if (navigator.share) { await navigator.share({ title: titulo || 'Ninho', text: texto }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
  window.open('https://wa.me/?text=' + encodeURIComponent(texto), '_blank', 'noopener');
}
function indicacaoCard() {
  const p = Store.planInfo, cod = p.codigo_indicacao;
  if (!cod || Store.backend.mode === 'local') return '';
  const pode = !p.indicacao_usada;
  return `<div class="card"><h3>💌 Indique uma amiga gestante</h3><p class="muted" style="font-size:13px;margin:6px 0 10px">Ela ganha ${CFG.INDICACAO_DIAS || 30} dias de Ninho+ ao usar seu código, e você também ganha ${CFG.INDICACAO_DIAS || 30} dias.</p>
    <div class="codigo-box" aria-label="Seu código">${esc(cod)}</div>
    <button class="btn full" style="margin-top:10px" onclick="compartilharIndicacao()">Enviar convite</button>
    ${p.indicadas ? `<p class="muted" style="font-size:12px;text-align:center;margin:8px 0 0">${p.indicadas} ${plural(p.indicadas, 'amiga entrou', 'amigas entraram')} com seu código 💜</p>` : ''}
    ${pode ? `<button class="btn sec full sm" style="margin-top:8px" onclick="modalCodigo()">Uma amiga me indicou</button>` : ''}</div>`;
}
function compartilharIndicacao() {
  const cod = Store.planInfo.codigo_indicacao;
  compartilharTexto(`Estou acompanhando minha gestação no Ninho, feito com base na Caderneta da Gestante 💜 Use meu código ${cod} e ganhe ${CFG.INDICACAO_DIAS || 30} dias de Ninho+: ${appBase()}`, 'Ninho');
}

/* =================== MODO FAMÍLIA =================== */
const linkFamilia = t => appBase() + 'familia.html#' + t;
const PAPEIS = [['parceria', 'Parceria', '💞'], ['avos', 'Avós', '👵'], ['tios', 'Tias e tios', '🧑‍🤝‍🧑'], ['irmaos', 'Irmãos', '🧒'], ['amigos', 'Amigas e amigos', '🤗'], ['familia', 'Família', '🏡']];
const papelDe = k => PAPEIS.find(p => p[0] === k) || PAPEIS[5];
async function modalFamilia() {
  const T = '👨‍👩‍👧 Família por perto';
  openModal(T, '<p class="muted" style="text-align:center">Carregando…</p>');
  let lista, recados = [];
  try { [lista, recados] = await Promise.all([Store.backend.familyList(), Store.backend.familyMessages().catch(() => [])]); }
  catch (e) { return openModal(T, '<p class="muted">Não foi possível carregar agora. Verifique a internet.</p>'); }
  if (lista === null) return openModal(T, '<p class="muted">Os convites da família funcionam na versão online do Ninho.</p>');
  A._fam = lista; A._rec = recados || []; const plus = Store.isPlus();
  const novos = A._rec.filter(r => !r.lido_em);
  const pausa = fase() === 'perda' ? `<div class="alert info" style="margin-bottom:12px"><div class="ai">🤍</div><div><b class="t">Convites em pausa</b><p style="margin:0">Quem tem o link vê só uma mensagem de carinho, sem semanas, bebê ou fotos. Você pode remover qualquer acesso abaixo.</p></div></div>` : '';
  openModal(T, `${pausa}<div style="display:flex;justify-content:center;margin:-4px 0 6px">${(fase() === 'perda' ? Ilustra.cuidado({ w: 84 }) : Ilustra.familia(Object.assign({}, Store.prefs.tons, { bebe: tonsBebes() }), { w: 220 }))}</div>
    <p class="muted" style="font-size:13px;margin:0 0 12px">Cada pessoa recebe um link próprio. Ela acompanha as semanas, o tamanho do bebê e a contagem regressiva, recebe dicas de como apoiar você e pode deixar recados — sem precisar de conta.
      <b>Exames, consultas e dados de saúde nunca aparecem.</b></p>
    ${A._rec.length ? `<div class="section-t" style="margin-top:4px"><i class="ph ph-envelope-simple-open"></i> Recados ${novos.length ? `<span class="pill v">${novos.length} novo${novos.length > 1 ? 's' : ''}</span>` : ''}</div>
      <div class="card" style="padding:8px 14px;max-height:260px;overflow:auto">${A._rec.map(r => `<div class="list-item"><div class="li-ic">💌</div><div class="li-t"><b>${esc(r.autor)}</b><span style="white-space:pre-wrap">${esc(r.texto)}</span><span class="muted" style="font-size:11px">${fmtDT(r.created_at)}</span></div>
        <button class="x" aria-label="Apagar recado de ${esc(r.autor)}" onclick="apagarRecado('${r.id}')">×</button></div>`).join('')}</div>` : ''}
    ${lista.length ? `<div class="section-t"><i class="ph ph-users-three"></i> Quem acompanha</div>` + lista.map(c => `<div class="list-item"><div class="li-ic">${papelDe(c.papel)[2]}</div><div class="li-t"><b>${esc(c.nome)}</b><span>${papelDe(c.papel)[1]} · ${c.ultimo_acesso ? 'viu em ' + fmtDT(c.ultimo_acesso) : 'ainda não abriu'}${c.ver_fotos ? ' · vê as fotos' : ''}</span></div>
        <button class="btn sec sm" onclick="enviarConvite('${c.id}')">Enviar</button><button class="x" aria-label="Remover acesso de ${esc(c.nome)}" onclick="revogarConvite('${c.id}')">×</button></div>`).join('') : ''}
    ${fase() === 'perda' ? '' : `<div class="card" style="margin-top:12px"><label class="lbl" for="fm-n">Para quem é o convite?</label><input class="in" id="fm-n" maxlength="60" placeholder="Ex.: Vovó Lúcia">
      <label class="lbl" for="fm-p">Quem é essa pessoa para você?</label><select class="in" id="fm-p">${opt(PAPEIS.map(p => [p[0], p[2] + ' ' + p[1]]), 'familia')}</select>
      <label class="chk-line" style="display:flex;gap:8px;align-items:center;margin-top:10px;font-size:13.5px"><input type="checkbox" id="fm-f" ${plus ? '' : 'disabled'}> Pode ver as fotos da barriga ${plus ? '' : plusTag()}</label>
      <button class="btn full" id="fm-b" style="margin-top:10px" onclick="criarConvite()">Criar e enviar link</button></div>`}`);
  if (novos.length) novos.forEach(r => Store.backend.familyMessageUpdate(r.id, { lido_em: new Date().toISOString() }).catch(() => { }));
}
function apagarRecado(id) {
  confirmBox('Apagar este recado?', async () => {
    try { await Store.backend.familyMessageUpdate(id, { deleted_at: new Date().toISOString() }); modalFamilia(); } catch (e) { toast('Não foi possível apagar agora.'); }
  }, { danger: true, yes: 'Apagar' });
}
async function criarConvite() {
  const n = val('fm-n'); if (!n) return fieldErr('fm-n', 'Escreva o nome de quem vai receber');
  await busy('fm-b', async () => {
    try { const c = await Store.backend.familyCreate(n, !!($('fm-f') && $('fm-f').checked && Store.isPlus()), val('fm-p') || 'familia'); A._fam = (A._fam || []).concat(c); earn('familia', 20, 'Família por perto 👨‍👩‍👧'); await modalFamilia(); enviarConvite(c.id); }
    catch (e) { toast('Não foi possível criar o convite agora.'); }
  });
}
function enviarConvite(id) {
  const c = (A._fam || []).find(x => x.id === id); if (!c) return;
  compartilharTexto(`${c.nome}, ${nomeExibicao()} convidou você para acompanhar a gestação${bebe() ? ' de ' + cap(bebe()) : ''} no Ninho 💜 ${linkFamilia(c.token)}`, 'Ninho — família');
}
function revogarConvite(id) {
  const c = (A._fam || []).find(x => x.id === id); if (!c) return;
  confirmBox(`Remover o acesso de ${esc(c.nome)}? O link deixa de funcionar na hora.`, async () => {
    try { await Store.backend.familyUpdate(id, { revogado_em: new Date().toISOString() }); toast('Acesso removido'); modalFamilia(); } catch (e) { toast('Não foi possível remover agora.'); }
  }, { danger: true, yes: 'Remover' });
}

/* =================== KIT DO PARTO =================== */
/* Mala e preparação: lista da Caderneta 2026 ("Documentos importantes e bolsa para a maternidade") */
const MALA = [
  ['Documentos e bolsa', [['doc', 'Documento de identidade ou certidão de nascimento'], ['cpf', 'CPF'], ['cad', 'Caderneta da Gestante'], ['plano', 'Plano de parto preenchido'],
    ['roupa_mae', 'Roupas confortáveis para você'], ['higiene', 'Absorventes e itens de higiene pessoal'], ['roupa_bebe', 'Roupas para o bebê'], ['fraldas', 'Fraldas para o bebê']]],
  ['Organização prévia', [['acomp', 'Pessoa que vai acompanhar você no parto'], ['filhos', 'Quem ficará com outros filhos ou filhas, se houver']]],
  ['Sobre o local do parto', [['mat', 'Sei qual é minha maternidade ou CPN de referência'], ['caminho', 'Endereço e como chegar anotados'], ['ubs', 'Conversei com a UBS sobre quando procurar a maternidade']]],
  ['Estudo e trabalho', [['atestado', 'Pedi atestado para afastamento escolar ou universitário (se for o caso)'], ['licenca', 'Organizei trabalho e licença']]],
  ['Depois do parto', [['ajuda_comida', 'Combinei ajuda com alimentação e cuidados nos primeiros dias'], ['ajuda_dia', 'Pensei em quem pode ajudar no dia a dia']]],
  ['Conversas importantes', [['conv_plano', 'Conversei com a equipe sobre o plano de parto'], ['conv_amam', 'Tirei dúvidas sobre amamentação'], ['conv_puerp', 'Conversei sobre o puerpério e os cuidados após o nascimento']]],
  ['Sugestões do Ninho', [['carregador', 'Carregador de celular'], ['lanche', 'Lanche leve e garrafinha de água'], ['chinelo', 'Chinelo e meias'], ['saida', 'Roupinha de saída do bebê e manta']]],
];
const KIT_ABAS = [['quando', 'Quando ir'], ['contracoes', 'Contrações'], ['mala', 'Mala'], ['indo', 'Estou indo']];
function modalKit(aba) {
  A.kitAba = aba || A.kitAba || 'quando';
  const tabs = `<div class="chip-row" role="tablist" style="margin:0 0 12px">${KIT_ABAS.map(([id, t]) => `<button class="chip ${A.kitAba === id ? 'on' : ''}" role="tab" aria-selected="${A.kitAba === id}" onclick="modalKit('${id}')">${t}${['contracoes', 'mala'].includes(id) && !Store.isPlus() ? ' 🔒' : ''}</button>`).join('')}</div>`;
  const corpo = { quando: kitQuando, contracoes: kitContracoes, mala: kitMala, indo: kitIndo }[A.kitAba]();
  openModal('👜 Kit do parto', tabs + `<div id="kit-body">${corpo}</div>`, { onClose: () => clearInterval(A._ctT) });
  if (A.kitAba === 'contracoes') ctTick();
}
function kitQuando() {
  return `<div class="alert urgente" style="margin-top:0"><div class="ai">🏥</div><div><b class="t">Vá para a maternidade quando</b><ul style="margin:6px 0 0;padding-left:18px;line-height:1.55;font-size:13.5px">
      <li>as contrações ficarem <b>fortes, regulares, a cada 2 a 3 minutos e durando mais de 30 segundos</b> (fase ativa);</li>
      <li>a bolsa romper — ou se houver dúvida. Líquido <b>verde ou amarelo</b> precisa de avaliação;</li>
      <li>aparecer qualquer <b>sinal de alerta</b>: sangramento, bebê mexendo menos, febre, dor de cabeça forte, pressão alta.</li></ul></div></div>
    <div class="card"><b>Contrações de treinamento (pródromos)</b><p class="muted" style="font-size:13px;margin:4px 0 0">Irregulares, curtas (cerca de 20 segundos), com intervalos longos, vão e voltam por horas ou dias. Fazem parte da preparação do corpo e ainda não são o trabalho de parto ativo. Pode sair o tampão mucoso.</p></div>
    <div class="card"><b>Fase latente</b><p class="muted" style="font-size:13px;margin:4px 0 0">Contrações parecidas com cólica, em ondas, ainda irregulares — em média a cada 5 a 6 minutos — que não desaparecem mais. Sempre que possível, fique em casa: descanso, alimentação leve, banho morno, massagem e apoio de pessoas de confiança.</p></div>
    <p class="muted" style="font-size:12px">Você não precisa ter certeza: ser avaliada faz parte de um cuidado seguro. Fonte: Caderneta da Gestante 2026, “Acompanhando o trabalho de parto”.</p>
    <button class="btn sec full" onclick="modalKit('indo')">🚗 Estou indo para a maternidade</button>`;
}
/* ---- contador de contrações (Plus) — fica só no aparelho ---- */
const ctKey = () => 'ninho.contracoes.' + S().uid;
function ctList() { try { return JSON.parse(localStorage.getItem(ctKey())) || []; } catch (e) { return []; } }
function ctSave(l) { try { localStorage.setItem(ctKey(), JSON.stringify(l.slice(-60))); } catch (e) { } }
const mmss = ms => { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
/** lê as últimas contrações e diz se o padrão parece fase ativa (Caderneta: a cada 2–3 min, > 30 s) */
function ctAnalise(l) {
  const fim = l.filter(c => c.f), ult = fim.slice(-4);
  if (ult.length < 3) return null;
  const ints = []; for (let i = 1; i < ult.length; i++) ints.push(ult[i].i - ult[i - 1].i);
  const mInt = ints.reduce((a, b) => a + b, 0) / ints.length, mDur = ult.reduce((a, c) => a + (c.f - c.i), 0) / ult.length;
  const recente = Date.now() - ult[ult.length - 1].f < 20 * 60e3;
  if (!recente) return null;
  if (mInt <= 3.5 * 60e3 && mDur >= 30e3 && Math.max(...ints) <= 4 * 60e3) return { nivel: 'ativa', mInt, mDur };
  return { nivel: mInt <= 7 * 60e3 ? 'latente' : 'treino', mInt, mDur };
}
function kitContracoes() {
  if (!Store.isPlus()) return lockCard('Contador de contrações', 'Marque o início e o fim de cada contração e veja intervalo e duração. O app avisa quando o padrão parece de fase ativa.') +
    (Store.trialAvailable() ? `<button class="btn full" id="tr-b" style="margin-top:10px" onclick="startTrialUI()">Experimentar ${CFG.TESTE_DIAS || 7} dias grátis</button>` : '');
  const l = ctList(), em = l.length && !l[l.length - 1].f, an = ctAnalise(l);
  const msg = !an ? '<p class="muted" style="font-size:12.5px;text-align:center;margin:8px 0 0">Registre ao menos 3 contrações para ver o padrão.</p>'
    : an.nivel === 'ativa' ? `<div class="alert urgente" style="margin-top:12px"><div class="ai">🏥</div><div><b class="t">Padrão de fase ativa</b><p style="margin:0">Intervalo médio ${mmss(an.mInt)} e duração ${mmss(an.mDur)}. Pela Caderneta, é hora de ir para a maternidade.</p><button class="btn sm" style="margin-top:8px" onclick="modalKit('indo')">Estou indo</button></div></div>`
    : `<div class="alert info" style="margin-top:12px"><div class="ai">⏱️</div><div><b class="t">${an.nivel === 'latente' ? 'Parece fase latente' : 'Contrações espaçadas'}</b><p style="margin:0">Intervalo médio ${mmss(an.mInt)}, duração ${mmss(an.mDur)}. Observe em casa, descanse e beba água. Se aparecer sinal de alerta ou a bolsa romper, vá para a maternidade.</p></div></div>`;
  const ultimas = l.filter(c => c.f).slice(-8).reverse();
  return `<div style="text-align:center"><div class="ct-timer" id="ct-t">${em ? mmss(Date.now() - l[l.length - 1].i) : '0:00'}</div>
      <button class="btn full ${em ? 'btn-bad' : ''}" style="font-size:18px;padding:18px" onclick="ctToggle()">${em ? '⏹ Terminou' : '▶ Começou uma contração'}</button></div>
    ${msg}
    ${ultimas.length ? `<table class="ct-tab"><tr><th>Início</th><th>Duração</th><th>Intervalo</th></tr>${ultimas.map(c => { const i = l.indexOf(c), ant = l.slice(0, i).reverse().find(x => x.f); return `<tr><td>${new Date(c.i).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</td><td>${mmss(c.f - c.i)}</td><td>${ant ? mmss(c.i - ant.i) : '—'}</td></tr>`; }).join('')}</table>
      <button class="btn sec full sm" style="margin-top:10px" onclick="confirmBox('Apagar o histórico de contrações?',()=>{ctSave([]);modalKit('contracoes')},{danger:true,yes:'Apagar'})">Limpar histórico</button>` : ''}
    <p class="muted" style="font-size:11.5px;margin-top:10px">O contador ajuda a observar, mas não substitui a avaliação. Na dúvida, procure a maternidade. Os registros ficam só neste aparelho.</p>`;
}
function ctToggle() {
  if (!Store.isPlus()) return modalPremium();
  const l = ctList(), now = Date.now();
  if (l.length && !l[l.length - 1].f) l[l.length - 1].f = now; else l.push({ i: now });
  ctSave(l); if (navigator.vibrate) navigator.vibrate(40); modalKit('contracoes');
}
function ctTick() {
  clearInterval(A._ctT);
  A._ctT = setInterval(() => { const e = $('ct-t'); if (!e) return clearInterval(A._ctT); const l = ctList(); if (l.length && !l[l.length - 1].f) e.textContent = mmss(Date.now() - l[l.length - 1].i); }, 500);
}
/* ---- mala (Plus) ---- */
function kitMala() {
  if (!Store.isPlus()) return lockCard('Mala da maternidade', 'A lista da Caderneta para marcar item por item: documentos, bolsa, local do parto e conversas importantes.') +
    `<div class="card" style="margin-top:10px"><b>Prévia</b><p class="muted" style="font-size:13px;margin:4px 0 0">${MALA[0][1].map(i => esc(i[1])).join(' · ')}…</p></div>`;
  const m = Store.prefs.mala || {}, tot = MALA.reduce((a, s) => a + s[1].length, 0), feitos = MALA.reduce((a, s) => a + s[1].filter(i => m[i[0]]).length, 0);
  return `<div class="progbar" style="background:var(--line);margin:0 0 6px"><i style="width:${feitos / tot * 100}%;background:var(--grad)"></i></div><p class="muted" style="font-size:12.5px;margin:0 0 10px">${feitos} de ${tot} prontos</p>
    ${MALA.map(([sec, itens]) => `<b style="font-size:13px;display:block;margin:12px 0 4px">${sec}</b>${itens.map(([id, t]) => `<div class="mission ${m[id] ? 'done' : ''}" style="margin:5px 0" role="button" tabindex="0" onclick="toggleMala('${id}')"><div class="mt"><b style="font-weight:600">${esc(t)}</b></div><div class="chk">${m[id] ? '✓' : ''}</div></div>`).join('')}`).join('')}
    <p class="muted" style="font-size:11.5px;margin-top:10px">Lista da Caderneta da Gestante 2026 (“Documentos importantes e bolsa para a maternidade”), mais algumas sugestões do Ninho.</p>`;
}
function toggleMala(id) {
  if (needPlus('mala')) return;
  const m = Object.assign({}, Store.prefs.mala); m[id] = !m[id]; Store.patchPrefs({ mala: m });
  if (MALA.every(s => s[1].every(i => m[i[0]]))) earn('mala', 30, 'Mala pronta 👜');
  const b = $('kit-body'); if (b) b.innerHTML = kitMala();
}
/* ---- estou indo (grátis) ---- */
function kitIndo() {
  const p = S().profile, g = ga(), b = S().gestacao.plano_parto || {}, temPlano = Object.keys(b).filter(k => b[k]).length;
  const tel = onlyDigits(p.contato_emergencia_tel);
  return `<div class="card" style="background:var(--grad);color:#fff;text-align:center"><div style="font-size:40px">🚗</div><h2 style="color:#fff;margin:4px 0">A caminho da maternidade</h2>
      <div style="opacity:.92;font-size:14px">${g.w} semanas e ${g.d} dias${p.maternidade_referencia ? '<br>' + esc(p.maternidade_referencia) : ''}</div></div>
    <div class="card"><b>Leve com você</b><p class="muted" style="font-size:13px;margin:4px 0 0">Documento com foto, CPF, Caderneta da Gestante${temPlano ? ', plano de parto' : ''} e a bolsa da maternidade. Você tem direito a um acompanhante de sua escolha.</p></div>
    ${tel ? `<a class="btn full" style="text-decoration:none;text-align:center;display:block" href="tel:${tel}">📞 Ligar para ${esc(p.contato_emergencia_nome || 'contato de emergência')}</a>` : ''}
    <button class="btn sec full" style="margin-top:8px" onclick="avisarFamiliaIndo()">💬 Avisar a família</button>
    <button class="btn sec full" style="margin-top:8px" onclick="closeModal();showEmergCard()">🆘 Cartão de emergência</button>
    ${temPlano ? `<button class="btn sec full" style="margin-top:8px" onclick="printBirthPlan()">📝 Mostrar plano de parto</button>` : ''}
    <a class="btn full btn-bad" style="margin-top:8px;text-decoration:none;text-align:center;display:block" href="tel:192">🚑 SAMU 192</a>
    <p class="muted" style="font-size:12px;margin-top:10px">Sangramento intenso, convulsão, desmaio ou falta de ar: ligue 192.</p>`;
}
function avisarFamiliaIndo() { compartilharTexto(`Estou indo para a maternidade${S().profile.maternidade_referencia ? ' (' + S().profile.maternidade_referencia + ')' : ''} 💜 Depois dou notícias!`, 'Ninho'); }
function kitCardHome() {
  const g = ga(); if (g.w < 34 || fase() !== 'gestacao') return '';
  return `<div class="card" role="button" tabindex="0" onclick="modalKit()" style="display:flex;align-items:center;gap:12px;border:2px solid var(--violet)"><div style="font-size:30px">👜</div>
    <div style="flex:1"><b>Kit do parto</b><div class="muted" style="font-size:12.5px">Quando ir para a maternidade, contrações, mala e “estou indo”</div></div><span class="muted">›</span></div>`;
}

/* =================== DIÁRIO DA BARRIGA =================== */
function fotosBarriga() { return L('memorias').filter(m => m.tipo === 'foto' && m.arquivo_path).sort((a, b) => (a.semana ?? 99) - (b.semana ?? 99) || a.created_at.localeCompare(b.created_at)); }
function memoriasCard() {
  const ms = L('memorias').slice().sort((a, b) => (b.semana ?? -1) - (a.semana ?? -1) || b.created_at.localeCompare(a.created_at));
  const g = ga(), fotos = fotosBarriga(), dessaSemana = fotos.some(f => f.semana === g.w);
  return `<div class="card"><h3>📸 Diário da barriga</h3>
    ${!dessaSemana ? `<div class="alert info" style="margin:8px 0"><div class="ai">📷</div><div><b class="t">Foto da semana ${g.w}</b><p style="margin:0">Mesmo lugar, mesma posição: o vídeo fica lindo no fim.</p></div></div>` : ''}
    <div class="row" style="margin:10px 0;gap:8px;flex-wrap:wrap"><button class="btn sm" onclick="modalMemoria('foto')">📷 Foto da barriga</button><button class="btn sec sm" onclick="modalMemoria('momento')">✨ Momento</button>
      ${fotos.length >= 2 ? `<button class="btn sec sm" onclick="modalVideoBarriga()">🎬 Vídeo da evolução</button>` : ''}</div>
    ${ms.length ? `<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">${ms.map(m => `<div style="background:var(--grad-soft);border-radius:16px;overflow:hidden;border:1px solid var(--line);position:relative">
      <button class="x" style="position:absolute;top:4px;right:4px;font-size:15px;color:#fff;background:rgba(0,0,0,.35);border-radius:50%;width:26px;height:26px;z-index:1" aria-label="Excluir memória" onclick="confirmBox('Excluir esta memória?',()=>{Store.remove('memorias','${m.id}');renderMe()},{danger:true,yes:'Excluir'})">×</button>
      ${m.arquivo_path ? `<button class="x" style="position:absolute;top:4px;left:4px;font-size:13px;color:#fff;background:rgba(0,0,0,.35);border-radius:50%;width:26px;height:26px;z-index:1" aria-label="Compartilhar" onclick="cardSemana('${m.id}')">↗</button><img data-path="${esc(m.arquivo_path)}" alt="" style="width:100%;height:120px;object-fit:cover;display:block;background:var(--line)">` : '<div style="height:120px;display:flex;align-items:center;justify-content:center;font-size:40px">✨</div>'}
      <div style="padding:9px"><b style="font-size:13px;display:block">${esc(m.titulo || (m.semana != null ? 'Semana ' + m.semana : 'Memória'))}</b><span style="font-size:11.5px;color:var(--muted)">${m.texto ? esc(m.texto) + ' · ' : ''}${m.semana != null ? m.semana + ' sem · ' : ''}${fmt(m.created_at)}</span></div></div>`).join('')}</div>` : '<p class="muted" style="font-size:13px;text-align:center">Seu álbum começa aqui 💜</p>'}</div>`;
}
/* ---- imagens em canvas ---- */
function loadImg(src) { return new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src; }); }
function coverDraw(ctx, img, x, y, w, h) { const r = Math.max(w / img.width, h / img.height), iw = img.width * r, ih = img.height * r; ctx.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih); }
function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function fundo(ctx, w, h) { const gr = ctx.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#7b4d72'); gr.addColorStop(1, '#c47f94'); ctx.fillStyle = gr; ctx.fillRect(0, 0, w, h); }
const FONTE = '-apple-system, "Segoe UI", Roboto, sans-serif';
/** card 1080×1350 para Instagram/WhatsApp. Com memória (Plus): usa a foto da barriga. */
async function desenharCard(mem) {
  const W = 1080, H = 1350, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const ctx = cv.getContext('2d');
  const sem = mem && mem.semana != null ? mem.semana : ga().w, [fr, nm] = C.frutaDa(sem), faltam = Math.max(0, C.diffDays(ga().dpp, todayISO()));
  fundo(ctx, W, H); ctx.textAlign = 'center'; ctx.fillStyle = '#fff';
  let topo = 150;
  if (mem && mem.arquivo_path) {
    const url = await Store.imageURL(mem.arquivo_path);
    if (url) { const img = await loadImg(url); ctx.save(); roundRect(ctx, 140, 110, 800, 800, 60); ctx.clip(); coverDraw(ctx, img, 140, 110, 800, 800); ctx.restore(); topo = 980; }
  }
  if (topo === 150) { ctx.font = `300px ${FONTE}`; ctx.fillText(fr, W / 2, 520); topo = 720; }
  ctx.font = `bold 120px Georgia, serif`; ctx.fillText(`${sem} semanas`, W / 2, topo + 40);
  ctx.font = `48px ${FONTE}`; ctx.globalAlpha = .95;
  ctx.fillText(`${bebe() ? cap(bebe()) : 'O bebê'} tem o tamanho de ${C.artigo(nm)} ${nm} ${topo > 900 ? fr : ''}`.trim(), W / 2, topo + 130);
  if (!mem || mem.semana === ga().w) ctx.fillText(faltam ? `faltam ${faltam} dias 💜` : 'chegou a hora 💜', W / 2, topo + 200);
  ctx.globalAlpha = .8; ctx.font = `36px ${FONTE}`; ctx.fillText('🪺 feito com o Ninho', W / 2, H - 60);
  return new Promise(ok => cv.toBlob(ok, 'image/jpeg', .9));
}
async function compartilharArquivo(blob, nome, texto) {
  const file = new File([blob], nome, { type: blob.type });
  try { if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], text: texto }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nome; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast('Imagem salva — compartilhe onde quiser 💜');
}
async function cardSemana(memId) {
  const mem = memId ? L('memorias').find(m => m.id === memId) : null;
  try {
    toast('Preparando o card…');
    const blob = await desenharCard(mem);
    openModal('📤 Card da semana', `<img src="${URL.createObjectURL(blob)}" alt="Card da semana" style="width:100%;border-radius:16px;display:block">
      <button class="btn full" style="margin-top:12px" onclick="compartilharCard()">Compartilhar</button>
      ${!mem && Store.isPlus() ? '<p class="muted" style="font-size:12px;text-align:center;margin:8px 0 0">Dica: no Diário da barriga, toque em ↗ numa foto para fazer o card com ela.</p>' : ''}
      ${!Store.isPlus() ? `<p class="muted" style="font-size:12px;text-align:center;margin:8px 0 0">Com o Ninho+, o card leva a foto da sua barriga. <a href="#" style="color:var(--violet)" onclick="event.preventDefault();modalPremium()">Conhecer</a></p>` : ''}`);
    A._card = blob; earn('card:' + ga().w, 5, 'Card criado 📤');
  } catch (e) { toast('Não foi possível criar o card agora.'); }
}
function compartilharCard() { if (A._card) compartilharArquivo(A._card, `ninho-semana-${ga().w}.jpg`, `${ga().w} semanas 💜`); }
/* ---- vídeo da evolução (Plus): canvas + MediaRecorder, tudo no aparelho ---- */
function formatoVideo() {
  if (!window.MediaRecorder) return null;
  return ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find(t => MediaRecorder.isTypeSupported(t)) || null;
}
function modalVideoBarriga() {
  if (needPlus('video_barriga')) return;
  const n = fotosBarriga().length;
  openModal('🎬 Vídeo da evolução', `<p class="muted" style="font-size:13px;margin:0 0 10px">${n} fotos da barriga, em ordem de semana, num vídeo vertical para os stories. Tudo é feito no seu aparelho.</p>
    <div id="vb-area" style="text-align:center"><canvas id="vb-c" width="540" height="960" style="width:100%;max-width:300px;border-radius:16px;background:#7b4d72"></canvas></div>
    <button class="btn full" id="vb-b" style="margin-top:12px" onclick="gerarVideoBarriga()">Criar vídeo</button>`);
}
async function gerarVideoBarriga() {
  const fotos = fotosBarriga(), cv = $('vb-c'); if (!cv || fotos.length < 2) return;
  const ctx = cv.getContext('2d'), W = cv.width, H = cv.height, tipo = formatoVideo();
  await busy('vb-b', async () => {
    const imgs = [];
    for (const f of fotos) { try { const u = await Store.imageURL(f.arquivo_path); if (u) imgs.push({ img: await loadImg(u), sem: f.semana }); } catch (e) { } }
    if (imgs.length < 2) return toast('Não consegui carregar as fotos. Verifique a internet.');
    const quadro = (i, alfa) => {
      const a = imgs[i], b = imgs[Math.min(i + 1, imgs.length - 1)];
      fundo(ctx, W, H); ctx.save(); roundRect(ctx, 30, 120, W - 60, H - 300, 28); ctx.clip();
      ctx.globalAlpha = 1; coverDraw(ctx, a.img, 30, 120, W - 60, H - 300);
      if (alfa > 0 && b !== a) { ctx.globalAlpha = alfa; coverDraw(ctx, b.img, 30, 120, W - 60, H - 300); }
      ctx.restore(); ctx.globalAlpha = 1; ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
      const sem = alfa > .5 ? b.sem : a.sem;
      ctx.font = 'bold 54px Georgia, serif'; ctx.fillText(sem != null ? `${sem} semanas` : '', W / 2, 85);
      ctx.font = `24px ${FONTE}`; ctx.globalAlpha = .85; ctx.fillText(`${bebe() ? 'Esperando ' + cap(bebe()) : 'Nossa espera'} · 🪺 Ninho`, W / 2, H - 70); ctx.globalAlpha = 1;
    };
    const fps = 30, porFoto = 1.1, fade = .35, total = imgs.length * porFoto + 1;
    const desenhar = t => { const i = Math.min(imgs.length - 1, Math.floor(t / porFoto)), r = t - i * porFoto; quadro(i, i < imgs.length - 1 && r > porFoto - fade ? (r - (porFoto - fade)) / fade : 0); };
    if (!tipo || !cv.captureStream) {          // sem gravação de vídeo: mostra a animação na tela
      const t0 = performance.now(); await new Promise(fim => { const loop = () => { const t = (performance.now() - t0) / 1000; desenhar(Math.min(t, total)); if (t < total) requestAnimationFrame(loop); else fim(); }; loop(); });
      return toast('Este navegador não grava vídeo. Grave a tela ou use o Chrome para baixar o vídeo.');
    }
    const rec = new MediaRecorder(cv.captureStream(fps), { mimeType: tipo, videoBitsPerSecond: 2.5e6 }), partes = [];
    rec.ondataavailable = e => e.data.size && partes.push(e.data);
    const pronto = new Promise(ok => { rec.onstop = ok; });
    rec.start(); const t0 = performance.now();
    await new Promise(fim => { const loop = () => { const t = (performance.now() - t0) / 1000; desenhar(Math.min(t, total)); if (t < total) requestAnimationFrame(loop); else fim(); }; loop(); });
    rec.stop(); await pronto;
    const blob = new Blob(partes, { type: tipo.split(';')[0] }), ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
    A._video = { blob, nome: `ninho-barriga.${ext}` };
    $('vb-area').innerHTML = `<video src="${URL.createObjectURL(blob)}" controls playsinline loop autoplay muted style="width:100%;max-width:300px;border-radius:16px"></video>`;
    $('vb-b').outerHTML = `<button class="btn full" style="margin-top:12px" onclick="compartilharArquivo(A._video.blob, A._video.nome, 'Nossa espera 💜')">Compartilhar vídeo</button>`;
    earn('video_barriga', 20, 'Vídeo criado 🎬');
  });
}
