# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- **Dev server:** `npm run dev` (Vite, hot-reloading)
- **Build:** `npm run build` (runs `tsc && vite build`, output in `dist/`)
- **Preview production build:** `npm run preview`
- **Type-check only:** `npx tsc --noEmit`

No test framework, linter, or formatter is configured. The tsconfig only covers `src/` — API files in `api/` are not type-checked.

## Architecture

Quilt Designer is a browser-based generative quilt pattern tool at `quiltdesign.app`. It renders procedural quilt patterns to a `<canvas>` using configurable shapes, symmetry modes, color palettes, and seeded randomness. Vanilla TypeScript with no UI framework — pure DOM manipulation.

### Frontend data flow

`main.ts` orchestrates a unidirectional loop: **Store → generateGrid → simplifyGrid → render → canvas**.

UI controls call `store.update()`, which notifies subscribers, triggering a full regenerate+redraw cycle. The `Store` class (`state.ts`) is a simple observable with `get()`, `update(partial)`, and `subscribe(listener)`.

### Frontend modules (`src/`)

- **`layout.ts`** — Core generation engine. Builds a weighted shape pool from ratios, generates a tile with symmetry applied, then tiles it across the full grid. Contains block transform functions (mirrorH, mirrorV, rotate180, etc.).
- **`renderer.ts`** — Canvas 2D rendering with HiDPI support + SVG generation. Delegates block drawing to `shapes.ts`.
- **`shapes.ts`** — Shape-specific Canvas2D drawing functions (Square, HST, QST, HSTSplit). Handles fabric pattern fills. Each block is drawn at origin after rotation transform.
- **`simplify.ts`** — Merges same-color adjacent triangles into simpler shapes (produces HSTSplit type).
- **`manual-editor.ts`** — Click-to-edit mode with 4-way symmetry auto-mirroring. Has its own copy of block transform functions (duplicated from `layout.ts`).
- **`fabric-editor.ts`** — Image crop/scale/rotate editor for fabric swatches.
- **`cartridge.ts`** — Embeds/extracts design data in PNG (tEXt chunk) and SVG (metadata element). Inspired by PICO-8 cartridge format.
- **`spritesheet.ts`** — Embeds fabric swatches as a sprite strip at the bottom of exported PNGs.
- **`community.ts`** — Community browse view: Pinterest-style grid for shared palettes and designs with cursor-based pagination and search.
- **`api-client.ts`** — Frontend HTTP client for all REST API endpoints.
- **`ui/share.ts`**, **`ui/share-design.ts`** — Share modal logic for palettes and designs.

### Backend API (`api/`)

Vercel Serverless Functions using `@vercel/node` with file-based routing. Each file exports a default handler.

- **`api/_lib/redis.ts`** — Upstash Redis client + key prefix definitions
- **`api/_lib/auth.ts`** — OAuth helpers (Google + Facebook), session management, user CRUD
- **`api/_lib/types.ts`** — Shared API types (SharedPalette, SharedDesign, request/response types)
- **`api/auth/`** — OAuth login/callback endpoints, session (me/logout), profile, account deletion
- **`api/palettes/`** — CRUD + like for shared palettes (with color-hash deduplication)
- **`api/designs/`** — CRUD + like for shared designs
- **`api/user/palettes.ts`** — Cloud sync of custom palettes (merges with localStorage on first login)

Auth uses cookie-based sessions (`qd_session`, HttpOnly, 30-day TTL in Redis).

### Database

Upstash Redis via `@upstash/redis` (serverless HTTP-based). Data stored as JSON values with key prefixes defined in `api/_lib/redis.ts` (e.g. `palette:{id}`, `palettes:list` sorted set, `session:{token}`, `user:{id}`).

### CSS

CSS is split into component files in `src/styles/` (base, sidebar, canvas, modals, share-modal, community, editor), imported via Vite in `main.ts`. Dark theme throughout. No CSS preprocessor or framework.

### Environment variables

See `.env.example` for Redis vars. OAuth vars (not in .env.example): `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`, `APP_URL` (optional, falls back to `VERCEL_URL`).

## Key design details

- All randomness flows through `SeededRandom` (Mulberry32 PRNG) — same seed + same parameters = same pattern. Keep new random behavior wired through the existing seed flow.
- Symmetry is probabilistic: fill tile randomly, then overwrite cells with transformed copies based on symmetry strength (0-100 slider).
- Shape types: Square, HST (2 colors: [bottom-left, top-right]), QST (4 colors: [top, right, bottom, left]), HSTSplit (3 colors, created by simplification only — not directly selectable).
- Swatches can be solid colors (strings) or fabric images (`FabricSwatch` objects). Check with `isColorSwatch()`/`isFabricSwatch()`.
- Two editor modes: Auto (procedural from seed) and Manual (click-to-edit with 4-way symmetry mirroring).
- Keep canvas rendering performant; avoid per-frame allocations.

## Code style

- 2-space indentation, semicolons
- `camelCase` for variables/functions, `PascalCase` for classes/types
- Commit messages: imperative mood, descriptive subject (e.g. "Add account deletion page and API endpoint", "Mobile: show palette actions on active instead of hover")
- Branches: `main` (production), `dev` (development)
