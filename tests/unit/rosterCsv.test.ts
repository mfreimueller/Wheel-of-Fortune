import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseRosterCsv } from '../../src/core/rosterCsv';

const fixture = (name: string) => readFileSync(new URL(`../fixtures/${name}`, import.meta.url), 'utf-8');

function parsed(text: string) {
  const result = parseRosterCsv(text);
  if (!result.ok) throw new Error(`expected success, got ${JSON.stringify(result.error)}`);
  return result.value;
}

describe('parseRosterCsv', () => {
  it('reads the current Grader export with all optional columns', () => {
    const roster = parsed(fixture('grader-roster.csv'));
    expect(roster).toMatchObject({ className: '3EHIF', subject: 'DBIx - Modellierung', schoolYear: '2026/27', categories: ['Mitarbeit', 'Wiederholung'] });
    expect(roster.students).toEqual([
      { graderId: 'g1', firstName: 'Anna', lastName: 'Bob', color: '#ffaabb' },
      { graderId: 'g2', firstName: 'Maxi', lastName: 'Muster', color: '#f1b2c3' },
      { graderId: 'g3', firstName: 'Rubi', lastName: 'Dubi, Jr.', color: null },
    ]);
    expect(roster.warnings).toEqual([]);
  });

  it('reads the legacy export without Id, Schuljahr and Kategorien', () => {
    const roster = parsed(fixture('grader-roster-legacy.csv'));
    expect(roster).toMatchObject({ className: '3EHIF', subject: 'DBIx - Modellierung', schoolYear: null, categories: null });
    expect(roster.students).toHaveLength(5);
    expect(roster.students[0]).toEqual({ graderId: null, firstName: 'Anna', lastName: 'Bob', color: '#ffaabb' });
  });

  it('accepts semicolons, a BOM and columns in any order', () => {
    const roster = parsed('﻿Nachname;Vorname;Fach;Klasse\nBob;Anna;Info;3A\n');
    expect(roster).toMatchObject({ className: '3A', subject: 'Info' });
    expect(roster.students).toEqual([{ graderId: null, firstName: 'Anna', lastName: 'Bob', color: null }]);
  });

  it('reports a missing required column', () => {
    expect(parseRosterCsv('Klasse,Fach,Vorname\n3A,Info,Anna\n')).toEqual({ ok: false, error: { code: 'missing-column', detail: 'Nachname' } });
  });

  it('rejects a file that describes more than one course', () => {
    const csv = 'Klasse,Fach,Vorname,Nachname\n3A,Info,Anna,Bob\n3B,Info,Max,Muster\n';
    expect(parseRosterCsv(csv)).toMatchObject({ ok: false, error: { code: 'mixed-course' } });
  });

  it('rejects an invalid school year', () => {
    const csv = 'Klasse,Fach,Schuljahr,Vorname,Nachname\n3A,Info,2026/30,Anna,Bob\n';
    expect(parseRosterCsv(csv)).toMatchObject({ ok: false, error: { code: 'invalid-school-year', detail: '2026/30' } });
  });

  it('rejects a file without students', () => {
    expect(parseRosterCsv('Klasse,Fach,Vorname,Nachname\n')).toMatchObject({ ok: false, error: { code: 'no-students' } });
  });

  it('skips rows without a name and an invalid color, with warnings that name the row', () => {
    const csv = 'Klasse,Fach,Vorname,Nachname,Color\n3A,Info,Anna,Bob,red\n3A,Info,,,\n3A,Info,Max,,#123\n';
    const roster = parsed(csv);
    expect(roster.students).toEqual([{ graderId: null, firstName: 'Anna', lastName: 'Bob', color: null }]);
    expect(roster.warnings).toEqual([
      { code: 'invalid-color', row: 2, detail: 'red' },
      { code: 'missing-name', row: 4 },
    ]);
  });
});
