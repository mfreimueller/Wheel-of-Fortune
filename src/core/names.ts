const clean = (part: string): string => part.normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('de');

/** Identity key for matching students without a stable id; independent of case, spacing and Unicode form. */
export function nameKey(firstName: string, lastName: string): string {
  return `${clean(lastName)}\u0000${clean(firstName)}`;
}
