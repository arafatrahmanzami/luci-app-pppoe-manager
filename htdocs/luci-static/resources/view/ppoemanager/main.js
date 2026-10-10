'use strict';
'require view';
'require dom';
'require poll';
'require uci';
'require rpc';
'require form';
'require ui';
'require tools.widgets as widgets';

var callGetUsers    = rpc.declare({ object: 'luci.ppoemanager', method: 'get_users',  expect: {} });
var callGetOnline   = rpc.declare({ object: 'luci.ppoemanager', method: 'get_online', expect: {} });
var callAddUser     = rpc.declare({ object: 'luci.ppoemanager', method: 'add_user',   params: ['user','passwd','ipaddr','expiry'], expect: { result: true } });
var callEditUser    = rpc.declare({ object: 'luci.ppoemanager', method: 'edit_user',  params: ['olduser','user','passwd','ipaddr','expiry'], expect: { result: true } });
var callDelUser     = rpc.declare({ object: 'luci.ppoemanager', method: 'delete_user',params: ['user'], expect: { result: true } });
var callKill        = rpc.declare({ object: 'luci.ppoemanager', method: 'force_offline', params: ['pid'], expect: { result: true } });
var callRestart     = rpc.declare({ object: 'luci.ppoemanager', method: 'restart_service', expect: { result: true } });
var callFwSetup     = rpc.declare({ object: 'luci.ppoemanager', method: 'setup_firewall', expect: {} });
var callFwStatus    = rpc.declare({ object: 'luci.ppoemanager', method: 'get_firewall_status', expect: {} });
var callFwPreview   = rpc.declare({ object: 'luci.ppoemanager', method: 'get_firewall_preview', expect: {} });
var callFwBackups   = rpc.declare({ object: 'luci.ppoemanager', method: 'list_firewall_backups', expect: {} });
var callFwRestore   = rpc.declare({ object: 'luci.ppoemanager', method: 'restore_firewall', params: ['path'], expect: { result: true } });

function tsToDateStr(ts) { var d = new Date(parseInt(ts)*1000); return d.toISOString().slice(0,10); }
function fmtDuration(s) { s = parseInt(s); if (isNaN(s)||s<0) return '-'; var h=Math.floor(s/3600), m=Math.floor((s%3600)/60); return h+'h '+m+'m'; }

