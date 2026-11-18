import { describe, it, expect } from 'vitest';
import {
  normalizeImageUrl,
  isAllowedImageUrl,
  MAX_IMAGE_SIZE_BYTES,
} from '../base44/shared/images.ts';

const APP = '6988b1920d2dc3e06784fc73';
const OWNED = `https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/${APP}/abc123.png`;

describe('image URL policy', () => {
  it('accepts a file this app uploaded', () => {
    expect(normalizeImageUrl(OWNED, APP)).toBe(OWNED);
    expect(isAllowedImageUrl(OWNED, APP)).toBe(true);
  });

  it('rejects an external host even over https', () => {
    expect(normalizeImageUrl('https://evil.example.com/x.png', APP)).toBeNull();
  });

  it("rejects another app's storage folder", () => {
    const otherApp = `https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/deadbeef/abc.png`;
    expect(normalizeImageUrl(otherApp, APP)).toBeNull();
  });

  it('rejects plain http', () => {
    expect(normalizeImageUrl(OWNED.replace('https://', 'http://'), APP)).toBeNull();
  });

  it('rejects storage host look-alikes', () => {
    const lookalike = `https://supabase.co.evil.example/storage/v1/object/public/${APP}/a.png`;
    expect(normalizeImageUrl(lookalike, APP)).toBeNull();
  });

  it('rejects credentials and traversal or whitespace tricks', () => {
    expect(normalizeImageUrl(OWNED.replace('https://', 'https://user:pw@'), APP)).toBeNull();
    expect(normalizeImageUrl(OWNED.replace('/abc123.png', '/../../secret.png'), APP)).toBeNull();
    expect(normalizeImageUrl(`${OWNED} "><script>`, APP)).toBeNull();
  });

  it('rejects non-string, empty and oversized-URL inputs', () => {
    expect(normalizeImageUrl(null, APP)).toBeNull();
    expect(normalizeImageUrl('', APP)).toBeNull();
    expect(normalizeImageUrl(`${OWNED}?pad=${'a'.repeat(600)}`, APP)).toBeNull();
  });

  it('rejects javascript and data URLs', () => {
    expect(normalizeImageUrl('javascript:alert(1)', APP)).toBeNull();
    expect(normalizeImageUrl('data:image/png;base64,AAAA', APP)).toBeNull();
  });

  it('documents the 5 MB ceiling enforced on the stored file', () => {
    expect(MAX_IMAGE_SIZE_BYTES).toBe(5 * 1024 * 1024);
  });
});