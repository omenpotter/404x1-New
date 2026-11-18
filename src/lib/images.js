// Frontend mirror of the server image policy (base44/shared/images.ts).
//
// The server refuses a foreign image URL when a message is written, but rows written
// before that rule existed still hold whatever was pasted. Rendering only an app-owned
// storage URL keeps an old message from turning into a tracking request to a third party.
import { appParams } from '@/lib/app-params';

const APP_ID = String(appParams?.appId || '6988b1920d2dc3e06784fc73').toLowerCase();
const MAX_URL_LENGTH = 512;
const STORAGE_HOST_SUFFIXES = ['.supabase.co', '.base44.app'];
const UPLOAD_PATH_MARKERS = ['/storage/v1/object/public/', '/files/'];

export function safeImageSrc(raw) {
  if (typeof raw !== 'string') return null;
  const value = raw.trim();
  if (!value || value.length > MAX_URL_LENGTH) return null;
  if (value.includes('..') || /[\s<>"]/.test(value)) return null;

  let url;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  if (url.protocol !== 'https:') return null;
  if (url.username || url.password) return null;

  const host = url.hostname.toLowerCase();
  if (!STORAGE_HOST_SUFFIXES.some(s => host.endsWith(s) && host.length > s.length)) return null;

  const path = url.pathname.toLowerCase();
  if (!UPLOAD_PATH_MARKERS.some(m => path.includes(m))) return null;
  if (!path.includes(`/${APP_ID}/`)) return null;

  return value;
}