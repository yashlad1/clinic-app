import { SYNC_NAG, syncNag } from './sync-nag';

const NOW = Date.UTC(2026, 8, 9, 6, 0, 0);
const MIN = 60_000;

describe('sync nag', () => {
  it('says nothing when everything is uploaded', () => {
    expect(syncNag({ pending: 0, lastOkAt: NOW - 10 * 60 * MIN, now: NOW }).level).toBe('none');
    // Even if it has never succeeded: nothing waiting means nothing wrong.
    expect(syncNag({ pending: 0, lastOkAt: null, now: NOW }).level).toBe('none');
  });

  it('stays quiet during ordinary use', () => {
    // A dose was just recorded and the 4s upload has not fired yet. An
    // indicator here would appear after every single dose, and that is exactly
    // how a real warning gets trained into invisibility.
    expect(syncNag({ pending: 1, lastOkAt: NOW - 2 * MIN, now: NOW }).level).toBe('none');
    expect(syncNag({ pending: 3, lastOkAt: NOW - 20 * MIN, now: NOW }).level).toBe('none');
  });

  it('speaks up once entries are genuinely stranded', () => {
    expect(syncNag({ pending: 2, lastOkAt: NOW - 45 * MIN, now: NOW }).level).toBe('behind');
  });

  it('speaks up on volume even when the last upload was recent', () => {
    // A busy immunisation morning with no signal: the clock looks fine but
    // twenty entries exist only on one phone.
    const n = SYNC_NAG.loudPending;
    expect(syncNag({ pending: n, lastOkAt: NOW - 1 * MIN, now: NOW }).level).toBe('behind');
    expect(syncNag({ pending: n - 1, lastOkAt: NOW - 1 * MIN, now: NOW }).level).toBe('none');
  });

  it('escalates after four hours, because that is a fault not a delay', () => {
    const nag = syncNag({ pending: 5, lastOkAt: NOW - 5 * 60 * MIN, now: NOW });
    expect(nag.level).toBe('stuck');
    expect(nag.message).toContain('internet connection');
  });

  it('treats never-uploaded as stuck once anything is waiting', () => {
    expect(syncNag({ pending: 30, lastOkAt: null, now: NOW }).level).toBe('stuck');
  });

  it('always says the data is safe on the phone', () => {
    // The message must never read like data loss. It is a delivery delay, and
    // the ledger is intact either way.
    for (const p of [2, 25]) {
      const m = syncNag({ pending: p, lastOkAt: NOW - 10 * 60 * MIN, now: NOW }).message;
      expect(m.toLowerCase()).toMatch(/still saved on this phone|will go on their own/);
    }
  });

  it('agrees with itself about number', () => {
    expect(syncNag({ pending: 1, lastOkAt: NOW - 60 * MIN, now: NOW }).message).toContain('1 entry ');
    expect(syncNag({ pending: 2, lastOkAt: NOW - 60 * MIN, now: NOW }).message).toContain('2 entries ');
  });
});
