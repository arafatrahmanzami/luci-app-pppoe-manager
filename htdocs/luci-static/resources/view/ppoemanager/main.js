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
            E('button',{'class':'btn cbi-button-positive','style':'margin-left:10px','click':function(){window.location.reload();}},_('Refresh')),
            E('p'),table
        ]);
    }
};

var SettingsTab = {
    render: function(fwStatus) {
        var m = new form.Map('ppoemanager', _('PPPoE Server Manager'),
            _('Configure the PPPoE access concentrator. All settings are stored in /etc/config/ppoemanager.'));

        var s = m.section(form.TypedSection, 'pppoe_server', _('Server Configuration'));
        s.anonymous = true; s.addremove = false;
        var o;

        o = s.option(form.Flag, 'enabled', _('Enable Server'), _('Turn the PPPoE server on or off. Save & Apply restarts the service.'));
        o.rmempty = false;

        o = s.option(widgets.NetworkSelect, 'interface', _('Interface'), _('UCI interface to listen on.'));
        o.nocreate = true; o.unspecified = true; o.rmempty = false;

        o = s.option(form.Value, 'ac_name', _('AC Name'), _('Access Concentrator name advertised to clients.'));
        o = s.option(form.DynamicList, 'service_name', _('Service Names'), _('Service names advertised to clients.'));
        o = s.option(form.Value, 'localip', _('Server IP'), _('PPPoE server\'s own IP on the PPP link.'));
        o.datatype = 'ipaddr';
        o = s.option(form.Value, 'firstremoteip', _('First Client IP'), _('First IP handed out to clients.'));
        o.datatype = 'ipaddr';
        o = s.option(form.Value, 'maxsessions', _('Max Sessions'), _('Maximum concurrent clients.'));
        o.datatype = 'uinteger'; o.default = '32';
        o = s.option(form.Value, 'maxsessionsperpeer', _('Max Sessions per Peer'), _('Per-MAC limit.'));
        o.datatype = 'uinteger'; o.default = '1';
        o = s.option(form.Value, 'dns1', _('Primary DNS'), _('DNS 1 handed to clients.'));
        o.datatype = 'ipaddr'; o.default = '8.8.8.8';
        o = s.option(form.Value, 'dns2', _('Secondary DNS'), _('DNS 2 handed to clients.'));
        o.datatype = 'ipaddr'; o.default = '1.1.1.1';
        o = s.option(form.Value, 'mtu', _('MTU'), _('Standard for PPPoE: 1492.'));
        o.datatype = 'uinteger'; o.default = '1492';
        o = s.option(form.Value, 'mru', _('MRU'), _('Standard for PPPoE: 1492.'));
        o.datatype = 'uinteger'; o.default = '1492';
        o = s.option(form.Value, 'mss', _('MSS (clamp)'), _('Standard for PPPoE: 1468.'));
        o.datatype = 'uinteger'; o.default = '1468';
        o = s.option(form.Value, 'timeout', _('Idle Timeout (s)'), _('Disconnect idle clients after N seconds.'));
        o.datatype = 'uinteger'; o.default = '60';

        return m.render().then(function(node) {
            var fwBlock = E('div', {'class': 'cbi-section'}, [
                E('h3', _('Firewall Setup')),
                E('p', _('PPPoE clients cannot reach the internet without a firewall zone and masquerade rule. This setup is required once.')),
                E('p', _('Click "Show Preview" to see the exact commands. A backup of /etc/config/firewall is created automatically before any change.')),
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

var AdvancedTab = {
    render: function() {
        var m = new form.Map('ppoemanager', _('Advanced Settings'),
            _('These options require understanding of mwan3 and firewall flow offloading. Change with caution.'));

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
        o2 = s2.option(form.Flag, 'randomsession', _('Randomize Sessions'), _('Randomize the PPPoE session IDs (rarely needed).'));
        o2.default = '0'; o2.rmempty = false;
        o2 = s2.option(form.Value, 'optionsfile', _('Options File'), _('Path to pppd options file.'));
        o2.default = '/etc/ppp/pppoe-server-options';
        o2 = s2.option(form.Value, 'offset', _('Session Offset'), _('Starting offset for session IDs.'));
        o2.datatype = 'uinteger';
        o2 = s2.option(form.Value, 'unit', _('First Session Unit'), _('First pppX unit number.'));
        o2.datatype = 'uinteger';
        o2 = s2.option(form.Flag, 'sync', _('Synchronous PPP'), _('Use synchronous PPP (rarely needed).'));
        o2.default = '0'; o2.rmempty = false;

        return m.render();
    }
};

var HelpTab = {
    render: function() {
        return E('div',{'class':'cbi-section'},[
            E('h3',_('Help & Documentation')),
            E('p',_('PPPoE Server Manager runs a PPPoE access concentrator on your router, allowing clients to dial in with PPPoE credentials.')),

            E('h4',_('Quick Start')),
            E('ol',{},[
                E('li',_('Set Server IP and First Client IP on a subnet different from your LAN.')),
                E('li',_('Click "Apply Firewall Setup" at the bottom of General Settings.')),
                E('li',_('Add users in the Users Manager tab.')),
                E('li',_('Enable the server, then Save & Apply.')),
                E('li',_('Connect clients with the credentials; they appear in Online Users.'))
            ]),

            E('h4',_('Firewall Setup Explained')),
            E('p',_('The "Apply Firewall Setup" button creates a firewall zone named "pppoe" for all ppp+ interfaces, enables masquerade (NAT) so clients share your WAN, and adds a forwarding rule pppoe→wan.')),
            E('ul',{},[
                E('li',_('Click "Show Preview" to see the exact commands before applying.')),
                E('li',_('Every time you apply, a backup of /etc/config/firewall is saved as /etc/config/firewall.bak-ppoemanager-<timestamp>.')),
                E('li',_('Click "Restore from Backup" to roll back to any previous snapshot.'))
            ]),

            E('h4',_('Files & Locations')),
            E('table',{'class':'table'},[
                E('tr',{},[E('th',_('Path')),E('th',_('Purpose'))]),
                E('tr',{},[E('td',{},'/etc/config/ppoemanager'),E('td',_('Server config (UCI)'))]),
                E('tr',{},[E('td',{},'/etc/ppp/pppoe-server-options'),E('td',_('pppd options'))]),
                E('tr',{},[E('td',{},'/etc/ppp/chap-secrets'),E('td',_('User credentials'))]),
                E('tr',{},[E('td',{},'/lib/ppp/ppp-users'),E('td',_('User database with expiry'))]),
                E('tr',{},[E('td',{},'/usr/bin/ppoemanager-checker'),E('td',_('Expiry enforcement'))]),
                E('tr',{},[E('td',{},'/etc/init.d/ppoemanager'),E('td',_('Init script'))]),
                E('tr',{},[E('td',{},'/etc/config/firewall'),E('td',_('Firewall (zone "pppoe" added by Setup)'))])
            ]),

            E('h4',_('Troubleshooting')),
            E('ul',{},[
                E('li',_('Clients get 0.0.0.0 gateway → add "defaultroute" to /etc/ppp/pppoe-server-options')),
                E('li',_('No internet → click "Apply Firewall Setup" in General Settings')),
                E('li',_('Online Users empty → check /etc/init.d/ppoemanager status')),
                E('li',_('Changes not applied → Save & Apply restarts the service automatically')),
                E('li',_('Two users with same static IP → they conflict; assign unique IPs'))
            ])
        ]);
    }
};

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
