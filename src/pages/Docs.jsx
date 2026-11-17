import React, { useState, useMemo } from 'react';
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
    id: 'token',
    title: 'TOKEN INFO',
    icon: '📊',
    content: [
      {
        heading: 'Supply Information',
        body: 'Token name: 404\nTotal supply: 404,404 (fixed — cannot be changed)\nSupply type: Fixed\nMint Authority: Not Set\nDecimals: 9\nChain: X1 SVM (Solana Virtual Machine)\nContract: 4o4UheANLdqF4gSV4zWTbCTCercQNSaTm6nVcDetzPb2'
      },
      {
        heading: 'Trading',
        body: 'Trade on xDEX: the primary DEX on X1 SVM.\nBridge from Solana to X1 via the official X1 bridge.\nPrice is quoted in XNT (Wrapped X1 native token).'
      },
      {
        heading: 'Token Pools Summary',
        body: '💎 Initial Liquidity: 100 XNT paired against full 404,404 supply (Fair Launch Base)\n\n🛒 Market Purchases:\n  · 54.35 XNT → 15,003 404\n  · 22.45 XNT → 23,123 404\n  · 10 XNT → 4,999 404\n  · 19.46 XNT → 2,269+ XEN\n  Subtotal: 116.57 XNT\n\n🔗 Paired Liquidity Equivalents:\n  rXNT, PXNT, USDC.X, PEPE, XEN Pools\n  ~22–22.5 XNT per pool × 5 = 88.6 XNT\n\n🔒 Grand Total: ~305 XNT committed\n   All liquidity locked / burned — no withdrawals possible.'
      },
      {
        heading: '👤 Creator Transparency — 4.04%',
        body: 'Creator allocation: 4.04% of total supply\nMethod: Acquired openly and transparently via the public pool.\nNo private allocation. No early access. No insider wallets.'
      },
      {
        heading: '⚖️ Fairness Model',
        body: '✗ No private allocation\n✗ No early access\n✗ No insider wallets\n✗ No presale\n✗ No whitelist\n✗ No free mint\n\nLiquidity was added directly to the DEX. Price discovery is left entirely to the market.'
      },
      {
        heading: '☠️ Risk & Philosophy',
        body: 'If you bought, you bought from the pool.\nIf you didn\'t, nothing was taken from you.\n\n404 is a minimal, experimental meme token.\nThere is no destination. There is no direction.\nOnly supply, liquidity, and the market.\n\nIf you are looking for certainty, you are on the wrong page.'
      },
      {
        heading: '❓ FAQ (404 Style)',
        body: 'Is there a roadmap?\n  ❌ Error 404 — Roadmap Not Found\n\nCan more tokens be minted?\n  ❌ Error 404 — Supply Expansion Not Found\n\nIs success guaranteed?\n  ❌ Error 404 — Guarantees Not Found\n\nIs there utility?\n  ❌ Error 404 — Utility Not Found'
      },
      {
        heading: '🔗 Links',
        links: [
          { label: 'Twitter', url: 'https://x.com/rkbehelvi' },
          { label: 'Telegram', url: 'https://t.me/+jpYK0gMfA5o1MGFk' },
          { label: 'Trade on xDEX', url: 'https://app.xdex.xyz/swap?fromTokenAddress=4o4UheANLdqF4gSV4zWTbCTCercQNSaTm6nVcDetzPb2' },
          { label: 'Bridge (Solana ↔ X1)', url: 'https://app.bridge.x1.xyz/' },
          { label: 'X1 Explorer', url: 'https://explorer.mainnet.x1.xyz/' },
        ]
      }
    ]
  }
];

