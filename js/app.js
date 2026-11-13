/* =====================================================================
   NINHO — interface
   Depende de: config.js, clinical.js, store.js, alerts.js, notify.js
   Regra de ouro: TODO texto vindo da usuária passa por esc() antes de
   entrar em innerHTML.
   ===================================================================== */
'use strict';
const CFG = window.NINHO_CONFIG, C = window.Clin;
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const jsq = s => esc(String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/'/g, "\\'"));   // texto dentro de onclick='...'
const fmt = d => d ? String(d).slice(0, 10).split('-').reverse().join('/') : '—';
const fmtDT = iso => { if (!iso) return '—'; const d = new Date(iso); return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); };
const todayISO = () => C.toISODate(C.today());
const nowHM = () => { const d = new Date(); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
const val = id => { const e = $(id); return e ? String(e.value || '').trim() : ''; };
const num = id => { const v = val(id).replace(',', '.'); return v === '' ? null : (isNaN(+v) ? NaN : +v); };
const fmtTel = t => { const d = String(t || '').replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, ''); return d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : d.length === 10 ? `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}` : (t || ''); };
const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
const plural = (n, a, b) => n === 1 ? a : b;
const S = () => Store.S;
const L = t => Store.list(t);
const A = { page: 'home', recTab: 'consultas', setupDraft: {}, signup: {} };

