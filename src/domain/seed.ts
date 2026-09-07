import type { UnitMode } from './types';

export interface SeedVaccine {
  name: string;
  generic_name?: string;
  aliases?: string[];
  unit_mode: UnitMode;
  doses_per_vial: number;
  min_balance_doses: number;
}

/**
 * Indian pediatric catalog, roughly the IAP schedule, using the trade names
 * printed on the packaging - because the doctor thinks in trade names
 * ("Pentavac"), not in "the 6-week visit".
 *
 * SHIPPED AS EDITABLE SUGGESTIONS, NOT GOSPEL. doses_per_vial varies by
 * manufacturer and pack, and getting it wrong corrupts the stock arithmetic.
 * The catalog screen exists precisely so the doctor can correct it, and
 * onboarding must say: "Check these numbers against your fridge before you
 * start."
 *
 * `aliases` powers search only - it never creates a second identity, so
 * typing "dpt", "penta" or "easyfive" all land on one row.
 */
export const SEED_VACCINES: SeedVaccine[] = [
  // --- multi-dose vials: where vial/dose arithmetic goes wrong on paper ------
  { name: 'BCG', generic_name: 'BCG', aliases: ['bacillus calmette', 'b.c.g'], unit_mode: 'VIAL', doses_per_vial: 10, min_balance_doses: 20 },
  { name: 'OPV (bivalent)', generic_name: 'Oral Polio', aliases: ['opv', 'polio drops', 'bopv'], unit_mode: 'VIAL', doses_per_vial: 20, min_balance_doses: 20 },
  { name: 'Measles-Rubella (MR)', generic_name: 'MR', aliases: ['mr', 'measles rubella'], unit_mode: 'VIAL', doses_per_vial: 10, min_balance_doses: 10 },
  { name: 'Tresivac (MMR)', generic_name: 'MMR', aliases: ['mmr', 'measles mumps rubella'], unit_mode: 'VIAL', doses_per_vial: 10, min_balance_doses: 10 },
  { name: 'Jenvac (JE)', generic_name: 'Japanese Encephalitis', aliases: ['je', 'japanese encephalitis'], unit_mode: 'VIAL', doses_per_vial: 5, min_balance_doses: 5 },
  { name: 'Td (UIP)', generic_name: 'Td', aliases: ['td', 'tetanus diphtheria'], unit_mode: 'VIAL', doses_per_vial: 10, min_balance_doses: 10 },

  // --- single dose / prefilled ---------------------------------------------
  { name: 'Pentavac PFS', generic_name: 'DTwP-HepB-Hib', aliases: ['penta', 'pentavalent', 'dpt hepb hib'], unit_mode: 'DOSE', doses_per_vial: 1, min_balance_doses: 10 },
  { name: 'Easyfive-TT', generic_name: 'DTwP-HepB-Hib', aliases: ['easyfive', 'penta'], unit_mode: 'DOSE', doses_per_vial: 1, min_balance_doses: 5 },
  { name: 'Hexaxim', generic_name: 'DTaP-IPV-Hib-HepB', aliases: ['hexa', 'hexavalent'], unit_mode: 'DOSE', doses_per_vial: 1, min_balance_doses: 5 },
  { name: 'Infanrix Hexa', generic_name: 'DTaP-IPV-Hib-HepB', aliases: ['hexa', 'infanrix'], unit_mode: 'DOSE', doses_per_vial: 1, min_balance_doses: 5 },
  { name: 'Pentaxim', generic_name: 'DTaP-IPV-Hib', aliases: ['pentaxim'], unit_mode: 'DOSE', doses_per_vial: 1, min_balance_doses: 5 },
  { name: 'Genevac-B', generic_name: 'Hepatitis B', aliases: ['hep b', 'hepatitis b'], unit_mode: 'DOSE', doses_per_vial: 1, min_balance_doses: 5 },
  { name: 'IPV (Imovax Polio)', generic_name: 'IPV', aliases: ['ipv', 'injectable polio'], unit_mode: 'DOSE', doses_per_vial: 1, min_balance_doses: 5 },
  { name: 'Rotavac', generic_name: 'Rotavirus', aliases: ['rota', 'rotavirus'], unit_mode: 'DOSE', doses_per_vial: 1, min_balance_doses: 5 },
  { name: 'Rotasiil', generic_name: 'Rotavirus', aliases: ['rota', 'rotavirus'], unit_mode: 'DOSE', doses_per_vial: 1, min_balance_doses: 5 },
  { name: 'Rotarix', generic_name: 'Rotavirus', aliases: ['rota', 'rotavirus'], unit_mode: 'DOSE', doses_per_vial: 1, min_balance_doses: 5 },
  { name: 'Prevenar 13', generic_name: 'PCV', aliases: ['pcv', 'pneumococcal', 'prevnar'], unit_mode: 'DOSE', doses_per_vial: 1, min_balance_doses: 5 },
  { name: 'Pneumosil', generic_name: 'PCV', aliases: ['pcv', 'pneumococcal'], unit_mode: 'DOSE', doses_per_vial: 1, min_balance_doses: 5 },
  { name: 'Typbar-TCV', generic_name: 'Typhoid conjugate', aliases: ['typhoid', 'tcv'], unit_mode: 'DOSE', doses_per_vial: 1, min_balance_doses: 5 },
  { name: 'Havrix 720', generic_name: 'Hepatitis A', aliases: ['hep a', 'hepatitis a'], unit_mode: 'DOSE', doses_per_vial: 1, min_balance_doses: 4 },
  { name: 'Varilrix', generic_name: 'Varicella', aliases: ['varicella', 'chickenpox'], unit_mode: 'DOSE', doses_per_vial: 1, min_balance_doses: 4 },
  { name: 'Vaxigrip Tetra', generic_name: 'Influenza', aliases: ['flu', 'influenza'], unit_mode: 'DOSE', doses_per_vial: 1, min_balance_doses: 5 },
  { name: 'Boostrix (Tdap)', generic_name: 'Tdap', aliases: ['tdap', 'boostrix'], unit_mode: 'DOSE', doses_per_vial: 1, min_balance_doses: 4 },
  { name: 'Menactra', generic_name: 'Meningococcal', aliases: ['meningococcal', 'menactra'], unit_mode: 'DOSE', doses_per_vial: 1, min_balance_doses: 2 },
  { name: 'Cervavac (HPV)', generic_name: 'HPV', aliases: ['hpv', 'cervical'], unit_mode: 'DOSE', doses_per_vial: 1, min_balance_doses: 2 },
  { name: 'Rabipur', generic_name: 'Rabies', aliases: ['rabies', 'rabipur'], unit_mode: 'VIAL', doses_per_vial: 1, min_balance_doses: 2 },
];
