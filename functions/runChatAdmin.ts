import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);

        // Create a fresh conversation with the admin agent
        const conversation = await base44.asServiceRole.agents.createConversation({
            agent_name: 'chat_admin',
            metadata: { name: 'Auto Admin Review Run', type: 'scheduled' }
        });

        // Tell the agent to check for unreviewed escalations
        await base44.asServiceRole.agents.addMessage(conversation, {
            role: 'user',
            content: 'Check the ModerationLog entity for any entries where escalated is true AND escalated_to is "admin" AND already_reviewed is NOT true. Review each one, take appropriate action (extend mutes, apply permanent bans where required, escalate to superuser if needed), then mark each handled entry as already_reviewed: true. Act now.'
        });

        return Response.json({ success: true, conversation_id: conversation.id });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});