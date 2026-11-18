import { createClientFromRequest } from 'npm:@base44/sdk@0.8.60';
import { authorizeCronOrAdmin } from '../../shared/session.ts';

// DISABLED IN PRODUCTION.
//
// This endpoint created real Player rows and real chat messages in the live database on every
// wave, which is how test accounts and stress-bot records reached production data. A backend
// function has no environment flag, so "off unless someone deliberately turns it on" is the only
// safe setting: it refuses before touching the database, for cron, admin and platform callers
// alike. Re-enabling it means pointing it at a non-production database, not re-setting a secret.
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json().catch(() => ({}));
  // The authorization check stays so an unauthorised caller still cannot probe this endpoint.
  const auth = await authorizeCronOrAdmin(base44, body);
  if (!auth.ok) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return Response.json({
    disabled: true,
    reason: 'runStressTest is disabled in production and writes no data'
  }, { status: 403 });
});