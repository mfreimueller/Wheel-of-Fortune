# File formats (the contract with Grader)

The two apps share no code and no storage. These formats are the whole interface. Each has a fixture or contract
test in this repository (`tests/fixtures/`, `tests/unit/graderContract.test.ts`); change both sides together.

## Roster: Grader → Wheel (import)

Written by Grader (Kurs → Teilnehmer → *CSV exportieren*), read by `src/core/rosterCsv.ts`.

```
Klasse,Fach,Schuljahr,Id,Vorname,Nachname,Color,Kategorien
3EHIF,"DBIx - Modellierung",2026/27,g1,Anna,Bob,#ffaabb,Mitarbeit|Wiederholung
```

- Header-based, any column order, `,` or `;`, quoted fields, UTF-8 (BOM tolerated).
- Required: `Klasse`, `Fach`, `Vorname`, `Nachname`. Optional: `Schuljahr`, `Id`, `Color`, `Kategorien`.
- One course per file. Without `Schuljahr` the import asks for it.
- `Color`: `#rgb` or `#rrggbb`. `Kategorien`: tertiary category titles, `|`-separated, identical on every row.
- Course key = (school year, class, subject). Students match by `Id`, otherwise by normalized name.
- Re-importing never changes pick counts, weights, specials or grades; known students only get a new color.

## Assessments: Wheel → Grader (export)

Written by `src/core/exportCsv.ts`, read by Grader's grade import (`GradeImportService`), where the user selects the course.

```
Nachname;Vorname;Kategorie;Name;Datum;Max;Note
Bob;Anna;Mitarbeit;Aufruf (Mitarbeit);07.10.2026;;+
```

- `;`-separated, no quoting (Grader does not parse it), UTF-8, `\n`.
- `Kategorie` must equal a category title of the target course in Grader.
- `Name` is `Aufruf (<Kategorie>)`, with ` 2`, ` 3`, … for a student's repeated picks on the same day and category.
  Grader reuses an assessment by (date, title) and ignores the category, so this keeps categories apart and picks distinct.
- `Datum` `dd.mm.yyyy`, `Max` empty (tertiary), `Note` `+` / `~` / `-`.
- Only graded picks are exported: an empty `Note` would be imported as `~`.
- Importing the same rows again updates the existing performances instead of duplicating them.

## Data files

See `docs/SPEC.md` §3. Both files carry `schemaVersion`; files from a newer version are refused, never overwritten.
