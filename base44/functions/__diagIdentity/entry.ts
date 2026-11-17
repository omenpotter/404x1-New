import { createClientFromRequest } from 'npm:@base44/sdk@0.8.60';
import { authorizeCronOrAdmin } from '../../shared/session.ts';

// Temporary diagnostic: reports the identity and cron/admin decision a function sees.
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json().catch(() => ({}));
  let me: any = null;
  try {
    me = await base44.auth.me();
  } catch (e) {
    me = { error: (e as Error).message };
  }
  const auth = await authorizeCronOrAdmin(base44, body);
  return Response.json({
    hasAuthorizationHeader: !!req.headers.get('authorization'),
    me: me ? { id: me.id, role: me.role } : null,
    cronAdminMode: auth.mode,
    cronSecretConfigured: !!Deno.env.get('CRON_SECRET'),
  });
});