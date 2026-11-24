// Varredura exploratória: abre todas as telas e modais em vários cenários e procura
// erros de JavaScript, texto quebrado, conteúdo vazando da tela, botões sem nome
// acessível e falhas com dados extremos. Uso: BASE=http://localhost:8766/ node tests/e2e/explore.test.mjs
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE || 'http://localhost:8766/';
const STUB = fs.readFileSync(path.join(DIR, '../stubs/chart-stub.js'), 'utf8');
const CONFIG_LOCAL = fs.readFileSync(path.join(DIR, '../../js/config.js'), 'utf8').replace(/SUPABASE_URL: '[^']*'/, "SUPABASE_URL: ''").replace(/SUPABASE_ANON_KEY: '[^']*'/, "SUPABASE_ANON_KEY: ''");
const ACHADOS = []; const R = []; let area = '';
const rec = (nome, ok, nota = '') => { R.push({ area, nome, ok: !!ok, nota }); console.log(`${ok ? 'OK   ' : 'FALHA'} [${area}] ${nome}${nota ? ' — ' + nota : ''}`); };
const achado = (onde, o) => { ACHADOS.push(`[${area}] ${onde}: ${o}`); };
const XSS = '<img src=x onerror="window.__xss=1">"\'&';

const browser = await chromium.launch({ args: ['--no-sandbox'] });
async function novo({ width = 400, dark = false, time } = {}) {
  const ctx = await browser.newContext({ locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', viewport: { width, height: 800 }, colorScheme: dark ? 'dark' : 'light' });
  await ctx.route(/cdnjs\.cloudflare\.com.*chart/i, r => r.fulfill({ body: STUB, contentType: 'text/javascript' }));
  await ctx.route(/jsdelivr\.net.*supabase/i, r => r.fulfill({ body: '', contentType: 'text/javascript' }));
  await ctx.route(/fonts\.(googleapis|gstatic)|jsdelivr\.net.*phosphor/, r => r.fulfill({ body: '', contentType: 'text/css' }));
  await ctx.route(/\/js\/config\.js$/, r => r.fulfill({ body: CONFIG_LOCAL, contentType: 'text/javascript' }));
  const page = await ctx.newPage();
  if (time) await page.clock.install({ time: new Date(time) });
  page._err = [];
  page.on('pageerror', e => page._err.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) page._err.push(m.text()); });
  page.on('dialog', d => { page._err.push('diálogo nativo: ' + d.message()); d.dismiss(); });
  await page.goto(BASE);
  await page.waitForSelector('#auth:not(.hidden), #main:not(.hidden)');
  return { ctx, page };
}
/** cria conta local e gestação já pronta */
async function pronta(page, { nome = 'Ana Clara Souza', bebe = 'Theo', diasDum = 175, tipo = 'unica', extra = {} } = {}) {
  await page.evaluate(async ({ nome, bebe, diasDum, tipo, extra }) => {
    await Store.backend.signUp({ email: 'e' + Math.random().toString(36).slice(2) + '@t.com', password: 'senha1234', meta: { nome_completo: nome, consentimentos: ['termos', 'privacidade', 'dados_saude'].map(t => ({ tipo: t, versao: CFG.VERSAO_TERMOS, aceito: true })) } });
    localStorage.setItem('__pronta', JSON.stringify({ bebe, diasDum, tipo, extra }));
    location.reload();
  }, { nome, bebe, diasDum, tipo, extra });
  await page.waitForSelector('#setup:not(.hidden), #main:not(.hidden)');
  await page.evaluate(() => {
    const o = JSON.parse(localStorage.getItem('__pronta')); localStorage.removeItem('__pronta');
    const d = new Date(); d.setDate(d.getDate() - o.diasDum);
    Store.setGestacao(Object.assign({ metodo_ig: 'dum', dum: C.toISODate(d), nome_bebe: o.bebe, tipo_gravidez: o.tipo, altura_cm: 163, peso_pre_kg: 60 }, o.extra));
    Store.patchPrefs({ ofertas: { usg: 1, s20: 1, s34: 1 } });
    route(); if (window.closeModal) closeModal();
  });
  await page.waitForTimeout(300);
}
/** problemas visuais e de acessibilidade na tela atual */
async function inspecionar(page, onde) {
  const r = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth, out = { vaza: [], semNome: [], undef: [], peq: [] };
    const visivel = e => { const s = getComputedStyle(e); const b = e.getBoundingClientRect(); return s.display !== 'none' && s.visibility !== 'hidden' && b.width > 0 && b.height > 0; };
    for (const e of document.querySelectorAll('#main *:not(svg *), .modal *:not(svg *)')) {
      if (!visivel(e)) continue;
      const b = e.getBoundingClientRect();
      const rolavel = (() => { for (let a = e.parentElement; a; a = a.parentElement) if (/auto|scroll|hidden/.test(getComputedStyle(a).overflowX)) return true; return false; })();
      if (b.right > vw + 2 && !rolavel)
        out.vaza.push(e.tagName.toLowerCase() + '.' + [...e.classList].join('.') + ' (' + Math.round(b.right - vw) + 'px) ' + (e.textContent || '').trim().slice(0, 40));
      if (e.matches('button,a,[role=button],input:not([type=hidden]),select,textarea')) {
        const nome = (e.getAttribute('aria-label') || e.textContent || e.title || e.placeholder || (e.id && document.querySelector(`label[for="${e.id}"]`)?.textContent) || e.closest('label')?.textContent || '').trim();
        if (!nome) out.semNome.push(e.outerHTML.slice(0, 90));
        if (e.matches('button,a,[role=button]') && (b.height < 32 || b.width < 32) && !e.closest('p,li')) out.peq.push((nome || e.outerHTML.slice(0, 40)).slice(0, 40) + ` ${Math.round(b.width)}x${Math.round(b.height)}`);
      }
    }
    const txt = (document.querySelector('#main')?.innerText || '') + (document.querySelector('.modal')?.innerText || '');
    for (const m of txt.matchAll(/.{0,25}(undefined|NaN|null|\[object Object\]|Invalid Date).{0,25}/g)) out.undef.push(m[0].replace(/\s+/g, ' '));
    out.xss = !!window.__xss;
    return out;
  });
  r.vaza.slice(0, 3).forEach(v => achado(onde, 'conteúdo passa da tela: ' + v));
  [...new Set(r.semNome)].slice(0, 3).forEach(v => achado(onde, 'controle sem nome acessível: ' + v));
  [...new Set(r.undef)].slice(0, 3).forEach(v => achado(onde, 'texto quebrado: ' + v));
  [...new Set(r.peq)].slice(0, 3).forEach(v => achado(onde, 'alvo de toque pequeno: ' + v));
  if (r.xss) achado(onde, 'XSS: script injetado executou');
  return r;
}
const erros = page => { const e = page._err.splice(0); return e; };
const MODAIS = ['modalPremium', 'modalCodigo', 'modalKit', 'modalDangerCheck', 'modalConsulta', 'modalKick', 'modalExame', 'modalEco', 'modalMedicao',
  'modalCustomMonitor', 'modalSintoma', 'modalMed', 'modalIdent', 'modalMemoria', 'modalBirthPlan', 'modalNotif', 'modalPrivacy', 'modalDelete', 'modalAccount', 'modalTons',
  'modalNascimento', 'modalPerda', 'modalApoio', 'modalSinaisPuerperio', 'modalPerdaPlano', 'modalVideoBarriga'];   // modalVacina e modalMonHorarios precisam de um item: testados no app.test
