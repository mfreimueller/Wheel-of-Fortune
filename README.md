# Wheel of Fortune

A small desktop app for teachers: a student picker wheel, extracted from [Grader](../grdr) so the tools stay
loosely coupled. The only connection between the two apps is two CSV files; all data lives in plain JSON files.

- **Import** a roster CSV exported by Grader → creates the course (or updates it: new students are added, known
  students only get a new color, students that left the export become inactive).
- **Spin** the wheel (click it). *Fair mode* only draws students with the fewest picks; *free mode* draws everybody.
  Per-student weights (set by hand in the course JSON, never shown in the UI) make some students more likely; special segments ("nochmal drehen", a message) add fun and are never tracked.
- **Grade** the picked student with `+` `~` `−` in the result dialog.
- **Export** the graded picks as CSV for Grader's assessment import.

Design: the UI follows the [Figma file](https://www.figma.com/design/EFNvJC53TQSNlIXsCpvkdD) (Foundations, Components, Screens).
Its variables are mirrored in `src/renderer/styles/tokens.css`; the base components (button, select, checkbox, radio,
dialog) live in `src/renderer/style.css`. The design uses Inter as a stand-in for the macOS system font the app renders with.

Formats: [docs/formats.md](docs/formats.md). Full specification: [docs/SPEC.md](docs/SPEC.md).

## Data

One folder per school year, `<course>.course.json` and `<course>.assessments.json` inside. The folder is configurable
in the settings dialog (or with the `WHEEL_DATA_DIR` environment variable). Files are written atomically with a `.bak`
of the last valid version; deleted courses move to `.trash`.

## Development

```
npm install
npm run dev          # run the app
npm test             # unit + integration tests (vitest)
npm run test:e2e     # build + Playwright against Electron
npm run typecheck && npm run lint
npm run package      # macOS dmg (unsigned) into release/
```

To run the e2e flow against the packaged app: `WHEEL_APP="release/mac-arm64/Wheel of Fortune.app/Contents/MacOS/Wheel of Fortune" npx playwright test tests/e2e/packaged.test.ts`.
`npm run icon` regenerates `assets/icon.png`.
