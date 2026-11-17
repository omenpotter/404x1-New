import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';

const { appId, token, functionsVersion, appBaseUrl } = appParams;

//Create a client with authentication required
const client = createClient({
  appId,
  token,
  functionsVersion,
  serverUrl: '',
  requiresAuth: false,
  appBaseUrl
});

// Preview safety: when VITE_PREVIEW_READ_ONLY=true (set on the Vercel preview project only),
// every backend call that could create/change/delete production data is refused client-side.
// Only the read-only functions below and entity reads (list/filter/get) are allowed.
// This is defence in depth, not a replacement for the Base44 backend's own access rules.
// @ts-ignore -- must stay the literal `import.meta.env.X` so Vite can statically replace it
const READ_ONLY = import.meta.env.VITE_PREVIEW_READ_ONLY === 'true';
const READ_ONLY_FUNCTIONS = new Set(['chatHistory', 'chatSearch', 'gameLeaderboard', 'xdexProxy']);
const READ_ONLY_ENTITY_METHODS = new Set(['list', 'filter', 'get', 'schema']);

function blocked(what) {
  return Promise.reject(new Error(`Preview is read-only: ${what} blocked`));
}

/** @param {any} c */
function guard(c) {
  return new Proxy(c, {
    get(target, prop, receiver) {
      const v = Reflect.get(target, prop, receiver);
      if (prop === 'functions') {
        return new Proxy(v, {
          get(ft, fp, fr) {
            if (fp === 'invoke') return (name, ...a) => READ_ONLY_FUNCTIONS.has(name) ? ft.invoke(name, ...a) : blocked(`function ${name}`);
            return Reflect.get(ft, fp, fr);
          },
        });
      }
      if (prop === 'entities') {
        return new Proxy(v, {
          get(et, ep) {
            const ent = et[ep];
            if (!ent || typeof ent !== 'object') return ent;
            return new Proxy(ent, {
              get(t, m) {
                return READ_ONLY_ENTITY_METHODS.has(/** @type {string} */ (m)) ? t[m]?.bind(t) : () => blocked(`entity write ${String(ep)}.${String(m)}`);
              },
            });
          },
        });
      }
      return v;
    },
  });
}

export const base44 = READ_ONLY ? guard(client) : client;
