# Repository Guidelines

## Project Structure & Module Organization
- `src/` holds the TypeScript source for the quilt generator, UI wiring, and rendering.
- `index.html` contains the app shell and all styles (no separate CSS files).
- `dist/` is the production build output created by Vite.
- `node_modules/` is managed by npm and should not be edited manually.

Key modules live in `src/`:
- `main.ts` boots the app and wires rendering.
- `layout.ts` generates the quilt grid.
- `renderer.ts` draws to the canvas.
- `ui.ts` connects UI controls to state.

## Build, Test, and Development Commands
- `npm run dev` starts the Vite dev server with hot reload.
- `npm run build` runs `tsc && vite build` and writes output to `dist/`.
- `npm run preview` serves the production build locally.
- `npx tsc --noEmit` type-checks only.

## Coding Style & Naming Conventions
- TypeScript with strict compiler options (see `tsconfig.json`).
- Use 2-space indentation and semicolons (match existing `src/*.ts`).
- Prefer `camelCase` for variables/functions and `PascalCase` for classes/types.
- Keep modules small; add brief comments only for non-obvious logic.

## Testing Guidelines
- No test framework is configured.
- If you add tests, document the runner and add a `npm run test` script.

## Commit & Pull Request Guidelines
- Git history is not available in this workspace, so no commit convention can be inferred.
- Suggested: use Conventional Commits (e.g., `feat: add new symmetry mode`).
- PRs should include a short description, screenshots for UI changes, and any new
  commands or configuration updates.

## Configuration Notes
- All randomness uses a seeded PRNG; keep new random behavior wired through the
  existing seed flow for reproducibility.
- Keep canvas rendering performant; avoid per-frame allocations where possible.
