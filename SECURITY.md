# Security Policy

## Supported Versions

Only the latest stable release of Rendu receives security updates.

| Version | Supported |
| ------- | --------- |
| Latest stable (currently 0.8.x) | ✅ |
| Older versions | ❌ |

## Reporting a Vulnerability

**Please do NOT open a public issue for security vulnerabilities.**

Instead, use GitHub's private vulnerability reporting:

1. Go to the [Security tab](https://github.com/kashioka/Rendu/security) of this repository
2. Click **"Report a vulnerability"**
3. Fill in the details (affected version, reproduction steps, impact)

You can expect an initial response within **7 days**. Once the issue is
confirmed, we will work on a fix and credit you in the release notes
(unless you prefer to remain anonymous).

## Scope

Rendu is a local-first Markdown viewer with no telemetry. Reports we are
particularly interested in:

- Path traversal / sandbox escape via the Tauri IPC commands
  (e.g. `read_safe_image`, `atomic_write`, file watching)
- XSS through Markdown / HTML / Mermaid rendering that survives
  sanitization (rehype-sanitize, Mermaid `securityLevel: strict`)
- Arbitrary file read/write beyond the documented filesystem scope
- Code execution via crafted Markdown files

Out of scope:

- Attacks requiring the same local user's privileges (the local user can
  already do anything Rendu can)
- Vulnerabilities in upstream dependencies without a demonstrated impact
  on Rendu (please report those upstream; we track them via Dependabot,
  `npm audit`, and `cargo audit`)
- Issues in development-only tooling (dev server, test harness)

## Security Measures

- Dependabot monitors npm / cargo / GitHub Actions dependencies (weekly)
- CI runs `npm audit` and `cargo audit` on every PR and push to main
- A weekly scheduled scan opens an issue if new advisories appear
- Release builds are gated on a passing security audit
