import { describe, expect, it } from 'vitest';
import { normalizeColor } from '../../src/core/color';

describe('normalizeColor', () => {
  it('keeps a six-digit hex color and lowercases it', () => {
    expect(normalizeColor('#ED1943')).toBe('#ed1943');
  });

  it('expands a three-digit shorthand', () => {
    expect(normalizeColor('#fab')).toBe('#ffaabb');
  });

  it('trims surrounding whitespace', () => {
    expect(normalizeColor('  #102 ')).toBe('#110022');
  });

  it.each(['', 'red', '#12', '#12345', '#1234567', 'ed1943', '#gggggg'])('rejects %j', (raw) => {
    expect(normalizeColor(raw)).toBeNull();
  });
});
