import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { metaFor, structuredData, serializeJsonLd, PAGES, NOINDEX, TOKEN_MINT } from '../src/lib/seoMeta.js';

describe('404X1 search metadata', () => {
  it('classifies every page file', () => {
    for (const f of fs.readdirSync('src/pages').filter((x) => x.endsWith('.jsx')).map((x) => x.replace('.jsx', ''))) {
      expect(Boolean(PAGES[f] || NOINDEX[f]), f).toBe(true);
    }
  });
  it('home canonical is the root; case variants share canonicals', () => {
    expect(metaFor('/').canonical).toBe('https://404x1.xyz/');
    expect(metaFor('/home').canonical).toBe('https://404x1.xyz/');
    expect(metaFor('/docs')).toEqual(metaFor('/Docs'));
  });
  it('user-generated, personal and moderation pages are noindex with no JSON-LD', () => {
    for (const p of Object.keys(NOINDEX)) {
      expect(metaFor(`/${p}`).robots).toBe('noindex, follow');
      expect(structuredData(metaFor(`/${p}`))).toBeNull();
    }
  });
  it('unknown routes are noindex, nofollow without canonical', () => {
    expect(metaFor('/nope')).toEqual({ title: 'Page Not Found | 404X1', canonical: '', robots: 'noindex, nofollow' });
  });
  it('descriptions are unique and sized; no hype or rating claims', () => {
    const ds = Object.keys(PAGES).map((p) => metaFor(`/${p}`).description);
    expect(new Set(ds).size).toBe(ds.length);
    for (const d of ds) { expect(d.length).toBeGreaterThanOrEqual(70); expect(d.length).toBeLessThanOrEqual(165); }
    expect(JSON.stringify([PAGES, structuredData(metaFor('/'))])).not.toMatch(/guaranteed|no admin keys|aggregateRating|"review"/i);
  });
  it('token entity uses the verified mint address', () => {
    const g = structuredData(metaFor('/'))['@graph'];
    expect(g.find((n) => n['@id'] === 'https://404x1.xyz/#token').identifier.value).toBe(TOKEN_MINT);
    expect(fs.readFileSync('src/pages/Docs.jsx', 'utf8')).toContain(TOKEN_MINT);
  });
  it('sitemap equals indexable pages; serializer is script-safe', () => {
    const locs = [...fs.readFileSync('public/sitemap.xml', 'utf8').matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]).sort();
    expect(locs).toEqual(Object.keys(PAGES).map((p) => metaFor(`/${p}`).canonical).sort());
    expect(serializeJsonLd({ x: '</script>' })).not.toMatch(/</);
  });
  it('index.html has no static canonical (it would mark every route as the home page)', () => {
    expect(fs.readFileSync('index.html', 'utf8')).not.toMatch(/rel="canonical"/);
  });
});
