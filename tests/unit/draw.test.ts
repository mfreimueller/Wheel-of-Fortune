import { describe, expect, it } from 'vitest';
import { activeSpecials, draw, eligibleStudents, fairPool, validateSpecials } from '../../src/core/draw';
import type { Special, Student } from '../../src/core/types';

function student(id: string, overrides: Partial<Student> = {}): Student {
  return {
    id,
    graderId: null,
    firstName: id,
    lastName: 'Test',
    color: null,
    pickCount: 0,
    weight: 1,
    active: true,
    ...overrides,
  };
}

function special(id: string, overrides: Partial<Special> = {}): Special {
  return { id, label: id, color: '#6d28d9', kind: 'spin-again', probability: 10, showIn: 'always', ...overrides };
}

/** A random() that returns the given values in order. */
function sequence(...values: number[]): () => number {
  let i = 0;
  return () => {
    const v = values[i];
    if (v === undefined) throw new Error('random() called more often than expected');
    i += 1;
    return v;
  };
}

const none = new Set<string>();

describe('eligibleStudents', () => {
  it('excludes inactive, absent and zero-weight students', () => {
    const students = [
      student('a'),
      student('inactive', { active: false }),
      student('absent'),
      student('zero', { weight: 0 }),
    ];
    expect(eligibleStudents(students, new Set(['absent'])).map((s) => s.id)).toEqual(['a']);
  });
});

describe('fairPool', () => {
  it('contains only the students with the lowest pick count', () => {
    const students = [student('a', { pickCount: 2 }), student('b', { pickCount: 1 }), student('c', { pickCount: 1 })];
    expect(fairPool(students).map((s) => s.id)).toEqual(['b', 'c']);
  });

  it('is everybody again once all have the same count', () => {
    const students = [student('a', { pickCount: 3 }), student('b', { pickCount: 3 })];
    expect(fairPool(students).map((s) => s.id)).toEqual(['a', 'b']);
  });

  it('is empty without students', () => {
    expect(fairPool([])).toEqual([]);
  });
});

describe('activeSpecials', () => {
  const always = special('always');
  const freeOnly = special('free', { showIn: 'free-only' });

  it('shows every special in free mode', () => {
    expect(activeSpecials([always, freeOnly], false).map((s) => s.id)).toEqual(['always', 'free']);
  });

  it('hides free-only specials in fair mode', () => {
    expect(activeSpecials([always, freeOnly], true).map((s) => s.id)).toEqual(['always']);
  });
});

describe('validateSpecials', () => {
  it('accepts probabilities that sum to less than 100', () => {
    expect(validateSpecials([special('a', { probability: 40 }), special('b', { probability: 59 })])).toEqual({ ok: true });
  });

  it('rejects a sum of 100 or more, even for specials hidden in fair mode', () => {
    const result = validateSpecials([special('a', { probability: 60 }), special('b', { probability: 40, showIn: 'free-only' })]);
    expect(result).toEqual({ ok: false, error: 'sum-too-high' });
  });

  it.each([-1, Number.NaN, 101])('rejects the single probability %s', (probability) => {
    expect(validateSpecials([special('a', { probability })])).toEqual({ ok: false, error: 'invalid-probability' });
  });
});

