---
name: rendu-release
description: Walk through cutting a new stable release of Rendu (kashioka/Rendu). Use when the user asks to release, cut, publish, or bump a new version. Covers preflight audits, version sync across all manifests, release.yml dispatch, publishing, the post-publish download-link update, Homebrew Cask, and verification. Encodes the lessons from the v0.7.0 audit (24-day Linux lag, 25-day package.json drift, stale README links) and from v0.11.1 (release blocked 17 days by audit advisories + an expired Apple agreement while pre-updated links 404'd).
---

# Rendu Release Skill

This skill exists because two release audits revealed recurring misses:

- **v0.7.0 (2026-05-13)**: Linux assets sat in beta-only for 24 days, `package.json` drifted for 25 days, landing pages and READMEs kept pointing at the previous version.
- **v0.11.1 (2026-10-31)**: the prep PR updated README / landing links to the new version *before* the release existed. `release.yml`'s Security gate then failed three times on advisories published after the prep PR's CI went green (quinn-proto → rustls → dompurify), and the macOS build failed on an expired Apple Developer agreement. The new links were 404 for 17 days.

The checklist below is the single source of truth. The two structural fixes from v0.11.1 are baked in:

1. **Download links are pinned** to `releases/download/v<version>/<file>` and are updated **after** publishing with `scripts/update-download-links.sh`. Pinned links never break, so there is no window in which README / landing 404.
2. **`scripts/release-preflight.sh`** runs the same `cargo audit` / `npm audit` as the Security gate, plus version alignment and a link check. Run it before merging the prep PR and again right before dispatching.

## Environmental facts (stable, no need to verify)

- Main repo: `kashioka/Rendu` on GitHub
- Homebrew tap: `kashioka/homebrew-tap` (separate repo, local clone at `~/alleyoop/homebrew-tap`)
- Landing pages: `https://kashioka.github.io/Rendu/` (EN) and `/ja/` (JA), built from `docs/index.html` and `docs/ja/index.html`
- Code signing: macOS signed + notarized (Developer ID `UHADYAK5ZH`), Windows unsigned (SmartScreen note in docs)
- Workflow files: `.github/workflows/release.yml` (stable), `.github/workflows/release-beta.yml` (beta)
- `release.yml` = Security gate (`npm audit --audit-level=high` + plain `cargo audit`) → 3 platform builds → checksums. tauri-action creates a **Draft** release named `v<version>`.

## Where the version lives

**5 manifests, kept in sync by `scripts/bump-version.sh` — never edit by hand:**
- `package.json`, `package-lock.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock`

**4 user-facing files, rewritten by `scripts/update-download-links.sh <version>` — only after the release is published:**
- `README.md`, `README.ja.md` — pinned download URLs + `apt install` / `dnf install` / `chmod +x` examples + the manual-install `curl -LO … app.tar.gz` block
- `docs/index.html`, `docs/ja/index.html` — pinned download URLs

**1 file in another repo, by hand after publishing:**
- `kashioka/homebrew-tap` `Casks/rendu.rb` — `version` + `sha256` of the new DMG (from `checksums.txt`)

## Phase 1 — Prep PR (manifests only)

1. **Tests and types**
   ```bash
   npm run test:run
   (cd src-tauri && cargo test --lib)
   npx tsc --noEmit
   ```
2. **Pick the version per semver** — patch: fixes / deps only; minor: features, platforms, behavior; major: breaking.
3. **Bump the manifests**
   ```bash
   bash scripts/bump-version.sh <new-version>
   ```
   The script verifies alignment at the end. Check the `package-lock.json` diff: local npm 10.9.3 sometimes strips the `libc` field from `@tailwindcss/oxide-linux-*`; restore it by hand if so.
4. **Do NOT touch README / docs links in this PR.** They keep pointing at the previous (published) release until Phase 4.
5. **Codex review** (mandatory, see below), commit as `chore(release): v<version> 準備`, push, open the PR.
6. **Preflight before asking for the merge**
   ```bash
   bash scripts/release-preflight.sh
   ```
   It must pass. If `cargo audit` / `npm audit` report new advisories, fix them in a separate lockfile PR first (merge that, then re-run preflight). The user merges the prep PR with `gh pr merge --squash --admin` (REVIEW_REQUIRED ruleset; Claude cannot bypass).

## Phase 2 — Dispatch

1. **Preflight again, right before dispatching** (advisories can land between the merge and now):
   ```bash
   git checkout main && git pull --ff-only
   bash scripts/release-preflight.sh
   ```
   Also act on the script's reminder: if there is an agreement banner on https://developer.apple.com/account, have the user accept it first. An expired agreement fails notarization with `HTTP status code: 403. A required agreement is missing or has expired.` *after* a 5-minute macOS build.
2. **Trigger**
   ```bash
   gh workflow run release.yml --ref main
   gh run list --workflow=release.yml --limit 1
   ```
3. **Wait** (~10 min; builds run in parallel). Use `gh run watch <run-id> --exit-status` in the background.
4. **If only macOS failed** (agreement 403, notarization hiccup): fix the cause, then `gh run rerun <run-id> --failed`. Windows / Linux assets already uploaded to the Draft are kept; the rerun adds the macOS assets and `checksums.txt`.
5. **If the Security gate failed**: fix the advisory in a lockfile PR, merge, run preflight, dispatch again. (Do not merge Dependabot's PR for it if its own Security audit is red — a consolidated `cargo update -p …` / `npm` overrides PR from main is faster; see memory `audit-storm-consolidated-pr`.)

## Phase 3 — Verify the Draft, write notes, publish

1. **Assets** — expect 7 binaries + `checksums.txt` (8 entries):
   ```bash
   gh release view v<version> --json assets --jq '.assets[].name'
   ```
   `Rendu_<v>_aarch64.dmg`, `Rendu_<v>_aarch64.app.tar.gz`, `Rendu_<v>_x64-setup.exe`, `Rendu_<v>_x64_en-US.msi`, `Rendu_<v>_amd64.deb`, `Rendu-<v>-1.x86_64.rpm`, `Rendu_<v>_amd64.AppImage`, `checksums.txt`
2. **Notarization + checksum spot check** (download the DMG into the scratchpad):
   ```bash
   gh release download v<version> --dir "$D" --pattern checksums.txt --pattern '*.dmg'
   shasum -a 256 "$D"/Rendu_<v>_aarch64.dmg        # must match checksums.txt
   hdiutil attach -nobrowse -quiet "$D"/Rendu_<v>_aarch64.dmg -mountpoint "$D/mnt"
   spctl -a -t exec -vv "$D/mnt/Rendu.app"          # expect: accepted, source=Notarized Developer ID
   hdiutil detach -quiet "$D/mnt"
   ```
3. **Release notes** — skeleton:
   ```markdown
   ## Highlights
   - [user-visible changes, one bullet each, with #PR]

   ## Fixes
   - [bug fixes; reference #issue]

   ## Known issues (carried over)
   - [#57 PDF export truncates very long documents (CoreAnimation 16384px cap)]

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
   ```bash
   gh release edit v<version> --draft --title "Rendu v<version>" --notes-file <notes.md>
   ```
4. **Publish — ask the user first** (outward-facing, not reversible in practice). On yes:
   ```bash
   gh release edit v<version> --draft=false --latest
   ```

## Phase 4 — Post-publish (links, Cask, record)

1. **Rewrite the download links to the new release and verify them**:
   ```bash
   bash scripts/update-download-links.sh <version>   # rewrites 4 files, then curls every link
   grep -rn "<previous-version>" README.md README.ja.md docs/   # expect: empty
   ```
   Codex review, commit as `docs(release): v<version> のダウンロードリンク更新`, push, PR, user merges. GitHub Pages redeploys from `docs/` within a minute of the merge.
2. **Homebrew Cask** in `~/alleyoop/homebrew-tap`. Take the DMG sha256 from the release's `checksums.txt` (the same value you verified in Phase 3):
   ```bash
   curl -sL https://github.com/kashioka/Rendu/releases/download/v<version>/checksums.txt | grep aarch64.dmg
   ```
   Edit `Casks/rendu.rb` (`version`, `sha256`), Codex review, commit `rendu <version>`, push to `main`. Confirm via `curl -s https://raw.githubusercontent.com/kashioka/homebrew-tap/main/Casks/rendu.rb`.
3. **Record** the release in `~/.claude/projects/-Users-hideokashioka-alleyoop-md-viewer/memory/MEMORY.md` (date, highlights, PR numbers, Cask sha prefix) and close the task in `.tracker/status.md`.

## Codex review — mandatory, no skip

Per project rule: **every push needs Codex review**, including docs-only and link-only changes.

```bash
git diff > <scratchpad>/review.diff
/opt/homebrew/bin/codex exec -m gpt-5.1 --skip-git-repo-check "<prompt + diff>"
```

`-m gpt-5.1` is required: the default `gpt-5-codex` model 404s with the current API-key auth. If Codex flags issues, fix them and **run Codex again** before pushing. Repeat until it returns LGTM.

## Critical anti-patterns

- ❌ **Updating README / landing links in the prep PR.** The release does not exist yet; if anything blocks it (audit advisory, Apple agreement, runner hang) the links 404 for the whole delay. v0.11.1: 17 days. Links are rewritten in Phase 4 only.
- ❌ **Writing `releases/latest/download/<versioned-file>` links.** The filename already embeds the version, so `latest` buys nothing and breaks on every version change. Always pin: `releases/download/v<version>/<file>`. `update-download-links.sh` rewrites any `latest/download` residue it finds.
- ❌ **Dispatching `release.yml` without running `scripts/release-preflight.sh` first.** CI being green on the prep PR says nothing about advisories published since; the gate runs at dispatch time.
- ❌ **`git reset --hard origin/main` while local has unpushed work** — silently destroys commits (happened 2026-05-02, lost 4 commits). `git status` first; stash if uncertain.
- ❌ **Skipping Codex review** — non-negotiable, even for one-line changes.
- ❌ **Editing version strings manually in the 5 manifests** — use `bump-version.sh` only. Manual edits caused the 25-day `package.json` drift.
- ❌ **Updating only `docs/` and skipping `README.md` / `README.ja.md`** (or vice versa) — the script covers all four; do not hand-edit a subset.

## When the bump-version.sh fails

If `bash scripts/bump-version.sh <ver>` exits with `macOS only`: you are on Linux/WSL. Either run on macOS, or temporarily rewrite the `sed -i ''` calls to portable form (`perl -pi -e`). Do not bypass — running it half-way leaves the repo in a half-bumped state.

If `npm install --package-lock-only` fails: usually a network issue. Re-run with the network available; do not commit a stale `package-lock.json`.

## Trigger phrases

- "新しいバージョン (v0.X.Y) を出したい"
- "stable リリース cut して"
- "v0.X.Y を切ろう"
- "リリースする"
- "release.yml 走らせる前のチェックリスト"

Always start at Phase 1 even for a quick patch release; the whole checklist takes minutes and catches everything.