// ============================================================
// USERS MANAGER TAB
// ============================================================
var UsersTab = {
    render: function(data) {
        var users = (data[0] && Array.isArray(data[0].accounts)) ? data[0].accounts : [];
        var now = Math.floor(Date.now()/1000);
        var rows = users.map(function(u,i){
            var expired = now > parseInt(u.expiry);
            var clean = u.user.replace(/^#/,'');
            var status = expired ? 'Expired' : 'Active';
            var color = expired ? 'red' : 'green';
            return [
                i+1, tsToDateStr(u.expiry), clean, u.password, u.ipaddr,
                E('span',{style:'color:'+color+';font-weight:bold'},status),
                E('div',{'class':'center'},[
                    E('button',{'class':'btn cbi-button-edit','click':function(){ UsersTab.showEdit(clean, u.password, u.ipaddr, u.expiry); }},_('Edit')),' ',
                    E('button',{'class':'btn cbi-button-remove important','click':function(){ UsersTab.handleDelete(clean); }},_('Delete'))
                ])
            ];
        });
        var table = E('table',{'class':'table cbi-section-table','id':'ut'},[
            E('tr',{'class':'tr table-titles'},[
                E('th',{'class':'th'},_('No.')),
                E('th',{'class':'th'},_('Expiration')),
                E('th',{'class':'th'},_('User')),
                E('th',{'class':'th'},_('Password')),
                E('th',{'class':'th'},_('IP Address')),
                E('th',{'class':'th'},_('Status')),
                E('th',{'class':'th'},_('Actions'))
            ])
        ]);
        cbi_update_table(table, rows, E('em',_('No users configured.')));
        return E('div',{'class':'cbi-section'},[
            E('h3',_('Users Manager')),
            E('p',{'class':'cbi-section-descr'},_('Manage PPPoE accounts. Each user has an expiration date — expired accounts are automatically blocked by the hourly checker script.')),
            E('button',{'class':'btn cbi-button-positive important','click':UsersTab.showAdd},_('Add User')),
            E('p'),table
        ]);
    },
    showAdd: function() {
        ui.showModal(_('Add PPPoE User'), [
            E('div',{'class':'left','style':'display:flex;flex-direction:column;gap:8px;padding:10px'},[
                E('label',{},[_('Username: '),E('input',{id:'nu','class':'cbi-input-text',style:'width:250px'})]),
                E('label',{},[_('Password: '),E('input',{id:'np','class':'cbi-input-text',style:'width:250px'})]),
                E('label',{},[_('Static IP (blank=auto): '),E('input',{id:'ni','class':'cbi-input-text',style:'width:250px',placeholder:'e.g. 192.168.12.15'})]),
                E('label',{},[_('Expiration: '),E('input',{id:'ne',type:'date','class':'cbi-input-text',style:'width:250px'})])
            ]),
            E('div',{'class':'right'},[
                E('button',{'class':'btn','click':ui.hideModal},_('Cancel')),' ',
                E('button',{'class':'btn cbi-button-positive important','click':function(){
                    var u=document.getElementById('nu').value.trim();
                    var p=document.getElementById('np').value;
                    var i=document.getElementById('ni').value.trim();
                    var e=document.getElementById('ne').value;
                    if(!u||!p||!e){alert('Username, Password, Expiration required');return;}
                    var ets=Math.floor(new Date(e).getTime()/1000);
                    if(ets <= Math.floor(Date.now()/1000)){alert('Expiration must be in future');return;}
                    callAddUser(u,p,i||'*',ets.toString()).then(function(r){
                        if (r && r.error === 'username_exists') { alert('Username already exists'); return; }
                        location.reload();
                    });
                }},_('Add'))
            ])
        ]);
    },
    showEdit: function(user, pass, ip, expiry) {
        var d = new Date(parseInt(expiry)*1000).toISOString().slice(0,10);
        ui.showModal(_('Edit User: ')+user, [
            E('div',{'class':'left','style':'display:flex;flex-direction:column;gap:8px;padding:10px'},[
                E('label',{},[_('Username: '),E('input',{id:'eu','class':'cbi-input-text',value:user,style:'width:250px'})]),
                E('label',{},[_('Password: '),E('input',{id:'ep','class':'cbi-input-text',value:pass,style:'width:250px'})]),
                E('label',{},[_('Static IP: '),E('input',{id:'ei','class':'cbi-input-text',value:ip,style:'width:250px'})]),
                E('label',{},[_('Expiration: '),E('input',{id:'ee',type:'date','class':'cbi-input-text',value:d,style:'width:250px'})])
            ]),
            E('div',{'class':'right'},[
                E('button',{'class':'btn','click':ui.hideModal},_('Cancel')),' ',
                E('button',{'class':'btn cbi-button-positive important','click':function(){
                    var n=document.getElementById('eu').value.trim();
                    var p=document.getElementById('ep').value;
                    var i=document.getElementById('ei').value.trim();
                    var e=document.getElementById('ee').value;
                    if(!n||!p||!e){alert('All fields required');return;}
                    var ets=Math.floor(new Date(e).getTime()/1000);
                    callEditUser(user,n,p,i,ets.toString()).then(function(){location.reload();});
                }},_('Save'))
            ])
        ]);
    },
    handleDelete: function(user) {
        if (!confirm('Delete user "'+user+'"?')) return;
        callDelUser(user).then(function(){ location.reload(); });
    }
};

// ============================================================
// ONLINE USERS TAB
// ============================================================
var OnlineTab = {
    render: function(data) {
        var sess = (data[1] && Array.isArray(data[1].sessions)) ? data[1].sessions : [];
        var rows = sess.map(function(s,i){
            return [
                i+1, s.username||'?', s.cip||'-', s.mac||'-', s.gateway||'-', fmtDuration(s.duration),
                E('button',{'class':'btn cbi-button-negative important','click':function(){
                    if(!confirm('Disconnect '+s.cip+' ('+s.username+')?')) return;
                    callKill(s.pid).then(function(){ setTimeout(function(){ location.reload(); }, 800); });
                }},_('Force Offline'))
            ];
        });
        var table = E('table',{'class':'table cbi-section-table','id':'ot'},[
            E('tr',{'class':'tr table-titles'},[
                E('th',{'class':'th'},_('No.')),
                E('th',{'class':'th'},_('User')),
                E('th',{'class':'th'},_('Client IP')),
                E('th',{'class':'th'},_('MAC')),
                E('th',{'class':'th'},_('Server IP')),
                E('th',{'class':'th'},_('Duration')),
                E('th',{'class':'th'},_('Actions'))
            ])
        ]);
        var emptyMsg = sess.length === 0
            ? E('div',{'style':'text-align:center;padding:20px;color:#888'},[
                E('p',_('No active sessions.')),
                E('p',{'style':'font-size:11px'},_('If a client just connected, wait 5 seconds for the next poll.'))
              ])
            : E('em',_('No active sessions.'));
        cbi_update_table(table, rows, emptyMsg);
        return E('div',{'class':'cbi-section'},[
            E('h3',_('Online Users')),
            E('p',{'class':'cbi-section-descr'},_('Live list of connected PPPoE clients. Refreshes automatically every 5 seconds. Use Force Offline to disconnect a session immediately.')),
            E('button',{'class':'btn cbi-button-positive','click':function(){window.location.reload();}},_('Refresh Now')),
            E('p'),table
        ]);
    }
};

// ============================================================
// GENERAL SETTINGS TAB
// ============================================================
var SettingsTab = {
    render: function(fwStatus) {
        var m = new form.Map('ppoemanager', _('Server Configuration'),
            _('Basic PPPoE server settings. All values are stored in /etc/config/ppoemanager.'));

        var s = m.section(form.TypedSection, 'pppoe_server', _('Server Configuration'));
        s.anonymous = true; s.addremove = false;
        var o;

        o = s.option(form.Flag, 'enabled', _('Enable Server'), _('Turn the PPPoE server on or off. Save & Apply restarts the service.'));
        o.rmempty = false;

        o = s.option(widgets.NetworkSelect, 'interface', _('Interface'), _('UCI interface to listen on (e.g., a bridge or VLAN).'));
        o.nocreate = true; o.unspecified = true; o.rmempty = false;

        o = s.option(form.Value, 'ac_name', _('AC Name'), _('Access Concentrator name advertised to clients.'));
        o = s.option(form.DynamicList, 'service_name', _('Service Names'), _('Service names advertised to clients. Add at least one.'));
        o = s.option(form.Value, 'localip', _('Server IP'), _('The PPPoE server\'s own IP address on the PPP link.'));
        o.datatype = 'ipaddr';
        o = s.option(form.Value, 'firstremoteip', _('First Client IP'), _('First IP address in the pool handed out to clients.'));
        o.datatype = 'ipaddr';
        o = s.option(form.Value, 'maxsessions', _('Max Sessions'), _('Maximum concurrent clients.'));
        o.datatype = 'uinteger'; o.default = '32';
        o = s.option(form.Value, 'maxsessionsperpeer', _('Max Sessions per Peer'), _('Per-MAC limit (prevents one client taking all slots).'));
        o.datatype = 'uinteger'; o.default = '1';
        o = s.option(form.Value, 'dns1', _('Primary DNS'), _('DNS server 1 pushed to clients.'));
        o.datatype = 'ipaddr'; o.default = '8.8.8.8';
        o = s.option(form.Value, 'dns2', _('Secondary DNS'), _('DNS server 2 pushed to clients.'));
        o.datatype = 'ipaddr'; o.default = '1.1.1.1';
        o = s.option(form.Value, 'mtu', _('MTU'), _('Maximum Transmission Unit. Standard for PPPoE: 1492.'));
        o.datatype = 'uinteger'; o.default = '1492';
        o = s.option(form.Value, 'mru', _('MRU'), _('Maximum Receive Unit. Standard for PPPoE: 1492.'));
        o.datatype = 'uinteger'; o.default = '1492';
        o = s.option(form.Value, 'mss', _('MSS (clamp)'), _('Maximum Segment Size clamp. Standard for PPPoE: 1468.'));
        o.datatype = 'uinteger'; o.default = '1468';
        o = s.option(form.Value, 'timeout', _('Idle Timeout (s)'), _('Disconnect clients idle for this many seconds.'));
        o.datatype = 'uinteger'; o.default = '60';

        return m.render().then(function(node) {
            var fwBlock = E('div', {'class': 'cbi-section'}, [
                E('h3', _('Firewall Setup')),
                E('p', _('PPPoE clients cannot reach the internet without a firewall zone and masquerade rule. This is required once.')),
                E('p', _('Click "Show Preview" to see the exact commands that will run. A backup of /etc/config/firewall is created automatically before any change.')),
                E('div', {'style': 'margin:10px 0'}, [
                    E('button', {'class': 'btn cbi-button', 'click': function() {
                        callFwPreview().then(function(r) {
                            var cmds = (r && r.commands) ? r.commands : [];
                            var list = E('pre', {'style': 'background:#222;padding:10px;border-radius:4px;overflow-x:auto'});
                            list.textContent = cmds.join('\n');
                            ui.showModal(_('Firewall Changes Preview'), [
                                E('p', _('These commands will run:')),
                                list,
                                E('div', {'class': 'right'}, [E('button', {'class': 'btn', 'click': ui.hideModal}, _('Close'))])
                            ]);
                        });
                    }}, _('Show Preview')),
                    ' ',
                    E('button', {'class': 'btn cbi-button-positive important', 'click': function() {
                        if (!confirm('Apply firewall changes?\n\nA backup will be created automatically.')) return;
                        callFwSetup().then(function(r) {
                            ui.addNotification(null, E('p', _('Firewall updated. Backup: ') + ((r && r.backup) || '?')));
                            setTimeout(function(){ location.reload(); }, 1500);
                        });
                    }}, _('Apply Firewall Setup')),
                    ' ',
                    E('button', {'class': 'btn', 'click': function() {
                        callFwBackups().then(function(r) {
                            var list = (r && r.backups) ? r.backups : [];
                            if (!list.length) { alert('No backups found.'); return; }
                            var rows = list.map(function(p) {
                                return E('div', {'style': 'margin:5px 0'}, [
                                    E('code', {}, p), ' ',
                                    E('button', {'class': 'btn cbi-button-negative', 'click': function() {
                                        if (!confirm('Restore ' + p + '?')) return;
                                        callFwRestore(p).then(function() {
                                            ui.addNotification(null, E('p', _('Firewall restored. Reloading...')));
                                            setTimeout(function(){ location.reload(); }, 1500);
                                        });
                                    }}, _('Restore'))
                                ]);
                            });
                            ui.showModal(_('Firewall Backups'), [
                                E('p', _('Automatic backups created before each change.')),
                                E('div', {}, rows),
                                E('div', {'class': 'right'}, [E('button', {'class': 'btn', 'click': ui.hideModal}, _('Close'))])
                            ]);
                        });
                    }}, _('Restore from Backup'))
                ]),
                E('div', {'class': 'cbi-section-descr'}, [
                    E('strong', {}, _('Current status: ')),
                    (fwStatus && fwStatus.zone)
                        ? (fwStatus.masq ? _('Zone "pppoe" exists with masquerade and forwarding.') : _('Zone exists but masquerade is off.'))
                        : _('Not configured yet.')
                ])
            ]);
            node.appendChild(fwBlock);
            return node;
        });
    }
};

// ============================================================
// ADVANCED SETTINGS TAB
// ============================================================
var AdvancedTab = {
    render: function() {
        var m = new form.Map('ppoemanager', _('Advanced Settings'),
            _('These options require understanding of mwan3, firewall flow offloading, and PPP. Change with caution.'));

        var s = m.section(form.TypedSection, 'coordination', _('Multi-WAN & Offload Coordination'));
        s.anonymous = true;
        var o;
        o = s.option(form.Flag, 'manage_mwan3', _('Auto-manage mwan3'),
            _('Disable mwan3 when PPPoE server runs, re-enable when stopped.'));
        o.default = '1'; o.rmempty = false;
        o = s.option(form.Flag, 'manage_offloading', _('Auto-manage flow offloading'),
            _('Control firewall flow offloading to avoid conflicts with mwan3.'));
        o.default = '1'; o.rmempty = false;
        o = s.option(form.ListValue, 'offload_mode', _('Preferred Offload Mode'));
        o.value('software', _('Software (recommended)'));
        o.value('hardware', _('Hardware (fastest, no mwan3 failover)'));
        o.value('auto', _('Auto'));
        o.default = 'software';
        o = s.option(form.Flag, 'conntrack_flush_on_failover', _('mwan3 conntrack fix'),
            _('Install /etc/mwan3.user hook to flush dead flows on failover.'));
        o.default = '1'; o.rmempty = false;

        var s2 = m.section(form.TypedSection, 'pppoe_server', _('Low-Level Server Flags'));
        s2.anonymous = true;
        var o2;
        o2 = s2.option(form.Flag, 'randomsession', _('Randomize Sessions'), _('Randomize PPPoE session IDs (rarely needed).'));
        o2.default = '0'; o2.rmempty = false;
        o2 = s2.option(form.Value, 'optionsfile', _('Options File'), _('Path to pppd options file.'));
        o2.default = '/etc/ppp/pppoe-server-options';
        o2 = s2.option(form.Value, 'offset', _('Session Offset'), _('Starting offset for session IDs.'));
        o2.datatype = 'uinteger';
        o2 = s2.option(form.Value, 'unit', _('First Session Unit'), _('First pppX unit number assigned.'));
        o2.datatype = 'uinteger';
        o2 = s2.option(form.Flag, 'sync', _('Synchronous PPP'), _('Use synchronous PPP (rarely needed).'));
        o2.default = '0'; o2.rmempty = false;

        return m.render();
    }
};

// ============================================================
// HELP TAB
// ============================================================
var HelpTab = {
    render: function() {
        var details = function(title, content) {
            return E('details', {'style':'margin-bottom:15px;padding:10px;border:1px solid #444;border-radius:4px'}, [
                E('summary', {'style':'cursor:pointer;font-weight:bold;font-size:14px'}, title),
                E('div', {'style':'margin-top:10px'}, content)
            ]);
        };

        var table = function(rows) {
            return E('table', {'class':'table','style':'width:100%;font-size:12px'}, rows.map(function(r) {
                return E('tr', {}, r.map(function(c, i) {
                    return E(i === 0 ? 'th' : 'td', {'style': i === 0 ? 'text-align:left;padding:4px' : 'padding:4px'}, c);
                }));
            }));
        };

        var code = function(txt) { return E('code', {'style':'background:#222;padding:2px 4px;border-radius:3px;font-size:11px'}, txt); };
        var pre  = function(txt) { return E('pre', {'style':'background:#111;padding:10px;border-radius:4px;overflow-x:auto;font-size:11px;line-height:1.4'}, txt); };

        return E('div',{'class':'cbi-section'},[
            E('h2',_('PPPoE Server Manager — Help')),
            E('p',{'style':'color:#aaa'},_('Complete guide to running a PPPoE access concentrator on OpenWrt / ImmortalWrt.')),

            // ---------- OVERVIEW ----------
            details(_('📖 Overview — What This App Does'), [
                E('p',_('This app turns your OpenWrt / ImmortalWrt router into a PPPoE Access Concentrator — a small ISP. Clients (routers, PCs, IoT devices) dial in via PPPoE using username/password credentials, receive an IP address, and get internet access through your router.')),
                E('p',_('Under the hood it manages the Roaring Penguin PPPoE server (rp-pppoe-server) with an easy-to-use web interface.')),
                E('p',{'style':'margin-top:10px'},[
                    E('strong',{},_('What you get:')),
                    E('ul',{'style':'margin:5px 0 0 20px'},[
                        E('li',_('User management with per-account expiration dates')),
                        E('li',_('Live online session monitoring with force-disconnect')),
                        E('li',_('Automatic blocking of expired accounts (runs hourly)')),
                        E('li',_('One-click firewall setup with automatic backup/restore')),
                        E('li',_('Clean separation of basic and advanced settings'))
                    ])
                ])
            ]),

            // ---------- QUICK START ----------
            details(_('🚀 Quick Start — First-Time Setup'), [
                E('ol',{'style':'margin-left:20px;line-height:1.8'},[
                    E('li',{},[E('strong',{},_('Pick a separate subnet.')),' ', _('Use something like 192.168.12.0/24 — not your main LAN subnet.')]),
                    E('li',{},[E('strong',{},_('Create a network interface')),' ', _('for the PPPoE subnet (Network → Interfaces → Add new interface), e.g. br-pppoe or a VLAN.')]),
                    E('li',{},[E('strong',{},_('Open this app')),' ', _('and go to the General Settings tab.')]),
                    E('li',{},[E('strong',{},_('Select the interface')),' ', _('you created in step 2.')]),
                    E('li',{},[E('strong',{},_('Set Server IP')),' ', _('to the interface\'s IP (e.g. 192.168.12.1).')]),
                    E('li',{},[E('strong',{},_('Set First Client IP')),' ', _('to the first free IP in that subnet (e.g. 192.168.12.11).')]),
                    E('li',{},[E('strong',{},_('Click "Apply Firewall Setup"')),' ', _('at the bottom — this creates the firewall zone and enables masquerade.')]),
                    E('li',{},[E('strong',{},_('Go to Users Manager tab')),' ', _('and click Add User to create credentials.')]),
                    E('li',{},[E('strong',{},_('Come back to General Settings')),' ', _('and click Save & Apply to start the server.')]),
                    E('li',{},[E('strong',{},_('Connect a client')),' ', _('with the credentials you created — it should appear in Online Users.')])
                ])
            ]),

            // ---------- THE FIVE TABS ----------
            details(_('🗂️ The Five Tabs Explained'), [
                E('h4',{},_('General Settings')),
                E('p',_('Basic server configuration — interface, IP range, DNS, MTU/MSS, timeouts. Plus the Firewall Setup section at the bottom.')),
                E('h4',{},_('Users Manager')),
                E('p',_('Add, edit, and delete PPPoE accounts. Each account has a username, password, optional static IP, and expiration date. Expired accounts are automatically blocked.')),
                E('h4',{},_('Online Users')),
                E('p',_('Live list of connected clients — username, client IP, MAC address, server IP, session duration. The Force Offline button kills the client\'s session immediately. Auto-refreshes every 5 seconds.')),
                E('h4',{},_('Advanced')),
                E('p',_('Multi-WAN coordination (mwan3), flow offloading mode, conntrack fixes, and low-level PPPoE server flags. Most users never need to touch this.')),
                E('h4',{},_('Help')),
                E('p',_('You are here.'))
            ]),

            // ---------- SERVER CONFIGURATION ----------
            details(_('⚙️ Server Configuration — Every Field Explained'), [
                table([
                    [E('strong',{},_('Field')), E('strong',{},_('What it does'))],
                    [code('Enable Server'), _('Turns the PPPoE server on or off. Save & Apply restarts the service.')],
                    [code('Interface'), _('Which UCI interface the server listens on. Typically a bridge (br-lan, br-pppoe) or VLAN.')],
                    [code('AC Name'), _('Access Concentrator name — how clients identify your server. Cosmetic.')],
                    [code('Service Names'), _('Labels advertised to clients. Some clients filter by service name. Add at least one.')],
                    [code('Server IP'), _('The PPPoE server\'s own IP on the PPP link. Must be in a different subnet from your LAN.')],
                    [code('First Client IP'), _('First address of the pool handed out to clients. The server auto-increments from here.')],
                    [code('Max Sessions'), _('Maximum concurrent connected clients.')],
                    [code('Max Sessions per Peer'), _('Maximum sessions from one MAC address. Set to 1 to prevent double-logins.')],
                    [code('Primary DNS'), _('DNS server 1 pushed to clients. Default 8.8.8.8 (Google).')],
                    [code('Secondary DNS'), _('DNS server 2 pushed to clients. Default 1.1.1.1 (Cloudflare).')],
                    [code('MTU'), _('Maximum Transmission Unit. Standard for PPPoE: 1492.')],
                    [code('MRU'), _('Maximum Receive Unit. Standard for PPPoE: 1492.')],
                    [code('MSS (clamp)'), _('Maximum Segment Size — the largest TCP segment advertised. Standard: 1468.')],
                    [code('Idle Timeout (s)'), _('Disconnect clients idle for this many seconds. Set 0 to disable.')]
                ])
            ]),

            // ---------- FIREWALL DEEP DIVE ----------
            details(_('🛡️ Firewall Setup — What It Does and Why'), [
                E('p',_('PPPoE clients connect to your router, but they cannot reach the internet by default — the firewall blocks them.')),
                E('p',_('The "Apply Firewall Setup" button performs these changes automatically:')),
                pre('uci set firewall.pppoe=zone              # create a new zone\nuci set firewall.pppoe.name=\'pppoe\'        # name it "pppoe"\nuci set firewall.pppoe.input=\'ACCEPT\'      # allow client → router\nuci set firewall.pppoe.output=\'ACCEPT\'     # allow router → client\nuci set firewall.pppoe.forward=\'ACCEPT\'    # allow client → internet\nuci set firewall.pppoe.masq=\'1\'             # enable NAT/masquerade\nuci add_list firewall.pppoe.device=\'ppp+\'  # match all pppX interfaces\nuci add firewall forwarding                # add a forwarding rule\nuci set firewall.@forwarding[-1].src=\'pppoe\'\nuci set firewall.@forwarding[-1].dest=\'wan\'\nuci commit firewall\n/etc/init.d/firewall reload'),
                E('p',{'style':'margin-top:10px'},[E('strong',{},_('Safety features:')),]),
                E('ul',{'style':'margin:5px 0 0 20px'},[
                    E('li',_('Before any change, /etc/config/firewall is backed up to /etc/config/firewall.bak-ppoemanager-<timestamp>')),
                    E('li',_('"Show Preview" displays the exact commands before they run')),
                    E('li',_('"Restore from Backup" lists all backups and restores any one'))
                ])
            ]),

            // ---------- USERS ----------
            details(_('👥 Users Manager — How Accounts Work'), [
                E('p',_('Each PPPoE user is stored in two places:')),
                E('ul',{'style':'margin:5px 0 0 20px'},[
                    E('li',{},[code('/lib/ppp/ppp-users'),' — database with expiration: ',code('expiry|username|password|ip|id')]),
                    E('li',{},[code('/etc/ppp/chap-secrets'),' — credentials file read by the PPP daemon'])
                ]),
                E('h4',{'style':'margin-top:10px'},_('Expiration Enforcement')),
                E('p',_('The ppoemanager-checker script runs every hour (via cron). For each user whose expiration date has passed, it:')),
                E('ol',{'style':'margin-left:20px'},[
                    E('li',_('Prefixes the username with # in both files (blocking the account)')),
                    E('li',_('Kills any active PPP session for that user')),
                    E('li',_('Flushes conntrack entries so no packets slip through'))
                ]),
                E('p',_('To renew a user: just change the expiration date in the UI. The next hourly run will unblock the account automatically.')),
                E('h4',{'style':'margin-top:10px'},_('Static vs Auto IP')),
                E('p',_('Leave the Static IP field blank to let the server assign the next free IP from the pool. Enter a specific IP to pin the account to that address.'))
            ]),

            // ---------- ONLINE USERS ----------
            details(_('📊 Online Users — Live Session Monitoring'), [
                E('p',_('Shows every currently-connected PPPoE client with:')),
                E('ul',{'style':'margin:5px 0 0 20px'},[
                    E('li',_('Username — looked up from chap-secrets by client IP')),
                    E('li',_('Client IP — the peer address assigned via IPCP')),
                    E('li',_('MAC — the client\'s Ethernet address (from PPPoE session)')),
                    E('li',_('Server IP — your router\'s address on that session')),
                    E('li',_('Duration — how long the session has been up'))
                ]),
                E('h4',{'style':'margin-top:10px'},_('Force Offline')),
                E('p',_('Sends SIGKILL to the pppd process for that session. The client is disconnected immediately. Useful for kicking abusive clients or forcing re-authentication.'))
            ]),

            // ---------- ADVANCED ----------
            details(_('🔧 Advanced Settings — When to Touch Them'), [
                E('h4',{},_('Auto-manage mwan3')),
                E('p',_('MWAN3 and PPPoE server cannot coexist — mwan3 uses firewall marks (fwmark) that interfere with PPPoE encapsulation. When enabled, this option disables mwan3 while the PPPoE server runs, then re-enables it when you stop the server.')),
                E('h4',{},_('Auto-manage flow offloading')),
                E('p',_('Software flow offloading speeds up forwarding by bypassing the full netfilter chain. Safe with PPPoE, but only when mwan3 is off. Hardware flow offloading is fastest but incompatible with mwan3.')),
                E('h4',{},_('mwan3 conntrack fix')),
                E('p',_('Installs /etc/mwan3.user — a hook that flushes dead conntrack entries on mwan3 failover. Prevents hung connections when offloading is enabled.')),
                E('h4',{},_('Randomize Sessions')),
                E('p',_('Randomizes PPPoE session IDs. Rarely needed; leave off unless you have a specific reason.')),
                E('h4',{},_('Options File')),
                E('p',_('Path to the pppd options file. Default: /etc/ppp/pppoe-server-options. Advanced users can point this to a custom file.'))
            ]),

            // ---------- FILES ----------
            details(_('📁 Files & Locations — Complete Reference'), [
                table([
                    [E('strong',{},_('Path')), E('strong',{},_('Purpose'))],
                    [code('/etc/config/ppoemanager'), _('UCI server configuration')],
                    [code('/etc/ppp/pppoe-server-options'), _('pppd options file (options for the PPP daemon)')],
                    [code('/etc/ppp/chap-secrets'), _('User credentials (username password ip)')],
                    [code('/etc/ppp/options'), _('Global pppd options')],
                    [code('/lib/ppp/ppp-users'), _('User database with expiration dates')],
                    [code('/usr/bin/ppoemanager-checker'), _('Hourly expiration enforcement script')],
                    [code('/usr/bin/ppoemanager-control'), _('MWAN3 / offload coordination')],
                    [code('/etc/init.d/ppoemanager'), _('Service init script (procd)')],
                    [code('/etc/config/firewall'), _('Firewall (zone "pppoe" added by Setup)')],
                    [code('/www/luci-static/resources/view/ppoemanager/main.js'), _('LuCI JavaScript UI')],
                    [code('/usr/share/rpcd/ucode/ppoemanager.uc'), _('RPC backend')]
                ])
            ]),

            // ---------- COMMANDS ----------
            details(_('⌨️ Command Reference — Useful SSH Commands'), [
                E('h4',{},_('Service Control')),
                pre('/etc/init.d/ppoemanager start\n/etc/init.d/ppoemanager stop\n/etc/init.d/ppoemanager restart\n/etc/init.d/ppoemanager status'),
                E('h4',{},_('Run Expiration Checker Manually')),
                pre('/usr/bin/ppoemanager-checker'),
                E('h4',{},_('View Active Sessions')),
                pre('ps w | grep pppd | grep -v grep\nip -4 addr show | grep -A 1 ppp'),
                E('h4',{},_('Test the RPC Backend')),
                pre('ubus call luci.ppoemanager get_users\nubus call luci.ppoemanager get_online\nubus call luci.ppoemanager get_firewall_status'),
                E('h4',{},_('Force Disconnect All Sessions')),
                pre('killall -9 pppd'),
                E('h4',{},_('Watch Logs')),
                pre('logread -f | grep -iE \'pppoe|ppp|ppoemanager\'')
            ]),

            // ---------- TROUBLESHOOTING ----------
            details(_('🔍 Troubleshooting — Common Issues'), [
                E('h4',{},_('Menu doesn\'t appear after install')),
                pre('rm -f /tmp/luci-indexcache\n/etc/init.d/rpcd restart\n/etc/init.d/uhttpd restart'),
                E('p',_('Then hard-refresh the browser (Ctrl+Shift+R).')),

                E('h4',{},_('Clients connect but have no internet')),
                E('p',_('The firewall zone or masquerade is missing. Click "Apply Firewall Setup" in General Settings. Verify with:')),
                pre('uci show firewall | grep -A 5 pppoe'),

                E('h4',{},_('Clients receive 0.0.0.0 as default gateway')),
                E('p',_('The "defaultroute" option is missing from pppd options. Add it:')),
                pre('echo "defaultroute" >> /etc/ppp/pppoe-server-options\n/etc/init.d/ppoemanager restart'),

                E('h4',{},_('Online Users tab is empty')),
                E('p',_('The client just connected — wait up to 5 seconds for the next poll. If still empty, check the RPC:')),
                pre('ubus call luci.ppoemanager get_online'),

                E('h4',{},_('Service won\'t start')),
                pre('logread | grep ppoemanager | tail -30'),

                E('h4',{},_('Two users with same static IP')),
                E('p',_('They conflict. Only one can connect at a time. Edit each user and assign unique IPs.')),

                E('h4',{},_('Session drops every few minutes')),
                E('p',_('LCP echo timeout too aggressive. Edit /etc/ppp/pppoe-server-options:')),
                pre('lcp-echo-interval 20\nlcp-echo-failure 5'),
                E('p',_('Then restart the service.')),

                E('h4',{},_('Changes not taking effect')),
                E('p',_('Save & Apply restarts the service automatically. If not, run manually:')),
                pre('/etc/init.d/ppoemanager restart')
            ]),

            // ---------- GLOSSARY ----------
            details(_('📚 Glossary of Terms'), [
                table([
                    [E('strong',{},_('Term')), E('strong',{},_('Meaning'))],
                    [code('PPPoE'), _('Point-to-Point Protocol over Ethernet — how clients dial in')],
                    [code('PPP'), _('Point-to-Point Protocol — the underlying link protocol')],
                    [code('CHAP'), _('Challenge Handshake Authentication Protocol — how passwords are verified')],
                    [code('AC'), _('Access Concentrator — your router (server side)')],
                    [code('UCI'), _('Unified Configuration Interface — OpenWrt config system')],
                    [code('pppX'), _('A virtual PPP interface created per client session')],
                    [code('ppp+'), _('Wildcard matching all pppX interfaces')],
                    [code('mwan3'), _('Multi-WAN manager — load balancing and failover')],
                    [code('fwmark'), _('Firewall mark used for routing decisions')],
                    [code('conntrack'), _('Connection tracking — the kernel table of active flows')],
                    [code('masquerade'), _('NAT — rewrite source IPs so clients share your WAN')],
                    [code('MTU/MRU'), _('Maximum Transmission / Receive Unit — packet size limits')],
                    [code('MSS'), _('Maximum Segment Size — TCP packet size cap')],
                    [code('LCP echo'), _('Keep-alive ping between PPP peers')]
                ])
            ]),

            // ---------- CREDITS ----------
            details(_('🙏 Credits'), [
                E('p',_('Built on top of:')),
                E('ul',{'style':'margin:5px 0 0 20px'},[
                    E('li',_('rp-pppoe-server by David F. Skoll (Roaring Penguin)')),
                    E('li',_('Original pppoeuser package by Dan Mar Pascual (akosiramnad)')),
                    E('li',_('LuCI framework by the OpenWrt community'))
                ]),
                E('p',{'style':'margin-top:10px'},_('Maintained by Arafat Rahman Zami Mondol (@arafatrahmanzami).')),
                E('p',_('Report issues: github.com/arafatrahmanzami/luci-app-pppoe-manager/issues'))
            ])
        ]);
    }
};

// ============================================================
// CONFIG VALIDATION
// ============================================================
function validateConfig() {
    var warnings = [];
    try {
        var srv = uci.get('ppoemanager', 'server', 'localip');
        var pool = uci.get('ppoemanager', 'server', 'firstremoteip');
        var lanip = uci.get('network', 'lan', 'ipaddr') || '';
        if (srv && lanip && srv.split('.').slice(0,3).join('.') === lanip.split('.').slice(0,3).join('.')) {
            warnings.push('Server IP ' + srv + ' is on the same /24 as LAN ' + lanip + '. This may conflict.');
        }
        if (srv && pool && srv.split('.').slice(0,3).join('.') !== pool.split('.').slice(0,3).join('.')) {
            warnings.push('Server IP and First Client IP are on different subnets.');
        }
    } catch(e) {}
    return warnings;
}

// ============================================================
// MAIN VIEW
// ============================================================
return view.extend({
    load: function() {
        return Promise.all([callGetUsers(), callGetOnline(), callFwStatus(), uci.load('ppoemanager'), uci.load('network')]);
    },
    render: function(data) {
        var self = this;
        var fwStatus = data[2] || {};
        var warnings = validateConfig();

        var tabs = [
            { id: 'settings', name: _('General Settings'), render: function() { return SettingsTab.render(fwStatus); } },
            { id: 'users',    name: _('Users Manager'),    render: function() { return UsersTab.render(data); } },
            { id: 'online',   name: _('Online Users'),     render: function() { return OnlineTab.render(data); } },
            { id: 'advanced', name: _('Advanced'),         render: function() { return AdvancedTab.render(); } },
            { id: 'help',     name: _('Help'),             render: function() { return HelpTab.render(); } }
        ];

        var validTabs = tabs.map(function(t){ return t.id; });
        var currentTab = localStorage.getItem('ppoemanager_active_tab') || 'settings';
        if (validTabs.indexOf(currentTab) < 0) currentTab = 'settings';

        var container = E('div',{});

        function draw() {
            container.innerHTML = '';
            container.appendChild(E('h2',{'style':'margin-bottom:15px'},_('PPPoE Server Manager')));

            if (warnings.length) {
                warnings.forEach(function(w){
                    container.appendChild(E('div',{'class':'alert-message warning','style':'margin-bottom:10px'}, w));
                });
            }

            var tabbar = E('div',{'style':'margin-bottom:15px'});
            tabs.forEach(function(t){
                tabbar.appendChild(E('button',{
                    'class':'btn '+(currentTab===t.id?'cbi-button-positive':'cbi-button'),
                    'style':'margin-right:5px',
                    'click':function(){
                        currentTab=t.id;
                        localStorage.setItem('ppoemanager_active_tab', t.id);
                        draw();
                    }
                }, t.name));
            });
            container.appendChild(tabbar);
            container.appendChild(E('hr'));

            var content = tabs.find(function(t){ return t.id === currentTab; }).render();
            if (content instanceof Promise) {
                content.then(function(node){ container.appendChild(node); });
            } else {
                container.appendChild(content);
            }
        }
        draw();

        poll.add(L.bind(function(){
            return callGetOnline().then(function(nd){
                data[1] = nd;
                if (currentTab === 'online') draw();
            });
        }, this), 5);

        return container;
    }
});
