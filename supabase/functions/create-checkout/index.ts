// Cria a assinatura Ninho+ no Mercado Pago (preapproval) e devolve o link de pagamento.
// Secrets: MP_ACCESS_TOKEN, APP_ORIGIN, PRECO_MENSAL (ex. 14.90), PRECO_ANUAL (ex. 119.00)
import { createClient } from 'npm:@supabase/supabase-js@2';
import { cors, json } from '../_shared/cors.ts';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

Deno.serve(async (req) => {
  const h = cors(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: h });
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: { user } } = await admin.auth.getUser(token);
  if (!user) return json({ error: 'unauthorized' }, 401, h);
  const { ciclo } = await req.json().catch(() => ({ ciclo: 'mensal' }));
  const anual = ciclo === 'anual';
  const valor = Number(Deno.env.get(anual ? 'PRECO_ANUAL' : 'PRECO_MENSAL') ?? (anual ? '119' : '14.9'));
  const origin = (Deno.env.get('APP_ORIGIN') ?? '').split(',')[0];
  const r = await fetch('https://api.mercadopago.com/preapproval', {
    method: 'POST',
    headers: { Authorization: `Bearer ${Deno.env.get('MP_ACCESS_TOKEN')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      reason: `Ninho+ ${anual ? 'anual' : 'mensal'}`,
      external_reference: user.id,
      payer_email: user.email,
      back_url: `${origin}/?assinatura=retorno`,
      auto_recurring: { frequency: anual ? 12 : 1, frequency_type: 'months', transaction_amount: valor, currency_id: 'BRL' },
      status: 'pending',
    }),
  });
  const data = await r.json();
  if (!r.ok) { console.error('mp', data); return json({ error: 'checkout' }, 502, h); }
  await admin.from('assinaturas').update({ provedor: 'mercadopago', provedor_ref: data.id, ciclo: anual ? 'anual' : 'mensal' }).eq('user_id', user.id);
  return json({ url: data.init_point }, 200, h);
});
