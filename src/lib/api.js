// Base URL for direct (non-SDK) calls to the app's backend functions.
// The host used to be hardcoded to a legacy preview host in several pages; it lives here now
// so there is one place to change it and no stale host can linger in a page.
const APP_HOST = (import.meta.env.VITE_BASE44_APP_HOST || 'https://404x1.base44.app').replace(/\/+$/, '');
export const FUNCTIONS_BASE = `${APP_HOST}/api/apps/6988b1920d2dc3e06784fc73/functions/`;