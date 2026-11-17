// Shared CORS policy for the backend functions that answer browser calls directly.
// The app and its functions share a host, so cross-origin only happens for the
// custom domain, Vercel previews and local development. Anything else gets no grant.

const ALLOWED_HOSTS = ['404x1.xyz', 'www.404x1.xyz', 'localhost', '127.0.0.1'];
const ALLOWED_SUFFIXES = ['.base44.app', '.vercel.app'];

export function allowedOrigin(origin: string | null): string | null {
  if (!origin) return null;
  try {
    const host = new URL(origin).hostname.toLowerCase();
    if (ALLOWED_HOSTS.includes(host)) return origin;
    return ALLOWED_SUFFIXES.some(s => host.endsWith(s)) ? origin : null;
  } catch {
    return null;
  }
}

export function corsHeaders(req: Request, methods = 'GET, POST, OPTIONS'): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': methods,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Vary': 'Origin',
    'Content-Type': 'application/json',
  };
  const origin = allowedOrigin(req.headers.get('origin'));
  if (origin) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}