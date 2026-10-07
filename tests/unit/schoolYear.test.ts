import { describe, expect, it } from 'vitest';
import { currentSchoolYear, normalizeSchoolYear } from '../../src/core/schoolYear';

describe('normalizeSchoolYear', () => {
  it.each(['2026/27', '2026/2027', '2026-27', '2026-2027', ' 2026/27 '])('normalizes %j to 2026/27', (raw) => {
    expect(normalizeSchoolYear(raw)).toBe('2026/27');
  });

  it('handles the turn of the century', () => {
    expect(normalizeSchoolYear('2099/2100')).toBe('2099/00');
  });

  it.each(['', '2026', '2026/28', '26/27', 'abc', '2026/2'])('rejects %j', (raw) => {
    expect(normalizeSchoolYear(raw)).toBeNull();
  });
});

describe('currentSchoolYear', () => {
  it('starts a new school year in August', () => {
    expect(currentSchoolYear(new Date(2026, 7, 1))).toBe('2026/27');
    expect(currentSchoolYear(new Date(2026, 9, 7))).toBe('2026/27');
  });

  it('still belongs to the previous year until July', () => {
    expect(currentSchoolYear(new Date(2027, 0, 15))).toBe('2026/27');
    expect(currentSchoolYear(new Date(2027, 6, 31))).toBe('2026/27');
  });
});
