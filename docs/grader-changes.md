# Grader-side changes (separate repo, `../grdr`)

Wheel of Fortune already reads the extended roster CSV (see `docs/formats.md`) and still accepts today's
export, so these changes can land whenever convenient. They are small, and independent of this repository.

## 1. Extend the roster export

`CourseRosterService.exportCsv(courseId)` (`src/application/CourseRosterService.ts`).

Target header and row, in this order:

```
Klasse,Fach,Schuljahr,Id,Vorname,Nachname,Color,Kategorien
3EHIF,"DBIx - Modellierung",2026/27,<student id>,Anna,Bob,#ffaabb,Mitarbeit|Wiederholung
```

| Column | Source |
|---|---|
| `Schuljahr` | the class's school year, written as `2026/27` (`2026/2027` and `2026-27` are accepted too) |
| `Id` | the student's stable id (`student.id.value`) |
| `Color` | `student.color?.value` (always `#rrggbb`, empty when unset) |
| `Kategorien` | titles of the course's **tertiary** assessment categories (`gradingType === 'TERTIARY'`), joined with `\|`; the same value on every row |

Keep the existing quoting (`toCsvLine`) and CRLF line endings. Note that `docs/Schueler.csv` in this repository has a
`Color` column with 3-digit values (`#fab`): Grader's `Color` value object only allows `#rrggbb`, so whatever produced
that sample was edited by hand. Wheel of Fortune expands the shorthand anyway.

### Tests to add or update (`tests/integration/application/CourseRosterService.test.ts`)
- header and one row per taught student contain the new columns in the order above;
- a student without a color has an empty `Color` cell;
- `Kategorien` lists only tertiary categories and is identical on every row;
- excluded students are still left out (existing behavior).

Use `tests/fixtures/grader-roster.csv` from this repository as the reference for the expected shape.

## 2. Optional, later: match students by Id in the grade import

`GradeImportService.importCsv` finds students by first and last name across **all** students and skips duplicates.
Wheel of Fortune cannot send an `Id` column today (the import reads exactly seven columns), so this only pays off once
both sides agree on an eighth, optional `Id` column. Until then, duplicate names within a course are skipped with a
warning on Grader's side.
