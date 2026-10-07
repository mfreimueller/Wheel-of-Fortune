import { describe, expect, it } from 'vitest';
import de from '../../src/renderer/i18n/de';

describe('i18n', () => {
  it('ships German as the default locale with an app title', () => {
    expect(de.app.title).toBe('Glücksrad');
  });
});
