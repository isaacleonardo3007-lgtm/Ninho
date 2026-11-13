// Webhook do Mercado Pago (tópico "subscription_preapproval"). Valida a assinatura
// x-signature (HMAC-SHA256 com MP_WEBHOOK_SECRET), consulta o status real na API
// e atualiza public.assinaturas. Único caminho que libera o plano Plus.
import { createClient } from 'npm:@supabase/supabase-js@2';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const enc = new TextEncoder();

async function hmacHex(secret: string, msg: string) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(msg));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const STATUS: Record<string, string> = { authorized: 'active', pending: 'past_due', paused: 'past_due', cancelled: 'canceled' };

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const body = await req.json().catch(() => ({}));
  const dataId = String(url.searchParams.get('data.id') ?? body?.data?.id ?? '');
  // validação da assinatura do Mercado Pago
  const sigHeader = req.headers.get('x-signature') ?? '';
  const parts = Object.fromEntries(sigHeader.split(',').map((p) => p.trim().split('=') as [string, string]));
  const manifest = `id:${dataId.toLowerCase()};request-id:${req.headers.get('x-request-id') ?? ''};ts:${parts.ts ?? ''};`;
  const expected = await hmacHex(Deno.env.get('MP_WEBHOOK_SECRET') ?? '', manifest);
  if (!parts.v1 || parts.v1 !== expected) return new Response('assinatura inválida', { status: 401 });

  const eventId = `${body?.type ?? 'evt'}:${dataId}:${parts.ts}`;
  const { error: dup } = await admin.from('pagamentos_eventos').insert({ id: eventId, provedor: 'mercadopago', payload: body });
  if (dup) return new Response('ok (repetido)');            // idempotência
  if (!String(body?.type ?? '').includes('preapproval')) return new Response('ignorado');

  const r = await fetch(`https://api.mercadopago.com/preapproval/${dataId}`, {
    headers: { Authorization: `Bearer ${Deno.env.get('MP_ACCESS_TOKEN')}` } });
  if (!r.ok) return new Response('falha ao consultar', { status: 502 });
  const p = await r.json();
  const status = STATUS[p.status] ?? 'expired';
  const fim = p.next_payment_date ? new Date(new Date(p.next_payment_date).getTime() + 3 * 864e5).toISOString() : null;
  const { error } = await admin.from('assinaturas').upsert({
    user_id: p.external_reference, plano: status === 'canceled' ? 'free' : 'plus', status,
    provedor: 'mercadopago', provedor_ref: p.id, periodo_fim: fim,
    ciclo: p.auto_recurring?.frequency === 12 ? 'anual' : 'mensal' });
  if (error) { console.error(error); return new Response('erro', { status: 500 }); }
  return new Response('ok');
});
