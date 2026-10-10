🌐 **English** · [**বাংলা**](https://github.com/arafatrahmanzami/luci-app-pppoe-manager/tree/main/docs/bn)

# luci-app-pppoe-manager

A modern PPPoE Server Manager for OpenWrt / ImmortalWrt — a lightweight LuCI (OpenWrt's web-based configuration User Interface) application that manages the Roaring Penguin PPPoE server (`rp-pppoe-server`) with an easy-to-use web interface, per-user expiration dates, automatic account blocking, live online session monitoring, and one-click disconnection.

**Release:** `1.1.0-r3` — 2026-10-10 — by [@arafatrahmanzami](https://github.com/arafatrahmanzami)

Built on top of `rp-pppoe-server` + `ppp` + `nftables`/`iptables` firewall, with a modern LuCI JavaScript UI. Tested on ImmortalWrt 24.10 (MediaTek Filogic / IMOU HX21, aarch64).

---

## What does this actually do?

Imagine you want your OpenWrt/ImmortalWrt router to act like a **mini ISP** — accepting PPPoE dial-in connections from clients (Windows PCs, other routers, IoT devices) and giving each one a username, password, IP address, and expiration date.

**You need this if:**

- ✅ You have clients who dial in via PPPoE to get internet
- ✅ You sell or share internet access and need per-user expiry dates
- ✅ You want to disconnect a specific client remotely without rebooting
- ✅ You want a web UI to add/edit/delete PPPoE accounts
- ✅ You need to know who is online, from which IP/MAC, and for how long

**You don't need this if:**

- ❌ You only use your router as a PPPoE client (dialling out to an ISP)
- ❌ You don't want to run a PPPoE server
- ❌ You use another PPPoE solution (accel-ppp, etc.)

---

## Table of Contents

- [What does this actually do?](#what-does-this-actually-do)
- [Why PPPoE Manager?](#why-pppoe-manager)
- [Key Features](#key-features)
- [Prerequisites](#prerequisites)
- [Before You Start](#before-you-start)
- [Installation](#installation)
- [After Installation](#after-installation)
- [Configuration](#configuration)
- [Users Manager Tab](#users-manager-tab)
- [Online Users Tab](#online-users-tab)
- [General Settings Tab](#general-settings-tab)
- [MWAN3 Conflict Resolution](#mwan3-conflict-resolution)
- [Flow Offloading Management](#flow-offloading-management)
- [Automatic Expiration Enforcement](#automatic-expiration-enforcement)
- [Common Use Cases](#common-use-cases)
- [Troubleshooting](#troubleshooting)
- [Changelog](#changelog)
- [Compile from Source (OpenWrt SDK)](#compile-from-source-openwrt-sdk)
- [Credits](#credits)
- [Glossary](#glossary)
- [License](#license)

---

## Why PPPoE Manager?

Existing OpenWrt PPPoE server tools fall into two categories:

1. **`luci-app-rp-pppoe-server`** — the official LuCI app for the Roaring Penguin server. Simple, but **has no user management UI**. You must edit `/etc/ppp/chap-secrets` by hand for every user, and there's no way to set expiration dates or view active sessions.

2. **Community forks** (like the old Lienol 2020 package) — have a user table but no expiration logic, no session monitoring, and no coordination with tools like `mwan3` or flow offloading.

**luci-app-pppoe-manager** fills the gap. It combines:

- ✅ Complete user management with **expiration dates**
- ✅ Automatic **session termination** when an account expires
- ✅ **Live online users** dashboard with **force-disconnect**
- ✅ **MWAN3 coordination** — automatically disables mwan3 when the PPPoE server is running (the two conflict)
- ✅ **Flow offloading coordination** — safely enables software offloading when possible
- ✅ **Modern JavaScript LuCI UI** — not the legacy Lua interface

---

## Key Features

- **Users Manager** — add, edit, delete PPPoE accounts from the web UI
- **Per-user expiration** — set a date; the account auto-blocks when expired
- **Active/Expired status** — see at a glance which accounts are usable
- **Static or auto-assigned IP** — bind a user to a specific IP, or let the server pick from the pool
- **Online Users dashboard** — live list of connected sessions: username, client IP, MAC, server IP, session duration
- **Force Offline button** — kick any user with one click
- **Real-time polling** — online users table refreshes every 10 seconds
- **General Settings tab** — configure interface, IP pool, DNS, MSS, timeouts, service names, AC name
- **MWAN3 auto-coordination** — automatically disables the mwan3 daemon when the PPPoE server starts, re-enables it when stopped
- **Flow offloading management** — software offloading by default (safe with conntrack fix), hardware offloading optional
- **mwan3 conntrack fix** — optional `/etc/mwan3.user` hook to flush dead flows on failover
- **Automatic expiration checker** — runs via cron hourly, or via `rc.local` at boot
- **Modern LuCI JS UI** — tabbed interface, real-time tables, clean layout
- **Universal architecture** — `PKG_ARCH=all`, works on every router CPU (x86, MIPS, ARM, AArch64, RISC-V)
- **opkg and apk support** — builds for both OpenWrt ≤ 24.10 (`opkg`) and ≥ 25.12 (`apk`)

---

## Prerequisites

To function correctly, the app requires the following packages:

- OpenWrt / ImmortalWrt 24.10+
- `rp-pppoe-server` (the actual PPPoE daemon)
- `rp-pppoe-common`
- `ppp` and `ppp-mod-pppoe`
- `conntrack` (for session cleanup)
- `luci-base` (LuCI foundation)
- `kmod-pppoe`, `kmod-pppox` (kernel modules — usually already present)

**Architecture:** Universal. This package is `PKG_ARCH=all` — it contains only shell scripts, JavaScript, and ucode. No compiled binaries. Works on every OpenWrt architecture.

---

## Before You Start

Answer these questions **before** installing:

- [ ] **Do you have a working OpenWrt / ImmortalWrt router?** — 24.10 or newer.
- [ ] **Do you have SSH access?** — Try `ssh root@<router-ip>` from your PC.
- [ ] **Do you have a separate subnet for PPPoE clients?** — Recommended: use `192.168.11.0/24` or another free range, **not** your main LAN subnet.
- [ ] **Have you backed up your current config?** — In LuCI: **System → Backup / Flash Firmware → Generate archive**.

---

## Installation

### Method 1 — Download from GitHub Releases (recommended)

#### OpenWrt ≤ 24.10 (opkg)

```sh
cd /tmp
wget https://github.com/arafatrahmanzami/luci-app-pppoe-manager/releases/download/v1.0.0/luci-app-pppoe-manager_1.0.0-r2_all.ipk
opkg update
opkg install luci-app-pppoe-manager_1.0.0-r2_all.ipk
rm -f /tmp/luci-indexcache /tmp/luci-modulecache/*
/etc/init.d/rpcd restart
/etc/init.d/uhttpd restart
```

#### OpenWrt ≥ 25.12 (apk)

```sh
cd /tmp
wget https://github.com/arafatrahmanzami/luci-app-pppoe-manager/releases/download/v1.0.0/luci-app-pppoe-manager-1.0.0-r2.apk
apk add --allow-untrusted luci-app-pppoe-manager-1.0.0-r2.apk
rm -f /tmp/luci-indexcache /tmp/luci-modulecache/*
/etc/init.d/rpcd restart
/etc/init.d/uhttpd restart
```

### Method 2 — Auto-detect opkg vs apk

```sh
cd /tmp && \
if command -v apk >/dev/null 2>&1; then \
  echo "Detected apk — OpenWrt 25.12+" && \
  wget -O pppoe.pkg https://github.com/arafatrahmanzami/luci-app-pppoe-manager/releases/download/v1.0.0/luci-app-pppoe-manager-1.0.0-r2.apk && \
  apk add --allow-untrusted pppoe.pkg; \
else \
  echo "Detected opkg — OpenWrt 24.10 or older" && \
  opkg update && \
  wget -O pppoe.pkg https://github.com/arafatrahmanzami/luci-app-pppoe-manager/releases/download/v1.0.0/luci-app-pppoe-manager_1.0.0-r2_all.ipk && \
  opkg install pppoe.pkg; \
fi && \
rm -f /tmp/luci-indexcache /tmp/luci-modulecache/* && \
/etc/init.d/rpcd restart && /etc/init.d/uhttpd restart
```

### Method 3 — Upload via LuCI

1. Download the `.ipk` or `.apk` from the releases page
2. Open LuCI → **System → Software**
3. Click **Upload Package...**
4. Select the file, click **Install**
5. Hard-refresh the browser (**Ctrl+Shift+R**)

### Method 4 — Build from source

See [Compile from Source](#compile-from-source-openwrt-sdk) below.

### Source code

- [Download `.zip`](https://github.com/arafatrahmanzami/luci-app-pppoe-manager/archive/refs/tags/v1.0.0.zip)
- [Download `.tar.gz`](https://github.com/arafatrahmanzami/luci-app-pppoe-manager/archive/refs/tags/v1.0.0.tar.gz)

---

## After Installation

1. Open LuCI: `http://<router-ip>/cgi-bin/luci/`
2. Go to **Services → PPPoE Server**
3. You should see three tabs: **Users Manager**, **Online Users**, **General Settings**
4. If the menu doesn't appear, hard-refresh: **Ctrl+Shift+R**

**What gets installed:**

| Path | Purpose |
|---|---|
| `/etc/config/ppoemanager` | UCI configuration |
| `/etc/init.d/ppoemanager` | Init script (procd) |
| `/etc/uci-defaults/99-ppoemanager` | First-run setup (enables service) |
| `/usr/bin/ppoemanager-checker` | Expiration enforcement script |
| `/usr/bin/ppoemanager-control` | MWAN3 / offload coordination |
| `/usr/share/rpcd/ucode/ppoemanager.uc` | RPC backend |
| `/www/luci-static/resources/view/ppoemanager/main.js` | LuCI JavaScript UI |
| `/usr/share/luci/menu.d/luci-app-pppoe-manager.json` | Menu entry |
| `/usr/share/rpcd/acl.d/luci-app-pppoe-manager.json` | ACL permissions |

---

## Configuration

The UCI config lives at `/etc/config/ppoemanager`. Two sections:

### `pppoe_server` — server settings

| Option | Default | Description |
|---|---|---|
| `enabled` | `1` | Enable/disable the server |
| `interface` | `lan` | Interface to listen on (from `network` UCI) |
| `ac_name` | `access-concentrator-name` | Access Concentrator name |
| `service_name` | `service-name1`, `service-name2` | Service names advertised |
| `maxsessionsperpeer` | `1` | Max sessions per MAC address |
| `localip` | `192.168.11.1` | Server's IP on the PPPoE subnet |
| `firstremoteip` | `192.168.11.11` | First client IP in the pool |
| `maxsessions` | `32` | Max concurrent clients |
| `optionsfile` | `/etc/ppp/pppoe-server-options` | Path to pppd options file |
| `randomsession` | `0` | Randomize session IDs |
| `timeout` | `60` | Session inactivity timeout (seconds) |
| `mss` | `1468` | MSS clamping |

### `coordination` — integration with other services

| Option | Default | Description |
|---|---|---|
| `manage_mwan3` | `1` | Auto-disable mwan3 while PPPoE server runs |
| `manage_offloading` | `1` | Auto-manage firewall flow offloading |
| `offload_mode` | `software` | `software` / `hardware` / `auto` |
| `conntrack_flush_on_failover` | `1` | Install `/etc/mwan3.user` conntrack hook |

### Edit via SSH

```sh
uci set ppoemanager.server.localip='192.168.11.1'
uci set ppoemanager.server.firstremoteip='192.168.11.11'
uci set ppoemanager.server.maxsessions='64'
uci commit ppoemanager
/etc/init.d/ppoemanager restart
```

---

## Users Manager Tab

The primary tab. A table lists every PPPoE account with: index, expiration date, username, password (visible), IP address, status (**Active** / **Expired**), and action buttons.

**Add User:**
1. Click **Add User**
2. Enter username, password, static IP (optional — leave blank for auto), and expiration date
3. Click **Add**

**Edit User:** Click the **Edit** button on a row, change fields, click **Save**.

**Delete User:** Click the **Delete** button, confirm.

The data lives in `/lib/ppp/ppp-users`, one line per user:

```
<expiry_unix_timestamp>|<username>|<password>|<assigned_ip>|<id>
```

Active users are written as-is. Expired/blocked users are prefixed with `#`:

```
1767225600|proxmoxpf sense|pf sense|192.168.11.11|11
#1767225600|testuser|testpass|192.168.11.12|12   ← blocked
```

---

## Online Users Tab

Shows active PPPoE sessions in real time. Columns:

| Column | Meaning |
|---|---|
| **No.** | Row number |
| **User** | Username (looked up from `/etc/ppp/chap-secrets` by IP) |
| **Client IP** | The IP assigned to this session |
| **MAC** | The client's MAC address |
| **Server IP** | Your server's IP for this session |
| **Duration** | How long the session has been up |
| **Actions** | **Force Offline** button |

**Force Offline:** kills the `pppd` process for that session. The client is disconnected immediately.

The table refreshes automatically every 10 seconds.

---

## General Settings Tab

**Server Configuration** — edit all the server options listed above.

**Advanced Coordination** — MWAN3, flow offloading, and conntrack flush settings. See the next two sections.

---

## MWAN3 Conflict Resolution

**MWAN3 and the PPPoE server cannot coexist.** This is a documented OpenWrt limitation:

- MWAN3 tags every packet with a firewall mark (`fwmark`) for policy routing
- PPPoE encapsulation interferes with mark preservation
- Running both causes PPPoE clients to lose connectivity, mwan3 tracking to break, and sessions to drop randomly

**What this app does:**

- When the PPPoE server starts (`ppoemanager-control start`), it **automatically disables mwan3**
- When the server stops, mwan3 is re-enabled
- The `manage_mwan3` UCI option controls this (default: `on`)

The `ppoemanager-control` script is called by the init script. The mutual exclusion is **mandatory** — you cannot run both simultaneously.

---

## Flow Offloading Management

Software flow offloading is a kernel feature that speeds up forwarding by bypassing the full netfilter chain for established flows. It's safe to use with PPPoE **as long as MWAN3 is disabled**.

**Modes:**

| Mode | Behavior |
|---|---|
| `software` | Enables `flow_offloading=1`, `flow_offloading_hw=0`. Safe with mwan3 failover (with conntrack fix). **Recommended.** |
| `hardware` | Enables both. Fastest, but **incompatible with mwan3**. Use only on single-WAN setups. |
| `auto` | Tries hardware first, falls back to software. |

**The mwan3 conntrack fix:** an optional hook at `/etc/mwan3.user` that flushes conntrack entries on failover, preventing hung connections when offloading is enabled. Enable via `conntrack_flush_on_failover='1'`.

---

## Automatic Expiration Enforcement

The `ppoemanager-checker` script runs **every hour** via cron (or on boot via `rc.local`). It:

1. Reads `/lib/ppp/ppp-users`
2. For each expired user:
   - Prefixes the username with `#` in the database
   - Comments out the user in `/etc/ppp/chap-secrets`
   - Kills the active `pppd` process for that user (session terminated)
3. For each renewed user (expiry date moved to future):
   - Removes the `#` prefix from both files
   - User can log in again

**Add to cron (already done by `ppoemanager-control start`):**

```sh
# /etc/crontabs/root
3 * * * * /usr/bin/ppoemanager-checker
@reboot /etc/init.d/cron restart
```

**Run manually:** `/usr/bin/ppoemanager-checker`

---

## Common Use Cases

### 1. Small ISP / neighborhood sharing

- Configure server on `br-lan`
- Assign each client a static IP + expiration date
- Bill monthly; the checker blocks users automatically when they don't pay

### 2. Testing / lab

- Create short-lived test accounts
- Set expiration 1 hour in the future
- Watch the Online Users tab as sessions come and go

### 3. PPPoE relay to a secondary router

- Run the server on the main router
- Configure a secondary router as a PPPoE client (WAN interface)
- Assign a static IP with a fixed expiration date

### 4. Isolated guest PPPoE

- Create the server on a dedicated VLAN (`br-guest`)
- Give guests PPPoE credentials with short expiry
- The rest of your LAN is untouched

---

## Troubleshooting

### The menu doesn't appear

```sh
rm -f /tmp/luci-indexcache /tmp/luci-modulecache/*
/etc/init.d/rpcd restart
/etc/init.d/uhttpd restart
```

Then hard-refresh the browser (**Ctrl+Shift+R**).

### "Entry not found" when I run uci show ppoemanager

This means the UCI file was created but never loaded. Fix:

```sh
uci import ppoemanager < /etc/config/ppoemanager
uci commit ppoemanager
/etc/init.d/ppoemanager restart
```

### Users get 0.0.0.0 as their gateway

The `defaultroute` option is missing from `/etc/ppp/pppoe-server-options`. Add it:

```sh
echo "defaultroute" >> /etc/ppp/pppoe-server-options
/etc/init.d/ppoemanager restart
```

### Users can't reach the internet

Check masquerade is enabled for the PPPoE subnet. In LuCI: **Network → Firewall → Zones** — the zone with `ppp+` device must have **Masquerading** enabled.

### MWAN3 conflicts

```sh
/etc/init.d/mwan3 stop
/etc/init.d/mwan3 disable
/etc/init.d/ppoemanager restart
```

The `ppoemanager-control start` script does this automatically.

### Force Offline button doesn't work

Check the ucode backend is running:

```sh
ubus list | grep ppoemanager
```

If empty:

```sh
/etc/init.d/rpcd restart
ubus list | grep ppoemanager
```

### The service runs but no clients can connect

- Verify the interface (`br-lan`) is up: `ip link show br-lan`
- Check firewall allows PPPoE discovery: `nft list ruleset | grep -i pppoe`
- Look at logs: `logread | grep ppp`

### Sessions drop every few minutes

LCP echo timeout is too aggressive. In `/etc/ppp/pppoe-server-options`:

```
lcp-echo-interval 20
lcp-echo-failure 5
```

Then `/etc/init.d/ppoemanager restart`.

---

## Changelog

### [1.0.0-r2] — 2026-10-08

**Initial release**

**Added**

- Users Manager tab with add/edit/delete
- Expiration date per user
- Automatic blocking of expired accounts via `ppoemanager-checker`
- Online Users tab with live session list
- Force Offline button to kill sessions
- Real-time polling (10s interval) on Online Users
- General Settings tab for all server options
- Advanced Coordination section: MWAN3 + flow offloading + conntrack fix
- `ppoemanager-control` script for MWAN3/offload coordination
- UCI config shipped in the package (`/etc/config/ppoemanager`)
- procd-based init script
- ucode RPC backend (`luci.ppoemanager`)
- Menu entry under Services
- ACL permissions for ubus + uci

**Fixed**

- UCI config now ships in package (was previously created via broken `uci batch` in uci-defaults)
- Menu JSON no longer requires `uci: ppoemanager: true` (was causing silent menu hides)
- Conffiles list now only includes files we own (was triggering build warnings for `rp-pppoe-server` files)
- postinst script restarts rpcd/uhttpd so menu appears immediately

**Technical**

- Multi-architecture CI build via ImmortalWrt SDK
- Tested on ImmortalWrt 24.10.6 / MediaTek Filogic (aarch64) / IMOU HX21

### Legend

- **Added** — new features
- **Fixed** — bug fixes
- **Changed** — behavior changes
- **Technical** — internal improvements

---

## Compile from Source (OpenWrt SDK)

### Method 1 — Standalone SDK (no full OpenWrt tree)

```sh
# Download ImmortalWrt SDK for your target
mkdir -p ~/sdk-workspace && cd ~/sdk-workspace
wget https://downloads.immortalwrt.org/releases/24.10.6/targets/mediatek/filogic/immortalwrt-sdk-24.10.6-mediatek-filogic_gcc-13.3.0_musl.Linux-x86_64.tar.zst

# Extract
mkdir sdk-imou
tar --use-compress-program=unzstd -xf immortalwrt-sdk-*.tar.zst -C sdk-imou --strip-components=1
cd sdk-imou

# Add the package
cp -r ~/luci-app-pppoe-manager package/
rm -rf package/luci-app-pppoe-manager/.git package/luci-app-pppoe-manager/.github

# Update feeds
./scripts/feeds update -a
./scripts/feeds install -a

# Configure and build
echo "CONFIG_PACKAGE_luci-app-pppoe-manager=y" >> .config
make defconfig
make package/luci-app-pppoe-manager/compile V=s

# Output
find bin/packages -name "luci-app-pppoe-manager_*.ipk"
```

### Method 2 — Full OpenWrt / ImmortalWrt tree

```sh
git clone https://github.com/immortalwrt/immortalwrt.git
cd immortalwrt
./scripts/feeds update -a
./scripts/feeds install -a

cd package
git clone https://github.com/arafatrahmanzami/luci-app-pppoe-manager.git
cd ..

make menuconfig       # LuCI -> Applications -> luci-app-pppoe-manager
make package/luci-app-pppoe-manager/compile V=s

# Output: bin/packages/<arch>/base/luci-app-pppoe-manager_*.ipk
```

### Method 3 — GitHub Actions (automated)

Every tag push triggers a build for three architectures. See `.github/workflows/build.yml`.

---

## Credits

- **Roaring Penguin PPPoE Server** — David F. Skoll, [dianne.skoll.ca/projects/rp-pppoe](https://dianne.skoll.ca/projects/rp-pppoe/)
- **Original `pppoeuser` package** — Dan Mar Pascual (akosiramnad) — [akosiramnad/OpenWrt-PPPoE-Server-Account-Manager](https://github.com/akosiramnad/OpenWrt-PPPoE-Server-Account-Manager)
- **Lienol `luci-app-pppoe-server`** — lawlienol@gmail.com (reference for the Online Users feature)
- **pppoe-control logic** — original design by the OpenWrt community
- **Current maintainer:** Arafat Rahman Zami Mondol — [@arafatrahmanzami](https://github.com/arafatrahmanzami) · [open an issue](https://github.com/arafatrahmanzami/luci-app-pppoe-manager/issues/new)

---

## Glossary

Terms used in this README.

### Network fundamentals

| Term | Full form | Meaning |
|---|---|---|
| **PPPoE** | Point-to-Point Protocol over Ethernet | Protocol that encapsulates PPP frames inside Ethernet. Used by ISPs and for local dial-in. |
| **PPP** | Point-to-Point Protocol | The underlying protocol that carries IP over a serial link. |
| **CHAP** | Challenge Handshake Authentication Protocol | The authentication method used by PPPoE. Passwords are hashed, not sent in clear. |
| **PAP** | Password Authentication Protocol | Older auth method — sends password in clear. Not recommended. |
| **MS-CHAP-v2** | Microsoft CHAP v2 | Windows-compatible CHAP variant. |
| **LAN** | Local Area Network | Your home/office network. |
| **WAN** | Wide Area Network | The internet/ISP side. |
| **IP** | Internet Protocol | Each device's address (e.g. `192.168.11.1`). |
| **MAC** | Media Access Control | Hardware address of a network card. |
| **DHCP** | Dynamic Host Configuration Protocol | Automatically assigns IPs. |
| **DNS** | Domain Name System | Translates names to IPs. |
| **AC** | Access Concentrator | The server side of PPPoE. |
| **Session** | An active PPPoE connection | One client = one session. |

### OpenWrt ecosystem

| Term | Meaning |
|---|---|
| **OpenWrt** | Open-source router firmware (Linux-based). |
| **ImmortalWrt** | OpenWrt fork with extra packages and Chinese-friendly defaults. |
| **LuCI** | OpenWrt's web-based configuration interface. |
| **UCI** | Unified Configuration Interface — stores all config under `/etc/config/`. |
| **procd** | OpenWrt's service manager. |
| **rpcd** | The service behind LuCI that processes web requests. |
| **uhttpd** | The lightweight HTTP server serving LuCI. |
| **opkg** | Package manager for OpenWrt ≤ 24.10. Uses `.ipk`. |
| **apk** | Package manager for OpenWrt ≥ 25.12. Uses `.apk`. |
| **ubus** | OpenWrt's internal message bus. Used for inter-service communication. |
| **ucode** | OpenWrt's scripting language (successor to Lua for RPC backends). |
| **nftables** | Modern Linux firewall framework. Replaces iptables in OpenWrt 24.10+. |
| **iptables** | Legacy Linux firewall framework. |
| **conntrack** | Connection tracking — tracks active network flows. |
| **mwan3** | Multi-WAN manager — load balancing and failover. |
| **flow offloading** | Kernel feature that speeds up forwarding. |
| **fwmark** | A numeric tag attached to packets for routing decisions. |
| **procd init** | Service definition using procd, OpenWrt's process manager. |

### Shell commands

| Command | Meaning |
|---|---|
| `uci set` / `uci get` / `uci commit` / `uci show` | Read/write UCI config |
| `opkg install` / `opkg remove` / `opkg update` | Manage ipk packages |
| `apk add` / `apk del` | Manage apk packages |
| `logread` | Read the system log |
| `ubus list` | List running ubus services |
| `ps w` | List processes |
| `ifconfig` / `ip addr` | Show network interfaces |
| `wget` | Download a file |
| `scp` | Secure file copy over SSH |
| `ssh` | Secure remote shell |
| `reboot` | Restart the router |
| `chmod +x` | Make file executable |

### Interface naming

| Name | Meaning |
|---|---|
| **eth0, eth1** | Physical Ethernet interfaces |
| **lan1, lan2, lan3** | LAN ports |
| **wan** | WAN port |
| **br-lan** | LAN bridge |
| **pppX** | Active PPP interface (X = 0, 1, 2, …) |
| **pppoe-wan** | PPPoE interface for your ISP WAN |
| **ppp+** | Wildcard matching all `pppX` interfaces |

### Units

| Unit | Meaning |
|---|---|
| **Mbit/s, Mbps** | Megabits per second — data rate |
| **Kbit/s** | Kilobits per second |
| **ms** | Millisecond — 1/1000 second |
| **KB, MB** | Kilobyte, Megabyte (8 bits = 1 byte) |

### Platform

| Term | Meaning |
|---|---|
| **Git** | Version control system |
| **GitHub** | Git repository hosting platform |
| **Repository** | A collection of code and files |
| **Commit** | A saved snapshot of changes |
| **Tag** | A named marker (e.g. `v1.0.0`) |
| **Release** | A published version with downloadable files |
| **SDK** | Software Development Kit — the toolchain used to build packages |

---

## License

Apache-2.0 (inherited from upstream `pppoeuser` package)

---

## Support

- **Issues:** [GitHub Issues](https://github.com/arafatrahmanzami/luci-app-pppoe-manager/issues)
- **Releases:** [GitHub Releases](https://github.com/arafatrahmanzami/luci-app-pppoe-manager/releases)
- **Source:** [GitHub Repository](https://github.com/arafatrahmanzami/luci-app-pppoe-manager)
