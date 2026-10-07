const PATTERN = /^(\d{4})\s*[/-]\s*(\d{2}|\d{4})$/;

const label = (start: number): string => `${start}/${String((start + 1) % 100).padStart(2, '0')}`;

/** "2026-2027", "2026/27", … → "2026/27"; `null` if it is not two consecutive years. */
export function normalizeSchoolYear(raw: string): string | null {
  const match = PATTERN.exec(raw.trim());
  if (!match) return null;
  const start = Number(match[1]);
  const end = Number(match[2]);
  const expected = match[2]!.length === 4 ? start + 1 : (start + 1) % 100;
  return end === expected ? label(start) : null;
}

/** Austrian school years start in August (months are 0-based in Date). */
export function currentSchoolYear(now: Date): string {
  return label(now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1);
}