const TABS = ['consultas', 'curvas', 'movimentos', 'exames', 'eco', 'casa', 'sintomas', 'notas', 'saude'];

async function varrer(page, rotulo) {
  for (const p of ['home', 'timeline', 'record', 'help', 'me']) {
    await page.evaluate(p => go(p), p); await page.waitForTimeout(120);
    await inspecionar(page, `${rotulo} · página ${p}`);
  }
  for (const t of TABS) {
    await page.evaluate(t => { A.recTab = t; go('record'); }, t); await page.waitForTimeout(120);
    await inspecionar(page, `${rotulo} · prontuário/${t}`);
  }
  for (const m of MODAIS) {
    const ok = await page.evaluate(m => { try { if (typeof window[m] !== 'function') return 'ausente'; const r = window[m](); if (r && r.catch) r.catch(e => console.error(m, e.message)); return 'ok'; } catch (e) { return 'erro: ' + e.message; } }, m);
    await page.waitForTimeout(150);
    if (ok.startsWith('erro')) achado(`${rotulo} · ${m}`, ok);
    if (await page.isVisible('.modal')) await inspecionar(page, `${rotulo} · ${m}`);
    await page.evaluate(() => { if (window.closeModal) closeModal(); });
  }
  const e = erros(page); e.forEach(x => achado(rotulo, 'erro de JavaScript: ' + x));
  return e.length;
}

