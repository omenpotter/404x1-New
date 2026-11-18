import { describe, it, expect } from 'vitest';
import {
  isVisibleTo,
  withHiddenFor,
  withUnhiddenFor,
  participantsOf,
} from '../base44/shared/conversations.ts';

const conversation = {
  id: 'conv_1',
  participant_ids: ['playerA', 'playerB'],
  participant_usernames: ['Alpha', 'Beta'],
  last_message: 'hello',
};

describe('per-participant conversation visibility', () => {
  it('is visible to both participants before anyone deletes it', () => {
    expect(isVisibleTo(conversation, 'playerA')).toBe(true);
    expect(isVisibleTo(conversation, 'playerB')).toBe(true);
  });

  it('hides the thread only for the participant who deleted it', () => {
    const afterDelete = { ...conversation, hidden_for: withHiddenFor(conversation, 'playerA') };
    expect(isVisibleTo(afterDelete, 'playerA')).toBe(false);
    expect(isVisibleTo(afterDelete, 'playerB')).toBe(true);
  });

  it('keeps the messages themselves untouched', () => {
    const afterDelete = { ...conversation, hidden_for: withHiddenFor(conversation, 'playerA') };
    expect(afterDelete.last_message).toBe('hello');
    expect(participantsOf(afterDelete)).toEqual(['playerA', 'playerB']);
  });

  it('is idempotent: deleting twice does not duplicate the entry', () => {
    const once = withHiddenFor(conversation, 'playerA');
    const twice = withHiddenFor({ ...conversation, hidden_for: once }, 'playerA');
    expect(twice).toEqual(['playerA']);
  });

  it('never hides the thread for anyone outside the conversation', () => {
    const afterDelete = { ...conversation, hidden_for: withHiddenFor(conversation, 'playerA') };
    expect(isVisibleTo(afterDelete, 'playerC')).toBe(false); // not a participant at all
    expect(isVisibleTo(afterDelete, null)).toBe(false);
  });

  it('brings the thread back for both sides when a new message arrives', () => {
    const hidden = { ...conversation, hidden_for: ['playerA', 'playerB'] };
    const reopened = { ...hidden, hidden_for: withUnhiddenFor(hidden, participantsOf(hidden)) };
    expect(reopened.hidden_for).toEqual([]);
    expect(isVisibleTo(reopened, 'playerA')).toBe(true);
    expect(isVisibleTo(reopened, 'playerB')).toBe(true);
  });

  it('leaves unrelated hidden entries alone when one participant reopens', () => {
    const hidden = { ...conversation, hidden_for: ['playerA', 'playerB', 'ghost'] };
    const reopened = { ...hidden, hidden_for: withUnhiddenFor(hidden, ['playerA']) };
    expect(reopened.hidden_for).toEqual(['playerB', 'ghost']);
    expect(isVisibleTo(reopened, 'playerA')).toBe(true);
    expect(isVisibleTo(reopened, 'playerB')).toBe(false);
  });

  it('tolerates records written before the field existed', () => {
    const legacy = { id: 'old', participant_ids: ['playerA', 'playerB'] };
    expect(isVisibleTo(legacy, 'playerA')).toBe(true);
    expect(withUnhiddenFor(legacy, ['playerA'])).toEqual([]);
  });
});