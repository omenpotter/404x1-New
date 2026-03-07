import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);

        // Create a fresh conversation with the moderator agent
        const conversation = await base44.asServiceRole.agents.createConversation({
            agent_name: 'chat_moderator',
            metadata: { name: 'Auto Moderation Run', type: 'scheduled' }
        });

        // Tell the agent to review recent messages
        await base44.asServiceRole.agents.addMessage(conversation, {
            role: 'user',
            content: 'Review the last 50 messages in the Message entity for any rule violations. Check for spam, off-topic content, NSFW, scams, hate speech, doxxing, impersonation, and raw CA drops. Take appropriate action on any violations you find and log everything to ModerationLog. Act now.'
        });

        return Response.json({ success: true, conversation_id: conversation.id });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});