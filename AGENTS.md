# AGENTS.md — Rendu AI Coding Instructions

This file contains instructions for AI coding agents (OpenAI Codex, GitHub Copilot, Claude Code, etc.).
Human contributors should refer to CONTRIBUTING.md instead.

## Project Overview

Rendu is a Markdown reader desktop app built with Tauri 2 + React 19 + Vite + Tailwind CSS 4.
The frontend is TypeScript (strict mode), and the backend is Rust (src-tauri/).

## Architecture Rules

### Component Structure

- All components are **function components** with hooks. Never use class components.
- Props type is named `${ComponentName}Props` and defined as an `interface` above the component.
- One exported component per file. Internal sub-components (e.g. `TreeItem` in `FileTree.tsx`) stay in the same file.
- Components go in `src/components/`. Hooks go in `src/` as `use${Name}.ts`.

### State Management

- **No Redux, no Zustand, no external state library.** Use only `useState`, `useRef`, `useContext`.
- Global state uses React Context (`LocaleContext`). Do not add new Contexts without explicit approval.
- Settings persistence uses Tauri filesystem (`@tauri-apps/plugin-fs`), not localStorage or IndexedDB.

### Tauri Integration

- All Tauri API imports must come from `@tauri-apps/api/*` or `@tauri-apps/plugin-*`.
- Tauri `invoke` calls must be typed: `invoke<ReturnType>("command_name", { args })`.
- Event listeners must be cleaned up in `useEffect` return. Pattern:

```typescript
useEffect(() => {
  const unlisteners = [
    listen("event-name", handler),
  ];
  return () => { unlisteners.forEach((p) => p.then((fn) => fn()).catch(() => {})); };
}, [deps]);
```

- Never call Tauri APIs at module top level. Always inside hooks or event handlers.

## Coding Conventions

### TypeScript

- `strict: true` is enforced. No `any` unless absolutely unavoidable (and add a comment explaining why).
- Use `interface` for object shapes, `type` for unions/intersections.
- Prefer `unknown` over `any` for untyped external data. Narrow with type guards.
- No unused variables or parameters (`noUnusedLocals`, `noUnusedParameters` are enabled).

### Styling

- Use **Tailwind CSS utility classes** for layout and spacing.
- Use **CSS custom properties** (`var(--app-bg)`, `var(--text-color)`, etc.) for theme-dependent colors.
- Never hardcode color values in components. Always reference CSS custom properties or Tailwind classes.
- New CSS goes in `src/index.css` with a section comment: `/* ========= Section Name ========= */`.
- Conditional class names use array `.join(" ")` pattern, not template literals or classnames library.

```typescript
// CORRECT
const className = [
  "flex items-center gap-1.5",
  isActive ? "text-blue-400" : "text-gray-400",
].join(" ");

// WRONG
const className = `flex items-center ${isActive ? "text-blue-400" : "text-gray-400"}`;
```

### i18n — CRITICAL: Every user-visible string must be translated

When adding any UI text:

1. Add the key to the `Translations` interface in `src/i18n.ts`
2. Add English value to `en` dictionary
3. Add Japanese value to `ja` dictionary
4. Use `t("key.name")` in components via `useTranslation()` hook
5. Key naming: dot-separated hierarchy matching the feature area (e.g. `"sidebar.folder"`, `"viewer.error.path"`)
6. Variables use `{name}` syntax: `t("viewer.matchCount", { count: 5 })`

**The i18n test will fail if en and ja have different keys.** Always add both.

## Testing — MANDATORY for all changes

### Test File Placement

- Component: `src/components/Foo.tsx` → `src/components/Foo.test.tsx`
- Hook: `src/useFoo.ts` → `src/useFoo.test.ts`
- Utility: `src/utils/foo.ts` → `src/utils/foo.test.ts`

### Test Structure

```typescript
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

describe("ComponentName", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("describes the expected behavior", () => {
    // Arrange → Act → Assert
  });
});
```

### Tauri API Mocking

Tauri APIs are mocked in `src/test/mocks/`. When your code uses a new Tauri API:

1. Check if a mock already exists in `src/test/mocks/`
2. If not, create one following the existing pattern (vi.fn with default resolved values)
3. Register it in the test file: `vi.mock('@tauri-apps/plugin-xxx', () => import('../test/mocks/tauri-xxx'));`

Existing mocks:
- `tauri-fs.ts` — readDir, readTextFile, writeTextFile, writeFile, mkdir, exists
- `tauri-dialog.ts` — open
- `tauri-window.ts` — getCurrentWindow (setTheme)
- `tauri-event.ts` — listen
- `tauri-path.ts` — appConfigDir

### Mock Usage in Tests

```typescript
import { readTextFile } from "@tauri-apps/plugin-fs";

// Set return value
(readTextFile as Mock).mockResolvedValue("# Hello");

// Simulate error
(readTextFile as Mock).mockRejectedValue(new Error("Not found"));

// Verify call
expect(readTextFile).toHaveBeenCalledWith("/path/to/file");
```

### React Component Testing

- Use `renderWithLocale()` from `src/test/helpers.tsx` instead of bare `render()`.
- Query elements with `@testing-library/react` queries (getByText, getByRole, etc.).
- Async state updates: use `waitFor` or `findBy*` queries.

```typescript
import { renderWithLocale } from "../test/helpers";

it("renders the component", () => {
  renderWithLocale(<MyComponent prop="value" />);
  expect(screen.getByText("Expected text")).toBeInTheDocument();
});
```

### What to Test

- **New component**: render, user interactions, error states, loading states
- **New hook**: state changes, side effects, cleanup
- **New i18n key**: automatically covered by existing i18n.test.ts (key parity check)
- **Bug fix**: add a regression test that fails without the fix

## Pre-Submit Checklist

Before creating a commit, verify ALL of the following pass:

```bash
npx tsc --noEmit       # Type check
npm run test:run       # All tests pass
npm run lint           # ESLint
```

If any check fails, fix the issue before committing. Do not skip or disable checks.

## Commit Messages

Use Conventional Commits format:

```
feat: add drag-and-drop file loading
fix: sidebar scroll position reset on navigation
docs: update CONTRIBUTING.md
refactor: extract file utilities from App.tsx
chore: update dependencies
```

## File Creation Policy

- Do not create new files unless necessary. Prefer editing existing files.
- Do not create wrapper/utility files for one-time operations.
- Do not add new dependencies without explicit approval.

## What NOT to Do

- Do not add comments to code you didn't change.
- Do not refactor surrounding code when fixing a bug.
- Do not add error handling for scenarios that cannot occur.
- Do not use `localStorage` or `sessionStorage` (use Tauri filesystem instead).
- Do not introduce new CSS-in-JS libraries or styling approaches.
- Do not add new React Context without approval.
- Do not modify `src-tauri/` (Rust code) without explicit instructions.
