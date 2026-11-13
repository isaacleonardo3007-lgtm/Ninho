// Teste do modo SUPABASE (backend simulado em memória, dois "aparelhos")
// Uso: BASE=http://localhost:8766/ node tests/e2e/supabase.test.mjs
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createMockServer, BROWSER_CLIENT } from './supabase-mock.mjs';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE || 'http://localhost:8766/';
const STUB = fs.readFileSync(path.join(DIR, '../stubs/chart-stub.js'), 'utf8');
const CONFIG = fs.readFileSync(path.join(DIR, '../../js/config.js'), 'utf8')
  .replace(/SUPABASE_URL: '[^']*'/, "SUPABASE_URL: 'https://teste.supabase.co'").replace(/SUPABASE_ANON_KEY: '[^']*'/, "SUPABASE_ANON_KEY: 'anon-teste'");
const server = createMockServer();
const R = []; let area = 'Supabase';
const rec = (nome, ok, nota = '') => { R.push({ area, nome, ok: !!ok, nota }); console.log(`${ok ? 'OK   ' : 'FALHA'} [${area}] ${nome}${nota ? ' — ' + nota : ''}`); };
const iso = d => { const z = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`; };
const daysAgo = n => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };

const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--no-sandbox'] });
async function device() {
  const ctx = await browser.newContext({ locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', viewport: { width: 400, height: 860 } });
  await ctx.exposeFunction('__mock', (op, a) => server.handle(op, a));
  await ctx.route(/cdnjs\.cloudflare\.com.*chart/i, r => r.fulfill({ body: STUB, contentType: 'text/javascript' }));
  await ctx.route(/jsdelivr\.net.*supabase/i, r => r.fulfill({ body: BROWSER_CLIENT, contentType: 'text/javascript' }));
  await ctx.route(/fonts\.|phosphor/, r => r.fulfill({ body: '', contentType: 'text/css' }));
  await ctx.route(/\/js\/config\.js$/, r => r.fulfill({ body: CONFIG, contentType: 'text/javascript' }));
  const page = await ctx.newPage(); page._err = [];
  page.on('pageerror', e => page._err.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) page._err.push(m.text()); });
  await page.goto(BASE); await page.waitForSelector('#auth:not(.hidden), #main:not(.hidden)');
  return { ctx, page };
}
const sync = page => page.evaluate(() => Store.sync().then(() => 'ok', e => 'erro: ' + e.message));

// ---------- aparelho 1: cadastro ----------
const A1 = await device(); let p = A1.page;
rec('Modo Supabase ativo (sem banner de modo local)', await p.evaluate(() => Store.backend.mode) === 'supabase');
await p.click('.tabs button:has-text("Criar conta")');
await p.fill('#su-nome', 'Bia Lima Santos'); await p.fill('#su-nasc', '1990-01-20'); await p.fill('#su-tel', '21999998888');
await p.fill('#su-email', 'bia@ex.com'); await p.fill('#su-pass', 'segura123'); await p.fill('#su-pass2', 'segura123'); await p.click('text=Continuar →');
await p.check('#cs-termos'); await p.check('#cs-priv'); await p.check('#cs-saude'); await p.click('#su-btn');
rec('Cadastro pede confirmação de e-mail', await p.waitForSelector('text=link de confirmação').then(() => true).catch(() => false));
rec('Trigger criou perfil, assinatura grátis e consentimentos', server.db.profiles[0].nome_completo === 'Bia Lima Santos' && server.db.assinaturas[0].plano === 'free' && server.db.consentimentos.length === 5);
await p.click('text=Já confirmei'); await p.fill('#li-email', 'bia@ex.com'); await p.fill('#li-pass', 'segura123'); await p.click('#li-btn');
rec('Login antes de confirmar e-mail é recusado em português', await p.isVisible('.err:has-text("Confirme seu e-mail")'));
server.handle('confirm', { email: 'bia@ex.com' });
await p.fill('#li-pass', 'errada999'); await p.click('#li-btn');
rec('Senha errada → mensagem clara', await p.isVisible('.err:has-text("incorretos")'));
await p.fill('#li-email', 'bia@ex.com'); await p.fill('#li-pass', 'segura123'); await p.click('#li-btn');
await p.waitForSelector('#setup:not(.hidden)');
rec('Login → consentimentos puxados do servidor (sem pedir de novo) → gestação', await p.isVisible('#g-usg'));
await p.fill('#g-usg', daysAgo(20)); await p.fill('#g-sem', '9'); await p.fill('#g-dias', '1'); await p.click('text=Continuar →');
await p.waitForSelector('#id-cpf'); await p.selectOption('#id-sangue', 'A+'); await p.fill('#id-alt', '158'); await p.fill('#id-pp', '55'); await p.click('text=Salvar e entrar');
await p.waitForSelector('#main:not(.hidden)');
await p.evaluate(() => { modalConsulta(); }); await p.fill('#c-sis', '118'); await p.fill('#c-dia', '76'); await p.fill('#c-peso', '56'); await p.click('text=Salvar consulta');
rec('Sincroniza com o servidor', (await sync(p)) === 'ok');
rec('Gestação, consulta e perfil no banco', server.db.gestacoes.length === 1 && server.db.consultas.length === 1 && server.db.profiles[0].tipo_sanguineo === 'A+');
rec('updated_at vem do servidor', server.db.consultas[0].updated_at !== (await p.evaluate(() => L('consultas')[0].created_at)));

// ---------- grátis: registro Plus bloqueado pelo "RLS" ----------
await p.evaluate(() => { const S = Store.S; S.t.exames.push({ id: Store.uuid(), user_id: S.uid, gestacao_id: S.gestacao.id, data: todayISO(), codigo: 'hb', valor_num: 12, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), _dirty: true }); });
await sync(p);
rec('Servidor recusa Plus no grátis; app marca e não fica em loop', server.db.exames.length === 0 && await p.evaluate(() => Store.blockedCount()) === 1);
server.handle('setPlan', { user: server.db.users[0].id, plano: 'plus' });
await sync(p); await sync(p);
rec('Ao virar Plus, registros bloqueados sobem sozinhos', server.db.exames.length === 1 && await p.evaluate(() => Store.isPlus() && Store.blockedCount() === 0));
// foto
await p.evaluate(() => { A.recTab = 'eco'; go('record'); }); await p.click('text=+ Registrar ultrassom');
await p.setInputFiles('#u-img', { name: 'eco.png', mimeType: 'image/png', buffer: fs.readFileSync(path.join(DIR, '../../icons/icon-512.png')) });
await p.click('text=Salvar ultrassom'); await p.waitForTimeout(300); await sync(p);
const sp = Object.keys(server.db.storage);
rec('Foto vai para o Storage privado na pasta da usuária', sp.length === 1 && sp[0].startsWith(server.db.users[0].id + '/ultrassons/'));
// offline
await A1.ctx.setOffline(true);
await p.evaluate(() => { modalConsulta(); }); await p.fill('#c-data', daysAgo(1)); await p.fill('#c-sis', '121'); await p.fill('#c-dia', '79'); await p.click('text=Salvar consulta');
await sync(p); await p.evaluate(() => renderBanners());
rec('Offline: registra e mostra aviso de sem internet', await p.isVisible('.banner.off') && server.db.consultas.length === 1);
await A1.ctx.setOffline(false); await sync(p);
rec('Volta online: pendências sobem', server.db.consultas.length === 2 && await p.evaluate(() => Store.pendingCount()) === 0);
// exclusão lógica propaga
const cid = await p.evaluate(() => L('consultas')[0].id);
await p.evaluate(id => Store.remove('consultas', id), cid); await sync(p);
rec('Exclusão vira deleted_at no servidor', !!server.db.consultas.find(c => c.id === cid).deleted_at);

// ---------- aparelho 2: mesma conta ----------
const A2 = await device(); const q = A2.page;
await q.fill('#li-email', 'bia@ex.com'); await q.fill('#li-pass', 'segura123'); await q.click('#li-btn');
await q.waitForSelector('#main:not(.hidden)');
const d2 = await q.evaluate(() => ({ c: L('consultas').length, e: L('exames').length, u: L('ultrassons').length, plus: Store.isPlus(), sangue: Store.S.profile.tipo_sanguineo, ig: ga().w }));
rec('2º aparelho baixa tudo (consulta excluída não volta)', d2.c === 1 && d2.e === 1 && d2.u === 1 && d2.plus && d2.sangue === 'A+', JSON.stringify(d2));
await q.evaluate(() => { A.recTab = 'eco'; go('record'); });
rec('2º aparelho baixa a foto do Storage', await q.waitForSelector('img.thumb[src^="blob:"]', { timeout: 3000 }).then(() => true).catch(() => false));
await q.evaluate(() => { modalVacina('influenza'); }); await q.click('.modal button:has-text("Salvar")'); await sync(q); await sync(p);
rec('Registro feito no 2º aparelho aparece no 1º', await p.evaluate(() => L('vacinas').some(v => v.codigo === 'influenza')));
// checkout
const url = await q.evaluate(() => Store.backend.checkout('mensal'));
rec('Checkout devolve link https do Mercado Pago', /^https:\/\/www\.mercadopago\.com\.br\//.test(url));
// sair limpa o aparelho
await q.evaluate(() => Store.signOut()); await q.waitForSelector('#li-email');
const left = await q.evaluate(async () => { const keys = []; await new Promise(r => { const rq = indexedDB.open('ninho'); rq.onsuccess = () => { const t = rq.result.transaction('kv').objectStore('kv').getAllKeys(); t.onsuccess = () => { keys.push(...t.result); r(); }; }; }); return keys.length; });
rec('Sair apaga o cache do aparelho', left === 0);
// excluir conta
await p.evaluate(() => Store.deleteAccount()); await p.waitForSelector('#li-email');
rec('Excluir conta remove dados do servidor e do Storage', server.db.consultas.length === 0 && server.db.profiles.length === 0 && Object.keys(server.db.storage).length === 0);
rec('Sem erros de JavaScript', p._err.length === 0 && q._err.length === 0, [...p._err, ...q._err].slice(0, 4).join(' | '));
await browser.close();
fs.writeFileSync(path.join(DIR, 'result-supabase.json'), JSON.stringify(R, null, 2));
const f = R.filter(r => !r.ok); console.log(`\n${R.length} verificações · ${R.length - f.length} OK · ${f.length} falhas`); process.exit(f.length ? 1 : 0);
