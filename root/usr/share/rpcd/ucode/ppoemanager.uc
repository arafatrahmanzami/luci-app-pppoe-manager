'use strict';
import { open, popen } from 'fs';

const DB_FILE = '/lib/ppp/ppp-users';
const META_FILE = '/lib/ppp/ppoemanager-meta';
const SECRETS_FILE = '/etc/ppp/chap-secrets';

// Strip leading #s from a username (works on both "#user" and "##user")
function clean_user(u) {
    if (!length(u)) return '';
    let out = u;
    while (substr(out, 0, 1) == '#') out = substr(out, 1);
    return out;
}

// Read per-user metadata: username|price|notes|first_seen|last_seen|sessions|total_seconds
function read_meta() {
    const meta = {};
    const f = open(META_FILE, 'r');
    if (!f) return meta;
    for (let line = f.read('line'); length(line); line = f.read('line')) {
        const parts = split(trim(line), '|', 8);
        if (length(parts) >= 1 && length(parts[0])) {
            meta[parts[0]] = {
                user: parts[0],
                price: parts[1] || '',
                notes: parts[2] || '',
                first_seen: parts[3] || '',
                last_seen: parts[4] || '',
                sessions: parts[5] || '0',
                total_seconds: parts[6] || '0',
                total_paid: parts[7] || '0'
            };
        }
    }
    f.close();
    return meta;
}

