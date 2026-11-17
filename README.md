# DevPath

DevPath is a browser-local dashboard for the supplied 90-day MLOps workbook. The original `.xlsm` file remains unchanged. The app bundle contains its 90 roadmap days, 24 resource links, 24 interview topics, weekly review windows, and portfolio-project ranges.

## Run locally

From this folder, serve `dist` with any static server. For example, if Python is installed:

```powershell
python -m http.server 4173 --directory .\dist
```

Then visit `http://127.0.0.1:4173`.

## What works

- Dashboard, 90-day roadmap, daily workspace, calendar, resources, interview tracker, analytics, and settings.
- Four workbook-derived checkboxes per learning day, plus custom tasks, notes, day statuses, and individual rescheduling.
- Study timer, portfolio progress based on roadmap completion, source resource links, interview revision states, keyboard shortcuts, light/dark themes, and CSV/JSON exports.
- Progress persists in the browser’s local storage. Use **Export progress JSON** before changing browsers or clearing browser data.

## Deliberate scope

This first release is a private, client-side tracker, so it has no login, shared database, or server API. Those require a separate FastAPI/PostgreSQL implementation and a persistent host; the workbook-derived curriculum and client data model are ready to support that next phase.