/* =================== UI básica =================== */
let toastT;
function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2800); }
function confetti(n = 30) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const cols = ['#a26a86', '#cf9fbe', '#f2e8d4', '#6a4664', '#e8f0e9'];
  for (let i = 0; i < n; i++) { const c = document.createElement('div'); c.className = 'confetti'; c.style.left = Math.random() * 100 + 'vw'; c.style.background = cols[i % cols.length]; c.style.animation = `fall ${1 + Math.random()}s ${Math.random() * .3}s ease-in forwards`; document.body.appendChild(c); setTimeout(() => c.remove(), 2500); }
}
function openModal(title, body, { onClose } = {}) {
  A.modalClose = onClose || null;
  $('modal-root').innerHTML = `<div class="modal-bg" onclick="if(event.target===this)closeModal()"><div class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <div class="mh"><h2>${title}</h2><button class="x" onclick="closeModal()" aria-label="Fechar">×</button></div>${body}</div></div>`;
  const f = $('modal-root').querySelector('input:not([type=hidden]),select,textarea'); if (f && !('ontouchstart' in window)) f.focus();
}
function closeModal() { const cb = A.modalClose; A.modalClose = null; $('modal-root').innerHTML = ''; if (cb) cb(); }
function confirmBox(msg, onYes, { yes = 'Confirmar', danger = false } = {}) {
  A._confirm = onYes;
  openModal('Confirmar', `<p style="font-size:14.5px;line-height:1.5;margin:0 0 16px">${msg}</p>
   <button class="btn full" style="${danger ? 'background:var(--bad)' : ''}" onclick="const f=A._confirm;closeModal();f&&f()">${esc(yes)}</button>
   <button class="btn sec full" style="margin-top:8px" onclick="closeModal()">Cancelar</button>`);
}
function fieldErr(id, msg) { const e = $(id); if (e) { e.classList.add('err'); e.setAttribute('aria-invalid', 'true'); e.focus(); } toast(msg); return false; }
function empty(e, t, s) { return `<div class="empty"><span class="e">${e}</span><b>${t}</b><br><span style="font-size:13px">${s}</span></div>`; }
function opt(list, cur) { return list.map(o => { const [v, l] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(v)}" ${String(cur ?? '') === String(v) ? 'selected' : ''}>${esc(l)}</option>`; }).join(''); }
function plusTag() { return '<span class="plus-tag">✨ PLUS</span>'; }
function lockCard(titulo, sub) {
  return `<div class="card" style="text-align:center;border:1.5px dashed var(--line);background:var(--grad-soft)">
    <div style="font-size:34px">🔒</div><h3 style="margin:6px 0 2px">${titulo}</h3>
    <p class="muted" style="font-size:13px;margin:0 0 14px">${sub}</p>
    <button class="btn full" onclick="modalPremium()">✨ Conhecer o Ninho+</button></div>`;
}
function lockRow(ic, t, s) { return `<div class="lock-inline" role="button" tabindex="0" onclick="modalPremium()"><div style="font-size:24px">${ic}</div><div class="li-t"><b>${t} ${plusTag()}</b><span>${s}</span></div><span class="muted">›</span></div>`; }
function needPlus(feature) { if (Store.can(feature)) return false; modalPremium(); return true; }
function chart(id, cfg) {
  const cv = $(id); if (!cv) return null;
  if (!window.Chart) { cv.outerHTML = '<p class="muted" style="font-size:12.5px;text-align:center">Gráfico indisponível sem conexão. Os dados estão salvos.</p>'; return null; }
  Chart.defaults.font.family = "'Hanken Grotesk',-apple-system,sans-serif"; Chart.defaults.color = chartInk();
  return new Chart(cv, cfg);
}
const _dark = () => matchMedia('(prefers-color-scheme: dark)').matches;
const chartInk = () => _dark() ? '#b7aed6' : '#7c6b94';
const chartGrid = () => _dark() ? 'rgba(255,255,255,.09)' : '#efe8f0';
function destroyCharts() { if (window.Chart && Chart.instances) Object.values(Chart.instances).forEach(c => { try { c.destroy(); } catch (e) { } }); }

/* =================== Validações =================== */
const reEmail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
function onlyDigits(s) { return String(s || '').replace(/\D/g, ''); }
function validCPF(c) {
  c = onlyDigits(c); if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
  const dv = n => { let s = 0; for (let i = 0; i < n; i++) s += +c[i] * (n + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
  return dv(9) === +c[9] && dv(10) === +c[10];
}
function validCNS(c) { c = onlyDigits(c); if (c.length !== 15 || !/^[1-2789]/.test(c)) return false; let s = 0; for (let i = 0; i < 15; i++) s += +c[i] * (15 - i); return s % 11 === 0; }
function validPhone(p) { const d = onlyDigits(p); return d.length === 10 || d.length === 11 || (d.length >= 12 && d.length <= 13 && d.startsWith('55')); }
function strongPass(p) { return p.length >= 8 && /[A-Za-z]/.test(p) && /\d/.test(p); }

/* =================== Gestação / IG =================== */
function ga(ref) { return C.gaFrom(S().gestacao, ref); }
function metodoLabel(m) { return { usg: '1º ultrassom', dum: 'DUM', dpp: 'DPP informada' }[m] || ''; }
function nomeExibicao() { const p = S().profile; return cap((p.nome_social || p.nome_completo || 'mamãe').trim().split(/\s+/)[0]); }
function bebe() { return S().gestacao && S().gestacao.nome_bebe; }

/* =================== Gamificação (sem "farm" de gotas) =================== */
const BADGES = [
  { id: 'inicio', ic: '🪺', n: 'Bem-vinda' }, { id: 'consulta', ic: '🩺', n: '1ª Consulta' }, { id: 'curva', ic: '📈', n: 'Curvas em dia' },
  { id: 'vacina', ic: '💉', n: 'Vacinada' }, { id: 'movimentos', ic: '👶', n: 'Atenta ao bebê' }, { id: 'exame1', ic: '🔬', n: '1º Exame' },
  { id: 'eco', ic: '🖼️', n: 'Primeira eco' }, { id: 'perfil', ic: '📋', n: 'Caderneta completa' }, { id: 'guardia', ic: '🛡️', n: 'Guardiã' }];
const MISSOES = [
  { id: 'agua', ic: 'ph-drop', t: 'Beber água ao longo do dia', s: '+10 gotas · hidratação', g: 10 },
  { id: 'vitamina', ic: 'ph-pill', t: 'Tomar a suplementação prescrita', s: '+10 gotas · ácido fólico / ferro', g: 10 },
  { id: 'movimento', ic: 'ph-person-simple-walk', t: 'Movimentar o corpo (se liberado)', s: '+10 gotas · bem-estar', g: 10 },
  { id: 'humor', ic: 'ph-flower', t: 'Um momento de pausa para você', s: '+10 gotas · acolhimento', g: 10 }];
function earn(key, n, msg) {   // cada chave só rende gotas uma vez
  const gm = Store.game, got = gm.ganhos || {}; if (got[key]) return false;
  Store.patchGame({ gotas: (gm.gotas || 0) + n, ganhos: Object.assign({}, got, { [key]: 1 }) });
  if (msg) toast(msg + ` +${n} gotas 💧`); return true;
}
function award(id) {
  const gm = Store.game, b = gm.conquistas || []; if (b.includes(id)) return;
  Store.patchGame({ conquistas: b.concat(id) }); const x = BADGES.find(y => y.id === id); if (x) { setTimeout(() => toast(`🏅 Nova conquista: ${x.n}!`), 900); confetti(); }
}
function toggleMissao(id) {
  const k = todayISO(), gm = Store.game, m = Object.assign({}, gm.missoes || {}), dia = Object.assign({}, m[k] || {}), mi = MISSOES.find(x => x.id === id);
  const on = !dia[id]; dia[id] = on; m[k] = dia;
  for (const d of Object.keys(m)) if (C.diffDays(k, d) > 30) delete m[d];
  Store.patchGame({ missoes: m, gotas: Math.max(0, (gm.gotas || 0) + (on ? mi.g : -mi.g)) });
  if (on) toast(`💜 +${mi.g} gotas de cuidado`); renderHome();
}

/* =================== AUTENTICAÇÃO =================== */
function show(id) { ['boot', 'auth', 'setup', 'main'].forEach(x => $(x).classList.toggle('hidden', x !== id)); window.scrollTo(0, 0); }
function authShell(inner, step) {
  return `<div class="onb-logo">🪺</div><h1>Ninho</h1><div class="tag">sua gestação, no aconchego de um só lugar</div>
    ${step ? `<div class="steps">${[1, 2].map(i => `<i class="${i <= step ? 'on' : ''}"></i>`).join('')}</div>` : ''}
    <div class="step">${inner}</div>
    <div class="trust"><i class="ph ph-lock-simple"></i> Dados de saúde protegidos · LGPD</div>
    ${Store.backend && Store.backend.mode === 'local' ? '<div class="trust" style="margin-top:6px">⚙️ Modo local de desenvolvimento (sem servidor)</div>' : ''}`;
}
function showAuth(view = 'login', msg = '') {
  show('auth'); A.authView = view; const a = $('auth'); const e = msg ? `<div class="err" role="alert">${esc(msg)}</div>` : '';
  if (view === 'login') a.innerHTML = authShell(`
    <div class="tabs" role="tablist"><button class="on" role="tab">Entrar</button><button role="tab" onclick="showAuth('signup1')">Criar conta</button></div>${e}
    <div class="field"><label for="li-email">E-mail</label><input id="li-email" type="email" autocomplete="email" inputmode="email"></div>
    <div class="field"><label for="li-pass">Senha</label><input id="li-pass" type="password" autocomplete="current-password" onkeydown="if(event.key==='Enter')doLogin()"><label class="check" style="margin:8px 0 0;font-size:13px"><input type="checkbox" onchange="$('li-pass').type=this.checked?'text':'password'"> Mostrar senha</label></div>
    <button class="btn-primary" id="li-btn" onclick="doLogin()">Entrar</button>
    <button class="btn-ghost" onclick="showAuth('forgot')">Esqueci minha senha</button>`);
  if (view === 'signup1') { const s = A.signup; a.innerHTML = authShell(`
    <div class="tabs" role="tablist"><button role="tab" onclick="showAuth('login')">Entrar</button><button class="on" role="tab">Criar conta</button></div>${e}
    <p style="font-size:13.5px;opacity:.9;margin:-4px 0 14px">Seus dados de identificação, como na Caderneta da Gestante.</p>
    <div class="field"><label for="su-nome">Nome completo</label><input id="su-nome" autocomplete="name" value="${esc(s.nome || '')}" placeholder="Ex.: Fernanda Souza Lima"></div>
    <div class="row"><div class="field"><label for="su-nasc">Data de nascimento</label><input id="su-nasc" type="date" max="${todayISO()}" value="${esc(s.nasc || '')}"></div>
    <div class="field"><label for="su-tel">Celular</label><input id="su-tel" type="tel" inputmode="tel" autocomplete="tel" placeholder="(11) 98888-7777" value="${esc(s.tel || '')}"></div></div>
    <div class="field"><label for="su-email">E-mail</label><input id="su-email" type="email" inputmode="email" autocomplete="email" value="${esc(s.email || '')}"></div>
    <div class="field"><label for="su-pass">Senha</label><input id="su-pass" type="password" autocomplete="new-password" placeholder="mínimo 8, com letras e números"></div>
    <div class="field"><label for="su-pass2">Confirme a senha</label><input id="su-pass2" type="password" autocomplete="new-password"><label class="check" style="margin:8px 0 0;font-size:13px"><input type="checkbox" onchange="['su-pass','su-pass2'].forEach(i=>$(i).type=this.checked?'text':'password')"> Mostrar senha</label></div>
    <button class="btn-primary" onclick="signup1Next()">Continuar →</button>`, 1); }
  if (view === 'signup2') a.innerHTML = authShell(`${e}
    <div class="card-auth">
      <b style="font-size:16px">Sua privacidade</b>
      <ul style="font-size:13px;line-height:1.55;padding-left:18px;margin:8px 0 12px;opacity:.95">
        <li>Usamos seus dados <b>só</b> para acompanhar a sua gestação no app.</li>
        <li>Só você acessa seus registros. <b>Não vendemos</b> nem compartilhamos dados de saúde.</li>
        <li>Você pode baixar ou excluir tudo quando quiser, em “Eu → Privacidade”.</li>
      </ul>
      <label class="check"><input type="checkbox" id="cs-termos"> <span>Li e aceito os <a onclick="event.preventDefault();showLegal('termos')">Termos de Uso</a>.</span></label>
      <label class="check"><input type="checkbox" id="cs-priv"> <span>Li a <a onclick="event.preventDefault();showLegal('privacidade')">Política de Privacidade</a>.</span></label>
      <label class="check"><input type="checkbox" id="cs-saude"> <span><b>Autorizo</b> o tratamento dos meus <b>dados de saúde</b> (gestação, consultas, exames) para o acompanhamento no app — consentimento específico, LGPD art. 11.</span></label>
      <label class="check"><input type="checkbox" id="cs-notif" checked> <span>Quero receber lembretes (consultas, vacinas, exames). <small style="opacity:.8">Opcional</small></span></label>
      <label class="check"><input type="checkbox" id="cs-pesq"> <span>Aceito que dados <b>anonimizados</b> sejam usados em pesquisas para melhorar o cuidado. <small style="opacity:.8">Opcional</small></span></label>
    </div>
    ${A.signup.idade != null && A.signup.idade < 18 ? `<div class="warn" style="margin-top:12px">Você tem menos de 18 anos: peça para um responsável ler estas informações com você. Você tem direito a pré-natal e proteção — converse com a equipe da UBS${A.signup.idade < 14 ? '. Se precisar de ajuda, ligue <b>Disque 100</b> (gratuito)' : ''}.</div>` : ''}
    <button class="btn-primary" id="su-btn" style="margin-top:14px" onclick="doSignup()">Criar minha conta</button>
    <button class="btn-ghost" onclick="showAuth('signup1')">← Voltar</button>`, 2);
  if (view === 'confirm') a.innerHTML = authShell(`<div class="okbox">Conta criada! Enviamos um link de confirmação para <b>${esc(A.signup.email)}</b>. Abra o e-mail, confirme e depois entre aqui.</div>
    <button class="btn-primary" onclick="showAuth('login')">Já confirmei — entrar</button>`);
  if (view === 'forgot') a.innerHTML = authShell(`${e}<div class="field"><label for="fg-email">Seu e-mail</label><input id="fg-email" type="email" inputmode="email"></div>
    <button class="btn-primary" onclick="doForgot()">Enviar link</button><button class="btn-ghost" onclick="showAuth('login')">← Voltar</button>`);
  if (view === 'recovery') a.innerHTML = authShell(`${e}<div class="field"><label for="rc-pass">Nova senha</label><input id="rc-pass" type="password" autocomplete="new-password"></div>
    <button class="btn-primary" onclick="doRecovery()">Salvar nova senha</button>`);
  if (view === 'error') a.innerHTML = authShell(`${e}<button class="btn-primary" onclick="location.reload()">Tentar de novo</button>`);
}
async function busy(btnId, fn) { const b = $(btnId); const t = b && b.textContent; if (b) { b.disabled = true; b.textContent = 'Aguarde…'; } try { return await fn(); } finally { if (b && document.body.contains(b)) { b.disabled = false; b.textContent = t; } } }
async function doLogin() {
  const email = val('li-email'), pass = $('li-pass').value;
  if (!reEmail.test(email)) return fieldErr('li-email', 'Informe um e-mail válido');
  if (!pass) return fieldErr('li-pass', 'Informe a senha');
  await busy('li-btn', async () => { try { await Store.signIn({ email, password: pass }); route(); } catch (e) { showAuth('login', e.message); $('li-email').value = email; } });
}
function signup1Next() {
  const s = A.signup = { nome: val('su-nome'), nasc: val('su-nasc'), tel: val('su-tel'), email: val('su-email').toLowerCase() };
  const p1 = $('su-pass').value, p2 = $('su-pass2').value;
  if (s.nome.split(/\s+/).filter(Boolean).length < 2) return fieldErr('su-nome', 'Informe nome e sobrenome, como no documento');
  const idade = C.ageYears(s.nasc);
  if (!s.nasc || idade == null || idade < 10 || idade > 60) return fieldErr('su-nasc', 'Confira a data de nascimento');
  if (!validPhone(s.tel)) return fieldErr('su-tel', 'Informe um celular com DDD');
  if (!reEmail.test(s.email)) return fieldErr('su-email', 'Informe um e-mail válido');
  if (!strongPass(p1)) return fieldErr('su-pass', 'A senha precisa ter 8+ caracteres, com letras e números');
  if (p1 !== p2) return fieldErr('su-pass2', 'As senhas não conferem');
  s.idade = idade; A._pass = p1; showAuth('signup2');
}
async function doSignup() {
  if (!$('cs-termos').checked || !$('cs-priv').checked) return toast('Para criar a conta, aceite os Termos e a Política de Privacidade');
  if (!$('cs-saude').checked) return toast('Sem esta autorização não conseguimos guardar seus dados de gestação');
  const v = CFG.VERSAO_TERMOS, s = A.signup;
  const consentimentos = [['termos', true], ['privacidade', true], ['dados_saude', true], ['notificacoes', $('cs-notif').checked], ['pesquisa', $('cs-pesq').checked]].map(([tipo, aceito]) => ({ tipo, versao: v, aceito }));
  const meta = { nome_completo: s.nome, data_nascimento: s.nasc, telefone: onlyDigits(s.tel), consentimentos };
  await busy('su-btn', async () => {
    try {
      const r = await Store.signUp({ email: s.email, password: A._pass, meta }); A._pass = null;
      if (r.needsConfirm) return showAuth('confirm');
      Store.patchPrefs({ notifOptIn: $('cs-notif') ? $('cs-notif').checked : true }); award('inicio'); route();
    } catch (e) { showAuth('signup2', e.message); }
  });
}
async function doForgot() { const e = val('fg-email'); if (!reEmail.test(e)) return fieldErr('fg-email', 'Informe um e-mail válido'); try { const r = await Store.backend.resetPassword(e); showAuth('login'); toast(r.msg); } catch (x) { showAuth('forgot', x.message); } }
async function doRecovery() { const p = $('rc-pass').value; if (!strongPass(p)) return fieldErr('rc-pass', '8+ caracteres, com letras e números'); try { await Store.backend.updatePassword(p); toast('Senha atualizada 💜'); route(); } catch (e) { showAuth('recovery', e.message); } }

/* =================== TEXTOS LEGAIS (resumo; versão completa em docs/) =================== */
function showLegal(tipo) {
  const c = esc(CFG.CONTATO_PRIVACIDADE);
  const T = {
    termos: ['Termos de Uso', `<p>O Ninho é um <b>apoio</b> ao acompanhamento da gestação baseado na Caderneta Brasileira da Gestante (Ministério da Saúde). <b>Não substitui</b> consultas, exames ou a orientação da sua equipe de saúde, e não faz diagnóstico.</p>
      <p>Em situação de urgência, ligue <b>192 (SAMU)</b> ou procure a maternidade de referência.</p>
      <p>Você é responsável pelas informações que registra. Mantenha sua senha em sigilo.</p>
      <p>O plano gratuito inclui o acompanhamento, as curvas da Caderneta e os recursos de segurança. O Ninho+ é uma assinatura opcional, que pode ser cancelada a qualquer momento.</p>`],
    privacidade: ['Política de Privacidade', `<p><b>Quais dados:</b> identificação (nome, nascimento, contato e, se você quiser, CPF/CNS), dados da gestação e de saúde que você registra, e dados técnicos mínimos de acesso.</p>
      <p><b>Para quê:</b> somente para oferecer o acompanhamento no app, gerar suas curvas, alertas e lembretes. Base legal: consentimento específico para dados de saúde (LGPD art. 11, I) e execução do serviço.</p>
      <p><b>Quem acessa:</b> só você. Os dados ficam em servidor com criptografia em trânsito e em repouso, isolados por conta (Row Level Security). Não vendemos e não compartilhamos dados de saúde. Operadores: provedor de banco de dados/autenticação (Supabase) e, se você assinar, o processador de pagamento — que não recebe dados de saúde.</p>
      <p><b>Notificações:</b> por padrão não mostram dados de saúde na tela de bloqueio.</p>
      <p><b>Seus direitos:</b> acessar, corrigir, baixar (portabilidade), revogar consentimentos e excluir a conta, direto em “Eu → Privacidade e dados”. Dúvidas: ${c}.</p>
      <p><b>Retenção:</b> enquanto a conta existir. Ao excluir, tudo é apagado definitivamente.</p>`],
  }[tipo];
  openModal(T[0], `<div style="font-size:13.5px;line-height:1.6">${T[1]}<p class="muted" style="font-size:11.5px">Versão ${esc(CFG.VERSAO_TERMOS)}</p></div><button class="btn full" onclick="closeModal()">Entendi</button>`);
}

/* =================== ROTEAMENTO =================== */
function route() {
  if (!S()) return showAuth('login');
  const ct = Store.consentOf('termos'), cs = Store.consentOf('dados_saude');
  if (Store.backend.mode !== 'local' || S().consents.length) {
    if (!ct || ct.versao !== CFG.VERSAO_TERMOS || !ct.aceito || !cs || !cs.aceito) return showReconsent();
  }
  if (!S().gestacao) return showSetup('gest');
  showMain();
}
function showReconsent() {
  show('setup'); $('setup').innerHTML = authShell(`<div class="card-auth"><b style="font-size:16px">Atualizamos nossos termos</b>
    <p style="font-size:13px;opacity:.92">Para continuar, confirme a versão ${esc(CFG.VERSAO_TERMOS)}.</p>
    <label class="check"><input type="checkbox" id="rc-t"> <span>Aceito os <a onclick="event.preventDefault();showLegal('termos')">Termos de Uso</a> e li a <a onclick="event.preventDefault();showLegal('privacidade')">Política de Privacidade</a>.</span></label>
    <label class="check"><input type="checkbox" id="rc-s"> <span>Autorizo o tratamento dos meus dados de saúde para o acompanhamento no app.</span></label></div>
    <button class="btn-primary" style="margin-top:14px" onclick="if(!$('rc-t').checked||!$('rc-s').checked)return toast('Marque as duas opções para continuar');Store.addConsents([{tipo:'termos',versao:CFG.VERSAO_TERMOS,aceito:true},{tipo:'privacidade',versao:CFG.VERSAO_TERMOS,aceito:true},{tipo:'dados_saude',versao:CFG.VERSAO_TERMOS,aceito:true}]);route()">Continuar</button>
    <button class="btn-ghost" onclick="Store.signOut().then(()=>showAuth('login'))">Sair</button>`);
}

/* =================== CONFIGURAÇÃO DA GESTAÇÃO =================== */
function showSetup(view) {
  show('setup'); const d = A.setupDraft = Object.assign({ metodo_ig: 'usg', tipo_gravidez: 'unica' }, S().gestacao || {}, A.setupDraft);
  const el = $('setup');
  if (view === 'gest') {
    const m = d.metodo_ig, hoje = todayISO();
    const btn = (id, t, s) => `<button class="${m === id ? 'on' : ''}" onclick="A.setupDraft=Object.assign(collectGest(),{metodo_ig:'${id}'});showSetup('gest')">${t}<small>${s}</small></button>`;
    el.innerHTML = authShell(`
      <div class="field"><label>Olá, ${esc(nomeExibicao())}! Como vamos calcular a idade gestacional?</label>
        <div class="seg v">${btn('usg', '🩻 Pelo 1º ultrassom <span style="font-size:10px;background:#fff;color:#452f45;border-radius:8px;padding:1px 6px;margin-left:4px">RECOMENDADO</span>', 'Data do exame + idade gestacional do laudo')}
        ${btn('dum', '🌸 Pela última menstruação (DUM)', 'Primeiro dia da última menstruação')}
        ${btn('dpp', '🍼 Pela data provável do parto', 'Quando a equipe já informou a DPP')}</div></div>
      ${m === 'usg' ? `<div class="field"><label for="g-usg">Data do 1º ultrassom</label><input id="g-usg" type="date" max="${hoje}" value="${esc(d.usg_data || '')}" oninput="gestPreview()"></div>
        <div class="field"><label>Idade gestacional no laudo</label><div class="row"><input id="g-sem" type="number" inputmode="numeric" min="4" max="42" placeholder="semanas" value="${esc(d.usg_ig_semanas ?? '')}" oninput="gestPreview()"><input id="g-dias" type="number" inputmode="numeric" min="0" max="6" placeholder="dias" value="${esc(d.usg_ig_dias ?? '')}" oninput="gestPreview()"></div>
        <div class="hint">No laudo aparece algo como “IG: 8 semanas e 3 dias” (pelo CCN). O ideal é o ultrassom feito entre 7 e 12 semanas.</div></div>
        <div class="field"><label for="g-dum">Data da última menstruação <span style="opacity:.75;font-weight:500">(opcional, para comparar)</span></label><input id="g-dum" type="date" max="${hoje}" value="${esc(d.dum || '')}" oninput="gestPreview()"></div>` : ''}
      ${m === 'dum' ? `<div class="field"><label for="g-dum">Primeiro dia da última menstruação</label><input id="g-dum" type="date" max="${hoje}" value="${esc(d.dum || '')}" oninput="gestPreview()"><div class="hint">Assim que fizer o 1º ultrassom, atualize em “Eu → Gestação” — ele é mais preciso.</div></div>` : ''}
      ${m === 'dpp' ? `<div class="field"><label for="g-dpp">Data provável do parto</label><input id="g-dpp" type="date" min="${C.addDays(hoje, -28)}" value="${esc(d.dpp_informada || '')}" oninput="gestPreview()"></div>` : ''}
      <div id="g-prev"></div>
      <div class="row"><div class="field"><label for="g-bebe">Nome do bebê <span style="opacity:.75;font-weight:500">(opcional)</span></label><input id="g-bebe" value="${esc(d.nome_bebe || '')}" placeholder="ou um apelido"></div>
      <div class="field"><label for="g-tipo">Gravidez</label><select id="g-tipo">${opt([['unica', 'De um bebê'], ['gemelar', 'Gêmeos'], ['tripla_mais', 'Trigêmeos ou mais']], d.tipo_gravidez)}</select></div></div>
      <button class="btn-primary" onclick="saveGestSetup()">Continuar →</button>
      ${S().gestacao ? `<button class="btn-ghost" onclick="showMain()">Cancelar</button>` : `<button class="btn-ghost" onclick="Store.signOut().then(()=>showAuth('login'))">Sair</button>`}`);
    gestPreview();
  }
  if (view === 'ident') {
    const p = S().profile, g = S().gestacao;
    el.innerHTML = authShell(`<b style="font-size:17px">Identificação da gestante</b>
      <p style="font-size:13px;opacity:.9;margin:4px 0 14px">Campos da Caderneta. Tudo é opcional e pode ser preenchido depois — mas ajuda muito numa emergência. 💜</p>
      ${identFields(p, g, true)}
      <button class="btn-primary" onclick="saveIdent(true)">Salvar e entrar no meu Ninho 🪺</button>
      <button class="btn-ghost" onclick="showMain();toast('Você pode completar depois em Eu → Identificação')">Preencher depois</button>`);
  }
}
function collectGest() {
  const d = Object.assign({}, A.setupDraft);
  if ($('g-usg')) d.usg_data = val('g-usg'); if ($('g-sem')) d.usg_ig_semanas = val('g-sem') === '' ? null : +val('g-sem'); if ($('g-dias')) d.usg_ig_dias = val('g-dias') === '' ? 0 : +val('g-dias');
  if ($('g-dum')) d.dum = val('g-dum') || null; if ($('g-dpp')) d.dpp_informada = val('g-dpp') || null;
  if ($('g-bebe')) d.nome_bebe = val('g-bebe') || null; if ($('g-tipo')) d.tipo_gravidez = val('g-tipo');
  return d;
}
function gestPreview() {
  const d = collectGest(), box = $('g-prev'); if (!box) return;
  const v = C.validateGestation(d); const r = C.gaFrom(d);
  let h = '';
  if (r.ok && !v.err.length) h += `<div class="okbox">Hoje: <b>${r.w} semanas e ${r.d} ${plural(r.d, 'dia', 'dias')}</b> · DPP <b>${fmt(r.dpp)}</b></div>`;
  const cmp = C.compareDUMxUSG(d);
  if (cmp && d.metodo_ig === 'usg') h += `<div class="warn">${cmp.diff === 0 ? 'DUM e ultrassom coincidem.' : `Diferença de <b>${cmp.diff} ${plural(cmp.diff, 'dia', 'dias')}</b> entre a DUM e o ultrassom. ${cmp.recomenda === 'usg' ? `Acima de ${cmp.limite} dias, a regra usada pelos obstetras (ACOG/FEBRASGO) é seguir o ultrassom — é o que faremos.` : `Até ${cmp.limite} dias, muitos serviços mantêm a DUM; vamos seguir o ultrassom, como você escolheu. Confirme com sua equipe.`}`}</div>`;
  v.warn.forEach(w => { h += `<div class="warn">${esc(w)}</div>`; });
  if (A._showGestErr) v.err.forEach(e => { h += `<div class="err">${esc(e)}</div>`; });
  box.innerHTML = h;
}
function saveGestSetup() {
  const d = collectGest(); const v = C.validateGestation(d);
  if (v.err.length) { A._showGestErr = true; gestPreview(); return; }
  A._showGestErr = false;
  const r = C.gaFrom(d); const first = !S().gestacao;
  const changed = S().gestacao && C.gaStart(S().gestacao) !== C.gaStart(d);
  Store.setGestacao(Object.assign(d, { dpp: r.dpp, ativa: true }));
  A.setupDraft = {};
  if (first) { award('inicio'); maybeLegacy(); showSetup('ident'); }
  else { showMain(); toast(changed ? `Datação atualizada: ${r.w}s${r.d}d · DPP ${fmt(r.dpp)}` : 'Gestação atualizada 💜'); }
}
function identFields(p, g, light) {
  const lab = (id, t, o = '') => `<label class="${light ? '' : 'lbl'}" for="${id}" ${light ? 'style="display:block;font-weight:600;margin-bottom:7px;font-size:14px"' : ''}>${t}${o ? ` <span style="opacity:.7;font-weight:500">${o}</span>` : ''}</label>`;
  const inp = (id, v, extra = '') => `<input class="${light ? '' : 'in'}" id="${id}" value="${esc(v ?? '')}" ${extra}>`;
  const sel = (id, list, v) => `<select class="${light ? '' : 'in'}" id="${id}"><option value="">—</option>${opt(list, v)}</select>`;
  const F = (inner) => `<div class="${light ? 'field' : ''}">${inner}</div>`;
  return `${light ? '' : F(lab('id-nome', 'Nome completo') + inp('id-nome', p.nome_completo))}
    ${F(lab('id-social', 'Nome social', '(se usar)') + inp('id-social', p.nome_social))}
    ${light ? '' : `<div class="row">${F(lab('id-nasc', 'Nascimento') + inp('id-nasc', p.data_nascimento, `type="date" max="${todayISO()}"`))}${F(lab('id-tel', 'Celular') + inp('id-tel', fmtTel(p.telefone), 'type="tel" inputmode="tel"'))}</div>`}
    <div class="row">${F(lab('id-cns', 'Cartão SUS (CNS)', '15 dígitos') + inp('id-cns', p.cns, 'inputmode="numeric" maxlength="18"'))}${F(lab('id-cpf', 'CPF', 'opcional') + inp('id-cpf', p.cpf, 'inputmode="numeric" maxlength="14"'))}</div>
    <div class="row">${F(lab('id-raca', 'Raça/cor') + sel('id-raca', [['branca', 'Branca'], ['preta', 'Preta'], ['parda', 'Parda'], ['amarela', 'Amarela'], ['indigena', 'Indígena'], ['nao_informar', 'Prefiro não informar']], p.raca_cor))}
      ${F(lab('id-sangue', 'Tipo sanguíneo') + sel('id-sangue', ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'], p.tipo_sanguineo))}</div>
    <div class="row">${F(lab('id-mun', 'Município') + inp('id-mun', p.municipio))}${F(lab('id-uf', 'UF') + sel('id-uf', 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' '), p.uf))}</div>
    ${F(lab('id-ubs', 'UBS de referência') + inp('id-ubs', p.ubs_referencia, 'placeholder="Onde você faz o pré-natal"'))}
    ${F(lab('id-mat', 'Maternidade de referência') + inp('id-mat', p.maternidade_referencia))}
    <div class="row">${F(lab('id-ce', 'Contato de emergência') + inp('id-ce', p.contato_emergencia_nome, 'placeholder="Nome"'))}${F(lab('id-cet', 'Telefone') + inp('id-cet', fmtTel(p.contato_emergencia_tel), 'type="tel" inputmode="tel"'))}</div>
    <div class="row">${F(lab('id-alt', 'Altura (cm)') + inp('id-alt', g && g.altura_cm, 'type="number" inputmode="decimal" placeholder="ex.: 162"'))}${F(lab('id-pp', 'Peso antes da gravidez (kg)') + inp('id-pp', g && g.peso_pre_kg, 'type="number" inputmode="decimal" step="0.1"'))}</div>
    <div class="row">${F(lab('id-g', 'Gestações') + inp('id-g', g && g.gesta, 'type="number" min="0" placeholder="G"'))}${F(lab('id-p', 'Partos') + inp('id-p', g && g.para, 'type="number" min="0" placeholder="P"'))}${F(lab('id-a', 'Abortos') + inp('id-a', g && g.abortos, 'type="number" min="0" placeholder="A"'))}</div>
    <p style="font-size:11.5px;opacity:.8;margin:0 0 12px">🔒 CPF e CNS são opcionais e ficam visíveis só para você (no cartão de emergência e no resumo). Altura e peso pré-gestacional geram a curva de ganho de peso da Caderneta.</p>`;
}
function saveIdent(fromSetup) {
  document.querySelectorAll('#setup input, .modal input').forEach(e => e.classList.remove('err'));
  const cpf = onlyDigits(val('id-cpf')), cns = onlyDigits(val('id-cns'));
  if (cpf && !validCPF(cpf)) return fieldErr('id-cpf', 'CPF inválido — confira os números');
  if (cns && !validCNS(cns)) return fieldErr('id-cns', 'Número do Cartão SUS inválido');
  const alt = num('id-alt'), pp = num('id-pp');
  if (alt != null && (isNaN(alt) || alt < 120 || alt > 220)) return fieldErr('id-alt', 'Altura em centímetros (ex.: 162)');
  if (pp != null && (isNaN(pp) || pp < 30 || pp > 250)) return fieldErr('id-pp', 'Peso em kg (ex.: 61,5)');
  const tel = val('id-cet'); if (tel && !validPhone(tel)) return fieldErr('id-cet', 'Telefone com DDD');
  const patch = { nome_social: val('id-social') || null, cns: cns || null, cpf: cpf || null, raca_cor: val('id-raca') || null, tipo_sanguineo: val('id-sangue') || null,
    municipio: val('id-mun') || null, uf: val('id-uf') || null, ubs_referencia: val('id-ubs') || null, maternidade_referencia: val('id-mat') || null,
    contato_emergencia_nome: val('id-ce') || null, contato_emergencia_tel: onlyDigits(tel) || null };
  if ($('id-nome')) { const n = val('id-nome'); if (n.split(/\s+/).length < 2) return fieldErr('id-nome', 'Nome e sobrenome'); patch.nome_completo = n; }
  if ($('id-nasc')) { const a = C.ageYears(val('id-nasc')); if (val('id-nasc') && (a < 10 || a > 60)) return fieldErr('id-nasc', 'Confira a data'); patch.data_nascimento = val('id-nasc') || null; }
  if ($('id-tel')) { const t = val('id-tel'); if (t && !validPhone(t)) return fieldErr('id-tel', 'Celular com DDD'); patch.telefone = onlyDigits(t) || null; }
  Store.patchProfile(patch);
  const gi = v => v === '' ? null : Math.max(0, Math.min(30, parseInt(v, 10) || 0));
  Store.setGestacao({ altura_cm: alt, peso_pre_kg: pp, gesta: gi(val('id-g')), para: gi(val('id-p')), abortos: gi(val('id-a')) });
  if (fromSetup) { showMain(); toast('Bem-vinda ao seu Ninho 🪺'); } else { closeModal(); toast('Identificação atualizada 💜'); renderAll(); }
}

/* =================== VERSÃO ANTERIOR (localStorage 'ninho') =================== */
function legacyData() { try { const o = JSON.parse(localStorage.getItem('ninho')); return o && (o.data || o.dpp) ? o : null; } catch (e) { return null; } }
function maybeLegacy() {
  const old = legacyData(); if (!old || Store.prefs.legacyHandled) return;
  setTimeout(() => confirmBox(`Encontramos dados da versão anterior do Ninho neste aparelho (${(old.consultas || []).length} consultas, ${(old.exams || []).length} exames). Quer trazer para a sua conta?`, importLegacy, { yes: 'Importar meus dados' }), 400);
}
function importLegacy() {
  const o = legacyData(); if (!o) return; const tot = { ok: 0, plus: 0 };
  const put = (t, rec) => { try { Store.upsert(t, rec); tot.ok++; } catch (e) { if (e.code === 'PLUS') tot.plus++; } };
  if (!S().gestacao) Store.setGestacao(o.mode === 'dpp' ? { metodo_ig: 'dpp', dpp_informada: o.dpp, dpp: o.dpp } : { metodo_ig: 'dum', dum: o.data, dpp: C.addDays(o.data, 280) });
  Store.setGestacao({ nome_bebe: S().gestacao.nome_bebe || o.bebe || null, altura_cm: S().gestacao.altura_cm || (+o.altura || null), peso_pre_kg: S().gestacao.peso_pre_kg || (+o.pesoInicial || null) });
  const p = S().profile, v = o.vitals || {}, e = o.emerg || {};
  Store.patchProfile({ tipo_sanguineo: p.tipo_sanguineo || v.tipo || null, alergias: [...new Set([...(p.alergias || []), ...(o.allergies || [])])], condicoes: [...new Set([...(p.condicoes || []), ...(o.diseases || [])])], medicamentos_uso: [...new Set([...(p.medicamentos_uso || []), ...(o.meds || [])])],
    maternidade_referencia: p.maternidade_referencia || e.maternidade || null, contato_emergencia_nome: p.contato_emergencia_nome || e.contato || null, contato_emergencia_tel: p.contato_emergencia_tel || onlyDigits(e.tel) || null });
  (o.consultas || []).forEach(c => { const bp = C.parseBP(c.pa) || {}; put('consultas', { data: c.data, ig_semanas: +c.semana || null, local: c.local || null, pa_sis: bp.sis || null, pa_dia: bp.dia || null, peso_kg: +c.peso || null, altura_uterina_cm: +c.au || null, bcf_bpm: +c.bcf || null, observacoes: c.coment || null, proxima_consulta: c.next || null }); });
  const vmap = ['dtpa', 'hepb', 'influenza', 'covid']; (o.vaxDone || []).forEach(i => vmap[i] && put('vacinas', { codigo: vmap[i], dose: 1 }));
  (o.kicks || []).forEach(k => put('movimentos', { inicio: new Date(k.ts).toISOString(), duracao_min: k.mins, contagem: k.count }));
  (o.exams || []).forEach(x => { [['hemoglobina', 'hb', 'g/dL'], ['glicemia', 'glicemia_jejum', 'mg/dL'], ['tsh', 'tsh', 'mUI/L']].forEach(([k, cod, u]) => { if (x[k]) put('exames', { data: x.data, codigo: cod, nome: C.EXAME[cod].nome, valor_num: parseFloat(String(x[k]).replace(',', '.')), unidade: u, observacoes: x.obs || null }); });
    if (x.outro) put('exames', { data: x.data, codigo: 'outro', nome: x.outroNome || 'Outro', valor_txt: String(x.outro), observacoes: x.obs || null }); });
  (o.ultrassons || []).forEach(u => put('ultrassons', { data: u.data, tipo: u.tipo, ig_usg_semanas: +u.semana || null, peso_fetal_g: +u.peso || null, bcf_bpm: +u.bpm || null, observacoes: u.obs || null }));
  (o.symptoms || []).forEach(s => put('sintomas', { registrado_em: new Date(s.ts).toISOString(), nome: s.nome, emoji: s.emoji, intensidade: s.intensidade || 0, nota: s.nota || null }));
  (o.nextNotes || []).forEach(n => put('notas', { texto: n.txt, resolvida: !!n.done }));
  const hl = o.homeLogs || {}; const at = l => new Date(`${l.data}T${l.hora || '12:00'}:00`).toISOString();
  (hl.pressao || []).forEach(l => put('medicoes', { tipo: 'pressao', medido_em: at(l), sis: l.sis, dia: l.dia, nota: l.nota || null }));
  (hl.glicemia || []).forEach(l => put('medicoes', { tipo: 'glicemia', medido_em: at(l), valor: l.val, momento: l.momento === 'Jejum' ? 'jejum' : 'pos1h', nota: l.nota || null }));
  (hl.peso || []).forEach(l => put('medicoes', { tipo: 'peso', medido_em: at(l), valor: l.val }));
  (o.medReminders || []).forEach(m => put('medicamentos', { nome: m.nome, dose: m.dose || null, horarios: (m.horarios || []).filter(h => /^([01]\d|2[0-3]):[0-5]\d$/.test(h)), ativo: true }));
  (o.memories || []).forEach(m => put('memorias', { tipo: m.tipo === 'foto' ? 'foto' : 'momento', titulo: m.titulo || null, semana: +m.semana || null, texto: m.txt || null }));
  if (o.birthPlan && Object.keys(o.birthPlan).length) Store.setGestacao({ plano_parto: o.birthPlan });
  Store.patchGame({ gotas: (Store.game.gotas || 0) + (o.drops || 0) });
  Store.patchPrefs({ legacyHandled: true });
  toast(`${tot.ok} registros importados${tot.plus ? ` · ${tot.plus} exigem o Ninho+` : ''} 💜`); renderAll();
}

/* =================== APP PRINCIPAL =================== */
function showMain() { show('main'); renderAll(); go(location.hash.slice(1) || A.page || 'home', true); scheduleReminders(); }
function go(pg, keep) {
  if (!['home', 'timeline', 'record', 'help', 'me'].includes(pg)) pg = 'home';
  A.page = pg;
  ['home', 'timeline', 'record', 'help', 'me'].forEach(p => { $('pg-' + p).classList.toggle('hidden', p !== pg); document.querySelector(`.nav button[data-pg="${p}"]`).classList.toggle('on', p === pg); });
  if (!keep) window.scrollTo(0, 0);
  if (location.hash.slice(1) !== pg) history.replaceState(null, '', '#' + pg);
  if (S() && S().gestacao) renderHeader();
  ({ home: renderHome, timeline: renderTimeline, record: renderRecord, help: renderHelp, me: renderMe })[pg]();
}
function renderAll() { if (!S() || !S().gestacao) return; renderBanners(); renderHeader(); if (A.page) ({ home: renderHome, timeline: renderTimeline, record: renderRecord, help: renderHelp, me: renderMe })[A.page](); }
function renderBanners() {
  const b = []; const m = S().meta;
  if (Store.backend.mode === 'local') b.push(`<div class="banner dev"><i class="ph ph-wrench"></i> Modo local: os dados ficam só neste aparelho. Configure o Supabase em js/config.js.</div>`);
  else if (m.syncError === 'offline') b.push(`<div class="banner off"><i class="ph ph-wifi-slash"></i> Sem internet — seus registros ficam guardados e sincronizam depois.</div>`);
  else if (m.syncError) b.push(`<div class="banner off"><i class="ph ph-warning"></i> Não foi possível sincronizar agora. Tentaremos de novo. <button class="btn sm sec" style="margin-left:auto" onclick="Store.sync().catch(()=>{})">Tentar</button></div>`);
  if (Store.blockedCount()) b.push(`<div class="banner dev"><i class="ph ph-lock"></i> ${Store.blockedCount()} registro(s) do Ninho+ guardados só neste aparelho.</div>`);
  $('banners').innerHTML = b.join('');
}
function renderHeader() {
  const g = ga(); const [fr, nm] = fruitFor(g.w); const tri = C.trimester(g.w); const pct = Math.max(0, Math.min(100, Math.round(g.days / 280 * 100)));
  const faltam = Math.max(0, C.diffDays(g.dpp, todayISO()));
  if (A.page && A.page !== 'home') {   // nas outras abas, cabeçalho compacto: mais espaço para o conteúdo
    $('header').innerHTML = `<div class="top compact"><div class="fruit" aria-hidden="true">${fr}</div><div style="flex:1;min-width:0"><div class="wk">${g.w}s${g.d}d · ${tri}º trimestre</div><div class="ft">DPP ${fmt(g.dpp)} · faltam ${faltam} dias</div></div><div class="drops" aria-label="gotas de cuidado">💧 ${Store.game.gotas || 0}</div></div>`;
    return;
  }
  $('header').innerHTML = `<div class="top">
    <div class="drops" aria-label="gotas de cuidado">💧 ${Store.game.gotas || 0}</div>
    <div class="hi">Oi, ${esc(nomeExibicao())} 💜</div>
    <div class="name">${bebe() ? `Esperando ${esc(cap(bebe()))}` : 'Sua gestação'}</div>
    <div class="sub">${g.w} ${plural(g.w, 'semana', 'semanas')} e ${g.d} ${plural(g.d, 'dia', 'dias')} · IG pelo ${esc(metodoLabel(S().gestacao.metodo_ig))}</div>
    <div class="weekbig"><div class="fruit" aria-hidden="true">${fr}</div><div style="flex:1">
      <div class="wk">${g.w} ${plural(g.w, 'semana', 'semanas')} · ${tri}º trimestre</div>
      <div class="ft">Seu bebê tem o tamanho de ${aOu(nm)} ${esc(nm)}</div>
      <div class="progbar"><i style="width:${pct}%"></i></div>
      <span class="tri-tag">DPP: ${fmt(g.dpp)} · faltam ${faltam} dias</span></div></div></div>`;
}
const FRUITS = { 4: ['🫐', 'semente de papoula'], 5: ['🫐', 'grão de gergelim'], 6: ['🫛', 'lentilha'], 7: ['🫐', 'mirtilo'], 8: ['🫘', 'feijão'], 9: ['🍇', 'uva'], 10: ['🍓', 'morango'], 11: ['🫒', 'azeitona'], 12: ['🍋', 'limão'], 13: ['🫛', 'vagem de ervilha'], 14: ['🍋', 'limão-siciliano'], 15: ['🍎', 'maçã'], 16: ['🥑', 'abacate'], 17: ['🍐', 'pera'], 18: ['🫑', 'pimentão'], 19: ['🍅', 'tomate grande'], 20: ['🍌', 'banana'], 21: ['🥕', 'cenoura'], 22: ['🥥', 'coco pequeno'], 23: ['🥭', 'manga'], 24: ['🌽', 'espiga de milho'], 25: ['🥬', 'couve-flor'], 26: ['🥬', 'alface'], 27: ['🥦', 'brócolis'], 28: ['🍆', 'berinjela'], 29: ['🎃', 'abóbora pequena'], 30: ['🥬', 'repolho'], 31: ['🥥', 'coco'], 32: ['🥔', 'inhame'], 33: ['🍍', 'abacaxi'], 34: ['🍈', 'melão cantaloupe'], 35: ['🍈', 'melão'], 36: ['🥬', 'alface romana'], 37: ['🥬', 'acelga'], 38: ['🎃', 'abóbora'], 39: ['🍉', 'melancia pequena'], 40: ['🍉', 'melancia'] };
function fruitFor(w) { let k = Math.max(4, Math.min(40, w)); while (!FRUITS[k] && k > 4) k--; return FRUITS[k] || ['🍼', 'seu bebê']; }
function aOu(n) { const w = (n || '').toLowerCase().split(' ')[0]; if (['semente', 'vagem', 'couve-flor', 'alface', 'espiga', 'uva', 'pera', 'banana', 'cenoura', 'manga', 'berinjela', 'abóbora', 'maçã', 'lentilha', 'azeitona', 'acelga', 'melancia'].includes(w)) return 'uma'; return /[aã]$/.test(w) ? 'uma' : 'um'; }

/* ---------- contexto para alertas e lembretes ---------- */
function ctx() { return { gest: S().gestacao, ga: ga(), list: L, plus: Store.isPlus(), profile: S().profile, prefs: Store.prefs, dismissed: Store.prefs.dispensados, now: new Date() }; }
function dismissAlert(id) { Store.patchPrefs({ dispensados: Object.assign({}, Store.prefs.dispensados, { [id]: new Date().toISOString() }) }); renderHome(); }
function alertAction(a) {
  if (a === 'call192') return location.href = 'tel:192';
  if (a === 'kick') return modalKick();
  if (a === 'consulta') return modalConsulta();
  if (a === 'emerg') return showEmergCard();
  if (a.startsWith('go:')) { const [, pg, tab] = a.split(':'); if (tab) A.recTab = tab; return go(pg); }
  if (a.startsWith('note:')) { if (!Store.can('notas')) { toast('Anote na sua caderneta: ' + a.slice(5)); return; } Store.upsert('notas', { texto: a.slice(5), resolvida: false }); return toast('📌 Anotado para a próxima consulta'); }
  if (a.startsWith('vac:')) return modalVacina(a.slice(4));
  if (a.startsWith('exam:')) return modalExame(null, a.slice(5));
}
function alertsHTML() {
  const list = Alerts.compute(ctx()); A._alerts = list;
  if (!list.length) return `<div class="alert allgood"><div class="ai">💚</div><div><b class="t" style="color:var(--good)">Tudo certo por aqui</b><p style="margin:0">Seus registros estão dentro do esperado. Continue cuidando de você e do bebê.</p></div></div>`;
  return list.map((x, i) => `<div class="alert ${x.sev}" role="${x.sev === 'urgente' ? 'alert' : 'note'}"><div class="ai" aria-hidden="true">${x.ic}</div><div style="flex:1;min-width:0">
     <b class="t">${x.sev === 'urgente' ? 'URGENTE · ' : ''}${esc(x.titulo)}</b><p>${esc(x.msg)}</p>
     <div class="acts">${(x.acts || []).map(([l, a, cls], j) => `<button class="${cls || ''}" onclick="alertAction(A._alerts[${i}].acts[${j}][1])">${esc(l)}</button>`).join('')}
     ${x.dispensavel ? `<button onclick="dismissAlert('${jsq(x.id)}')">Ok, entendi</button>` : ''}</div>
     ${x.fonte ? `<div class="src">Referência: ${esc(x.fonte)}</div>` : ''}</div></div>`).join('');
}

/* =================== INÍCIO =================== */
function setupItems() {
  const p = S().profile, g = S().gestacao;
  return [
    { id: 'sangue', ic: 'ph-drop', t: 'Tipo sanguíneo', s: 'Essencial numa emergência', g: 20, done: !!p.tipo_sanguineo, act: 'modalIdent()' },
    { id: 'corpo', ic: 'ph-scales', t: 'Altura e peso antes da gravidez', s: 'Gera sua curva de ganho de peso', g: 20, done: !!(g.altura_cm && g.peso_pre_kg), act: 'modalIdent()' },
    { id: 'emerg', ic: 'ph-first-aid-kit', t: 'Maternidade e contato de emergência', s: 'Para o cartão de emergência', g: 20, done: !!(p.maternidade_referencia && p.contato_emergencia_tel), act: 'modalIdent()' },
    { id: 'consulta', ic: 'ph-stethoscope', t: 'Registrar uma consulta', s: 'Os dados da sua caderneta no app', g: 30, done: L('consultas').length > 0, act: 'modalConsulta()' },
    { id: 'notif', ic: 'ph-bell', t: 'Ativar lembretes', s: 'Consultas, vacinas e exames', g: 10, done: Notify.permission() === 'granted' || Store.prefs.notifRecusado, act: 'enableNotifications()' }];
}
function renderHome() {
  if (!S() || !S().gestacao) return;
  const g = ga(), t = C.TRIMESTRES.find(x => g.w >= x.min && g.w <= x.max) || C.TRIMESTRES[2];
  const items = setupItems(); let ganhou = false; items.filter(i => i.done).forEach(i => { if (earn('setup:' + i.id, i.g)) ganhou = true; }); if (ganhou) renderHeader();
  if (items.every(i => i.done)) award('perfil');
  const done = items.filter(i => i.done).length;
  const setup = done < items.length ? `<div class="section-t"><i class="ph ph-sparkle"></i> Primeiros passos</div><div class="card" style="border:2px solid var(--violet)">
      <div style="display:flex;align-items:center;gap:12px"><div style="font-size:28px">🪺</div><div style="flex:1"><b>Monte sua caderneta</b><div class="muted" style="font-size:12.5px">Complete e ganhe gotas de cuidado 💧</div></div>
      <div style="font-family:var(--serif);font-size:24px;color:var(--violet)">${done}/${items.length}</div></div>
      <div class="progbar" style="background:var(--line);margin:10px 0 12px"><i style="width:${done / items.length * 100}%;background:var(--grad)"></i></div>
      ${items.filter(i => !i.done).map(i => `<div class="mission" onclick="${i.act}" role="button" tabindex="0"><div class="mi"><i class="ph ${i.ic}"></i></div><div class="mt"><b>${i.t}</b><span>${i.s} · +${i.g} gotas</span></div><div class="chk">›</div></div>`).join('')}</div>` : '';
  // lembretes de hoje
  const rem = Notify.compute(Object.assign(ctx(), { prefs: Object.assign({}, Store.prefs, { notifPrivada: false, silencio: ['00:00', '00:00'] }), now: new Date(new Date().setHours(0, 0, 0, 0)) }))
    .filter(r => C.toISODate(r.quando) === todayISO() && !['medicacao'].includes(r.tipo));
  // medicação de hoje
  let med = '';
  if (Store.isPlus() && L('medicamentos').some(m => m.ativo !== false && (m.horarios || []).length)) {
    const doses = []; L('medicamentos').filter(m => m.ativo !== false).forEach(m => (m.horarios || []).forEach(h => doses.push({ m, h })));
    doses.sort((a, b) => a.h.localeCompare(b.h));
    med = `<div class="section-t"><i class="ph ph-pill"></i> Medicação de hoje</div><div class="card" style="padding:8px 14px">${doses.map(({ m, h }) => {
      const tk = L('doses').find(d => d.medicamento_id === m.id && d.data === todayISO() && d.horario === h && d.tomada);
      return `<div class="mission ${tk ? 'done' : ''}" style="margin:6px 0" role="button" tabindex="0" onclick="toggleDose('${m.id}','${h}')"><div class="mi"><i class="ph ph-pill"></i></div><div class="mt"><b>${esc(m.nome)}${m.dose ? ' · ' + esc(m.dose) : ''}</b><span>${h}</span></div><div class="chk">${tk ? '✓' : ''}</div></div>`; }).join('')}</div>`;
  }
  const md = (Store.game.missoes || {})[todayISO()] || {};
  const notas = Store.isPlus() ? L('notas').filter(n => !n.resolvida) : [];
  const B = Store.game.conquistas || [];
  const care = `<div class="section-t"><i class="ph ph-heartbeat"></i> Centro de cuidado</div>
    ${alertsHTML()}
    <button class="btn sec full" style="margin-bottom:6px" onclick="modalDangerCheck()">🚨 Estou sentindo algo diferente</button>`;
  const urgent = (A._alerts || []).some(a => a.sev === 'urgente');   // urgência vem antes de tudo
  $('pg-home').innerHTML = `${urgent ? care + setup : setup + care}
    ${rem.length ? `<div class="section-t"><i class="ph ph-bell"></i> Lembretes de hoje</div><div class="card">${rem.map(r => `<div class="list-item"><div class="li-ic">${Notify.TIPOS[r.tipo].ic}</div><div class="li-t"><b>${esc(r.titulo)}</b><span>${String(r.quando.getHours()).padStart(2, '0')}:${String(r.quando.getMinutes()).padStart(2, '0')} · ${esc(r.corpo)}</span></div></div>`).join('')}</div>` : ''}
    ${med}
    <div class="section-t"><i class="ph ph-check-circle"></i> Cuidados de hoje</div>
    ${MISSOES.map(m => `<div class="mission ${md[m.id] ? 'done' : ''}" role="button" tabindex="0" onclick="toggleMissao('${m.id}')"><div class="mi"><i class="ph ${m.ic}"></i></div><div class="mt"><b>${m.t}</b><span>${m.s}</span></div><div class="chk">${md[m.id] ? '✓' : ''}</div></div>`).join('')}
    ${notas.length ? `<div class="section-t"><i class="ph ph-push-pin"></i> Para perguntar na consulta</div><div class="card" role="button" onclick="A.recTab='notas';go('record')">${notas.slice(0, 3).map(n => `<div class="list-item"><div class="li-ic">❓</div><div class="li-t"><b style="font-weight:600">${esc(n.texto)}</b></div></div>`).join('')}</div>` : ''}
    <div class="section-t"><i class="ph ph-baby"></i> Seu bebê agora</div>
    <div class="card"><p class="muted" style="margin:0;font-size:14px;line-height:1.55">${t.baby}</p></div>
    <div class="section-t"><i class="ph ph-trophy"></i> Conquistas</div>
    <div class="card"><div class="badges">${BADGES.map(b => `<div class="badge ${B.includes(b.id) ? 'un' : ''}"><div class="bc">${b.ic}</div><span>${b.n}</span></div>`).join('')}</div></div>`;
}
function toggleDose(mid, h) {
  if (needPlus('medicacao')) return;
  const d = L('doses').find(x => x.medicamento_id === mid && x.data === todayISO() && x.horario === h);
  if (d) Store.upsert('doses', { id: d.id, tomada: !d.tomada }); else { Store.upsert('doses', { medicamento_id: mid, data: todayISO(), horario: h, tomada: true }); toast('💊 Dose registrada'); }
  renderHome(); scheduleReminders();
}

/* =================== SINAIS DE PERIGO (check rápido) =================== */
function modalDangerCheck() {
  openModal('🚨 O que você está sentindo?', `<p class="muted" style="font-size:13px;margin:0 0 12px">Marque o que estiver acontecendo <b>agora</b>:</p>
    ${C.SINAIS_PERIGO.map(s => `<label class="check" style="background:var(--bg);padding:10px;border-radius:12px;border:1px solid var(--line)"><input type="checkbox" class="dg" value="${s.id}"><span><b>${s.ic} ${s.t}</b>${s.s ? `<br><span class="muted" style="font-size:12px">${s.s}</span>` : ''}</span></label>`).join('')}
    <button class="btn full" onclick="dangerResult()">Ver o que fazer</button>`);
}
function dangerResult() {
  const ids = [...document.querySelectorAll('.dg:checked')].map(e => e.value);
  if (!ids.length) { closeModal(); toast('Nenhum sinal marcado. Se algo te preocupa, ligue para sua UBS ou maternidade 💜'); return; }
  const p = S().profile, so = ids.length === 1 && ids[0] === 'mental';
  openModal('Procure atendimento', `<div class="alert urgente"><div class="ai">🚨</div><div><b class="t">${so ? 'Você merece ajuda agora' : 'Procure atendimento agora'}</b>
    <p>${so ? 'Ligue para o CVV (188, 24 h, gratuito) ou procure a UBS. Se estiver em risco imediato, ligue 192.' : 'Os sinais que você marcou são sinais de perigo na gestação segundo a Caderneta. Vá à maternidade de referência ou ligue para o SAMU.'}</p></div></div>
    ${so ? '<a class="btn full" style="display:block;text-align:center;text-decoration:none;margin-bottom:8px" href="tel:188">📞 Ligar 188 (CVV)</a>' : ''}
    <a class="btn full" style="display:block;text-align:center;text-decoration:none;background:var(--bad)" href="tel:192">📞 Ligar 192 (SAMU)</a>
    ${p.contato_emergencia_tel ? `<a class="btn sec full" style="display:block;text-align:center;text-decoration:none;margin-top:8px" href="tel:${esc(p.contato_emergencia_tel)}">📞 ${esc(p.contato_emergencia_nome || 'Contato de emergência')}</a>` : ''}
    <button class="btn sec full" style="margin-top:8px" onclick="showEmergCard()">🆘 Abrir meu cartão de emergência</button>
    ${p.maternidade_referencia ? `<p class="muted" style="text-align:center;font-size:13px;margin-top:10px">Sua maternidade: <b>${esc(p.maternidade_referencia)}</b></p>` : ''}`);
}

/* =================== JORNADA =================== */
function renderTimeline() {
  const g = ga(), plus = Store.isPlus(), tri = C.trimester(g.w), rhNeg = /-$/.test(S().profile.tipo_sanguineo || '');
  const feitos = {}; if (plus) L('exames').forEach(e => { const t = C.trimester(C.gaFrom(S().gestacao, e.data).w); (feitos[t] = feitos[t] || new Set()).add(e.codigo); });
  let h = `<div class="section-t"><i class="ph ph-path"></i> Sua jornada</div>
    <p class="muted" style="margin:-6px 0 14px;font-size:13.5px">Exames e cuidados de cada fase, como na Caderneta Brasileira da Gestante. Você está com ${g.w} ${plural(g.w, 'semana', 'semanas')}.</p>`;
  C.TRIMESTRES.forEach(t => {
    const active = t.tri === tri, past = t.tri < tri;
    const ex = C.EXAMES.filter(e => e.tri.includes(t.tri) && (!e.cond || (e.cond === 'rh_neg' && rhNeg)) && !(e.grupo === 'totg' && e.id !== 'totg_0') && e.id !== 'ht');
    const exNome = e => e.grupo === 'totg' ? 'TOTG 75 g (24–28 semanas)' : e.id === 'hb' ? 'Hemograma (hemoglobina e hematócrito)' : e.nome;
    h += `<details class="card tri" ${active ? 'open' : ''} style="${active ? 'border:2px solid var(--violet)' : ''}">
      <summary style="display:flex;align-items:center;gap:10px;list-style:none;cursor:pointer"><div style="font-size:28px">${t.emoji}</div>
      <div style="flex:1"><h3 style="margin:0">${t.title} ${active ? '<span class="pill v">Você está aqui</span>' : past ? '<span class="pill g">Fase anterior</span>' : '<span class="pill v">Próxima fase</span>'}</h3><span class="muted" style="font-size:12px">${t.faixa}${active ? '' : ' · toque para ver'}</span></div></summary>
      <p style="font-size:13.5px;line-height:1.5;margin:6px 0 10px">${t.baby}</p>
      <b style="font-size:13px">🔬 Exames da Caderneta nesta fase</b>
      <div style="margin:4px 0 10px">${ex.map(e => { const f = feitos[t.tri] && (feitos[t.tri].has(e.id) || (e.grupo === 'totg' && feitos[t.tri].has('totg_2h'))); return `<div class="exrow"><span class="dot ${plus ? (f ? 'ok' : (past ? 'w' : '')) : ''}"></span><div class="en">${esc(exNome(e))}${e.nota ? `<span>${esc(e.nota)}</span>` : ''}</div>${plus && active && !f ? `<button class="btn sec sm" onclick="modalExame(null,'${e.id}')">Registrar</button>` : ''}</div>`; }).join('')}</div>
      ${!plus && active ? `<div class="lock-inline"><div class="li-t"><b>Registre os resultados ${plusTag()}</b><span>Com o Ninho+ você guarda os resultados, vê gráficos e recebe alertas de valores fora do esperado.</span></div><button class="btn sm" onclick="modalPremium()">Ver</button></div>` : ''}
      <b style="font-size:13px">🩺 Consultas</b><p class="muted" style="font-size:13px;margin:4px 0 10px">${t.tri === 1 ? 'Comece até a 12ª semana. Consultas mensais.' : t.tri === 2 ? 'Mensais até 28 semanas.' : 'A cada 15 dias de 28 a 36 semanas e semanais a partir de 37. Não existe “alta” do pré-natal.'}</p>
      <b style="font-size:13px">🌿 Dicas</b><ul style="margin:6px 0 0;padding-left:18px;font-size:13px;color:var(--muted);line-height:1.6">${t.tips.map(x => `<li>${x}</li>`).join('')}</ul></details>`;
  });
  const nCons = L('consultas').length;
  h += `<div class="card" style="background:var(--grad-soft)"><b>📋 Consultas registradas: ${nCons} de no mínimo ${C.CONSULTAS.minimo}</b><div class="progbar" style="background:var(--line);margin-top:8px"><i style="width:${Math.min(100, nCons / C.CONSULTAS.minimo * 100)}%;background:var(--grad)"></i></div></div>`;
  h += `<div class="section-t"><i class="ph ph-syringe"></i> Vacinas da gestante (SUS)</div>`;
  C.VACINAS.forEach(v => {
    const doses = L('vacinas').filter(x => x.codigo === v.id).sort((a, b) => String(a.data_aplicacao).localeCompare(String(b.data_aplicacao)));
    const libera = g.w >= v.desde, ok = doses.length >= 1;
    h += `<div class="card" style="margin-bottom:10px"><div class="list-item" style="border:none;padding:0"><div class="li-ic">💉</div>
      <div class="li-t"><b>${v.nome} ${ok ? '<span class="pill g">✓</span>' : !libera ? `<span class="pill v">a partir de ${v.desde} sem</span>` : ''}</b><span>${v.quando}</span>
      <span style="display:block;font-size:12px;color:var(--muted);margin-top:3px">${v.porque}</span>
      ${doses.map(d => `<span style="display:block;font-size:12px;margin-top:4px">• Dose ${d.dose}${d.data_aplicacao ? ' em ' + fmt(d.data_aplicacao) : ''} <button class="x" style="font-size:14px;width:auto;height:auto" aria-label="Remover dose" onclick="confirmBox('Remover este registro de vacina?',()=>{Store.remove('vacinas','${d.id}');renderTimeline()})">🗑️</button></span>`).join('')}</div>
      <button class="btn ${ok ? 'sec' : ''} sm" onclick="modalVacina('${v.id}')">${ok ? '+ dose' : 'Registrar'}</button></div></div>`;
  });
  $('pg-timeline').innerHTML = h;
}
function modalVacina(cod) {
  const v = C.VACINAS.find(x => x.id === cod); const n = L('vacinas').filter(x => x.codigo === cod).length;
  openModal('💉 ' + esc(v.nome), `<label class="lbl" for="vx-data">Data da aplicação</label><input class="in" type="date" id="vx-data" max="${todayISO()}" value="${todayISO()}">
    <div class="row"><div><label class="lbl" for="vx-dose">Dose</label><input class="in" id="vx-dose" type="number" min="1" max="5" value="${Math.min(5, n + 1)}"></div><div><label class="lbl" for="vx-lote">Lote (opcional)</label><input class="in" id="vx-lote"></div></div>
    <label class="lbl" for="vx-local">Local (opcional)</label><input class="in" id="vx-local" placeholder="UBS">
    <button class="btn full" onclick="saveVacina('${cod}')">Salvar</button>`);
}
function saveVacina(cod) {
  const d = val('vx-data'); if (!d || d > todayISO()) return fieldErr('vx-data', 'Data inválida');
  const dose = Math.max(1, Math.min(5, +val('vx-dose') || 1));
  if (L('vacinas').some(x => x.codigo === cod && x.dose === dose)) return fieldErr('vx-dose', `A dose ${dose} já está registrada`);
  const r = Store.upsert('vacinas', { codigo: cod, dose, data_aplicacao: d, lote: val('vx-lote') || null, local: val('vx-local') || null });
  earn(`vac:${cod}:${dose}`, 20, 'Vacina registrada 💉'); award('vacina'); closeModal(); renderAll(); scheduleReminders();
}

/* =================== PRONTUÁRIO =================== */
const REC_TABS = [['consultas', 'ph-stethoscope', 'Consultas', 'consultas'], ['curvas', 'ph-chart-line', 'Curvas', 'curvas'], ['movimentos', 'ph-baby', 'Movimentos', 'movimentos'],
  ['exames', 'ph-microscope', 'Exames', 'exames'], ['eco', 'ph-image', 'Ultrassom', 'ultrassons'], ['casa', 'ph-house-line', 'Em casa', 'casa'],
  ['sintomas', 'ph-note-pencil', 'Sintomas', 'sintomas'], ['notas', 'ph-push-pin', 'P/ consulta', 'notas'], ['saude', 'ph-heartbeat', 'Minha saúde', 'saude_basica']];
function renderRecord() {
  if (!REC_TABS.some(t => t[0] === A.recTab)) A.recTab = 'consultas';
  $('pg-record').innerHTML = `<div class="section-t"><i class="ph ph-clipboard-text"></i> Minha caderneta</div>
    <div class="chip-row" role="tablist">${REC_TABS.map(t => `<button role="tab" aria-selected="${A.recTab === t[0]}" class="chip ${A.recTab === t[0] ? 'on' : ''}" onclick="setRecTab('${t[0]}')"><i class="ph ${t[1]}"></i> ${t[2]}${Store.can(t[3]) ? '' : ' 🔒'}</button>`).join('')}</div>
    <div id="rec-body"></div>`;
  renderRecBody();
}
function setRecTab(t) { A.recTab = t; renderRecord(); }
function renderRecBody() {
  destroyCharts(); const el = $('rec-body'); if (!el) return; const tab = REC_TABS.find(t => t[0] === A.recTab);
  if (!Store.can(tab[3])) {
    const desc = { exames: 'Guarde os resultados de todos os exames da Caderneta, veja gráficos e receba alertas quando algo estiver fora do esperado.', eco: 'Álbum dos ultrassons com fotos, peso estimado e batimentos.', casa: 'Diário de pressão, glicemia, peso e temperatura com gráficos e lembretes.', sintomas: 'Registre como você se sente e mostre o histórico na consulta.', notas: 'Anote dúvidas para não esquecer na hora da consulta.' };
    el.innerHTML = lockCard(`${tab[2]} ${plusTag()}`, desc[tab[0]] || ''); return;
  }
  const f = { consultas: recConsultas, curvas: recCurvas, movimentos: recMovimentos, exames: recExames, eco: recEco, casa: recCasa, sintomas: recSintomas, notas: recNotas, saude: recSaude }[tab[0]];
  el.innerHTML = f(); const d = { curvas: drawCurvas, exames: drawExamCharts, casa: drawCasaCharts }[tab[0]]; if (d) d();
  if (tab[0] === 'eco' || tab[0] === 'exames') loadThumbs();
}
async function loadThumbs() { for (const img of document.querySelectorAll('img[data-path]')) { const u = await Store.imageURL(img.dataset.path); if (u) img.src = u; else img.remove(); } }

/* ---------- Consultas (Caderneta) ---------- */
const MOV_OPT = [['presentes', 'Presentes'], ['diminuidos', 'Diminuídos'], ['ausentes', 'Ausentes'], ['nao_avaliado', 'Não avaliado']];
const APR_OPT = [['cefalica', 'Cefálica'], ['pelvica', 'Pélvica'], ['transversa', 'Transversa'], ['nao_avaliada', 'Não avaliada']];
const EDE_OPT = [['ausente', 'Ausente'], ['+', '+'], ['++', '++'], ['+++', '+++']];
function recConsultas() {
  const cs = L('consultas').slice().sort((a, b) => b.data.localeCompare(a.data));
  const lbl = (l, v) => (l.find(x => x[0] === v) || [, v])[1];
  return `<button class="btn full" onclick="modalConsulta()">+ Registrar consulta</button><div style="height:12px"></div>
    ${cs.length ? cs.map(c => { const ig = C.gaFrom(S().gestacao, c.data); const bp = C.classifyBP(c.pa_sis, c.pa_dia); const au = c.altura_uterina_cm ? C.classifyAU(ig.w, +c.altura_uterina_cm) : null;
      return `<div class="card"><div style="display:flex;justify-content:space-between;align-items:start;gap:8px">
        <div><h3 style="margin:0">${fmt(c.data)} · ${ig.w}s${ig.d}d</h3><span class="muted" style="font-size:12.5px">${esc([c.local, c.profissional].filter(Boolean).join(' · ') || 'Consulta de pré-natal')}</span></div>
        <div style="display:flex;gap:4px"><button class="x" style="font-size:18px" aria-label="Editar consulta" onclick="modalConsulta('${c.id}')">✏️</button><button class="x" style="font-size:18px" aria-label="Excluir consulta" onclick="confirmBox('Excluir esta consulta?',()=>{Store.remove('consultas','${c.id}');renderRecBody()},{danger:true,yes:'Excluir'})">🗑️</button></div></div>
        <div class="vital-grid" style="margin-top:10px">
          ${vbox('PA', c.pa_sis ? `${c.pa_sis}/${c.pa_dia}` : '', 'mmHg', bp === 'grave' || bp === 'alta' ? 'b' : '')}${vbox('Peso', c.peso_kg, 'kg')}
          ${vbox('Altura uterina', c.altura_uterina_cm, 'cm', au && au.sev !== 'ok' ? 'w' : '')}${vbox('BCF', c.bcf_bpm, 'bpm', c.bcf_bpm && (c.bcf_bpm < C.BCF[0] || c.bcf_bpm > C.BCF[1]) ? 'w' : '')}</div>
        <div style="font-size:12.5px;margin-top:8px;line-height:1.7" class="muted">${[c.movimentos_fetais && 'Mov. fetais: ' + lbl(MOV_OPT, c.movimentos_fetais), c.apresentacao && 'Apresentação: ' + lbl(APR_OPT, c.apresentacao), c.edema && 'Edema: ' + lbl(EDE_OPT, c.edema), c.queixas_urinarias != null && 'Queixas urinárias: ' + (c.queixas_urinarias ? 'sim' : 'não'), c.perdas_vaginais != null && 'Perdas vaginais: ' + (c.perdas_vaginais ? 'sim' : 'não')].filter(Boolean).join(' · ')}</div>
        ${c.observacoes ? `<div style="margin-top:10px;background:var(--grad-soft);padding:11px;border-radius:13px;font-size:13.5px;line-height:1.5"><b style="font-size:12px;color:var(--violet)">🩺 Observações e conduta</b><br>${esc(c.observacoes)}</div>` : ''}
        ${c.proxima_consulta ? `<div style="margin-top:8px;font-size:12.5px" class="muted">📅 Próxima: <b>${fmt(c.proxima_consulta)}</b></div>` : ''}</div>`; }).join('')
      : empty('🩺', 'Nenhuma consulta ainda', 'Copie aqui os dados que a equipe anota na sua Caderneta: pressão, peso, altura uterina, batimentos do bebê.')}`;
}
function vbox(l, v, u, cls = '') { const has = v !== null && v !== undefined && v !== ''; return `<div class="vital" ${cls ? `style="border-color:var(--${cls === 'b' ? 'bad' : 'warn'});background:var(--${cls === 'b' ? 'bad' : 'warn'}-soft)"` : ''}><div class="vv">${has ? esc(v) : '—'}</div><div class="vl">${l}${has ? ' ' + u : ''}</div></div>`; }
function modalConsulta(id) {
  const c = id ? Store.get('consultas', id) : {}; const g = ga(c.data);
  const yn = (nm, v) => `<select class="in" id="${nm}"><option value="">—</option><option value="nao" ${v === false ? 'selected' : ''}>Não</option><option value="sim" ${v === true ? 'selected' : ''}>Sim</option></select>`;
  openModal(id ? '✏️ Editar consulta' : '🩺 Nova consulta', `
    <div class="row"><div><label class="lbl" for="c-data">Data</label><input class="in" type="date" id="c-data" max="${todayISO()}" value="${esc(c.data || todayISO())}" oninput="$('c-ig').textContent=(d=>d.w+'s'+d.d+'d')(ga(this.value))"></div>
    <div><label class="lbl">Idade gestacional</label><div class="in" id="c-ig" style="background:var(--brand-soft)">${g.w}s${g.d}d</div></div></div>
    <div class="row"><div><label class="lbl" for="c-local">Local</label><input class="in" id="c-local" value="${esc(c.local || '')}" placeholder="UBS"></div><div><label class="lbl" for="c-prof">Profissional</label><input class="in" id="c-prof" value="${esc(c.profissional || '')}"></div></div>
    <label class="lbl">Pressão arterial <span class="u">(mmHg)</span></label><div class="row"><input class="in" id="c-sis" type="number" inputmode="numeric" placeholder="máxima ex. 120" value="${esc(c.pa_sis ?? '')}" aria-label="Pressão sistólica"><input class="in" id="c-dia" type="number" inputmode="numeric" placeholder="mínima ex. 80" value="${esc(c.pa_dia ?? '')}" aria-label="Pressão diastólica"></div>
    <div class="row"><div><label class="lbl" for="c-peso">Peso <span class="u">(kg)</span></label><input class="in" id="c-peso" type="number" inputmode="decimal" step="0.1" value="${esc(c.peso_kg ?? '')}"></div><div><label class="lbl" for="c-au">Altura uterina <span class="u">(cm)</span></label><input class="in" id="c-au" type="number" inputmode="decimal" step="0.5" value="${esc(c.altura_uterina_cm ?? '')}"></div></div>
    <div class="row"><div><label class="lbl" for="c-bcf">BCF <span class="u">(bpm)</span></label><input class="in" id="c-bcf" type="number" inputmode="numeric" value="${esc(c.bcf_bpm ?? '')}"></div><div><label class="lbl" for="c-mov">Movimentação fetal</label><select class="in" id="c-mov"><option value="">—</option>${opt(MOV_OPT, c.movimentos_fetais)}</select></div></div>
    <div class="row"><div><label class="lbl" for="c-apr">Apresentação</label><select class="in" id="c-apr"><option value="">—</option>${opt(APR_OPT, c.apresentacao)}</select></div><div><label class="lbl" for="c-ede">Edema</label><select class="in" id="c-ede"><option value="">—</option>${opt(EDE_OPT, c.edema)}</select></div></div>
    <div class="row"><div><label class="lbl" for="c-uri">Queixas urinárias</label>${yn('c-uri', c.queixas_urinarias)}</div><div><label class="lbl" for="c-perd">Perdas vaginais</label>${yn('c-perd', c.perdas_vaginais)}</div></div>
    <label class="lbl" for="c-obs">Observações e conduta</label><textarea class="in" id="c-obs" rows="3" maxlength="4000">${esc(c.observacoes || '')}</textarea>
    <label class="lbl" for="c-next">Próxima consulta</label><input class="in" type="date" id="c-next" min="${todayISO()}" value="${esc(c.proxima_consulta || '')}">
    <button class="btn full" onclick="saveConsulta('${id || ''}')">Salvar consulta</button>`);
}
function saveConsulta(id) {
  document.querySelectorAll('.modal .in').forEach(e => e.classList.remove('err'));
  const data = val('c-data'); if (!data || data > todayISO()) return fieldErr('c-data', 'Data inválida');
  if (data < C.gaStart(S().gestacao)) return fieldErr('c-data', 'Data anterior ao início da gestação');
  const sis = num('c-sis'), dia = num('c-dia'), peso = num('c-peso'), au = num('c-au'), bcf = num('c-bcf');
  if ((sis == null) !== (dia == null)) return fieldErr(sis == null ? 'c-sis' : 'c-dia', 'Preencha as duas medidas da pressão');
  if (sis != null && (isNaN(sis) || sis < 50 || sis > 260)) return fieldErr('c-sis', 'Pressão máxima entre 50 e 260 (ex.: 120). Se o papel diz “12 por 8”, digite 120 e 80');
  if (dia != null && (isNaN(dia) || dia < 30 || dia > 180 || dia >= sis)) return fieldErr('c-dia', 'Pressão mínima entre 30 e 180 e menor que a máxima');
  if (peso != null && (isNaN(peso) || peso < 30 || peso > 250)) return fieldErr('c-peso', 'Peso entre 30 e 250 kg');
  if (au != null && (isNaN(au) || au < 5 || au > 60)) return fieldErr('c-au', 'Altura uterina entre 5 e 60 cm');
  if (bcf != null && (isNaN(bcf) || bcf < 50 || bcf > 240)) return fieldErr('c-bcf', 'BCF entre 50 e 240 bpm');
  const nx = val('c-next'); if (nx && nx < data) return fieldErr('c-next', 'A próxima consulta deve ser depois desta');
  const yn = v => v === 'sim' ? true : v === 'nao' ? false : null;
  const ig = ga(data);
  const r = Store.upsert('consultas', Object.assign(id ? { id } : {}, { data, ig_semanas: ig.w, ig_dias: ig.d, local: val('c-local') || null, profissional: val('c-prof') || null, pa_sis: sis, pa_dia: dia, peso_kg: peso, altura_uterina_cm: au, bcf_bpm: bcf,
    movimentos_fetais: val('c-mov') || null, apresentacao: val('c-apr') || null, edema: val('c-ede') || null, queixas_urinarias: yn(val('c-uri')), perdas_vaginais: yn(val('c-perd')), observacoes: val('c-obs') || null, proxima_consulta: nx || null }));
  closeModal(); if (!id) { earn('consulta:' + data, 30, 'Consulta registrada 🩺'); award('consulta'); if (au || peso) award('curva'); } else toast('Consulta atualizada');
  const bp = C.classifyBP(sis, dia); if (bp === 'grave') setTimeout(() => toast('⚠️ Pressão muito alta registrada — veja o Centro de cuidado'), 600);
  renderAll(); scheduleReminders();
}

/* ---------- Curvas da Caderneta ---------- */
function curvaPontos() {
  const gest = S().gestacao;
  const au = L('consultas').filter(c => c.altura_uterina_cm).map(c => ({ x: +(C.gaFrom(gest, c.data).days / 7).toFixed(2), y: +c.altura_uterina_cm, d: c.data })).sort((a, b) => a.x - b.x);
  const pesos = L('consultas').filter(c => c.peso_kg).map(c => ({ d: c.data, p: +c.peso_kg }))
    .concat(Store.isPlus() ? L('medicoes').filter(m => m.tipo === 'peso').map(m => ({ d: String(m.medido_em).slice(0, 10), p: +m.valor })) : []);
  const gw = gest.peso_pre_kg ? pesos.map(p => ({ x: +(C.gaFrom(gest, p.d).days / 7).toFixed(2), y: +(p.p - gest.peso_pre_kg).toFixed(1), d: p.d })).sort((a, b) => a.x - b.x) : [];
  const pa = L('consultas').filter(c => c.pa_sis).map(c => ({ x: +(C.gaFrom(gest, c.data).days / 7).toFixed(2), s: c.pa_sis, d: c.pa_dia })).sort((a, b) => a.x - b.x);
  return { au, gw, pa };
}
function recCurvas() {
  const gest = S().gestacao, P = curvaPontos();
  const imc = C.bmi(gest.peso_pre_kg, gest.altura_cm), cat = imc ? C.bmiCat(imc) : null, idade = C.ageYears(S().profile.data_nascimento);
  const lastAU = P.au[P.au.length - 1], auR = lastAU ? C.classifyAU(Math.floor(lastAU.x), lastAU.y) : null;
  const lastG = P.gw[P.gw.length - 1], gR = lastG && cat ? C.classifyGWG(cat, Math.floor(lastG.x), lastG.y, { adolescente: idade != null && idade < 19, gemelar: gest.tipo_gravidez !== 'unica' }) : null;
  const pill = r => !r ? '' : r.pos === 'dentro' ? '<span class="pill g">Dentro da faixa</span>' : r.pos === 'individual' ? '<span class="pill v">Orientação individual</span>' : `<span class="pill w">${r.pos === 'acima' ? 'Acima' : 'Abaixo'} da faixa</span>`;
  return `<p class="muted" style="font-size:13px;margin:2px 2px 12px">As mesmas curvas da Caderneta da Gestante. A faixa colorida é o esperado; seus pontos vêm das consultas registradas.</p>
    <div class="card"><h3>📏 Altura uterina ${pill(auR)}</h3>
      <span class="muted" style="font-size:12px">Percentis 10 a 90 por idade gestacional (16 a 40 semanas).</span>
      <canvas id="g-au" height="220" style="margin-top:10px" role="img" aria-label="Gráfico de altura uterina por idade gestacional"></canvas>
      <div class="legend"><span><i style="background:rgba(162,106,134,.25)"></i>P10–P90</span><span><i style="background:rgba(162,106,134,.7);height:2px"></i>P50</span><span><i style="background:#6a4664"></i>Você</span></div>
      ${auR && auR.msg ? `<p style="font-size:13px;margin:10px 0 0">${esc(auR.msg)}</p>` : ''}
      ${!P.au.length ? '<p class="muted" style="font-size:12.5px;text-align:center;margin:8px 0 0">Registre a <b>altura uterina</b> nas consultas para ver seus pontos.</p>' : ''}
      <p class="muted" style="font-size:11px;margin:10px 0 0">Referência: ${esc(C.auRef(30).fonte)}${C.auRef(30).fonte !== 'Caderneta 2026' ? ' — mesma metodologia (P10–P90) da curva da Caderneta 2026 (Assis et al., 2021), cujos valores numéricos ainda não foram publicados em formato aberto.' : '.'}</p></div>
    <div class="card"><h3>⚖️ Ganho de peso ${pill(gR)}</h3>
      ${cat ? `<span class="muted" style="font-size:12px">IMC pré-gestacional <b>${imc.toFixed(1).replace('.', ',')}</b> · ${C.GWG[cat].nome} · ganho recomendado até 40 semanas: <b>${C.GWG[cat].total.map(x => x.toFixed(1).replace('.', ',')).join(' a ')} kg</b></span>
        <canvas id="g-peso" height="220" style="margin-top:10px" role="img" aria-label="Gráfico de ganho de peso por idade gestacional"></canvas>
        <div class="legend"><span><i style="background:rgba(92,132,104,.28)"></i>Faixa recomendada (${C.GWG[cat].faixa})</span><span><i style="background:#6a4664"></i>Seu ganho</span></div>
        ${gR && gR.msg ? `<p style="font-size:13px;margin:10px 0 0">${esc(gR.msg)}</p>` : ''}
        ${!P.gw.length ? '<p class="muted" style="font-size:12.5px;text-align:center;margin:8px 0 0">Registre o <b>peso</b> nas consultas para ver sua curva.</p>' : ''}
        <p class="muted" style="font-size:11px;margin:10px 0 0">Referência: Caderneta 2026 / Kac et al., Am J Clin Nutr 2021. Faixa desenhada pelos pontos oficiais de 13, 27 e 40 semanas. Curvas válidas para gestação de um bebê em adultas.</p>`
      : `<p class="muted" style="font-size:13px;margin:8px 0">Para calcular sua faixa, informe sua altura e o peso de antes da gravidez:</p>
        <div class="row"><input class="in" id="cv-alt" type="number" inputmode="decimal" placeholder="Altura (cm)" aria-label="Altura em cm"><input class="in" id="cv-pp" type="number" inputmode="decimal" step="0.1" placeholder="Peso antes (kg)" aria-label="Peso antes da gravidez em kg"></div>
        <button class="btn full sm" onclick="saveIMC()">Calcular minha faixa</button>`}</div>
    ${P.pa.length ? `<div class="card"><h3>🩺 Pressão nas consultas</h3><span class="muted" style="font-size:12px">Linhas de alerta: 140/90 (elevada) e 160/110 (urgência).</span><canvas id="g-pa" height="200" style="margin-top:10px" role="img" aria-label="Gráfico de pressão arterial"></canvas></div>` : ''}`;
}
function saveIMC() {
  const a = num('cv-alt'), p = num('cv-pp');
  if (a == null || isNaN(a) || a < 120 || a > 220) return fieldErr('cv-alt', 'Altura em cm (ex.: 162)');
  if (p == null || isNaN(p) || p < 30 || p > 250) return fieldErr('cv-pp', 'Peso em kg (ex.: 61,5)');
  Store.setGestacao({ altura_cm: a, peso_pre_kg: p }); toast('Faixa calculada 💜'); renderRecBody();
}
function gOpts(xt, yt, xmin, xmax, extra = {}) {
  return Object.assign({ responsive: true, maintainAspectRatio: true, animation: false, plugins: { legend: { display: false }, tooltip: { filter: i => i.dataset.label === 'Você' || i.dataset.label === 'Sistólica' || i.dataset.label === 'Diastólica' } },
    scales: { y: { title: { display: !!yt, text: yt, font: { size: 10 } }, grid: { color: chartGrid() }, ticks: { font: { size: 10 }, color: chartInk() } },
      x: { type: 'linear', min: xmin, max: xmax, title: { display: !!xt, text: xt, font: { size: 10 } }, grid: { display: false }, ticks: { font: { size: 10 }, color: chartInk(), stepSize: 4 } } } }, extra);
}
function drawCurvas() {
  const gest = S().gestacao, P = curvaPontos(), band = 'rgba(162,106,134,.22)', line = 'rgba(162,106,134,.55)', me = '#6a4664';
  const wks = []; for (let w = C.AU_SEMANAS[0]; w <= C.AU_SEMANAS[1]; w++) wks.push(w);
  chart('g-au', { type: 'line', data: { datasets: [
    { label: 'P90', data: wks.map(w => ({ x: w, y: C.auRef(w).p90 })), borderColor: line, borderWidth: 1, pointRadius: 0, fill: '+1', backgroundColor: band, tension: .3 },
    { label: 'P10', data: wks.map(w => ({ x: w, y: C.auRef(w).p10 })), borderColor: line, borderWidth: 1, pointRadius: 0, fill: false, tension: .3 },
    { label: 'P50', data: wks.map(w => ({ x: w, y: C.auRef(w).p50 })), borderColor: line, borderWidth: 1.5, borderDash: [5, 4], pointRadius: 0, tension: .3 },
    { label: 'Você', data: P.au.filter(p => p.x >= 12), borderColor: me, backgroundColor: me, borderWidth: 2.5, pointRadius: 5, showLine: true, tension: .2 }] }, options: gOpts('Idade gestacional (semanas)', 'cm', 16, 40) });
  const imc = C.bmi(gest.peso_pre_kg, gest.altura_cm);
  if (imc) {
    const cat = C.bmiCat(imc), ws = []; for (let w = 0; w <= 40; w++) ws.push(w);
    chart('g-peso', { type: 'line', data: { datasets: [
      { label: 'Máximo', data: ws.map(w => ({ x: w, y: C.gwgRange(cat, w)[1] })), borderColor: 'rgba(92,132,104,.6)', borderWidth: 1, pointRadius: 0, fill: '+1', backgroundColor: 'rgba(92,132,104,.2)' },
      { label: 'Mínimo', data: ws.map(w => ({ x: w, y: C.gwgRange(cat, w)[0] })), borderColor: 'rgba(92,132,104,.6)', borderWidth: 1, pointRadius: 0, fill: false },
      { label: 'Você', data: P.gw, borderColor: me, backgroundColor: me, borderWidth: 2.5, pointRadius: 5, showLine: true, tension: .2 }] }, options: gOpts('Idade gestacional (semanas)', 'ganho (kg)', 0, 40) });
  }
  if (P.pa.length) {
    const x0 = Math.max(0, Math.floor(P.pa[0].x) - 2), x1 = Math.min(42, Math.ceil(P.pa[P.pa.length - 1].x) + 2);
    const hl = (y, c) => ({ label: String(y), data: [{ x: x0, y }, { x: x1, y }], borderColor: c, borderWidth: 1.2, borderDash: [6, 4], pointRadius: 0 });
    chart('g-pa', { type: 'line', data: { datasets: [
      { label: 'Sistólica', data: P.pa.map(p => ({ x: p.x, y: p.s })), borderColor: me, backgroundColor: me, borderWidth: 2.5, pointRadius: 4, tension: .2 },
      { label: 'Diastólica', data: P.pa.map(p => ({ x: p.x, y: p.d })), borderColor: '#a26a86', backgroundColor: '#a26a86', borderWidth: 2.5, pointRadius: 4, tension: .2 },
      hl(140, 'rgba(180,130,61,.8)'), hl(90, 'rgba(180,130,61,.8)'), hl(160, 'rgba(189,85,104,.85)'), hl(110, 'rgba(189,85,104,.85)')] }, options: gOpts('Idade gestacional (semanas)', 'mmHg', x0, x1, {}) });
  }
}

/* ---------- Movimentos (grátis — segurança) ---------- */
function recMovimentos() {
  const g = ga(), ks = L('movimentos').slice().sort((a, b) => b.inicio.localeCompare(a.inicio));
  return `<div class="card"><h3>👶 Contar movimentos</h3>
    <p class="muted" style="font-size:13px;margin:4px 0 10px">${g.w >= C.MOV.desde ? 'Recomendado diariamente a partir de 28 semanas.' : 'Fica mais importante a partir de 28 semanas.'} Deite de lado, num momento tranquilo, e toque a cada movimento até chegar a ${C.MOV.alvo}. O esperado é sentir ${C.MOV.alvo} em até 2 horas.</p>
    <button class="btn full" onclick="modalKick()">▶️ Iniciar contagem</button>
    <p style="font-size:12.5px;margin:10px 0 0;color:var(--bad);font-weight:600">Se o bebê está mexendo menos que o normal, ou ficou mais de 4 horas sem mexer (após 20 semanas), procure atendimento — não espere.</p></div>
    ${ks.length ? `<div class="card">${ks.slice(0, 15).map(k => `<div class="list-item"><div class="li-ic">👶</div><div class="li-t"><b>${k.contagem} movimentos em ${k.duracao_min} min</b><span>${fmtDT(k.inicio)}</span></div>
      ${k.contagem >= C.MOV.alvo && k.duracao_min <= C.MOV.minutos ? '<span class="pill g">Ok</span>' : '<span class="pill w">Atenção</span>'}<button class="x" style="font-size:16px" aria-label="Excluir contagem" onclick="confirmBox('Excluir esta contagem?',()=>{Store.remove('movimentos','${k.id}');renderRecBody()})">🗑️</button></div>`).join('')}</div>` : ''}`;
}
let _kick = null, _kickT = null;
function modalKick() {
  _kick = { count: 0, start: Date.now() };
  openModal('👶 Contagem de movimentos', `<div style="text-align:center">
    <div class="muted" style="font-size:14px">Toque a cada movimento que sentir</div>
    <div style="font-family:var(--serif);font-size:66px;color:var(--violet)" id="kick-n" aria-live="polite">0</div>
    <div class="muted" id="kick-time">00:00</div>
    <button class="btn full" style="margin:14px 0;font-size:20px;padding:22px" onclick="addKick()">👶 Senti um movimento!</button>
    <div id="kick-msg" class="muted" style="font-size:12.5px">Meta: ${C.MOV.alvo} movimentos em até 2 horas.</div>
    <button class="btn sec full" style="margin-top:12px" onclick="saveKick()">Finalizar e salvar</button></div>`, { onClose: () => clearInterval(_kickT) });
  clearInterval(_kickT); _kickT = setInterval(() => {
    const el = $('kick-time'); if (!el || !_kick) return clearInterval(_kickT);
    const s = Math.floor((Date.now() - _kick.start) / 1000); el.textContent = String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
    if (s >= C.MOV.minutos * 60 && _kick.count < C.MOV.alvo && !_kick.warned) { _kick.warned = true; $('kick-msg').innerHTML = '<b style="color:var(--bad)">2 horas sem completar 10 movimentos. Procure a maternidade agora.</b> <a href="tel:192">Ligar 192</a>'; }
  }, 1000);
}
function addKick() { if (!_kick) return; _kick.count++; $('kick-n').textContent = _kick.count; if (navigator.vibrate) navigator.vibrate(30);
  if (_kick.count === C.MOV.alvo) { const m = Math.max(1, Math.round((Date.now() - _kick.start) / 60000)); $('kick-msg').innerHTML = `<b style="color:var(--good)">🎉 ${C.MOV.alvo} movimentos em ${m} min!</b> Pode salvar.`; } }
function saveKick() {
  clearInterval(_kickT); if (!_kick) return closeModal();
  const mins = Math.max(1, Math.round((Date.now() - _kick.start) / 60000));
  if (_kick.count > 0) { const r = Store.upsert('movimentos', { inicio: new Date(_kick.start).toISOString(), duracao_min: mins, contagem: _kick.count }); earn('mov:' + todayISO(), 15, 'Contagem salva 👶'); award('movimentos');
    if (_kick.count < C.MOV.alvo) setTimeout(() => toast('Poucos movimentos nesta contagem — veja o Centro de cuidado'), 700); }
  _kick = null; A.modalClose = null; closeModal(); renderAll();
}

/* ---------- Exames (Plus) ---------- */
function recExames() {
  const ex = L('exames').slice().sort((a, b) => b.data.localeCompare(a.data));
  const pend = Alerts.pendentes(ctx());
  const charts = ['hb', 'glicemia_jejum'].filter(k => ex.filter(e => e.codigo === k && e.valor_num != null).length >= 2);
  return `<button class="btn full" onclick="modalExame()">+ Registrar exame</button><div style="height:12px"></div>
    ${pend.length ? `<div class="card"><h3>🧪 Pendentes neste trimestre</h3>${pend.map(p => `<div class="exrow"><span class="dot w"></span><div class="en">${esc(p.nome)}</div><button class="btn sec sm" onclick="modalExame(null,'${p.id}')">Registrar</button></div>`).join('')}</div>` : ''}
    ${charts.map(k => `<div class="card"><h3 style="font-size:14px">${esc(C.EXAME[k].nome)}</h3><canvas id="ch-${k}" height="150"></canvas></div>`).join('')}
    ${ex.length ? ex.map(e => { const r = C.interpretExam(e.codigo, e.valor_num != null ? e.valor_num : e.valor_txt); const ig = C.gaFrom(S().gestacao, e.data);
      return `<div class="card"><div style="display:flex;justify-content:space-between;gap:8px"><div><h3 style="margin:0">${esc(e.nome || (C.EXAME[e.codigo] || {}).nome || 'Exame')}</h3><span class="muted" style="font-size:12.5px">${fmt(e.data)} · ${ig.w}s · ${C.trimester(ig.w)}º tri</span></div>
        <div style="display:flex;gap:4px"><button class="x" style="font-size:18px" aria-label="Editar exame" onclick="modalExame('${e.id}')">✏️</button><button class="x" style="font-size:18px" aria-label="Excluir exame" onclick="confirmBox('Excluir este exame?',()=>{Store.remove('exames','${e.id}');renderRecBody()},{danger:true,yes:'Excluir'})">🗑️</button></div></div>
        <div style="font-family:var(--serif);font-size:22px;color:var(--violet);margin-top:6px">${esc(e.valor_num != null ? String(e.valor_num).replace('.', ',') : e.valor_txt || '')} <span style="font-size:13px;font-family:var(--font);color:var(--muted)">${esc(e.unidade || '')}</span></div>
        ${r && r.sev !== 'ok' && r.msg ? `<div class="alert ${r.sev === 'alta' || r.sev === 'media' ? 'atencao' : 'info'}" style="margin:8px 0 0;padding:10px"><div style="font-size:13px">${esc(r.msg)}</div></div>` : r && r.sev === 'ok' ? '<span class="pill g" style="margin-top:6px">Dentro do esperado</span>' : ''}
        ${e.arquivo_path ? `<img class="thumb" data-path="${esc(e.arquivo_path)}" alt="Foto do laudo">` : ''}
        ${e.observacoes ? `<div class="muted" style="margin-top:8px;font-size:13px">📝 ${esc(e.observacoes)}</div>` : ''}</div>`; }).join('')
      : empty('🔬', 'Nenhum exame registrado', 'Registre os resultados da sua Caderneta e acompanhe a evolução.')}`;
}
function drawExamCharts() {
  ['hb', 'glicemia_jejum'].forEach(k => {
    const d = L('exames').filter(e => e.codigo === k && e.valor_num != null).sort((a, b) => a.data.localeCompare(b.data)); if (d.length < 2) return;
    const ref = k === 'hb' ? 11 : 92;
    chart('ch-' + k, { type: 'line', data: { labels: d.map(x => fmt(x.data).slice(0, 5)), datasets: [{ label: 'Você', data: d.map(x => +x.valor_num), borderColor: '#6a4664', backgroundColor: 'rgba(106,70,100,.12)', fill: true, tension: .3, pointRadius: 5, borderWidth: 2.5 },
      { label: 'Referência', data: d.map(() => ref), borderColor: 'rgba(180,130,61,.8)', borderDash: [6, 4], borderWidth: 1.2, pointRadius: 0 }] },
      options: { animation: false, plugins: { legend: { display: false } }, scales: { y: { grid: { color: chartGrid() }, ticks: { color: chartInk() } }, x: { grid: { display: false }, ticks: { color: chartInk() } } } } });
  });
}
function modalExame(id, codigo) {
  if (needPlus('exames')) return;
  const e = id ? Store.get('exames', id) : { codigo: codigo || 'hb', data: todayISO() };
  const grupos = [[1, '1º trimestre'], [2, '2º trimestre'], [3, '3º trimestre'], [0, 'Se indicado']];
  openModal(id ? '✏️ Editar exame' : '🔬 Novo exame', `
    <label class="lbl" for="e-cod">Exame</label><select class="in" id="e-cod" onchange="examField()">${grupos.map(([t, n]) => `<optgroup label="${n}">${C.EXAMES.filter(x => t ? x.tri[0] === t : !x.tri.length).map(x => `<option value="${x.id}" ${x.id === e.codigo ? 'selected' : ''}>${esc(x.nome)}</option>`).join('')}</optgroup>`).join('')}</select>
    <div id="e-outro-w"><label class="lbl" for="e-nome">Nome do exame</label><input class="in" id="e-nome" value="${esc(e.codigo === 'outro' ? e.nome || '' : '')}"></div>
    <label class="lbl" for="e-data">Data do resultado</label><input class="in" type="date" id="e-data" max="${todayISO()}" value="${esc(e.data)}">
    <div id="e-val-w"></div>
    <label class="lbl" for="e-img">📷 Foto do laudo (opcional)</label><input class="in" type="file" accept="image/*" id="e-img">
    <label class="lbl" for="e-obs">Observações</label><textarea class="in" id="e-obs" rows="2" maxlength="4000">${esc(e.observacoes || '')}</textarea>
    <button class="btn full" onclick="saveExame('${id || ''}')">Salvar exame</button>`);
  A._exVal = e; examField();
}
function examField() {
  const x = C.EXAME[val('e-cod')], e = A._exVal || {}, same = e.codigo === x.id, w = $('e-val-w');
  $('e-outro-w').style.display = x.id === 'outro' ? '' : 'none';
  const cur = same ? (e.valor_num != null ? e.valor_num : e.valor_txt) : '';
  w.innerHTML = x.tipo === 'num' ? `<label class="lbl" for="e-val">Resultado <span class="u">(${esc(x.unidade)})</span></label><input class="in" id="e-val" type="text" inputmode="decimal" autocomplete="off" placeholder="ex.: 11,8" value="${esc(cur != null ? String(cur).replace('.', ',') : '')}">`
    : x.tipo === 'texto' ? `<label class="lbl" for="e-val">Resultado / laudo</label><textarea class="in" id="e-val" rows="2">${esc(cur || '')}</textarea>`
    : `<label class="lbl">Resultado</label><div class="chip-row" id="e-opts">${x.opcoes.map(o => `<button type="button" class="chip ${cur === o ? 'on' : ''}" onclick="document.querySelectorAll('#e-opts .chip').forEach(c=>c.classList.remove('on'));this.classList.add('on');$('e-val').value='${jsq(o)}'">${esc(o)}</button>`).join('')}</div><input type="hidden" id="e-val" value="${esc(cur || '')}">`;
}
async function saveExame(id) {
  const x = C.EXAME[val('e-cod')], data = val('e-data');
  if (!data || data > todayISO()) return fieldErr('e-data', 'Data inválida');
  let v = val('e-val'), file = $('e-img').files[0];
  if (!v && !file) return toast('Informe o resultado ou anexe a foto do laudo');
  const rec = { codigo: x.id, nome: x.id === 'outro' ? (val('e-nome') || 'Outro exame') : x.nome, data, unidade: x.unidade || null, observacoes: val('e-obs') || null, valor_num: null, valor_txt: null };
  if (v) { if (x.tipo === 'num') { const n = parseFloat(v.replace(',', '.')); if (isNaN(n) || n < 0 || n > 10000) return fieldErr('e-val', 'Valor numérico inválido'); rec.valor_num = n; } else rec.valor_txt = v.slice(0, 500); }
  if (!v) rec.valor_txt = 'Ver laudo';
  let r = Store.upsert('exames', Object.assign(id ? { id } : {}, rec));
  if (file) { try { r = await Store.attachImage('exames', r, file); } catch (e) { toast('Não foi possível anexar a foto'); } }
  closeModal(); if (!id) { earn(`exame:${rec.codigo}:${data}`, 30, 'Exame salvo 🔬'); award('exame1'); } renderAll();
  const it = C.interpretExam(rec.codigo, rec.valor_num != null ? rec.valor_num : rec.valor_txt); if (it && (it.sev === 'alta' || it.sev === 'media')) setTimeout(() => toast('Resultado fora do esperado — veja a orientação no Centro de cuidado'), 600);
}

/* ---------- Ultrassom (Plus) ---------- */
function recEco() {
  const ec = L('ultrassons').slice().sort((a, b) => b.data.localeCompare(a.data));
  return `<button class="btn full" onclick="modalEco()">+ Registrar ultrassom</button><div style="height:12px"></div>
    ${ec.length ? ec.map(e => { const igd = C.gaFrom(Object.assign({}, S().gestacao, { metodo_ig: S().gestacao.dum ? 'dum' : S().gestacao.metodo_ig }), e.data);
      return `<div class="card"><div style="display:flex;justify-content:space-between;gap:8px"><div><h3 style="margin:0">${esc(e.tipo || 'Ultrassom')}</h3><span class="muted" style="font-size:12.5px">${fmt(e.data)}${e.ig_usg_semanas != null ? ` · IG pelo USG ${e.ig_usg_semanas}s${e.ig_usg_dias || 0}d` : ''}${S().gestacao.dum ? ` · pela DUM ${igd.w}s${igd.d}d` : ''}</span></div>
      <button class="x" style="font-size:18px" aria-label="Excluir ultrassom" onclick="confirmBox('Excluir este ultrassom?',()=>{Store.remove('ultrassons','${e.id}');renderRecBody()},{danger:true,yes:'Excluir'})">🗑️</button></div>
      ${e.arquivo_path ? `<img class="thumb" data-path="${esc(e.arquivo_path)}" alt="Imagem do ultrassom">` : ''}
      <div class="vital-grid" style="margin-top:10px">${e.peso_fetal_g ? vbox('Peso estimado', e.peso_fetal_g, 'g') : ''}${e.percentil != null ? vbox('Percentil', e.percentil, '') : ''}${e.bcf_bpm ? vbox('BCF', e.bcf_bpm, 'bpm') : ''}${e.liquido ? vbox('Líquido', e.liquido, '') : ''}</div>
      ${e.placenta ? `<div class="muted" style="font-size:13px;margin-top:8px">Placenta: ${esc(e.placenta)}</div>` : ''}${e.observacoes ? `<div class="muted" style="margin-top:6px;font-size:13px">📝 ${esc(e.observacoes)}</div>` : ''}</div>`; }).join('')
      : empty('🖼️', 'Guarde seus ultrassons', 'Cada exame em um só álbum, com os dados do laudo.')}`;
}
function modalEco() {
  if (needPlus('ultrassons')) return;
  openModal('🖼️ Novo ultrassom', `<label class="lbl" for="u-tipo">Tipo</label><select class="in" id="u-tipo">${opt(['Obstétrico 1º trimestre', 'Morfológico 1º trimestre / TN', 'Morfológico 2º trimestre', 'Obstétrico 3º trimestre', 'Doppler obstétrico', 'Ecocardiograma fetal', 'Outro'])}</select>
    <label class="lbl" for="u-data">Data</label><input class="in" type="date" id="u-data" max="${todayISO()}" value="${todayISO()}">
    <label class="lbl">IG pelo ultrassom (do laudo)</label><div class="row"><input class="in" id="u-sem" type="number" placeholder="semanas" aria-label="semanas"><input class="in" id="u-dias" type="number" placeholder="dias" min="0" max="6" aria-label="dias"></div>
    <div class="row"><div><label class="lbl" for="u-peso">Peso fetal <span class="u">(g)</span></label><input class="in" id="u-peso" type="number" inputmode="numeric"></div><div><label class="lbl" for="u-perc">Percentil</label><input class="in" id="u-perc" type="number" inputmode="decimal"></div></div>
    <div class="row"><div><label class="lbl" for="u-bcf">BCF <span class="u">(bpm)</span></label><input class="in" id="u-bcf" type="number" inputmode="numeric"></div><div><label class="lbl" for="u-liq">Líquido</label><select class="in" id="u-liq"><option value="">—</option>${opt(['Normal', 'Reduzido', 'Aumentado'])}</select></div></div>
    <label class="lbl" for="u-plac">Placenta</label><input class="in" id="u-plac" placeholder="Ex.: anterior, grau I">
    <label class="lbl" for="u-img">📷 Imagem</label><input class="in" type="file" accept="image/*" id="u-img">
    <label class="lbl" for="u-obs">Observações</label><textarea class="in" id="u-obs" rows="2" maxlength="4000"></textarea>
    ${!S().gestacao.usg_data ? '<label class="check" style="font-size:13px"><input type="checkbox" id="u-datar"> Usar este exame para datar a gestação (1º ultrassom)</label>' : ''}
    <button class="btn full" onclick="saveEco()">Salvar ultrassom</button>`);
}
async function saveEco() {
  const data = val('u-data'); if (!data || data > todayISO()) return fieldErr('u-data', 'Data inválida');
  const sem = val('u-sem') === '' ? null : +val('u-sem'), dias = val('u-dias') === '' ? null : +val('u-dias');
  if (sem != null && (sem < 4 || sem > 44)) return fieldErr('u-sem', 'Semanas entre 4 e 44'); if (dias != null && (dias < 0 || dias > 6)) return fieldErr('u-dias', 'Dias de 0 a 6');
  const n = id => val(id) === '' ? null : +val(id);
  let r = Store.upsert('ultrassons', { tipo: val('u-tipo'), data, ig_usg_semanas: sem, ig_usg_dias: dias, peso_fetal_g: n('u-peso'), percentil: n('u-perc'), bcf_bpm: n('u-bcf'), liquido: val('u-liq') || null, placenta: val('u-plac') || null, observacoes: val('u-obs') || null });
  const f = $('u-img').files[0]; if (f) { try { r = await Store.attachImage('ultrassons', r, f); } catch (e) { toast('Não foi possível anexar a imagem'); } }
  if ($('u-datar') && $('u-datar').checked && sem != null) { Store.setGestacao({ metodo_ig: 'usg', usg_data: data, usg_ig_semanas: sem, usg_ig_dias: dias || 0 }); Store.setGestacao({ dpp: ga().dpp }); toast('Gestação datada pelo ultrassom'); }
  closeModal(); earn('eco:' + data, 20, 'Ultrassom guardado 🖼️'); award('eco'); renderAll();
}

/* ---------- Em casa (Plus) ---------- */
const MON = { pressao: { nome: 'Pressão arterial', ic: '🩺', u: 'mmHg', meta: 'Alerta a partir de 140/90 mmHg' }, glicemia: { nome: 'Glicemia capilar', ic: '🩸', u: 'mg/dL', meta: 'Metas: jejum < 95 · 1 h após < 140 · 2 h após < 120' },
  peso: { nome: 'Peso', ic: '⚖️', u: 'kg', meta: 'Entra na sua curva de ganho de peso' }, temperatura: { nome: 'Temperatura', ic: '🌡️', u: '°C', meta: 'Febre: acima de 37,8 °C' } };
function monOn(k) { return !!((Store.prefs.monitores || {})[k] || {}).ativo; }
function recCasa() {
  const ativos = Object.keys(MON).filter(monOn), custom = L('monitores');
  let h = `<p class="muted" style="font-size:13px;margin:2px 2px 12px">Acompanhe em casa o que sua equipe pediu. Os valores viram gráficos para levar à consulta.</p>`;
  if (!ativos.length && !custom.length) h += empty('🏠', 'Nenhum acompanhamento ativo', 'Ative abaixo o que precisa acompanhar.');
  ativos.forEach(k => { h += monitorCard(k); }); custom.forEach(c => { h += monitorCard('custom:' + c.id); });
  h += `<div class="card"><h3>⚙️ O que acompanhar</h3>${Object.keys(MON).map(k => `<div class="setrow"><div class="li-ic" style="width:36px;height:36px;border-radius:11px;background:var(--brand-soft);display:flex;align-items:center;justify-content:center">${MON[k].ic}</div><div class="st"><b>${MON[k].nome}</b><span>${MON[k].meta}${monOn(k) && (Store.prefs.monitores[k].horarios || []).length ? ' · lembrete ' + Store.prefs.monitores[k].horarios.join(', ') : ''}</span></div>
    ${monOn(k) && (k === 'pressao' || k === 'glicemia') ? `<button class="btn sec sm" onclick="modalMonHorarios('${k}')" aria-label="Horários de lembrete">⏰</button>` : ''}<label class="toggle"><input type="checkbox" ${monOn(k) ? 'checked' : ''} onchange="toggleMon('${k}',this.checked)" aria-label="Ativar ${MON[k].nome}"><span></span></label></div>`).join('')}
    <button class="btn sec full sm" style="margin-top:12px" onclick="modalCustomMonitor()">+ Acompanhamento personalizado</button></div>`;
  return h;
}
function toggleMon(k, on) { const m = Object.assign({}, Store.prefs.monitores); m[k] = Object.assign({}, m[k], { ativo: on }); Store.patchPrefs({ monitores: m }); renderRecBody(); scheduleReminders(); }
function modalMonHorarios(k) {
  openModal('⏰ Lembretes — ' + MON[k].nome, `<label class="lbl" for="mh-h">Horários (separados por vírgula)</label><input class="in" id="mh-h" value="${esc(((Store.prefs.monitores || {})[k] || {}).horarios ? Store.prefs.monitores[k].horarios.join(', ') : '')}" placeholder="${k === 'glicemia' ? '07:00, 09:00, 14:00, 21:00' : '08:00, 20:00'}">
    <button class="btn full" onclick="saveMonHorarios('${k}')">Salvar</button>`);
}
function parseHorarios(s) { const out = [], bad = []; String(s || '').split(/[,;\s]+/).filter(Boolean).forEach(h => { const m = h.match(/^(\d{1,2})(?::|h)?(\d{2})?$/); if (!m) return bad.push(h); const hh = +m[1], mm = +(m[2] || 0); if (hh > 23 || mm > 59) return bad.push(h); out.push(String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0')); }); return { out: [...new Set(out)].sort(), bad }; }
function saveMonHorarios(k) { const { out, bad } = parseHorarios(val('mh-h')); if (bad.length) return fieldErr('mh-h', 'Horário inválido: ' + bad.join(', ')); const m = Object.assign({}, Store.prefs.monitores); m[k] = Object.assign({}, m[k], { horarios: out }); Store.patchPrefs({ monitores: m }); closeModal(); renderRecBody(); scheduleReminders(); toast('Lembretes salvos ⏰'); }
function monitorCard(key) {
  const custom = key.startsWith('custom:'), mid = custom ? key.slice(7) : null, cm = custom && Store.get('monitores', mid);
  const cfg = custom ? { nome: cm.nome, ic: '📈', u: cm.unidade || '', meta: (cm.minimo != null || cm.maximo != null) ? `Faixa: ${cm.minimo ?? '–'} a ${cm.maximo ?? '–'} ${cm.unidade || ''}` : '' } : MON[key];
  const logs = L('medicoes').filter(m => custom ? m.monitor_id === mid : m.tipo === key).sort((a, b) => b.medido_em.localeCompare(a.medido_em));
  const alertOf = l => key === 'pressao' ? (C.classifyBP(l.sis, l.dia) !== 'ok') : key === 'glicemia' ? ((C.classifyGlucose(l.valor, l.momento) || {}).sev === 'media') : key === 'temperatura' ? +l.valor > C.FEBRE : custom ? ((cm.minimo != null && +l.valor < +cm.minimo) || (cm.maximo != null && +l.valor > +cm.maximo)) : false;
  const show = l => key === 'pressao' ? `${l.sis}/${l.dia}` : String(l.valor).replace('.', ',');
  return `<div class="card"><div style="display:flex;justify-content:space-between;align-items:center"><h3 style="margin:0">${cfg.ic} ${esc(cfg.nome)}</h3>
      <div style="display:flex;gap:6px">${custom ? `<button class="x" style="font-size:16px" aria-label="Excluir acompanhamento" onclick="confirmBox('Excluir este acompanhamento e suas medições?',()=>{Store.remove('monitores','${mid}');L('medicoes').filter(m=>m.monitor_id==='${mid}').forEach(m=>Store.remove('medicoes',m.id));renderRecBody()},{danger:true,yes:'Excluir'})">🗑️</button>` : ''}<button class="btn sm" onclick="modalMedicao('${esc(key)}')">+ Registrar</button></div></div>
    ${cfg.meta ? `<span class="muted" style="font-size:12px">${esc(cfg.meta)}</span>` : ''}
    ${logs.length >= 2 ? `<canvas id="hc-${esc(key.replace(':', '_'))}" height="140" style="margin-top:10px"></canvas>` : ''}
    ${logs.length ? logs.slice(0, 6).map(l => `<div class="list-item" style="padding:9px 0"><div class="li-t"><b style="font-size:14px">${esc(show(l))} <span class="muted" style="font-size:12px;font-weight:500">${esc(cfg.u)}</span> ${alertOf(l) ? '<span class="pill b">⚠ Atenção</span>' : ''}</b>
      <span>${fmtDT(l.medido_em)}${l.momento ? ' · ' + esc((C.GLI_MOMENTOS.find(m => m.id === l.momento) || {}).nome || l.momento) : ''}${l.nota ? ' · ' + esc(l.nota) : ''}</span></div>
      <button class="x" style="font-size:16px" aria-label="Excluir medição" onclick="confirmBox('Excluir esta medição?',()=>{Store.remove('medicoes','${l.id}');renderRecBody()},{danger:true,yes:'Excluir'})">🗑️</button></div>`).join('') : '<p class="muted" style="font-size:13px;margin:10px 0 0">Sem medições ainda.</p>'}</div>`;
}
function modalMedicao(key) {
  if (needPlus('casa')) return;
  const custom = key.startsWith('custom:'), cm = custom && Store.get('monitores', key.slice(7)), u = custom ? cm.unidade : MON[key].u;
  openModal(`${custom ? '📈 ' + esc(cm.nome) : MON[key].ic + ' ' + MON[key].nome}`, `<div class="row"><div><label class="lbl" for="md-d">Data</label><input class="in" type="date" id="md-d" max="${todayISO()}" value="${todayISO()}"></div><div><label class="lbl" for="md-h">Hora</label><input class="in" type="time" id="md-h" value="${nowHM()}"></div></div>
    ${key === 'pressao' ? `<div class="row"><div><label class="lbl" for="md-s">Máxima (sistólica)</label><input class="in" id="md-s" type="number" inputmode="numeric" placeholder="120"></div><div><label class="lbl" for="md-di">Mínima (diastólica)</label><input class="in" id="md-di" type="number" inputmode="numeric" placeholder="80"></div></div>`
      : `<label class="lbl" for="md-v">Valor <span class="u">(${esc(u || '')})</span></label><input class="in" id="md-v" type="number" inputmode="decimal" step="0.1">`}
    ${key === 'glicemia' ? `<label class="lbl" for="md-m">Momento</label><select class="in" id="md-m">${opt(C.GLI_MOMENTOS.map(m => [m.id, m.nome]))}</select>` : ''}
    <label class="lbl" for="md-n">Observação</label><input class="in" id="md-n" maxlength="500">
    <button class="btn full" onclick="saveMedicao('${esc(key)}')">Salvar medição</button>`);
}
function saveMedicao(key) {
  const d = val('md-d'), h = val('md-h') || '12:00'; if (!d) return fieldErr('md-d', 'Informe a data');
  const when = new Date(`${d}T${h}:00`); if (when > new Date(Date.now() + 5 * 60000)) return fieldErr('md-h', 'Data/hora no futuro');
  const custom = key.startsWith('custom:'), rec = { tipo: custom ? 'custom' : key, monitor_id: custom ? key.slice(7) : null, medido_em: when.toISOString(), nota: val('md-n') || null };
  if (key === 'pressao') { const s = num('md-s'), di = num('md-di'); if (!s || isNaN(s) || s < 50 || s > 260) return fieldErr('md-s', 'Máxima entre 50 e 260'); if (!di || isNaN(di) || di < 30 || di > 180 || di >= s) return fieldErr('md-di', 'Mínima entre 30 e 180, menor que a máxima'); rec.sis = s; rec.dia = di; }
  else { const v = num('md-v'); const lim = { glicemia: [20, 600], peso: [30, 250], temperatura: [34, 43] }[key] || [-1e6, 1e6]; if (v == null || isNaN(v) || v < lim[0] || v > lim[1]) return fieldErr('md-v', `Valor entre ${lim[0]} e ${lim[1]}`); rec.valor = v; }
  if (key === 'glicemia') rec.momento = val('md-m');
  const r = Store.upsert('medicoes', rec); closeModal(); earn('med:' + key + ':' + d, 5); award('guardia');
  const al = Alerts.compute(ctx()).find(a => a.sev === 'urgente'); toast(al ? '⚠️ ' + al.titulo + ' — veja o Centro de cuidado' : 'Medição salva 💜'); renderAll();
}
function drawCasaCharts() {
  Object.keys(MON).filter(monOn).concat(L('monitores').map(c => 'custom:' + c.id)).forEach(key => {
    const custom = key.startsWith('custom:'), logs = L('medicoes').filter(m => custom ? m.monitor_id === key.slice(7) : m.tipo === key).sort((a, b) => a.medido_em.localeCompare(b.medido_em)); if (logs.length < 2) return;
    const labels = logs.map(l => fmtDT(l.medido_em).slice(0, 5));
    const ds = key === 'pressao' ? [{ label: 'Sistólica', data: logs.map(l => l.sis), borderColor: '#6a4664', tension: .3, borderWidth: 2.5, pointRadius: 3 }, { label: 'Diastólica', data: logs.map(l => l.dia), borderColor: '#a26a86', tension: .3, borderWidth: 2.5, pointRadius: 3 }, { label: '140', data: logs.map(() => 140), borderColor: 'rgba(180,130,61,.8)', borderDash: [6, 4], borderWidth: 1, pointRadius: 0 }, { label: '90', data: logs.map(() => 90), borderColor: 'rgba(180,130,61,.8)', borderDash: [6, 4], borderWidth: 1, pointRadius: 0 }]
      : [{ label: 'Você', data: logs.map(l => +l.valor), borderColor: '#6a4664', backgroundColor: 'rgba(106,70,100,.12)', fill: true, tension: .3, borderWidth: 2.5, pointRadius: 3 }];
    chart('hc-' + key.replace(':', '_'), { type: 'line', data: { labels, datasets: ds }, options: { animation: false, plugins: { legend: { display: false } }, scales: { y: { grid: { color: chartGrid() }, ticks: { color: chartInk() } }, x: { grid: { display: false }, ticks: { color: chartInk(), maxTicksLimit: 6 } } } } });
  });
}
function modalCustomMonitor() {
  if (needPlus('monitores')) return;
  openModal('📈 Acompanhamento personalizado', `<label class="lbl" for="cm-n">Nome</label><input class="in" id="cm-n" maxlength="60" placeholder="Ex.: Batimentos">
    <label class="lbl" for="cm-u">Unidade</label><input class="in" id="cm-u" placeholder="Ex.: bpm">
    <div class="row"><div><label class="lbl" for="cm-min">Alerta abaixo de</label><input class="in" id="cm-min" type="number" placeholder="opcional"></div><div><label class="lbl" for="cm-max">Alerta acima de</label><input class="in" id="cm-max" type="number" placeholder="opcional"></div></div>
    <button class="btn full" onclick="saveCustomMonitor()">Criar</button>`);
}
function saveCustomMonitor() { const n = val('cm-n'); if (!n) return fieldErr('cm-n', 'Dê um nome'); const mn = num('cm-min'), mx = num('cm-max'); if (mn != null && mx != null && mn >= mx) return fieldErr('cm-max', 'O máximo deve ser maior que o mínimo'); Store.upsert('monitores', { nome: n, unidade: val('cm-u') || null, minimo: mn, maximo: mx }); closeModal(); renderRecBody(); }

/* ---------- Sintomas (Plus) ---------- */
const SINT = [['🤢', 'Náusea'], ['🤮', 'Vômito'], ['🥱', 'Cansaço'], ['🤕', 'Dor de cabeça'], ['👁️', 'Visão embaçada'], ['🔥', 'Dor no estômago'], ['😣', 'Dor lombar'], ['🦵', 'Inchaço'], ['🔥', 'Azia'], ['😴', 'Insônia'], ['💧', 'Corrimento'], ['🚽', 'Ardência ao urinar'], ['😢', 'Tristeza'], ['😰', 'Ansiedade'], ['😊', 'Bem!']];
function recSintomas() {
  const sy = L('sintomas').slice().sort((a, b) => b.registrado_em.localeCompare(a.registrado_em));
  return `<button class="btn full" onclick="modalSintoma()">+ Como estou me sentindo</button><p class="muted" style="font-size:12.5px;margin:10px 2px">Um histórico para mostrar na consulta.</p>
    ${sy.length ? sy.map(s => `<div class="card" style="padding:13px"><div class="list-item" style="border:none;padding:0"><div class="li-ic">${esc(s.emoji || '📝')}</div><div class="li-t"><b>${esc(s.nome)} ${s.intensidade ? '· ' + ['', 'leve', 'moderada', 'forte'][s.intensidade] : ''}</b><span>${fmtDT(s.registrado_em)}${s.nota ? ' · ' + esc(s.nota) : ''}</span></div>
      <button class="x" style="font-size:16px" aria-label="Excluir registro" onclick="confirmBox('Excluir este registro?',()=>{Store.remove('sintomas','${s.id}');renderRecBody()},{danger:true,yes:'Excluir'})">🗑️</button></div></div>`).join('') : empty('📝', 'Nada registrado', 'Anote enjoos, dores e como está seu humor.')}`;
}
function modalSintoma() {
  if (needPlus('sintomas')) return; A._sy = null; A._int = 0;
  openModal('📝 Como você está?', `<label class="lbl">O que está sentindo?</label><div class="chip-row" id="sy-c">${SINT.map((o, i) => `<button type="button" class="chip" onclick="document.querySelectorAll('#sy-c .chip').forEach(c=>c.classList.remove('on'));this.classList.add('on');A._sy=${i}">${o[0]} ${o[1]}</button>`).join('')}</div>
    <label class="lbl">Intensidade</label><div class="chip-row" id="sy-i">${['Leve', 'Moderada', 'Forte'].map((x, i) => `<button type="button" class="chip" onclick="document.querySelectorAll('#sy-i .chip').forEach(c=>c.classList.remove('on'));this.classList.add('on');A._int=${i + 1}">${x}</button>`).join('')}</div>
    <label class="lbl" for="sy-n">Anotação</label><textarea class="in" id="sy-n" rows="2" maxlength="1000"></textarea>
    <button class="btn full" onclick="saveSintoma()">Registrar</button>`);
}
function saveSintoma() {
  if (A._sy == null) return toast('Escolha o que está sentindo'); const [e, n] = SINT[A._sy];
  Store.upsert('sintomas', { registrado_em: new Date().toISOString(), nome: n, emoji: e, intensidade: A._int || 0, nota: val('sy-n') || null }); closeModal(); earn('sint:' + todayISO(), 5);
  const urg = Alerts.compute(ctx()).filter(a => a.sev !== 'info'); if (urg.length && ['Dor de cabeça', 'Visão embaçada', 'Dor no estômago', 'Inchaço'].includes(n)) toast('⚠️ Veja a orientação no Centro de cuidado'); else toast('Registrado 📝');
  if (['Tristeza', 'Ansiedade'].includes(n) && A._int === 3) setTimeout(() => toast('Você não está sozinha 💜 Fale com a equipe ou ligue 188 (CVV)'), 900);
  renderAll();
}

/* ---------- Notas (Plus) ---------- */
function recNotas() {
  const pend = L('notas').filter(n => !n.resolvida), ok = L('notas').filter(n => n.resolvida);
  const prox = L('consultas').map(c => c.proxima_consulta).filter(d => d && d >= todayISO()).sort()[0];
  const row = n => `<div class="mission ${n.resolvida ? 'done' : ''}"><button class="chk" aria-label="${n.resolvida ? 'Reabrir' : 'Marcar como resolvida'}" onclick="Store.upsert('notas',{id:'${n.id}',resolvida:${!n.resolvida}});renderRecBody()">${n.resolvida ? '✓' : ''}</button><div class="mt"><b style="font-weight:600">${esc(n.texto)}</b></div><button class="x" style="font-size:16px" aria-label="Excluir anotação" onclick="Store.remove('notas','${n.id}');renderRecBody()">🗑️</button></div>`;
  return `<div class="card" style="background:var(--grad);color:#fff"><h3 style="color:#fff">📌 Levar à próxima consulta</h3><span style="font-size:13px;opacity:.92">${prox ? `Sua próxima consulta é em <b>${fmt(prox)}</b>` : 'Anote o que quer perguntar'}</span></div>
    <div class="card"><div class="row"><input class="in" id="nt-i" maxlength="1000" placeholder="Ex.: Posso viajar de avião?" style="margin:0" onkeydown="if(event.key==='Enter')addNota()" aria-label="Nova anotação"><button class="btn sm" style="flex:0 0 auto" onclick="addNota()">+ Anotar</button></div></div>
    ${pend.length ? pend.map(row).join('') : empty('📝', 'Nada anotado', 'Dúvidas, sintomas, pedidos — tudo para não esquecer.')}
    ${ok.length ? `<div class="section-t">Já resolvidas</div>${ok.map(row).join('')}` : ''}`;
}
function addNota() { const v = val('nt-i'); if (!v) return; if (needPlus('notas')) return; Store.upsert('notas', { texto: v, resolvida: false }); renderRecBody(); const i = $('nt-i'); if (i) i.focus(); }

/* ---------- Minha saúde ---------- */
function recSaude() {
  const p = S().profile;
  const chips = (title, key, ph, ic) => `<div class="card"><h3>${title}</h3><div style="margin:8px 0">${(p[key] || []).length ? p[key].map((x, i) => `<div class="list-item" style="padding:9px 0"><div class="li-ic">${ic}</div><div class="li-t"><b style="font-weight:600">${esc(x)}</b></div><button class="x" style="font-size:16px" aria-label="Remover ${esc(x)}" onclick="rmChip('${key}',${i})">🗑️</button></div>`).join('') : '<p class="muted" style="font-size:13px;margin:2px 0">Nada registrado.</p>'}</div>
    <div class="row"><input class="in" id="ch-${key}" maxlength="80" placeholder="${ph}" style="margin:0" onkeydown="if(event.key==='Enter')addChip('${key}')" aria-label="${title}"><button class="btn sm" style="flex:0 0 auto" onclick="addChip('${key}')">+ Adicionar</button></div></div>`;
  const meds = L('medicamentos');
  return `<div class="card"><h3>🩸 Dados essenciais</h3><dl class="kv" style="margin:8px 0">
      <dt>Tipo sanguíneo</dt><dd>${esc(p.tipo_sanguineo || '—')}</dd><dt>Altura</dt><dd>${S().gestacao.altura_cm ? esc(S().gestacao.altura_cm) + ' cm' : '—'}</dd><dt>Peso antes da gravidez</dt><dd>${S().gestacao.peso_pre_kg ? esc(S().gestacao.peso_pre_kg) + ' kg' : '—'}</dd>
      <dt>G / P / A</dt><dd>${[S().gestacao.gesta, S().gestacao.para, S().gestacao.abortos].map(x => x ?? '–').join(' / ')}</dd></dl>
      <button class="btn sec full sm" onclick="modalIdent()">Editar</button></div>
    ${chips('🌼 Alergias', 'alergias', 'Ex.: dipirona', '🌼')}${chips('🩹 Condições / doenças', 'condicoes', 'Ex.: hipertensão, diabetes', '🩹')}${chips('💊 Medicamentos em uso', 'medicamentos_uso', 'Ex.: ácido fólico', '💊')}
    <div class="card"><h3>⏰ Lembretes de medicação ${Store.can('medicacao') ? '' : plusTag()}</h3>
      ${Store.can('medicacao') ? `${meds.length ? meds.map(m => `<div class="list-item"><div class="li-ic">💊</div><div class="li-t"><b>${esc(m.nome)}${m.dose ? ' · ' + esc(m.dose) : ''}</b><span>${(m.horarios || []).join(' · ') || 'sem horário'}</span></div><button class="x" style="font-size:16px" aria-label="Excluir medicação" onclick="Store.remove('medicamentos','${m.id}');renderRecBody();scheduleReminders()">🗑️</button></div>`).join('') : '<p class="muted" style="font-size:13px">Nenhum lembrete.</p>'}
        <button class="btn sec full sm" style="margin-top:10px" onclick="modalMed()">+ Adicionar medicação</button>` : `<p class="muted" style="font-size:13px;margin:6px 0 10px">Receba notificação na hora de cada dose e marque quando tomar.</p><button class="btn full sm" onclick="modalPremium()">✨ Conhecer o Ninho+</button>`}</div>`;
}
function addChip(key) {
  const v = val('ch-' + key); if (!v) return; const p = S().profile; if ((p[key] || []).some(x => x.toLowerCase() === v.toLowerCase())) return toast('Já está na lista');
  Store.patchProfile({ [key]: (p[key] || []).concat(v) });
  if (key === 'condicoes' && Store.isPlus()) { const t = v.toLowerCase(); const m = Object.assign({}, Store.prefs.monitores);
    if (/hipertens|press[aã]o|pr[eé]-?ecl/.test(t) && !monOn('pressao')) { m.pressao = Object.assign({}, m.pressao, { ativo: true }); toast('🏠 Ativei o diário de pressão'); }
    if (/diabet|glic|dmg/.test(t) && !monOn('glicemia')) { m.glicemia = Object.assign({}, m.glicemia, { ativo: true }); toast('🏠 Ativei o diário de glicemia'); }
    Store.patchPrefs({ monitores: m }); }
  renderRecBody(); const i = $('ch-' + key); if (i) i.focus();
}
function rmChip(key, i) { const l = (S().profile[key] || []).slice(); l.splice(i, 1); Store.patchProfile({ [key]: l }); renderRecBody(); }
function modalMed() {
  if (needPlus('medicacao')) return;
  openModal('💊 Nova medicação', `<label class="lbl" for="m-n">Nome</label><input class="in" id="m-n" maxlength="120" placeholder="Ex.: Sulfato ferroso">
    <label class="lbl" for="m-d">Dose (opcional)</label><input class="in" id="m-d" placeholder="Ex.: 1 comprimido">
    <label class="lbl" for="m-h">Horários</label><input class="in" id="m-h" placeholder="Ex.: 08:00, 20:00"><div class="muted" style="font-size:12px;margin:-4px 0 10px">Separe por vírgula. Use o formato 24 h.</div>
    <button class="btn full" onclick="saveMed()">Salvar</button>`);
}
function saveMed() { const n = val('m-n'); if (!n) return fieldErr('m-n', 'Dê um nome'); const { out, bad } = parseHorarios(val('m-h')); if (bad.length) return fieldErr('m-h', 'Horário inválido: ' + bad.join(', ')); if (!out.length) return fieldErr('m-h', 'Informe pelo menos um horário');
  Store.upsert('medicamentos', { nome: n, dose: val('m-d') || null, horarios: out, ativo: true }); closeModal(); toast('Lembrete criado ⏰'); renderRecBody(); scheduleReminders();
  if (Notify.permission() !== 'granted') setTimeout(() => confirmBox('Quer receber uma notificação na hora de cada dose?', enableNotifications, { yes: 'Ativar notificações' }), 500); }

/* =================== AJUDA =================== */
const FAQS = [
  ['Posso tomar café?', 'Com moderação: até cerca de 200 mg de cafeína por dia (1 a 2 xícaras). Chá preto, mate, refrigerante de cola e chocolate também têm cafeína.'],
  ['Que alimentos devo evitar?', 'Carnes, ovos e peixes crus ou malpassados, leite e queijos não pasteurizados, embutidos crus e álcool. Lave bem frutas e verduras (toxoplasmose).'],
  ['É seguro fazer exercícios?', 'Na maioria das gestações, sim: caminhada, hidroginástica e alongamento são ótimos. Confirme com sua equipe e evite impacto e risco de queda.'],
  ['Quando vou sentir o bebê mexer?', 'Em geral entre 18 e 22 semanas (às vezes antes, em quem já teve filhos). Depois de 28 semanas, preste atenção diariamente.'],
  ['Quantas consultas de pré-natal preciso?', 'No mínimo 7, alternando médico(a) e enfermeiro(a): mensais até 28 semanas, quinzenais até 36 e semanais depois. Não existe “alta” do pré-natal.'],
  ['Quanto peso devo ganhar?', 'Depende do seu IMC antes da gravidez. Para peso adequado, a Caderneta recomenda 8 a 12 kg até 40 semanas. Veja sua curva em Prontuário → Curvas.'],
  ['Tenho direito a acompanhante?', 'Sim. A lei garante acompanhante de sua escolha durante o pré-parto, parto e pós-parto, no SUS e na rede privada (Lei 11.108/2005).'],
  ['Qual a diferença entre DUM e ultrassom para a idade gestacional?', 'A DUM depende de lembrar a data e de ciclos regulares. O ultrassom do 1º trimestre (idealmente 7 a 12 semanas) mede o bebê e é mais preciso — por isso é o mais usado para datar a gestação.']];
function renderHelp() {
  const p = S().profile;
  $('pg-help').innerHTML = `<div class="section-t"><i class="ph ph-first-aid-kit"></i> Emergência</div>
    <button class="btn full" style="background:var(--bad);margin-bottom:10px" onclick="modalDangerCheck()">🚨 Estou sentindo algo — o que faço?</button>
    <div class="row" style="margin-bottom:12px"><a class="btn sec" style="text-align:center;text-decoration:none" href="tel:192">📞 SAMU 192</a><a class="btn sec" style="text-align:center;text-decoration:none" href="tel:188">💜 CVV 188</a></div>
    <button class="btn sec full" style="margin-bottom:6px" onclick="showEmergCard()">🆘 Meu cartão de emergência</button>
    <div class="section-t"><i class="ph ph-warning"></i> Sinais de perigo — procure atendimento</div>
    <p class="muted" style="font-size:13px;margin:-4px 2px 10px">Segundo a Caderneta Brasileira da Gestante, procure a maternidade ou ligue 192 se tiver:</p>
    ${C.SINAIS_PERIGO.map(d => `<div class="danger"><div class="di">${d.ic}</div><div><b>${d.t}</b>${d.s ? `<span>${d.s}</span>` : ''}</div></div>`).join('')}
    ${p.maternidade_referencia ? `<div class="card" style="text-align:center"><span class="muted" style="font-size:12px">Sua maternidade de referência</span><br><b>${esc(p.maternidade_referencia)}</b></div>` : ''}
    <div class="section-t"><i class="ph ph-chats-circle"></i> Dúvidas frequentes</div>
    ${FAQS.map(f => `<details class="faq"><summary>${f[0]}</summary><p>${f[1]}</p></details>`).join('')}
    <p class="muted" style="font-size:12px;text-align:center;margin-top:14px;line-height:1.5">Orientações gerais. Cada gestação é única — confirme sempre com sua equipe. 💜</p>`;
}
function showEmergCard() {
  const p = S().profile, g = ga(), gest = S().gestacao;
  const row = (l, v) => `<div style="display:flex;justify-content:space-between;gap:10px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.25)"><span style="opacity:.85">${l}</span><b style="text-align:right;max-width:62%">${esc(v || '—')}</b></div>`;
  openModal('🆘 Cartão de emergência', `<div style="background:linear-gradient(135deg,#9b3a4f,#bd5568);color:#fff;border-radius:18px;padding:18px;margin-bottom:12px">
    <div style="font-size:12px;opacity:.9">Gestante</div><div style="font-family:var(--serif);font-size:22px;margin-bottom:6px">${esc(p.nome_social || p.nome_completo)}</div>
    ${row('Idade gestacional', `${g.w} sem e ${g.d} d (${metodoLabel(gest.metodo_ig)})`)}${row('DPP', fmt(g.dpp))}${row('Gravidez', { unica: 'Única', gemelar: 'Gemelar', tripla_mais: 'Tripla ou mais' }[gest.tipo_gravidez])}
    ${row('Tipo sanguíneo', p.tipo_sanguineo)}${row('Alergias', (p.alergias || []).join(', '))}${row('Condições', (p.condicoes || []).join(', '))}${row('Medicamentos', (p.medicamentos_uso || []).join(', '))}
    ${row('Cartão SUS', p.cns)}${row('Maternidade', p.maternidade_referencia)}${row('UBS', p.ubs_referencia)}${row('Contato', p.contato_emergencia_nome ? `${p.contato_emergencia_nome} · ${fmtTel(p.contato_emergencia_tel)}` : '')}</div>
    <button class="btn full" onclick="modalIdent()">✏️ Editar dados</button><button class="btn sec full sm" style="margin-top:8px" onclick="printEmerg()">🖨️ Imprimir / salvar</button>
    <p class="muted" style="font-size:11.5px;text-align:center;margin-top:10px">SAMU 192 · Bombeiros 193</p>`);
}

/* =================== EU =================== */
function renderMe() {
  const p = S().profile, g = ga(), gest = S().gestacao, plus = Store.isPlus(), cmp = C.compareDUMxUSG(gest);
  const item = (ic, t, s, act) => `<button class="qa" onclick="${act}"><span class="qi"><i class="ph ${ic}"></i></span><span class="qt"><b>${t}</b><span>${s}</span></span><i class="ph ph-caret-right chev"></i></button>`;
  $('pg-me').innerHTML = `<div class="section-t"><i class="ph ph-heart"></i> Eu</div>
    <div class="card" style="text-align:center;background:var(--grad);color:#fff"><div style="font-size:44px">🪺</div><h2 style="color:#fff;margin:6px 0 2px">${esc(p.nome_social || p.nome_completo)}</h2>
      <span style="opacity:.92;font-size:13.5px">${g.w} semanas${bebe() ? ' · esperando ' + esc(cap(bebe())) : ''}</span>
      <div style="display:flex;justify-content:center;gap:24px;margin-top:12px"><div><div style="font-family:var(--serif);font-size:24px">💧 ${Store.game.gotas || 0}</div><div style="font-size:11px;opacity:.9">gotas</div></div><div><div style="font-family:var(--serif);font-size:24px">🏅 ${(Store.game.conquistas || []).length}/${BADGES.length}</div><div style="font-size:11px;opacity:.9">conquistas</div></div></div></div>
    ${plus ? `<div class="card" style="display:flex;align-items:center;gap:12px"><div style="font-size:28px">✨</div><div style="flex:1"><b>Ninho+ ativo</b><div class="muted" style="font-size:12.5px">${S().meta.planInfo && S().meta.planInfo.periodo_fim ? 'Renova em ' + fmt(S().meta.planInfo.periodo_fim) : 'Todos os recursos liberados'}</div></div><button class="btn sec sm" onclick="modalPremium()">Gerenciar</button></div>`
      : `<div class="card" style="background:var(--grad);color:#fff"><b style="font-size:16px">✨ Conheça o Ninho+</b><div style="font-size:13px;opacity:.92;margin:4px 0 12px">Exames, ultrassons, diário em casa, medicação, memórias, plano de parto e resumo em PDF.</div><button class="btn full" style="background:#fff;color:var(--violet-d)" onclick="modalPremium()">Ver recursos</button></div>`}
    <div class="card"><h3>📅 Datas da gestação</h3><dl class="kv" style="margin-top:8px">
      ${gest.usg_data ? `<dt>1º ultrassom</dt><dd>${fmt(gest.usg_data)} · ${gest.usg_ig_semanas}s${gest.usg_ig_dias || 0}d</dd>` : ''}${gest.dum ? `<dt>DUM</dt><dd>${fmt(gest.dum)}</dd>` : ''}${gest.dpp_informada ? `<dt>DPP informada</dt><dd>${fmt(gest.dpp_informada)}</dd>` : ''}
      <dt>IG calculada por</dt><dd>${metodoLabel(gest.metodo_ig)}</dd><dt>DPP</dt><dd>${fmt(g.dpp)} · ${Math.max(0, C.diffDays(g.dpp, todayISO()))} dias</dd></dl>
      ${cmp ? `<p class="muted" style="font-size:12px;margin:8px 0 0">DUM × ultrassom: ${cmp.diff} dia(s) de diferença (limite ${cmp.limite}). ${cmp.recomenda === 'usg' ? 'A regra indica seguir o ultrassom.' : 'Dentro do limite.'}</p>` : ''}
      <button class="btn sec full sm" style="margin-top:10px" onclick="A.setupDraft={};showSetup('gest')">Alterar datação</button></div>
    ${Store.can('memorias') ? memoriasCard() : lockRow('📔', 'Diário de memórias', 'Fotos da barriga semana a semana')}
    ${Store.can('plano_parto') ? `<div class="card"><h3>📝 Plano de parto</h3><p class="muted" style="font-size:13px;margin:6px 0 12px">Suas preferências para levar à maternidade.</p><button class="btn full" onclick="modalBirthPlan()">${Object.keys(gest.plano_parto || {}).length ? '✏️ Editar' : 'Criar meu plano'}</button>${Object.keys(gest.plano_parto || {}).length ? '<button class="btn sec full sm" style="margin-top:8px" onclick="printBirthPlan()">🖨️ Imprimir</button>' : ''}</div>` : lockRow('📝', 'Plano de parto', 'Preferências para levar à maternidade')}
    ${plus ? `<div class="card"><h3>📄 Resumo da gestação</h3><p class="muted" style="font-size:13px;margin:6px 0 12px">Identificação, consultas, curvas, exames e vacinas num documento para imprimir ou salvar em PDF.</p><button class="btn full" onclick="printSummary()">🖨️ Gerar resumo</button></div>` : lockRow('📄', 'Resumo em PDF', 'Toda a gestação num documento para o médico')}
    <div class="section-t"><i class="ph ph-gear"></i> Configurações</div>
    ${item('ph-identification-card', 'Identificação', 'Dados da Caderneta e contato de emergência', 'modalIdent()')}
    ${item('ph-bell', 'Notificações e lembretes', Notify.permission() === 'granted' ? 'Ativadas' : 'Desativadas', 'modalNotif()')}
    ${item('ph-shield-check', 'Privacidade e dados', 'Consentimentos, baixar ou excluir dados', 'modalPrivacy()')}
    ${item('ph-user-circle', 'Conta', esc(S().email || ''), 'modalAccount()')}
    <p class="muted" style="font-size:11px;text-align:center;margin-top:10px">Ninho v2 · ${Store.backend.mode === 'local' ? 'modo local' : 'sincronizado' + (S().meta.lastSync ? ' ' + fmtDT(S().meta.lastSync) : '')}</p>`;
  if (Store.can('memorias')) loadThumbs();
}
function modalIdent() { const p = S().profile; openModal('📋 Identificação', identFields(p, S().gestacao, false) + `<button class="btn full" onclick="saveIdent(false)">Salvar</button>`); }

/* ---------- memórias (Plus) ---------- */
function memoriasCard() {
  const ms = L('memorias').slice().sort((a, b) => b.created_at.localeCompare(a.created_at));
  return `<div class="card"><h3>📔 Diário de memórias</h3><div class="row" style="margin:10px 0"><button class="btn sec sm" onclick="modalMemoria('foto')">📷 Foto da barriga</button><button class="btn sec sm" onclick="modalMemoria('momento')">✨ Momento</button></div>
    ${ms.length ? `<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">${ms.map(m => `<div style="background:var(--grad-soft);border-radius:16px;overflow:hidden;border:1px solid var(--line);position:relative">
      <button class="x" style="position:absolute;top:4px;right:4px;font-size:15px;color:#fff;background:rgba(0,0,0,.35);border-radius:50%;width:26px;height:26px;z-index:1" aria-label="Excluir memória" onclick="confirmBox('Excluir esta memória?',()=>{Store.remove('memorias','${m.id}');renderMe()},{danger:true,yes:'Excluir'})">×</button>
      ${m.arquivo_path ? `<img data-path="${esc(m.arquivo_path)}" alt="" style="width:100%;height:120px;object-fit:cover;display:block;background:var(--line)">` : '<div style="height:120px;display:flex;align-items:center;justify-content:center;font-size:40px">✨</div>'}
      <div style="padding:9px"><b style="font-size:13px;display:block">${esc(m.titulo || (m.semana != null ? 'Semana ' + m.semana : 'Memória'))}</b><span style="font-size:11.5px;color:var(--muted)">${m.texto ? esc(m.texto) + ' · ' : ''}${fmt(m.created_at)}</span></div></div>`).join('')}</div>` : '<p class="muted" style="font-size:13px;text-align:center">Seu álbum começa aqui 💜</p>'}</div>`;
}
function modalMemoria(tipo) {
  if (needPlus('memorias')) return; const g = ga();
  openModal(tipo === 'foto' ? '📷 Foto da barriga' : '✨ Momento especial', `<label class="lbl" for="mm-t">Título</label><input class="in" id="mm-t" maxlength="120" placeholder="${tipo === 'foto' ? 'Barriguinha de ' + g.w + ' semanas' : 'Primeiro chute!'}">
    <label class="lbl" for="mm-s">Semana</label><input class="in" id="mm-s" type="number" value="${g.w}">
    <label class="lbl" for="mm-f">Foto ${tipo === 'momento' ? '(opcional)' : ''}</label><input class="in" type="file" accept="image/*" id="mm-f">
    <label class="lbl" for="mm-x">Anotação</label><textarea class="in" id="mm-x" rows="2" maxlength="2000"></textarea>
    <button class="btn full" onclick="saveMemoria('${tipo}')">Guardar</button>`);
}
async function saveMemoria(tipo) {
  const f = $('mm-f').files[0]; if (tipo === 'foto' && !f) return fieldErr('mm-f', 'Escolha a foto');
  let r = Store.upsert('memorias', { tipo, titulo: val('mm-t') || null, semana: val('mm-s') === '' ? null : Math.max(0, Math.min(44, +val('mm-s'))), texto: val('mm-x') || null });
  if (f) { try { r = await Store.attachImage('memorias', r, f); } catch (e) { toast('Não foi possível salvar a foto'); } }
  closeModal(); earn('mem:' + todayISO(), 10, 'Memória guardada 📔'); renderMe();
}

/* ---------- plano de parto (Plus) ---------- */
const BP = [{ id: 'tipo', q: 'Tipo de parto que você deseja', o: ['Parto normal', 'Cesárea', 'O que for mais seguro para nós dois'] }, { id: 'acomp', q: 'Acompanhante (direito garantido por lei)', o: ['Parceiro(a)', 'Mãe', 'Doula', 'Outra pessoa'] },
  { id: 'alivio', q: 'Alívio da dor', o: ['Métodos não farmacológicos primeiro', 'Analgesia se eu pedir', 'Decido na hora'] }, { id: 'posicao', q: 'Posição no parto', o: ['Livre escolha', 'Vertical / de cócoras', 'Conforme a equipe'] },
  { id: 'ambiente', q: 'Ambiente', o: ['Luz baixa e silêncio', 'Minha música', 'Liberdade para me movimentar'] }, { id: 'pele', q: 'Contato pele a pele', o: ['Sim, imediato', 'Se possível'] },
  { id: 'amamenta', q: 'Amamentar na 1ª hora (hora dourada)', o: ['Sim', 'Conforme orientação'] }, { id: 'cordao', q: 'Clampeamento do cordão', o: ['Tardio (após parar de pulsar)', 'Conforme a equipe'] }];
function modalBirthPlan() {
  if (needPlus('plano_parto')) return; const b = Object.assign({}, S().gestacao.plano_parto); A._bp = b;
  openModal('📝 Plano de parto', `<p class="muted" style="font-size:13px;margin:0 0 12px">Preferências, não regras — a equipe sempre prioriza a segurança de vocês.</p>
    ${BP.map(f => `<div style="margin-bottom:12px"><label class="lbl">${f.q}</label><div class="chip-row" style="margin:0">${f.o.map((o, i) => `<button type="button" class="chip ${b[f.id] === o ? 'on' : ''}" onclick="this.parentElement.querySelectorAll('.chip').forEach(c=>c.classList.remove('on'));this.classList.add('on');A._bp['${f.id}']=BP.find(x=>x.id==='${f.id}').o[${i}]">${esc(o)}</button>`).join('')}</div></div>`).join('')}
    <label class="lbl" for="bp-o">Outros desejos</label><textarea class="in" id="bp-o" rows="3" maxlength="2000">${esc(b.obs || '')}</textarea>
    <button class="btn full" onclick="A._bp.obs=val('bp-o');Store.setGestacao({plano_parto:A._bp});closeModal();earn('plano_parto',30,'Plano salvo 📝');renderMe()">Salvar</button>`);
}

/* =================== IMPRESSÃO =================== */
function printDoc(title, body) {
  const w = window.open('', '_blank'); if (!w) return toast('Permita pop-ups para imprimir');
  w.document.write(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(title)}</title><style>body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#2a232e;max-width:780px;margin:0 auto;padding:24px;font-size:13px}h1{font-size:22px;margin:0}h2{font-size:15px;border-bottom:2px solid #a26a86;padding-bottom:3px;margin:20px 0 8px}table{width:100%;border-collapse:collapse}td,th{border-bottom:1px solid #eee;padding:5px 6px;text-align:left;vertical-align:top}th{background:#f6eef1;font-size:11.5px}.hd{background:#452f45;color:#fff;padding:18px;border-radius:14px}.mut{color:#777;font-size:11px}@media print{.np{display:none}}</style></head><body>${body}<p class="mut" style="text-align:center;margin-top:24px">Gerado pelo Ninho em ${new Date().toLocaleDateString('pt-BR')} · Documento de apoio: não substitui a Caderneta oficial nem a avaliação da equipe.</p><button class="np" onclick="print()">Imprimir</button><script>setTimeout(()=>print(),400)<\/script></body></html>`);
  w.document.close();
}
function printEmerg() {
  const p = S().profile, g = ga(), r = (l, v) => `<tr><td>${l}</td><td><b>${esc(v || '—')}</b></td></tr>`;
  printDoc('Cartão de emergência', `<div class="hd"><div>🆘 Cartão de emergência — gestante</div><h1>${esc(p.nome_social || p.nome_completo)}</h1></div><table style="margin-top:12px">${r('Idade gestacional', `${g.w} semanas e ${g.d} dias`)}${r('DPP', fmt(g.dpp))}${r('Tipo sanguíneo', p.tipo_sanguineo)}${r('Alergias', (p.alergias || []).join(', '))}${r('Condições', (p.condicoes || []).join(', '))}${r('Medicamentos', (p.medicamentos_uso || []).join(', '))}${r('Cartão SUS', p.cns)}${r('Maternidade de referência', p.maternidade_referencia)}${r('UBS', p.ubs_referencia)}${r('Contato de emergência', [p.contato_emergencia_nome, fmtTel(p.contato_emergencia_tel)].filter(Boolean).join(' — '))}</table><p style="text-align:center;margin-top:16px"><b>SAMU 192</b> · Bombeiros 193</p>`);
}
function printBirthPlan() {
  const b = S().gestacao.plano_parto || {}, p = S().profile, g = ga();
  printDoc('Plano de parto', `<div class="hd"><div>📝 Plano de parto</div><h1>${esc(p.nome_social || p.nome_completo)}</h1><div>${g.w} semanas · DPP ${fmt(g.dpp)}</div></div><table style="margin-top:12px">${BP.filter(f => b[f.id]).map(f => `<tr><td>${f.q}</td><td><b>${esc(b[f.id])}</b></td></tr>`).join('')}</table>${b.obs ? `<h2>Outros desejos</h2><p>${esc(b.obs)}</p>` : ''}<p class="mut">Estas são as preferências da gestante. A equipe prioriza sempre a segurança da mãe e do bebê.</p>`);
}
function printSummary() {
  if (needPlus('resumo_pdf')) return;
  const p = S().profile, gest = S().gestacao, g = ga(), cs = L('consultas').slice().sort((a, b) => a.data.localeCompare(b.data));
  const ex = L('exames').slice().sort((a, b) => a.data.localeCompare(b.data)), us = L('ultrassons').slice().sort((a, b) => a.data.localeCompare(b.data));
  const imgs = ['g-au', 'g-peso'].map(id => { const c = $(id); try { return c && c.toDataURL ? `<img src="${c.toDataURL('image/png')}" style="width:48%">` : ''; } catch (e) { return ''; } }).join(' ');
  printDoc('Resumo da gestação', `<div class="hd"><div>🪺 Ninho — Resumo da gestação</div><h1>${esc(p.nome_completo)}</h1><div>${g.w} semanas e ${g.d} dias · DPP ${fmt(g.dpp)} (IG pelo ${metodoLabel(gest.metodo_ig)})</div></div>
    <h2>Identificação</h2><table><tr><td>Nome social</td><td>${esc(p.nome_social || '—')}</td><td>Nascimento</td><td>${fmt(p.data_nascimento)}</td></tr><tr><td>Cartão SUS</td><td>${esc(p.cns || '—')}</td><td>Raça/cor</td><td>${esc(p.raca_cor || '—')}</td></tr><tr><td>Município/UF</td><td>${esc([p.municipio, p.uf].filter(Boolean).join('/') || '—')}</td><td>UBS</td><td>${esc(p.ubs_referencia || '—')}</td></tr><tr><td>Maternidade</td><td>${esc(p.maternidade_referencia || '—')}</td><td>Contato</td><td>${esc([p.contato_emergencia_nome, p.contato_emergencia_tel].filter(Boolean).join(' — ') || '—')}</td></tr></table>
    <h2>Gestação</h2><table><tr><td>DUM</td><td>${fmt(gest.dum)}</td><td>1º USG</td><td>${gest.usg_data ? fmt(gest.usg_data) + ' — ' + gest.usg_ig_semanas + 's' + (gest.usg_ig_dias || 0) + 'd' : '—'}</td></tr><tr><td>G/P/A</td><td>${[gest.gesta, gest.para, gest.abortos].map(x => x ?? '–').join('/')}</td><td>Tipo sanguíneo</td><td>${esc(p.tipo_sanguineo || '—')}</td></tr><tr><td>Altura / peso pré</td><td>${gest.altura_cm || '—'} cm / ${gest.peso_pre_kg || '—'} kg</td><td>Alergias</td><td>${esc((p.alergias || []).join(', ') || 'nenhuma registrada')}</td></tr></table>
    <h2>Consultas (${cs.length})</h2><table><tr><th>Data</th><th>IG</th><th>Peso</th><th>PA</th><th>AU</th><th>BCF</th><th>Mov.</th><th>Edema</th><th>Conduta</th></tr>${cs.map(c => { const i = C.gaFrom(gest, c.data); return `<tr><td>${fmt(c.data)}</td><td>${i.w}s${i.d}d</td><td>${c.peso_kg ?? '-'}</td><td>${c.pa_sis ? c.pa_sis + '/' + c.pa_dia : '-'}</td><td>${c.altura_uterina_cm ?? '-'}</td><td>${c.bcf_bpm ?? '-'}</td><td>${esc(c.movimentos_fetais || '-')}</td><td>${esc(c.edema || '-')}</td><td>${esc(c.observacoes || '')}</td></tr>`; }).join('') || '<tr><td colspan=9>Sem consultas</td></tr>'}</table>
    ${imgs.trim() ? `<h2>Curvas</h2>${imgs}` : ''}
    <h2>Exames (${ex.length})</h2><table><tr><th>Data</th><th>Exame</th><th>Resultado</th></tr>${ex.map(e => `<tr><td>${fmt(e.data)}</td><td>${esc(e.nome)}</td><td>${esc(e.valor_num != null ? e.valor_num + ' ' + (e.unidade || '') : e.valor_txt || '')}</td></tr>`).join('') || '<tr><td colspan=3>Sem exames</td></tr>'}</table>
    ${us.length ? `<h2>Ultrassonografias</h2><table><tr><th>Data</th><th>Tipo</th><th>IG USG</th><th>Peso fetal</th><th>BCF</th><th>Placenta / líquido</th></tr>${us.map(u => `<tr><td>${fmt(u.data)}</td><td>${esc(u.tipo || '')}</td><td>${u.ig_usg_semanas != null ? u.ig_usg_semanas + 's' + (u.ig_usg_dias || 0) + 'd' : '-'}</td><td>${u.peso_fetal_g ?? '-'}</td><td>${u.bcf_bpm ?? '-'}</td><td>${esc([u.placenta, u.liquido].filter(Boolean).join(' / '))}</td></tr>`).join('')}</table>` : ''}
    <h2>Vacinas</h2><p>${C.VACINAS.map(v => { const d = L('vacinas').filter(x => x.codigo === v.id); return `${d.length ? '✅' : '⬜'} ${v.nome}${d.length ? ' — ' + d.map(x => fmt(x.data_aplicacao)).join(', ') : ''}`; }).join('<br>')}</p>
    ${L('notas').filter(n => !n.resolvida).length ? `<h2>Perguntas para a consulta</h2><ul>${L('notas').filter(n => !n.resolvida).map(n => `<li>${esc(n.texto)}</li>`).join('')}</ul>` : ''}`);
  award('guardia');
}

/* =================== PLANO (Grátis x Plus) =================== */
function modalPremium() {
  const plus = Store.isPlus(), local = Store.backend.mode === 'local';
  const F = [['🔬', 'Exames da Caderneta', 'Resultados, gráficos e alertas de valores fora do esperado'], ['🖼️', 'Ultrassons com fotos', 'Álbum com dados do laudo'], ['🏠', 'Diário em casa', 'Pressão, glicemia, peso, temperatura — com lembretes'], ['💊', 'Medicação', 'Notificação na hora de cada dose'],
    ['📝', 'Sintomas e anotações', 'Histórico e perguntas para a consulta'], ['📔', 'Memórias', 'Fotos da barriga semana a semana'], ['🗒️', 'Plano de parto', 'Documento para a maternidade'], ['📄', 'Resumo em PDF', 'Toda a gestação num documento']];
  openModal('✨ Ninho+', `${plus ? `<div class="alert allgood"><div class="ai">💜</div><div><b class="t" style="color:var(--good)">Você tem o Ninho+</b><p style="margin:0">Obrigado por cuidar com a gente.</p></div></div>` : ''}
    <div class="card" style="background:var(--grad-soft)"><b>Grátis, para sempre</b><p class="muted" style="font-size:12.5px;margin:4px 0 0">Acompanhamento semana a semana, consultas, <b>curvas da Caderneta</b> (altura uterina e ganho de peso), jornada com exames e vacinas, contador de movimentos, alertas, sinais de perigo e cartão de emergência.</p></div>
    ${F.map(f => `<div class="list-item"><div class="li-ic">${f[0]}</div><div class="li-t"><b>${f[1]}</b><span>${f[2]}</span></div><div style="color:var(--violet)">✓</div></div>`).join('')}
    ${plus ? (local ? '<button class="btn sec full" style="margin-top:14px" onclick="setDemoPlan(\'free\')">Voltar ao grátis (modo local)</button>' : '<p class="muted" style="font-size:12.5px;text-align:center;margin-top:12px">Para cancelar ou trocar o cartão, use o link do Mercado Pago enviado por e-mail.</p>')
      : `<div style="text-align:center;margin:14px 0"><div style="font-family:var(--serif);font-size:28px;color:var(--violet)">${esc(CFG.PRECOS.mensal)}<span style="font-size:14px;color:var(--muted)">/mês</span></div><div class="muted" style="font-size:12px">ou ${esc(CFG.PRECOS.anual)}/ano · cancele quando quiser</div></div>
      ${local ? `<button class="btn full" onclick="setDemoPlan('plus')">✨ Ativar Ninho+ (demonstração local)</button>` : `<button class="btn full" id="ck-m" onclick="checkout('mensal')">Assinar mensal</button><button class="btn sec full" id="ck-a" style="margin-top:8px" onclick="checkout('anual')">Assinar anual</button>`}`}
    <p class="muted" style="font-size:11.5px;text-align:center;margin-top:10px">Recursos de segurança são sempre gratuitos. Se a assinatura acabar, seus dados continuam seus para ver, baixar e excluir.</p>`);
}
async function setDemoPlan(p) { await Store.backend.setDemoPlan(S().uid, p); await Store.refreshPlan(); closeModal(); toast(p === 'plus' ? '✨ Ninho+ ativado (demo)' : 'Plano grátis'); renderAll(); scheduleReminders(); }
async function checkout(ciclo) { await busy(ciclo === 'anual' ? 'ck-a' : 'ck-m', async () => { try { const url = await Store.backend.checkout(ciclo); if (!/^https:\/\//.test(url || '')) throw new Error('link'); location.href = url; } catch (e) { toast('Não foi possível abrir o pagamento agora. Tente novamente.'); } }); }

/* =================== NOTIFICAÇÕES =================== */
async function enableNotifications() {
  if (!Notify.supported()) { Store.patchPrefs({ notifRecusado: true }); toast('Este navegador não suporta notificações. No iPhone, adicione o Ninho à Tela de Início primeiro.'); renderAll(); return; }
  const p = await Notify.ask();
  if (p === 'granted') { Store.addConsents([{ tipo: 'notificacoes', versao: CFG.VERSAO_TERMOS, aceito: true }]); earn('setup:notif', 10); toast('Lembretes ativados 🔔'); scheduleReminders(); }
  else { Store.patchPrefs({ notifRecusado: true }); toast('Tudo bem — os lembretes aparecem aqui no app.'); }
  renderAll(); if ($('nt-perm')) modalNotif();
}
function scheduleReminders() {
  if (!S() || !S().gestacao) return;
  const c = ctx(), ok = (Store.consentOf('notificacoes') || { aceito: true }).aceito !== false;
  const list = ok ? Notify.compute(c) : [];
  Notify.scheduleLocal(list);
  clearTimeout(A._remT); A._remT = setTimeout(() => Notify.syncRemote(Store.backend, S().uid, list).catch(e => console.warn('lembretes', e)), 3000);
  return list;
}
function modalNotif() {
  const pr = Store.prefs, perm = Notify.permission(), n = pr.notif || {};
  openModal('🔔 Notificações e lembretes', `<div id="nt-perm" class="card" style="background:var(--grad-soft)">${perm === 'granted' ? '✅ Notificações permitidas neste aparelho.' : perm === 'denied' ? '🚫 Bloqueadas no navegador. Libere nas configurações do site/app.' : perm === 'unsupported' ? 'Este navegador não suporta notificações. No iPhone, adicione o Ninho à Tela de Início (iOS 16.4+).' : `<button class="btn full" onclick="enableNotifications()">Ativar notificações</button>`}
      ${Store.backend.remote && CFG.VAPID_PUBLIC_KEY ? '' : '<p class="muted" style="font-size:11.5px;margin:8px 0 0">Sem Web Push configurado, as notificações chegam enquanto o app está aberto ou em segundo plano. Os lembretes do dia aparecem sempre na tela inicial.</p>'}</div>
    ${Object.entries(Notify.TIPOS).map(([k, t]) => { const locked = t.plano === 'plus' && !Store.isPlus(); return `<div class="setrow"><div style="font-size:20px">${t.ic}</div><div class="st"><b>${t.nome} ${locked ? plusTag() : ''}</b></div><label class="toggle"><input type="checkbox" ${n[k] !== false && !locked ? 'checked' : ''} ${locked ? 'disabled' : ''} onchange="const o=Object.assign({},Store.prefs.notif);o['${k}']=this.checked;Store.patchPrefs({notif:o});scheduleReminders()" aria-label="${t.nome}"><span></span></label></div>`; }).join('')}
    <div class="setrow"><div style="font-size:20px">🔒</div><div class="st"><b>Mostrar detalhes na notificação</b><span>Desligado: aparece só “Ninho — você tem um lembrete”, sem dados de saúde na tela de bloqueio.</span></div><label class="toggle"><input type="checkbox" ${pr.notifPrivada === false ? 'checked' : ''} onchange="Store.patchPrefs({notifPrivada:!this.checked});scheduleReminders()" aria-label="Mostrar detalhes"><span></span></label></div>
    <div class="row" style="margin-top:12px"><div><label class="lbl" for="nt-s1">Silêncio das</label><input class="in" type="time" id="nt-s1" value="${esc((pr.silencio || ['22:00', '07:00'])[0])}"></div><div><label class="lbl" for="nt-s2">até</label><input class="in" type="time" id="nt-s2" value="${esc((pr.silencio || ['22:00', '07:00'])[1])}"></div><div><label class="lbl" for="nt-mov">Movimentos às</label><input class="in" type="time" id="nt-mov" value="${esc(pr.horaMovimentos || '19:00')}"></div></div>
    <button class="btn full" onclick="Store.patchPrefs({silencio:[val('nt-s1')||'22:00',val('nt-s2')||'07:00'],horaMovimentos:val('nt-mov')||'19:00'});scheduleReminders();toast('Preferências salvas');closeModal()">Salvar</button>
    ${perm === 'granted' ? `<button class="btn sec full sm" style="margin-top:8px" onclick="Notify.show({titulo:'Ninho',corpo:'Notificação de teste 💜',chave:'teste',url:'/'})">Enviar notificação de teste</button>` : ''}
    <p class="muted" style="font-size:12px;margin-top:12px">Próximos 7 dias: ${scheduleReminders().length} lembrete(s).</p>`);
}

/* =================== PRIVACIDADE E CONTA =================== */
function modalPrivacy() {
  const cs = ['termos', 'privacidade', 'dados_saude', 'notificacoes', 'pesquisa'].map(t => [t, Store.consentOf(t)]);
  const nome = { termos: 'Termos de Uso', privacidade: 'Política de Privacidade', dados_saude: 'Tratamento de dados de saúde', notificacoes: 'Lembretes e notificações', pesquisa: 'Pesquisa com dados anonimizados' };
  openModal('🛡️ Privacidade e dados', `<p class="muted" style="font-size:13px;margin:0 0 10px">Você controla seus dados (LGPD art. 18).</p>
    <div class="card">${cs.map(([t, c]) => `<div class="setrow"><div class="st"><b>${nome[t]}</b><span>${c ? (c.aceito ? 'Aceito' : 'Recusado') + ' em ' + fmt(c.registrado_em) + ' · v' + esc(c.versao) : 'Sem registro'}</span></div>
      ${['notificacoes', 'pesquisa'].includes(t) ? `<label class="toggle"><input type="checkbox" ${c && c.aceito ? 'checked' : ''} onchange="Store.addConsents([{tipo:'${t}',versao:CFG.VERSAO_TERMOS,aceito:this.checked}]);toast(this.checked?'Consentimento registrado':'Consentimento revogado');scheduleReminders()" aria-label="${nome[t]}"><span></span></label>` : t === 'termos' || t === 'privacidade' ? `<button class="btn sec sm" onclick="showLegal('${t}')">Ler</button>` : ''}</div>`).join('')}
      <p class="muted" style="font-size:11.5px;margin:8px 0 0">O consentimento de dados de saúde é necessário para o app funcionar. Para revogá-lo, exclua sua conta abaixo.</p></div>
    ${[['ph-download-simple', 'Baixar meus dados', 'Arquivo JSON com tudo que você registrou', 'exportData()'], ['ph-upload-simple', 'Importar backup', 'De um arquivo exportado do Ninho', "$('imp-f').click()"],
      ...(legacyData() ? [['ph-clock-counter-clockwise', 'Importar da versão anterior', 'Dados antigos guardados neste aparelho', 'closeModal();importLegacy()']] : []),
      ['ph-sign-out', 'Sair e apagar deste aparelho', 'Seus dados continuam na sua conta', 'doSignOut()'], ['ph-trash', 'Excluir minha conta', 'Apaga tudo, definitivamente', 'modalDelete()']]
      .map(([ic, t, s, a]) => `<button class="qa" onclick="${a}"><span class="qi"><i class="ph ${ic}"></i></span><span class="qt"><b>${t}</b><span>${s}</span></span></button>`).join('')}
    <input type="file" id="imp-f" accept="application/json,.json" class="hidden" onchange="importFile(this.files[0])">
    <p class="muted" style="font-size:12px">Encarregado(a) de dados: ${esc(CFG.CONTATO_PRIVACIDADE)}</p>`);
}
function exportData() {
  const blob = new Blob([JSON.stringify(Store.exportAll(), null, 2)], { type: 'application/json' }); const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = `ninho-meus-dados-${todayISO()}.json`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); toast('Arquivo gerado ⬇️');
}
async function importFile(f) { if (!f) return; try { const r = Store.importExport(JSON.parse(await f.text())); closeModal(); toast(`${r.importados} registros importados${r.pulados ? ` · ${r.pulados} exigem Ninho+` : ''}`); renderAll(); } catch (e) { toast('Arquivo inválido: ' + e.message); } }
function doSignOut() { confirmBox('Sair da conta e apagar os dados deste aparelho? Eles continuam guardados na sua conta.', async () => { await Store.signOut(); showAuth('login'); }, { yes: 'Sair' }); }
function modalDelete() {
  openModal('Excluir conta', `<p style="font-size:14px;line-height:1.5">Isso apaga <b>definitivamente</b> sua conta, identificação, gestação, registros e fotos. Não dá para desfazer. Se quiser, baixe seus dados antes.</p>
    <button class="btn sec full sm" style="margin-bottom:12px" onclick="exportData()">⬇️ Baixar meus dados</button>
    <label class="lbl" for="del-c">Digite EXCLUIR para confirmar</label><input class="in" id="del-c" autocomplete="off">
    <button class="btn full" id="del-b" style="background:var(--bad)" onclick="doDelete()">Excluir definitivamente</button>`);
}
async function doDelete() { if (val('del-c') !== 'EXCLUIR') return fieldErr('del-c', 'Digite EXCLUIR'); await busy('del-b', async () => { try { await Store.deleteAccount(); closeModal(); showAuth('login'); toast('Conta excluída. Cuide-se 💜'); } catch (e) { toast('Não foi possível excluir agora. Tente de novo.'); } }); }
function modalAccount() {
  openModal('👤 Conta', `<dl class="kv"><dt>E-mail</dt><dd>${esc(S().email)}</dd><dt>Plano</dt><dd>${Store.isPlus() ? 'Ninho+' : 'Grátis'}</dd><dt>Sincronização</dt><dd>${Store.backend.mode === 'local' ? 'modo local' : S().meta.lastSync ? fmtDT(S().meta.lastSync) : 'pendente'}</dd><dt>Pendentes</dt><dd>${Store.pendingCount()}</dd></dl>
    ${Store.backend.remote ? `<label class="lbl" for="np" style="margin-top:14px">Nova senha</label><input class="in" type="password" id="np" autocomplete="new-password"><button class="btn sec full sm" onclick="if(!strongPass($('np').value))return fieldErr('np','8+ caracteres, letras e números');Store.backend.updatePassword($('np').value).then(()=>{toast('Senha alterada');closeModal()}).catch(e=>toast(e.message))">Alterar senha</button>
      <button class="btn sec full sm" style="margin-top:8px" onclick="Store.sync().then(()=>{toast('Sincronizado ✓');closeModal();renderAll()}).catch(()=>toast('Falha ao sincronizar'))">Sincronizar agora</button>` : ''}
    <button class="btn sec full" style="margin-top:12px" onclick="closeModal();doSignOut()">Sair</button>`);
}

/* =================== REGISTRO RÁPIDO =================== */
function quickAdd() {
  const it = (ic, t, s, a, f) => `<button class="qa" onclick="closeModal();${a}"><span class="qi"><i class="ph ${ic}"></i></span><span class="qt"><b>${t} ${f && !Store.can(f) ? plusTag() : ''}</b><span>${s}</span></span><i class="ph ph-caret-right chev"></i></button>`;
  openModal('Registro rápido', `${it('ph-stethoscope', 'Consulta', 'Dados da caderneta', 'modalConsulta()')}${it('ph-baby', 'Contar movimentos', 'Em tempo real', 'modalKick()')}${it('ph-syringe', 'Vacina', 'dTpa, VSR, gripe…', "go('timeline')")}
    ${it('ph-microscope', 'Exame', 'Resultado da caderneta', 'modalExame()', 'exames')}${it('ph-house-line', 'Medição em casa', 'Pressão, glicemia, peso', "A.recTab='casa';go('record')", 'casa')}${it('ph-smiley', 'Como estou', 'Sintomas e humor', 'modalSintoma()', 'sintomas')}`);
}

/* =================== INICIALIZAÇÃO =================== */
async function boot() {
  const isRecovery = /type=recovery/.test(location.hash);   // link de "esqueci minha senha"
  try {
    if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(e => console.warn('sw', e));
    await Store.boot();
  } catch (e) { $('boot').classList.add('hidden'); return showAuth('error', e.message); }
  Store.on(ev => { if (ev === 'sync' && S() && !$('main').classList.contains('hidden')) { renderBanners(); if (S().gestacao) renderHeader(); } if (ev === 'plan' && S() && S().gestacao) renderAll(); if (ev === 'recovery') showAuth('recovery'); if (ev === 'signedout') showAuth('login'); });
  window.addEventListener('online', () => Store.sync().catch(() => { }));
  document.addEventListener('visibilitychange', () => { if (document.hidden) Store.persistNow(); else if (S()) { Store.sync().catch(() => { }); if (S().gestacao && !$('main').classList.contains('hidden')) { renderAll(); scheduleReminders(); } } });
  if (/assinatura=retorno/.test(location.search)) { history.replaceState(null, '', location.pathname); setTimeout(() => Store.refreshPlan().then(() => { renderAll(); toast(Store.isPlus() ? '✨ Ninho+ ativo!' : 'Pagamento em processamento — avisaremos quando ativar'); }), 1500); }
  if (isRecovery || Store.recovery) return showAuth('recovery');
  route();
}
document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('modal-root').innerHTML) closeModal(); if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[role=button]')) { e.preventDefault(); e.target.click(); } });
boot();