/* ================= cenários ================= */
const cenarios = [
  ['Gestante 25 semanas, celular comum', { width: 400 }, {}],
  ['Tela pequena 320px, tema escuro', { width: 320, dark: true }, {}],
  ['Nomes com HTML (tentativa de XSS)', { width: 400 }, { nome: XSS + ' Souza', bebe: XSS }],
  ['Início da gestação (6 semanas)', { width: 400 }, { diasDum: 42 }],
  ['Pós-termo (42 semanas)', { width: 400 }, { diasDum: 294 }],
  ['Gêmeos com 30 semanas', { width: 400 }, { tipo: 'gemelar', diasDum: 210 }],
  ['Trigêmeos', { width: 400 }, { tipo: 'tripla_mais', diasDum: 200 }],
  ['Pós-parto (dia 10)', { width: 400 }, { diasDum: 290, extra: { desfecho: null } }, 'puerperio'],
  ['Perda gestacional', { width: 400 }, { diasDum: 90 }, 'perda'],
  ['Tablet 820px', { width: 820 }, {}],
];
for (const [nome, ctxOpt, gest, fase] of cenarios) {
  area = nome;
  const { ctx, page } = await novo(ctxOpt);
  await pronta(page, gest);
  if (fase === 'puerperio') await page.evaluate(() => { const d = new Date(); d.setDate(d.getDate() - 10); Store.setGestacao({ desfecho: { tipo: 'nascimento', data: C.toISODate(d) } }); });
  if (fase === 'perda') await page.evaluate(() => Store.setGestacao({ desfecho: { tipo: 'perda', data: todayISO(), semana: 12 } }));
  const n = await varrer(page, nome);
  rec('Todas as telas e janelas abrem sem erro de JavaScript', n === 0, n ? n + ' erro(s)' : '');
  if (nome.includes('XSS')) rec('Nenhum script injetado executou', !(await page.evaluate(() => window.__xss)));
  await ctx.close();
}

/* ================= fluxos com dados extremos ================= */
area = 'Dados extremos';
{
  const { ctx, page } = await novo();
  await pronta(page);
  // consulta com valores absurdos
  const r1 = await page.evaluate(() => { try { Store.upsert('consultas', { data: todayISO(), ig_semanas: 25, pas: 400, pad: 10, peso_kg: 500, altura_uterina_cm: 99, bcf: 400 }); go('home'); A.recTab = 'curvas'; go('record'); return 'ok'; } catch (e) { return e.message; } });
  rec('Valores absurdos de consulta não quebram o app', r1 === 'ok' || /inválid|fora/i.test(r1), r1);
  await inspecionar(page, 'curvas com valores extremos');
  // nascimento com data impossível
  await page.evaluate(() => modalNascimento()); await page.fill('#nb-d', '2020-01-01'); await page.click('text=Registrar nascimento');
  rec('Nascimento com data anterior à gestação é recusado', await page.evaluate(() => fase() === 'gestacao'));
  await page.evaluate(() => closeModal());
  // data futura de perda
  await page.evaluate(() => modalPerda()); await page.fill('#pd-d', '2099-01-01'); await page.click('.modal button:has-text("Registrar")');
  rec('Perda com data futura é recusada', await page.evaluate(() => fase() === 'gestacao'));
  await page.evaluate(() => closeModal());
  // perda → nova gestação → setup
  await page.evaluate(() => Store.setGestacao({ desfecho: { tipo: 'perda', data: todayISO(), semana: 10 } }));
  await page.evaluate(() => iniciarNovaGestacao()); await page.click('.modal button:has-text("Começar")').catch(() => { });
  await page.waitForTimeout(300);
  rec('“Nova gestação” leva ao cadastro da gestação', await page.isVisible('#setup:not(.hidden)'));
  rec('Gestação anterior fica guardada como inativa', await page.evaluate(() => (Store.S.gestAntigas || []).length === 1 && Store.S.gestAntigas[0].ativa === false));
  // recados/tons em modo local
  rec('Sem erros de JavaScript nos fluxos extremos', erros(page).length === 0);
  await ctx.close();
}

/* ================= relógio: virada de dia no pós-parto ================= */
area = 'Datas e fuso';
{
  const { ctx, page } = await novo({ time: '2026-12-31T23:50:00-03:00' });
  await pronta(page, { diasDum: 280 });
  await page.evaluate(() => { Store.setGestacao({ desfecho: { tipo: 'nascimento', data: todayISO() } }); go('home'); });
  const d1 = await page.evaluate(() => diaPuerperio());
  await page.clock.fastForward('00:20:00');
  const d2 = await page.evaluate(() => diaPuerperio());
  rec('Dia do pós-parto vira à meia-noite (1º → 2º dia)', d1 === 1 && d2 === 2, `${d1} → ${d2}`);
  rec('Sem erros de JavaScript na virada do ano', erros(page).length === 0);
  await ctx.close();
}

