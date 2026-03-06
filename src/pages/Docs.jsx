import React, { useState } from 'react';
import { createPageUrl } from '@/utils';

const sections = [
  {
    id: 'platform',
    title: 'PLATFORM',
    icon: '⚡',
    content: [
      {
        heading: 'What is 404x1?',
        body: '404x1 is a community platform built around the 404 ERROR token on the X1 SVM blockchain. It combines a live token dashboard, global chat, direct messaging, an arcade game, and a reputation system into a single terminal-themed interface.'
      },
      {
        heading: 'Token Contract Address',
        body: '4o4UheANLdqF4gSV4zWTbCTCercQNSaTm6nVcDetzPb2\n\nFixed supply: 404,404 tokens. No minting. No admin keys. Only supply, liquidity, and the market.'
      },
      {
        heading: 'Authentication',
        body: 'Connect any Solana-compatible wallet (X1 Wallet recommended, Phantom, Backpack) or MetaMask. Your wallet address is your identity. Choose a permanent username on first login — it cannot be changed.'
      }
    ]
  },
  {
    id: 'rp',
    title: 'REPUTATION POINTS',
    icon: '💎',
    content: [
      {
        heading: 'What are RP?',
        body: 'Reputation Points (RP) are your on-platform standing. They are earned through chat activity, game performance, and receiving tips from other users. RP determines your role tier.'
      },
      {
        heading: 'Earning RP',
        body: '• Send a chat message → +1 RP\n• Send a reply → +2 RP\n• Post an image (trusted+) → +3 RP\n• Receive a reaction on your message → +1 RP\n• Score points in the game → variable RP\n• Receive a tip from another user → tip amount in RP\n• Moderation award (mod/admin) → variable'
      },
      {
        heading: 'Losing RP',
        body: '• Spam penalty (issued by moderator) → -10 to -50 RP\n• Repeated violations may result in mute or role demotion'
      },
      {
        heading: 'RP Caps & Limits',
        body: 'Tips are capped at 10 RP per transaction. Spam penalties are capped at 50 RP per action for moderators, 100 RP for admins. Superusers have no cap.'
      }
    ]
  },
  {
    id: 'roles',
    title: 'ROLE HIERARCHY',
    icon: '🏆',
    content: [
      {
        heading: 'Member (grey)',
        body: 'Default role. Can send messages, react, reply, and play the game. Earn RP to advance.'
      },
      {
        heading: 'Trusted (cyan) — 100+ RP',
        body: 'Unlocked at 100 RP. Can post images in chat, earn slightly more RP per action. Trusted badge shown next to username.'
      },
      {
        heading: 'Moderator (orange) — Assigned',
        body: 'Assigned by admins only. Can mute users (up to 24h), issue spam penalties (up to -50 RP), delete any message, pin/unpin messages. Cannot change roles.'
      },
      {
        heading: 'Admin (red) — Assigned',
        body: 'Assigned by superusers only. All moderator powers plus: mute up to 168h, penalties up to -100 RP, grant up to 500 RP, change roles up to moderator level.'
      },
      {
        heading: 'Superuser (purple) — Platform Owner',
        body: 'Full control. No caps. Can assign any role. Grant any RP amount. Permanent mutes. Access to all moderation tools.'
      }
    ]
  },
  {
    id: 'chat',
    title: 'CHAT RULES',
    icon: '💬',
    content: [
      {
        heading: 'General Rules',
        body: '1. No spam or flooding — you will be muted\n2. No hate speech or harassment\n3. No scam links or phishing attempts\n4. Keep it relevant — this is a token community chat\n5. Respect all role levels'
      },
      {
        heading: 'Features',
        body: '• Reply to any message with ↩ REPLY\n• React with emoji using 😀\n• Tip RP to any user with 💎 TIP\n• Send a DM with 💬 DM\n• Search message history with 🔍 SEARCH\n• Post images (Trusted+ only)\n• Pinned messages shown at the top (mods only)'
      },
      {
        heading: 'Message Limits',
        body: 'Max 500 characters per message. Image URLs must be direct links. You earn RP per message, but rate limiting prevents spam farming.'
      }
    ]
  },
  {
    id: 'game',
    title: 'GAME',
    icon: '🎮',
    content: [
      {
        heading: 'How to Play',
        body: 'Use arrow keys or WASD (desktop) or on-screen buttons (mobile) to move your character. Collect green tokens to score points. Avoid red enemies — they end your run on contact.'
      },
      {
        heading: 'Scoring',
        body: 'Each token collected = points. Enemies increase in speed and number as your score grows. The higher your score, the more RP you earn on submission.'
      },
      {
        heading: 'RP Rewards',
        body: 'After each game session, your score is submitted to the server. RP is awarded based on your performance tier. High scores are tracked on the leaderboard.'
      },
      {
        heading: 'Leaderboard',
        body: 'The game leaderboard tracks total score, high score, and games played. Chat RP is tracked separately on the chat leaderboard. Both tabs are visible on the Leaderboard page.'
      }
    ]
  },
  {
    id: 'token',
    title: 'TOKEN INFO',
    icon: '📊',
    content: [
      {
        heading: '404 ERROR Token',
        body: 'Ticker: 404\nChain: X1 SVM (Solana Virtual Machine)\nContract: 4o4UheANLdqF4gSV4zWTbCTCercQNSaTm6nVcDetzPb2\nTotal Supply: 404,404 (fixed)\nDecimals: 9'
      },
      {
        heading: 'Trading',
        body: 'Trade on xDEX: the primary DEX on X1 SVM.\nBridge from Solana to X1 via the official X1 bridge.\nPrice is quoted in XNT (Wrapped X1 native token).'
      },
      {
        heading: 'Philosophy',
        body: 'No roadmap. No utility promises. No supply expansion. No guarantees.\n\nError 404 — Roadmap Not Found.\nError 404 — Utility Not Found.\nError 404 — Guarantees Not Found.\n\nOnly supply, liquidity, and the market.'
      }
    ]
  }
];

