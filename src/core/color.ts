const SHORT_HEX = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/;
const LONG_HEX = /^#[0-9a-f]{6}$/;

/** Normalizes `#rgb` / `#rrggbb` to lowercase `#rrggbb`; `null` for anything else. */
export function normalizeColor(raw: string): string | null {
  const value = raw.trim().toLowerCase();
  const short = SHORT_HEX.exec(value);
  if (short) return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`;
  return LONG_HEX.test(value) ? value : null;
}