function write_meta(meta) {
    const lines = [];
    for (let u in meta) {
        const m = meta[u];
        push(lines, `${u}|${m.price || ''}|${m.notes || ''}|${m.first_seen || ''}|${m.last_seen || ''}|${m.sessions || '0'}|${m.total_seconds || '0'}|${m.total_paid || '0'}`);
    }
    const tmp = META_FILE + '.tmp';
    system(`: > ${tmp}`);
    for (let i = 0; i < length(lines); i++) {
        const l = replace(lines[i], /'/g, "'\\''");
        system(`echo '${l}' >> ${tmp}`);
    }
    system(`mv ${tmp} ${META_FILE}`);
}

function ensure_meta(user, meta) {
    if (!meta[user]) {
        meta[user] = {
            user: user, price: '', notes: '',
            first_seen: `${time()}`, last_seen: '',
            sessions: '0', total_seconds: '0', total_paid: '0'
        };
    }
    return meta[user];
}

function read_users() {
    const users = [];
    const f = open(DB_FILE, 'r');
    if (!f) return users;
    for (let line = f.read('line'); length(line); line = f.read('line')) {
        const u = split(trim(line), '|', 5);
        if (length(u) == 5) push(users, { expiry: u[0], user: u[1], password: u[2], ipaddr: u[3], id: u[4] });
    }
    f.close();
    return users;
}

function username_by_ip(ip) {
    if (!length(ip)) return '?';
    const sf = open(SECRETS_FILE, 'r');
    if (!sf) return '?';
    const matches = [];
    for (let l = sf.read('line'); length(l); l = sf.read('line')) {
        const t = trim(l);
        if (!length(t) || substr(t, 0, 1) == '#') continue;
        const p = split(t, /\s+/);
        if (length(p) >= 4 && p[3] == ip) push(matches, p[0]);
    }
    sf.close();
    if (length(matches) == 0) return '?';
    if (length(matches) > 1) return matches[0] + ' +' + (length(matches)-1);
    return matches[0];
}

function read_online() {
    const sessions = [];

    // Step 1: build PID <-> interface maps from /run/pppd/*.pid
    const pidToIface = {};
    const pidList = popen("ls /run/pppd/*.pid 2>/dev/null");
    if (pidList) {
        for (let line = pidList.read('line'); length(line); line = pidList.read('line')) {
            const f = trim(line);
            const m = match(f, /\/ppp([^\/]+)\.pid$/);
            if (!m) continue;
            const iface = 'ppp' + m[1];
            const pf = open(f, 'r');
            if (!pf) continue;
            const pid = trim(pf.read('all'));
            pf.close();
            if (length(pid)) pidToIface[pid] = iface;
        }
        pidList.close();
    }

    // Step 2: interface -> {peer, gateway} from kernel
    const ifaceInfo = {};
    const ipOut = popen("for i in /sys/class/net/ppp[0-9]*; do [ -e \"$i\" ] || continue; iface=$(basename $i); info=$(ip -4 addr show $iface 2>/dev/null); peer=$(echo \"$info\" | awk '/peer/{print $4}' | cut -d'/' -f1); gw=$(echo \"$info\" | awk '/inet /{print $2}' | cut -d'/' -f1); [ -n \"$peer\" ] && echo \"$iface|$peer|$gw\"; done 2>/dev/null");
    if (ipOut) {
        for (let line = ipOut.read('line'); length(line); line = ipOut.read('line')) {
            const parts = split(trim(line), '|', 3);
            if (length(parts) == 3) ifaceInfo[parts[0]] = { peer: parts[1], gw: parts[2] };
        }
        ipOut.close();
    }

    // Step 3: enumerate pppd processes (exclude WAN via ipparam)
    const psOut = popen("ps w 2>/dev/null | grep -F 'pppoe.so' | grep -v grep | grep -v ipparam");
    if (!psOut) return sessions;

    for (let line = psOut.read('line'); length(line); line = psOut.read('line')) {
        const parts = split(trim(line), /\s+/, 2);
        if (length(parts) < 2) continue;
        const pid = parts[0];
        const cmd = parts[1];

        const m = match(cmd, /rp_pppoe_sess \d+:([0-9a-fA-F:]+)/);
        if (!m) continue;
        const mac = m[1];

        const iface = pidToIface[pid] || '';
        const info = iface ? (ifaceInfo[iface] || { peer: '', gw: '' }) : { peer: '', gw: '' };

        let duration = 0;
        const st = open(`/proc/${pid}/stat`, 'r');
        if (st) {
            const data = st.read('all');
            st.close();
            const sp = split(trim(data), ' ');
            if (length(sp) > 21) {
                const up = open('/proc/uptime', 'r');
                if (up) {
                    const uptime = +split(up.read('all'), ' ')[0];
                    up.close();
                    duration = int(uptime - (+sp[21] / 100));
                }
            }
        }

        push(sessions, {
            pid,
            mac,
            iface,
            cip: info.peer,
            gateway: info.gw,
            username: info.peer ? username_by_ip(info.peer) : '?',
            duration
        });
    }
    psOut.close();
    return sessions;
}

function purge_user(userClean) {
    if (!length(userClean)) return;
    system(`sed -i "/|#*${userClean}|/d" ${DB_FILE}`);
    system(`sed -i "/^#*${userClean} /d" ${SECRETS_FILE}`);
}

// Derive subnet base from config's firstremoteip
function get_subnet_base() {
    const p = popen("uci -q get ppoemanager.server.firstremoteip 2>/dev/null");
    if (!p) return '192.168.11';
    const ip = trim(p.read('all'));
    p.close();
    if (!length(ip)) return '192.168.11';
    const parts = split(ip, '.', 4);
    if (length(parts) < 3) return '192.168.11';
    return `${parts[0]}.${parts[1]}.${parts[2]}`;
}

const methods = {
    get_users: { call: function() { return { accounts: read_users() }; } },
    get_user_meta: {
        call: function() {
            return { meta: read_meta() };
        }
    },

    set_user_meta: {
        args: { user: 'user', price: 'price', notes: 'notes' },
        call: function(req) {
            const user = clean_user(trim(req.args.user));
            const price = trim(req.args.price || '');
            const notes = trim(req.args.notes || '');
            if (!length(user)) return { result: false, error: 'missing_user' };

            const meta = read_meta();
            const m = ensure_meta(user, meta);
            const oldPrice = m.price;
            m.price = price;
            m.notes = notes;
            if (!length(m.first_seen)) m.first_seen = `${time()}`;

            if (length(price) && price != oldPrice) {
                const p = +price;
                if (p > 0) {
                    const prev = +m.total_paid;
                    const newTotal = prev + p;
                    m.total_paid = `${int(newTotal * 100) / 100}`;
                }
            }

            write_meta(meta);
            return { result: true, total_paid: m.total_paid };
        }
    },
    extend_user: {
        args: { user: 'user', days: 'days' },
        call: function(req) {
            const user = clean_user(trim(req.args.user));
            const days = int(trim(req.args.days));
            if (!length(user) || !days) return { result: false, error: 'missing_args' };

            const users = read_users();
            let found = false;
            const newUsers = [];
            const now = time();

            for (let i = 0; i < length(users); i++) {
                const u = users[i];
                if (clean_user(u.user) == user) {
                    found = true;
                    let base = int(u.expiry);
                    if (base < now) base = now;
                    const newExpiry = base + (days * 86400);
                    push(newUsers, {
                        expiry: `${newExpiry}`,
                        user: u.user,
                        password: u.password,
                        ipaddr: u.ipaddr,
                        id: u.id
                    });
                } else {
                    push(newUsers, u);
                }
            }
            if (!found) return { result: false, error: 'user_not_found' };

            const tmp = DB_FILE + '.tmp';
            system(`: > ${tmp}`);
            for (let i = 0; i < length(newUsers); i++) {
                const u = newUsers[i];
                const l = replace(`${u.expiry}|${u.user}|${u.password}|${u.ipaddr}|${u.id}`, /'/g, "'\\''");
                system(`echo '${l}' >> ${tmp}`);
            }
            system(`mv ${tmp} ${DB_FILE}`);

            // Meta: last_seen + cumulative payment
            const meta = read_meta();
            const m = ensure_meta(user, meta);
            m.last_seen = `${now}`;
            if (length(m.price)) {
                const p = +m.price;
                if (p > 0) {
                    const payment = (p * days) / 30;
                    const prev = +m.total_paid;
                    const newTotal = prev + payment;
                    m.total_paid = `${int(newTotal * 100) / 100}`;
                }
            }
            write_meta(meta);

            system('/etc/init.d/ppoemanager restart >/dev/null 2>&1 &');
            return { result: true, days: days, user: user, paid: m.total_paid };
        }
    },
    get_online: { call: function() { return { sessions: read_online() }; } },
    get_status: {
        call: function() {
            const r = system("ubus call service list '{\"name\":\"ppoemanager\"}' 2>/dev/null");
            return { running: r == 0 };
        }
    },
    restart_service: {
        call: function() {
            system('/etc/init.d/ppoemanager restart >/dev/null 2>&1 &');
            return { result: true };
        }
    },
    get_offload_mode: {
        call: function() {
            let mode = 'software';
            const p = popen("uci -q get pppoemanager.coord.offload_mode 2>/dev/null");
            if (p) {
                const v = trim(p.read('all'));
                p.close();
                if (length(v)) mode = v;
            }
            // Also read firewall state for verification
            let fwSoft = '0', fwHw = '0';
            const a = popen("uci -q get firewall.@defaults[0].flow_offloading 2>/dev/null");
            if (a) { const v = trim(a.read('all')); a.close(); if (length(v)) fwSoft = v; }
            const b = popen("uci -q get firewall.@defaults[0].flow_offloading_hw 2>/dev/null");
            if (b) { const v = trim(b.read('all')); b.close(); if (length(v)) fwHw = v; }
            return { mode: mode, flow_offloading: fwSoft, flow_offloading_hw: fwHw };
        }
    },
    apply_offloading: {
        args: { mode: 'mode' },
        call: function(req) {
            let mode = trim(req.args.mode);
            // If no arg passed, read from UCI
            if (!length(mode)) {
                const p = popen("uci -q get pppoemanager.coord.offload_mode 2>/dev/null");
                if (p) {
                    mode = trim(p.read('all'));
                    p.close();
                }
            }
            if (!length(mode)) mode = 'software';

            // Persist the mode to UCI
            system(`uci set pppoemanager.coord.offload_mode='${mode}'`);
            system("uci commit pppoemanager");

            // Apply to firewall
            if (mode == 'hardware' || mode == 'auto') {
                system("uci set firewall.@defaults[0].flow_offloading='1'");
                system("uci set firewall.@defaults[0].flow_offloading_hw='1'");
            } else if (mode == 'software') {
                system("uci set firewall.@defaults[0].flow_offloading='1'");
                system("uci set firewall.@defaults[0].flow_offloading_hw='0'");
            } else {
                system("uci set firewall.@defaults[0].flow_offloading='0'");
                system("uci set firewall.@defaults[0].flow_offloading_hw='0'");
            }
            system("uci commit firewall");
            system("/etc/init.d/firewall reload >/dev/null 2>&1 &");
            return { result: true, mode: mode };
        }
    },
    setup_firewall: {
        call: function() {
            const ts = trim(system("date +%Y%m%d-%H%M%S"));
            system(`cp /etc/config/firewall /etc/config/firewall.bak-ppoemanager-${ts}`);

            if (system("uci -q get firewall.pppoe >/dev/null 2>&1") != 0) {
                system("uci set firewall.pppoe=zone");
                system("uci set firewall.pppoe.name='pppoe'");
                system("uci set firewall.pppoe.input='ACCEPT'");
                system("uci set firewall.pppoe.output='ACCEPT'");
                system("uci set firewall.pppoe.forward='ACCEPT'");
                system("uci set firewall.pppoe.masq='1'");
                system("uci add_list firewall.pppoe.device='ppp+'");
            } else {
                system("uci set firewall.pppoe.masq='1'");
            }

            const hasfwd = system("uci show firewall 2>/dev/null | grep -q \"forwarding.*src='pppoe'\"") == 0;
            if (!hasfwd) {
                system("uci add firewall forwarding >/dev/null");
                system("uci set firewall.@forwarding[-1].src='pppoe'");
                system("uci set firewall.@forwarding[-1].dest='wan'");
            }
            system("uci commit firewall");
            system("/etc/init.d/firewall reload >/dev/null 2>&1 &");
            return { result: true, backup: `/etc/config/firewall.bak-ppoemanager-${ts}` };
        }
    },
    get_firewall_status: {
        call: function() {
            const zone = system("uci -q get firewall.pppoe >/dev/null 2>&1") == 0;
            const masq = system("uci -q get firewall.pppoe.masq 2>/dev/null | grep -q 1") == 0;
            const fwd  = system("uci show firewall 2>/dev/null | grep -q \"forwarding.*src='pppoe'\"") == 0;
            return { zone: zone, masq: masq, forward: fwd };
        }
    },
    get_firewall_preview: {
        call: function() {
            return { commands: [
                "uci set firewall.pppoe=zone",
                "uci set firewall.pppoe.name='pppoe'",
                "uci set firewall.pppoe.input='ACCEPT'",
                "uci set firewall.pppoe.output='ACCEPT'",
                "uci set firewall.pppoe.forward='ACCEPT'",
                "uci set firewall.pppoe.masq='1'",
                "uci add_list firewall.pppoe.device='ppp+'",
                "uci add firewall forwarding  (src=pppoe, dest=wan)",
                "uci commit firewall",
                "/etc/init.d/firewall reload"
            ]};
        }
    },
    list_firewall_backups: {
        call: function() {
            const out = [];
            const p = popen("ls -t /etc/config/firewall.bak-ppoemanager-* 2>/dev/null");
            if (p) {
                for (let line = p.read('line'); length(line); line = p.read('line')) push(out, trim(line));
                p.close();
            }
            return { backups: out };
        }
    },
    restore_firewall: {
        args: { path: 'path' },
        call: function(req) {
            const path = trim(req.args.path);
            if (!match(path, /^\/etc\/config\/firewall\.bak-ppoemanager-[0-9-]+$/)) return { result: false, error: 'invalid' };
            const rc = system(`cp ${path} /etc/config/firewall && uci commit firewall`);
            system("/etc/init.d/firewall reload >/dev/null 2>&1 &");
            return { result: rc == 0 };
        }
    },
    add_user: {
        args: { user: 'user', passwd: 'passwd', ipaddr: 'ipaddr', expiry: 'expiry' },
        call: function(req) {
            const rawUser = trim(req.args.user);
            const userClean = clean_user(rawUser);
            const passwd = trim(req.args.passwd);
            const ipaddr = trim(req.args.ipaddr);
            const expiry = trim(req.args.expiry);

            if (!length(userClean)) return { result: false, error: 'missing_user' };
            if (!length(passwd)) return { result: false, error: 'missing_password' };
            if (!length(expiry)) return { result: false, error: 'missing_expiry' };

            const existing = read_users();
            for (let i = 0; i < length(existing); i++) {
                if (clean_user(existing[i].user) == userClean) return { result: false, error: 'username_exists' };
            }

            let ip = ipaddr, id = '0';
            if (!length(ipaddr) || ipaddr == '*') {
                const base = get_subnet_base(); let n = 10;
                while (n < 254) {
                    n++;
                    const cand = `${base}.${n}`;
                    if (system(`grep -q '${cand}|' ${DB_FILE}`) != 0) { ip = cand; id = `${n}`; break; }
                }
            } else {
                const p = split(ip, '.', 4);
                id = length(p) == 4 ? p[3] : '0';
            }

            purge_user(userClean);

            system(`echo '${expiry}|${userClean}|${passwd}|${ip}|${id}' >> ${DB_FILE}`);
            system(`echo '${userClean} * ${passwd} ${ip}' >> ${SECRETS_FILE}`);

            // Initialize meta with first_seen
            const meta = read_meta();
            const m = ensure_meta(userClean, meta);
            m.first_seen = `${time()}`;
            write_meta(meta);

            system('/etc/init.d/ppoemanager restart >/dev/null 2>&1 &');
            return { result: true, ip: ip, id: id };
        }
    },
    edit_user: {
        args: { olduser: 'olduser', user: 'user', passwd: 'passwd', ipaddr: 'ipaddr', expiry: 'expiry' },
        call: function(req) {
            const olduserClean = clean_user(trim(req.args.olduser));
            const userClean = clean_user(trim(req.args.user));
            const passwd = trim(req.args.passwd);
            const ipaddr = trim(req.args.ipaddr);
            const expiry = trim(req.args.expiry);

            if (!length(userClean)) return { result: false, error: 'missing_user' };
            if (!length(passwd)) return { result: false, error: 'missing_password' };

            purge_user(olduserClean);
            if (userClean != olduserClean) purge_user(userClean);

            const p = split(ipaddr, '.', 4);
            const id = length(p) == 4 ? p[3] : '0';
            system(`echo '${expiry}|${userClean}|${passwd}|${ipaddr}|${id}' >> ${DB_FILE}`);
            system(`echo '${userClean} * ${passwd} ${ipaddr}' >> ${SECRETS_FILE}`);
            system('/etc/init.d/ppoemanager restart >/dev/null 2>&1 &');
            return { result: true };
        }
    },
    delete_user: {
        args: { user: 'user' },
        call: function(req) {
            const userClean = clean_user(trim(req.args.user));
            if (!length(userClean)) return { result: false };
            purge_user(userClean);
            // Remove meta entry
            const meta = read_meta();
            if (meta[userClean]) {
                delete meta[userClean];
                write_meta(meta);
            }
            system('/etc/init.d/ppoemanager restart >/dev/null 2>&1 &');
            return { result: true };
        }
    },
    force_offline: {
        args: { pid: 'pid' },
        call: function(req) {
            const pid = trim(req.args.pid);
            if (!pid || !match(pid, /^\d+$/)) return { result: false };

            // Step 1: SIGTERM — graceful shutdown, pppd sends PADT to client
            system(`kill -TERM ${pid} 2>/dev/null`);

            // Step 2: brief grace period for PADT to be sent
            system('sleep 1');

            // Step 3: if still alive, SIGKILL as fallback
            const still = system(`[ -d /proc/${pid} ] && echo alive`);
            if (still == 0) {
                system(`kill -9 ${pid} 2>/dev/null`);
            }

            // Step 4: flush conntrack so client can reconnect immediately
            system('conntrack -F >/dev/null 2>&1');

            return { result: true, method: 'sigterm' };
        }
    }
};

return { 'luci.ppoemanager': methods };
