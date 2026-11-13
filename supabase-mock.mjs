// "Supabase" falso em memória (lado Node), compartilhado entre vários navegadores
// (aparelhos). Reproduz as regras principais das migrations: RLS por usuária,
// bloqueio de tabelas Plus, updated_at do servidor, trigger de novo usuário.
import crypto from 'crypto';

const PLUS = new Set(['exames', 'ultrassons', 'monitores', 'medicoes', 'sintomas', 'medicamentos', 'doses', 'notas', 'memorias']);
const CHILD = ['consultas', 'vacinas', 'movimentos', ...PLUS];
export function createMockServer() {
  const db = { users: [], profiles: [], gestacoes: [], consentimentos: [], assinaturas: [], lembretes: [], push_subscriptions: [], storage: {} };
  CHILD.forEach(t => (db[t] = []));
  let clock = Date.now();
  const ts = () => new Date(++clock).toISOString();
  const err = (message, code) => ({ error: { message, code } });
  const isPlus = uid => db.assinaturas.some(a => a.user_id === uid && a.plano === 'plus');

  function handle(op, a) {
    const uid = a.uid;
    switch (op) {
      case 'signUp': {
        if (db.users.some(u => u.email === a.email)) return { data: { user: { id: 'x', identities: [] }, session: null } };
        const u = { id: crypto.randomUUID(), email: a.email, pass: a.password, meta: a.meta || {}, confirmed: false };
        db.users.push(u);
        db.profiles.push({ id: u.id, user_id: u.id, nome_completo: u.meta.nome_completo, data_nascimento: u.meta.data_nascimento, telefone: u.meta.telefone, alergias: [], condicoes: [], medicamentos_uso: [], preferencias: {}, gamificacao: {}, updated_at: ts() });
        db.assinaturas.push({ user_id: u.id, plano: 'free', status: 'active' });
        (u.meta.consentimentos || []).forEach(c => db.consentimentos.push({ user_id: u.id, ...c, origem: 'cadastro', registrado_em: ts() }));
        return { data: { user: { id: u.id, email: u.email, identities: [{}], user_metadata: u.meta }, session: null } };
      }
      case 'confirm': { const u = db.users.find(x => x.email === a.email); if (u) u.confirmed = true; return {}; }
      case 'signIn': {
        const u = db.users.find(x => x.email === a.email);
        if (!u || u.pass !== a.password) return err('Invalid login credentials');
        if (!u.confirmed) return err('Email not confirmed');
        return { data: { user: { id: u.id, email: u.email, user_metadata: u.meta }, session: { access_token: u.id, user: { id: u.id, email: u.email, user_metadata: u.meta } } } };
      }
      case 'setPlan': { const s = db.assinaturas.find(x => x.user_id === a.user); s.plano = a.plano; return {}; }
      case 'rpc': if (a.fn === 'meu_plano') return { data: { plano: isPlus(uid) ? 'plus' : 'free', status: 'active' } }; return err('rpc');
      case 'select': {
        if (!uid) return err('permission denied', '42501');
        let rows = (db[a.table] || []).filter(r => (r.user_id || r.id) === uid);
        for (const [k, f, v] of a.filters) rows = rows.filter(r => f === 'eq' ? r[k] === v : f === 'gt' ? r[k] > v : f === 'lt' ? r[k] < v : f === 'lte' ? r[k] <= v : f === 'is' ? (r[k] ?? null) === v : f === 'in' ? v.includes(r[k]) : true);
        if (a.order) rows.sort((x, y) => String(x[a.order]).localeCompare(String(y[a.order])));
        if (a.range) rows = rows.slice(a.range[0], a.range[1] + 1);
        rows = JSON.parse(JSON.stringify(rows));
        return { data: a.single ? (rows[0] || null) : rows };
      }
      case 'upsert': case 'insert': {
        if (!uid) return err('permission denied', '42501');
        const T = db[a.table]; const now = ts();
        for (const r0 of a.rows) {
          const r = { ...r0 }; r.user_id = r.user_id || uid;
          if (a.table === 'consentimentos') { T.push({ ...r, registrado_em: now }); continue; }
          if (r.user_id !== uid) return err('new row violates row-level security policy', '42501');
          if (CHILD.includes(a.table) && !db.gestacoes.some(gg => gg.id === r.gestacao_id && gg.user_id === uid)) return err('new row violates row-level security policy', '42501');
          if (PLUS.has(a.table) && !isPlus(uid) && !r.deleted_at) return err('new row violates row-level security policy for table "' + a.table + '"', '42501');
          if (a.table === 'gestacoes' && r.ativa && !r.deleted_at && T.some(x => x.user_id === uid && x.ativa && !x.deleted_at && x.id !== r.id)) return err('duplicate key value violates unique constraint "gestacoes_uma_ativa"', '23505');
          const key = a.onConflict === 'user_id,chave' ? (x => x.user_id === r.user_id && x.chave === r.chave) : a.onConflict === 'endpoint' ? (x => x.endpoint === r.endpoint) : (x => x.id === r.id);
          const i = T.findIndex(key);
          if (i >= 0) { if (a.ignoreDuplicates) continue; if (T[i].user_id !== uid) return err('rls', '42501'); T[i] = { ...T[i], ...r, created_at: T[i].created_at, updated_at: now }; }
          else T.push({ ...r, id: r.id || crypto.randomUUID(), created_at: r.created_at || now, updated_at: now });
        }
        return { data: null };
      }
      case 'update': {
        if (!uid) return err('permission denied', '42501');
        let n = 0; for (const r of db[a.table]) { if ((r.user_id || r.id) !== uid) continue; if (a.filters.every(([k, f, v]) => f === 'eq' ? r[k] === v : true)) { Object.assign(r, a.patch, { updated_at: ts() }); n++; } }
        return { data: null };
      }
      case 'delete': {
        if (!uid) return err('permission denied', '42501');
        const keep = r => !((r.user_id || r.id) === uid && a.filters.every(([k, f, v]) => f === 'is' ? (r[k] ?? null) === v : f === 'gt' ? r[k] > v : f === 'eq' ? r[k] === v : true));
        db[a.table] = db[a.table].filter(keep); return { data: null };
      }
      case 'upload': {
        if (!uid || a.path.split('/')[0] !== uid) return err('new row violates row-level security policy', '42501');
        if (!isPlus(uid)) return err('new row violates row-level security policy', '42501');
        db.storage[a.path] = a.b64; return { data: { path: a.path } };
      }
      case 'download': { if (a.path.split('/')[0] !== uid || !db.storage[a.path]) return err('not found'); return { data: db.storage[a.path] }; }
      case 'remove': { a.paths.forEach(p => { if (p.split('/')[0] === uid) delete db.storage[p]; }); return { data: null }; }
      case 'fn': {
        if (a.name === 'delete-account') {
          for (const t of Object.keys(db)) if (Array.isArray(db[t])) db[t] = db[t].filter(r => (r.user_id || r.id) !== uid);
          Object.keys(db.storage).filter(p => p.startsWith(uid + '/')).forEach(p => delete db.storage[p]);
          return { data: { ok: true } };
        }
        if (a.name === 'create-checkout') return { data: { url: 'https://www.mercadopago.com.br/subscriptions/checkout?preapproval_id=teste' } };
        return err('fn');
      }
    }
    return err('op ' + op);
  }
  return { db, handle };
}

