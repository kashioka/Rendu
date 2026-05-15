---
name: rendu-release
description: Walk through cutting a new stable release of Rendu (kashioka/Rendu). Use when the user asks to release, cut, publish, or bump a new version. Covers version sync across all manifests, README/landing updates, Homebrew Cask, release.yml dispatch, and post-release verification. Encodes the lessons learned from the v0.6.1→v0.7.0 audit (24-day Linux distribution lag, 25-day package.json drift, README v0.6.1 link residue).
---

# Rendu Release Skill

This skill exists because the v0.7.0 audit (2026-05-13) revealed multiple recurring release misses: Linux assets sat in beta-only for 24 days, package.json drifted for 25 days, landing pages and READMEs kept pointing at v0.6.1 after the new release. The checklist below is the single source of truth — follow it end-to-end and the gotchas can't bite.

## Environmental facts (stable, no need to verify)

- Main repo: `kashioka/Rendu` on GitHub
- Homebrew tap: `kashioka/homebrew-tap` (separate repo)
- Landing pages: `https://kashioka.github.io/Rendu/` (EN) and `/ja/` (JA), built from `docs/index.html` and `docs/ja/index.html`
- Code signing: macOS signed (Developer ID `UHADYAK5ZH`), Windows unsigned (SmartScreen note in docs)
- Workflow files: `.github/workflows/release.yml` (stable), `.github/workflows/release-beta.yml` (beta)

## Version is tracked in 4 manifests + 4 user-facing references

The manifests are kept in sync by `scripts/bump-version.sh` — never edit them by hand.

**Automated by `scripts/bump-version.sh`:**
- `package.json`
- `package-lock.json` (via `npm install --package-lock-only`)
- `src-tauri/tauri.conf.json`
- `src-tauri/Cargo.toml`
- `src-tauri/Cargo.lock` (via `cargo generate-lockfile`)

