// Per-participant conversation visibility.
//
// Deleting a conversation is a personal action: it hides the thread from the person who
// did it and leaves it untouched for everyone else. These helpers are the single place
// that decides visibility, so the list endpoint, the delete endpoint and the send
// endpoint cannot disagree about it.

export function participantsOf(conv: any): string[] {
  return Array.isArray(conv?.participant_ids) ? conv.participant_ids : [];
}

export function hiddenForIds(conv: any): string[] {
  return Array.isArray(conv?.hidden_for) ? conv.hidden_for : [];
}

// A conversation is visible to a player when they are a participant and have not hidden it.
export function isVisibleTo(conv: any, playerId: string | null | undefined): boolean {
  if (!playerId) return false;
  if (!participantsOf(conv).includes(playerId)) return false;
  return !hiddenForIds(conv).includes(playerId);
}

// Hidden list after hiding `playerId`; idempotent and never contains duplicates.
export function withHiddenFor(conv: any, playerId: string): string[] {
  const current = hiddenForIds(conv);
  return current.includes(playerId) ? current.slice() : [...current, playerId];
}

// Hidden list after unhiding every id in `playerIds`. Used when a new message arrives,
// so a thread the recipient had removed reappears instead of swallowing the message.
export function withUnhiddenFor(conv: any, playerIds: string[]): string[] {
  const clear = new Set(playerIds.filter(Boolean));
  return hiddenForIds(conv).filter((id) => !clear.has(id));
}