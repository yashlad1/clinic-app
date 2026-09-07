/**
 * THE single source of truth for the backlog.
 *
 * Both the Jira import CSV and the GitHub issues are generated from this file,
 * so the two trackers cannot drift apart.
 *
 *   npm run backlog:jira    -> jira/backlog.csv
 *   npm run backlog:github  -> creates milestones, labels and issues via gh
 */

export interface Story {
  epic: string;
  summary: string;
  description: string;
  sprint: 'Sprint 0' | 'Sprint 1' | 'Sprint 2' | 'Sprint 3' | 'Backlog';
  points: number;
  priority: 'Highest' | 'High' | 'Medium' | 'Low';
  /** Requirement IDs from docs/SRS.md. */
  reqs: string[];
  /** true when this is already implemented and verified. */
  done?: boolean;
}

export const EPICS: Record<string, { label: string; summary: string }> = {
  foundation: { label: 'epic:foundation', summary: 'Foundation & data layer' },
  dose: { label: 'epic:dose-entry', summary: 'Dose entry' },
  stock: { label: 'epic:stock', summary: 'Stock & catalog' },
  reports: { label: 'epic:reports', summary: 'Reports' },
  backup: { label: 'epic:backup', summary: 'Backup & restore' },
  corrections: { label: 'epic:corrections', summary: 'Corrections & reconciliation' },
  delivery: { label: 'epic:delivery', summary: 'Build & delivery' },
  docs: { label: 'epic:docs', summary: 'Documentation' },
};

