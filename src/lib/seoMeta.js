// Per-route search metadata for 404X1 (title, description, canonical, robots, Open Graph,
// Schema.org JSON-LD). Frontend only. The hosting platform serves one HTML file for every route
// and injects generic tags, so the correct values are applied in the browser on each navigation.
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export const SITE_ORIGIN = 'https://404x1.xyz';
export const SITE_NAME = '404X1';
export const ORG_ID = 'https://x1nexus.xyz/#arkbs-labs';
export const TOKEN_MINT = '4o4UheANLdqF4gSV4zWTbCTCercQNSaTm6nVcDetzPb2';

/** Indexable public pages. */
export const PAGES = {
  Home: {
    title: '404X1 — 404 ERROR Token on X1 Mainnet',
    description: '404 ERROR is an experimental Token-2022 meme token on X1 mainnet. Contract address, live 404/XNT price from on-chain swaps, holders, chat and arcade.',
  },
  Docs: {
    title: '404X1 Docs — Token, Reputation Points and Roles',
    description: 'How 404X1 works: the 404 ERROR token contract, wallet sign-in, earning and losing reputation points, role tiers, chat rules and the arcade game.',
  },
  Game: {
    title: '404X1 Arcade Game',
    description: 'Play the 404X1 arcade game in your browser. Scores feed the community leaderboard and reputation points for signed-in players.',
  },
};

/** Real pages kept out of search: user-generated, personal, moderation or sign-in flows. */
export const NOINDEX = {
  Chat: 'Global Chat',
  Leaderboard: 'Leaderboard',
  Messages: 'Messages',
  Profile: 'Profile',
  ModPanel: 'Moderation',
  ModerationLogs: 'Moderation Logs',
  OAuthConsent: 'Authorize',
};

const CANONICAL = Object.fromEntries([...Object.keys(PAGES), ...Object.keys(NOINDEX)].map((k) => [k.toLowerCase(), k]));

/** @returns {{ title: string, description?: string, canonical: string, robots: string, page?: string }} */
export function metaFor(pathname, known = true) {
  const key = pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
  const page = key === '' ? 'Home' : CANONICAL[key];
  if (!known || !page) return { title: `Page Not Found | ${SITE_NAME}`, canonical: '', robots: 'noindex, nofollow' };
  const canonical = `${SITE_ORIGIN}${page === 'Home' ? '/' : `/${page}`}`;
  if (NOINDEX[page]) return { title: `${NOINDEX[page]} | ${SITE_NAME}`, canonical, robots: 'noindex, follow', page };
  const p = PAGES[page];
  return { title: p.title, description: p.description, canonical, robots: 'index, follow', page };
}

/** Schema.org graph backed by visible content. No ratings, reviews or price claims. */
export function structuredData(meta) {
  if (!meta.page || meta.robots.startsWith('noindex')) return null;
  /** @type {Record<string, any>[]} */
  const graph = [
    { '@type': 'Organization', '@id': ORG_ID, name: 'ARKBS Labs', sameAs: ['https://x.com/rkbehelvi'],
      description: 'Builder of X1 ecosystem tools: X1 Space, X1 Nexus, 404X1, Pump X1 and X1 Leader Slot Checker.' },
    { '@type': 'WebSite', '@id': `${SITE_ORIGIN}/#website`, url: `${SITE_ORIGIN}/`, name: SITE_NAME, alternateName: '404x1', inLanguage: 'en', publisher: { '@id': ORG_ID } },
    { '@type': 'Thing', '@id': `${SITE_ORIGIN}/#token`, name: '404 ERROR', alternateName: '404',
      description: 'Token-2022 token on X1 mainnet with 9 decimals; mint and freeze authority disabled.',
      identifier: { '@type': 'PropertyValue', propertyID: 'X1 mint address', value: TOKEN_MINT } },
    { '@type': meta.page === 'Docs' ? 'TechArticle' : 'WebPage', '@id': `${meta.canonical}#webpage`, url: meta.canonical, name: meta.title,
      description: meta.description, isPartOf: { '@id': `${SITE_ORIGIN}/#website` }, about: { '@id': `${SITE_ORIGIN}/#token` }, inLanguage: 'en',
      ...(meta.page === 'Docs' ? { headline: meta.title, author: { '@id': ORG_ID }, publisher: { '@id': ORG_ID }, dateModified: '2026-11-20' } : {}) },
  ];
  if (meta.page !== 'Home') {
    graph.push({ '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: SITE_NAME, item: `${SITE_ORIGIN}/` },
      { '@type': 'ListItem', position: 2, name: meta.title, item: meta.canonical },
    ] });
  }
  return { '@context': 'https://schema.org', '@graph': graph };
}

export const serializeJsonLd = (data) => JSON.stringify(data).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

function upsert(selector, create, apply) {
  let el = document.head.querySelector(selector);
  if (!el) { el = create(); document.head.appendChild(el); }
  apply(el);
}
const metaTag = (attr, key, value) => upsert(`meta[${attr}="${key}"]`, () => { const m = document.createElement('meta'); m.setAttribute(attr, key); return m; }, (el) => el.setAttribute('content', value));

export function applyMeta(meta) {
  document.title = meta.title;
  metaTag('name', 'robots', meta.robots);
  metaTag('property', 'og:title', meta.title);
  metaTag('name', 'twitter:title', meta.title);
  if (meta.description) {
    metaTag('name', 'description', meta.description);
    metaTag('property', 'og:description', meta.description);
    metaTag('name', 'twitter:description', meta.description);
  }
  const link = document.head.querySelector('link[rel="canonical"]');
  if (meta.canonical) {
    upsert('link[rel="canonical"]', () => Object.assign(document.createElement('link'), { rel: 'canonical' }), (el) => { el.href = meta.canonical; });
    metaTag('property', 'og:url', meta.canonical);
    metaTag('name', 'twitter:url', meta.canonical);
  } else if (link) {
    link.remove();
  }
  document.head.querySelectorAll('script[type="application/ld+json"][data-seo-source="builder"]').forEach((n) => n.remove());
  const data = structuredData(meta);
  const ld = document.head.querySelector('script#x404-ld');
  if (data) upsert('script#x404-ld', () => Object.assign(document.createElement('script'), { id: 'x404-ld', type: 'application/ld+json' }), (el) => { el.textContent = serializeJsonLd(data); });
  else if (ld) ld.remove();
}

/** Keep head metadata in step with the route. `known` is false only on the 404 page. */
export default function usePageMeta(known = true) {
  const { pathname } = useLocation();
  useEffect(() => { applyMeta(metaFor(pathname, known)); }, [pathname, known]);
}