/* ================= regras de negócio ================= */
area = 'Regras';
{
  const { ctx, page } = await novo();
  await pronta(page, { diasDum: 210 });   // 30 semanas
  const r = await page.evaluate(() => {
    Store.applyConfig({ precos: { passe: 89.9, reta_final: 59.9, mensal: 14.9 }, reta_final_desde: 28, teste_dias: 7, recursos: { notas: 'free' } });
    const o = {};
    o.reta = passeAtual().nome;
    { const g = S().gestacao, orig = g.dpp_original; g.dpp_original = C.addDays(todayISO(), 175);   // 1ª datação dizia 15 semanas
      o.travado = passeAtual().nome; g.dpp_original = orig; }
    o.notasLiberadas = Store.can('notas') && !Store.can('exames');
    Store.setGestacao({ tipo_gravidez: 'gemelar' });
    Store.upsert('consultas', { data: todayISO(), ig_semanas: 30, altura_uterina_cm: 45, pas: 110, pad: 70 });
    o.semAlertaAU = !Alerts.compute(ctx()).some(a => /altura uterina/i.test(a.titulo + a.texto));
    Store.setGestacao({ tipo_gravidez: 'unica' });
    o.comAlertaAU = Alerts.compute(ctx()).some(a => /altura uterina/i.test(a.titulo + a.texto));
    Store.setGestacao({ desfecho: { tipo: 'perda', data: todayISO(), semana: 30 } });
    closeModal(); modalPremium(); o.perdaSemVenda = /reembolso/.test(document.querySelector('.modal').textContent); closeModal();
    Store.patchPrefs({ ofertas: {} }); maybeOfferTrial(); o.perdaSemTeste = !document.querySelector('.modal');
    Store.setGestacao({ desfecho: { tipo: 'nascimento', data: todayISO() } });
    for (let i = 0; i < 5; i++) { const d = new Date(); d.setDate(d.getDate() - i); Store.patchPrefs({ puerperio: Object.assign({}, Store.prefs.puerperio, { humor: (Store.prefs.puerperio?.humor || []).concat({ d: C.toISODate(d), h: 'triste' }) }) }); }
    o.humorAlerta = humorAlerta();
    registrarConsultaPuerp('p1'); o.consulta = !!Store.prefs.puerperio.consultas.p1;
    return o;
  });
  rec('A partir de 28 semanas o app oferece o Passe Reta Final', r.reta === 'Passe Reta Final', r.reta);
  rec('Adiantar a datação depois do cadastro não baixa o preço', r.travado === 'Passe Gestação', r.travado);
  rec('Recurso liberado no painel abre só aquele recurso', r.notasLiberadas);
  rec('Gêmeos: altura uterina fora da curva não gera alerta', r.semAlertaAU);
  rec('Um bebê: a mesma altura uterina gera orientação', r.comAlertaAU);
  rec('Modo perda: tela de planos vira orientação de reembolso', r.perdaSemVenda);
  rec('Modo perda: não oferece teste grátis', r.perdaSemTeste);
  rec('Pós-parto: 5 dias difíceis acendem o alerta de apoio', r.humorAlerta);
  rec('Pós-parto: consulta registrada fica salva', r.consulta);
  rec('Sem erros de JavaScript nas regras', erros(page).length === 0);
  await ctx.close();
}

