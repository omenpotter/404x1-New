import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const { user_id, bio } = await req.json();

  if (!user_id) return Response.json({ success: false, error: 'user_id required' });

  const trimmed = (bio || '').slice(0, 300);

  try {
    await base44.asServiceRole.entities.Player.update(user_id, { bio: trimmed });
    return Response.json({ success: true, bio: trimmed });
  } catch (e) {
    return Response.json({ success: false, error: e.message }, { status: 500 });
  }
});