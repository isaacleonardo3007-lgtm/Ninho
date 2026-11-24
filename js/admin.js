/* =====================================================================
   NINHO — painel de administração (admin.html)
   Fala só com a função "admin" do Supabase, que confere se a conta está em
   privado.admins. Nenhum dado de saúde passa por aqui.
   Sem JavaScript inline (CSP sem 'unsafe-inline'): os botões usam data-act.
   ===================================================================== */
'use strict';
(function () {
  const CFG = window.NINHO_CONFIG || {};
  const $ = id => document.getElementById(id);
  const main = $('adm-main');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = d => d ? new Date(d).toLocaleDateString('pt-BR') : '—';
  const fmtDT = d => d ? new Date(d).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—';
  const n = v => Number(v || 0).toLocaleString('pt-BR');
  const pct = (a, b) => b ? Math.round(a / b * 100) + '%' : '—';
  const ORIGEM = { teste: 'Teste grátis', passe: 'Passe', presente: 'Presente', indicacao: 'Indicação', manual: 'Cortesia (painel)' };
  const FASE = { nascimento: 'Pós-parto', perda: 'Perda gestacional' };
  const RECURSO_NOME = { exames: 'Exames', ultrassons: 'Ultrassons', casa: 'Diário em casa', monitores: 'Medições em casa', medicacao: 'Medicação', sintomas: 'Sintomas',
    notas: 'Perguntas para a consulta', memorias: 'Diário da barriga', plano_parto: 'Plano de parto', resumo_pdf: 'Resumo em PDF', fotos: 'Fotos', contracoes: 'Contador de contrações',
    mala: 'Mala da maternidade', video_barriga: 'Vídeo da barriga', familia_fotos: 'Família vê as fotos' };
  const ACAO = { conceder_plus: 'Concedeu Plus', encerrar_plus: 'Encerrou Plus', criar_conta: 'Criou conta', excluir_conta: 'Excluiu conta', reenviar_acesso: 'Reenviou acesso',
    tornar_admin: 'Tornou administradora', remover_admin: 'Removeu administradora', config: 'Alterou configurações' };

  let toastT;
  function toast(m) { const t = $('toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 3200); }
  function modal(titulo, corpo) {
    $('modal-root').innerHTML = `<div class="modal-bg" data-act="fecharFundo"><div class="modal" role="dialog" aria-modal="true" aria-label="${esc(titulo)}"><div class="mh"><h2>${esc(titulo)}</h2><button class="x" data-act="fechar" aria-label="Fechar">×</button></div>${corpo}</div></div>`;
  }
  const fechar = () => { $('modal-root').innerHTML = ''; };

  if (!(window.supabase && CFG.SUPABASE_URL)) { main.innerHTML = '<div class="card">Supabase não configurado em js/config.js.</div>'; return; }
  const sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, { auth: { persistSession: true, storageKey: 'ninho.admin', detectSessionInUrl: false } });

  async function api(acao, dados = {}) {
    const { data, error } = await sb.functions.invoke('admin', { body: Object.assign({ acao, retorno: location.origin + location.pathname.replace(/admin\.html$/, '') }, dados) });
    if (error) {
      let msg = 'Não foi possível concluir.';
      try { const j = await error.context.json(); msg = j.error === 'forbidden' ? 'Esta conta não é administradora.' : j.error === 'unauthorized' ? 'Sessão expirada. Entre de novo.' : (j.error && j.error.length > 6 ? j.error : msg); } catch (_) { }
      throw new Error(msg);
    }
    return data;
  }

  /* ---------------- login ---------------- */
  function telaLogin(msg = '') {
    $('adm-nav').classList.add('hidden'); $('adm-user').innerHTML = '';
    main.innerHTML = `<form class="card adm-login" data-form="login"><h2>Entrar no painel</h2><p class="muted" style="font-size:13px">Use a conta do Ninho cadastrada como administradora.</p>
      ${msg ? `<div class="alert urgente" style="margin:8px 0"><div><p style="margin:0">${esc(msg)}</p></div></div>` : ''}
      <label class="lbl" for="lg-e">E-mail</label><input class="in" id="lg-e" type="email" autocomplete="username" required>
      <label class="lbl" for="lg-s">Senha</label><input class="in" id="lg-s" type="password" autocomplete="current-password" required>
      <button class="btn full" style="margin-top:12px" type="submit">Entrar</button>
      <button class="btn sec full" style="margin-top:8px" type="button" data-act="esqueci">Esqueci minha senha</button></form>`;
  }
  /** Envia o e-mail de nova senha. O link abre o app, que mostra a tela "Nova senha". */
  async function esqueci(el) {
    const email = $('lg-e').value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { $('lg-e').focus(); return toast('Digite seu e-mail no campo acima'); }
    el.disabled = true; el.textContent = 'Enviando…';
    const app = location.origin + location.pathname.replace(/admin\.html$/, '');
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: app });
    el.disabled = false; el.textContent = 'Esqueci minha senha';
    // mesma mensagem com ou sem conta, para não revelar quais e-mails existem
    if (error && !/rate|limit/i.test(error.message)) return toast('Não foi possível enviar agora. Tente de novo em alguns minutos.');
    if (error) return toast('Muitas tentativas. Espere alguns minutos e tente de novo.');
    toast('Se esse e-mail tiver conta, você vai receber um link para criar uma nova senha. Olhe também o lixo eletrônico.');
  }
  async function entrar() {
    try {
      const { error } = await sb.auth.signInWithPassword({ email: $('lg-e').value.trim(), password: $('lg-s').value });
      if (error) throw new Error('E-mail ou senha incorretos.');
      await iniciar();
    } catch (e) { telaLogin(e.message); }
  }
  async function sair() { await sb.auth.signOut(); telaLogin(); }

  async function iniciar() {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return telaLogin();
    try { const eu = await api('eu'); $('adm-user').innerHTML = `<span>${esc(eu.email)}</span> <button class="btn sec sm" data-act="sair">Sair</button>`; }
    catch (e) { await sb.auth.signOut(); return telaLogin(e.message); }
    $('adm-nav').classList.remove('hidden'); aba('geral');
  }

  /* ---------------- abas ---------------- */
  const ESTADO = { busca: '', filtro: 'todas', offset: 0, limite: 30 };
  function aba(t) {
    document.querySelectorAll('#adm-nav button').forEach(b => b.classList.toggle('on', b.dataset.t === t));
    ({ geral: telaGeral, contas: telaContas, nova: telaNova, config: telaConfig, historico: telaHistorico })[t]();
  }

  async function telaGeral() {
    main.innerHTML = '<p class="muted">Carregando números…</p>';
    let r; try { r = await api('resumo'); } catch (e) { main.innerHTML = `<div class="card">${esc(e.message)}</div>`; return; }
    const kpi = (v, t, s = '') => `<div class="kpi"><b>${v}</b><span>${t}</span>${s ? `<small>${s}</small>` : ''}</div>`;
    const f = r.funil || {}, etapas = [['Cadastradas', f.cadastradas], ['Configuraram a gestação', f.com_gestacao], ['Registraram consulta', f.com_consulta], ['Testaram o Plus', f.testaram], ['Pagaram', f.pagaram]];
    const max = Math.max(1, ...(r.cadastros_dia || []).map(d => d.n));
    main.innerHTML = `<div class="kpis">
        ${kpi(n(r.contas), 'Contas no total', `+${n(r.novas_7d)} em 7 dias · +${n(r.novas_30d)} em 30 dias`)}
        ${kpi(n(r.gratuitas), 'Gratuitas', pct(r.gratuitas, r.contas) + ' das contas')}
        ${kpi(n(r.plus_ativas), 'Com Plus ativo', pct(r.plus_ativas, r.contas) + ' das contas')}
        ${kpi(n(r.pagantes), 'Pagantes agora', 'Passe, presente ou assinatura')}
      </div>
      <div class="adm-grid">
        <section class="card"><h3>Cadastros por dia (30 dias)</h3><div class="barras" role="img" aria-label="Cadastros por dia nos últimos 30 dias">${(r.cadastros_dia || []).map(d => `<i style="height:${Math.max(2, d.n / max * 100)}%" title="${fmt(d.dia + 'T12:00')}: ${d.n}"></i>`).join('')}</div></section>
        <section class="card"><h3>Funil</h3>${etapas.map(([t, v]) => `<div class="funil"><span>${t}</span><div><i style="width:${(f.cadastradas ? (v || 0) / f.cadastradas * 100 : 0).toFixed(1)}%"></i></div><b>${n(v)}</b><small>${pct(v || 0, f.cadastradas)}</small></div>`).join('')}</section>
        <section class="card"><h3>Plus ativo por origem</h3>${Object.entries(r.por_origem || {}).map(([k, v]) => `<div class="linha"><span>${ORIGEM[k] || k}</span><b>${n(v)}</b></div>`).join('') || '<p class="muted">Nenhum.</p>'}
          <div class="linha"><span>Assinaturas mensais</span><b>${n(r.assinaturas_mensais)}</b></div></section>
        <section class="card"><h3>Fase das usuárias</h3><div class="linha"><span>Gestando</span><b>${n((r.fases || {}).gestando)}</b></div><div class="linha"><span>Pós-parto</span><b>${n((r.fases || {}).puerperio)}</b></div><div class="linha"><span>Perda gestacional</span><b>${n((r.fases || {}).perda)}</b></div>
          <div class="linha"><span>Querem o app do bebê</span><b>${n(r.interesse_app_bebe)}</b></div></section>
        <section class="card"><h3>Vendas e crescimento (total)</h3><div class="linha"><span>Passes vendidos</span><b>${n(r.passes_vendidos)}</b></div><div class="linha"><span>Presentes pagos</span><b>${n(r.presentes_pagos)}</b></div>
          <div class="linha"><span>Testes grátis iniciados</span><b>${n(r.testes_iniciados)}</b></div><div class="linha"><span>Indicações usadas</span><b>${n(r.indicacoes)}</b></div><div class="linha"><span>Convites da família ativos</span><b>${n(r.convites_familia)}</b></div></section>
      </div><p class="muted" style="font-size:12px">Atualizado em ${fmtDT(r.atualizado_em)}.</p>`;
  }

  async function telaContas() {
    main.innerHTML = `<form class="adm-filtros" data-form="busca"><input class="in" id="ct-b" placeholder="Buscar por nome ou e-mail" value="${esc(ESTADO.busca)}">
      <select class="in" id="ct-f">${[['todas', 'Todas'], ['gratis', 'Gratuitas'], ['plus', 'Com Plus'], ['puerperio', 'Pós-parto'], ['perda', 'Perda gestacional'], ['admin', 'Administradoras']].map(([v, t]) => `<option value="${v}" ${ESTADO.filtro === v ? 'selected' : ''}>${t}</option>`).join('')}</select>
      <button class="btn" type="submit"><i class="ph ph-magnifying-glass"></i> Buscar</button></form><div id="ct-lista"><p class="muted">Carregando…</p></div>`;
    let r; try { r = await api('contas', { busca: ESTADO.busca, filtro: ESTADO.filtro, limite: ESTADO.limite, offset: ESTADO.offset }); }
    catch (e) { $('ct-lista').innerHTML = `<div class="card">${esc(e.message)}</div>`; return; }
    const pag = Math.floor(ESTADO.offset / ESTADO.limite) + 1, tot = Math.max(1, Math.ceil(r.total / ESTADO.limite));
    $('ct-lista').innerHTML = `<p class="muted" style="font-size:13px">${n(r.total)} conta(s)</p><div class="tabela-wrap"><table class="tabela"><thead><tr><th>Nome</th><th>E-mail</th><th>Plano</th><th>Fase</th><th>Cadastro</th><th>Último acesso</th></tr></thead><tbody>
      ${r.contas.map(c => `<tr data-act="conta" data-id="${c.id}" tabindex="0"><td>${esc(c.nome || '—')}${c.admin ? ' <span class="pill v">admin</span>' : ''}</td><td>${esc(c.email)}</td>
        <td>${c.plus ? `<span class="pill g">Plus</span> <small>${c.origem ? ORIGEM[c.origem] || c.origem : c.assinatura ? 'Assinatura' : ''}${c.acesso_ate ? ' até ' + fmt(c.acesso_ate) : ''}</small>` : '<span class="pill">Grátis</span>'}</td>
        <td>${c.desfecho ? FASE[c.desfecho] : c.dpp ? 'DPP ' + fmt(c.dpp + 'T12:00') : '—'}</td><td>${fmt(c.created_at)}</td><td>${fmtDT(c.last_sign_in_at)}</td></tr>`).join('') || '<tr><td colspan="6" class="muted">Nenhuma conta encontrada.</td></tr>'}
      </tbody></table></div>
      <div class="paginas"><button class="btn sec sm" data-act="pagina" data-d="-1" ${pag <= 1 ? 'disabled' : ''}>‹ Anterior</button><span>Página ${pag} de ${tot}</span><button class="btn sec sm" data-act="pagina" data-d="1" ${pag >= tot ? 'disabled' : ''}>Próxima ›</button></div>`;
  }

  async function abrirConta(id) {
    modal('Conta', '<p class="muted">Carregando…</p>');
    let c; try { c = await api('conta', { id }); } catch (e) { return modal('Conta', `<p>${esc(e.message)}</p>`); }
    const nome = (c.perfil && (c.perfil.nome_social || c.perfil.nome_completo)) || '—';
    const ativas = (c.concessoes || []).filter(x => new Date(x.fim) > new Date());
    modal(nome, `<dl class="kv"><dt>E-mail</dt><dd>${esc(c.email)}${c.confirmada ? '' : ' <span class="pill w">não confirmado</span>'}</dd><dt>Cadastro</dt><dd>${fmtDT(c.criada)}</dd><dt>Último acesso</dt><dd>${fmtDT(c.ultimo_login)}</dd>
        <dt>Código de indicação</dt><dd>${esc((c.perfil && c.perfil.codigo_indicacao) || '—')}</dd><dt>Assinatura</dt><dd>${c.assinatura && c.assinatura.plano === 'plus' ? esc(c.assinatura.status) + (c.assinatura.periodo_fim ? ' até ' + fmt(c.assinatura.periodo_fim) : '') : 'Não'}</dd>
        <dt>Convites da família</dt><dd>${c.convites ?? '—'}</dd></dl>
      <h3 style="margin-top:14px">Acesso ao Plus</h3>
      ${(c.concessoes || []).length ? `<table class="tabela mini"><thead><tr><th>Origem</th><th>Início</th><th>Fim</th><th></th></tr></thead><tbody>${c.concessoes.map(x => `<tr><td>${ORIGEM[x.origem] || x.origem}</td><td>${fmt(x.inicio)}</td><td>${fmt(x.fim)}</td>
        <td>${ativas.includes(x) ? `<button class="btn sec sm" data-act="encerrar" data-id="${id}" data-c="${x.id}">Encerrar</button>` : '<span class="muted">encerrada</span>'}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">Nenhum acesso concedido.</p>'}
      <form class="adm-inline" data-form="conceder" data-id="${id}"><label class="lbl" for="cd-d">Conceder Plus por</label><select class="in" id="cd-d"><option value="7">7 dias</option><option value="30" selected>30 dias</option><option value="90">90 dias</option><option value="180">6 meses</option><option value="365">1 ano</option></select><button class="btn" type="submit">Conceder</button></form>
      <div class="adm-acoes"><button class="btn sec sm" data-act="reenviar" data-id="${id}"><i class="ph ph-envelope"></i> Enviar link de nova senha</button>
        <button class="btn sec sm" data-act="admin" data-id="${id}" data-v="${c.admin ? 0 : 1}"><i class="ph ph-shield"></i> ${c.admin ? 'Remover de administradora' : 'Tornar administradora'}</button>
        <button class="btn sm btn-bad" data-act="excluir" data-id="${id}" data-email="${esc(c.email)}"><i class="ph ph-trash"></i> Excluir conta</button></div>
      <p class="muted" style="font-size:11.5px;margin-top:12px">Por privacidade (LGPD), o painel não mostra dados de saúde. Toda ação fica registrada no histórico.</p>`);
  }

  function telaNova() {
    main.innerHTML = `<form class="card adm-form" data-form="nova"><h2>Nova conta</h2><p class="muted" style="font-size:13px">A pessoa recebe um e-mail de convite para criar a senha. No primeiro acesso, o app pede o aceite dos termos e da política de privacidade.</p>
      <label class="lbl" for="nv-n">Nome completo</label><input class="in" id="nv-n" maxlength="120" required>
      <label class="lbl" for="nv-e">E-mail</label><input class="in" id="nv-e" type="email" required>
      <label class="lbl" for="nv-d">Plus de cortesia</label><select class="in" id="nv-d"><option value="0">Sem Plus</option><option value="30">30 dias</option><option value="90">90 dias</option><option value="180">6 meses</option><option value="365">1 ano</option></select>
      <button class="btn full" style="margin-top:12px" type="submit">Criar e enviar convite</button></form>`;
  }

  async function telaConfig() {
    main.innerHTML = '<p class="muted">Carregando…</p>';
    let c; try { c = await api('config'); } catch (e) { main.innerHTML = `<div class="card">${esc(e.message)}</div>`; return; }
    const d = c.dados || {}, p = d.precos || {}, rec = d.recursos || {};
    const dinheiro = (id, v) => `<div class="in-moeda"><span>R$</span><input class="in" id="${id}" type="number" min="1" max="999" step="0.01" value="${v != null ? Number(v).toFixed(2) : ''}"></div>`;
    main.innerHTML = `<form class="adm-form" data-form="config">
      <section class="card"><h3>Preços</h3><p class="muted" style="font-size:13px">Valem para novos pagamentos, no app e no Mercado Pago. Quem já pagou não é afetado.</p>
        <div class="adm-cols"><div><label class="lbl" for="cf-pp">Passe Gestação</label>${dinheiro('cf-pp', p.passe)}</div><div><label class="lbl" for="cf-pr">Passe Reta Final</label>${dinheiro('cf-pr', p.reta_final)}</div><div><label class="lbl" for="cf-pm">Mensal</label>${dinheiro('cf-pm', p.mensal)}</div></div>
        <label class="lbl" for="cf-rs">Passe Reta Final a partir da semana</label><input class="in" id="cf-rs" type="number" min="20" max="38" value="${d.reta_final_desde || 28}"></section>
      <section class="card"><h3>Prazos</h3><div class="adm-cols"><div><label class="lbl" for="cf-td">Teste grátis (dias)</label><input class="in" id="cf-td" type="number" min="0" max="30" value="${d.teste_dias ?? 7}"></div>
        <div><label class="lbl" for="cf-id">Bônus de indicação (dias)</label><input class="in" id="cf-id" type="number" min="0" max="90" value="${d.indicacao_dias ?? 30}"></div></div>
        <p class="muted" style="font-size:12px">O teste grátis e o bônus já concedidos não mudam.</p></section>
      <section class="card"><h3>Aviso no topo do app</h3><input class="in" id="cf-av" maxlength="200" placeholder="Ex.: Manutenção hoje às 23h. Seus dados estão seguros." value="${esc(d.aviso || '')}"><p class="muted" style="font-size:12px">Deixe vazio para não mostrar nada.</p></section>
      <section class="card"><h3>Recursos liberados para todas</h3><p class="muted" style="font-size:13px">Marque para liberar um recurso do Plus para as contas gratuitas (ex.: uma campanha). Vale no app e no banco de dados.</p>
        <div class="recursos">${(c.recursos_disponiveis || []).map(k => `<label class="chk-line"><input type="checkbox" class="cf-rec" value="${k}" ${rec[k] === 'free' ? 'checked' : ''}> ${RECURSO_NOME[k] || k}</label>`).join('')}</div></section>
      <button class="btn full" type="submit">Salvar configurações</button><p class="muted" style="font-size:12px;text-align:center">Última alteração: ${fmtDT(c.updated_at)}</p></form>`;
  }

  async function telaHistorico() {
    main.innerHTML = '<p class="muted">Carregando…</p>';
    let h; try { h = await api('historico'); } catch (e) { main.innerHTML = `<div class="card">${esc(e.message)}</div>`; return; }
    main.innerHTML = `<div class="tabela-wrap"><table class="tabela"><thead><tr><th>Quando</th><th>Quem</th><th>Ação</th><th>Conta</th><th>Detalhes</th></tr></thead><tbody>
      ${h.map(x => `<tr><td>${fmtDT(x.created_at)}</td><td>${esc(x.admin_email || '—')}</td><td>${ACAO[x.acao] || esc(x.acao)}</td><td>${esc(x.alvo_email || (x.detalhes && x.detalhes.email) || '—')}</td>
        <td class="det">${esc(x.detalhes ? JSON.stringify(x.detalhes.mudou || x.detalhes) : '')}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">Nada registrado ainda.</td></tr>'}</tbody></table></div>`;
  }

  /* ---------------- ações ---------------- */
  async function ocupado(el, fn) { const t = el && el.innerHTML; if (el) { el.disabled = true; el.textContent = 'Aguarde…'; } try { return await fn(); } finally { if (el && document.body.contains(el)) { el.disabled = false; el.innerHTML = t; } } }
  const ACT = {
    fechar: fechar, fecharFundo: (el, ev) => { if (ev.target === el) fechar(); }, sair, esqueci,
    conta: el => abrirConta(el.dataset.id),
    pagina: el => { ESTADO.offset = Math.max(0, ESTADO.offset + Number(el.dataset.d) * ESTADO.limite); telaContas(); },
    encerrar: el => ocupado(el, async () => { try { await api('encerrar', { id: el.dataset.id, concessao: el.dataset.c }); toast('Acesso encerrado'); abrirConta(el.dataset.id); } catch (e) { toast(e.message); } }),
    reenviar: el => ocupado(el, async () => { try { await api('reenviar_acesso', { id: el.dataset.id }); toast('Link enviado por e-mail'); } catch (e) { toast(e.message); } }),
    admin: el => ocupado(el, async () => { try { await api('definir_admin', { id: el.dataset.id, valor: el.dataset.v === '1' }); toast('Feito'); abrirConta(el.dataset.id); } catch (e) { toast(e.message); } }),
    excluir: el => modal('Excluir conta', `<p style="font-size:14px;line-height:1.5">Isto apaga <b>definitivamente</b> a conta <b>${esc(el.dataset.email)}</b>, todos os registros e as fotos. Não dá para desfazer.</p>
      <form data-form="excluir" data-id="${esc(el.dataset.id)}"><label class="lbl" for="ex-c">Digite EXCLUIR para confirmar</label><input class="in" id="ex-c" autocomplete="off">
      <button class="btn full btn-bad" style="margin-top:12px" type="submit">Excluir definitivamente</button></form>`),
  };
  const FORM = {
    login: entrar,
    busca: () => { ESTADO.busca = $('ct-b').value.trim(); ESTADO.filtro = $('ct-f').value; ESTADO.offset = 0; telaContas(); },
    conceder: f => ocupado(f.querySelector('button'), async () => { try { const r = await api('conceder', { id: f.dataset.id, dias: Number($('cd-d').value) }); toast('Plus liberado até ' + fmt(r.ate)); abrirConta(f.dataset.id); } catch (e) { toast(e.message); } }),
    excluir: f => {
      if ($('ex-c').value.trim() !== 'EXCLUIR') return toast('Digite EXCLUIR para confirmar');
      return ocupado(f.querySelector('button'), async () => { try { await api('excluir', { id: f.dataset.id, confirmacao: 'EXCLUIR' }); fechar(); toast('Conta excluída'); telaContas(); } catch (e) { toast(e.message); } });
    },
    nova: f => ocupado(f.querySelector('button'), async () => {
      try { const r = await api('criar', { nome: $('nv-n').value.trim(), email: $('nv-e').value.trim(), dias_plus: Number($('nv-d').value) }); toast('Convite enviado' + (r.ate ? ' · Plus até ' + fmt(r.ate) : '')); telaNova(); }
      catch (e) { toast(e.message); }
    }),
    config: f => ocupado(f.querySelector('button[type=submit]'), async () => {
      const num = id => $(id).value === '' ? undefined : Number($(id).value);
      const recursos = {}; document.querySelectorAll('.cf-rec:checked').forEach(c => { recursos[c.value] = 'free'; });
      const dados = { precos: { passe: num('cf-pp'), reta_final: num('cf-pr'), mensal: num('cf-pm') }, reta_final_desde: num('cf-rs'), teste_dias: num('cf-td'), indicacao_dias: num('cf-id'), aviso: $('cf-av').value.trim() || null, recursos };
      Object.keys(dados.precos).forEach(k => dados.precos[k] === undefined && delete dados.precos[k]);
      try { await api('config_salvar', { dados }); toast('Configurações salvas'); telaConfig(); } catch (e) { toast(e.message); }
    }),
  };
  document.addEventListener('click', ev => {
    const nav = ev.target.closest('#adm-nav button'); if (nav) return aba(nav.dataset.t);
    const el = ev.target.closest('[data-act]'); if (el && ACT[el.dataset.act]) ACT[el.dataset.act](el, ev);
  });
  document.addEventListener('keydown', ev => { if (ev.key === 'Enter' && ev.target.matches('tr[data-act]')) ACT.conta(ev.target); if (ev.key === 'Escape') fechar(); });
  document.addEventListener('submit', ev => { const f = ev.target.closest('[data-form]'); if (!f) return; ev.preventDefault(); FORM[f.dataset.form] && FORM[f.dataset.form](f); });

  iniciar();
})();
