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

function read_online() {
    const sessions = [];
    const proc = popen("/bin/busybox top -bn1 2>/dev/null | grep 'pppd plugin rp-pppoe.so' | grep -v grep");
    if (proc) {
        for (let line = proc.read('line'); length(line); line = proc.read('line')) {
            const m = match(line, /^\s*(\d+)\s+(\d+)\s+.+rp_pppoe_sess 1:+([0-9a-fA-F:]+)\s+.+options\s+(\S+?):(\S+?)\s/);
            if (m) {
                const pid = m[1], mac = m[3], gateway = m[4], cip = m[5];
                let starttime = 0;
                const stat = open(`/proc/${pid}/stat`, 'r');
                if (stat) { const d = stat.read('all'); stat.close(); const p = split(trim(d), ' '); if (length(p) > 21) starttime = +p[21]; }
                const up = open('/proc/uptime', 'r');
                let uptime = 0;
                if (up) { uptime = +split(up.read('all'), ' ')[0]; up.close(); }
                const duration = uptime > 0 ? int(uptime - (starttime / 100)) : 0;
                let username = '?';
                const sf = open(SECRETS_FILE, 'r');
                if (sf) { for (let l = sf.read('line'); length(l); l = sf.read('line')) { const p = split(trim(l), /\s+/); if (length(p) >= 4 && p[3] == cip) { username = p[0]; break; } } sf.close(); }
                push(sessions, { pid, mac, gateway, cip, username, duration });
            }
        }
        proc.close();
    }
    return sessions;
}

const methods = {
    get_users: { call: function() { return { accounts: read_users() }; } },
    get_online: { call: function() { return { sessions: read_online() }; } },
    get_status: { call: function() { const r = system("ubus call service list '{\"name\":\"ppoemanager\"}' 2>/dev/null"); return { running: r == 0 }; } },
    add_user: {
        args: { user: 'user', passwd: 'passwd', ipaddr: 'ipaddr', expiry: 'expiry' },
        call: function(req) {
            const user = trim(req.args.user), passwd = trim(req.args.passwd);
            const ipaddr = trim(req.args.ipaddr), expiry = trim(req.args.expiry);
            if (!length(user) || !length(passwd)) return { result: false };
            let ip = ipaddr, id = '0';
            if (!length(ipaddr) || ipaddr == '*') {
                const base = '192.168.11'; let n = 10;
                while (n < 254) { n++; ip = `${base}.${n}`; const found = system(`grep -q '${ip}|' ${DB_FILE}`) == 0; if (!found) { id = `${n}`; break; } }
            } else { const parts = split(ip, '.', 4); id = length(parts) == 4 ? parts[3] : '0'; }
            system(`echo '${expiry}|${user}|${passwd}|${ip}|${id}' >> ${DB_FILE}`);
            system(`echo '${user} * ${passwd} ${ip}' >> ${SECRETS_FILE}`);
            system('/etc/init.d/ppoemanager restart >/dev/null 2>&1');
            return { result: true };
        }
    },
    edit_user: {
        args: { olduser: 'olduser', user: 'user', passwd: 'passwd', ipaddr: 'ipaddr', expiry: 'expiry' },
        call: function(req) {
            const olduser = trim(req.args.olduser), user = trim(req.args.user);
            const passwd = trim(req.args.passwd), ipaddr = trim(req.args.ipaddr), expiry = trim(req.args.expiry);
            system(`sed -i '/|${olduser}|/d' ${DB_FILE}`);
            system(`sed -i '/^${olduser} /d' ${SECRETS_FILE}`);
            system(`sed -i '/^#${olduser} /d' ${SECRETS_FILE}`);
            const parts = split(ipaddr, '.', 4); const id = length(parts) == 4 ? parts[3] : '0';
            system(`echo '${expiry}|${user}|${passwd}|${ipaddr}|${id}' >> ${DB_FILE}`);
            system(`echo '${user} * ${passwd} ${ipaddr}' >> ${SECRETS_FILE}`);
            system('/etc/init.d/ppoemanager restart >/dev/null 2>&1');
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
            system('/etc/init.d/ppoemanager restart >/dev/null 2>&1');
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
