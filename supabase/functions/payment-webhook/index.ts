// Webhook do Mercado Pago. Valida a assinatura x-signature (HMAC-SHA256 com
// MP_WEBHOOK_SECRET), consulta o status real na API e libera o Ninho+.
//  - tópico "subscription_preapproval": assinatura mensal/anual → public.assinaturas
//  - tópico "payment": pagamento único
//      external_reference "passe:<user_id>"    → Passe Gestação (até DPP + 90 dias)
//      external_reference "presente:<id>"      → presente pago (gera código resgatável)
//    Estorno/chargeback encerra o que aquele pagamento liberou.
import { createClient } from 'npm:@supabase/supabase-js@2';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const enc = new TextEncoder();
const MP_TOKEN = () => Deno.env.get('MP_ACCESS_TOKEN') ?? '';

async function hmacHex(secret: string, msg: string) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(msg));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const STATUS: Record<string, string> = { authorized: 'active', pending: 'past_due', paused: 'past_due', cancelled: 'canceled' };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function assinatura(id: string) {
  const r = await fetch(`https://api.mercadopago.com/preapproval/${id}`, { headers: { Authorization: `Bearer ${MP_TOKEN()}` } });
  if (!r.ok) return new Response('falha ao consultar', { status: 502 });
  const p = await r.json();
  if (!UUID.test(String(p.external_reference))) return new Response('referência inválida', { status: 400 });
  const status = STATUS[p.status] ?? 'expired';
  const fim = p.next_payment_date ? new Date(new Date(p.next_payment_date).getTime() + 3 * 864e5).toISOString() : null;
  const { error } = await admin.from('assinaturas').upsert({
    user_id: p.external_reference, plano: status === 'canceled' ? 'free' : 'plus', status,
    provedor: 'mercadopago', provedor_ref: p.id, periodo_fim: fim,
    ciclo: p.auto_recurring?.frequency === 12 ? 'anual' : 'mensal' });
  if (error) { console.error(error); return new Response('erro', { status: 500 }); }
  return new Response('ok');
}

async function pagamento(id: string) {
  const r = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, { headers: { Authorization: `Bearer ${MP_TOKEN()}` } });
  if (!r.ok) return new Response('falha ao consultar', { status: 502 });
  const p = await r.json();
  const [tipo, ref] = String(p.external_reference ?? '').split(':');
  if (!UUID.test(ref ?? '')) return new Response('ignorado');
  const estornado = ['refunded', 'charged_back', 'cancelled'].includes(p.status);

  if (tipo === 'passe') {
    if (p.status === 'approved') {
      const { error } = await admin.rpc('conceder_passe', { uid: ref, p_ref: `mp:${p.id}` });
      if (error) { console.error(error); return new Response('erro', { status: 500 }); }
    } else if (estornado) {
      await admin.rpc('encerrar_concessao', { p_origem: 'passe', p_ref: `mp:${p.id}` });
    }
    return new Response('ok');
  }
  if (tipo === 'presente') {
    if (p.status === 'approved') {
      const { error } = await admin.from('presentes').update({ status: 'pago', pago_em: new Date().toISOString(), provedor_ref: String(p.id) })
        .eq('id', ref).eq('status', 'pendente');
      if (error) { console.error(error); return new Response('erro', { status: 500 }); }
    } else if (estornado) {
      await admin.from('presentes').update({ status: 'cancelado' }).eq('id', ref).eq('status', 'pago');
      await admin.rpc('encerrar_concessao', { p_origem: 'presente', p_ref: ref });
    }
    return new Response('ok');
  }
  return new Response('ignorado');
}

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

  const tipo = String(body?.type ?? url.searchParams.get('type') ?? '');
  const eventId = `${tipo || 'evt'}:${body?.action ?? ''}:${dataId}:${parts.ts}`;
  const { error: dup } = await admin.from('pagamentos_eventos').insert({ id: eventId, provedor: 'mercadopago', payload: body });
  if (dup) return new Response('ok (repetido)');            // idempotência

  if (tipo.includes('preapproval')) return assinatura(dataId);
  if (tipo === 'payment') return pagamento(dataId);
  return new Response('ignorado');
});
