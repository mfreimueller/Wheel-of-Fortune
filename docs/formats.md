# Data formats

Everything the app reads or writes. Each format has a fixture or test in this repository (`tests/fixtures/`, `tests/unit/`, `tests/integration/`).

## Roster CSV (import)

Read by `src/core/rosterCsv.ts`.

```
Klasse,Fach,Schuljahr,Id,Vorname,Nachname,Color,Kategorien
3EHIF,"DBIx - Modellierung",2026/27,g1,Anna,Bob,#ffaabb,Mitarbeit|Wiederholung
```

- Header-based, any column order, `,` or `;` as separator, quoted fields, UTF-8 (BOM tolerated). Maximum 5 MB.
- Required: `Klasse`, `Fach`, `Vorname`, `Nachname`. Optional: `Schuljahr`, `Id`, `Color`, `Kategorien`.
- One course per file. Without `Schuljahr` the import dialog asks for it.
- `Color`: `#rgb` or `#rrggbb` (invalid values are ignored with a warning). `Kategorien` is read but no longer used.
- Course key = (school year, class, subject). Students match by `Id` (stored as `graderId`), otherwise by normalized name.
- Re-importing never changes pick counts, weights or specials; known students only get a new color. Students missing from the file become inactive.

## Browser storage

| Key | Content |
| --- | --- |
| `wof:db` | The whole database (JSON, below). |
| `wof:lastBackupAt` | ISO timestamp of the last exported backup. |
| `wheel.selection` | `{ "year": "2026/27", "courseId": "..." }`, the remembered selection (convenience only). |

### `wof:db` and backup files

A backup file is exactly the content of `wof:db`, pretty-printed (`wheel-backup-YYYY-MM-DD.json`).

```json
{
  "schemaVersion": 1,
  "courses": [
    {
      "schemaVersion": 1,
      "id": "c_<uuid>",
      "schoolYear": "2026/27",
      "className": "3EHIF",
      "subject": "DBIx - Modellierung",
      "archived": false,
      "categories": [],
      "defaultCategory": "Mitarbeit",
      "students": [
        { "id": "s_<uuid>", "graderId": null, "firstName": "Anna", "lastName": "Bob",
          "color": "#ffaabb", "pickCount": 0, "weight": 1, "active": true }
      ],
      "specials": [
        { "id": "...", "label": "Nochmal drehen", "color": "#6d28d9", "kind": "spin-again",
          "probability": 10, "showIn": "always" }
      ]
    }
  ]
}
```

- `kind` is `spin-again` or `message` (with optional `message`); `showIn` is `always` or `free-only`. `probability` is in percent.
- Schemas: `src/core/schemas.ts`. Missing optional fields get defaults on read.
- Data with a newer `schemaVersion` is refused (restore) or reported as unreadable (stored data), never overwritten.
- Restoring a backup replaces the whole database after a confirmation.
