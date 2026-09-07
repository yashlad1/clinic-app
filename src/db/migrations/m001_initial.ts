import type { Db } from '../driver';

/**
 * Migration 001 - the initial schema.
 *
 * The CHECK constraints and triggers in here are not decoration; they are the
 * design. They make the two paper failure modes structurally impossible:
 *
 *   1. Misspelling      -> vaccine identity is a FK into `vaccines`, never a string.
 *   2. Wrong decrement  -> stock is derived from an append-only ledger, and the
 *                          ledger's arithmetic columns cannot be updated or deleted.
 */
export const m001 = {
  to: 1,
  name: 'initial',
  up: async (tx: Db) => {
    await tx.exec(`
--------------------------------------------------------------------------------
-- vaccines: the canonical catalog. The ONLY source of vaccine identity.
-- Creating a row here is an admin action and must not be reachable from any
-- data-entry screen; if the entry screen can create a catalog row, we have
-- re-invented free text with extra steps.
--------------------------------------------------------------------------------
CREATE TABLE vaccines (
  id                TEXT    PRIMARY KEY NOT NULL,
  name              TEXT    NOT NULL,                    -- trade name, as printed on the vial
  generic_name      TEXT,                                -- nullable; groups trade names later
  aliases           TEXT    NOT NULL DEFAULT '[]',       -- JSON array; powers search only
  unit_mode         TEXT    NOT NULL CHECK (unit_mode IN ('DOSE','VIAL')),
  doses_per_vial    INTEGER NOT NULL DEFAULT 1 CHECK (doses_per_vial >= 1),
  min_balance_doses INTEGER NOT NULL DEFAULT 0 CHECK (min_balance_doses >= 0),
  is_active         INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  sort_hint         INTEGER NOT NULL DEFAULT 0,
  created_at        INTEGER NOT NULL,
  updated_at        INTEGER NOT NULL,
  deleted_at        INTEGER,
  device_id         TEXT    NOT NULL,
  -- A single-dose presentation cannot claim more than one dose per vial.
  CHECK (unit_mode <> 'DOSE' OR doses_per_vial = 1)
);
CREATE UNIQUE INDEX ux_vaccines_name ON vaccines(name) WHERE deleted_at IS NULL;
CREATE INDEX ix_vaccines_active ON vaccines(is_active) WHERE deleted_at IS NULL;

--------------------------------------------------------------------------------
-- lots: a physical batch. Unlike vaccines, creating a lot IS a normal outcome
-- of receiving stock, so the receive screen may create these.
-- expiry_date is stored as the LAST day of the printed month: vials print
-- MM/YYYY and are usable *through* that month, so storing the 1st would write
-- off a whole lot 30 days early, every time.
--------------------------------------------------------------------------------
CREATE TABLE lots (
  id                TEXT    PRIMARY KEY NOT NULL,
  vaccine_id        TEXT    NOT NULL REFERENCES vaccines(id),
  lot_number        TEXT    NOT NULL,
  expiry_date       TEXT,                                -- 'YYYY-MM-DD', last day of printed month
  funding_source    TEXT    NOT NULL DEFAULT 'PRIVATE'
                            CHECK (funding_source IN ('PRIVATE','GOVT_UIP')),
  first_received_at INTEGER,
  created_at        INTEGER NOT NULL,
  updated_at        INTEGER NOT NULL,
  deleted_at        INTEGER,
  device_id         TEXT    NOT NULL
);
-- Government (UIP) and privately purchased stock must not commingle, so
-- funding_source is part of lot identity.
CREATE UNIQUE INDEX ux_lots_identity
  ON lots(vaccine_id, lot_number, funding_source) WHERE deleted_at IS NULL;
CREATE INDEX ix_lots_vaccine ON lots(vaccine_id) WHERE deleted_at IS NULL;
CREATE INDEX ix_lots_expiry  ON lots(expiry_date) WHERE deleted_at IS NULL;

--------------------------------------------------------------------------------
-- patients: minimal and deliberately separable. The inventory ledger must stay
-- operationally valid with patient rows redacted.
--------------------------------------------------------------------------------
CREATE TABLE patients (
  id             TEXT    PRIMARY KEY NOT NULL,
  name           TEXT    NOT NULL,
  dob            TEXT,
  guardian_phone TEXT,
  created_at     INTEGER NOT NULL,
  updated_at     INTEGER NOT NULL,
  deleted_at     INTEGER,
  device_id      TEXT    NOT NULL
);
CREATE INDEX ix_patients_name  ON patients(name) WHERE deleted_at IS NULL;
CREATE INDEX ix_patients_phone ON patients(guardian_phone) WHERE deleted_at IS NULL;

--------------------------------------------------------------------------------
-- staff: more than one person enters data, so every ledger row is attributable.
-- Accountability by visibility - no countersigning, no two-person rule.
--------------------------------------------------------------------------------
CREATE TABLE staff (
  id         TEXT    PRIMARY KEY NOT NULL,
  name       TEXT    NOT NULL,
  is_active  INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,
  device_id  TEXT    NOT NULL
);

--------------------------------------------------------------------------------
-- stock_movements: THE LEDGER. The only source of truth for stock.
--
-- Append-only. There is no deleted_at here on purpose - a soft delete would be
-- a lie about an audit trail. The only way to undo anything is to append a
-- REVERSAL row pointing at the original, and both rows survive forever.
--
-- delta_doses is signed: + for receipts, - for administrations. On-hand is
-- SUM(delta_doses). Doses are always the unit; vials are a packaging fact that
-- the app converts, never the clinician.
--------------------------------------------------------------------------------
CREATE TABLE stock_movements (
  id                TEXT    PRIMARY KEY NOT NULL,
  -- Derived from (device_id, client_action_id) at the moment of the user's tap,
  -- so a retried or replayed write is a no-op that looks like success.
  idempotency_key   TEXT    NOT NULL UNIQUE,
  vaccine_id        TEXT    NOT NULL REFERENCES vaccines(id),
  lot_id            TEXT    REFERENCES lots(id),
  delta_doses       INTEGER NOT NULL CHECK (delta_doses <> 0),
  movement_type     TEXT    NOT NULL CHECK (movement_type IN
                      ('OPENING_BALANCE','RECEIPT','ADMINISTRATION',
                       'WASTAGE','ADJUSTMENT','REVERSAL')),
  wastage_reason    TEXT    CHECK (wastage_reason IS NULL OR wastage_reason IN
                      ('OPEN_VIAL_TIMEOUT','BREAKAGE','EXPIRED',
                       'COLD_CHAIN','CONTAMINATION','OTHER')),
  -- Only CLINIC_STOCK affects on-hand. Present from day one with no UI: it costs
  -- one column and means adding patient-supplied doses later is not a migration
  -- of the entire ledger.
  stock_source      TEXT    NOT NULL DEFAULT 'CLINIC_STOCK'
                            CHECK (stock_source IN ('CLINIC_STOCK','PATIENT_SUPPLIED')),
  patient_id        TEXT    REFERENCES patients(id),
  -- The child's name exactly as typed at that moment. Renaming or merging a
  -- patient later must never rewrite history.
  patient_label     TEXT,
  staff_id          TEXT    REFERENCES staff(id),
  occurred_at       INTEGER NOT NULL,   -- epoch ms UTC; the clinical time
  -- local_date/local_time are computed and STORED at write time. 'Given today'
  -- is then an indexed equality test that is deterministic and unit-testable;
  -- date('now','localtime') at query time depends on the device's *current*
  -- timezone and cannot be tested in CI.
  local_date        TEXT    NOT NULL,   -- 'YYYY-MM-DD'
  local_time        TEXT    NOT NULL,   -- 'HH:MM'
  tz_offset_minutes INTEGER NOT NULL,
  recorded_at       INTEGER NOT NULL,   -- when the row was actually written
  reverses_id       TEXT    REFERENCES stock_movements(id),
  note              TEXT,
  needs_detail      INTEGER NOT NULL DEFAULT 0 CHECK (needs_detail IN (0,1)),
  created_at        INTEGER NOT NULL,
  updated_at        INTEGER NOT NULL,
  device_id         TEXT    NOT NULL,

  -- Sign invariants: the type and the sign of delta_doses must agree.
  CHECK (movement_type NOT IN ('OPENING_BALANCE','RECEIPT') OR delta_doses > 0),
  CHECK (movement_type NOT IN ('ADMINISTRATION','WASTAGE')  OR delta_doses < 0),
  -- Only a REVERSAL may point at another movement, and it must.
  CHECK (movement_type <> 'REVERSAL' OR reverses_id IS NOT NULL),
  CHECK (reverses_id IS NULL OR movement_type = 'REVERSAL'),
  CHECK (wastage_reason IS NULL OR movement_type = 'WASTAGE')
);

-- A movement can be reversed at most once.
CREATE UNIQUE INDEX ux_movements_reverses
  ON stock_movements(reverses_id) WHERE reverses_id IS NOT NULL;
CREATE INDEX ix_movements_local_date ON stock_movements(local_date);
CREATE INDEX ix_movements_vaccine    ON stock_movements(vaccine_id);
CREATE INDEX ix_movements_lot        ON stock_movements(lot_id);
CREATE INDEX ix_movements_occurred   ON stock_movements(occurred_at);
CREATE INDEX ix_movements_patient    ON stock_movements(patient_id);
CREATE INDEX ix_movements_needs_detail
  ON stock_movements(needs_detail) WHERE needs_detail = 1;

--------------------------------------------------------------------------------
-- Immutability, enforced in the storage layer rather than by app discipline.
-- Application-level agreements not to mutate a ledger have a perfect record of
-- eventually being broken.
--
-- The split is deliberate: the ARITHMETIC is immutable, but the ANNOTATIONS
-- (patient_id, patient_label, needs_detail, note) stay editable so the doctor
-- can fill in a skipped child name at day end without polluting the ledger with
-- two extra rows that net to zero.
--------------------------------------------------------------------------------
CREATE TRIGGER trg_movements_immutable_arithmetic
BEFORE UPDATE OF
  id, idempotency_key, vaccine_id, lot_id, delta_doses, movement_type,
  wastage_reason, stock_source, occurred_at, local_date, local_time,
  tz_offset_minutes, reverses_id, device_id
ON stock_movements
BEGIN
  SELECT RAISE(ABORT,
    'stock_movements is append-only: append a REVERSAL instead of editing a movement');
END;

CREATE TRIGGER trg_movements_no_delete
BEFORE DELETE ON stock_movements
BEGIN
  SELECT RAISE(ABORT,
    'stock_movements is append-only: append a REVERSAL instead of deleting a movement');
END;

-- A REVERSAL may not itself be reversed. To undo an undo, write a fresh
-- forward movement - otherwise "effective" becomes ambiguous.
CREATE TRIGGER trg_movements_no_reversal_of_reversal
BEFORE INSERT ON stock_movements
WHEN NEW.reverses_id IS NOT NULL
 AND (SELECT movement_type FROM stock_movements WHERE id = NEW.reverses_id) = 'REVERSAL'
BEGIN
  SELECT RAISE(ABORT,
    'cannot reverse a REVERSAL: append a new forward movement instead');
END;

--------------------------------------------------------------------------------
-- settings: key/value. clinic_name, device_id, last_backup_at,
-- doses_since_backup, current_staff_id, onboarding_done.
--------------------------------------------------------------------------------
CREATE TABLE settings (
  key        TEXT PRIMARY KEY NOT NULL,
  value      TEXT,
  updated_at INTEGER NOT NULL
);

--------------------------------------------------------------------------------
-- Derived reads. Stock is NEVER a stored column - a mutable current_stock
-- integer is precisely the artifact that drifts. It is the paper notebook in a
-- database.
--------------------------------------------------------------------------------

-- Excludes REVERSAL rows AND the originals they reversed.
--
-- THE SUBTLETY MOST LIKELY TO BECOME A REPORTING BUG:
--   * For BALANCES, sum the raw table. Reversals cancel arithmetically, which is
--     the entire reason reversing entries are the right design.
--   * For ACTIVITY COUNTS ('how many doses were given today'), you MUST use this
--     view, or "3 given, 1 undone" renders as 3.
CREATE VIEW v_movement_effective AS
SELECT m.* FROM stock_movements m
WHERE m.movement_type <> 'REVERSAL'
  AND NOT EXISTS (SELECT 1 FROM stock_movements r WHERE r.reverses_id = m.id);

-- On-hand per vaccine. Sums the RAW table on purpose (see above).
CREATE VIEW v_stock_on_hand AS
SELECT
  v.id                                AS vaccine_id,
  v.name                              AS name,
  v.generic_name                      AS generic_name,
  v.unit_mode                         AS unit_mode,
  v.doses_per_vial                    AS doses_per_vial,
  v.min_balance_doses                 AS min_balance_doses,
  v.is_active                         AS is_active,
  COALESCE(SUM(m.delta_doses), 0)     AS on_hand_doses
FROM vaccines v
LEFT JOIN stock_movements m
       ON m.vaccine_id = v.id
      AND m.stock_source = 'CLINIC_STOCK'
WHERE v.deleted_at IS NULL
GROUP BY v.id;

-- On-hand per lot, for FEFO and for reconciliation.
CREATE VIEW v_lot_balance AS
SELECT
  l.id                            AS lot_id,
  l.vaccine_id                    AS vaccine_id,
  l.lot_number                    AS lot_number,
  l.expiry_date                   AS expiry_date,
  l.funding_source                AS funding_source,
  COALESCE(SUM(m.delta_doses), 0) AS on_hand_doses
FROM lots l
LEFT JOIN stock_movements m
       ON m.lot_id = l.id
      AND m.stock_source = 'CLINIC_STOCK'
WHERE l.deleted_at IS NULL
GROUP BY l.id;
    `);
  },
};
