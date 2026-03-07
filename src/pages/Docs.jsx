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
        body: '• Send a chat message → +2 RP\n• Send a reply → +2 RP\n• Post an image (trusted+) → +3 RP\n• Receive a reaction on your message → +1 RP\n• Score points in the game → variable RP\n• Receive a tip from another user → tip amount in RP\n• Moderation award (mod/admin) → variable'
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
        heading: 'Trusted (cyan) — 10,000+ RP',
        body: 'Unlocked at 10,000 RP. Can post images in chat, earn slightly more RP per action. Trusted badge shown next to username.'
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
        heading: 'Welcome',
        body: '404x1 chat is a free, open space for the global crypto community. Talk about any chain, any token, any protocol. Share alpha, discuss markets, ask questions, debate ideas.\n\nOne requirement: keep it civil and keep it crypto. Break the rules and you get muted. Keep breaking them and you get banned.'
      },
      {
        heading: '✓ What Is Allowed',
        body: '• Any cryptocurrency topic — Bitcoin, Ethereum, Solana, X1, DeFi, NFTs, L2s, wallets, trading, tokenomics, on-chain data\n• Market discussion — price talk, chart analysis, macro crypto trends, exchange news, on-chain metrics\n• Project discussion — new launches, protocol updates, token analysis (be clear it is your own view)\n• Questions and learning — no question is too basic\n• Memes and culture — crypto memes and reaction gifs welcome, keep them clean and on-theme'
      },
      {
        heading: 'Rule 1 — Stay On Topic',
        body: 'This is a crypto chat. All conversations must relate to cryptocurrency, blockchain, and web3.\n\n✗ No general news or current events (unless it directly impacts crypto)\n✗ No sports, entertainment, or lifestyle content'
      },
      {
        heading: 'Rule 2 — No Politics',
        body: 'Political discussion is strictly prohibited. No exceptions.\n\n✗ No political parties or politicians\n✗ No elections or voting\n✗ No government policy debates\n✗ No political ideologies\n✗ No political memes or propaganda\n\nCrypto regulation can be discussed factually but not as a political debate.'
      },
      {
        heading: 'Rule 3 — No Religion',
        body: 'Religious discussion has no place in a crypto chat.\n\n✗ No religious debate\n✗ No proselytising\n✗ No religious commentary on other members\n✗ No religious imagery or symbols used to provoke'
      },
      {
        heading: 'Rule 4 — No Spam',
        body: '✗ No message flooding — do not send the same message multiple times\n✗ No excessive caps or symbols — TYPING LIKE THIS is treated as spam\n✗ No copy-paste walls — summarise or use DMs\n✗ No bot-like behaviour — automated posting is banned immediately\n✗ No emoji spam — a few emojis are fine, rows of 20 are not'
      },
      {
        heading: 'Rule 5 — No Scams or Financial Manipulation',
        body: 'Zero tolerance — first offence is a permanent ban.\n\n✗ No phishing links or fake sites\n✗ No fake giveaways\n✗ No guaranteed return claims ("100x guaranteed", "risk-free profit")\n✗ No coordinated pump and dump\n✗ No raw contract address drops without token name, chain, and context\n✗ No unsolicited DM solicitation ("DM me for alpha")'
      },
      {
        heading: 'Rule 6 — No NSFW Content',
        body: 'This is a public community with members of all ages.\n\n✗ No sexual or pornographic content\n✗ No graphic violence\n✗ No shock content'
      },
      {
        heading: 'Rule 7 — Respect Everyone',
        body: 'Debate is fine. Aggression, hate, and harassment are not.\n\n✗ No hate speech or slurs\n✗ No personal attacks — disagree with the idea, not the person\n✗ No harassment or threatening language\n✗ No doxxing — never share real names, locations, or personal info\n✗ No impersonation of developers, mods, or other members'
      },
      {
        heading: 'Rule 8 — No Unsolicited Self-Promotion',
        body: 'Sharing knowledge is encouraged. Advertising is not.\n\n✗ No shilling unrelated projects repeatedly\n✗ No advertising paid groups or channels without mod approval\n✗ No begging for tokens, loans, airdrops, or tips'
      },
      {
        heading: 'Rule 9 — Language',
        body: '→ English in main chat — so moderators can keep the community safe. Use DMs for other languages.\n→ No excessive profanity — casual language is fine, directing profanity at members is not.'
      },
      {
        heading: 'Rule 10 — Moderation',
        body: '→ Mod decisions are final in chat. If you disagree, DM a moderator — do not argue in public chat.\n→ Report bad behaviour — use the report function or DM a mod. Do not engage or retaliate.\n→ Mods are volunteers — treat them with respect.'
      },
      {
        heading: 'Message Limits',
        body: 'Max 5,000 characters per message. Image URLs must be direct links. You earn RP per message, but rate limiting prevents spam farming.'
      },
      {
        heading: 'Disclaimer',
        body: 'Nothing posted in this chat is financial advice. All discussion is for informational and entertainment purposes only. Always DYOR before making any investment decision. 404x1 and its moderators are not responsible for any trading decisions made based on chat content.'
      },
      {
        heading: 'Features',
        body: '• Reply to any message with ↩ REPLY\n• React with emoji using 😀\n• Tip RP to any user with 💎 TIP\n• Send a DM with 💬 DM\n• Search message history with 🔍 SEARCH\n• Post images (Trusted+ only)\n• Pinned messages shown at the top (mods only)'
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