// Shared Telegram helpers — used by the moderation and admin alert functions.

// Escape text before interpolating it into a Telegram message sent with parse_mode 'HTML'.
// Chat content and usernames are attacker-controlled, so unescaped markup would let a user
// spoof formatted alerts inside the staff channel (or break the send entirely).
export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}