export default function Docs() {
  const [activeSection, setActiveSection] = useState('platform');

  const [query, setQuery] = useState('');
  const current = sections.find(s => s.id === activeSection);
  const q = query.trim().toLowerCase();
  // Client-side filter over the existing documentation text only.
  const results = useMemo(() => {
    if (!q) return null;
    const out = [];
    for (const sec of sections) for (const item of sec.content) {
      const hay = (item.heading + ' ' + (item.body || '') + ' ' + (item.links || []).map(l => l.label).join(' ')).toLowerCase();
      if (hay.includes(q)) out.push({ sec, item });
    }
    return out;
  }, [q]);

  const Card = ({ item, tag = '' }) => (
    <article className="docs-card">
      <h3 className="docs-card-heading">{item.heading}{tag && <span className="dc-tag">{tag}</span>}</h3>
      {item.links ? (
        <div className="docs-card-body dc-links">
          {item.links.map((link, j) => (
            <a key={j} href={link.url} target="_blank" rel="noopener noreferrer">→ {link.label}</a>
          ))}
        </div>
      ) : (
        <div className="docs-card-body">{item.body}</div>
      )}
    </article>
  );

  return (
    <div className="dc-wrap">
      <style>{`
        .dc-wrap { max-width: 1180px; margin: 0 auto; display: grid; grid-template-columns: 250px minmax(0, 1fr); gap: 28px; padding: clamp(20px, 4vw, 40px) var(--gutter) 64px; align-items: start; }
        .docs-sidebar { position: sticky; top: calc(var(--nav-h) + 20px); width: auto; padding: 10px; border: 1px solid var(--border); border-radius: var(--r-lg); background: linear-gradient(180deg, rgba(19,32,26,.5), rgba(8,13,10,.75)); display: grid; gap: 4px; }
        .docs-nav-item { display: flex; align-items: center; gap: 10px; width: 100%; min-height: 44px; padding: 0 14px; border: 0; border-left: 2px solid transparent; background: transparent; color: var(--text-dim); text-align: left; cursor: pointer; font: 600 13px var(--font-display); letter-spacing: .08em; }
        .docs-nav-item:hover { color: var(--text); background: var(--green-a08); }
        .docs-nav-item.active { color: var(--green); border-left-color: var(--green); background: var(--green-a08); }
        .docs-main { min-width: 0; padding: 0; max-width: none; }
        .docs-title { font-family: var(--font-display); font-weight: 700; font-size: clamp(30px, 5vw, 46px); color: var(--green); letter-spacing: .08em; margin: 0; text-shadow: 0 0 28px rgba(0,255,136,.35); }
        .docs-subtitle { color: var(--text-dim); font: 500 12px var(--font-mono); margin: 6px 0 20px; letter-spacing: .18em; }
        .dc-search { position: relative; margin-bottom: 22px; }
        .dc-search input { width: 100%; min-height: 48px; padding: 0 16px 0 44px; background: rgba(8,13,10,.9); border: 1px solid var(--border-strong); border-radius: var(--r-md); color: var(--text); font: 400 15px var(--font-body); }
        .dc-search svg { position: absolute; left: 15px; top: 14px; color: var(--text-faint); }
        .dc-search kbd { position: absolute; right: 12px; top: 13px; font: 500 11px var(--font-mono); color: var(--text-faint); border: 1px solid var(--border-strong); border-radius: 5px; padding: 3px 7px; }
        .docs-section-title { display: flex; align-items: center; gap: 10px; font-family: var(--font-display); color: var(--text); font-size: 20px; letter-spacing: .1em; margin: 0 0 18px; padding-bottom: 12px; border-bottom: 1px solid var(--border); }
        .docs-card { padding: 20px 22px; margin-bottom: 14px; }
        .docs-card-heading { color: var(--cyan); font: 600 15px var(--font-display); letter-spacing: .05em; margin: 0 0 10px; }
        .docs-card-body { color: var(--text-dim); font-size: 14.5px; line-height: 1.75; white-space: pre-line; overflow-wrap: anywhere; }
        .dc-links { display: grid; gap: 8px; white-space: normal; } .dc-links a { color: var(--cyan); text-decoration: none; min-height: 28px; } .dc-links a:hover { color: var(--green); }
        .dc-tag { margin-left: 10px; font: 500 10px var(--font-mono); letter-spacing: .12em; color: var(--text-faint); border: 1px solid var(--border-strong); padding: 2px 7px; border-radius: 999px; vertical-align: middle; }
        .dc-none { padding: 30px; text-align: center; color: var(--text-dim); }
        .docs-cta { display: flex; gap: 10px; margin-top: 28px; flex-wrap: wrap; }
        @media (max-width: 860px) {
          .dc-wrap { grid-template-columns: minmax(0, 1fr); gap: 16px; }
          .docs-sidebar { position: static; display: flex; overflow-x: auto; gap: 6px; padding: 8px; -webkit-overflow-scrolling: touch; }
          .docs-nav-item { width: auto; flex: 0 0 auto; white-space: nowrap; border-left: 0; border-bottom: 2px solid transparent; border-radius: 6px; }
          .docs-nav-item.active { border-bottom-color: var(--green); }
        }
      `}</style>

      <nav className="docs-sidebar" aria-label="Documentation sections">
        {sections.map(s => (
          <button key={s.id} className={`docs-nav-item${!q && activeSection === s.id ? ' active' : ''}`} aria-current={!q && activeSection === s.id ? 'page' : undefined}
            onClick={() => { setQuery(''); setActiveSection(s.id); }}>
            <span aria-hidden="true">{s.icon}</span><span>{s.title}</span>
          </button>
        ))}
      </nav>

      <div className="docs-main">
        <p className="ds-eyebrow">KNOWLEDGE BASE</p>
        <h1 className="docs-title">DOCS</h1>
        <div className="docs-subtitle">404x1 PLATFORM DOCUMENTATION</div>

        <div className="dc-search">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M20 20l-4-4" stroke="currentColor" strokeWidth="2" /></svg>
          <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search the documentation…" aria-label="Search documentation" />
        </div>

        {results ? (
          <>
            <h2 className="docs-section-title"><span>{results.length} result{results.length === 1 ? '' : 's'} for “{query.trim()}”</span></h2>
            {results.length === 0 && <div className="docs-card dc-none">Nothing in the docs matches that search.</div>}
            {results.map(({ sec, item }, i) => <Card key={sec.id + i} item={item} tag={sec.title} />)}
          </>
        ) : current && (
          <>
            <h2 className="docs-section-title"><span aria-hidden="true">{current.icon}</span><span>{current.title}</span></h2>
            {current.content.map((item, i) => <Card key={i} item={item} />)}
          </>
        )}

        <div className="docs-cta">
          <a href={createPageUrl('Chat')} className="ds-btn">→ Enter chat</a>
          <a href={createPageUrl('Home')} className="ds-btn ghost">→ Token dashboard</a>
        </div>
      </div>
    </div>
  );
}
