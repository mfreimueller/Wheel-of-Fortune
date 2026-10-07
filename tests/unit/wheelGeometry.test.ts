import { describe, expect, it } from 'vitest';
import type { Special, Student } from '../../src/core/types';
import { computeSegments, computeSpinRotation, layoutItems, WHEEL_PALETTE } from '../../src/renderer/utils/wheelGeometry';

const student = (id: string, lastName: string, color: string | null = null): Student => ({
  id,
  graderId: null,
  firstName: id,
  lastName,
  color,
  pickCount: 0,
  weight: 1,
  active: true,
});
const special = (id: string): Special => ({ id, label: id, color: '#6d28d9', kind: 'spin-again', probability: 5, showIn: 'always' });

describe('layoutItems', () => {
  it('orders students by last name', () => {
    const items = layoutItems([student('a', 'Zed'), student('b', 'Adler'), student('c', 'Mayer')], []);
    expect(items.map((i) => i.id)).toEqual(['b', 'c', 'a']);
  });

  it('spreads specials evenly between the students', () => {
    const students = ['a', 'b', 'c', 'd'].map((id) => student(id, id));
    const items = layoutItems(students, [special('s1'), special('s2')]);
    expect(items.map((i) => i.id)).toEqual(['a', 's1', 'b', 'c', 's2', 'd']);
  });

  it('marks specials and keeps students unmarked', () => {
    const items = layoutItems([student('a', 'A')], [special('s')]);
    expect(items.map((i) => i.special)).toEqual([false, true]);
  });

  it('puts a lone special after a lone student without crashing', () => {
    expect(layoutItems([], [special('s')]).map((i) => i.id)).toEqual(['s']);
  });
});

describe('computeSegments', () => {
  const items = layoutItems([student('a', 'A', '#112233'), student('b', 'B')], []);

  it('uses a student color first and the palette otherwise', () => {
    const segments = computeSegments(items);
    expect(segments[0]!.color).toBe('#112233');
    expect(segments[1]!.color).toBe(WHEEL_PALETTE[1]);
  });

  it('gives every item an equally sized segment and a label angle at its centre', () => {
    const segments = computeSegments(items);
    expect(segments.map((s) => s.labelAngle)).toEqual([90, 270]);
  });

  it('renders a single item as a full disc', () => {
    const [only] = computeSegments(layoutItems([student('a', 'A')], []));
    expect(only!.path).toContain('A 100 100');
    expect(only!.path.match(/A /g)).toHaveLength(2);
  });

  it('abbreviates the last name to its first letter', () => {
    const [segment] = computeSegments(layoutItems([student('Anna', 'Bob')], []));
    expect(segment!.label).toBe('Anna B.');
  });

  it('keeps a special label whole up to the limit and ellipsizes beyond it', () => {
    const long = { ...special('x'), label: 'Schriftliche Überprüfung für alle' };
    const [segment] = computeSegments(layoutItems([], [long]));
    expect(segment!.label.endsWith('…')).toBe(true);
    expect(segment!.label.length).toBeLessThanOrEqual(16);
  });

  it('keeps a special color regardless of the palette', () => {
    const [segment] = computeSegments(layoutItems([], [special('s')]));
    expect(segment!.color).toBe('#6d28d9');
    expect(segment!.special).toBe(true);
  });
});

describe('computeSpinRotation', () => {
  it('ends with the winner centre under the pointer at angle 0, after several full turns', () => {
    const rotation = computeSpinRotation({ count: 4, index: 1, current: 0, jitter: 0 });
    // segment 1 spans 90–180°, centre 135°; the disc must turn -135° ≡ 225° plus 5 turns
    expect(rotation).toBe(5 * 360 + 225);
  });

  it('adds up from the current rotation instead of rewinding', () => {
    const first = computeSpinRotation({ count: 4, index: 1, current: 0, jitter: 0 });
    const second = computeSpinRotation({ count: 4, index: 3, current: first, jitter: 0 });
    expect(second).toBeGreaterThan(first + 5 * 360 - 1);
    expect(((second % 360) + 360) % 360).toBe(((-(3.5 * 90) % 360) + 360) % 360);
  });

  it('ignores jitter for a single item', () => {
    expect(computeSpinRotation({ count: 1, index: 0, current: 0, jitter: 0.4 })).toBe(computeSpinRotation({ count: 1, index: 0, current: 0, jitter: 0 }));
  });
});
