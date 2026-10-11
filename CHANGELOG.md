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

## [1.1.0-r9] — 2026-10-11

### Fixed

**User account management (critical)**
- **Duplicate entries when editing expired users** — editing an expired account
  left the old entry in place and appended a new one. Now `edit_user`,
  `delete_user`, and `add_user` purge all variants (`user` and `#user`).
- **Add User failed silently in browser** — the ucode file used
  `user.replace(/^#/,'')`, which is invalid ucode syntax. Replaced with
  `clean_user()` using `substr()` in a loop.
- **RPC callbacks returned `true` instead of the full response** — `expect: { result: true }`
  stripped everything except `result`. Changed to `expect: {}` so error codes
  and assigned IP are visible to the UI.

**Force Offline session termination**
- **Client could not reconnect immediately after Force Offline** — the previous
  implementation sent `SIGKILL`, which does not send a PPPoE PADT to the client.
  Now: `SIGTERM` first (graceful, sends PADT), brief grace period, `SIGKILL` fallback,
  then `conntrack -F`. Client sees the disconnect within 1–2 seconds and
  reconnects per its own holdoff timer (typically 5–10 seconds).

### Added
- `clean_user()` helper — robust username normalization
- `purge_user()` helper — removes all blocked and unblocked entries for a username
  in both `/lib/ppp/ppp-users` and `/etc/ppp/chap-secrets`
- `get_subnet_base()` helper — reads auto-IP pool base from config instead of
  hardcoding `192.168.11`
- Distinct error codes: `missing_user`, `missing_password`, `missing_expiry`,
  `username_exists` — surfaced as UI alerts
- Help tab: Online Users section expanded with PADT handshake, reconnect
  timing, and troubleshooting

### Changed
- `add_user` returns `{ result: true, ip, id }`
- `edit_user` strips `#` prefixes from both `olduser` and `user`
- All UI errors show specific backend error codes

### Technical
- Package size: ~16 KB
- `PKG_ARCH=all` — universal
- Tested on ImmortalWrt 24.10.6 / MediaTek Filogic (aarch64) / IMOU LC-HX3001

## [1.1.0-r5] — 2026-10-10

First stable release — five-tab interface, expanded Help, firewall setup,
Online Users with kernel-sourced peer IP, tab persistence, single universal CI.

---

[Unreleased]: https://github.com/arafatrahmanzami/luci-app-pppoe-manager/compare/v1.1.0-r9...HEAD
[1.1.0-r9]: https://github.com/arafatrahmanzami/luci-app-pppoe-manager/releases/tag/v1.1.0-r9
[1.1.0-r5]: https://github.com/arafatrahmanzami/luci-app-pppoe-manager/releases/tag/v1.1.0-r5
