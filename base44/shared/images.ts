// Image URL policy for images embedded in chat and direct messages.
//
// A user-supplied image URL is not passive content: every reader's browser fetches it,
// which hands an arbitrary third party the reader's IP, user agent and the times they
// read a given message. So a message image is embedded only when it points at a file
// this app itself received through platform storage. Everything else is refused when
// the message is written, and never emitted for rendering.

const MAX_URL_LENGTH = 512;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

// Platform storage hosts. The app id in the path is what proves the file belongs to
// this app rather than to some other app on the same storage service.
const STORAGE_HOST_SUFFIXES = ['.supabase.co', '.base44.app'];
const UPLOAD_PATH_MARKERS = ['/storage/v1/object/public/', '/files/'];
const APP_ID_FALLBACK = '6988b1920d2dc3e06784fc73';

export function storageAppId(): string {
  try {
    return Deno.env.get('BASE44_APP_ID') || APP_ID_FALLBACK;
  } catch {
    return APP_ID_FALLBACK;
  }
}

function isStorageHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return STORAGE_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix) && host.length > suffix.length);
}

// Returns the URL when it is an app-owned storage image, otherwise null.
export function normalizeImageUrl(raw: unknown, appId: string = storageAppId()): string | null {
  if (typeof raw !== 'string') return null;
  const value = raw.trim();
  if (!value || value.length > MAX_URL_LENGTH) return null;
  if (value.includes('..') || /[\s<>"]/.test(value)) return null;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  if (url.protocol !== 'https:') return null;
  if (url.username || url.password) return null;
  if (!isStorageHost(url.hostname)) return null;

  const path = decodeURIComponent(url.pathname).toLowerCase();
  if (!UPLOAD_PATH_MARKERS.some((marker) => path.includes(marker))) return null;
  if (!path.includes(`/${appId.toLowerCase()}/`)) return null;

  return value;
}

export function isAllowedImageUrl(raw: unknown, appId?: string): boolean {
  return normalizeImageUrl(raw, appId) !== null;
}

// Size check for an already-validated URL. The host is this app's own storage by then,
// so this cannot be pointed at an internal address. A failed check allows the image:
// refusing on a network hiccup would break image messages rather than protect anything.
export async function isOversizedImage(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: 'HEAD' });
    if (!res.ok) return false;
    const bytes = Number(res.headers.get('content-length') || 0);
    return Number.isFinite(bytes) && bytes > MAX_IMAGE_BYTES;
  } catch {
    return false;
  }
}

export const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_BYTES;