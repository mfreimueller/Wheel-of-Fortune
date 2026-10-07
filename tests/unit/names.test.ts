import { describe, expect, it } from 'vitest';
import { nameKey } from '../../src/core/names';

describe('nameKey', () => {
  it('ignores case, surrounding and repeated whitespace', () => {
    expect(nameKey('  Anna  Maria ', 'BOB')).toBe(nameKey('anna maria', 'bob'));
  });

  it('treats decomposed and precomposed umlauts as equal (macOS NFD vs NFC)', () => {
    expect(nameKey('Jörg', 'Müller')).toBe(nameKey('Jörg', 'Müller'));
  });

  it('distinguishes first and last name', () => {
    expect(nameKey('Anna', 'Bob')).not.toBe(nameKey('Bob', 'Anna'));
  });
});
