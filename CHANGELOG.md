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

## [1.1.0-r5] — 2026-10-10

First stable release. Consolidates all development iterations into a
production-ready package.

### Added

**Five-tab interface** (General Settings, Users Manager, Online Users, Advanced, Help)

**General Settings**
- Server configuration: interface, AC name, service names, server IP, first client IP
- Session limits: max sessions, max sessions per peer
- Network tuning: MTU, MRU, MSS clamp, idle timeout
- DNS configuration: primary and secondary DNS pushed to clients
- Firewall Setup section with three buttons:
  - **Show Preview** — displays exact `uci` commands before applying
  - **Apply Firewall Setup** — creates zone `pppoe`, enables masquerade, adds forwarding to WAN
  - **Restore from Backup** — lists all backups and restores any one
- Automatic firewall backup to `/etc/config/firewall.bak-ppoemanager-<timestamp>` before every change
- Live config validation — warns if Server IP conflicts with LAN or if pool is on a different subnet

**Users Manager**
- Add, edit, and delete PPPoE accounts from the web UI
- Per-user expiration dates with automatic blocking
- Optional static IP binding (blank = auto-assign from pool)
- Active / Expired status display
- Duplicate username protection

**Online Users**
- Live list of connected sessions: username, client IP, MAC, server IP, duration
- **Force Offline** button to disconnect any session with one click
- Auto-refresh every 5 seconds
- Manual **Refresh Now** button
- Kernel-sourced peer IP (reads from `ip addr show pppX`, not stale cmdline)

**Advanced**
- Multi-WAN coordination: auto-manage mwan3 (disable when PPPoE server runs)
- Flow offloading control: software / hardware / auto modes
- mwan3 conntrack fix via `/etc/mwan3.user` hook
- Low-level PPPoE flags: randomize sessions, options file path, session offset, first session unit, synchronous PPP

**Help**
- 13 collapsible documentation sections:
  - Overview — What This App Does
  - Quick Start — First-Time Setup
  - The Five Tabs Explained
  - Server Configuration — Every Field Explained
  - Firewall Setup — What It Does and Why
  - Users Manager — How Accounts Work
  - Online Users — Live Session Monitoring
  - Advanced Settings — When to Touch Them
  - Files & Locations — Complete Reference
  - Command Reference — Useful SSH Commands
  - Troubleshooting — Common Issues
  - Glossary of Terms
  - Credits

**Automatic Expiration Enforcement**
- `ppoemanager-checker` runs hourly via cron
- Blocks expired accounts with `#` prefix in both `chap-secrets` and `ppp-users`
- Kills active PPP sessions for expired users
- Flushes conntrack entries
- Auto-unblocks renewed accounts

**Tab Persistence**
- Active tab saved in `localStorage` — reload keeps you on the same tab

### Fixed
- **Online Users parser** rewritten from scratch
  - Now excludes the WAN uplink pppd (filters by `ipparam`)
  - Reads peer IP from kernel state (`ip addr show pppX`) instead of stale cmdline
  - Correct duration math using `/proc/<pid>/stat` field 22 (USER_HZ = 100)
  - Correct username lookup matching the actual assigned IP
- **Performance** — Online Users RPC response from 2–20 seconds down to ~25 ms
  - Replaced per-PID `/proc` iteration (200+ file opens) with a single `ps w | grep` pass
- **UCI config** now ships inside the package (was previously created via broken `uci batch`)
- **Menu JSON** no longer requires `uci: ppoemanager: true` (was causing silent menu hides)
- **`postinst`** restarts rpcd and uhttpd so the menu appears immediately after install
- **Conffiles** list trimmed to files we own (was triggering build warnings for `rp-pppoe-server` files)
- **Tab persistence** — switched from URL hash (LuCI strips it) to `localStorage`

### Changed
- Renamed from `pppoeuser` to `luci-app-pppoe-manager`
- Modern JavaScript LuCI (was legacy Lua)
- Database path standardised to `/lib/ppp/ppp-users`
- `uci-defaults` no longer auto-starts the service — user must enable manually
- CI builds a single universal IPK and APK (no architecture duplication)

### Technical
- Package size: ~16 KB
- `PKG_ARCH=all` — runs on every OpenWrt / ImmortalWrt architecture
- Dependencies: `luci-base`, `rp-pppoe-server`, `conntrack`
- Tested on: ImmortalWrt 24.10.6 / MediaTek Filogic (aarch64) / IMOU LC-HX3001
- CI: ImmortalWrt 24.10 SDK for IPK, OpenWrt 25.12 SDK for APK
- Local ImageBuilder produces a full rootfs tarball for the IMOU LC-HX3001

---

[Unreleased]: https://github.com/arafatrahmanzami/luci-app-pppoe-manager/compare/v1.1.0-r5...HEAD
[1.1.0-r5]: https://github.com/arafatrahmanzami/luci-app-pppoe-manager/releases/tag/v1.1.0-r5
