# Wheel of Fortune — Specification

A small Electron desktop app: the student picker ("Schülerauswahl") extracted from Grader (`../grdr`) into its own
tool. It is loosely coupled to Grader through **files only** (CSV in, CSV out). All data lives in plain JSON files.

Status: draft for review. Nothing is implemented yet.

---

## 1. Goals / non-goals

**Goals**
- Import a roster CSV exported by Grader → create a course (or update an existing one).
- Pick a course from a dropdown (grouped by school year); the main and only real view is the wheel.
- Spin the wheel (click on it) → winner → dialog with tertiary grading (`+` / `~` / `−`).
- Fair mode (default) and free mode; per-student pick counter, color and weight.
- Special, untracked segments ("spin again", "written test for everyone", …) with a probability.
- Export graded picks as a CSV that Grader's assessment import accepts.
- No database. Hand-editable JSON, atomic writes, backups, configurable data folder.

**Non-goals (v1)**
- No live connection / shared storage with Grader. No grade calculation. No cloud/sync.
- No student editing beyond color, pick count, absent/active (names come from the CSV). Weights are not editable in the UI.
- Keyboard shortcuts for symbols, CLI, Linux packaging (macOS `.dmg` first; Linux AppImage later).

## 2. Stack

| Concern | Choice | Why |
|---|---|---|
| Shell | Electron (current stable at scaffold time — verify via docs), `contextIsolation`, no `nodeIntegration` | as in Grader |
| UI | Vue 3 + TypeScript + Vite | lets `StudentWheel.vue` / `wheelGeometry.ts` be reused from Grader nearly unchanged (check Grader's `LICENSE.md` — same author) |
| i18n | `vue-i18n`, German default, all UI strings keyed | translations later without refactoring |
| Validation | `zod` for IPC payloads and for every JSON file read from disk | hand-edited files must not crash the app |
| CSV | `papaparse` (RFC 4180, delimiter auto-detect) for reading; own tiny writer for the Grader format | Grader's own parser is naive, see §6 |
| Tests | `vitest` (unit/integration), Playwright (Electron smoke e2e) | |
| Packaging | `electron-builder`, macOS dmg | |

Architecture: deliberately light — no DDD layering. Pure functions in `src/core/` (draw, merge, CSV, naming),
a JSON store in the main process, thin IPC handlers, Vue renderer.

## 3. Data on disk

`<dataDir>` is configurable (§8). The chosen path is stored in `config.json` inside Electron's `userData`
(the only thing that cannot live in `<dataDir>`). Default: `<userData>/data`.

```
<dataDir>/
  2026-27/                      school year folder ("2026/27" → "2026-27")
    <courseId>.course.json
    <courseId>.assessments.json
  .trash/                       deleted courses are moved here, never unlinked
```

File identity is the generated `courseId`, never the course name.

### 3.1 `<courseId>.course.json`

```jsonc
{
  "schemaVersion": 1,
  "id": "c_8f2a…",
  "schoolYear": "2026/27",
  "className": "3EHIF",
  "subject": "DBIx - Modellierung",         // display name: "3EHIF · DBIx - Modellierung"
  "archived": false,
  "categories": ["Mitarbeit"],              // tertiary categories offered in the dialog (from CSV `Kategorien`)
  "defaultCategory": "Mitarbeit",           // fallback "Mitarbeit"; free text if `categories` is empty
  "students": [
    {
      "id": "s_41c…",                       // app-internal
      "graderId": "…" ,                     // value of CSV `Id`, null if the CSV had none
      "firstName": "Anna", "lastName": "Bob",
      "color": "#ffaabb",                   // #rrggbb or null (null → palette color on the wheel)
      "pickCount": 0,                       // integer ≥ 0
      "weight": 1,                          // only ever set by hand in this file (any number ≥ 0, 0 = never drawn); deliberately never shown or editable in the UI
      "active": true                        // false = no longer in the Grader export
    }
  ],
  "specials": [
    { "id": "sp_1", "label": "Nochmal drehen", "color": "#6d28d9",
      "kind": "spin-again", "probability": 5, "showIn": "always" },
    { "id": "sp_2", "label": "Schriftliche Überprüfung für alle", "color": "#ed1943",
      "kind": "message", "message": "Alle holen ein Blatt Papier heraus.", "probability": 2, "showIn": "free-only" }
  ]
}
```

Session-only (not persisted): fair-mode toggle (default on), "absent today" flags, presentation mode.

### 3.2 `<courseId>.assessments.json`

```jsonc
{
  "schemaVersion": 1,
  "courseId": "c_8f2a…",
  "days": [
    { "date": "2026-10-07",                  // one entry per day per course
      "entries": [
        { "id": "e_1", "studentId": "s_41c…", "category": "Mitarbeit",
          "symbol": "PLUS",                   // PLUS | WELLE | MINUS
          "gradedAt": "2026-10-07T09:14:03Z",
          "exportedAt": null }                // set after a successful export
      ] }
  ]
}
```

A pick that is **not graded creates no entry** (only `pickCount` changes). Un-grading in the dialog deletes the
entry; `pickCount` is not decremented.

### 3.3 Robustness rules
- **Atomic write**: write `<file>.tmp`, fsync, copy the previous file to `<file>.bak`, rename. Writes per file are serialized.
- **Load**: zod-validate. On failure show path + error and offer "restore from `.bak`" if that validates. Never overwrite an invalid file silently.
- Unknown (newer) `schemaVersion` → refuse to open with a clear message. Migrations are functions `vN → vN+1`.
- `app.requestSingleInstanceLock()` — one instance only.

## 4. Roster import (Grader → app)

Menu / button "CSV importieren…" → file dialog → preview/report dialog.

### 4.1 Format (header-based, order-independent)

Reference: `docs/Schueler.csv`. Delimiter `,` or `;` (auto-detect), BOM and CRLF tolerated, quoted fields supported.

| Column | Required | Notes |
|---|---|---|
| `Klasse` | yes | |
| `Fach` | yes | |
| `Vorname`, `Nachname` | yes | |
| `Schuljahr` | no* | e.g. `2026/27`. *If absent, the import dialog asks (default derived from today: Aug–Jul) |
| `Id` | no | stable Grader student id |
| `Color` | no | `#rgb` or `#rrggbb` → normalized to lowercase `#rrggbb`; invalid → warning, ignored |
| `Kategorien` | no | tertiary category titles, `\|`-separated, identical on every row |

A file describes **exactly one course**: all rows must share `Klasse`, `Fach`, `Schuljahr`, otherwise the import is rejected.

### 4.2 Merge rules

Course key = (`schoolYear`, `className`, `subject`). Not found → create the course. Found → update it.

Student matching, in order: (1) `graderId` equality, (2) normalized name (Unicode NFC, trimmed, whitespace collapsed,
case-folded). Two CSV rows with the same normalized name and no `Id` → both are added, warning "Doppelter Name",
and color updates for them are skipped on later imports (ambiguous).

| Case | Action |
|---|---|
| CSV student not in course | add: `pickCount 0`, `weight 1`, `active true` |
| matched student | update `color` **only if** the CSV color is non-empty and valid; set `active = true`; if matched by `Id` and the name differs, update the name |
| course student not in CSV | `active = false` (counts, weight, grades stay) |
| `Kategorien` present | replace `categories` |

Never touched by an import: `pickCount`, `weight`, `specials`, assessments. Importing the same file twice changes nothing.
The report shows created / updated / reactivated / deactivated / warnings.

## 5. The wheel

### 5.1 Eligibility
`eligible = active && !absentToday && weight > 0`.
Fair mode: `pool = eligible students with pickCount == min(pickCount over eligible)`. Free mode: `pool = eligible`.

### 5.2 Draw (pure function, `random: () => number` injected)

```
draw(course, mode, absent, random):
  if pool is empty → error "Keine Schüler zum Auswählen"
  repeat up to 10 times:
    r = random() * 100
    if r falls into a special's cumulative probability range → special
       - spin-again → continue loop (counts nothing)
       - message    → return {special}
    else → return weightedPick(pool, weights, random)
  last iteration ignores specials (guarantees termination)
```

Specials have `showIn`: `"always"` or `"free-only"`. A special with `free-only` takes part in the draw and appears on the
wheel only in free mode; in fair mode it is absent (neither drawn nor drawn on the wheel). In the draw above, "specials" means
the specials active for the current mode.

Validation: sum of **all** special probabilities must be `< 100` (UI blocks saving otherwise), regardless of mode.
Weights only influence the draw within the pool (so they matter mostly in free mode). A follow-up may switch fair
mode to `pickCount / weight`; not in v1.

### 5.3 Pick flow
1. User clicks the wheel (anywhere) or "Aufrufen" next to a student in the list (direct pick, no spin).
2. Draw runs; for a student, `pickCount += 1` is **persisted immediately** (also in free mode), then the wheel plays the spin (≈6 s, `prefers-reduced-motion` respected).
3. Result:
   - student → result dialog (§5.4), then the pool is recomputed;
   - `message` special → dialog with label + message, nothing persisted;
   - `spin-again` → short toast, spin again (≈3 s).

### 5.4 Result dialog
Name, "Aufruf Nr. n", category dropdown (`categories`, default `defaultCategory`; free text if the course has none),
`+` `~` `−` buttons. Clicking a symbol creates/updates the entry for today; clicking the active symbol again deletes
it; changing the category re-records it. Grading is optional.

### 5.5 Rendering
- Reuse Grader's `computeSegments` / `computeSpinRotation` geometry. **All segments are equal-sized** (weights and
  probabilities are not visible on the wheel).
