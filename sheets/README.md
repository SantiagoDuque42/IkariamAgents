# AtlasImporter (Google Apps Script)

This script imports the JSON files from `Agentic Development/inbox` into the spreadsheet it is attached to. Each processed file is moved to `Agentic Development/data/<subsystem>/`. The script runs with the Drive permissions of whoever installs it, so it doesn't depend on Claude having edit rights.

## Install (once, in "Farmeos")

1. Open the sheet, then **Extensions → Apps Script**.
2. Replace the contents of `Code.gs` with `AtlasImporter.gs` and save.
3. Reload the sheet. An **ATLAS** menu appears.
4. Run **ATLAS → Import now** and accept the permission prompt. It asks for Drive and this spreadsheet.
5. Optional: **ATLAS → Import automatically every 15 min**.

If more than one folder is named `Agentic Development`, go to **Project Settings → Script properties** and set `ROOT_FOLDER_ID` to the folder's id.

## What it writes

**`spymaster.reports.v1`:**
- **First sheet ("Hoja 1"):** one row per target town. Columns are matched by header name, so the layout can change.
  - A target already listed (same Ubicación + Ciudad) is updated in place. Resources, FECHA INTEL and Espiado por change only when the report is newer than the row's FECHA INTEL.
  - New targets are appended.
  - FECHA DE SAQUEO, Observaciones and any column the script doesn't know are never touched.
- **"Historial"** (created if missing): one row per report. Duplicates are skipped by report id. Each row includes the lootable amount above the safe and the cargo ships needed.

## Adding an exporter

Add `'<schema>': importX_` to `HANDLERS`. Keep the row building in pure functions; `tests/importer.test.mjs` loads this file in a Node VM and tests them.
