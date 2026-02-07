# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- **Dev server:** `npm run dev` (Vite, hot-reloading)
- **Build:** `npm run build` (runs `tsc && vite build`, output in `dist/`)
- **Preview production build:** `npm run preview`
- **Type-check only:** `npx tsc --noEmit`

No test framework is configured.

## Architecture

Quilt Designer is a browser-based generative quilt pattern tool. It renders procedural quilt patterns to a `<canvas>` using configurable shapes, symmetry modes, color palettes, and seeded randomness.

### Data flow

`main.ts` orchestrates a unidirectional loop: **Store → generateGrid → render → canvas**. UI controls call `store.update()`, which notifies subscribers, triggering a full regenerate+redraw cycle.

### Module responsibilities

- **`state.ts`** — `Store` class: simple observable state container with `get()`, `update(partial)`, and `subscribe(listener)`. Tracks seed history (last 20). `defaultState()` provides initial `AppState`.
- **`layout.ts`** — `generateGrid(state)`: the core generation engine. Builds a weighted shape pool from ratios, generates a tile (repeat block) with symmetry applied, then tiles it across the full grid. Symmetry is probabilistic (controlled by 0-100 strength slider). Contains all block transform functions (mirrorH, mirrorV, rotate180, mirrorDiagTLBR, mirrorDiagTRBL).
- **`renderer.ts`** — `render(canvas, grid, state)`: handles HiDPI scaling, cell sizing/centering, delegates block drawing to `shapes.ts`, and draws grid lines and repeat-block boundaries.
- **`shapes.ts`** — `drawBlock()`: dispatches to shape-specific Canvas2D drawing functions (Square, HST, QST). Each block is drawn at origin after rotation transform.
- **`ui.ts`** — `bindUI(store)`: wires all sidebar controls (sliders, buttons, checkboxes) to the store. Subscribes to store for two-way sync.
- **`palette.ts`** — `PALETTES` array of named color sets (6 colors each).
- **`random.ts`** — `SeededRandom` class using Mulberry32 PRNG. Provides `next()`, `int(min, max)`, `pick(arr)`.
- **`types.ts`** — Shared types: `AppState`, `QuiltBlock`, `ShapeType` (square/hst/qst), `SymmetryMode` (7 modes), `Palette`.

### Key design details

- All randomness flows through `SeededRandom` so patterns are reproducible for a given seed.
- Symmetry works in two passes: fill tile randomly, then overwrite non-canonical cells with transformed copies of canonical cells (probabilistically based on symmetry strength).
- The "repeat block" system generates one tile of size `repeatWidth × repeatHeight` and tiles it with modulo indexing to fill the full grid.
- QST colors are ordered as [top, right, bottom, left] triangles. HST colors are [bottom-left, top-right].
- All styles live in `index.html` `<style>` tag (no CSS files).

### TypeScript config

Strict mode enabled with `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly`, and `verbatimModuleSyntax`. Target ES2022, bundler module resolution.