- Students in last-name order; specials inserted at evenly spaced positions. Specials get a distinct look
  (hatch pattern + icon) so they are recognizable regardless of color.
- Student color: own color, otherwise Grader's palette.

## 6. Assessment export (app → Grader)

Target: Grader's `GradeImportService` (semicolon-separated, header skipped, no quote handling).

```
Nachname;Vorname;Kategorie;Name;Datum;Max;Note
Bob;Anna;Mitarbeit;Aufruf (Mitarbeit);07.10.2026;;+
```

- `Datum` = `dd.mm.yyyy`, `Max` always empty (tertiary), `Note` ∈ `+` `~` `-` (ASCII hyphen).
- `Name` = `Aufruf (<Kategorie>)`; for a student's n-th entry on the same day in the same category with n ≥ 2: `Aufruf (<Kategorie>) n`.
  Reason: Grader reuses an assessment by (date, title) and **ignores the category**; two categories sharing a title would merge.
- Only graded entries are exported (an empty `Note` would become `WELLE` in Grader).
- Fields containing `;` or line breaks are sanitized to a space (Grader cannot parse quotes) and reported as a warning.
- Export dialog: scope "Nur neue" (default: `exportedAt == null`) or "Alles"; shows the course name and a hint that the same
  course must be chosen in Grader's import. On successful write, `exportedAt` is set on the exported entries.
