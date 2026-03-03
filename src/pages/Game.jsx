import React, { useState, useEffect, useRef } from 'react';
import { createPageUrl } from '@/utils';

const BASE = 'https://code-quest-zone.base44.app/api/apps/6988b1920d2dc3e06784fc73/functions/';

function getUser() {
  try { return JSON.parse(localStorage.getItem('404x1_user') || 'null'); } catch { return null; }
}

// Simple terminal-style game: dodge falling enemies, collect tokens
const CANVAS_W = 480;
const CANVAS_H = 360;
const PLAYER_SIZE = 24;
const ENEMY_SIZE = 18;
const TOKEN_SIZE = 14;

export default function Game() {
  const [user, setUser] = useState(null);
  const [gameState, setGameState] = useState('idle'); // idle | playing | dead | submitted
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [level, setLevel] = useState(1);
  const [highScore, setHighScore] = useState(0);
  const [stats, setStats] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const canvasRef = useRef(null);
  const gameRef = useRef({});
  const animRef = useRef(null);

  useEffect(() => {
    const u = getUser();
    setUser(u);
    if (u) fetchStats(u.id);
  }, []);

  const fetchStats = async (userId) => {
    try {
      const res = await fetch(BASE + `gameStats?user_id=${userId}`);
      const data = await res.json();
      if (data.success) {
        setStats(data.stats);
        setHighScore(data.stats.high_score || 0);
      }
    } catch {}
  };

  const startGame = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const g = {
      player: { x: CANVAS_W / 2, y: CANVAS_H - 50, speed: 5 },
      enemies: [],
      tokens: [],
      score: 0,
      lives: 3,
      level: 1,
      tick: 0,
      keys: {},
      running: true,
      deaths: 0,
      spawnRate: 80,
    };
    gameRef.current = g;

    setGameState('playing');
    setScore(0);
    setLives(3);
    setLevel(1);

    const handleKey = (e) => {
      const k = e.type === 'keydown';
      g.keys[e.key] = k;
    };
    window.addEventListener('keydown', handleKey);
    window.addEventListener('keyup', handleKey);

    const loop = () => {
      if (!g.running) return;
      g.tick++;

      // Move player
      if (g.keys['ArrowLeft'] || g.keys['a']) g.player.x = Math.max(PLAYER_SIZE / 2, g.player.x - g.player.speed);
      if (g.keys['ArrowRight'] || g.keys['d']) g.player.x = Math.min(CANVAS_W - PLAYER_SIZE / 2, g.player.x + g.player.speed);
      if (g.keys['ArrowUp'] || g.keys['w']) g.player.y = Math.max(PLAYER_SIZE / 2, g.player.y - g.player.speed);
      if (g.keys['ArrowDown'] || g.keys['s']) g.player.y = Math.min(CANVAS_H - PLAYER_SIZE / 2, g.player.y + g.player.speed);

      // Spawn enemies
      if (g.tick % g.spawnRate === 0) {
        g.enemies.push({ x: Math.random() * (CANVAS_W - ENEMY_SIZE), y: -ENEMY_SIZE, speed: 2 + g.level * 0.5 + Math.random() * 1.5 });
      }
      // Spawn tokens
      if (g.tick % 120 === 0) {
        g.tokens.push({ x: Math.random() * (CANVAS_W - TOKEN_SIZE), y: -TOKEN_SIZE, speed: 1.5 + Math.random() });
      }

      // Move enemies
      g.enemies.forEach(e => { e.y += e.speed; });
      g.enemies = g.enemies.filter(e => e.y < CANVAS_H + ENEMY_SIZE);

      // Move tokens
      g.tokens.forEach(t => { t.y += t.speed; });
      g.tokens = g.tokens.filter(t => t.y < CANVAS_H + TOKEN_SIZE);

      // Collision — enemies
      const hitEnemy = g.enemies.findIndex(e =>
        Math.abs(e.x + ENEMY_SIZE / 2 - g.player.x) < (PLAYER_SIZE + ENEMY_SIZE) / 2 - 4 &&
        Math.abs(e.y + ENEMY_SIZE / 2 - g.player.y) < (PLAYER_SIZE + ENEMY_SIZE) / 2 - 4
      );
      if (hitEnemy >= 0) {
        g.lives--;
        g.deaths++;
        g.enemies.splice(hitEnemy, 1);
        setLives(g.lives);
        if (g.lives <= 0) {
          g.running = false;
          window.removeEventListener('keydown', handleKey);
          window.removeEventListener('keyup', handleKey);
          cancelAnimationFrame(animRef.current);
          setScore(g.score);
          setGameState('dead');
          return;
        }
      }

      // Collision — tokens
      g.tokens = g.tokens.filter(t => {
        const hit = Math.abs(t.x + TOKEN_SIZE / 2 - g.player.x) < (PLAYER_SIZE + TOKEN_SIZE) / 2 &&
                    Math.abs(t.y + TOKEN_SIZE / 2 - g.player.y) < (PLAYER_SIZE + TOKEN_SIZE) / 2;
        if (hit) { g.score += 10 * g.level; setScore(g.score); }
        return !hit;
      });

      // Level up every 500 points
      const newLevel = Math.floor(g.score / 500) + 1;
      if (newLevel > g.level) {
        g.level = newLevel;
        g.spawnRate = Math.max(30, 80 - g.level * 5);
        setLevel(newLevel);
      }

      // Survive bonus
      if (g.tick % 60 === 0) { g.score += g.level; setScore(g.score); }

      // Draw
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      // Grid lines
      ctx.strokeStyle = '#111';
      ctx.lineWidth = 1;
      for (let x = 0; x < CANVAS_W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CANVAS_H); ctx.stroke(); }
      for (let y = 0; y < CANVAS_H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CANVAS_W, y); ctx.stroke(); }

      // Tokens
      g.tokens.forEach(t => {
        ctx.fillStyle = '#ffaa00';
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#ffaa00';
        ctx.fillRect(t.x, t.y, TOKEN_SIZE, TOKEN_SIZE);
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#0a0a0a';
        ctx.font = '9px monospace';
        ctx.fillText('◆', t.x + 2, t.y + 11);
      });

      // Enemies
      g.enemies.forEach(e => {
        ctx.fillStyle = '#ff4444';
        ctx.shadowBlur = 6;
        ctx.shadowColor = '#ff4444';
        ctx.fillRect(e.x, e.y, ENEMY_SIZE, ENEMY_SIZE);
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#0a0a0a';
        ctx.font = '11px monospace';
        ctx.fillText('✕', e.x + 3, e.y + 13);
      });

      // Player
      ctx.fillStyle = '#7dff7d';
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#7dff7d';
      ctx.fillRect(g.player.x - PLAYER_SIZE / 2, g.player.y - PLAYER_SIZE / 2, PLAYER_SIZE, PLAYER_SIZE);
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#0a0a0a';
      ctx.font = '14px monospace';
      ctx.fillText('▲', g.player.x - 7, g.player.y + 5);

      // HUD
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, 0, CANVAS_W, 28);
      ctx.fillStyle = '#7dff7d';
      ctx.font = '11px "Share Tech Mono", monospace';
      ctx.fillText(`SCORE: ${g.score}`, 10, 18);
      ctx.fillStyle = '#ff4444';
      ctx.fillText(`LIVES: ${'♥'.repeat(g.lives)}`, 160, 18);
      ctx.fillStyle = '#5fffff';
      ctx.fillText(`LVL: ${g.level}`, 340, 18);

      animRef.current = requestAnimationFrame(loop);
    };

    animRef.current = requestAnimationFrame(loop);
  };

  const submitScore = async () => {
    const u = getUser();
    if (!u) return;
    setSubmitting(true);
    try {
      const res = await fetch(BASE + 'gameSubmit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: u.id,
          score,
          level_reached: level,
          deaths: gameRef.current.deaths || 0,
          time_seconds: Math.floor((gameRef.current.tick || 0) / 60)
        })
      });
      const data = await res.json();
      if (data.success) {
        setLastResult(data);
        if (score > highScore) setHighScore(score);
        const updated = { ...u, reputation_points: data.total_rp || u.reputation_points };
        localStorage.setItem('404x1_user', JSON.stringify(updated));
        setUser(updated);
        setGameState('submitted');
        fetchStats(u.id);
      }
    } catch {}
    setSubmitting(false);
  };

  // Touch controls
  const handleTouchMove = (e) => {
    const g = gameRef.current;
    if (!g || !g.running) return;
    const touch = e.touches[0];
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    g.player.x = (touch.clientX - rect.left) * scaleX;
    g.player.y = (touch.clientY - rect.top) * scaleY;
  };

  return (
    <div style={{ minHeight: 'calc(100vh - 54px)', background: '#0a0a0a', padding: '20px', fontFamily: "'Share Tech Mono', monospace" }}>
      <style>{`
        .game-wrap { max-width: 900px; margin: 0 auto; display: grid; grid-template-columns: 1fr 260px; gap: 20px; }
        .game-main {}
        .game-title { font-family: 'Rubik Mono One', monospace; color: #7dff7d; font-size: 24px; margin-bottom: 4px; letter-spacing: 3px; text-shadow: 0 0 15px #7dff7d; }
        .game-sub { color: #888; font-size: 11px; margin-bottom: 16px; }
        .canvas-wrap { position: relative; background: #0a0a0a; border: 1px solid #2a2a2a; display: inline-block; width: 100%; }
        canvas { display: block; width: 100%; height: auto; }
        .game-overlay { position: absolute; top: 0; left: 0; right: 0; bottom: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; background: rgba(0,0,0,0.85); }
        .overlay-title { font-family: 'Rubik Mono One', monospace; font-size: 24px; margin-bottom: 12px; }
        .play-btn { padding: 12px 32px; border: 2px solid #7dff7d; background: transparent; color: #7dff7d; cursor: pointer; font-family: 'Share Tech Mono', monospace; font-size: 16px; transition: all 0.2s; margin-top: 12px; }
        .play-btn:hover { background: #7dff7d; color: #0a0a0a; }
        .play-btn:disabled { opacity: 0.4; }
        .sidebar {}
        .stat-card { background: #111; border: 1px solid #2a2a2a; padding: 16px; margin-bottom: 12px; }
        .stat-label { font-size: 10px; color: #888; margin-bottom: 4px; }
        .stat-value { font-size: 22px; font-family: 'Rubik Mono One', monospace; }
        .controls-card { background: #111; border: 1px solid #2a2a2a; padding: 16px; }
        .control-key { display: inline-block; padding: 2px 8px; border: 1px solid #2a2a2a; background: #1a1a1a; font-size: 11px; color: #5fffff; margin: 2px; }
        @media(max-width:600px){ .game-wrap{grid-template-columns:1fr;} }
      `}</style>

      <div className="game-wrap">
        <div className="game-main">
          <div className="game-title">404x1 RUNNER</div>
          <div className="game-sub">Dodge enemies ✕ &nbsp;|&nbsp; Collect tokens ◆ &nbsp;|&nbsp; Survive!</div>

          <div className="canvas-wrap">
            <canvas
              ref={canvasRef}
              width={CANVAS_W}
              height={CANVAS_H}
              onTouchMove={handleTouchMove}
              style={{ touchAction: 'none' }}
            />

            {gameState === 'idle' && (
              <div className="game-overlay">
                <div className="overlay-title" style={{ color: '#7dff7d' }}>404x1 RUNNER</div>
                <div style={{ fontSize: '12px', color: '#888', marginBottom: '8px' }}>Move with Arrow Keys or WASD</div>
                <div style={{ fontSize: '11px', color: '#444', marginBottom: '16px' }}>Dodge red enemies · Collect gold tokens</div>
                {!user && <div style={{ color: '#ff4444', fontSize: '11px', marginBottom: '8px' }}>⚠ Login to save your score</div>}
                <button className="play-btn" onClick={startGame}>▶ START GAME</button>
              </div>
            )}

            {gameState === 'dead' && (
              <div className="game-overlay">
                <div className="overlay-title" style={{ color: '#ff4444' }}>GAME OVER</div>
                <div style={{ color: '#7dff7d', fontSize: '20px', fontFamily: "'Rubik Mono One', monospace", margin: '8px 0' }}>{score.toLocaleString()}</div>
                <div style={{ color: '#888', fontSize: '11px', marginBottom: '16px' }}>Level {level} reached</div>
                {user ? (
                  <button className="play-btn" onClick={submitScore} disabled={submitting}>
                    {submitting ? 'SAVING...' : '💾 SAVE SCORE & CLAIM RP'}
                  </button>
                ) : (
                  <div style={{ color: '#888', fontSize: '11px', marginBottom: '8px' }}>Login to save score</div>
                )}
                <button className="play-btn" onClick={startGame} style={{ marginTop: '8px', fontSize: '13px', padding: '8px 20px' }}>🔄 PLAY AGAIN</button>
              </div>
            )}

            {gameState === 'submitted' && lastResult && (
              <div className="game-overlay">
                <div className="overlay-title" style={{ color: '#7dff7d' }}>SCORE SAVED!</div>
                <div style={{ color: '#5fffff', fontSize: '18px', fontFamily: "'Rubik Mono One', monospace" }}>+{lastResult.rp_earned} RP</div>
                {lastResult.rank && <div style={{ color: '#888', fontSize: '12px', marginTop: '4px' }}>Rank #{lastResult.rank}</div>}
                <div style={{ color: '#ffaa00', fontSize: '14px', margin: '12px 0' }}>Total: {(lastResult.total_rp || 0).toLocaleString()} RP</div>
                <button className="play-btn" onClick={startGame}>▶ PLAY AGAIN</button>
              </div>
            )}
          </div>

          <div style={{ marginTop: '12px', fontSize: '11px', color: '#444', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <span>📱 Touch: drag finger to move</span>
            <span>⌨ Keys: WASD or Arrow Keys</span>
          </div>
        </div>

        <div className="sidebar">
          <div className="stat-card">
            <div className="stat-label">CURRENT SCORE</div>
            <div className="stat-value" style={{ color: '#7dff7d' }}>{score.toLocaleString()}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">LIVES</div>
            <div className="stat-value" style={{ color: '#ff4444' }}>{'♥'.repeat(lives)}{'♡'.repeat(Math.max(0, 3 - lives))}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">LEVEL</div>
            <div className="stat-value" style={{ color: '#5fffff' }}>{level}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">HIGH SCORE</div>
            <div className="stat-value" style={{ color: '#ffaa00' }}>{highScore.toLocaleString()}</div>
          </div>

          {stats && (
            <div className="stat-card">
              <div className="stat-label" style={{ marginBottom: '10px' }}>CAREER STATS</div>
              <div style={{ display: 'grid', gap: '6px', fontSize: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#888' }}>Games</span>
                  <span>{stats.games_played || 0}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#888' }}>Avg Score</span>
                  <span style={{ color: '#5fffff' }}>{(stats.average_score || 0).toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#888' }}>Total</span>
                  <span style={{ color: '#7dff7d' }}>{(stats.total_score || 0).toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}

          <div className="controls-card">
            <div className="stat-label" style={{ marginBottom: '10px' }}>CONTROLS</div>
            <div style={{ fontSize: '11px', display: 'grid', gap: '6px' }}>
              <div><span className="control-key">W</span><span className="control-key">↑</span> Move Up</div>
              <div><span className="control-key">S</span><span className="control-key">↓</span> Move Down</div>
              <div><span className="control-key">A</span><span className="control-key">←</span> Move Left</div>
              <div><span className="control-key">D</span><span className="control-key">→</span> Move Right</div>
              <div style={{ marginTop: '4px', color: '#888' }}>◆ = +10×level points</div>
              <div style={{ color: '#ff4444' }}>✕ = lose a life</div>
            </div>
          </div>

          <div style={{ marginTop: '12px', textAlign: 'center' }}>
            <a href={createPageUrl('Leaderboard')} style={{ color: '#5fffff', fontSize: '11px', textDecoration: 'none' }}>
              🏆 View Full Leaderboard →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}