**Manual update required (these are the gotchas):**
- `docs/index.html` — DMG / EXE / MSI / .deb / .rpm / AppImage URLs (filename embeds the version)
- `docs/ja/index.html` — same URLs in Japanese landing
- `README.md` — same URL set **plus** `apt install ./Rendu_<ver>_amd64.deb`, `dnf install ./Rendu-<ver>-1.x86_64.rpm`, `chmod +x Rendu_<ver>_amd64.AppImage` examples
- `README.ja.md` — same as README.md
- `kashioka/homebrew-tap` `Casks/rendu.rb` — version + sha256 (sha256 comes from new release's `checksums.txt`, only available **after** `release.yml` succeeds)

**Verification command** (no version should appear except the new one):
```bash
grep -rn "<previous-version>" docs/ README.md README.ja.md
# Expected: empty output
```

## Pre-release checklist

Run in this order; fix the first failing step before moving on:

1. **Version sync currently aligned**
   ```bash
   bash scripts/check-versions.sh
   ```
2. **Tests pass**
   ```bash
   npm run test:run                          # TypeScript (15 files / 143 tests baseline)
   (cd src-tauri && cargo test --lib)        # Rust (19 tests baseline)
   npx tsc --noEmit                          # Type check
   ```
3. **Dependencies clean**
   ```bash
   npm audit                                 # Expect: 0 vulnerabilities
   ```
4. **Pick version per semver**
   - patch (`0.7.0 → 0.7.1`): bug fixes only
   - minor (`0.7.0 → 0.8.0`): new features, new platforms, behavior changes
   - major (`0.7.0 → 1.0.0`): breaking changes
5. **Bump all manifests**
   ```bash
   bash scripts/bump-version.sh <new-version>
   ```
   Script auto-verifies alignment at the end. If it fails, do not proceed.
6. **Update the manual files** (the items in §"Manual update required" above except the homebrew Cask)
   - Easiest: global find/replace of the old version string, then `grep -rn "<old>"` to confirm no residue
   - Don't forget the `apt install` / `dnf install` / `chmod` command examples in READMEs
7. **Audit residue**
   ```bash
   grep -rn "<previous-version>" docs/ README.md README.ja.md
   ```
   Must be empty.

## Codex review — mandatory, no skip

Per project rule: **every push needs Codex review**. No exceptions.

```bash
git diff > /tmp/release-prep.diff
# Pass the diff + context to:
/opt/homebrew/bin/codex exec --skip-git-repo-check < <prompt-with-diff>
```

If Codex flags issues, fix them, then **run Codex again** before pushing. Repeat until Codex returns ✅.

## Release execution

1. Commit (Japanese OK, follow `chore(release): ...` style; do not amend, create new commits)
2. Push to `origin/main`
3. Trigger workflow:
   ```bash
   gh workflow run release.yml --ref main
   ```
4. Wait for completion (macOS + Windows + Linux builds run in parallel, ~20-30 min):
   ```bash
   until [ "$(gh run view <run-id> --json status -q .status)" = "completed" ]; do sleep 30; done
   ```
5. Verify Draft has all 7 assets + checksums.txt:
   ```bash
   gh release view v<version> --json assets --jq '.assets[].name'
   ```
   Expected: `Rendu_<v>_aarch64.dmg`, `Rendu_<v>_x64-setup.exe`, `Rendu_<v>_x64_en-US.msi`, `Rendu_<v>_amd64.deb`, `Rendu-<v>-1.x86_64.rpm`, `Rendu_<v>_amd64.AppImage`, `Rendu_aarch64.app.tar.gz`, `checksums.txt`

## Release notes

Skeleton (refine for actual content):

```markdown
## Highlights
- [Major user-visible changes, one bullet each]

## Fixes
- [Bug fixes; reference #issue if relevant]

## Known issues (carried over)
- [Issue links with brief description]

## Downloads
| Platform | File |
|---|---|
| macOS (Apple Silicon) | `Rendu_<version>_aarch64.dmg` |
| Windows 10/11 (x64)   | `Rendu_<version>_x64-setup.exe` |
| Debian / Ubuntu / Mint | `Rendu_<version>_amd64.deb` |
| Fedora / RHEL          | `Rendu-<version>-1.x86_64.rpm` |
| Other Linux            | `Rendu_<version>_amd64.AppImage` (requires `libfuse2`) |

Or via Homebrew: `brew install --cask kashioka/tap/rendu`
```

Apply notes + publish:

```bash
gh release edit v<version> --notes-file /tmp/notes.md
gh release edit v<version> --draft=false --latest
```

## Post-release verification

1. **Confirm all 5 download URLs return 200**:
   ```bash
   BASE="https://github.com/kashioka/Rendu/releases/latest/download"
   V="<new-version>"
   for f in "Rendu_${V}_aarch64.dmg" "Rendu_${V}_x64-setup.exe" \
            "Rendu_${V}_amd64.deb" "Rendu-${V}-1.x86_64.rpm" \
            "Rendu_${V}_amd64.AppImage"; do
     code=$(curl -sIL -o /dev/null -w "%{http_code}" "$BASE/$f")
     printf "%s  %s\n" "$code" "$f"
   done
   # Expected: all 200
   ```

2. **Update Homebrew Cask** (separate `kashioka/homebrew-tap` repo):
   ```bash
   # Get new DMG sha256 from release checksums
   gh release view v<version> --json assets --jq '.assets[] | select(.name | endswith(".dmg")) | .digest'
   # Or: curl -sL https://github.com/kashioka/Rendu/releases/download/v<version>/checksums.txt
   ```
   - Clone the tap, edit `Casks/rendu.rb`: bump `version` and `sha256`
   - Commit + push

3. **(Optional) File known-issue Issues** if release notes reference any new ones

4. **Update `~/.claude/projects/-Users-hideokashioka-alleyoop-md-viewer/memory/MEMORY.md`** release record (add commit SHAs, highlights, date)

## Critical anti-patterns

- ❌ **`git reset --hard origin/main` while local has unpushed work** — silently destroys commits. Happened 2026-05-02, lost 4 commits (strictPort fix + PDF Paged.js attempt) that had to be re-created 11 days later. If sync is needed, `git status` first; stash if uncertain.
- ❌ **Skipping Codex review** — non-negotiable. Even tiny docs-only changes go through Codex. The cost of running Codex is minutes; the cost of missing a bug post-publish is hours plus a follow-up patch release.
- ❌ **Editing version strings manually in any of the 5 automated files** — use `bump-version.sh` only. Manual edits caused the 25-day `package.json` drift.
- ❌ **Publishing the release before READMEs are updated** — GitHub's repo page shows the README. Stale download links there = 404s for users who reach the project via GitHub directly (not via landing). The v0.6.1 release had this hidden bug for ~24 days.
- ❌ **Updating only `docs/` and skipping `README.md` / `README.ja.md`** — they share the same hardcoded URL pattern. Always check both.

## When the bump-version.sh fails

If `bash scripts/bump-version.sh <ver>` exits with `macOS only` error: you are on Linux/WSL. Either run on macOS, or temporarily rewrite the `sed -i ''` calls to portable form (`perl -pi -e`). Do not bypass — running it half-way leaves the repo in a half-bumped state.

If `npm install --package-lock-only` fails: usually a network issue. Re-run with the network available; do not commit a stale `package-lock.json`.

## Trigger phrases

The user is likely invoking this skill when they say things like:

- "新しいバージョン (v0.X.Y) を出したい"
- "stable リリース cut して"
- "v0.X.Y を切ろう"
- "リリースする"
- "release.yml 走らせる前のチェックリスト"

Always start with the §"Pre-release checklist" section. Even if the user asks for a quick patch release, run all 7 pre-release steps — they take 2-3 minutes and catch everything.