export default function Docs() {
  const [activeSection, setActiveSection] = useState('platform');

  const current = sections.find(s => s.id === activeSection);

  return (
    <div style={{ minHeight: 'calc(100vh - 54px)', background: '#0a0a0a', display: 'flex' }}>
      <style>{`
        .docs-sidebar { width: 220px; border-right: 1px solid #2a2a2a; padding: 20px 0; flex-shrink: 0; background: #0d0d0d; }
        .docs-nav-item { padding: 10px 20px; cursor: pointer; font-family: 'Share Tech Mono', monospace; font-size: 12px; color: #888; display: flex; align-items: center; gap: 8px; transition: all 0.2s; border-left: 2px solid transparent; }
        .docs-nav-item:hover { color: #e0e0e0; background: #111; }
        .docs-nav-item.active { color: #7dff7d; border-left-color: #7dff7d; background: #111; }
        .docs-main { flex: 1; padding: 32px; max-width: 800px; overflow-y: auto; }
        .docs-title { font-family: 'Rubik Mono One', monospace; font-size: 28px; color: #7dff7d; letter-spacing: 4px; margin-bottom: 4px; text-shadow: 0 0 20px #7dff7d; }
        .docs-subtitle { color: #888; font-size: 12px; margin-bottom: 32px; letter-spacing: 2px; }
        .docs-section-title { font-family: 'Rubik Mono One', monospace; color: #7dff7d; font-size: 18px; letter-spacing: 2px; margin-bottom: 24px; padding-bottom: 10px; border-bottom: 1px solid #2a2a2a; display: flex; align-items: center; gap: 10px; }
        .docs-card { background: #0d1219; border: 1px solid #1a2a1a; padding: 20px; margin-bottom: 16px; border-radius: 2px; }
        .docs-card-heading { color: #5fffff; font-size: 13px; margin-bottom: 10px; letter-spacing: 1px; font-family: 'Share Tech Mono', monospace; }
        .docs-card-body { color: #888; font-size: 12px; line-height: 1.8; white-space: pre-line; font-family: 'Share Tech Mono', monospace; }
        .docs-cta { display: flex; gap: 10px; margin-top: 32px; flex-wrap: wrap; }
        .docs-cta-btn { padding: 10px 20px; border: 1px solid #7dff7d; background: transparent; color: #7dff7d; cursor: pointer; font-family: 'Share Tech Mono', monospace; font-size: 12px; text-decoration: none; transition: all 0.2s; }
        .docs-cta-btn:hover { background: #7dff7d; color: #0a0a0a; }
        @media(max-width: 600px) {
          .docs-sidebar { width: 100%; border-right: none; border-bottom: 1px solid #2a2a2a; padding: 10px 0; display: flex; flex-wrap: wrap; }
          .docs-nav-item { border-left: none; border-bottom: 2px solid transparent; padding: 8px 12px; font-size: 11px; }
          .docs-nav-item.active { border-bottom-color: #7dff7d; border-left-color: transparent; }
          .docs-main { padding: 20px 16px; }
        }
      `}</style>

      {/* Sidebar */}
      <div className="docs-sidebar">
        {sections.map(s => (
          <div
            key={s.id}
            className={`docs-nav-item${activeSection === s.id ? ' active' : ''}`}
            onClick={() => setActiveSection(s.id)}
          >
            <span>{s.icon}</span>
            <span>{s.title}</span>
          </div>
        ))}
      </div>

      {/* Main */}
      <div className="docs-main">
        <div className="docs-title">DOCS</div>
        <div className="docs-subtitle">404x1 PLATFORM DOCUMENTATION</div>

        {current && (
          <>
            <div className="docs-section-title">
              <span>{current.icon}</span>
              <span>{current.title}</span>
            </div>

            {current.content.map((item, i) => (
              <div key={i} className="docs-card">
                <div className="docs-card-heading">{item.heading}</div>
                <div className="docs-card-body">{item.body}</div>
              </div>
            ))}
          </>
        )}

        <div className="docs-cta">
          <a href={createPageUrl('Chat')} className="docs-cta-btn">→ ENTER CHAT</a>
          <a href={createPageUrl('Game')} className="docs-cta-btn">→ PLAY GAME</a>
          <a href={createPageUrl('Home')} className="docs-cta-btn">→ TOKEN DASHBOARD</a>
        </div>
      </div>
    </div>
  );
}