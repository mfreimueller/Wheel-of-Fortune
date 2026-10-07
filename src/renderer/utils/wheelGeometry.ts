// Pure geometry for the wheel, kept out of the Vue component so it can be unit-tested.
// Adapted from Grader's Schülerauswahl. The pointer sits at 3 o'clock, so a spin ends with the winner's
// segment centre (± jitter) at angle 0. All segments are equally sized on purpose: weights and special
// probabilities must not be readable from the wheel.
import type { Special, SpecialKind, Student } from '../../core/types';

export const WHEEL_PALETTE = ['#ed1943', '#004a8d', '#d97706', '#059669', '#6d28d9', '#0891b2'] as const;

const RADIUS = 100;
const FULL_TURNS = 5;
const MAX_LABEL_CHARS = 16;
const JITTER_SHARE = 0.6;

export interface WheelItem {
  /** Student id or special id. */
  id: string;
  label: string;
  color: string | null;
  special: boolean;
  kind: SpecialKind | null;
}

export interface WheelSegment {
  id: string;
  path: string;
  color: string;
  labelAngle: number;
  label: string;
  textColor: string;
  special: boolean;
}

/** Dark or white text, whichever reads better on the given `#rrggbb` background (WCAG relative luminance). */
export function labelColor(background: string): string {
  const channel = (offset: number): number => {
    const value = parseInt(background.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
  return luminance > 0.4 ? '#111827' : '#ffffff';
}

/** Students by last name, with the specials spread evenly between them. */
export function layoutItems(students: readonly Student[], specials: readonly Special[]): WheelItem[] {
  const sorted = [...students].sort(
    (a, b) => a.lastName.localeCompare(b.lastName, 'de') || a.firstName.localeCompare(b.firstName, 'de'),
  );
  const studentItems: WheelItem[] = sorted.map((s) => ({
    id: s.id,
    label: `${s.firstName} ${s.lastName.charAt(0)}.`,
    color: s.color,
    special: false,
    kind: null,
  }));
  const specialItems: WheelItem[] = specials.map((s) => ({ id: s.id, label: s.label, color: s.color, special: true, kind: s.kind }));

  const total = studentItems.length + specialItems.length;
  const specialSlots = new Map<number, WheelItem>();
  specialItems.forEach((item, j) => specialSlots.set(Math.floor(((j + 0.5) * total) / specialItems.length), item));

  const result: WheelItem[] = [];
  let nextStudent = 0;
  for (let slot = 0; slot < total; slot++) {
    const special = specialSlots.get(slot);
    result.push(special ?? studentItems[nextStudent++]!);
  }
  return result;
}

export function computeSegments(items: readonly WheelItem[]): WheelSegment[] {
  const n = items.length;
  const step = (2 * Math.PI) / n;
  const point = (a: number): string => `${(RADIUS * Math.cos(a)).toFixed(3)} ${(RADIUS * Math.sin(a)).toFixed(3)}`;

  return items.map((item, i) => {
    // An own color always wins; the anti-clash tweak only applies to palette colors.
    let color: string = item.color ?? WHEEL_PALETTE[i % WHEEL_PALETTE.length]!;
    if (!item.color && n > 1 && i === n - 1 && color === WHEEL_PALETTE[0]) {
      color = WHEEL_PALETTE[(i + 1) % WHEEL_PALETTE.length]!;
    }

    // A single item is a full disc; an SVG arc cannot start and end on the same point.
    const path =
      n === 1
        ? `M ${RADIUS} 0 A ${RADIUS} ${RADIUS} 0 1 1 ${-RADIUS} 0 A ${RADIUS} ${RADIUS} 0 1 1 ${RADIUS} 0 Z`
        : `M 0 0 L ${point(i * step)} A ${RADIUS} ${RADIUS} 0 ${step > Math.PI ? 1 : 0} 1 ${point((i + 1) * step)} Z`;

    return {
      id: item.id,
      path,
      color,
      labelAngle: ((i + 0.5) * 360) / n,
      label: item.label.length > MAX_LABEL_CHARS ? `${item.label.slice(0, MAX_LABEL_CHARS - 1)}…` : item.label,
      textColor: labelColor(color),
      special: item.special,
    };
  });
}

export function wheelFontSize(count: number): number {
  return count > 24 ? 6 : count > 16 ? 7.5 : count > 10 ? 9 : 10.5;
}

export interface SpinInput {
  count: number;
  /** Index of the winner in the displayed order. */
  index: number;
  /** Current rotation of the disc in degrees. */
  current: number;
  /** Landing offset inside the segment, from -0.5 to 0.5. Ignored for a single item. */
  jitter: number;
}

/** The disc rotation (degrees) that ends with the winner's segment under the pointer after several turns. */
export function computeSpinRotation({ count, index, current, jitter }: SpinInput): number {
  const step = 360 / count;
  const offset = count > 1 ? jitter * step * JITTER_SHARE : 0;
  const needed = mod(-((index + 0.5) * step + offset) - current, 360);
  return current + FULL_TURNS * 360 + needed;
}

function mod(value: number, m: number): number {
  return ((value % m) + m) % m;
}