/* ================= painel de administração (API simulada) ================= */
area = 'Painel';
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.route(/fonts\.(googleapis|gstatic)|jsdelivr\.net.*phosphor/, r => r.fulfill({ body: '', contentType: 'text/css' }));
  await ctx.route(/jsdelivr\.net.*supabase/i, r => r.fulfill({ body: '', contentType: 'text/javascript' }));
  const mk = async (modo) => {
    const page = await ctx.newPage(); page._err = [];
    page.on('pageerror', e => page._err.push(e.message));
    await page.addInitScript((modo) => {
      window.__chamadas = [];
      const err = (status, error) => ({ data: null, error: { context: { json: async () => ({ error }) }, status } });
      const contas = { total: 1, contas: [{ id: '11111111-1111-1111-1111-111111111111', nome: '<b>Maria</b>', email: 'm@x.com', plus: false, created_at: '2026-11-01' }] };
      window.supabase = { createClient: () => ({
        auth: { getSession: async () => ({ data: { session: modo === 'sem_sessao' ? null : { user: {} } } }), signOut: async () => ({}), signInWithPassword: async () => ({ error: { message: 'x' } }), resetPasswordForEmail: async (e, o) => { window.__reset = [e, o.redirectTo]; return { error: null }; } },
        functions: { invoke: async (n, o) => {
          const b = o.body; window.__chamadas.push(b);
          if (modo === 'nao_admin') return err(403, 'forbidden');
          if (b.acao === 'eu') return { data: { email: 'a@x.com' }, error: null };
          if (b.acao === 'contas') return { data: contas, error: null };
          if (b.acao === 'conta') return { data: { perfil: { nome_completo: '<b>Maria</b>' }, email: 'm@x.com', concessoes: [], assinatura: null, convites: 0, admin: false, confirmada: true }, error: null };
          if (b.acao === 'config') return { data: { dados: { precos: { passe: 89.9, reta_final: 59.9, mensal: 14.9 }, recursos: {} }, recursos_disponiveis: ['notas'] }, error: null };
          if (b.acao === 'config_salvar') return err(400, 'Preço inválido: passe');
          if (b.acao === 'excluir') return { data: { ok: true }, error: null };
          return { data: {}, error: null };
        } } }) };
    }, modo);
    await page.goto(BASE + 'admin.html'); await page.waitForTimeout(500);
    return page;
  };
  let p = await mk('sem_sessao');
  rec('Sem sessão mostra o login', await p.isVisible('#lg-e'));
  await p.click('[data-act=esqueci]');
  rec('Esqueci a senha sem e-mail pede o e-mail', !(await p.evaluate(() => window.__reset)));
  await p.fill('#lg-e', 'adm@x.com'); await p.click('[data-act=esqueci]'); await p.waitForTimeout(200);
  rec('Esqueci a senha envia o link de volta para o app', await p.evaluate(() => window.__reset && window.__reset[0] === 'adm@x.com' && /\/$/.test(window.__reset[1]) && !/admin/.test(window.__reset[1])));
  p = await mk('nao_admin');
  rec('Conta comum é barrada com mensagem clara', /não é administradora/.test(await p.textContent('#adm-main')));
  p = await mk('admin');
  await p.click('#adm-nav button[data-t=contas]'); await p.waitForTimeout(300);
  rec('Lista de contas escapa HTML dos nomes', !(await p.$('.tabela td b')) && /<b>Maria<\/b>/.test(await p.textContent('.tabela')));
  await p.click('tr[data-act=conta]'); await p.waitForTimeout(300);
  await p.click('[data-act=excluir]'); await p.fill('#ex-c', 'excluir'); await p.click('form[data-form=excluir] button');
  rec('Excluir exige digitar EXCLUIR em maiúsculas', !(await p.evaluate(() => window.__chamadas.some(c => c.acao === 'excluir'))));
  await p.fill('#ex-c', 'EXCLUIR'); await p.click('form[data-form=excluir] button'); await p.waitForTimeout(300);
  rec('Com a confirmação certa, a exclusão é enviada', await p.evaluate(() => window.__chamadas.some(c => c.acao === 'excluir' && c.confirmacao === 'EXCLUIR')));
  await p.click('#adm-nav button[data-t=config]'); await p.waitForTimeout(300);
  await p.click('form[data-form=config] button[type=submit]'); await p.waitForTimeout(300);
  rec('Erro do servidor ao salvar aparece para a administradora', /Preço inválido/.test(await p.textContent('#toast')));
  rec('Sem erros de JavaScript no painel', p._err.length === 0, p._err.join(' | '));
  await ctx.close();
}

await browser.close();
console.log('\n===== ACHADOS (' + ACHADOS.length + ') =====');
const vistos = new Map();
for (const a of ACHADOS) { const k = a.replace(/^\[[^\]]+\] [^:]+: /, ''); vistos.set(k, (vistos.get(k) || []).concat(a.match(/^\[[^\]]+\] [^:]+/)[0])); }
for (const [k, onde] of vistos) console.log(`- ${k}\n    em ${onde.length} lugar(es), ex.: ${onde.slice(0, 2).join(' | ')}`);
fs.writeFileSync(path.join(DIR, 'result-explore.json'), JSON.stringify({ R, achados: [...vistos].map(([k, v]) => ({ problema: k, onde: v })) }, null, 1));
const f = R.filter(x => !x.ok).length;
console.log(`\n${R.length} verificações · ${R.length - f} OK · ${f} falhas · ${vistos.size} tipos de achado`);
process.exit(f ? 1 : 0);