export const STORIES: Story[] = [
  // ---------------------------------------------------------------- Sprint 0
  {
    epic: 'docs', summary: 'Write the SRS with numbered, traceable requirements',
    description:
      'IEEE-830-shaped specification. Every request in the clinician\'s own words must map to a numbered FR/NFR, and every requirement must name the test or test-plan step that verifies it.',
    sprint: 'Sprint 0', points: 5, priority: 'High', reqs: [], done: true,
  },
  {
    epic: 'docs', summary: 'Write the ERD and generate reference DDL',
    description:
      'Mermaid entity diagram plus the reasoning behind the append-only ledger. docs/schema.sql must be GENERATED from the migrations (npm run schema:dump) so it cannot drift.',
    sprint: 'Sprint 0', points: 3, priority: 'High', reqs: [], done: true,
  },
  {
    epic: 'docs', summary: 'Write the waterfall phase and Gantt diagrams',
    description:
      'Phase/artifact flowchart, phase gates, verification traceability, and a Gantt schedule. Must state plainly that waterfall and sprints are opposite models and why both are present.',
    sprint: 'Sprint 0', points: 2, priority: 'Medium', reqs: [], done: true,
  },
  {
    epic: 'docs', summary: 'Write the test plan',
    description: 'Three test layers, plus the 16-step on-phone acceptance script run in airplane mode.',
    sprint: 'Sprint 0', points: 2, priority: 'High', reqs: [], done: true,
  },
  {
    epic: 'foundation', summary: 'Scaffold the Expo SDK 57 project',
    description:
      'expo-router, TypeScript, portrait, light-only. No local Android toolchain: Expo Go for development, EAS cloud build for the APK.',
    sprint: 'Sprint 0', points: 2, priority: 'Highest', reqs: ['C6'], done: true,
  },
  {
    epic: 'docs', summary: 'Set up the public repository and backlog',
    description:
      'Public repo, .gitignore covering *.db / backups/ / *.zip, GitHub milestones and labels, and a Jira import CSV generated from the same source as the issues.',
    sprint: 'Sprint 0', points: 2, priority: 'High', reqs: ['NFR-44'], done: true,
  },

  // ---------------------------------------------------------------- Sprint 1
  {
    epic: 'foundation', summary: 'Define the Db driver interface and adapters',
    description:
      'One interface, three adapters (expo / node / web). Nothing outside src/db/driver.*.ts may import expo-sqlite. This is what makes the whole data layer testable with no device.',
    sprint: 'Sprint 1', points: 3, priority: 'Highest', reqs: ['C4', 'NFR-50'], done: true,
  },
  {
    epic: 'foundation', summary: 'Write migration v1 with constraints and triggers',
    description:
      'Tables, CHECK constraints, indexes, the three views, and the append-only triggers. The constraints ARE the design: sign invariants, one-reversal-per-movement, no update of arithmetic, no delete.',
    sprint: 'Sprint 1', points: 8, priority: 'Highest',
    reqs: ['FR-2', 'FR-4', 'FR-90', 'FR-91', 'FR-92', 'FR-93', 'C1', 'C2'], done: true,
  },
  {
    epic: 'foundation', summary: 'Build the forward-only migration runner',
    description:
      'PRAGMA user_version as the single source of truth; version bumped inside the same transaction as the DDL; pre-migration snapshot; downgrade guard that refuses to open data from a newer app.',
    sprint: 'Sprint 1', points: 5, priority: 'Highest', reqs: ['FR-96', 'FR-97', 'NFR-21', 'C5'], done: true,
  },
  {
    epic: 'foundation', summary: 'Seed the Indian pediatric vaccine catalog',
    description:
      'IAP-schedule vaccines under their trade names, both unit modes, with default safety limits. Shipped as EDITABLE SUGGESTIONS with an explicit onboarding warning to check doses-per-vial against the fridge.',
    sprint: 'Sprint 1', points: 3, priority: 'High', reqs: ['FR-1', 'FR-7'], done: true,
  },
  {
    epic: 'foundation', summary: 'Implement UUIDv7 ids and tap-derived idempotency keys',
    description:
      'Time-sortable client-generated ids so an offline row keeps its identity forever. The idempotency key is minted at the user\'s tap and reused across retries, which is what makes a double-decrement unrepresentable.',
    sprint: 'Sprint 1', points: 3, priority: 'Highest', reqs: ['FR-26', 'NFR-52'], done: true,
  },
  {
    epic: 'foundation', summary: 'Store local_date and local_time at write time',
    description:
      'Computed once, at write time, alongside UTC. Makes "today" an indexed equality test that is deterministic, testable in CI, and immune to the phone\'s timezone changing later. Also: no Intl in formatting, whose output differs between Node and Android.',
    sprint: 'Sprint 1', points: 3, priority: 'High', reqs: ['FR-57', 'FR-95', 'NFR-51'], done: true,
  },
  {
    epic: 'foundation', summary: 'Implement the ledger write API',
    description:
      'recordReceipt / recordAdministration / recordWastage / recordOpeningBalance / recordAdjustment / reverseMovement. All append-only, all idempotent, all dose-denominated. Validation surfaces as a rejection, never a synchronous throw.',
    sprint: 'Sprint 1', points: 5, priority: 'Highest', reqs: ['FR-14', 'FR-25', 'FR-46', 'FR-47'], done: true,
  },
  {
    epic: 'stock', summary: 'Implement vial-to-dose conversion and low-stock state',
    description:
      'Per-vaccine unit mode. The app does every conversion; if a screen asks a human to multiply, the screen is wrong. Low stock fires at <= the safety limit, not <.',
    sprint: 'Sprint 1', points: 3, priority: 'High', reqs: ['FR-3', 'FR-11', 'FR-5'], done: true,
  },
  {
    epic: 'dose', summary: 'Build the Give Dose grid as the launch screen',
    description:
      'Home is the dose-entry screen, not a dashboard. Two-column tiles ordered by 30-day usage, live search that is NOT autofocused, and per-tile stock so two of the three required reports are ambient.',
    sprint: 'Sprint 1', points: 5, priority: 'Highest', reqs: ['FR-61', 'NFR-11', 'FR-50'], done: true,
  },
  {
    epic: 'dose', summary: 'Build the dose entry modal',
    description:
      'Three taps from launch, two if the child is skipped. Batch preselected to most-recently-used. No confirmation dialog on the dose path — undo replaces it. Blocks an expired batch; warns but still records when stock would go negative.',
    sprint: 'Sprint 1', points: 8, priority: 'Highest',
    reqs: ['FR-20', 'FR-21', 'FR-24', 'FR-28', 'FR-29', 'NFR-8'], done: true,
  },
  {
    epic: 'dose', summary: 'Make the child optional and skippable',
    description:
      'An unnamed dose is enormously better than an unlogged dose, so stock arithmetic is never held hostage to a data-entry field. Skipping flags needs_detail for day-end completion.',
    sprint: 'Sprint 1', points: 3, priority: 'Highest', reqs: ['FR-22', 'FR-23'], done: true,
  },
  {
    epic: 'corrections', summary: 'Implement undo as a reversing ledger entry',
    description:
      'An 8-second snackbar with a large hit area and a success haptic. Undo appends a REVERSAL; it never deletes. The same code path serves a correction made three weeks later.',
    sprint: 'Sprint 1', points: 5, priority: 'Highest',
    reqs: ['FR-40', 'FR-41', 'FR-43', 'FR-44', 'FR-45', 'NFR-9'], done: true,
  },
  {
    epic: 'stock', summary: 'Build the Receive Stock screen',
    description:
      'Batch number, expiry month/year, funding source, and a quantity stepper — in VIALS for vial-counted vaccines, with the dose equivalent shown. Expiry stored as the LAST day of the printed month.',
    sprint: 'Sprint 1', points: 5, priority: 'Highest', reqs: ['FR-10', 'FR-12', 'FR-13', 'FR-15'], done: true,
  },
  {
    epic: 'stock', summary: 'Build the Stock tab with low-stock warnings',
    description:
      'On-hand per vaccine with LOW/OUT badges that always carry a WORD, not just a colour. Negative stock is shown, never clamped, because it is the signal that a delivery went unlogged.',
    sprint: 'Sprint 1', points: 3, priority: 'High', reqs: ['FR-50', 'FR-58', 'FR-59', 'NFR-4'], done: true,
  },
  {
    epic: 'reports', summary: 'Build the Given Today report',
    description:
      'Every dose with time, vaccine, batch, child and staff member, plus per-vaccine totals. MUST use the effective view: "three given, one undone" has to read two, not three.',
    sprint: 'Sprint 1', points: 5, priority: 'Highest', reqs: ['FR-51', 'FR-52', 'FR-56'], done: true,
  },
  {
    epic: 'reports', summary: 'Build the reconciling movement strip',
    description:
      'Opening / +Received / -Given / -Wasted / = Now, shown together with the primary figure. "Now" is read directly off the ledger and corrections absorb the residual, so the derivation reconciles BY CONSTRUCTION and cannot present a sum that fails to add up.',
    sprint: 'Sprint 1', points: 5, priority: 'High', reqs: ['FR-53', 'FR-54', 'FR-55'], done: true,
  },
  {
    epic: 'backup', summary: 'Implement one-tap backup export',
    description:
      'A single zip with the full database plus spreadsheet-readable CSVs, offered to the share sheet. Uses serializeAsync, NEVER a raw file copy — under WAL journalling the recent commits are not yet in the .db file, which is how homegrown SQLite backup gets quietly broken.',
    sprint: 'Sprint 1', points: 8, priority: 'Highest', reqs: ['FR-70', 'FR-71', 'FR-72', 'FR-73'], done: true,
  },
  {
    epic: 'foundation', summary: 'Build the design token system and component library',
    description:
      '56dp minimum targets, 64dp primary actions, 18pt body, 14pt floor, 7:1 body contrast, steppers instead of keyboards, and no icon-only controls outside the tab bar. Written for a 50+ clinician working one-handed in a bright room.',
    sprint: 'Sprint 1', points: 5, priority: 'High',
    reqs: ['NFR-1', 'NFR-2', 'NFR-3', 'NFR-5', 'NFR-7'], done: true,
  },
  {
    epic: 'foundation', summary: 'Write the Layer A test suite',
    description:
      'Stock derivation, vial accounting, reversal, idempotency, local-date correctness, low-stock boundary, CSV quoting, backup validation, and a property test asserting the movement strip always equals derived on-hand.',
    sprint: 'Sprint 1', points: 8, priority: 'Highest', reqs: ['NFR-50', 'FR-54'], done: true,
  },

  // ---------------------------------------------------------------- Sprint 2
  {
    epic: 'delivery', summary: 'Produce the first APK via EAS and archive the keystore',
    description:
      'CRITICAL. A sideloaded APK upgrades in place only if signed with the same key. If the keystore is lost or rotated, updating requires an uninstall, WHICH DELETES THE CLINIC DATABASE. Run eas credentials, download the keystore and password, archive them off-machine. Never change android.package.',
    sprint: 'Sprint 2', points: 3, priority: 'Highest', reqs: ['NFR-23'],
  },
  {
    epic: 'backup', summary: 'Build restore with validate-before-commit',
    description:
      'Open the candidate IN MEMORY via deserializeDatabaseAsync, inspect it fully, show a confirmation with real counts from both the backup and the phone, snapshot the live database, then commit. Migrate forward afterwards in case the backup predates the current schema.',
    sprint: 'Sprint 2', points: 8, priority: 'Highest', reqs: ['FR-74', 'FR-76', 'FR-77', 'NFR-24'],
  },
  {
    epic: 'backup', summary: 'Give every restore rejection a specific message',
    description:
      'Not a zip / no database inside / newer schema version / missing tables / row counts contradicting the manifest. "Restore failed" teaches nothing and leaves the clinician unsure whether her data is safe.',
    sprint: 'Sprint 2', points: 3, priority: 'High', reqs: ['FR-75'],
  },
  {
    epic: 'backup', summary: 'Add backup prompts and daily on-device snapshots',
    description:
      'Amber at 3 days OR 25 unbacked entries; red at 14 days. Never modal, never blocking. A snooze must not silence the red state. Plus one silent .db snapshot per day, retaining seven.',
    sprint: 'Sprint 2', points: 5, priority: 'High', reqs: ['FR-78', 'FR-79', 'FR-80', 'FR-81'],
  },
  {
    epic: 'dose', summary: 'Add the patient register with type-ahead and quick-add',
    description:
      'Recent-children chips for the one-tap case, search by name prefix OR last four digits of the guardian phone, and inline creation from the dose screen. Never a separate form in the dose flow.',
    sprint: 'Sprint 2', points: 5, priority: 'High', reqs: ['FR-30'],
  },
  {
    epic: 'stock', summary: 'Add the staff list and per-entry attribution',
    description: 'More than one person enters data. Accountability by visibility — no login, no countersigning.',
    sprint: 'Sprint 2', points: 3, priority: 'Medium', reqs: ['FR-21'],
  },
  {
    epic: 'stock', summary: 'Separate government (UIP) from privately purchased balances',
    description:
      'funding_source is part of lot identity so the two never commingle. Counting only — no costing or accounting, which the clinician excluded.',
    sprint: 'Sprint 2', points: 3, priority: 'Medium', reqs: ['FR-13'],
  },
  {
    epic: 'stock', summary: 'Build the catalog editing screens',
    description:
      'Trade name, unit mode, doses-per-vial, safety limit, and hide-without-deleting. Carries the warning that doses-per-vial multiplies every count for that vaccine.',
    sprint: 'Sprint 2', points: 5, priority: 'High', reqs: ['FR-5', 'FR-6', 'FR-8'],
  },
  {
    epic: 'delivery', summary: 'Wire up expo-updates for over-the-air releases',
    description:
      'Fingerprint runtime version, so JavaScript-only fixes — including new migrations, which are just JS and SQL strings — ship without reinstalling and without touching the clinician\'s data.',
    sprint: 'Sprint 2', points: 3, priority: 'High', reqs: ['NFR-53'],
  },
  {
    epic: 'delivery', summary: 'Run the full 16-step on-phone script in airplane mode',
    description:
      'Steps 10 (the backup actually arrives and doses.csv opens), 11 (restore actually works), and 14 (font scale 1.6x) are the ones people skip and the ones that matter most.',
    sprint: 'Sprint 2', points: 5, priority: 'Highest', reqs: ['NFR-20', 'NFR-6', 'NFR-30'],
  },

  // ---------------------------------------------------------------- Sprint 3
  {
    epic: 'stock', summary: 'Add per-lot expiry warnings and FEFO suggestion',
    description:
      'First-expiry-first-out as a ONE-TAP SUGGESTION with a visible override, never a silent forced pick: the fridge may not match the app, and forcing the "correct" lot makes the record diverge from reality. Expired lots block; near-expiry only warns.',
    sprint: 'Sprint 3', points: 8, priority: 'High', reqs: ['FR-29'],
  },
  {
    epic: 'stock', summary: 'Add open-vial tracking with a discard window',
    description:
      'A reconstituted BCG or measles vial must be discarded after a few hours. Track opened_at and a snapshotted discard deadline, and write OPEN_VIAL_TIMEOUT wastage when it lapses rather than letting it happen implicitly.',
    sprint: 'Sprint 3', points: 8, priority: 'Medium', reqs: ['FR-46'],
  },
  {
    epic: 'corrections', summary: 'Build the ledger / audit screen with corrections',
    description:
      'The full history with corrections visible as corrections, and "Correct this entry" available indefinitely — the snackbar is only the fast path.',
    sprint: 'Sprint 3', points: 5, priority: 'High', reqs: ['FR-42'],
  },
  {
    epic: 'corrections', summary: 'Build blind physical-count reconciliation',
    description:
      'Walk lots in FEFO order asking for sealed vials and open-vial doses, and DO NOT SHOW the expected figure until after the count is entered — shown it first, a tired clinician types the expected figure. The discrepancy is recorded as a fact, never absorbed.',
    sprint: 'Sprint 3', points: 8, priority: 'High', reqs: ['FR-47'],
  },
  {
    epic: 'reports', summary: 'Add the history report with date range and share-as-text',
    description: 'Filter by vaccine and date range, and share a plain-text summary over WhatsApp.',
    sprint: 'Sprint 3', points: 5, priority: 'Medium', reqs: ['FR-51'],
  },
  {
    epic: 'reports', summary: 'Build the missing-child-name completion queue',
    description: 'A day-end list of doses logged without a name, completable without touching the arithmetic.',
    sprint: 'Sprint 3', points: 3, priority: 'Medium', reqs: ['FR-23', 'FR-60'],
  },

  // ---------------------------------------------------------------- Backlog
  {
    epic: 'reports', summary: 'Immunisation due-date reminders',
    description:
      'Requires encoding the IAP schedule. Large scope, high value — do it last, and only if she asks.',
    sprint: 'Backlog', points: 13, priority: 'Low', reqs: [],
  },
  {
    epic: 'foundation', summary: 'Multi-device merge',
    description:
      'Nearly free thanks to the existing keys: the ledger is an append-only set of immutable UUID-keyed rows, so merging is INSERT OR IGNORE and derived stock is correct by construction.',
    sprint: 'Backlog', points: 5, priority: 'Low', reqs: ['NFR-52'],
  },
  {
    epic: 'foundation', summary: 'Optional PIN lock and encryption at rest',
    description:
      'A PIN gate is cheap and JavaScript-only. SQLCipher requires leaving Expo Go for a custom development client, so it is a separate decision.',
    sprint: 'Backlog', points: 8, priority: 'Low', reqs: ['NFR-42'],
  },
];
