import type { Special, Student } from './types';

export const MAX_SPIN_AGAIN = 10;

export type DrawResult =
  | { kind: 'student'; studentId: string }
  | { kind: 'special'; special: Special };

export type DrawOutcome =
  | { ok: true; /** Every spin to play back; all but the last are spin-again specials. */ spins: DrawResult[] }
  | { ok: false; error: 'no-eligible-students' };

export interface DrawInput {
  students: readonly Student[];
  specials: readonly Special[];
  fair: boolean;
  absentIds: ReadonlySet<string>;
  /** Must return a number in [0, 1), like Math.random. */
  random: () => number;
}

export type SpecialsValidation = { ok: true } | { ok: false; error: 'invalid-probability' | 'sum-too-high' };

export function eligibleStudents(students: readonly Student[], absentIds: ReadonlySet<string>): Student[] {
  return students.filter((s) => s.active && !absentIds.has(s.id) && s.weight > 0);
}

/** Everybody at the lowest pick count, in roster order. */
export function fairPool(students: readonly Student[]): Student[] {
  if (students.length === 0) return [];
  const min = Math.min(...students.map((s) => s.pickCount));
  return students.filter((s) => s.pickCount === min);
}

/** Free-only specials neither appear on the wheel nor take part in the draw in fair mode. */
export function activeSpecials(specials: readonly Special[], fair: boolean): Special[] {
  return specials.filter((s) => s.showIn === 'always' || !fair);
}

/** The probabilities of all specials, whatever their visibility, must stay below 100 % in total. */
export function validateSpecials(specials: readonly Special[]): SpecialsValidation {
  if (specials.some((s) => !Number.isFinite(s.probability) || s.probability < 0 || s.probability > 100)) {
    return { ok: false, error: 'invalid-probability' };
  }
  const sum = specials.reduce((total, s) => total + s.probability, 0);
  return sum < 100 ? { ok: true } : { ok: false, error: 'sum-too-high' };
}

export function draw(input: DrawInput): DrawOutcome {
  const eligible = eligibleStudents(input.students, input.absentIds);
  const pool = input.fair ? fairPool(eligible) : eligible;
  if (pool.length === 0) return { ok: false, error: 'no-eligible-students' };

  const specials = activeSpecials(input.specials, input.fair);
  const spins: DrawResult[] = [];

  for (let chained = 0; ; chained++) {
    // After too many spin-agains the specials are ignored, which guarantees the loop ends.
    const special = chained < MAX_SPIN_AGAIN ? rollSpecial(specials, input.random) : null;
    if (special) {
      spins.push({ kind: 'special', special });
      if (special.kind === 'spin-again') continue;
      break;
    }
    spins.push({ kind: 'student', studentId: weightedPick(pool, input.random).id });
    break;
  }
  return { ok: true, spins };
}

function rollSpecial(specials: readonly Special[], random: () => number): Special | null {
  if (specials.length === 0) return null;
  const roll = random() * 100;
  let cumulative = 0;
  for (const special of specials) {
    cumulative += special.probability;
    if (roll < cumulative) return special;
  }
  return null;
}

function weightedPick(pool: readonly Student[], random: () => number): Student {
  const total = pool.reduce((sum, s) => sum + s.weight, 0);
  let target = random() * total;
  for (const student of pool) {
    target -= student.weight;
    if (target < 0) return student;
  }
  return pool[pool.length - 1]!;
}
