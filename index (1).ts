// Exclusão definitiva da conta (LGPD art. 18, VI). Apaga fotos do Storage e o
// usuário do Auth — todas as tabelas caem em cascata (on delete cascade).
import { createClient } from 'npm:@supabase/supabase-js@2';
import { cors, json } from '../_shared/cors.ts';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

async function listAll(prefix: string): Promise<string[]> {
  const out: string[] = [];
  const { data, error } = await admin.storage.from('ninho').list(prefix, { limit: 1000 });
  if (error) throw error;
  for (const item of data ?? []) {
    const path = `${prefix}/${item.name}`;
    if (item.id === null) out.push(...(await listAll(path))); // pasta
    else out.push(path);
  }
  return out;
}

Deno.serve(async (req) => {
  const h = cors(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: h });
  if (req.method !== 'POST') return json({ error: 'method' }, 405, h);
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: { user }, error } = await admin.auth.getUser(token);
  if (error || !user) return json({ error: 'unauthorized' }, 401, h);
  const body = await req.json().catch(() => ({}));
  if (body?.confirmacao !== 'EXCLUIR') return json({ error: 'confirmacao' }, 400, h);
  try {
    const files = await listAll(user.id);
    for (let i = 0; i < files.length; i += 100) await admin.storage.from('ninho').remove(files.slice(i, i + 100));
    const { error: delErr } = await admin.auth.admin.deleteUser(user.id);
    if (delErr) throw delErr;
    return json({ ok: true, arquivos_removidos: files.length }, 200, h);
  } catch (e) {
    console.error('delete-account', user.id, e);
    return json({ error: 'falha_exclusao' }, 500, h);
  }
});
