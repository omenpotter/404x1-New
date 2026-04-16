import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const {
            moderator_id,
            target_player_id,
            action_type,
            reason,
            message_id,
            rp_penalty,
            duration_hours
        } = await req.json();

        if (!moderator_id || !target_player_id || !action_type) {
            return Response.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const base44 = createClientFromRequest(req);

        const moderator = await base44.asServiceRole.entities.Player.get(moderator_id);
        if (!moderator || !['moderator', 'admin', 'superuser'].includes(moderator.user_role)) {
            return Response.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
        }

        const targetPlayer = await base44.asServiceRole.entities.Player.get(target_player_id);
        if (!targetPlayer) {
            return Response.json({ error: 'Target player not found' }, { status: 404 });
        }

        const roleHierarchy = { member: 1, trusted: 2, moderator: 3, admin: 4, superuser: 5 };

        if (roleHierarchy[targetPlayer.user_role] >= roleHierarchy[moderator.user_role]) {
            return Response.json({ success: false, error: 'Cannot moderate users with equal or higher role' }, { status: 403 });
        }

        let rpChange = 0;
        let actionResult = {};

        switch (action_type) {
            case 'spam_penalty': {
                let penalty = rp_penalty || 10;
                if (moderator.user_role === 'moderator' && penalty > 10) penalty = 10;
                else if (moderator.user_role === 'admin' && penalty > 20) penalty = 20;

                rpChange = -Math.abs(penalty);
                await base44.asServiceRole.entities.Player.update(target_player_id, {
                    reputation_points: targetPlayer.reputation_points + rpChange
                });
                actionResult = { penalty_applied: Math.abs(rpChange) };
                break;
            }

            case 'mute': {
                let muteDuration = duration_hours || 24;
                if (moderator.user_role === 'moderator' && muteDuration > 24) muteDuration = 24;
                else if (moderator.user_role === 'admin' && muteDuration > 168) muteDuration = 168;

                const muteUntil = new Date();
                muteUntil.setHours(muteUntil.getHours() + muteDuration);
                rpChange = -10;

                await base44.asServiceRole.entities.Player.update(target_player_id, {
                    is_muted: true,
                    muted_until: muteUntil.toISOString(),
                    muted_by: moderator_id,
                    reputation_points: targetPlayer.reputation_points + rpChange
                });
                actionResult = { muted_until: muteUntil.toISOString(), penalty_applied: 10 };
                break;
            }

            case 'unmute': {
                await base44.asServiceRole.entities.Player.update(target_player_id, {
                    is_muted: false,
                    muted_until: null,
                    muted_by: null
                });
                actionResult = { unmuted: true };
                break;
            }

            case 'delete_message': {
                if (!message_id) {
                    return Response.json({ success: false, error: 'message_id required' }, { status: 400 });
                }
                const messageToDelete = await base44.asServiceRole.entities.Message.get(message_id);
                if (!messageToDelete) {
                    return Response.json({ success: false, error: 'Message not found' }, { status: 404 });
                }
                await base44.asServiceRole.entities.Message.update(message_id, {
                    is_deleted: true,
                    deleted_by: moderator_id
                });
                rpChange = -5;
                await base44.asServiceRole.entities.Player.update(target_player_id, {
                    reputation_points: targetPlayer.reputation_points + rpChange
                });
                actionResult = { message_deleted: true, penalty_applied: 5 };
                break;
            }

            default:
                return Response.json({ success: false, error: 'Invalid action_type' }, { status: 400 });
        }

        await base44.asServiceRole.entities.ModerationLog.create({
            moderator_id,
            moderator_username: moderator.username,
            moderator_role: moderator.user_role,
            target_player_id,
            target_username: targetPlayer.username,
            action_type,
            rp_change: rpChange,
            reason: reason || null,
            message_id: message_id || null,
            duration_hours: duration_hours || null
        });

        return Response.json({ success: true, action_type, rp_change: rpChange, ...actionResult });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});