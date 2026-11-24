// Painel de administração. Só responde a contas cadastradas em privado.admins.
// POST { acao, ... } com o token da administradora no Authorization.
// Nunca devolve dados de saúde (consultas, exames, pressão etc.): só conta, plano e fase.
// Toda ação que muda algo fica registrada em privado.admin_log.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { cors, json, retornoSeguro } from '../_shared/cors.ts';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const RECURSOS = ['exames', 'ultrassons', 'casa', 'monitores', 'medicacao', 'sintomas', 'notas', 'memorias', 'plano_parto', 'resumo_pdf',
  'fotos', 'contracoes', 'mala', 'video_barriga', 'familia_fotos'];

async function listAll(prefix: string): Promise<string[]> {
  const out: string[] = [];
  const { data, error } = await admin.storage.from('ninho').list(prefix, { limit: 1000 });
  if (error) throw error;
  for (const item of data ?? []) {
    const path = `${prefix}/${item.name}`;
    if (item.id === null) out.push(...(await listAll(path))); else out.push(path);
  }
  return out;
}

const num = (v: unknown, min: number, max: number) => { const n = Number(v); return Number.isFinite(n) && n >= min && n <= max ? Math.round(n * 100) / 100 : null; };

/** Valida e limpa o que pode ser salvo na configuração do app. */
function limparConfig(d: Record<string, unknown>): Record<string, unknown> | string {
  const out: Record<string, unknown> = {};
  if (d.precos !== undefined) {
    const p = d.precos as Record<string, unknown>;
    const precos: Record<string, number> = {};
    for (const k of ['passe', 'reta_final', 'mensal']) {
      if (p?.[k] === undefined) continue;
      const v = num(p[k], 1, 999); if (v === null) return `Preço inválido: ${k}`;
      precos[k] = v;
    }
    out.precos = precos;
  }
  if (d.reta_final_desde !== undefined) { const v = num(d.reta_final_desde, 20, 38); if (v === null) return 'Semana do Passe Reta Final entre 20 e 38'; out.reta_final_desde = Math.round(v); }
  if (d.teste_dias !== undefined) { const v = num(d.teste_dias, 0, 30); if (v === null) return 'Teste grátis entre 0 e 30 dias'; out.teste_dias = Math.round(v); }
  if (d.indicacao_dias !== undefined) { const v = num(d.indicacao_dias, 0, 90); if (v === null) return 'Bônus de indicação entre 0 e 90 dias'; out.indicacao_dias = Math.round(v); }
  if (d.aviso !== undefined) {
    if (d.aviso === null || d.aviso === '') out.aviso = null;
    else if (typeof d.aviso === 'string' && d.aviso.length <= 200) out.aviso = d.aviso.trim();
    else return 'Aviso com até 200 caracteres';
  }
  if (d.recursos !== undefined) {
    const r = d.recursos as Record<string, unknown>; const rec: Record<string, string> = {};
    for (const [k, v] of Object.entries(r ?? {})) {
      if (!RECURSOS.includes(k) || !['free', 'plus'].includes(String(v))) return `Recurso inválido: ${k}`;
      if (v === 'free') rec[k] = 'free';
    }
    out.recursos = rec;
  }
  return out;
}

