# Little Science Lab

Tap-and-explore science activities for a toddler, built as an offline-capable PWA (React + TypeScript + Vite).

## Activities

- **Bone marrow** (`src/apps/granulopoiesis`): a marrow full of blasts. Tap a cell to mature it one stage:
  Blast → Promyelocyte → Myelocyte → Metamyelocyte → Band → Neutrophil.
  Cell artwork is split from `art/granulopoiesis_v4.2_*.svg` by `tools/extract_cells.py`
  (original paths, grain and granules untouched; relative cell sizes preserved).

Parent controls: press and hold the faint gear in the bottom-right corner for about a second to
choose transformation speed (Instant / Quick 0.3 s / Slow 2 s), reset, or exit.

New activities: add a folder under `src/apps/` and register it in `src/apps/registry.ts`.

## Run it (Windows)

Needs Node.js LTS (`winget install OpenJS.NodeJS.LTS`).

**Keep `node_modules` out of Box.** Box Drive corrupts and locks it. Clone or copy this repo to a
normal local folder (for example `C:\Users\<you>\dev\little-science-lab`) before running:

```
npm install
npm run dev
```

Vite prints a `Network:` address such as `http://192.168.1.20:5173/`. On the iPad (same Wi-Fi) open that
address in Safari. Allow Node through Windows Firewall if prompted (private networks only).

## Install on the iPad

Safari → Share → Add to Home Screen. It then opens full screen with its own icon.
To make the child unable to leave it, start Guided Access (Settings → Accessibility → Guided Access,
then triple-click the top button inside the app).

Offline use needs the service worker, and Safari only runs one over HTTPS. The Wi-Fi dev address is plain
HTTP, so for offline play, build and host it over HTTPS (for example GitHub Pages):

```
npm run build      # outputs dist/
```

then test with Airplane Mode before relying on it.

## Cases (editable data)

Each biopsy starts with a one-line clinical history (tap the "Examine bone marrow" button to
continue), then shows the marrow with the diagnosis, cellularity and a morphology cue pinned at the top.
The cases come from two CSV files you can edit in Excel, in `src/apps/granulopoiesis/data/`:

- `marrow_scenarios.csv` — one row per diagnosis: draw weight, age and cellularity ranges, the relative
  weight of each of the six stages, a morphology note. Optional columns: `cellularity_from_age` (TRUE =
  cellularity follows age, for normal marrow) and `blast_pct_min/max/step` (draws the blast share
  separately from cellularity, as for AML).
- `marrow_vignettes.csv` — one row per clinical one-liner, tied to a `scenario_id`, with optional age
  limits. `{age}` in the text is replaced with the generated age.

Save as CSV from Excel (not .xlsx). The files are checked when the app loads: bad rows are skipped and
listed in the browser console as `[case library] ...`. The stage percentages are illustrative, not a full
marrow differential. A seed always reproduces the same case, vignette and layout.

## Copyright

© 2026 Gregory Chen. All rights reserved.

This repository is public so the app can be hosted on GitHub Pages. It is not open source: no license is
granted to copy, modify or redistribute the code, the original cell artwork (`src/apps/granulopoiesis/art/`
and `cells/`), or the case library (`src/apps/granulopoiesis/data/`). See `NOTICE`.
