# AtlasImporter (Google Apps Script)

Imports the JSON files in `Agentic Development/inbox` into Google Sheets, then moves each file to `Agentic Development/data/<subsystem>/`. It runs with the Google permissions of whoever installs it, so Claude doesn't need edit rights on the sheets.

**Each subsystem writes to its own spreadsheet** (`SPREADSHEETS` at the top of the script):

| Subsystem | Spreadsheet |
|---|---|
| Spymaster | Farmeos |
| Future exporters (military history, transports, …) | one each, created automatically in `IKARIAM [ATLAS]/` the first time a file of that kind arrives |

Install the script **once**, in any one spreadsheet. Farmeos is the natural choice.

## Install (about 3 minutes)

1. Open **Farmeos** in the browser.
2. Menu **Extensions → Apps Script**. A new tab opens with a project containing `Code.gs`.
3. Select all the text in `Code.gs`, delete it, and paste the full contents of `sheets/AtlasImporter.gs` (on GitHub: open the file → "Raw" → select all → copy).
4. Click the disk icon (**Save**). Optionally rename the project "ATLAS importer" (top left).
5. Go back to the Farmeos tab and **reload** it. After a few seconds an **ATLAS** menu appears next to "Help".
6. Click **ATLAS → Import now**. Google asks for authorisation the first time:
   1. **Continue**, then choose your account.
   2. "Google hasn't verified this app": click **Advanced → Go to ATLAS importer (unsafe)**. The warning appears because the script is your own and hasn't been published, not because anything is wrong.
   3. **Allow**. It asks for Drive (to read the inbox and move files) and Sheets (to write rows).
7. Run **ATLAS → Import now** again. You see "Inbox is empty", or a summary of what was imported.
8. Optional: **ATLAS → Import automatically every 15 min**. It keeps running when the sheet is closed. Turn it off with **ATLAS → Stop automatic import**.

If several folders are called `Agentic Development`: in the Apps Script tab go to **Project Settings (gear) → Script properties** and add `ROOT_FOLDER_ID` with the folder's id (the last part of its Drive URL). The same place holds `SHEET_<SUBSYSTEM>` ids if you want a subsystem to write to a different spreadsheet.

**Updating:** paste the new version over `Code.gs` and save. No new authorisation is needed unless Google asks.

## What it writes

**`spymaster.reports.v1` → Farmeos:**
- **First sheet ("Hoja 1"):** one row per target town. Columns are matched by header name, so the layout can change.
  - A target already listed (same Ubicación + Ciudad) is updated in place. Resources, FECHA INTEL and Espiado por change only if the report is newer than the row's FECHA INTEL.
  - New targets are appended.
  - FECHA DE SAQUEO, Observaciones and unknown columns are never touched.
- **"Historial"** (created if missing): one row per report, de-duplicated by report id. Each row includes the lootable amount above the safe and the cargo ships needed.

## Adding an exporter

1. Add the subsystem's spreadsheet to `SPREADSHEETS`, e.g. `military: 'Historial militar'`.
2. Write `importMilitary_(env, fileName)`. It gets its spreadsheet with `spreadsheetFor_('military')`. Keep the row building in pure functions.
3. Register it: `'military.reports.v1': importMilitary_` in `HANDLERS`.
4. Test the pure functions in `tests/importer.test.mjs` (the file is loaded in a Node VM).