// cliente que roda NO NAVEGADOR (injetado como window.supabase)
export const BROWSER_CLIENT = `
(function(){
  const call = (op, a) => window.__mock(op, a);
  function createClient(){
    const KEY='ninho.auth'; const listeners=[];
    const sess = () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch(e){ return null; } };
    const uid = () => (sess()||{}).user && sess().user.id;
    function Q(table){ this.t=table; this.f=[]; }
    Q.prototype.select=function(){ this.op=this.op||'select'; return this; };
    ['eq','gt','lt','lte','is','in'].forEach(m => Q.prototype[m]=function(k,v){ this.f.push([k,m,v]); return this; });
    Q.prototype.order=function(c){ this.ord=c; return this; };
    Q.prototype.range=function(a,b){ this.rg=[a,b]; return this; };
    Q.prototype.maybeSingle=function(){ this.single=true; return this; };
    Q.prototype.upsert=function(rows,o={}){ this.op='upsert'; this.rows=[].concat(rows); this.o=o; return this; };
    Q.prototype.insert=function(rows){ this.op='insert'; this.rows=[].concat(rows); this.o={}; return this; };
    Q.prototype.update=function(p){ this.op='update'; this.patch=p; return this; };
    Q.prototype.delete=function(){ this.op='delete'; return this; };
    Q.prototype.then=function(res,rej){
      const a={ uid:uid(), table:this.t, filters:this.f, order:this.ord, range:this.rg, single:this.single, rows:this.rows, onConflict:this.o&&this.o.onConflict, ignoreDuplicates:this.o&&this.o.ignoreDuplicates, patch:this.patch };
      return call(this.op||'select', a).then(r => ({ data: r.data ?? null, error: r.error || null })).then(res, rej);
    };
    const b64 = blob => new Promise(r => { const fr=new FileReader(); fr.onload=()=>r(fr.result); fr.readAsDataURL(blob); });
    return {
      from: t => new Q(t),
      rpc: fn => call('rpc', { fn, uid: uid() }),
      auth: {
        onAuthStateChange: cb => listeners.push(cb),
        getSession: async () => ({ data: { session: sess() } }),
        signUp: async ({ email, password, options }) => call('signUp', { email, password, meta: options && options.data }),
        signInWithPassword: async ({ email, password }) => { const r = await call('signIn', { email, password }); if (r.data) localStorage.setItem(KEY, JSON.stringify(r.data.session)); return { data: r.data || {}, error: r.error || null }; },
        signOut: async () => { localStorage.removeItem(KEY); listeners.forEach(f => f('SIGNED_OUT', null)); return {}; },
        resetPasswordForEmail: async () => ({}), updateUser: async () => ({ data: {} }),
      },
      storage: { from: () => ({
        upload: async (p, blob) => { const r = await call('upload', { uid: uid(), path: p, b64: await b64(blob) }); return { data: r.data, error: r.error || null }; },
        download: async p => { const r = await call('download', { uid: uid(), path: p }); if (r.error) return { error: r.error }; const [h, b] = r.data.split(','); const bin = atob(b); const u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); return { data: new Blob([u8], { type: h.slice(5, h.indexOf(';')) }) }; },
        remove: async paths => call('remove', { uid: uid(), paths }),
      }) },
      functions: { invoke: async (name, o) => { const r = await call('fn', { uid: uid(), name, body: o && o.body }); return { data: r.data, error: r.error || null }; } },
    };
  }
  window.supabase = { createClient };
})();`;
