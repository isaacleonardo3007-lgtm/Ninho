// CORS restrito à origem do app (defina APP_ORIGIN nos secrets; ex.: https://seuusuario.github.io)
export function cors(req: Request, methods = 'POST, OPTIONS'): Record<string, string> {
  const allowed = (Deno.env.get('APP_ORIGIN') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const origin = req.headers.get('origin') ?? '';
  return {
    'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : (allowed[0] ?? ''),
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': methods,
    'Vary': 'Origin',
  };
}
export const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });

// Endereço de retorno do pagamento: só aceita páginas do próprio app (APP_ORIGIN).
// Ex.: https://usuario.github.io/Ninho/ (o app roda numa subpasta no GitHub Pages).
export function retornoSeguro(url: unknown, padrao = ''): string {
  const allowed = (Deno.env.get('APP_ORIGIN') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  try {
    const u = new URL(String(url));
    if (allowed.includes(u.origin)) return u.origin + u.pathname;
  } catch (_) { /* inválido */ }
  return padrao || (allowed[0] ?? '') + '/';
}

// Preços e regras editáveis no painel (tabela public.app_config). Se a tabela não
// responder, usa os secrets PRECO_* e, por fim, os valores padrão.
// deno-lint-ignore no-explicit-any
export async function lerConfig(client: any): Promise<{ precos: { passe: number; reta_final: number; mensal: number; anual: number }; reta_final_desde: number }> {
  const env = (k: string, d: number) => Number(Deno.env.get(k) ?? d) || d;
  const padrao = { passe: env('PRECO_PASSE', 89.9), reta_final: env('PRECO_RETA_FINAL', 59.9), mensal: env('PRECO_MENSAL', 14.9), anual: env('PRECO_ANUAL', 119) };
  try {
    const { data } = await client.from('app_config').select('dados').eq('id', 1).maybeSingle();
    const p = data?.dados?.precos ?? {};
    const ok = (v: unknown, d: number) => (Number.isFinite(Number(v)) && Number(v) >= 1 ? Number(v) : d);
    return { precos: { passe: ok(p.passe, padrao.passe), reta_final: ok(p.reta_final, padrao.reta_final), mensal: ok(p.mensal, padrao.mensal), anual: padrao.anual },
      reta_final_desde: Number(data?.dados?.reta_final_desde) || 28 };
  } catch (_) { return { precos: padrao, reta_final_desde: 28 }; }
}
