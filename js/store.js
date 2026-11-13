/* =====================================================================
   NINHO — camada de dados (offline-first)
   * Cache local em IndexedDB (sem o limite de ~5 MB do localStorage)
   * Backend Supabase (Auth + Postgres com RLS + Storage privado)
   * Backend LOCAL para desenvolvimento/testes quando não há Supabase
   * Sincronização incremental por updated_at, exclusão lógica (deleted_at)
   ===================================================================== */
(function (g) {
  'use strict';
  const CFG = g.NINHO_CONFIG || {};
  const uuid = () => (g.crypto && crypto.randomUUID) ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); });
  const nowISO = () => new Date().toISOString();

  /* ---------------- IndexedDB (com fallback em memória) ---------------- */
  const IDB = {
    db: null, mem: { kv: new Map(), files: new Map() },
    open() {
      if (this._p) return this._p;
      this._p = new Promise(res => {
        try {
          const rq = indexedDB.open('ninho', 1);
          rq.onupgradeneeded = () => { rq.result.createObjectStore('kv'); rq.result.createObjectStore('files'); };
          rq.onsuccess = () => { this.db = rq.result; res(); };
          rq.onerror = () => res();
        } catch (e) { res(); }
      });
      return this._p;
    },
    async tx(store, mode, fn) {
      await this.open();
      if (!this.db) return fn(null, this.mem[store]);
      return new Promise((res, rej) => {
        const t = this.db.transaction(store, mode), s = t.objectStore(store); let out;
        Promise.resolve(fn(s)).then(r => { out = r; });
        t.oncomplete = () => res(out); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
      });
    },
    get(store, k) { return this.tx(store, 'readonly', (s, m) => m ? m.get(k) : new Promise(r => { const q = s.get(k); q.onsuccess = () => r(q.result); })); },
    set(store, k, v) { return this.tx(store, 'readwrite', (s, m) => m ? m.set(k, v) : s.put(v, k)); },
    del(store, k) { return this.tx(store, 'readwrite', (s, m) => m ? m.delete(k) : s.delete(k)); },
    async clearPrefix(store, prefix) {
      await this.open();
      if (!this.db) { for (const k of [...this.mem[store].keys()]) if (String(k).startsWith(prefix)) this.mem[store].delete(k); return; }
      return this.tx(store, 'readwrite', s => new Promise(r => {
        const q = s.openCursor(); q.onsuccess = () => { const c = q.result; if (!c) return r(); if (String(c.key).startsWith(prefix)) c.delete(); c.continue(); };
      }));
    },
  };

  /* ---------------- Tabelas e colunas (espelham as migrations) ---------------- */
  const BASE = ['id', 'user_id', 'gestacao_id', 'created_at', 'updated_at', 'deleted_at'];
  const TABLES = {
    consultas: { plus: false, cols: ['data', 'ig_semanas', 'ig_dias', 'local', 'profissional', 'pa_sis', 'pa_dia', 'peso_kg', 'altura_uterina_cm', 'bcf_bpm', 'movimentos_fetais', 'apresentacao', 'edema', 'queixas_urinarias', 'perdas_vaginais', 'observacoes', 'proxima_consulta'] },
    vacinas: { plus: false, cols: ['codigo', 'dose', 'data_aplicacao', 'lote', 'local'] },
    movimentos: { plus: false, cols: ['inicio', 'duracao_min', 'contagem'] },
    exames: { plus: true, cols: ['data', 'codigo', 'nome', 'valor_num', 'valor_txt', 'unidade', 'arquivo_path', 'observacoes'] },
    ultrassons: { plus: true, cols: ['data', 'tipo', 'ig_usg_semanas', 'ig_usg_dias', 'bcf_bpm', 'peso_fetal_g', 'percentil', 'placenta', 'liquido', 'observacoes', 'arquivo_path'] },
    monitores: { plus: true, cols: ['nome', 'unidade', 'minimo', 'maximo'] },
    medicoes: { plus: true, cols: ['tipo', 'monitor_id', 'medido_em', 'sis', 'dia', 'valor', 'momento', 'nota'] },
    sintomas: { plus: true, cols: ['registrado_em', 'nome', 'emoji', 'intensidade', 'nota'] },
    medicamentos: { plus: true, cols: ['nome', 'dose', 'horarios', 'ativo'] },
    doses: { plus: true, cols: ['medicamento_id', 'data', 'horario', 'tomada'] },
    notas: { plus: true, cols: ['texto', 'resolvida'] },
    memorias: { plus: true, cols: ['tipo', 'titulo', 'semana', 'texto', 'arquivo_path'] },
  };
  const ORDER = ['consultas', 'vacinas', 'movimentos', 'exames', 'ultrassons', 'monitores', 'medicoes', 'sintomas', 'medicamentos', 'doses', 'notas', 'memorias'];
  const GEST_COLS = ['id', 'user_id', 'ativa', 'nome_bebe', 'metodo_ig', 'dum', 'usg_data', 'usg_ig_semanas', 'usg_ig_dias', 'dpp_informada', 'dpp', 'tipo_gravidez', 'planejada', 'gesta', 'para', 'abortos', 'risco', 'altura_cm', 'peso_pre_kg', 'antecedentes', 'plano_parto', 'desfecho', 'created_at', 'updated_at', 'deleted_at'];
  const PROFILE_COLS = ['nome_completo', 'nome_social', 'data_nascimento', 'telefone', 'cpf', 'cns', 'raca_cor', 'escolaridade', 'ocupacao', 'estado_civil', 'municipio', 'uf', 'ubs_referencia', 'maternidade_referencia', 'contato_emergencia_nome', 'contato_emergencia_tel', 'contato_emergencia_relacao', 'tipo_sanguineo', 'doenca_falciforme', 'deficiencia', 'alergias', 'condicoes', 'medicamentos_uso', 'preferencias', 'gamificacao'];
  const ARRAYS = new Set(['alergias', 'condicoes', 'medicamentos_uso', 'horarios']);
  const JSONS = new Set(['preferencias', 'gamificacao', 'antecedentes', 'plano_parto', 'desfecho']);

  function clean(rec, cols) {   // só colunas conhecidas; '' vira null
    const o = {};
    for (const c of cols) if (c in rec) { const v = rec[c]; o[c] = (v === '' || v === undefined) ? null : v; }
    for (const c of cols) if (ARRAYS.has(c) && o[c] == null && c in rec) o[c] = [];
    return o;
  }

  /* ---------------- Mensagens de erro de autenticação em português ---------------- */
  function authMsg(e) {
    const m = String((e && (e.message || e.error_description)) || e || '');
    if (/invalid login credentials/i.test(m)) return 'E-mail ou senha incorretos.';
    if (/email not confirmed/i.test(m)) return 'Confirme seu e-mail pelo link que enviamos antes de entrar.';
    if (/already registered|already exists/i.test(m)) return 'Já existe uma conta com este e-mail. Tente entrar ou recuperar a senha.';
    if (/password.*(6|8|short|weak)/i.test(m)) return 'A senha precisa ter pelo menos 8 caracteres, com letras e números.';
    if (/rate limit|too many/i.test(m)) return 'Muitas tentativas. Aguarde alguns minutos e tente de novo.';
    if (/fetch|network/i.test(m)) return 'Sem conexão com o servidor. Verifique sua internet.';
    return m || 'Não foi possível concluir. Tente novamente.';
  }

  /* localStorage pode faltar ou lançar erro (modo privado, iframe isolado): usa memória como reserva */
  const LS = (() => { const m = {}; return {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return k in m ? m[k] : null; } },
    set(k, v) { m[k] = String(v); try { localStorage.setItem(k, v); } catch (e) { } },
    del(k) { delete m[k]; try { localStorage.removeItem(k); } catch (e) { } } }; })();

  /* =====================================================================
     Backend LOCAL (sem servidor) — desenvolvimento, testes e demonstração
     ===================================================================== */
  async function pbkdf2(pass, salt) {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: enc.encode(salt), iterations: 120000, hash: 'SHA-256' }, key, 256);
    return [...new Uint8Array(bits)].map(b => b.toString(16).padStart(2, '0')).join('');
  }
  class LocalBackend {
    constructor() { this.mode = 'local'; this.remote = false; }
    _acc() { try { return JSON.parse(LS.get('ninho.local.accounts')) || {}; } catch (e) { return {}; } }
    _saveAcc(a) { LS.set('ninho.local.accounts', JSON.stringify(a)); }
    async getSession() { try { const s = JSON.parse(LS.get('ninho.local.session')); return s ? { user: s } : null; } catch (e) { return null; } }
    async signUp({ email, password, meta }) {
      email = email.trim().toLowerCase(); const a = this._acc();
      if (a[email]) throw new Error(authMsg('already registered'));
      const id = uuid(), salt = uuid();
      a[email] = { id, salt, hash: await pbkdf2(password, salt), meta, created_at: nowISO() }; this._saveAcc(a);
      const user = { id, email, user_metadata: meta }; LS.set('ninho.local.session', JSON.stringify(user));
      return { user, needsConfirm: false };
    }
    async signIn({ email, password }) {
      email = email.trim().toLowerCase(); const r = this._acc()[email];
      if (!r || r.hash !== await pbkdf2(password, r.salt)) throw new Error(authMsg('Invalid login credentials'));
      const user = { id: r.id, email, user_metadata: r.meta }; LS.set('ninho.local.session', JSON.stringify(user)); return { user };
    }
    async signOut() { LS.del('ninho.local.session'); }
    async resetPassword() { return { ok: false, msg: 'No modo local não há envio de e-mail. Crie uma nova conta de teste.' }; }
    async updatePassword() { }
    async plan(uid) { return { plano: LS.get('ninho.local.plan.' + uid) === 'plus' ? 'plus' : 'free', status: 'active' }; }
    async setDemoPlan(uid, p) { LS.set('ninho.local.plan.' + uid, p); }
    async recordConsents() { }
    async deleteAccount(uid, email) { const a = this._acc(); delete a[email]; this._saveAcc(a); LS.del('ninho.local.plan.' + uid); LS.del('ninho.local.session'); return { ok: true }; }
    onAuth() { }
  }

  /* =====================================================================
     Backend SUPABASE
     ===================================================================== */
  class SupabaseBackend {
    constructor(url, key) {
      this.mode = 'supabase'; this.remote = true;
      this.sb = g.supabase.createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'ninho.auth' } });
    }
    onAuth(cb) { this.sb.auth.onAuthStateChange((ev, session) => cb(ev, session)); }
    async getSession() { const { data } = await this.sb.auth.getSession(); return data.session ? { user: data.session.user } : null; }
    async signUp({ email, password, meta }) {
      const { data, error } = await this.sb.auth.signUp({ email: email.trim().toLowerCase(), password, options: { data: meta, emailRedirectTo: location.origin + location.pathname } });
      if (error) throw new Error(authMsg(error));
      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) throw new Error(authMsg('already registered'));
      return { user: data.user, needsConfirm: !data.session };
    }
    async signIn({ email, password }) {
      const { data, error } = await this.sb.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
      if (error) throw new Error(authMsg(error)); return { user: data.user };
    }
    async signOut() { await this.sb.auth.signOut(); }
    async resetPassword(email) {
      const { error } = await this.sb.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: location.origin + location.pathname });
      if (error) throw new Error(authMsg(error)); return { ok: true, msg: 'Se houver uma conta com este e-mail, enviamos um link para criar nova senha.' };
    }
    async updatePassword(p) { const { error } = await this.sb.auth.updateUser({ password: p }); if (error) throw new Error(authMsg(error)); }
    async plan() { const { data, error } = await this.sb.rpc('meu_plano'); if (error) throw error; return data || { plano: 'free' }; }
    async pullProfile(uid) { const { data, error } = await this.sb.from('profiles').select('*').eq('id', uid).maybeSingle(); if (error) throw error; return data; }
    async pullConsents() { const { data, error } = await this.sb.from('consentimentos').select('tipo,versao,aceito,registrado_em,origem').order('registrado_em', { ascending: true }); if (error) throw error; return data; }
    async pushProfile(uid, patch) { const { error } = await this.sb.from('profiles').update(patch).eq('id', uid); if (error) throw error; }
    async pull(table, since) {
      const out = []; let from = 0;
      for (; ;) {
        const { data, error } = await this.sb.from(table).select('*').gt('updated_at', since || '1970-01-01T00:00:00Z').order('updated_at', { ascending: true }).range(from, from + 999);
        if (error) throw error; out.push(...(data || [])); if (!data || data.length < 1000) break; from += 1000;
      }
      return out;
    }
    async push(table, rows) { const { error } = await this.sb.from(table).upsert(rows, { onConflict: 'id' }); if (error) throw error; }
    async recordConsents(list) { if (!list.length) return; const { error } = await this.sb.from('consentimentos').insert(list); if (error) throw error; }
    async upload(path, blob) { const { error } = await this.sb.storage.from('ninho').upload(path, blob, { upsert: true, contentType: blob.type || 'image/jpeg' }); if (error) throw error; }
    async download(path) { const { data, error } = await this.sb.storage.from('ninho').download(path); if (error) throw error; return data; }
    async removeFile(path) { await this.sb.storage.from('ninho').remove([path]); }
    async deleteAccount() { const { data, error } = await this.sb.functions.invoke('delete-account', { body: { confirmacao: 'EXCLUIR' } }); if (error) throw error; return data; }
    async checkout(ciclo) { const { data, error } = await this.sb.functions.invoke('create-checkout', { body: { ciclo } }); if (error) throw error; return data.url; }
    async savePush(sub) {
      const j = sub.toJSON();
      const { error } = await this.sb.from('push_subscriptions').upsert({ endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, user_agent: navigator.userAgent.slice(0, 200) }, { onConflict: 'endpoint' });
      if (error) throw error;
    }
    async replaceReminders(list) {
      const { error: e1 } = await this.sb.from('lembretes').delete().is('enviado_em', null).gt('enviar_em', nowISO());
      if (e1) throw e1;
      if (list.length) { const { error } = await this.sb.from('lembretes').upsert(list, { onConflict: 'user_id,chave', ignoreDuplicates: true }); if (error) throw error; }
    }
  }

  /* =====================================================================
     STORE
     ===================================================================== */
  const blankState = (uid, email) => ({
    v: 2, uid, email, profile: { id: uid, nome_completo: '', alergias: [], condicoes: [], medicamentos_uso: [], preferencias: {}, gamificacao: {} },
    gestacao: null, t: Object.fromEntries(ORDER.map(k => [k, []])), consents: [],
    meta: { lastPull: {}, plan: 'free', pendingConsents: [], lastSync: null, syncError: null },
  });

  const listeners = new Set();
  const Store = {
    S: null, backend: null, TABLES, ORDER, uuid, IDB, authMsg,
    on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    emit(ev, d) { listeners.forEach(f => { try { f(ev, d); } catch (e) { console.error(e); } }); },

    pickBackend() {
      if (CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY) {
        // configurado para produção: nunca cair silenciosamente no modo local
        if (!(g.supabase && g.supabase.createClient)) throw Object.assign(new Error('Não foi possível carregar o Ninho. Verifique sua conexão e tente de novo.'), { code: 'LIB' });
        return new SupabaseBackend(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY);
      }
      return new LocalBackend();
    },
    async boot() {
      this.backend = this.pickBackend();
      this.backend.onAuth((ev, session) => {
        if (ev === 'PASSWORD_RECOVERY') { this.recovery = true; this.emit('recovery'); }
        if (ev === 'SIGNED_OUT') this.emit('signedout');
      });
      const s = await this.backend.getSession();
      if (s && s.user) await this.loadUser(s.user);
      return !!this.S;
    },
    async loadUser(user) {
      const cached = await IDB.get('kv', 'state:' + user.id);
      this.S = cached && cached.v === 2 ? cached : blankState(user.id, user.email);
      this.S.email = user.email || this.S.email;
      for (const k of ORDER) this.S.t[k] = this.S.t[k] || [];
      // no modo local, dados do cadastro (user_metadata) entram no perfil
      const m = user.user_metadata || {};
      if (!this.S.profile.nome_completo && m.nome_completo) Object.assign(this.S.profile, { nome_completo: m.nome_completo, data_nascimento: m.data_nascimento || null, telefone: m.telefone || null });
      if (this.backend.mode === 'local' && m.consentimentos && !this.S.consents.length) this.S.consents = m.consentimentos.map(c => ({ ...c, registrado_em: nowISO(), origem: 'cadastro' }));
      await this.refreshPlan();
      this.persistNow();
      if (this.backend.remote) await this.sync().catch(() => { });
    },
    async refreshPlan() {
      try { const p = await this.backend.plan(this.S.uid); const was = this.S.meta.plan; this.S.meta.plan = p.plano === 'plus' ? 'plus' : 'free'; this.S.meta.planInfo = p;
        if (was !== this.S.meta.plan) { if (this.S.meta.plan === 'plus') this.unblockAll(); this.emit('plan', this.S.meta.plan); }
      } catch (e) { /* offline: mantém último plano conhecido */ }
    },
    isPlus() { return !!(this.S && this.S.meta.plan === 'plus'); },
    can(feature) { const r = (CFG.RECURSOS || {})[feature]; return r !== 'plus' || this.isPlus(); },

    /* ---------- persistência local ---------- */
    persist() { clearTimeout(this._pt); this._pt = setTimeout(() => this.persistNow(), 250); },
    persistNow() { if (!this.S) return Promise.resolve(); clearTimeout(this._pt); return IDB.set('kv', 'state:' + this.S.uid, this.S).catch(e => console.error('persist', e)); },

    /* ---------- leitura ---------- */
    list(t) { return ((this.S && this.S.t[t]) || []).filter(r => !r.deleted_at && (!this.S.gestacao || !r.gestacao_id || r.gestacao_id === this.S.gestacao.id)); },
    get(t, id) { return ((this.S && this.S.t[t]) || []).find(r => r.id === id); },
    get prefs() { return this.S.profile.preferencias || (this.S.profile.preferencias = {}); },
    get game() { return this.S.profile.gamificacao || (this.S.profile.gamificacao = {}); },

    /* ---------- escrita ---------- */
    upsert(t, rec) {
      if (!TABLES[t]) throw new Error('tabela desconhecida ' + t);
      if (TABLES[t].plus && !this.isPlus() && !rec.deleted_at) throw Object.assign(new Error('Recurso do Ninho+'), { code: 'PLUS' });
      if (!this.S.gestacao) throw new Error('Cadastre a gestação primeiro');
      const arr = this.S.t[t]; const now = nowISO();
      const i = rec.id ? arr.findIndex(r => r.id === rec.id) : -1;
      const base = i >= 0 ? arr[i] : { id: uuid(), created_at: now, user_id: this.S.uid, gestacao_id: this.S.gestacao.id };
      const r = Object.assign({}, base, rec, { updated_at: now, _dirty: true });
      if (i >= 0) arr[i] = r; else arr.push(r);
      this.changed(); return r;
    },
    remove(t, id) {
      const r = this.get(t, id); if (!r) return;
      Object.assign(r, { deleted_at: nowISO(), updated_at: nowISO(), _dirty: true });
      if (r.arquivo_path) { IDB.del('files', r.arquivo_path); if (this.backend.remote) this.backend.removeFile(r.arquivo_path).catch(() => { }); }
      this.changed();
    },
    patchProfile(patch) { Object.assign(this.S.profile, patch, { _dirty: true }); this.changed(); },
    patchPrefs(patch) { this.S.profile.preferencias = Object.assign({}, this.prefs, patch); this.S.profile._dirty = true; this.changed(); },
    patchGame(patch) { this.S.profile.gamificacao = Object.assign({}, this.game, patch); this.S.profile._dirty = true; this.changed(); },
    setGestacao(data) {
      const now = nowISO(); const cur = this.S.gestacao;
      this.S.gestacao = Object.assign(cur || { id: uuid(), user_id: this.S.uid, created_at: now, ativa: true, antecedentes: {}, plano_parto: {} }, data, { updated_at: now, _dirty: true });
      this.changed(); return this.S.gestacao;
    },
    changed() { this.persist(); this.emit('change'); this.scheduleSync(); },
    addConsents(list) { const rows = list.map(c => ({ ...c, origem: c.origem || 'configuracoes', registrado_em: nowISO() })); this.S.consents.push(...rows); this.S.meta.pendingConsents.push(...rows); this.changed(); },
    consentOf(tipo) { const l = this.S.consents.filter(c => c.tipo === tipo); return l.length ? l[l.length - 1] : null; },

    /* ---------- arquivos (fotos) ---------- */
    async compressImage(file, max = 1280, q = 0.82) {
      try {
        const bmp = await createImageBitmap(file); const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
        const c = document.createElement('canvas'); c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
        c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
        return await new Promise(r => c.toBlob(b => r(b || file), 'image/jpeg', q));
      } catch (e) { return file; }
    },
    async attachImage(t, rec, file) {
      if (!this.can('fotos')) throw Object.assign(new Error('Recurso do Ninho+'), { code: 'PLUS' });
      const blob = await this.compressImage(file); const path = `${this.S.uid}/${t}/${rec.id}.jpg`;
      await IDB.set('files', path, blob);
      return this.upsert(t, { id: rec.id, arquivo_path: path, _upload: true });
    },
    _urls: new Map(),
    async imageURL(path) {
      if (!path) return null; if (this._urls.has(path)) return this._urls.get(path);
      let blob = await IDB.get('files', path).catch(() => null);
      if (!blob && this.backend.remote) { try { blob = await this.backend.download(path); await IDB.set('files', path, blob); } catch (e) { return null; } }
      if (!blob) return null; const u = URL.createObjectURL(blob); this._urls.set(path, u); return u;
    },

    /* ---------- sincronização ---------- */
    scheduleSync() { if (!this.backend || !this.backend.remote) return; clearTimeout(this._st); this._st = setTimeout(() => this.sync().catch(() => { }), 1500); },
    unblockAll() { for (const k of ORDER) for (const r of this.S.t[k]) if (r._blocked) { delete r._blocked; r._dirty = true; } this.scheduleSync(); },
    async sync() {
      const b = this.backend; if (!b || !b.remote || !this.S) return;
      if (this._syncing) return this._syncing;
      if (typeof navigator !== 'undefined' && navigator.onLine === false) { this.S.meta.syncError = 'offline'; this.emit('sync', 'offline'); return; }
      this._syncing = (async () => {
        const S = this.S; let err = null;
        try {
          // 1) consentimentos pendentes
          if (S.meta.pendingConsents.length) { const p = S.meta.pendingConsents.map(({ tipo, versao, aceito, origem }) => ({ tipo, versao, aceito, origem })); await b.recordConsents(p); S.meta.pendingConsents = []; }
          // 2) perfil
          if (S.profile._dirty) { const pp = clean(S.profile, PROFILE_COLS); if (!pp.nome_completo) delete pp.nome_completo; await b.pushProfile(S.uid, pp); delete S.profile._dirty; }
          // 3) gestação antes das filhas
          if (S.gestacao && S.gestacao._dirty) { await b.push('gestacoes', [clean(S.gestacao, GEST_COLS)]); delete S.gestacao._dirty; }
          // 4) arquivos pendentes e registros
          for (const t of ORDER) {
            const rows = S.t[t].filter(r => r._dirty && !r._blocked); if (!rows.length) continue;
            for (const r of rows.filter(r => r._upload && !r.deleted_at)) {
              const blob = await IDB.get('files', r.arquivo_path).catch(() => null);
              if (blob) { try { await b.upload(r.arquivo_path, blob); delete r._upload; } catch (e) { r.arquivo_path = null; delete r._upload; } }
            }
            try { await b.push(t, rows.map(r => clean(r, BASE.concat(TABLES[t].cols)))); rows.forEach(r => delete r._dirty); }
            catch (e) {
              if (e && (e.code === '42501' || /row-level security|permission/i.test(e.message || ''))) rows.forEach(r => { r._blocked = true; });
              else throw e;
            }
          }
          // 5) pull incremental
          const cons = await b.pullConsents();
          if (cons) S.consents = cons.concat(S.meta.pendingConsents);
          const prof = await b.pullProfile(S.uid);
          if (prof && !S.profile._dirty) S.profile = Object.assign({}, prof, { preferencias: prof.preferencias || {}, gamificacao: prof.gamificacao || {} });
          const gs = await b.pull('gestacoes', S.meta.lastPull.gestacoes);
          for (const gst of gs) {
            S.meta.lastPull.gestacoes = gst.updated_at;
            if (gst.ativa && !gst.deleted_at && (!S.gestacao || !S.gestacao._dirty || S.gestacao.id !== gst.id)) S.gestacao = gst;
            else if (S.gestacao && S.gestacao.id === gst.id && (gst.deleted_at || !gst.ativa)) S.gestacao = null;
          }
          for (const t of ORDER) {
            const rows = await b.pull(t, S.meta.lastPull[t]); const arr = S.t[t];
            for (const r of rows) {
              S.meta.lastPull[t] = r.updated_at;
              const i = arr.findIndex(x => x.id === r.id);
              if (i < 0) arr.push(r); else if (!arr[i]._dirty) arr[i] = Object.assign(r, arr[i]._upload ? { _upload: true } : {});
            }
          }
          await this.refreshPlan();
          S.meta.lastSync = nowISO(); S.meta.syncError = null;
        } catch (e) { err = e; S.meta.syncError = (e && e.message) || String(e); console.warn('sync', e); }
        await this.persistNow(); this.emit('sync', err ? 'erro' : 'ok');
        if (err) throw err;
      })();
      try { return await this._syncing; } finally { this._syncing = null; }
    },
    pendingCount() { if (!this.S) return 0; let n = this.S.profile._dirty ? 1 : 0; if (this.S.gestacao && this.S.gestacao._dirty) n++; for (const t of ORDER) n += this.S.t[t].filter(r => r._dirty && !r._blocked).length; return n; },
    blockedCount() { if (!this.S) return 0; let n = 0; for (const t of ORDER) n += this.S.t[t].filter(r => r._blocked).length; return n; },

    /* ---------- conta ---------- */
    async signUp(payload) { const r = await this.backend.signUp(payload); if (!r.needsConfirm && r.user) await this.loadUser(r.user); return r; },
    async signIn(payload) { const r = await this.backend.signIn(payload); await this.loadUser(r.user); return r; },
    async signOut({ wipe = true } = {}) {
      if (this.S && this.backend.remote) { try { await this.sync(); } catch (e) { } }
      const uid = this.S && this.S.uid;
      await this.backend.signOut();
      if (wipe && uid && this.backend.remote) { await IDB.del('kv', 'state:' + uid); await IDB.clearPrefix('files', uid + '/'); }
      this.S = null; this.emit('signedout');
    },
    async deleteAccount() {
      const { uid, email } = this.S;
      await this.backend.deleteAccount(uid, email);
      await IDB.del('kv', 'state:' + uid); await IDB.clearPrefix('files', uid + '/');
      try { await this.backend.signOut(); } catch (e) { }
      this.S = null; this.emit('signedout');
    },

    /* ---------- portabilidade (LGPD art. 18, V) ---------- */
    exportAll() {
      const S = this.S, strip = o => Object.fromEntries(Object.entries(o).filter(([k]) => !k.startsWith('_')));
      return {
        formato: 'ninho-export', versao: 2, exportado_em: nowISO(), conta: { email: S.email },
        identificacao: strip(S.profile), gestacao: S.gestacao && strip(S.gestacao), consentimentos: S.consents,
        registros: Object.fromEntries(ORDER.map(t => [t, S.t[t].filter(r => !r.deleted_at).map(strip)])),
      };
    },
    importExport(data) {
      if (!data || data.formato !== 'ninho-export') throw new Error('Arquivo não reconhecido');
      if (!this.S.gestacao && data.gestacao) this.setGestacao(Object.assign({}, data.gestacao, { id: uuid(), user_id: this.S.uid }));
      let n = 0, pulados = 0;
      const idmap = {};
      for (const t of ORDER) for (const r of (data.registros && data.registros[t]) || []) {
        if (TABLES[t].plus && !this.isPlus()) { pulados++; continue; }
        const nid = uuid(); idmap[r.id] = nid;
        const rec = Object.assign({}, r, { id: nid, user_id: this.S.uid, gestacao_id: this.S.gestacao.id, arquivo_path: null });
        if (rec.medicamento_id) rec.medicamento_id = idmap[rec.medicamento_id] || rec.medicamento_id;
        if (rec.monitor_id) rec.monitor_id = idmap[rec.monitor_id] || rec.monitor_id;
        this.S.t[t].push(Object.assign(rec, { updated_at: nowISO(), _dirty: true })); n++;
      }
      this.changed(); return { importados: n, pulados };
    },
  };

  g.Store = Store; g.NinhoInternals = { LocalBackend, SupabaseBackend, clean, TABLES, GEST_COLS, PROFILE_COLS };
})(window);
