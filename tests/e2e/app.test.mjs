// Teste ponta a ponta do Ninho v2 (modo local) — Playwright + Chrome headless
// Uso: BASE=http://localhost:8766/ node tests/e2e/app.test.mjs
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE || 'http://localhost:8766/';
const SHOTS = process.env.SHOTS || path.join(DIR, 'screens');
fs.mkdirSync(SHOTS, { recursive: true });
const STUB = fs.readFileSync(path.join(DIR, '../stubs/chart-stub.js'), 'utf8');
// este teste roda em MODO LOCAL: zera a configuração do Supabase
const CONFIG_LOCAL = fs.readFileSync(path.join(DIR, '../../js/config.js'), 'utf8').replace(/SUPABASE_URL: '[^']*'/, "SUPABASE_URL: ''").replace(/SUPABASE_ANON_KEY: '[^']*'/, "SUPABASE_ANON_KEY: ''");
const R = []; let area = '';
const rec = (nome, ok, nota = '') => { R.push({ area, nome, ok: !!ok, nota }); console.log(`${ok ? 'OK   ' : 'FALHA'} [${area}] ${nome}${nota ? ' — ' + nota : ''}`); };
const iso = d => { const z = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`; };
const daysAgo = n => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };

const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--no-sandbox'] });
async function ctxPage({ tz = 'America/Sao_Paulo', time, legacy } = {}) {
  const ctx = await browser.newContext({ timezoneId: tz, locale: 'pt-BR', viewport: { width: 400, height: 860 }, acceptDownloads: true });
  await ctx.route(/cdnjs\.cloudflare\.com.*chart/i, r => r.fulfill({ body: STUB, contentType: 'text/javascript' }));
  await ctx.route(/jsdelivr\.net.*supabase/i, r => r.fulfill({ body: '/* supabase indisponível no teste */', contentType: 'text/javascript' }));
  await ctx.route(/fonts\.(googleapis|gstatic)|jsdelivr\.net.*phosphor/, r => r.fulfill({ body: '', contentType: 'text/css' }));
  await ctx.route(/\/js\/config\.js$/, r => r.fulfill({ body: CONFIG_LOCAL, contentType: 'text/javascript' }));
  const page = await ctx.newPage();
  if (time) await page.clock.install({ time: new Date(time) });
  page._err = [];
  page.on('pageerror', e => page._err.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) page._err.push(m.text()); });
  if (legacy) await page.addInitScript(l => localStorage.setItem('ninho', JSON.stringify(l)), legacy);
  await page.goto(BASE);
  await page.waitForSelector('#auth:not(.hidden), #main:not(.hidden)');
  return { ctx, page };
}
const shot = async (page, n) => { await page.waitForTimeout(700); return page.screenshot({ path: path.join(SHOTS, n + '.png'), fullPage: false }); };
const homeTxt = async page => { await page.evaluate(() => go('home')); return page.textContent('#pg-home'); };

async function signup(page, { nome = 'Ana Clara Souza', email = 'ana@teste.com', pass = 'senha1234', nasc = '1994-03-10' } = {}) {
  await page.click('.tabs button:has-text("Criar conta")');
  await page.fill('#su-nome', nome); await page.fill('#su-nasc', nasc); await page.fill('#su-tel', '(11) 98888-7777');
  await page.fill('#su-email', email); await page.fill('#su-pass', pass); await page.fill('#su-pass2', pass);
  await page.click('text=Continuar →');
  await page.check('#cs-termos'); await page.check('#cs-priv'); await page.check('#cs-saude');
  await page.click('#su-btn');
  await page.waitForSelector('#setup:not(.hidden)');
}

/* ================= 1. Cadastro e login ================= */
area = 'Cadastro';
const legacy = { mae: 'ana', bebe: 'leo', mode: 'dum', data: daysAgo(150), dpp: '', consultas: [{ data: daysAgo(20), semana: '18', pa: '12x8', peso: '64', au: '17', bcf: '145', coment: 'ok' }], exams: [{ data: daysAgo(40), nome: 'Sangue', hemoglobina: '11.8' }], vaxDone: [0], kicks: [], symptoms: [], nextNotes: [{ txt: 'Posso viajar?', done: false }], homeLogs: {}, medReminders: [], memories: [], allergies: ['dipirona'], diseases: [], meds: [], vitals: { tipo: 'O-' }, drops: 120 };
let { ctx, page } = await ctxPage({ legacy });
rec('Abre na tela de login', await page.isVisible('#li-email'));
await shot(page, '01-login');
await page.click('#li-btn');
rec('Login vazio é bloqueado com mensagem', await page.isVisible('#li-email'));
await page.click('.tabs button:has-text("Criar conta")');
await page.fill('#su-nome', 'Ana'); await page.click('text=Continuar →');
rec('Exige nome e sobrenome', await page.isVisible('#su-nome.err'));
await page.fill('#su-nome', 'Ana Clara Souza'); await page.fill('#su-nasc', '1994-03-10'); await page.fill('#su-tel', '11988887777'); await page.fill('#su-email', 'ana@teste.com');
await page.fill('#su-pass', 'abc'); await page.fill('#su-pass2', 'abc'); await page.click('text=Continuar →');
rec('Bloqueia senha fraca', await page.isVisible('#su-pass.err'));
await page.fill('#su-pass', 'senha1234'); await page.fill('#su-pass2', 'senha12345'); await page.click('text=Continuar →');
rec('Bloqueia senhas diferentes', await page.isVisible('#su-pass2.err'));
await page.fill('#su-pass2', 'senha1234'); await page.click('text=Continuar →');
rec('Avança para consentimento', await page.isVisible('#cs-saude'));
await shot(page, '02-consentimento');
await page.click('#su-btn');
rec('Sem aceite dos termos não cria conta', await page.isVisible('#cs-termos'));
await page.check('#cs-termos'); await page.check('#cs-priv'); await page.click('#su-btn');
rec('Sem consentimento de dados de saúde não cria conta', await page.isVisible('#cs-saude'));
await page.check('#cs-saude'); await page.click('#su-btn');
await page.waitForSelector('#setup:not(.hidden)');
rec('Conta criada → configuração da gestação', true);
const cons = await page.evaluate(() => Store.S.consents.map(c => c.tipo + ':' + c.aceito).join(','));
rec('Consentimentos registrados com versão', /termos:true.*dados_saude:true.*pesquisa:false/.test(cons), cons);
const prof = await page.evaluate(() => Store.S.profile);
rec('Identificação do cadastro no perfil', prof.nome_completo === 'Ana Clara Souza' && prof.data_nascimento === '1994-03-10' && prof.telefone === '11988887777');

/* ================= 2. Idade gestacional pelo 1º USG ================= */
area = 'IG / 1º USG';
rec('USG é a opção padrão e recomendada', await page.isVisible('.seg button.on:has-text("1º ultrassom")') && await page.isVisible('text=RECOMENDADO'));
await shot(page, '03-setup-usg');
const fut = new Date(); fut.setDate(fut.getDate() + 5);
await page.fill('#g-usg', iso(fut)); await page.fill('#g-sem', '8'); await page.fill('#g-dias', '3');
await page.click('text=Continuar →');
rec('Bloqueia data de USG futura', await page.isVisible('.err:has-text("futura")'));
await page.fill('#g-usg', daysAgo(30)); await page.fill('#g-sem', '50'); await page.click('text=Continuar →');
rec('Bloqueia IG do laudo fora de 4–42 sem', await page.isVisible('.err:has-text("entre 4 e 42")'));
await page.fill('#g-sem', '8'); await page.fill('#g-dias', '3');
const prev = await page.textContent('#g-prev');
rec('Prévia: USG há 30 dias com 8s3d → hoje 12s5d', /12 semanas e 5 dias/.test(prev), prev.slice(0, 80));
await page.fill('#g-dum', daysAgo(30 + 59 + 10));  // DUM 10 dias "mais antiga" que o USG
const prev2 = await page.textContent('#g-prev');
rec('Compara DUM × USG e aplica a regra de redatação', /Diferença de 10 dias/.test(prev2) && /seguir o ultrassom/.test(prev2), prev2.replace(/\s+/g, ' ').slice(0, 160));
await page.fill('#g-bebe', 'Leo');
await page.click('text=Continuar →');
await page.waitForSelector('#id-cpf');
// legado: oferta de importação
const legacyAsk = await page.waitForSelector('.modal:has-text("versão anterior")', { timeout: 3000 }).then(() => true).catch(() => false);
rec('Oferece importar dados da versão anterior', legacyAsk);
if (legacyAsk) await page.click('.modal button:has-text("Cancelar")');
area = 'Identificação';
await shot(page, '04-identificacao');
await page.fill('#id-cpf', '123.456.789-00'); await page.click('text=Salvar e entrar');
rec('CPF inválido é recusado', await page.isVisible('#id-cpf.err'));
await page.fill('#id-cpf', '529.982.247-25');
const cns = await page.evaluate(() => { for (let i = 0; i < 1e5; i++) { const c = '7' + String(Math.floor(Math.random() * 1e14)).padStart(14, '0'); if (validCNS(c)) return c; } });
await page.fill('#id-cns', '123456789012345'); await page.click('text=Salvar e entrar');
rec('CNS inválido é recusado', await page.isVisible('#id-cns.err'));
await page.fill('#id-cns', cns); await page.selectOption('#id-sangue', 'O-');
await page.fill('#id-mat', 'Maternidade Municipal'); await page.fill('#id-ce', 'Carlos'); await page.fill('#id-cet', '(11) 97777-6666');
await page.fill('#id-alt', '162'); await page.fill('#id-pp', '60');
await page.fill('#id-social', '<img src=x onerror="window.__xss=1">');
await page.click('text=Salvar e entrar');
await page.waitForSelector('#main:not(.hidden)');
rec('Entra no app após identificação', true);
area = 'IG / 1º USG';
const sub = await page.textContent('.top .sub');
rec('Cabeçalho mostra IG e método (USG)', /12 semanas e 5 dias · IG pelo 1º ultrassom/.test(sub), sub);
const dpp = await page.evaluate(() => ga().dpp);
const dppExp = (() => { const d = new Date(); d.setDate(d.getDate() + 280 - 89); return iso(d); })();
rec('DPP = data do USG − IG do laudo + 280 dias', dpp === dppExp, `${dpp} vs ${dppExp}`);
area = 'Segurança';
await page.waitForTimeout(300);
rec('Nome social com HTML não executa script (XSS)', !(await page.evaluate(() => window.__xss)) && /&lt;img|<img/.test(await page.evaluate(() => document.querySelector('.top .hi').innerHTML)) === true && !(await page.$('.top img')));
await shot(page, '05-inicio');
rec('Sem erros de JavaScript até aqui', page._err.length === 0, page._err.join(' | '));

/* ================= 3. Plano grátis ================= */
area = 'Plano grátis';
await page.evaluate(() => { A.recTab = 'exames'; go('record'); });
rec('Aba Exames bloqueada no grátis', await page.isVisible('#rec-body:has-text("Conhecer o Ninho+")'));
const thrown = await page.evaluate(() => { try { Store.upsert('exames', { data: todayISO(), codigo: 'hb', valor_num: 10 }); return 'gravou'; } catch (e) { return e.code; } });
rec('Camada de dados recusa registro Plus no grátis', thrown === 'PLUS', thrown);
await page.evaluate(() => setRecTab('curvas'));
rec('Curvas da Caderneta liberadas no grátis', (await page.evaluate(() => window.__charts.map(c => c.id))).includes('g-au'));
await page.evaluate(() => setRecTab('consultas'));
rec('Consultas liberadas no grátis', await page.isVisible('text=+ Registrar consulta'));
await page.evaluate(() => go('timeline'));
rec('Jornada lista exames da Caderneta (ex.: HTLV, sífilis, eletroforese)', /HTLV/.test(await page.textContent('#pg-timeline')) && /Eletroforese/.test(await page.textContent('#pg-timeline')));
rec('Calendário vacinal inclui VSR e dT', /VSR/.test(await page.textContent('#pg-timeline')) && /dT \(dupla adulto\)/.test(await page.textContent('#pg-timeline')));

/* ================= 4. Consultas e alertas ================= */
area = 'Consultas';
await page.evaluate(() => go('record'));
await page.click('text=+ Registrar consulta');
await page.fill('#c-sis', '80'); await page.fill('#c-dia', '120'); await page.click('text=Salvar consulta');
rec('Bloqueia PA invertida (80/120)', await page.isVisible('#c-dia.err'));
await page.fill('#c-sis', '120'); await page.fill('#c-dia', '80'); await page.fill('#c-bcf', '400'); await page.click('text=Salvar consulta');
rec('Bloqueia BCF absurdo', await page.isVisible('#c-bcf.err'));
await page.fill('#c-bcf', '145'); await page.fill('#c-peso', '61'); await page.selectOption('#c-ede', 'ausente'); await page.selectOption('#c-mov', 'presentes');
await page.fill('#c-data', daysAgo(10)); await page.fill('#c-next', daysAgo(-1));
await page.click('text=Salvar consulta');
rec('Salva consulta com campos da Caderneta', (await page.evaluate(() => L('consultas').length)) === 1);
const c0 = await page.evaluate(() => L('consultas')[0]);
rec('IG da consulta calculada pela data (11s2d)', c0.ig_semanas === 11 && c0.ig_dias === 2, `${c0.ig_semanas}s${c0.ig_dias}d`);
await page.click('text=+ Registrar consulta');
await page.fill('#c-sis', '165'); await page.fill('#c-dia', '112'); await page.fill('#c-bcf', '185'); await page.click('text=Salvar consulta');
let ht = await homeTxt(page);
rec('PA 165/112 na consulta → alerta URGENTE', /URGENTE · Pressão muito alta/.test(ht));
rec('BCF 185 → alerta de atenção', /Batimentos do bebê fora da faixa/.test(ht));
rec('Alerta urgente oferece ligar 192', await page.isVisible('.alert.urgente button:has-text("Ligar 192")'));
await shot(page, '06-alerta-urgente');
const drops1 = await page.evaluate(() => Store.game.gotas);
await page.evaluate(() => go('timeline'));
await page.click('.card:has-text("dTpa") button:has-text("Registrar")');
await page.click('.modal button:has-text("Salvar")');
await page.click('.card:has-text("dTpa") button:has-text("+ dose")');
await page.fill('#vx-dose', '1'); await page.click('.modal button:has-text("Salvar")');
rec('Não duplica a mesma dose de vacina', await page.isVisible('#vx-dose.err'));
await page.evaluate(() => closeModal());
const vid = await page.evaluate(() => L('vacinas')[0].id);
await page.evaluate(id => { Store.remove('vacinas', id); }, vid);
await page.evaluate(() => { modalVacina('dtpa'); }); await page.click('.modal button:has-text("Salvar")');
const drops2 = await page.evaluate(() => Store.game.gotas);
rec('Gotas não podem ser “farmadas” apagando e registrando de novo', drops2 - drops1 <= 20, `+${drops2 - drops1}`);

/* ================= 5. Curvas ================= */
area = 'Curvas';
await page.evaluate(() => { A.recTab = 'curvas'; go('record'); });
const ch = await page.evaluate(() => Object.fromEntries(window.__charts.filter(c => ['g-au', 'g-peso', 'g-pa'].includes(c.id)).map(c => [c.id, c.datasets])));
rec('Curva AU: P10/P50/P90 + pontos', ch['g-au'] && ch['g-au'].length === 4);
const au40 = await page.evaluate(() => Clin.auRef(40));
rec('AU 40 sem: P50 38,0 cm · P90 40,5 cm (INTERGROWTH)', au40.p50 === 38 && au40.p90 === 40.5);
const band40 = await page.evaluate(() => window.__charts.filter(c => c.id === 'g-peso').pop().datasets.slice(0, 2).map(d => d.data[40].y));
rec('Faixa de ganho de peso (eutrofia) em 40 sem = 8–12 kg (MS/Kac)', band40[0] === 12 && band40[1] === 8, JSON.stringify(band40));
rec('Gráfico de pressão das consultas com linhas 140/90 e 160/110', ch['g-pa'] && ch['g-pa'].length === 6);
await shot(page, '07-curvas');

/* ================= 6. Datas e fuso ================= */
area = 'Datas';
const { ctx: c2, page: p2 } = await ctxPage({ time: '2026-11-12T22:30:00-03:00' });
rec('“Hoje” às 22h30 de Brasília é o dia local (não UTC)', (await p2.evaluate(() => todayISO())) === '2026-11-12');
await c2.close();

/* ================= 7. Persistência ================= */
area = 'Persistência';
await page.evaluate(() => Store.persistNow());
await page.reload(); await page.waitForSelector('#main:not(.hidden)');
rec('Sessão e dados continuam após recarregar', (await page.evaluate(() => L('consultas').length)) === 2);

/* ================= 8. Ninho+ ================= */
area = 'Ninho+';
await page.evaluate(() => setDemoPlan('plus')); await page.waitForTimeout(200);
rec('Ativa Plus (demonstração local)', await page.evaluate(() => Store.isPlus()));
await page.evaluate(() => { A.recTab = 'exames'; go('record'); });
rec('Exames pendentes do trimestre aparecem', await page.isVisible('#rec-body:has-text("Pendentes neste trimestre")'));
await page.click('text=+ Registrar exame');
await page.selectOption('#e-cod', 'hb'); await page.click('text=Salvar exame');
rec('Não salva exame vazio', await page.isVisible('.modal'));
await page.fill('#e-val', '9,5'); await page.click('text=Salvar exame');
await page.waitForTimeout(100);
rec('Salva exame com vírgula decimal', (await page.evaluate(() => L('exames')[0] && L('exames')[0].valor_num)) === 9.5);
ht = await homeTxt(page);
rec('Hb 9,5 → alerta de anemia', /anemia/.test(ht));
// sífilis reagente
await page.evaluate(() => modalExame(null, 'sifilis')); await page.click('#e-opts .chip >> text="Reagente"'); await page.click('text=Salvar exame');
rec('Sífilis reagente → orientação de tratamento da parceria', /parceria/.test(await homeTxt(page)));
// foto grande
const big = Buffer.alloc(6 * 1024 * 1024, 7);
await page.evaluate(() => { A.recTab = 'eco'; go('record'); }); await page.click('text=+ Registrar ultrassom');
const png = path.join(SHOTS, '05-inicio.png');
await page.setInputFiles('#u-img', png); await page.fill('#u-sem', '12');
await page.click('text=Salvar ultrassom'); await page.waitForTimeout(800);
const eco = await page.evaluate(async () => { const e = L('ultrassons')[0]; const b = e && await Store.IDB.get('files', e.arquivo_path); return { path: e && e.arquivo_path, size: b && b.size, type: b && b.type }; });
rec('Imagem do ultrassom comprimida e guardada no IndexedDB', eco.path && eco.size > 0 && eco.type === 'image/jpeg', JSON.stringify(eco));
rec('Imagem aparece no álbum', await page.waitForSelector('#rec-body img.thumb[src^="blob:"]', { timeout: 3000 }).then(() => true).catch(() => false));
// 6 MB em dados: sem limite do localStorage
const bigOk = await page.evaluate(async () => { const b = new Blob([new Uint8Array(6 * 1024 * 1024)], { type: 'image/jpeg' }); await Store.IDB.set('files', 'teste/grande.jpg', b); const r = await Store.IDB.get('files', 'teste/grande.jpg'); await Store.IDB.del('files', 'teste/grande.jpg'); return r.size; });
rec('Armazena 6 MB sem estourar a cota (IndexedDB)', bigOk === 6 * 1024 * 1024);
// glicemia em casa
await page.evaluate(() => { A.recTab = 'casa'; go('record'); toggleMon('glicemia', true); toggleMon('pressao', true); });
for (const v of ['130', '128']) { await page.click('.card:has-text("Glicemia capilar") button:has-text("+ Registrar")'); await page.fill('#md-v', v); await page.selectOption('#md-m', 'pos2h'); await page.click('text=Salvar medição'); }
rec('2 glicemias 2 h acima de 120 → alerta “acima da meta”', /Glicemias acima da meta/.test(await homeTxt(page)));
await page.evaluate(() => { A.recTab = 'casa'; go('record'); });
await page.click('.card:has-text("Pressão arterial") button:has-text("+ Registrar")'); await page.fill('#md-s', '120'); await page.fill('#md-di', '130'); await page.click('text=Salvar medição');
rec('Medição de PA incoerente é bloqueada', await page.isVisible('#md-di.err'));
await page.evaluate(() => closeModal());
// sintoma + PA alta = urgente
await page.evaluate(() => { Store.upsert('medicoes', { tipo: 'pressao', medido_em: new Date(Date.now() + 1000).toISOString(), sis: 145, dia: 92 }); Store.upsert('sintomas', { registrado_em: new Date().toISOString(), nome: 'Visão embaçada', intensidade: 2 }); });
rec('PA 145/92 + visão embaçada → URGENTE (pré-eclâmpsia)', /Pressão alta com sintomas/.test(await homeTxt(page)));
// medicação: valida horário
await page.evaluate(() => { A.recTab = 'saude'; go('record'); modalMed(); });
await page.fill('#m-n', 'Sulfato ferroso'); await page.fill('#m-h', '25:99, 8h'); await page.click('.modal button:has-text("Salvar")');
rec('Recusa horário inválido da medicação', await page.isVisible('#m-h.err'));
await page.fill('#m-h', '8h, 20:00'); await page.click('.modal button:has-text("Salvar")');
rec('Normaliza “8h” → 08:00', JSON.stringify(await page.evaluate(() => L('medicamentos')[0].horarios)) === '["08:00","20:00"]');
await page.click('.modal button:has-text("Cancelar")').catch(() => { });

/* ================= 9. 3º trimestre: movimentos e vacinas ================= */
area = 'Movimentos';
await page.evaluate(d => { Store.setGestacao({ metodo_ig: 'dum', dum: d }); renderAll(); }, daysAgo(30 * 7));
await page.evaluate(() => modalKick());
for (let i = 0; i < 4; i++) await page.click('text=Senti um movimento!');
await page.click('text=Finalizar e salvar');
ht = await homeTxt(page);
rec('Contagem baixa interrompida → alerta de atenção', /Contagem com poucos movimentos/.test(ht));
await page.evaluate(() => Store.upsert('movimentos', { inicio: new Date(Date.now() - 3 * 3600e3 + 5000).toISOString(), duracao_min: 120, contagem: 6 }));
await page.evaluate(() => { const l = L('movimentos').sort((a, b) => b.inicio.localeCompare(a.inicio)); l.slice(1).forEach(x => x.inicio = new Date(Date.now() - 4 * 3600e3).toISOString()); l[0].inicio = new Date().toISOString(); });
await page.evaluate(() => { const k = L('movimentos').find(x => x.contagem === 6); k.inicio = new Date(Date.now() + 2000).toISOString(); });
rec('6 movimentos em 2 h → URGENTE', /Bebê mexendo menos/.test(await homeTxt(page)));
rec('30 sem sem VSR → lembrete da vacina VSR', /Vacina VSR/.test(await homeTxt(page)));

/* ================= 10. Sinais de perigo ================= */
area = 'Sinais de alerta';
await page.click('text=Estou sentindo algo diferente');
await page.check('.dg[value="sangramento"]'); await page.click('text=Ver o que fazer');
rec('Check de sinais → tela de urgência com 192', await page.isVisible('.modal a[href="tel:192"]'));
await shot(page, '08-sinais-perigo');
await page.evaluate(() => closeModal());
await page.evaluate(() => go('help'));
rec('Lista da Caderneta inclui visão, epigástrio e febre 37,8', /Alterações na visão/.test(await page.textContent('#pg-help')) && /região do estômago/.test(await page.textContent('#pg-help')) && /37,8/.test(await page.textContent('#pg-help')));
rec('Lista tem os 16 sinais da seção 2.6 (ardência ao urinar, manchas, desmaio)', await page.evaluate(() => C.SINAIS_PERIGO.filter(s => !s.extra).length === 16) && /ardência ao urinar/.test(await page.textContent('#pg-help')) && /Desmaio/.test(await page.textContent('#pg-help')));

/* ================= 11. Notificações ================= */
area = 'Notificações';
await ctx.grantPermissions(['notifications']);
await page.evaluate(() => enableNotifications()); await page.waitForTimeout(200);
const rem = await page.evaluate(() => scheduleReminders().map(r => ({ t: r.tipo, ti: r.titulo, c: r.corpo, h: r.quando.getHours() })));
rec('Gera lembretes (consulta, movimentos, medicação)', ['consulta', 'movimentos', 'medicacao'].every(t => rem.some(r => r.t === t)), [...new Set(rem.map(r => r.t))].join(','));
rec('Texto padrão não expõe dados de saúde', rem.every(r => r.ti === 'Ninho') && !rem.some(r => /Sulfato/.test(r.c)));
rec('Respeita horário de silêncio (22h–7h) nos lembretes automáticos', !rem.some(r => ['consulta', 'semana', 'vacina', 'exame'].includes(r.t) && (r.h >= 22 || r.h < 7)));
const sw = await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length);
rec('Service worker real registrado (offline + push)', sw === 1);
await page.evaluate(() => modalNotif()); await shot(page, '09-notificacoes'); await page.evaluate(() => closeModal());

/* ================= 12. Privacidade ================= */
area = 'Privacidade';
await page.evaluate(() => modalPrivacy()); await shot(page, '10-privacidade');
const [dl] = await Promise.all([page.waitForEvent('download'), page.click('text=Baixar meus dados')]);
const exp = JSON.parse(fs.readFileSync(await dl.path(), 'utf8'));
rec('Exporta todos os dados (portabilidade)', exp.formato === 'ninho-export' && exp.registros.consultas.length === 2 && exp.identificacao.cns === cns);
rec('Exportação não leva campos internos', !JSON.stringify(exp).includes('"_dirty"'));
await page.click('.qa:has-text("Importar da versão anterior")');
await page.waitForTimeout(200);
const imp = await page.evaluate(() => ({ c: L('consultas').length, n: L('notas').length, pa: L('consultas').some(c => c.pa_sis === 120 && c.pa_dia === 80) }));
rec('Importa dados da versão anterior (inclui PA “12x8” → 120/80)', imp.c === 3 && imp.n >= 1 && imp.pa, JSON.stringify(imp));
await page.evaluate(() => { Store.addConsents([{ tipo: 'notificacoes', versao: CFG.VERSAO_TERMOS, aceito: false }]); });
rec('Revogar consentimento de notificações zera os lembretes', (await page.evaluate(() => scheduleReminders().length)) === 0);
area = 'Acessibilidade';
await page.evaluate(() => { A.recTab = 'consultas'; go('record'); });
const semRotulo = await page.evaluate(() => [...document.querySelectorAll('button')].filter(b => b.offsetParent && !b.textContent.replace(/[\u{1F300}-\u{1FAFF}☀-➿️×✏️🗑️]/gu, '').trim() && !b.getAttribute('aria-label')).length);
rec('Botões só com ícone têm aria-label', semRotulo === 0, `${semRotulo} sem rótulo`);
area = 'Conta';
await page.evaluate(() => modalDelete());
await page.fill('#del-c', 'excluir'); await page.click('#del-b');
rec('Exclusão exige digitar EXCLUIR', await page.isVisible('#del-c.err'));
await page.fill('#del-c', 'EXCLUIR'); await page.click('#del-b');
await page.waitForSelector('#li-email');
rec('Conta excluída volta ao login', true);
await page.fill('#li-email', 'ana@teste.com'); await page.fill('#li-pass', 'senha1234'); await page.click('#li-btn');
rec('Conta excluída não entra mais', await page.isVisible('.err:has-text("incorretos")'));
const leftover = await page.evaluate(async () => { const k = Object.keys(localStorage).filter(k => k.startsWith('ninho.local.plan')); return k.length; });
rec('Não sobram dados da conta no aparelho', leftover === 0);
area = 'Geral';
rec('Sem erros de JavaScript no fluxo completo', page._err.length === 0, page._err.slice(0, 5).join(' | '));
await ctx.close();

/* ================= 13. Telas no modo escuro ================= */
{
  const c3 = await browser.newContext({ colorScheme: 'dark', viewport: { width: 400, height: 860 }, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' });
  await c3.route(/cdnjs.*chart/i, r => r.fulfill({ body: STUB, contentType: 'text/javascript' })); await c3.route(/supabase|fonts|phosphor/, r => r.fulfill({ body: '' }));
  await c3.route(/\/js\/config\.js$/, r => r.fulfill({ body: CONFIG_LOCAL, contentType: 'text/javascript' }));
  const p3 = await c3.newPage(); await p3.goto(BASE); await p3.waitForSelector('#li-email');
  await signup(p3, { email: 'b@b.com' }); await p3.fill('#g-usg', daysAgo(10)); await p3.fill('#g-sem', '9'); await p3.fill('#g-dias', '0'); await p3.click('text=Continuar →');
  await p3.waitForSelector('#id-cpf'); await p3.click('text=Preencher depois'); await p3.waitForSelector('#main:not(.hidden)');
  await shot(p3, '11-inicio-escuro'); area = 'Geral'; rec('Fluxo completo também no modo escuro', true); await c3.close();
}
await browser.close();
fs.writeFileSync(path.join(DIR, 'result.json'), JSON.stringify(R, null, 2));
const f = R.filter(r => !r.ok);
console.log(`\n${R.length} verificações · ${R.length - f.length} OK · ${f.length} falhas`);
process.exit(f.length ? 1 : 0);
