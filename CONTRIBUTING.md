# Contributing to Rendu

We welcome contributions! Please read this guide before submitting a PR or Issue.

**[日本語版はこちら](./CONTRIBUTING.ja.md)**

## Prerequisites

- Node.js 20+
- Rust (latest stable) — required for Tauri: https://www.rust-lang.org/tools/install

## Development Setup

```bash
npm ci
npm run dev          # Vite dev server (frontend only)
npm run tauri dev    # Full app with native features
npm run test:run     # Vitest
npx tsc --noEmit     # Type checking
```

## Branch Naming

Do not push directly to `main`. Create a branch with one of these prefixes:

| Type | Prefix | Example |
|------|--------|---------|
| Feature | `feat/xxx` | `feat/drag-and-drop` |
| Bug fix | `fix/xxx` | `fix/sidebar-scroll` |
| Refactor | `refactor/xxx` | `refactor/split-app` |
| Docs | `docs/xxx` | `docs/contributing` |
| CI/Build | `chore/xxx` | `chore/update-deps` |

If you are contributing from a fork, please use the same branch naming convention.

## Commit Messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add new feature
fix: fix a bug
docs: documentation only
refactor: code refactoring
chore: build/dependency changes
```

## Pull Requests

1. Describe **what** you changed and **how to verify** it
2. Add **tests** for new features or bug fixes
3. Make sure CI passes (type check + tests) before requesting review
4. Run locally before submitting:

```bash
npm run test:run   # Vitest
npx tsc --noEmit   # Type checking
```

## Merge Policy

- **Squash merge** is used
- **1+ approval** required
- Delete the branch after merge

## AI-Generated Code

If your PR includes AI-generated code, please make sure you understand the code and that all tests pass before submitting.
