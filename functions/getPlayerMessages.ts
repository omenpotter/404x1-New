import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { player_id, limit } = await req.json();
    if (!player_id) return Response.json({ error: 'player_id required' }, { status: 400 });

    const all = await base44.asServiceRole.entities.Message.list('-created_date', limit || 30);
    const msgs = all
      .filter(m => m.player_id === player_id && !m.is_deleted)
      .slice(0, limit || 20)
      .map(m => ({ id: m.id, message: m.message, created_date: m.created_date, is_deleted: m.is_deleted }));

    return Response.json({ success: true, messages: msgs });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
});