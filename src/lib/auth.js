// Frontend auth helper — attaches the session token to backend function calls.
// The session token is issued by authWallet after wallet signature verification.

export function getSessionToken() {
  try {
    const user = JSON.parse(localStorage.getItem('404x1_user') || 'null');
    return user?.session_token || null;
  } catch {
    return null;
  }
}

export function getAuthUser() {
  try {
    return JSON.parse(localStorage.getItem('404x1_user') || 'null');
  } catch {
    return null;
  }
}

// Merge session_token into a function-call payload.
export function withAuth(data = {}) {
  return { ...data, session_token: getSessionToken() };
}