Deno.serve(async (req) => {
  const h = cors(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: h });
  if (req.method !== 'POST') return json({ error: 'method' }, 405, h);
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: { user } } = await admin.auth.getUser(token);
  if (!user) return json({ error: 'unauthorized' }, 401, h);
  const { data: eh } = await admin.rpc('admin_eh', { uid: user.id });
  if (!eh) return json({ error: 'forbidden' }, 403, h);

  const b = await req.json().catch(() => ({})) as Record<string, any>;
  const log = (acao: string, alvo: string | null, detalhes: unknown = null) =>
    admin.rpc('admin_registrar', { p_admin: user.id, p_acao: acao, p_alvo: alvo, p_detalhes: detalhes });
  const alvo = String(b.id ?? '');
  const precisaAlvo = () => UUID.test(alvo);

  try {
    switch (b.acao) {
      case 'eu': return json({ admin: true, email: user.email, id: user.id }, 200, h);

      case 'resumo': {
        const { data, error } = await admin.rpc('admin_resumo'); if (error) throw error;
        return json(data, 200, h);
      }
      case 'contas': {
        const { data, error } = await admin.rpc('admin_contas', {
          p_busca: String(b.busca ?? '').slice(0, 80), p_filtro: String(b.filtro ?? 'todas'),
          p_limite: Number(b.limite ?? 50), p_offset: Number(b.offset ?? 0) });
        if (error) throw error;
        return json(data, 200, h);
      }
      case 'conta': {
        if (!precisaAlvo()) return json({ error: 'id' }, 400, h);
        const [{ data: c }, { data: cs }, { data: a }, { data: fam }] = await Promise.all([
          admin.from('profiles').select('nome_completo,nome_social,telefone,codigo_indicacao,created_at').eq('id', alvo).maybeSingle(),
          admin.rpc('admin_concessoes', { uid: alvo }),
          admin.from('assinaturas').select('plano,status,ciclo,provedor,periodo_fim').eq('user_id', alvo).maybeSingle(),
          admin.from('familia_convites').select('id', { count: 'exact', head: true }).eq('user_id', alvo).is('revogado_em', null),
        ]);
        const { data: u } = await admin.auth.admin.getUserById(alvo);
        const { data: ad } = await admin.rpc('admin_eh', { uid: alvo });
        return json({ perfil: c, concessoes: cs, assinatura: a, convites: (fam as unknown as { count?: number })?.count ?? null,
          email: u?.user?.email, criada: u?.user?.created_at, ultimo_login: u?.user?.last_sign_in_at,
          confirmada: !!u?.user?.email_confirmed_at, admin: !!ad }, 200, h);
      }
      case 'conceder': {
        const dias = Number(b.dias);
        if (!precisaAlvo() || !Number.isInteger(dias) || dias < 1 || dias > 3650) return json({ error: 'dados' }, 400, h);
        const { data, error } = await admin.rpc('admin_conceder', { uid: alvo, p_dias: dias }); if (error) throw error;
        await log('conceder_plus', alvo, { dias, ate: data });
        return json({ ok: true, ate: data }, 200, h);
      }
      case 'encerrar': {
        if (!precisaAlvo() || !UUID.test(String(b.concessao ?? ''))) return json({ error: 'dados' }, 400, h);
        const { error } = await admin.rpc('admin_encerrar', { p_id: b.concessao }); if (error) throw error;
        await log('encerrar_plus', alvo, { concessao: b.concessao });
        return json({ ok: true }, 200, h);
      }
      case 'definir_admin': {
        if (!precisaAlvo()) return json({ error: 'id' }, 400, h);
        const { error } = await admin.rpc('admin_definir', { uid: alvo, p_admin: !!b.valor });
        if (error) return json({ error: error.message }, 400, h);
        await log(b.valor ? 'tornar_admin' : 'remover_admin', alvo);
        return json({ ok: true }, 200, h);
      }
      case 'criar': {
        const email = String(b.email ?? '').trim().toLowerCase(); const nome = String(b.nome ?? '').trim().slice(0, 120);
        if (!EMAIL.test(email) || !nome) return json({ error: 'Informe nome e e-mail válidos' }, 400, h);
        const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
          data: { nome_completo: nome }, redirectTo: retornoSeguro(b.retorno) });
        if (error) return json({ error: /already|registered|exists/i.test(error.message) ? 'Já existe uma conta com esse e-mail' : error.message }, 400, h);
        const id = data.user?.id ?? null; let ate = null;
        const dias = Number(b.dias_plus ?? 0);
        if (id && Number.isInteger(dias) && dias > 0 && dias <= 3650) ate = (await admin.rpc('admin_conceder', { uid: id, p_dias: dias })).data;
        await log('criar_conta', id, { email, dias_plus: dias || 0 });
        return json({ ok: true, id, ate }, 200, h);
      }
      case 'reenviar_acesso': {
        if (!precisaAlvo()) return json({ error: 'id' }, 400, h);
        const { data: u } = await admin.auth.admin.getUserById(alvo);
        if (!u?.user?.email) return json({ error: 'conta' }, 404, h);
        const { error } = await admin.auth.resetPasswordForEmail(u.user.email, { redirectTo: retornoSeguro(b.retorno) });
        if (error) throw error;
        await log('reenviar_acesso', alvo);
        return json({ ok: true }, 200, h);
      }
      case 'excluir': {
        if (!precisaAlvo() || b.confirmacao !== 'EXCLUIR') return json({ error: 'confirmacao' }, 400, h);
        if (alvo === user.id) return json({ error: 'Você não pode excluir a própria conta pelo painel' }, 400, h);
        const files = await listAll(alvo);
        for (let i = 0; i < files.length; i += 100) await admin.storage.from('ninho').remove(files.slice(i, i + 100));
        const { data: u } = await admin.auth.admin.getUserById(alvo);
        const { error } = await admin.auth.admin.deleteUser(alvo); if (error) throw error;
        await log('excluir_conta', null, { id: alvo, email: u?.user?.email ?? null, arquivos: files.length });
        return json({ ok: true, arquivos_removidos: files.length }, 200, h);
      }
      case 'config': {
        const { data, error } = await admin.from('app_config').select('dados,updated_at').eq('id', 1).single(); if (error) throw error;
        return json({ ...data, recursos_disponiveis: RECURSOS }, 200, h);
      }
      case 'config_salvar': {
        const limpo = limparConfig((b.dados ?? {}) as Record<string, unknown>);
        if (typeof limpo === 'string') return json({ error: limpo }, 400, h);
        const { data: atual } = await admin.from('app_config').select('dados').eq('id', 1).single();
        // preços: mescla com os atuais; recursos: substitui a lista inteira (permite voltar tudo ao padrão)
        if (limpo.precos) limpo.precos = { ...((atual?.dados as any)?.precos ?? {}), ...(limpo.precos as object) };
        const { data, error } = await admin.rpc('admin_config_salvar', { p_admin: user.id, p_dados: limpo }); if (error) throw error;
        await log('config', null, { antes: atual?.dados ?? null, mudou: limpo });
        return json({ ok: true, dados: data }, 200, h);
      }
      case 'historico': {
        const { data, error } = await admin.rpc('admin_historico', { p_limite: 200 }); if (error) throw error;
        return json(data, 200, h);
      }
      default: return json({ error: 'acao' }, 400, h);
    }
  } catch (e) {
    console.error('admin', b.acao, e);
    return json({ error: 'falha' }, 500, h);
  }
});
