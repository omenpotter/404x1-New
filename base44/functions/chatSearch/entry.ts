import { createClientFromRequest } from 'npm:@base44/sdk@0.8.60';
import { corsHeaders } from '../../shared/cors.ts';

// Message search over recent public chat. The page posts { q, limit }; older builds used
// query parameters, so both are accepted. Results are capped and trimmed to public fields.
const MAX_LIMIT = 50;
const SCAN_WINDOW = 500;

async function readParams(req: Request) {
    const url = new URL(req.url);
    const query = { q: url.searchParams.get('q'), limit: url.searchParams.get('limit') };
    if (req.method !== 'POST') return query;
    const body = await req.json().catch(() => ({}));
    return { q: body?.q ?? query.q, limit: body?.limit ?? query.limit };
}

Deno.serve(async (req) => {
    const headers = corsHeaders(req, 'GET, POST, OPTIONS');
    if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers });

    try {
        const { q, limit } = await readParams(req);
        const needle = String(q || '').toLowerCase().trim();
        const take = Math.min(Math.max(parseInt(limit || '20', 10) || 20, 1), MAX_LIMIT);

        if (!needle) return Response.json({ success: true, messages: [] }, { headers });

        const base44 = createClientFromRequest(req);
        const recent = await base44.asServiceRole.entities.Message.list('-created_date', SCAN_WINDOW);

        const messages = recent
            .filter(m => !m.is_deleted && typeof m.message === 'string' && m.message.toLowerCase().includes(needle))
            .slice(0, take)
            .map(m => ({
                id: m.id,
                username: m.username,
                message: m.message,
                created_date: m.created_date
            }));

        return Response.json({ success: true, messages }, { headers });
    } catch (e) {
        return Response.json({ error: e.message }, { status: 500, headers });
    }
});