import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (req.method === 'OPTIONS') {
    return new Response(null,{status:200,headers});
  }

  try{

    const body = await req.json();
    const payload = body.data || body;

    const wallet_address = payload.wallet_address;
    const username = payload.username;

    if(!wallet_address){
      return new Response(JSON.stringify({
        success:false,
        error:"wallet_address required"
      }),{status:200,headers});
    }

    const base44 = createClientFromRequest(req);

    // search players
    const players = await base44
      .asServiceRole
      .entities
      .Player
      .filter({wallet_address});

    const existing = players[0];

    // EXISTING USER LOGIN
    if(existing){

      await base44.asServiceRole.entities.Player.update(existing.id,{
        last_seen:new Date().toISOString()
      });

      return new Response(JSON.stringify({
        success:true,
        existing:true,
        user:{
          id:existing.id,
          wallet_address:existing.wallet_address,
          username:existing.username,
          reputation_points:existing.reputation_points,
          total_score:existing.total_score,
          games_played:existing.games_played,
          user_role:existing.user_role
        }
      }),{status:200,headers});
    }

    // NEW WALLET → ask username
    if(!username){

      return new Response(JSON.stringify({
        success:true,
        existing:false,
        needs_username:true
      }),{status:200,headers});

    }

    // username validation
    if(username.length <3 || username.length >16){
      return new Response(JSON.stringify({
        success:false,
        error:"Username must be 3-16 characters"
      }),{status:200,headers});
    }

    if(!/^[a-zA-Z0-9_]+$/.test(username)){
      return new Response(JSON.stringify({
        success:false,
        error:"Username can only contain letters numbers underscore"
      }),{status:200,headers});
    }

    const takenCheck = await base44
      .asServiceRole
      .entities
      .Player
      .list(null,1000);

    const taken = takenCheck.find(
      p => p.username &&
      p.username.toLowerCase() === username.toLowerCase()
    );

    if(taken){
      return new Response(JSON.stringify({
        success:false,
        error:"Username already taken"
      }),{status:200,headers});
    }

    // CREATE PLAYER
    const player = await base44
      .asServiceRole
      .entities
      .Player
      .create({
        wallet_address,
        username,
        reputation_points:0,
        total_score:0,
        games_played:0,
        user_role:"member",
        last_seen:new Date().toISOString()
      });

    return new Response(JSON.stringify({
      success:true,
      existing:false,
      user:{
        id:player.id,
        wallet_address:player.wallet_address,
        username:player.username,
        reputation_points:player.reputation_points,
        total_score:player.total_score,
        games_played:player.games_played,
        user_role:player.user_role
      }
    }),{status:200,headers});

  }

  catch(err){

    console.error("authWallet error:",err);

    return new Response(JSON.stringify({
      success:false,
      error:err.message
    }),{status:200,headers});

  }

});
