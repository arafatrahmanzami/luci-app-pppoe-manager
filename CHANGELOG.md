# Changelog

All notable changes to **luci-app-pppoe-manager** are documented in this file.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned
- Multi-server support (MikroTik-style, one server per interface)
- Per-user rate limiting (upload/download kbit/s)
- CSV export/import of users
- RADIUS authentication backend
- accel-ppp engine integration


## [1.1.0-r18] — 2026-10-13

### Fixed
- **Light theme visibility** — summary bar in Users Manager used hardcoded dark green background (`#1a3a1a`) with lime/gold text, invisible in Bootstrap light theme. Removed background; swapped colors to `#f57c00` (amber for MRR) and `#0288d1` (teal for Collected) which read correctly in both light and dark themes.

## [1.1.0-r17] — 2026-10-13



## [1.1.0-r17] — 2026-10-13

### Added
- **Revenue tracking** — cumulative payment counter per user
  - `total_paid` field in `/lib/ppp/ppoemanager-meta`
  - `extend_user` adds `price × days/30` to `total_paid`
  - `set_user_meta` adds new price to `total_paid` when price changes
- **Collected** summary in Users Manager — cumulative revenue across all users
- Renamed `Monthly revenue` to `MRR` (Monthly Recurring Revenue)

### Fixed
- Restored missing `set_user_meta` RPC method that was dropped by an earlier attempt



## [1.1.0-r16] — 2026-10-13

### Added
- **User Extensions** — quick extend buttons (+3d, +7d, +1mo, +2mo) in Users Manager tab
- **Billing fields** — per-user Price and Notes
- **Billing summary bar** — Total / Active / Expired / Monthly revenue at top of Users tab
- **First added date** — captured on user creation, shown as "Added" column
- New RPC methods: `extend_user`, `set_user_meta`, `get_user_meta`
- Metadata file `/lib/ppp/ppoemanager-meta` — stores per-user price, notes, first_seen, last_seen

### Fixed
- `extend_user` RPC rejected when days argument passed as JS number — LuCI ubus bridge requires String type. Now converts via `String(days)` in `quickExtend()`.

### Changed
- Users Manager table adds columns: Price, Added
- Users Manager actions per row: +3d, +7d, +1mo, +2mo, Edit, Del



## [1.1.0-r14] — 2026-10-12

### Fixed
- Preferred Offload Mode not applying to firewall — replaced ListValue dropdown (failed on TypedSection anonymous=true) with three action buttons that call apply_offloading RPC directly.
- UI showed stale state — added get_offload_mode RPC reading UCI fresh from disk + in-place redraw.

### Added
- get_offload_mode RPC method
- apply_offloading now accepts optional mode argument



## [1.1.0-r11] — 2026-10-12

### Fixed
- **Online Users showed `?` for user, `-` for client IP/gateway** — the parser
  incorrectly derived the interface name from the PPPoE session ID in the
  process cmdline (`rp_pppoe_sess N:MAC`). N is the *session* ID (0-65535),
  not the interface unit. When N didn't match a live `pppX` interface, the
  kernel lookup failed and all fields came back empty.
  - **New mapping:** read `/run/pppd/pppX.pid` to map PID ↔ interface name
  - **Verified:** `rp_pppoe_sess 3:` with interface `ppp1` now correctly
    resolves to `ppp1` via the pid file, not the bogus `ppp3`

### Changed
- `read_online()` now cross-references three sources:
  1. `/run/pppd/*.pid` for PID → interface mapping
  2. `ip addr show pppX` for peer IP and gateway
  3. `ps w` for MAC address

### Technical
- Backwards compatible with r10 and earlier
- No config changes required


## [1.1.0-r10] — 2026-10-11

### Fixed
- `/lib/ppp` directory missing on OpenWrt 25.12 / apk installs — added
  `mkdir -p /lib/ppp` to `uci-defaults/99-ppoemanager`


## [1.1.0-r9] — 2026-10-11

### Fixed
- User duplication when editing expired accounts — added `purge_user()`
- Add User silent failure — replaced invalid `.replace()` ucode with `clean_user()`
- RPC callbacks returning `true` instead of full response — changed `expect: {}`
- Force Offline slow reconnect — SIGTERM → SIGKILL → conntrack flush
- Auto-IP base hardcoded to 192.168.11 — now reads from config

### Added
- Distinct error codes: `missing_user`, `missing_password`, `missing_expiry`, `username_exists`


## [1.1.0-r5] — 2026-10-10

First stable release — five-tab UI, expanded Help, firewall setup,
Online Users with kernel-sourced peer IP, tab persistence.

---

[Unreleased]: https://github.com/arafatrahmanzami/luci-app-pppoe-manager/compare/v1.1.0-r11...HEAD
[1.1.0-r11]: https://github.com/arafatrahmanzami/luci-app-pppoe-manager/releases/tag/v1.1.0-r11
[1.1.0-r10]: https://github.com/arafatrahmanzami/luci-app-pppoe-manager/releases/tag/v1.1.0-r10
[1.1.0-r9]: https://github.com/arafatrahmanzami/luci-app-pppoe-manager/releases/tag/v1.1.0-r9
[1.1.0-r5]: https://github.com/arafatrahmanzami/luci-app-pppoe-manager/releases/tag/v1.1.0-r5
