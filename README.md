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