describe('draw', () => {
  it('fails when nobody is eligible', () => {
    const result = draw({ students: [student('a', { active: false })], specials: [], fair: true, absentIds: none, random: sequence() });
    expect(result).toEqual({ ok: false, error: 'no-eligible-students' });
  });

  it('picks the student whose weight range contains the roll', () => {
    const students = [student('a'), student('b', { weight: 3 })]; // total 4: a < 1, b < 4
    const pick = (roll: number) =>
      draw({ students, specials: [], fair: false, absentIds: none, random: sequence(roll) });
    expect(pick(0.0)).toEqual({ ok: true, spins: [{ kind: 'student', studentId: 'a' }] });
    expect(pick(0.24)).toEqual({ ok: true, spins: [{ kind: 'student', studentId: 'a' }] });
    expect(pick(0.25)).toEqual({ ok: true, spins: [{ kind: 'student', studentId: 'b' }] });
    expect(pick(0.999)).toEqual({ ok: true, spins: [{ kind: 'student', studentId: 'b' }] });
  });

  it('only draws from the fair pool in fair mode', () => {
    const students = [student('a', { pickCount: 1 }), student('b', { pickCount: 0 })];
    const result = draw({ students, specials: [], fair: true, absentIds: none, random: sequence(0) });
    expect(result).toEqual({ ok: true, spins: [{ kind: 'student', studentId: 'b' }] });
  });

  it('skips absent students', () => {
    const students = [student('a'), student('b')];
    const result = draw({ students, specials: [], fair: false, absentIds: new Set(['a']), random: sequence(0) });
    expect(result).toEqual({ ok: true, spins: [{ kind: 'student', studentId: 'b' }] });
  });

  it('draws a message special when the roll falls into its percentage', () => {
    const message = special('msg', { kind: 'message', message: 'Blatt raus', probability: 5 });
    const result = draw({ students: [student('a')], specials: [message], fair: false, absentIds: none, random: sequence(0.04) });
    expect(result).toEqual({ ok: true, spins: [{ kind: 'special', special: message }] });
  });

  it('draws a student when the roll is above all special percentages', () => {
    const message = special('msg', { kind: 'message', probability: 5 });
    const result = draw({ students: [student('a')], specials: [message], fair: false, absentIds: none, random: sequence(0.05, 0.5) });
    expect(result).toEqual({ ok: true, spins: [{ kind: 'student', studentId: 'a' }] });
  });

  it('does not draw free-only specials in fair mode', () => {
    const freeOnly = special('free', { kind: 'message', probability: 90, showIn: 'free-only' });
    const result = draw({ students: [student('a')], specials: [freeOnly], fair: true, absentIds: none, random: sequence(0.01, 0.5) });
    expect(result).toEqual({ ok: true, spins: [{ kind: 'student', studentId: 'a' }] });
  });

  it('chains spins after spin-again and ends with the final result', () => {
    const again = special('again', { probability: 10 });
    const result = draw({
      students: [student('a')],
      specials: [again],
      fair: false,
      absentIds: none,
      random: sequence(0.05, 0.02, 0.5, 0.5), // again, again, then student (roll 0.5 → 50 > 10, then weighted pick)
    });
    expect(result).toEqual({
      ok: true,
      spins: [
        { kind: 'special', special: again },
        { kind: 'special', special: again },
        { kind: 'student', studentId: 'a' },
      ],
    });
  });

  it('stops chaining spin-again after 10 repeats and then ignores specials', () => {
    const again = special('again', { probability: 99 });
    const rolls = [...Array<number>(10).fill(0), 0, 0]; // 10 × spin-again, then the forced student draw
    const result = draw({ students: [student('a')], specials: [again], fair: false, absentIds: none, random: sequence(...rolls) });
    expect(result.ok && result.spins).toHaveLength(11);
    expect(result.ok && result.spins.at(-1)).toEqual({ kind: 'student', studentId: 'a' });
  });
});

describe('draw: weights', () => {
  /** Small deterministic PRNG so the simulation never flakes. */
  function mulberry32(seed: number): () => number {
    let a = seed;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  it('picks a student with weight 3 about three times as often as one with weight 1 in free mode', () => {
    const students = [student('light'), student('heavy', { weight: 3 })];
    const random = mulberry32(42);
    const tally = { light: 0, heavy: 0 };
    for (let i = 0; i < 4000; i++) {
      const result = draw({ students, specials: [], fair: false, absentIds: none, random });
      const spin = result.ok ? result.spins[0] : undefined;
      if (spin?.kind === 'student') tally[spin.studentId as 'light' | 'heavy'] += 1;
    }
    expect(tally.heavy / tally.light).toBeGreaterThan(2.6);
    expect(tally.heavy / tally.light).toBeLessThan(3.4);
  });

  it('picks a student with weight 0.5 half as often as one with weight 1', () => {
    const students = [student('normal'), student('rare', { weight: 0.5 })];
    const random = mulberry32(7);
    let rare = 0;
    for (let i = 0; i < 3000; i++) {
      const result = draw({ students, specials: [], fair: false, absentIds: none, random });
      if (result.ok && result.spins[0]?.kind === 'student' && result.spins[0].studentId === 'rare') rare += 1;
    }
    expect(rare / 3000).toBeGreaterThan(0.29);
    expect(rare / 3000).toBeLessThan(0.37);
  });
});
