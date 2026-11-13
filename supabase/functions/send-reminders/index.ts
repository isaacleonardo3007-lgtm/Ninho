// Envia lembretes vencidos por Web Push. Chamada pelo pg_cron (supabase/sql/cron.sql)
// com o header x-cron-secret. Secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY,
// VAPID_SUBJECT (mailto:...), CRON_SECRET.
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT') ?? 'mailto:contato@ninho.app',
  Deno.env.get('VAPID_PUBLIC_KEY')!, Deno.env.get('VAPID_PRIVATE_KEY')!);

Deno.serve(async (req) => {
  if (req.headers.get('x-cron-secret') !== Deno.env.get('CRON_SECRET')) return new Response('forbidden', { status: 403 });
  const { data: due, error } = await admin.from('lembretes')
    .select('id,user_id,titulo,corpo,url,tipo,tentativas')
    .is('enviado_em', null).lte('enviar_em', new Date().toISOString()).lt('tentativas', 3)
    .order('enviar_em').limit(500);
  if (error) return new Response(error.message, { status: 500 });
  const users = [...new Set((due ?? []).map((l) => l.user_id))];
  const { data: subs } = users.length
    ? await admin.from('push_subscriptions').select('id,user_id,endpoint,p256dh,auth').in('user_id', users)
    : { data: [] };
  let enviados = 0;
  for (const l of due ?? []) {
    const alvo = (subs ?? []).filter((s) => s.user_id === l.user_id);
    let ok = false;
    for (const s of alvo) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify({ title: l.titulo, body: l.corpo, url: l.url ?? '/', tag: l.tipo }), { TTL: 3600 });
        ok = true;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) await admin.from('push_subscriptions').delete().eq('id', s.id);
        else console.error('push', code, (e as Error).message);
      }
    }
    // sem aparelho inscrito: marca como enviado para não acumular (o app mostra in-app)
    await admin.from('lembretes').update(ok || !alvo.length
      ? { enviado_em: new Date().toISOString() } : { tentativas: (l.tentativas ?? 0) + 1 }).eq('id', l.id);
    if (ok) enviados++;
  }
  return Response.json({ pendentes: due?.length ?? 0, enviados });
});
