# Wheel of Fortune

A static web app for teachers: a student picker wheel that runs entirely in the browser and is hosted on GitHub Pages.
There is no server and no account; everything is stored in the browser's `localStorage`.

- **Import** a roster CSV → creates the course (or updates it: new students are added, known
  students only get a new color, students that left the list become inactive).
- **Spin** the wheel (click it). *Fair mode* only draws students with the fewest picks; *free mode* draws everybody.
  Per-student weights (set in the stored data, never shown in the UI) make some students more likely; special segments ("nochmal drehen", a message) add fun and are never tracked.
- **Count** picks per student; there is no grading.
- **Back up** all data as a JSON file and restore it in the settings dialog.

Design: the UI follows the [Figma file](https://www.figma.com/design/EFNvJC53TQSNlIXsCpvkdD) (Foundations, Components, Screens).
Its variables are mirrored in `src/renderer/styles/tokens.css`; the base components (button, select, checkbox, radio,
dialog) live in `src/renderer/style.css`. The design uses Inter as a stand-in for the macOS system font the app renders with.

Formats: [docs/formats.md](docs/formats.md). Full specification: [docs/SPEC.md](docs/SPEC.md).

## Data

All data lives in one `localStorage` key, `wof:db` (`{ schemaVersion, courses[] }`), validated on every read. The
date of the last backup is kept in `wof:lastBackupAt`. Clearing site data deletes everything, so export a backup
regularly (settings dialog). Several tabs are kept in sync: a change in one tab reloads the others. Unreadable data
is never overwritten; the app offers to download the raw text and to reset instead.

Note: GitHub Pages serves all projects of a user from the same origin (`<user>.github.io`), so they share `localStorage`.
The keys are prefixed with `wof:` to avoid clashes.

## Development

```
npm install
npm run dev          # Vite dev server
npm test             # unit + integration tests (vitest)
npm run test:e2e     # builds, serves the build and runs Playwright (npx playwright install chromium once)
npm run typecheck && npm run lint
npm run build        # static site into dist/
npm run preview      # serve dist/ locally
```

## Deployment

Pushing to `main` runs `.github/workflows/pages.yml` (tests, build, deploy). Enable it once under
Settings → Pages → Source: "GitHub Actions". The build uses a relative base (`./`), so it works under any repository path.
