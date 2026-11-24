// Ninho+ de presente (não exige conta de quem compra).
//  POST { comprador_nome, comprador_email, para_nome?, mensagem?, retorno } → { url } do Mercado Pago
//  GET  ?t=<token> → { status, codigo? } — o código só aparece depois do pagamento aprovado
// O token fica só com quem comprou (vai na URL de retorno); o código é o que a gestante digita no app.
// Secrets: MP_ACCESS_TOKEN, APP_ORIGIN. Preço: painel de administração (app_config).
import { createClient } from 'npm:@supabase/supabase-js@2';
import { cors, json, lerConfig, retornoSeguro } from '../_shared/cors.ts';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const ABC = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const rand = (n: number) => { const b = crypto.getRandomValues(new Uint8Array(n)); return [...b].map((x) => ABC[x % ABC.length]).join(''); };
const txt = (v: unknown, max: number) => String(v ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, max);
const reEmail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

Deno.serve(async (req) => {
  const h = cors(req, 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return new Response('ok', { headers: h });

  if (req.method === 'GET') {
    const t = new URL(req.url).searchParams.get('t') ?? '';
    if (!/^[A-Za-z0-9]{40,80}$/.test(t)) return json({ error: 'token' }, 400, h);
    const { data } = await admin.from('presentes').select('status,codigo,para_nome').eq('token', t).maybeSingle();
    if (!data) return json({ error: 'nao_encontrado' }, 404, h);
    const pago = data.status === 'pago' || data.status === 'resgatado';
    return json({ status: data.status, para_nome: data.para_nome, codigo: pago ? data.codigo.slice(0, 5) + '-' + data.codigo.slice(5) : null }, 200, h);
  }
  if (req.method !== 'POST') return json({ error: 'metodo' }, 405, h);

  const b = await req.json().catch(() => ({}));
  const nome = txt(b.comprador_nome, 80), email = txt(b.comprador_email, 200).toLowerCase();
  if (!nome || !reEmail.test(email)) return json({ error: 'dados' }, 400, h);
  // limite simples contra abuso: até 5 presentes pendentes por e-mail na última hora
  const desde = new Date(Date.now() - 3600e3).toISOString();
  const { count } = await admin.from('presentes').select('id', { count: 'exact', head: true }).eq('comprador_email', email).eq('status', 'pendente').gt('created_at', desde);
  if ((count ?? 0) >= 5) return json({ error: 'limite' }, 429, h);

  const valor = (await lerConfig(admin)).precos.passe;
  const token = rand(48);
  const { data: p, error } = await admin.from('presentes').insert({
    codigo: rand(10), token, comprador_nome: nome, comprador_email: email,
    para_nome: txt(b.para_nome, 80) || null, mensagem: txt(b.mensagem, 300) || null, valor,
  }).select('id').single();
  if (error) { console.error(error); return json({ error: 'db' }, 500, h); }

  const retorno = retornoSeguro(b.retorno);
  const r = await fetch('https://api.mercadopago.com/checkout/preferences', {
    method: 'POST',
    headers: { Authorization: `Bearer ${Deno.env.get('MP_ACCESS_TOKEN')}`, 'Content-Type': 'application/json', 'X-Idempotency-Key': p.id },
    body: JSON.stringify({
      items: [{ id: 'presente', title: 'Ninho+ de presente (Passe Gestação)', quantity: 1, unit_price: valor, currency_id: 'BRL' }],
      external_reference: `presente:${p.id}`,
      payer: { email, name: nome },
      back_urls: { success: `${retorno}?t=${token}`, pending: `${retorno}?t=${token}`, failure: `${retorno}?t=${token}&falhou=1` },
      auto_return: 'approved',
      notification_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/payment-webhook`,
      statement_descriptor: 'NINHO',
    }),
  });
  const data = await r.json();
  if (!r.ok) { console.error('mp', data); return json({ error: 'checkout' }, 502, h); }
  return json({ url: data.init_point, t: token }, 200, h);
});
