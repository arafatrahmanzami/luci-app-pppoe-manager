# Changelog

All notable changes to **luci-app-pppoe-manager** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned
- Multi-server support (MikroTik-style, one server per interface)
- Per-user rate limiting (upload/download kbit/s)
- CSV export/import of users
- RADIUS authentication backend
- accel-ppp engine integration

## [1.1.0-r10] — 2026-10-11

### Fixed
- **`/lib/ppp` directory missing on OpenWrt 25.12 / apk installs** — the
  `rp-pppoe-server` package does not create `/lib/ppp/` on newer systems.
  `uci-defaults/99-ppoemanager` now runs `mkdir -p /lib/ppp` before touching
  the user database, so the warning `touch: /lib/ppp/ppp-users: No such file
  or directory` no longer appears on first install. Affected apk-based
  installs only (OpenWrt 25.12+).

### Verified
- OpenWrt 25.12.5 (apk) — install, backend load, and UI render working
- ImmortalWrt 24.10.6 (opkg) — behavior unchanged

## [1.1.0-r9] — 2026-10-11

### Fixed

**User account management (critical)**
- Duplicate entries when editing expired users — `edit_user`, `delete_user`,
  and `add_user` now purge all variants (`user` and `#user`) before writing
- Add User failed silently in browser — replaced invalid `user.replace()`
  ucode syntax with `clean_user()` using `substr()` in a loop
- RPC callbacks returned `true` instead of the full response — changed
  `expect: { result: true }` to `expect: {}`

**Force Offline session termination**
- Client could not reconnect immediately — now sends `SIGTERM` first
  (graceful, sends PPPoE PADT), brief grace period, `SIGKILL` fallback,
  then `conntrack -F`. Client reconnects in 5–10 seconds.

### Added
- `clean_user()`, `purge_user()`, `get_subnet_base()` helpers
- Distinct error codes surfaced as UI alerts
- Help tab: Online Users section expanded

## [1.1.0-r5] — 2026-10-10

First stable release — five-tab interface, expanded Help, firewall setup,
Online Users with kernel-sourced peer IP, tab persistence, single universal CI.

---

[Unreleased]: https://github.com/arafatrahmanzami/luci-app-pppoe-manager/compare/v1.1.0-r10...HEAD
[1.1.0-r10]: https://github.com/arafatrahmanzami/luci-app-pppoe-manager/releases/tag/v1.1.0-r10
[1.1.0-r9]: https://github.com/arafatrahmanzami/luci-app-pppoe-manager/releases/tag/v1.1.0-r9
[1.1.0-r5]: https://github.com/arafatrahmanzami/luci-app-pppoe-manager/releases/tag/v1.1.0-r5