- UTF-8, `\n`, no BOM. Default file name `<Klasse>_<Fach>_Aufrufe.csv` (sanitized).

## 7. UI

Single window.
- **Header**: school-year select → course select (remembers last), buttons Import, Export, Settings; per course: archive, delete (→ `.trash`), "Spezialsegmente…".
- **Main**: wheel; controls "Fair-Modus" (default on, session-only), "Zähler zurücksetzen" (confirm), "Präsentationsmodus".
- **Side panel (teacher view)**, one row per student: color picker, name, pick count (editable integer),
  "abwesend" checkbox, "Aufrufen". Weights are intentionally not shown anywhere. Inactive students in a collapsed section (greyed, can be reactivated manually).
- **Presentation mode**: hides header and side panel (weights, counts, colors would otherwise be visible to the class);
  only the wheel and the dialogs remain. Toggle by button and `Esc`/`P`.
- **Special segments editor**: list of label, color, kind (`Nochmal drehen` / `Nachricht`), message, probability %, "Anzeigen in" (`Immer` / `Nur im freien Modus`); shows the
  remaining share for students; blocks sum ≥ 100.
- Empty states: no course yet → big "CSV importieren" call to action; no eligible students → hint instead of wheel.

## 8. Settings
- **Datenordner**: shows current path, "Ändern…" (folder dialog; does not move files — it points to another folder), "Im Finder zeigen".
- Language is wired through i18n but only `de` ships.

