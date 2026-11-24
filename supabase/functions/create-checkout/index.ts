// Abre o pagamento do Ninho+ no Mercado Pago e devolve o link.
//  - ciclo 'passe'  → pagamento único (Pix ou cartão), Checkout Pro. Vale até DPP + 90 dias.
//  - ciclo 'mensal' / 'anual' → assinatura recorrente (preapproval).
//  O Passe custa menos para quem entra a partir da semana 'reta_final_desde' (Passe Reta Final).
// Preços: painel de administração (app_config). Secrets: MP_ACCESS_TOKEN, APP_ORIGIN (PRECO_* só como reserva).
import { createClient } from 'npm:@supabase/supabase-js@2';
import { cors, json, lerConfig, retornoSeguro } from '../_shared/cors.ts';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const MP = 'https://api.mercadopago.com';
const mp = (path: string, body: unknown) => fetch(MP + path, {
  method: 'POST',
  headers: { Authorization: `Bearer ${Deno.env.get('MP_ACCESS_TOKEN')}`, 'Content-Type': 'application/json', 'X-Idempotency-Key': crypto.randomUUID() },
  body: JSON.stringify(body),
});

Deno.serve(async (req) => {
  const h = cors(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: h });
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: { user } } = await admin.auth.getUser(token);
  if (!user) return json({ error: 'unauthorized' }, 401, h);
  const body = await req.json().catch(() => ({}));
  const ciclo = ['passe', 'mensal', 'anual'].includes(body?.ciclo) ? body.ciclo : 'passe';
  const retorno = retornoSeguro(body?.retorno);

  const cfg = await lerConfig(admin);
  if (ciclo === 'passe') {
    const { data: dpp } = await admin.rpc('dpp_atual_servico', { uid: user.id });
    const semana = dpp ? 40 - Math.ceil((new Date(dpp + 'T12:00:00Z').getTime() - Date.now()) / (7 * 864e5)) : 0;
    const reta = semana >= cfg.reta_final_desde;
    const valor = reta ? cfg.precos.reta_final : cfg.precos.passe;
    const r = await mp('/checkout/preferences', {
      items: [{ id: reta ? 'passe-reta-final' : 'passe-gestacao', title: reta ? 'Ninho+ Passe Reta Final' : 'Ninho+ Passe Gestação', description: 'Ninho+ até 3 meses após o parto (pagamento único)', quantity: 1, unit_price: valor, currency_id: 'BRL' }],
      external_reference: `passe:${user.id}`,
      payer: { email: user.email },
      back_urls: { success: `${retorno}?pagamento=ok`, pending: `${retorno}?pagamento=pendente`, failure: `${retorno}?pagamento=falhou` },
      auto_return: 'approved',
      notification_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/payment-webhook`,
      statement_descriptor: 'NINHO',
    });
    const data = await r.json();
    if (!r.ok) { console.error('mp', data); return json({ error: 'checkout' }, 502, h); }
    return json({ url: data.init_point }, 200, h);
  }

  const anual = ciclo === 'anual';
  const valor = anual ? cfg.precos.anual : cfg.precos.mensal;
  const r = await mp('/preapproval', {
    reason: `Ninho+ ${anual ? 'anual' : 'mensal'}`,
    external_reference: user.id,
    payer_email: user.email,
    back_url: `${retorno}?assinatura=retorno`,
    auto_recurring: { frequency: anual ? 12 : 1, frequency_type: 'months', transaction_amount: valor, currency_id: 'BRL' },
    status: 'pending',
  });
  const data = await r.json();
  if (!r.ok) { console.error('mp', data); return json({ error: 'checkout' }, 502, h); }
  await admin.from('assinaturas').update({ provedor: 'mercadopago', provedor_ref: data.id, ciclo: anual ? 'anual' : 'mensal' }).eq('user_id', user.id);
  return json({ url: data.init_point }, 200, h);
});
