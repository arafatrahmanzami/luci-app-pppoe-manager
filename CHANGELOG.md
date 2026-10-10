# Changelog

All notable changes to this project are documented here.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned
- Multi-server support (MikroTik-style, one server per interface)
- Per-user rate limiting (upload/download kbit/s)
- CSV export/import of users
- RADIUS authentication backend
- accel-ppp engine integration

## [1.1.0-r1] — 2026-10-10

Consolidated release covering the r3–r7 development iterations.

### Added
- **Firewall Setup section** in General Settings tab
  - "Show Preview" button displays exact `uci` commands before applying
  - "Apply Firewall Setup" creates zone `pppoe`, enables masquerade, adds forwarding
  - "Restore from Backup" lists all backups and restores any one
  - Automatic backup of `/etc/config/firewall` to `/etc/config/firewall.bak-ppoemanager-<timestamp>` before every change
- **Advanced tab** — separated risky coordination and low-level flags
  - Multi-WAN & Offload Coordination (mwan3, offload mode, conntrack fix)
  - Low-Level Server Flags (randomsession, optionsfile, offset, unit, sync)
- **Help tab** — full documentation
  - Quick Start guide
  - Firewall Setup explanation
  - Files & Locations table
  - Troubleshooting section
- **Tab persistence** via `localStorage` — reload keeps the active tab
- **Refresh button** on Online Users tab
- **DNS1 / DNS2 / MTU / MRU / MSS** fields in General Settings
- **Config validation** — warns if Server IP conflicts with LAN subnet, or if pool is on a different subnet
- **Firewall backup list & restore** RPC methods

### Fixed
- **Online Users parser completely rewritten** — was matching WAN pppd and reading peer IP from stale cmdline
  - Now excludes processes containing `ipparam` (WAN uplink)
  - Reads actual peer IP from `ip addr show pppX` (kernel state, not cmdline)
  - Correct duration math using `/proc/<pid>/stat` field 22 (USER_HZ = 100)
  - Correct username lookup by matching the actual assigned IP
- **Online Users performance** — 2–20 second response reduced to ~25 ms
  - Replaced per-PID `/proc` iteration (200+ file opens) with single `ps w | grep` pass
- **Syntax error in main.js** during r5 → r6 — full file rewrite with `node --check` validation
- **Tab persistence** was using URL hash which LuCI strips — now uses localStorage
- **Duplicate username/IP** protection in `add_user` (rejects if username exists)

### Changed
- `uci-defaults` no longer auto-starts the service — user must enable manually
- Version bump: `1.0.0-r2` → `1.1.0-r1`
- Menu structure: 5 tabs (General Settings / Users Manager / Online Users / Advanced / Help)

### Technical
- Package size: ~12 KB, `PKG_ARCH=all`
- Tested on ImmortalWrt 24.10.6 / MediaTek Filogic (aarch64) / IMOU HX21
- CI builds for aarch64_cortex-a53, x86_64, mipsel_24kc via ImmortalWrt SDK
- Dependencies: `luci-base`, `rp-pppoe-server`, `conntrack`

## [1.0.0-r2] — 2026-10-08

Initial public release.

### Added
- Users Manager tab (add/edit/delete PPPoE accounts)
- Per-user expiration dates
- Automatic blocking of expired accounts via `ppoemanager-checker`
- Online Users tab with live session list
- Force Offline button
- General Settings tab
- Advanced Coordination section (mwan3, flow offloading)
- procd init script, ucode RPC backend, ACL permissions
- UCI config shipped in package
- GitHub Actions multi-arch CI
- Comprehensive README

---

[Unreleased]: https://github.com/arafatrahmanzami/luci-app-pppoe-manager/compare/v1.1.0...HEAD
[1.1.0-r1]: https://github.com/arafatrahmanzami/luci-app-pppoe-manager/releases/tag/v1.1.0
[1.0.0-r2]: https://github.com/arafatrahmanzami/luci-app-pppoe-manager/releases/tag/v1.0.0
