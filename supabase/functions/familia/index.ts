// Página da família (sem conta).
//  GET  ?t=<token>  → nome da gestante, nome do bebê, início da gestação (para calcular a
//                      semana), DPP, papel de quem recebeu o convite e — só se a gestante
//                      liberou E tem Ninho+ — fotos da barriga.
//  POST { t, autor, texto } → deixa um recado para a gestante (até 10 por convite por dia).
// Nada de dados de saúde (exames, pressão, consultas) sai por aqui.
// Depois de uma perda gestacional registrada, os convites ficam em pausa: a página
// mostra só uma mensagem neutra, sem semanas, bebê ou fotos.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { cors, json } from '../_shared/cors.ts';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const addDays = (iso: string, n: number) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const txt = (v: unknown, n: number) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, n);

async function convite(t: string) {
  if (!/^[0-9a-f]{64}$/.test(t)) return null;
  const { data: c } = await admin.from('familia_convites').select('id,user_id,nome,papel,ver_fotos,revogado_em').eq('token', t).maybeSingle();
  return c && !c.revogado_em ? c : null;
}

Deno.serve(async (req) => {
  const h = cors(req, 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return new Response('ok', { headers: h });

  if (req.method === 'POST') {
    const b = await req.json().catch(() => ({}));
    const c = await convite(String(b?.t ?? ''));
    if (!c) return json({ error: 'convite' }, 404, h);
    const autor = txt(b.autor, 60) || c.nome, texto = txt(b.texto, 500);
    if (!texto) return json({ error: 'texto' }, 400, h);
    const desde = new Date(Date.now() - 864e5).toISOString();
    const { count } = await admin.from('familia_recados').select('id', { count: 'exact', head: true }).eq('convite_id', c.id).gt('created_at', desde);
    if ((count ?? 0) >= 10) return json({ error: 'limite' }, 429, h);
    const { error } = await admin.from('familia_recados').insert({ user_id: c.user_id, convite_id: c.id, autor, texto });
    if (error) { console.error(error); return json({ error: 'db' }, 500, h); }
    return json({ ok: true }, 200, h);
  }
  if (req.method !== 'GET') return json({ error: 'metodo' }, 405, h);

  const c = await convite(new URL(req.url).searchParams.get('t') ?? '');
  if (!c) return json({ error: 'convite' }, 404, h);

  const [{ data: p }, { data: g }] = await Promise.all([
    admin.from('profiles').select('nome_social,nome_completo,preferencias').eq('id', c.user_id).maybeSingle(),
    admin.from('gestacoes').select('id,nome_bebe,metodo_ig,dum,usg_data,usg_ig_semanas,usg_ig_dias,dpp_informada,tipo_gravidez,desfecho')
      .eq('user_id', c.user_id).eq('ativa', true).is('deleted_at', null).order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ]);
  const mae = String(p?.nome_social || p?.nome_completo || '').trim().split(/\s+/)[0] || '';
  const sem = { ...h, 'Cache-Control': 'no-store' };
  if (!g) return json({ error: 'sem_gestacao' }, 404, h);
  if (g.desfecho?.tipo === 'perda') return json({ para: c.nome, mae, pausado: true }, 200, sem);

  const inicio = g.metodo_ig === 'usg' ? addDays(g.usg_data, -((g.usg_ig_semanas ?? 0) * 7 + (g.usg_ig_dias ?? 0)))
    : g.metodo_ig === 'dpp' ? addDays(g.dpp_informada, -280) : g.dum;

  let fotos: { semana: number | null; url: string; titulo: string | null }[] = [];
  if (c.ver_fotos) {
    const { data: plus } = await admin.rpc('plano_ativo_servico', { uid: c.user_id });
    if (plus) {
      const { data: ms } = await admin.from('memorias').select('semana,titulo,arquivo_path').eq('gestacao_id', g.id).eq('tipo', 'foto')
        .is('deleted_at', null).not('arquivo_path', 'is', null).order('semana', { ascending: true }).limit(45);
      if (ms?.length) {
        const { data: s } = await admin.storage.from('ninho').createSignedUrls(ms.map((m) => m.arquivo_path), 3600);
        fotos = ms.map((m, i) => ({ semana: m.semana, titulo: m.titulo, url: s?.[i]?.signedUrl ?? '' })).filter((f) => f.url);
      }
    }
  }
  await admin.from('familia_convites').update({ ultimo_acesso: new Date().toISOString() }).eq('id', c.id);
  const nasceu = g.desfecho?.tipo === 'nascimento' ? String(g.desfecho.data ?? '') : null;
  return json({ para: c.nome, papel: c.papel, mae, bebe: g.nome_bebe, inicio, dpp: addDays(inicio, 280),
    tons: { bebe: (((p?.preferencias as any)?.tons?.bebe ?? []) as unknown[]).slice(0, 3).map((n) => (Number.isInteger(n) && (n as number) >= 0 && (n as number) < 7 ? n : null)) }, gemelar: g.tipo_gravidez !== 'unica', bebes: g.tipo_gravidez === 'unica' ? 1 : g.tipo_gravidez === 'gemelar' ? 2 : 3, nasceu, fotos }, 200, sem);
});
