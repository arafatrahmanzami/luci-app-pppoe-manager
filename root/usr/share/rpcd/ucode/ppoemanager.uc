'use strict';
import { open, popen } from 'fs';

const DB_FILE = '/lib/ppp/ppp-users';
const SECRETS_FILE = '/etc/ppp/chap-secrets';

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

    // Step 1: map pppX -> {peer, gateway} from kernel
    const ifaceInfo = {};
    const p1 = popen("for i in /sys/class/net/ppp[0-9]*; do [ -e \"$i\" ] || continue; iface=$(basename $i); info=$(ip -4 addr show $iface 2>/dev/null); peer=$(echo \"$info\" | awk '/peer/{print $4}' | cut -d'/' -f1); gw=$(echo \"$info\" | awk '/inet /{print $2}' | cut -d'/' -f1); [ -n \"$peer\" ] && echo \"$iface|$peer|$gw\"; done 2>/dev/null");
    if (p1) {
        for (let line = p1.read('line'); length(line); line = p1.read('line')) {
            const parts = split(trim(line), '|', 3);
            if (length(parts) == 3) ifaceInfo[parts[0]] = { peer: parts[1], gw: parts[2] };
        }
        p1.close();
    }

    // Step 2: single ps pass — much faster than /proc iteration
    const p2 = popen("ps w 2>/dev/null | grep -F 'pppoe.so' | grep -v grep | grep -v ipparam");
    if (!p2) return sessions;

    for (let line = p2.read('line'); length(line); line = p2.read('line')) {
        const parts = split(trim(line), /\s+/, 2);
        if (length(parts) < 2) continue;
        const pid = parts[0];
        const cmd = parts[1];

        const m = match(cmd, /rp_pppoe_sess (\d+):([0-9a-fA-F:]+)/);
        if (!m) continue;
        const unit = m[1];
        const mac = m[2];
        const iface = 'ppp' + unit;

        const info = ifaceInfo[iface] || { peer: '', gw: '' };

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
            username: username_by_ip(info.peer),
            duration
        });
    }
    p2.close();
    return sessions;
}

const methods = {
    get_users: { call: function() { return { accounts: read_users() }; } },
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
    setup_firewall: {
        call: function() {
            // Backup current firewall config first
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
            const user = trim(req.args.user); const passwd = trim(req.args.passwd);
            const ipaddr = trim(req.args.ipaddr); const expiry = trim(req.args.expiry);
            if (!length(user) || !length(passwd)) return { result: false };
            const existing = read_users();
            for (let i = 0; i < length(existing); i++) {
                if (existing[i].user == user || existing[i].user == '#' + user) return { result: false, error: 'username_exists' };
            }
            let ip = ipaddr, id = '0';
            if (!length(ipaddr) || ipaddr == '*') {
                const base = '192.168.11'; let n = 10;
                while (n < 254) { n++; const cand = `${base}.${n}`;
                    if (system(`grep -q '${cand}|' ${DB_FILE}`) != 0) { ip = cand; id = `${n}`; break; } }
            } else { const p = split(ip, '.', 4); id = length(p) == 4 ? p[3] : '0'; }
            system(`echo '${expiry}|${user}|${passwd}|${ip}|${id}' >> ${DB_FILE}`);
            system(`echo '${user} * ${passwd} ${ip}' >> ${SECRETS_FILE}`);
            system('/etc/init.d/ppoemanager restart >/dev/null 2>&1 &');
            return { result: true };
        }
    },
    edit_user: {
        args: { olduser: 'olduser', user: 'user', passwd: 'passwd', ipaddr: 'ipaddr', expiry: 'expiry' },
        call: function(req) {
            const olduser = trim(req.args.olduser); const user = trim(req.args.user);
            const passwd = trim(req.args.passwd); const ipaddr = trim(req.args.ipaddr);
            const expiry = trim(req.args.expiry);
            system(`sed -i '/|${olduser}|/d' ${DB_FILE}`);
            system(`sed -i '/^${olduser} /d' ${SECRETS_FILE}`);
            system(`sed -i '/^#${olduser} /d' ${SECRETS_FILE}`);
            const p = split(ipaddr, '.', 4); const id = length(p) == 4 ? p[3] : '0';
            system(`echo '${expiry}|${user}|${passwd}|${ipaddr}|${id}' >> ${DB_FILE}`);
            system(`echo '${user} * ${passwd} ${ipaddr}' >> ${SECRETS_FILE}`);
            system('/etc/init.d/ppoemanager restart >/dev/null 2>&1 &');
            return { result: true };
        }
    },
    delete_user: {
        args: { user: 'user' },
        call: function(req) {
            const user = trim(req.args.user);
            system(`sed -i '/|${user}|/d' ${DB_FILE}`);
            system(`sed -i '/^${user} /d' ${SECRETS_FILE}`);
            system(`sed -i '/^#${user} /d' ${SECRETS_FILE}`);
            system('/etc/init.d/ppoemanager restart >/dev/null 2>&1 &');
            return { result: true };
        }
    },
    force_offline: {
        args: { pid: 'pid' },
        call: function(req) {
            const pid = trim(req.args.pid);
            if (pid && match(pid, /^\d+$/)) { system(`kill -9 ${pid} 2>/dev/null`); return { result: true }; }
            return { result: false };
        }
    }
};

return { 'luci.ppoemanager': methods };
