import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const { 
            admin_id, 
            target_player_id, 
            new_role,
            reason 
        } = await req.json();

        if (!admin_id || !target_player_id || !new_role) {
            return Response.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const base44 = createClientFromRequest(req);

        // Get admin
        const admin = await base44.asServiceRole.entities.Player.get(admin_id);

        // ONLY superuser can change roles
        if (!admin || admin.user_role !== 'superuser') {
            return Response.json({ 
                success: false, 
                error: 'Only superuser can assign or change roles' 
            }, { status: 403 });
        }

        // Get target player
        const targetPlayer = await base44.asServiceRole.entities.Player.get(target_player_id);

        if (!targetPlayer) {
            return Response.json({ error: 'Target player not found' }, { status: 404 });
        }

        // Role hierarchy
        const roleHierarchy = {
            'member': 1,
            'trusted': 2,
            'moderator': 3,
            'admin': 4,
            'superuser': 5
        };

        // Cannot change role of someone with equal or higher role
        if (roleHierarchy[targetPlayer.user_role] >= roleHierarchy[admin.user_role]) {
            return Response.json({ 
                success: false, 
                error: 'Cannot change role of users with equal or higher role' 
            }, { status: 403 });
        }

        const oldRole = targetPlayer.user_role;

        // Update role
        await base44.asServiceRole.entities.Player.update(target_player_id, {
            user_role: new_role
        });

        // Log the change
        await base44.asServiceRole.entities.ModerationLog.create({
            moderator_id: admin_id,
            moderator_username: admin.username,
            moderator_role: admin.user_role,
            target_player_id: target_player_id,
            target_username: targetPlayer.username,
            action_type: 'change_role',
            reason: reason || null,
            old_role: oldRole,
            new_role: new_role
        });

        return Response.json({
            success: true,
            old_role: oldRole,
            new_role: new_role,
            target_username: targetPlayer.username
        });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});