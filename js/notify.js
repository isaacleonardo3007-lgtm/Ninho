/* =====================================================================
   NINHO — lembretes e notificações
   1) compute(): gera os lembretes dos próximos 7 dias a partir dos dados
   2) Com o app aberto: agenda notificações locais (Service Worker)
   3) Com Supabase + VAPID: grava a fila "lembretes" no servidor e assina o
      Web Push, para chegar mesmo com o app fechado (send-reminders + pg_cron)
   Privacidade: por padrão o texto da notificação NÃO mostra dados de saúde
   (aparece na tela de bloqueio). A usuária pode ativar os detalhes.
   ===================================================================== */
(function (g) {
  'use strict';
  const C = g.Clin, DAY = 86400000;
  const TIPOS = {
    consulta: { nome: 'Consultas de pré-natal', plano: 'free', padrao: true, ic: '🩺' },
    semana: { nome: 'Nova semana da gestação', plano: 'free', padrao: true, ic: '🌱' },
    vacina: { nome: 'Vacinas da gestação', plano: 'free', padrao: true, ic: '💉' },
    exame: { nome: 'Exames da fase', plano: 'free', padrao: true, ic: '🧪' },
    movimentos: { nome: 'Contar movimentos (a partir de 28 sem)', plano: 'free', padrao: true, ic: '👶' },
    medicacao: { nome: 'Medicamentos', plano: 'plus', padrao: true, ic: '💊' },
    medicao: { nome: 'Medições em casa (pressão, glicemia)', plano: 'plus', padrao: true, ic: '🏠' },
  };
  const GENERICO = { consulta: 'Você tem um lembrete de consulta', semana: 'Uma nova semana começou 💜', vacina: 'Confira suas vacinas', exame: 'Confira os exames desta fase', movimentos: 'Hora de perceber os movimentos do bebê', medicacao: 'Hora do seu lembrete 💜', medicao: 'Hora da sua medição' };

  function at(dateISO, hhmm) { const [h, m] = (hhmm || '09:00').split(':').map(Number); const d = C.parseDate(dateISO); d.setHours(h, m, 0, 0); return d; }
  function quiet(prefs, d) {
    const [a, b] = (prefs.silencio || ['22:00', '07:00']).map(x => { const [h, m] = x.split(':').map(Number); return h * 60 + m; });
    const t = d.getHours() * 60 + d.getMinutes(); return a > b ? (t >= a || t < b) : (t >= a && t < b);
  }

  /** ctx: { gest, ga, list(t), plus, prefs, now } → [{chave,tipo,quando:Date,titulo,corpo,url}] */
  function compute(ctx) {
    const { gest, list, plus, prefs = {}, now = new Date() } = ctx; if (!gest) return [];
    const on = t => (prefs.notif || {})[t] !== false && (TIPOS[t].plano === 'free' || plus);
    const privado = prefs.notifPrivada !== false;
    const hoje = C.toISODate(now), fim = new Date(now.getTime() + 7 * DAY), out = [];
    const push = (tipo, chave, quando, titulo, corpo, url = '/', respeitaSilencio = true) => {
      if (!on(tipo) || quando <= now || quando > fim) return;
      if (respeitaSilencio && quiet(prefs, quando)) return;
      out.push({ chave, tipo, quando, titulo: privado ? 'Ninho' : titulo, corpo: privado ? GENERICO[tipo] : corpo, url });
    };
    const ga = C.gaFrom(gest, hoje); if (!ga.ok) return [];
    // consulta: véspera 19h e dia 8h
    const prox = list('consultas').map(c => c.proxima_consulta).filter(d => d && d >= hoje).sort()[0];
    if (prox) {
      push('consulta', 'consulta:' + prox + ':vespera', at(C.addDays(prox, -1), '19:00'), 'Consulta amanhã', 'Amanhã é dia de pré-natal. Leve sua caderneta, documentos e suas dúvidas.', '/#record');
      push('consulta', 'consulta:' + prox + ':dia', at(prox, '08:00'), 'Consulta hoje', 'Hoje é dia de consulta de pré-natal 💜', '/#record');
    }
    // nova semana (no dia em que completa a semana, 9h)
    for (let i = 0; i <= 7; i++) {
      const d = C.addDays(hoje, i), gw = C.gaFrom(gest, d);
      if (gw.d === 0 && gw.w >= 4 && gw.w <= 42) push('semana', 'semana:' + gw.w, at(d, '09:00'), `Semana ${gw.w}`, `Você chegou a ${gw.w} semanas! Veja o que muda nesta fase.`, '/#home');
      // vacinas e exames por janela
      if (gw.w === 20 && gw.d === 0 && !list('vacinas').some(v => v.codigo === 'dtpa')) push('vacina', 'vacina:dtpa', at(d, '10:00'), 'Vacina dTpa', 'A partir de hoje (20 semanas) você já pode tomar a dTpa na UBS.', '/#timeline');
      if (gw.w === 28 && gw.d === 0 && !list('vacinas').some(v => v.codigo === 'vsr')) push('vacina', 'vacina:vsr', at(d, '10:00'), 'Vacina VSR', 'Com 28 semanas você já pode tomar a vacina contra o VSR no SUS.', '/#timeline');
      if (gw.w === 24 && gw.d === 0) push('exame', 'exame:totg', at(d, '10:00'), 'TOTG 75 g', 'Entre 24 e 28 semanas é a hora do teste de tolerância à glicose. Peça à sua equipe.', '/#timeline');
      if (gw.w === 28 && gw.d === 0) push('exame', 'exame:tri3', at(d, '10:15'), 'Exames do 3º trimestre', 'Começou o 3º trimestre: hemograma, glicemia, sífilis, HIV e urina. Confira na Jornada.', '/#timeline');
      // movimentos: diário a partir de 28 semanas
      if (gw.w >= C.MOV.desde) push('movimentos', 'mov:' + d, at(d, prefs.horaMovimentos || '19:00'), 'Movimentos do bebê', 'Separe um momento, deite de lado e perceba os movimentos do bebê.', '/#record', false);
      // medicação (horários escolhidos pela usuária: ignora silêncio)
      list('medicamentos').filter(m => m.ativo !== false).forEach(m => (m.horarios || []).forEach(hh => {
        const tomada = list('doses').some(x => x.medicamento_id === m.id && x.data === d && x.horario === hh && x.tomada);
        if (!tomada) push('medicacao', `med:${m.id}:${d}T${hh}`, at(d, hh), 'Hora do remédio', `${m.nome}${m.dose ? ' · ' + m.dose : ''} às ${hh}`, '/#home', false);
      }));
      // medições em casa
      const mon = prefs.monitores || {};
      ['pressao', 'glicemia'].filter(k => mon[k] && (mon[k].horarios || []).length).forEach(k => mon[k].horarios.forEach(hh =>
        push('medicao', `medicao:${k}:${d}T${hh}`, at(d, hh), k === 'pressao' ? 'Medir a pressão' : 'Medir a glicemia', k === 'pressao' ? 'Hora de medir e registrar sua pressão.' : 'Hora de medir e registrar sua glicemia.', '/#record', false)));
    }
    return out.sort((x, y) => x.quando - y.quando);
  }

  /* ---------------- entrega ---------------- */
  const timers = [];
  const Notify = {
    TIPOS, compute,
    supported() { return 'Notification' in g && 'serviceWorker' in navigator; },
    permission() { return this.supported() ? Notification.permission : 'unsupported'; },
    async ask() { if (!this.supported()) return 'unsupported'; const p = await Notification.requestPermission(); return p; },
    async show(n) {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) return reg.showNotification(n.titulo, { body: n.corpo, tag: n.chave, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', data: { url: n.url } });
        if (g.Notification && Notification.permission === 'granted') new Notification(n.titulo, { body: n.corpo, tag: n.chave });
      } catch (e) { console.warn('notify', e); }
    },
    /** agenda as notificações das próximas 24 h enquanto o app estiver aberto */
    scheduleLocal(list) {
      timers.splice(0).forEach(clearTimeout);
      if (this.permission() !== 'granted') return 0;
      const lim = Date.now() + DAY; let n = 0;
      for (const r of list) { const ms = r.quando - Date.now(); if (ms > 0 && r.quando <= lim) { timers.push(setTimeout(() => this.show(r), ms)); n++; } }
      return n;
    },
    /** fila no servidor + inscrição Web Push */
    async syncRemote(backend, uid, list) {
      if (!backend || !backend.remote) return { remote: false };
      const out = { remote: true, push: false };
      const key = (g.NINHO_CONFIG || {}).VAPID_PUBLIC_KEY;
      if (key && this.permission() === 'granted' && 'PushManager' in g) {
        try {
          const reg = await navigator.serviceWorker.ready;
          let sub = await reg.pushManager.getSubscription();
          if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToU8(key) });
          await backend.savePush(sub); out.push = true;
        } catch (e) { console.warn('push', e); }
      }
      if (out.push) await backend.replaceReminders(list.map(r => ({ user_id: uid, chave: r.chave, tipo: r.tipo, enviar_em: r.quando.toISOString(), titulo: r.titulo, corpo: r.corpo, url: r.url })));
      return out;
    },
  };
  function b64ToU8(b64) { const p = '='.repeat((4 - b64.length % 4) % 4), s = atob((b64 + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from([...s].map(c => c.charCodeAt(0))); }
  g.Notify = Notify;
})(window);