## 9. Grader-side changes (separate repo, separate commit)

1. `CourseRosterService.exportCsv`: add columns `Schuljahr`, `Id`, `Kategorien` (tertiary category titles, `|`-separated); normalize colors to `#rrggbb`; keep `Color`.
2. Tests + README note; fixture identical to this project's `tests/fixtures/grader-roster.csv`.
3. *Optional, later:* assessment import accepts an `Id` column and matches students within the course instead of by global name.

## 10. Testing strategy (TDD for everything in `src/core`)

- Unit: `fairPool`, `draw` (seeded random; specials, spin-again cap, weights, empty pool), color normalization, name normalization, roster merge (all rows of §4.2), export naming/numbering, probability validation.
- Integration: JSON store in a temp dir (atomic write, `.bak` restore, invalid file, newer schema), import twice = no-op.
- **Contract tests**: (a) fixture roster CSV from Grader parses; (b) exported assessment CSV satisfies Grader's parse rules (7 `;`-columns, no stray `;`, `dd.mm.yyyy`, symbol in `+~-`).
- Playwright smoke: import fixture → spin → grade → export → file content.

## 11. Project layout

```
src/main/        electron entry, window, menu, ipc handlers (zod), json store, config
src/preload/     contextBridge API
src/core/        pure logic: draw.ts, merge.ts, rosterCsv.ts, exportCsv.ts, color.ts, names.ts, schemas.ts
src/renderer/    Vue app, components (Wheel, ResultDialog, StudentTable, SpecialsEditor, ImportDialog…), i18n/de.json
tests/           unit, integration, e2e, fixtures
docs/            SPEC.md, formats.md (the CSV contracts), Schueler.csv (sample)
```

## 12. Task breakdown (vertical slices, each ends green: tests + `tsc` + lint)

1. **Scaffold** — Electron+Vite+Vue+TS, vitest, lint, security defaults, single-instance, i18n skeleton. *AC: window opens, one unit test and one Playwright smoke test pass.*
2. **Core logic** — color, names, fairPool, draw (weights/specials), probability validation. *AC: §10 unit tests green.*
3. **JSON store** — schemas, atomic write, `.bak`, restore, data-dir config. *AC: integration tests green.*
4. **Roster import** — parser, merge, report dialog, school-year prompt. *AC: fixture imports; second import is a no-op; color update only.*
5. **Wheel + pick flow** — course/year selection, wheel (ported geometry), spin, persisted count, fair/free. *AC: manual spin on fixture course; counts persist across restart.*
6. **Result dialog + assessments** — categories, symbols, undo, `assessments.json`. *AC: entry created/changed/deleted; persists.*
7. **Export** — CSV writer, numbering, scope, `exportedAt`. *AC: contract tests green; file imports into a real Grader course.*
8. **Student panel** — absent, inactive, editable count, reset. *AC: absent excluded. Weights are JSON-only (§3.1); a seeded simulation test shows they change the draw frequency.*
9. **Special segments** — editor, rendering, draw integration, message/spin-again. *AC: seeded tests + manual check.*
10. **Presentation mode + settings (data folder)**, archive/delete (`.trash`).
11. **Packaging** — macOS dmg, app icon. *AC: installed app opens and works with a custom data folder.*
12. **Grader-side export change** (§9) — separate repo.

## 13. Assumptions to confirm during review
- Names are updated from the CSV only when matched by `Id`; otherwise name = identity.
- "Absent today" is not persisted (resets on restart).
- Weight is a per-course attribute and part of the course JSON; presets only in the UI.
- Spin-again chains are capped at 10, after which specials are ignored.
- Vitest instead of Grader's Jest (fits Vite).
- Category default "Mitarbeit" when the CSV has no `Kategorien`.
