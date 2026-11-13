// CORS restrito à origem do app (defina APP_ORIGIN nos secrets; ex.: https://seuusuario.github.io)
export function cors(req: Request): Record<string, string> {
  const allowed = (Deno.env.get('APP_ORIGIN') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const origin = req.headers.get('origin') ?? '';
  return {
    'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : (allowed[0] ?? ''),
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}
export const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });
