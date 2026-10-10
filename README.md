🌐 **English** · [**বাংলা**](https://github.com/arafatrahmanzami/luci-app-pppoe-manager/tree/main/docs/bn)

# luci-app-pppoe-manager

A modern PPPoE Server Manager for OpenWrt / ImmortalWrt — a lightweight LuCI (OpenWrt's web-based configuration User Interface) application that runs a PPPoE Access Concentrator with an easy-to-use web interface, per-user expiration dates, automatic account blocking, live online session monitoring, one-click firewall setup, and MikroTik-style advanced controls.

**Release:** `1.1.0-r5` — 2026-10-10 — by [@arafatrahmanzami](https://github.com/arafatrahmanzami)

Built on top of `rp-pppoe-server` + `ppp` + `nftables`/`iptables` firewall, with a modern LuCI JavaScript UI. Tested on ImmortalWrt 24.10.6 (MediaTek Filogic / IMOU LC-HX3001, aarch64).

---

## What does this actually do?

Imagine you want your OpenWrt / ImmortalWrt router to act like a **mini ISP** — accepting PPPoE dial-in connections from clients (Windows PCs, other routers, IoT devices) and giving each one a username, password, IP address, and expiration date.

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
- [Quick Start](#quick-start)
- [The Five Tabs](#the-five-tabs)
- [Firewall Setup Explained](#firewall-setup-explained)
- [Users Manager](#users-manager)
- [Online Users](#online-users)
- [Advanced Settings](#advanced-settings)
- [Help Tab](#help-tab)
- [Automatic Expiration Enforcement](#automatic-expiration-enforcement)
- [Common Use Cases](#common-use-cases)
- [Troubleshooting](#troubleshooting)
- [Changelog](#changelog)
- [Compile from Source](#compile-from-source-openwrt-sdk)
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
- ✅ **One-click firewall setup** with automatic backup and restore
- ✅ **MWAN3 coordination** — automatically disables mwan3 when the PPPoE server is running (the two conflict)
- ✅ **Flow offloading coordination** — safely enables software offloading when possible
- ✅ **Modern JavaScript LuCI UI** — not the legacy Lua interface
- ✅ **Extensive Help tab** — 13 collapsible documentation sections built into the UI

---

## Key Features

**Server Management**
- Five-tab interface: General Settings, Users Manager, Online Users, Advanced, Help
- Modern JavaScript UI with tab persistence (`localStorage`)
- Config validation — warns on subnet conflicts
- Universal architecture (`PKG_ARCH=all`) — runs on every OpenWrt CPU

**User Management**
- Add, edit, delete PPPoE accounts from the web UI
- Per-user expiration dates with automatic blocking
- Optional static IP binding or auto-assign from pool
- Active / Expired status display
- Duplicate username protection

**Session Monitoring**
- Live list of connected sessions: username, client IP, MAC, server IP, duration
- **Force Offline** button to disconnect any session
- Auto-refresh every 5 seconds
- Kernel-sourced peer IP (accurate, not from stale cmdline)

**Firewall Automation**
- "Show Preview" button — displays exact `uci` commands before applying
- "Apply Firewall Setup" — creates zone `pppoe`, enables masquerade, adds forwarding to WAN
- "Restore from Backup" — lists all backups and restores any one
- Automatic backup to `/etc/config/firewall.bak-ppoemanager-<timestamp>` before every change

**Advanced Controls**
- Auto-manage mwan3 (disable when PPPoE server runs, re-enable when stopped)
- Flow offloading mode: software / hardware / auto
- mwan3 conntrack fix via `/etc/mwan3.user` hook
- Low-level PPPoE flags: randomize sessions, custom options file, session offset, first session unit, synchronous PPP

**Automation**
- `ppoemanager-checker` — hourly expiration enforcement
- Blocks expired accounts with `#` prefix in both `chap-secrets` and `ppp-users`
- Kills active PPP sessions for expired users
- Flushes conntrack entries
- Auto-unblocks renewed accounts

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
wget https://github.com/arafatrahmanzami/luci-app-pppoe-manager/releases/download/v1.1.0-r5/luci-app-pppoe-manager_1.1.0-r5_all.ipk
opkg update
opkg install luci-app-pppoe-manager_1.1.0-r5_all.ipk
rm -f /tmp/luci-indexcache /tmp/luci-modulecache/*
/etc/init.d/rpcd restart
/etc/init.d/uhttpd restart
```

#### OpenWrt ≥ 25.12 (apk)

```sh
cd /tmp
wget https://github.com/arafatrahmanzami/luci-app-pppoe-manager/releases/download/v1.1.0-r5/luci-app-pppoe-manager-1.1.0-r5.apk
apk add --allow-untrusted luci-app-pppoe-manager-1.1.0-r5.apk
rm -f /tmp/luci-indexcache /tmp/luci-modulecache/*
/etc/init.d/rpcd restart
/etc/init.d/uhttpd restart
```

### Method 2 — Auto-detect opkg vs apk

```sh
cd /tmp && \
if command -v apk >/dev/null 2>&1; then \
  echo "Detected apk — OpenWrt 25.12+" && \
  wget -O pppoe.pkg https://github.com/arafatrahmanzami/luci-app-pppoe-manager/releases/download/v1.1.0-r5/luci-app-pppoe-manager-1.1.0-r5.apk && \
  apk add --allow-untrusted pppoe.pkg; \
else \
  echo "Detected opkg — OpenWrt 24.10 or older" && \
  opkg update && \
  wget -O pppoe.pkg https://github.com/arafatrahmanzami/luci-app-pppoe-manager/releases/download/v1.1.0-r5/luci-app-pppoe-manager_1.1.0-r5_all.ipk && \
  opkg install pppoe.pkg; \
fi && \
rm -f /tmp/luci-indexcache /tmp/luci-modulecache/* && \
/etc/init.d/rpcd restart && /etc/init.d/uhttpd restart
```

### Method 3 — Full install tarball (no package manager)

The `-full.tar.gz` contains all files at their target paths. Extract directly to `/`:

```sh
cd /tmp
wget https://github.com/arafatrahmanzami/luci-app-pppoe-manager/releases/download/v1.1.0-r5/luci-app-pppoe-manager-1.1.0-r5-full.tar.gz
cd / && tar xzf /tmp/luci-app-pppoe-manager-1.1.0-r5-full.tar.gz
chmod +x /etc/init.d/ppoemanager /usr/bin/ppoemanager-checker /usr/bin/ppoemanager-control
/etc/init.d/rpcd restart
/etc/init.d/uhttpd restart
```

### Method 4 — Rootfs tarball (for IMOU LC-HX3001)

Pre-built rootfs with the app installed:

```sh
cd /tmp
wget https://github.com/arafatrahmanzami/luci-app-pppoe-manager/releases/download/v1.1.0-r5/luci-app-pppoe-manager-rootfs-r5.tar.gz
```

This is a complete root filesystem — for advanced users or image builders only.

### Method 5 — Upload via LuCI

1. Download the `.ipk` or `.apk` from the releases page
2. Open LuCI → **System → Software**
3. Click **Upload Package...**
4. Select the file, click **Install**
5. Hard-refresh the browser (**Ctrl+Shift+R**)

### Method 6 — Build from source

See [Compile from Source](#compile-from-source-openwrt-sdk) below.

### Source code

- [Download `.zip`](https://github.com/arafatrahmanzami/luci-app-pppoe-manager/archive/refs/tags/v1.1.0-r5.zip)
- [Download `.tar.gz`](https://github.com/arafatrahmanzami/luci-app-pppoe-manager/archive/refs/tags/v1.1.0-r5.tar.gz)

---

## After Installation

1. Open LuCI: `http://<router-ip>/cgi-bin/luci/`
2. Go to **Services → PPPoE Server**
3. You should see **five tabs**: General Settings, Users Manager, Online Users, Advanced, Help
4. If the menu doesn't appear, hard-refresh: **Ctrl+Shift+R**

**What gets installed:**

| Path | Purpose |
|------|---------|
| `/etc/config/ppoemanager` | UCI configuration |
| `/etc/init.d/ppoemanager` | Init script (procd) |
| `/etc/uci-defaults/99-ppoemanager` | First-run setup |
| `/usr/bin/ppoemanager-checker` | Expiration enforcement script |
| `/usr/bin/ppoemanager-control` | MWAN3 / offload coordination |
| `/usr/share/rpcd/ucode/ppoemanager.uc` | RPC backend |
| `/www/luci-static/resources/view/ppoemanager/main.js` | LuCI JavaScript UI |
| `/usr/share/luci/menu.d/luci-app-pppoe-manager.json` | Menu entry |
| `/usr/share/rpcd/acl.d/luci-app-pppoe-manager.json` | ACL permissions |

---

## Quick Start

**10-step first-time setup:**

1. **Pick a separate subnet** — e.g., `192.168.12.0/24` (not your main LAN subnet)
2. **Create a network interface** for the PPPoE subnet (Network → Interfaces → Add new interface, e.g. `br-pppoe` or a VLAN)
3. **Open this app** — Services → PPPoE Server
4. **Select the interface** you created in step 2
5. **Set Server IP** to the interface's IP (e.g., `192.168.12.1`)
6. **Set First Client IP** to the first free IP in that subnet (e.g., `192.168.12.11`)
7. **Click "Apply Firewall Setup"** at the bottom — creates the firewall zone and enables masquerade
8. **Go to Users Manager** and click **Add User** to create credentials
9. **Come back to General Settings** and click **Save & Apply** to start the server
10. **Connect a client** with the credentials — it will appear in Online Users

---

## The Five Tabs

### 1. General Settings

Basic server configuration plus the Firewall Setup section.

| Field | What it does |
|-------|--------------|
| Enable Server | Turn the PPPoE server on or off |
| Interface | UCI interface the server listens on |
| AC Name | Access Concentrator name (cosmetic) |
| Service Names | Labels advertised to clients |
| Server IP | Server's own IP on the PPP link |
| First Client IP | First address in the client pool |
| Max Sessions | Maximum concurrent clients |
| Max Sessions per Peer | Per-MAC limit |
| Primary DNS | DNS server 1 pushed to clients |
| Secondary DNS | DNS server 2 pushed to clients |
| MTU | Maximum Transmission Unit (standard: 1492) |
| MRU | Maximum Receive Unit (standard: 1492) |
| MSS (clamp) | Maximum Segment Size (standard: 1468) |
| Idle Timeout | Disconnect idle clients after N seconds |

### 2. Users Manager

Table of all PPPoE accounts with **Add / Edit / Delete** and expiration dates.

Accounts live in `/lib/ppp/ppp-users` (with expiration) and `/etc/ppp/chap-secrets` (credentials).

### 3. Online Users

Live list of connected sessions:

| Column | Meaning |
|--------|---------|
| User | Username (from chap-secrets by IP) |
| Client IP | The peer address assigned via IPCP |
| MAC | Client's Ethernet address |
| Server IP | Your router's address on that session |
| Duration | How long the session has been up |
| Actions | **Force Offline** button |

Auto-refreshes every 5 seconds.

### 4. Advanced

Multi-WAN and low-level settings — see [Advanced Settings](#advanced-settings).

### 5. Help

Built-in documentation with 13 collapsible sections:
Overview, Quick Start, Five Tabs, Server Configuration, Firewall Setup, Users Manager, Online Users, Advanced Settings, Files & Locations, Command Reference, Troubleshooting, Glossary, Credits.

---

## Firewall Setup Explained

PPPoE clients connect to your router, but they cannot reach the internet by default — the firewall blocks them.

The **"Apply Firewall Setup"** button performs these changes:

```
uci set firewall.pppoe=zone              # create a new zone
uci set firewall.pppoe.name='pppoe'        # name it "pppoe"
uci set firewall.pppoe.input='ACCEPT'      # allow client → router
uci set firewall.pppoe.output='ACCEPT'     # allow router → client
uci set firewall.pppoe.forward='ACCEPT'    # allow client → internet
uci set firewall.pppoe.masq='1'             # enable NAT/masquerade
uci add_list firewall.pppoe.device='ppp+'  # match all pppX interfaces
uci add firewall forwarding                # add a forwarding rule
uci set firewall.@forwarding[-1].src='pppoe'
uci set firewall.@forwarding[-1].dest='wan'
uci commit firewall
/etc/init.d/firewall reload
```

**Safety features:**
- Before any change, `/etc/config/firewall` is backed up to `/etc/config/firewall.bak-ppoemanager-<timestamp>`
- "Show Preview" displays the exact commands before they run
- "Restore from Backup" lists all backups and restores any one

---

## Users Manager

Each PPPoE user is stored in two places:

- `/lib/ppp/ppp-users` — database with expiration: `expiry|username|password|ip|id`
- `/etc/ppp/chap-secrets` — credentials read by the PPP daemon

### Expiration Enforcement

The `ppoemanager-checker` script runs every hour (via cron). For each user whose expiration date has passed, it:

1. Prefixes the username with `#` in both files (blocking the account)
2. Kills any active PPP session for that user
3. Flushes conntrack entries so no packets slip through

To renew a user: just change the expiration date in the UI. The next hourly run will unblock the account automatically.

### Static vs Auto IP

- **Leave the Static IP field blank** — server assigns the next free IP from the pool
- **Enter a specific IP** — pins the account to that address

⚠️ **Warning:** Two users with the same static IP will conflict. Only one can connect at a time.

---

## Online Users

Shows every currently-connected PPPoE client with:

- **Username** — looked up from chap-secrets by client IP
- **Client IP** — the peer address assigned via IPCP
- **MAC** — the client's Ethernet address
- **Server IP** — your router's address on that session
- **Duration** — how long the session has been up

### Force Offline

Sends `SIGKILL` to the `pppd` process for that session. The client is disconnected immediately. Useful for kicking abusive clients or forcing re-authentication.

---

## Advanced Settings

### Multi-WAN & Offload Coordination

**Auto-manage mwan3:** MWAN3 and PPPoE server cannot coexist — mwan3 uses firewall marks (fwmark) that interfere with PPPoE encapsulation. When enabled, this option disables mwan3 while the PPPoE server runs, then re-enables it when you stop the server.

**Auto-manage flow offloading:** Software flow offloading speeds up forwarding by bypassing the full netfilter chain. Safe with PPPoE, but only when mwan3 is off. Hardware flow offloading is fastest but incompatible with mwan3.

**mwan3 conntrack fix:** Installs `/etc/mwan3.user` — a hook that flushes dead conntrack entries on mwan3 failover. Prevents hung connections when offloading is enabled.

### Low-Level Server Flags

**Randomize Sessions:** Randomizes PPPoE session IDs (rarely needed).

**Options File:** Path to the pppd options file (default `/etc/ppp/pppoe-server-options`).

**Session Offset:** Starting offset for session IDs.

**First Session Unit:** First `pppX` unit number assigned.

**Synchronous PPP:** Use synchronous PPP (rarely needed).

---

## Help Tab

The Help tab contains **13 collapsible documentation sections**:

1. Overview — What This App Does
2. Quick Start — First-Time Setup
3. The Five Tabs Explained
4. Server Configuration — Every Field Explained
5. Firewall Setup — What It Does and Why
6. Users Manager — How Accounts Work
7. Online Users — Live Session Monitoring
8. Advanced Settings — When to Touch Them
9. Files & Locations — Complete Reference
10. Command Reference — Useful SSH Commands
11. Troubleshooting — Common Issues
12. Glossary of Terms
13. Credits

Each section is collapsed by default. Click to expand.

---

## Automatic Expiration Enforcement

Add to cron (already done by `ppoemanager-control start`):

```sh
# /etc/crontabs/root
3 * * * * /usr/bin/ppoemanager-checker
@reboot /etc/init.d/cron restart
```

**Run manually:** `/usr/bin/ppoemanager-checker`

---

## Common Use Cases

### 1. Small ISP / neighborhood sharing

- Configure server on a dedicated interface
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

### Menu doesn't appear after install

```sh
rm -f /tmp/luci-indexcache /tmp/luci-modulecache/*
/etc/init.d/rpcd restart
/etc/init.d/uhttpd restart
```

Then hard-refresh the browser (Ctrl+Shift+R).

### "Entry not found" when I run `uci show ppoemanager`

The UCI file exists but was never loaded. Fix:

```sh
uci import ppoemanager < /etc/config/ppoemanager
uci commit ppoemanager
/etc/init.d/ppoemanager restart
```

### Clients get 0.0.0.0 as their gateway

The `defaultroute` option is missing from `/etc/ppp/pppoe-server-options`:

```sh
echo "defaultroute" >> /etc/ppp/pppoe-server-options
/etc/init.d/ppoemanager restart
```

### Clients connect but have no internet

Click **"Apply Firewall Setup"** in General Settings. Verify with:

```sh
uci show firewall | grep -A 5 pppoe
```

### Online Users tab is empty

The client just connected — wait up to 5 seconds for the next poll. If still empty:

```sh
ubus call luci.ppoemanager get_online
```

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

### Sessions drop every few minutes

LCP echo timeout too aggressive. Edit `/etc/ppp/pppoe-server-options`:

```
lcp-echo-interval 20
lcp-echo-failure 5
```

Then `/etc/init.d/ppoemanager restart`.

### Two users with same static IP

They conflict. Only one can connect at a time. Edit each user and assign unique IPs.

---

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for the full history.

### [1.1.0-r5] — 2026-10-10 — First stable release

- Five-tab interface (General Settings, Users Manager, Online Users, Advanced, Help)
- Expanded Help tab with 13 collapsible documentation sections
- Online Users parser rewritten — kernel-sourced peer IP, correct duration math, ~25ms response
- Firewall Setup with preview, auto-backup, and restore
- Tab persistence via localStorage
- CI builds single universal IPK/APK (no arch duplication)

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

Every tag push triggers a build. See `.github/workflows/build.yml` and `.github/workflows/build-apk.yml`.

---

## Credits

- **Roaring Penguin PPPoE Server** — David F. Skoll, [dianne.skoll.ca/projects/rp-pppoe](https://dianne.skoll.ca/projects/rp-pppoe/)
- **Original `pppoeuser` package** — Dan Mar Pascual (akosiramnad) — [akosiramnad/OpenWrt-PPPoE-Server-Account-Manager](https://github.com/akosiramnad/OpenWrt-PPPoE-Server-Account-Manager)
- **Lienol `luci-app-pppoe-server`** — lawlienol@gmail.com (reference for the Online Users feature)
- **pppoe-control logic** — original design by the OpenWrt community
- **Current maintainer:** Arafat Rahman Zami Mondol — [@arafatrahmanzami](https://github.com/arafatrahmanzami) · [open an issue](https://github.com/arafatrahmanzami/luci-app-pppoe-manager/issues/new)

---

## Glossary

### Network fundamentals

| Term | Meaning |
|------|---------|
| **PPPoE** | Point-to-Point Protocol over Ethernet — how clients dial in |
| **PPP** | Point-to-Point Protocol — the underlying link protocol |
| **CHAP** | Challenge Handshake Authentication Protocol — password verification |
| **PAP** | Password Authentication Protocol — older, sends password in clear |
| **LAN** | Local Area Network — your home/office network |
| **WAN** | Wide Area Network — the internet/ISP side |
| **IP** | Internet Protocol — each device's address |
| **MAC** | Media Access Control — hardware address of a network card |
| **DHCP** | Dynamic Host Configuration Protocol — auto IP assignment |
| **DNS** | Domain Name System — names to IPs |
| **AC** | Access Concentrator — your router (server side) |
| **Session** | An active PPPoE connection |

### OpenWrt ecosystem

| Term | Meaning |
|------|---------|
| **OpenWrt** | Open-source router firmware (Linux-based) |
| **ImmortalWrt** | OpenWrt fork with extra packages and Chinese-friendly defaults |
| **LuCI** | OpenWrt's web-based configuration interface |
| **UCI** | Unified Configuration Interface — stores all config under `/etc/config/` |
| **procd** | OpenWrt's service manager |
| **rpcd** | The service behind LuCI that processes web requests |
| **uhttpd** | Lightweight HTTP server serving LuCI |
| **opkg** | Package manager for OpenWrt ≤ 24.10 (uses `.ipk`) |
| **apk** | Package manager for OpenWrt ≥ 25.12 (uses `.apk`) |
| **ubus** | OpenWrt's internal message bus |
| **ucode** | OpenWrt's scripting language for RPC backends |
| **nftables** | Modern Linux firewall framework |
| **iptables** | Legacy Linux firewall framework |
| **conntrack** | Connection tracking — tracks active network flows |
| **mwan3** | Multi-WAN manager — load balancing and failover |
| **flow offloading** | Kernel feature that speeds up forwarding |
| **fwmark** | Numeric tag attached to packets for routing decisions |

### Interface naming

| Name | Meaning |
|------|---------|
| **eth0, eth1** | Physical Ethernet interfaces |
| **lan1, lan2, lan3** | LAN ports |
| **wan** | WAN port |
| **br-lan** | LAN bridge |
| **pppX** | Active PPP interface (X = 0, 1, 2, …) |
| **pppoe-wan** | PPPoE interface for your ISP WAN |
| **ppp+** | Wildcard matching all pppX interfaces |

### Units

| Unit | Meaning |
|------|---------|
| **Mbit/s, Mbps** | Megabits per second — data rate |
| **Kbit/s** | Kilobits per second |
| **ms** | Millisecond — 1/1000 second |
| **KB, MB** | Kilobyte, Megabyte (8 bits = 1 byte) |

---

## License

Apache-2.0 (inherited from upstream `pppoeuser` package)

---

## Support

- **Issues:** [GitHub Issues](https://github.com/arafatrahmanzami/luci-app-pppoe-manager/issues)
- **Releases:** [GitHub Releases](https://github.com/arafatrahmanzami/luci-app-pppoe-manager/releases)
- **Source:** [GitHub Repository](https://github.com/arafatrahmanzami/luci-app-pppoe-manager)
