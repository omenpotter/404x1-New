import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const url = new URL(req.url);
        const limit = parseInt(url.searchParams.get('limit') || '50');
        const offset = parseInt(url.searchParams.get('offset') || '0');

        const base44 = createClientFromRequest(req);

        // Get messages sorted by creation date (newest first)
        const messages = await base44.asServiceRole.entities.Message.list('-created_date', limit + offset);
        
        // Apply offset manually and slice
        const paginatedMessages = messages.slice(offset, offset + limit);

        return Response.json({
            success: true,
            messages: paginatedMessages,
            total: messages.length
        });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});