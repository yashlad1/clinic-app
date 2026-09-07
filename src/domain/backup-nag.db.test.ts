import { NAG, backupNag, lastBackupLabel } from './backup-nag';

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 8, 6, 12, 0);

describe('backup nag', () => {
  it('stays quiet on a fresh install with nothing to lose', () => {
    expect(backupNag({ lastBackupAt: null, dosesSinceBackup: 0, now: NOW }).level).toBe('none');
  });

  it('stays quiet just after a backup', () => {
    expect(backupNag({ lastBackupAt: NOW - DAY, dosesSinceBackup: 3, now: NOW }).level).toBe('none');
  });

  it('goes amber after 3 days', () => {
    expect(backupNag({ lastBackupAt: NOW - 3 * DAY, dosesSinceBackup: 1, now: NOW }).level).toBe('due');
  });

  it('goes amber on dose COUNT even when the last backup was recent', () => {
    // The case time-only logic misses: a single busy immunisation morning.
    const nag = backupNag({ lastBackupAt: NOW - 6 * 3600_000, dosesSinceBackup: NAG.dueAfterDoses, now: NOW });
    expect(nag.level).toBe('due');
    expect(nag.message).toContain('41'.slice(0, 0) + '25 entries');
  });

  it('goes red after 14 days', () => {
    const nag = backupNag({ lastBackupAt: NOW - 14 * DAY, dosesSinceBackup: 0, now: NOW });
    expect(nag.level).toBe('overdue');
    expect(nag.message).toContain('14 days ago');
  });

  it('nags when there has NEVER been a backup but doses exist', () => {
    const nag = backupNag({ lastBackupAt: null, dosesSinceBackup: 4, now: NOW });
    expect(nag.level).toBe('due');
    expect(nag.message).toContain('never been backed up');
  });

  it('escalates a never-backed-up phone with many entries straight to red', () => {
    expect(backupNag({ lastBackupAt: null, dosesSinceBackup: 40, now: NOW }).level).toBe('overdue');
  });

  it('honours a snooze for the amber state', () => {
    const base = { lastBackupAt: NOW - 4 * DAY, dosesSinceBackup: 1, now: NOW };
    expect(backupNag(base).level).toBe('due');
    expect(backupNag({ ...base, snoozedUntil: NOW + DAY }).level).toBe('none');
  });

  it('does NOT let a snooze silence the red state', () => {
    // At two weeks the risk of losing the ledger outweighs the annoyance.
    const nag = backupNag({
      lastBackupAt: NOW - 20 * DAY, dosesSinceBackup: 1, now: NOW, snoozedUntil: NOW + DAY,
    });
    expect(nag.level).toBe('overdue');
  });
});

describe('last backup label', () => {
  it('is explicit when there has never been one', () => {
    expect(lastBackupLabel(null)).toBe('Last backup: never');
  });

  it('shows date and 12-hour time so she can answer "am I safe?" without tapping', () => {
    const at = new Date(2026, 8, 4, 18, 30).getTime();
    expect(lastBackupLabel(at)).toBe('Last backup: 4 Sep, 6:30 pm');
  });
});
