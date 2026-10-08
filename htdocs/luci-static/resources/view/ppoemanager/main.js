'use strict';
'require view';
'require dom';
'require poll';
'require uci';
'require rpc';
'require form';
'require ui';
'require tools.widgets as widgets';

var callGetUsers  = rpc.declare({ object: 'luci.ppoemanager', method: 'get_users',  expect: {} });
var callGetOnline = rpc.declare({ object: 'luci.ppoemanager', method: 'get_online', expect: {} });
var callAddUser   = rpc.declare({ object: 'luci.ppoemanager', method: 'add_user',   params: ['user','passwd','ipaddr','expiry'], expect: { result: true } });
var callEditUser  = rpc.declare({ object: 'luci.ppoemanager', method: 'edit_user',  params: ['olduser','user','passwd','ipaddr','expiry'], expect: { result: true } });
var callDelUser   = rpc.declare({ object: 'luci.ppoemanager', method: 'delete_user',params: ['user'], expect: { result: true } });
var callKill      = rpc.declare({ object: 'luci.ppoemanager', method: 'force_offline', params: ['pid'], expect: { result: true } });

function tsToDateStr(ts) { var d = new Date(parseInt(ts)*1000); return d.toISOString().slice(0,10); }
function fmtDuration(s) { s = parseInt(s); if (isNaN(s)||s<0) return '-'; var h=Math.floor(s/3600), m=Math.floor((s%3600)/60); return h+'h '+m+'m'; }

return view.extend({
    load: function() { return Promise.all([callGetUsers(), callGetOnline(), uci.load('ppoemanager')]); },

    handleAdd: function() {
        var user = document.getElementById('nu').value.trim();
        var pass = document.getElementById('np').value;
        var ip   = document.getElementById('ni').value.trim();
        var exp  = document.getElementById('ne').value;
        if (!user || !pass || !exp) { alert('Username, Password, Expiration required'); return; }
        var expTs = Math.floor(new Date(exp).getTime()/1000);
        if (expTs <= Math.floor(Date.now()/1000)) { alert('Expiration must be in the future'); return; }
        callAddUser(user, pass, ip || '*', expTs.toString()).then(function(){ location.reload(); });
    },

    showAdd: function() {
        ui.showModal(_('Add PPPoE User'), [
            E('div',{'class':'left','style':'display:flex;flex-direction:column;gap:8px;padding:10px'},[
                E('label',{},[_('Username: '),E('input',{id:'nu','class':'cbi-input-text',style:'width:250px'})]),
                E('label',{},[_('Password: '),E('input',{id:'np','class':'cbi-input-text',style:'width:250px'})]),
                E('label',{},[_('Static IP (blank=auto): '),E('input',{id:'ni','class':'cbi-input-text',style:'width:250px',placeholder:'e.g. 192.168.11.15'})]),
                E('label',{},[_('Expiration: '),E('input',{id:'ne',type:'date','class':'cbi-input-text',style:'width:250px'})])
            ]),
            E('div',{'class':'right'},[
                E('button',{'class':'btn','click':ui.hideModal},_('Cancel')),' ',
                E('button',{'class':'btn cbi-button-positive important','click':L.bind(this.handleAdd,this)},_('Add'))
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
    },

    handleKill: function(pid, cip) {
        if (!confirm('Force disconnect '+cip+' (PID '+pid+')?')) return;
        callKill(pid).then(function(){ setTimeout(function(){ location.reload(); }, 800); });
    },

    renderUsers: function(data) {
        var users = (data[0] && Array.isArray(data[0].accounts)) ? data[0].accounts : [];
        var rows = users.map(function(u,i){
            var now = Math.floor(Date.now()/1000);
            var expired = now > parseInt(u.expiry);
            var clean = u.user.replace(/^#/,'');
            var status = expired ? 'Expired' : 'Active';
            var color = expired ? 'red' : 'green';
            return [
                i+1, tsToDateStr(u.expiry), clean, u.password, u.ipaddr,
                E('span',{style:'color:'+color+';font-weight:bold'},status),
                E('div',{'class':'center'},[
                    E('button',{'class':'btn cbi-button-edit','click':L.bind(this.showEdit,this,clean,u.password,u.ipaddr,u.expiry)},_('Edit')),' ',
                    E('button',{'class':'btn cbi-button-remove important','click':L.bind(this.handleDelete,this,clean)},_('Delete'))
                ])
            ];
        }.bind(this));
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
            E('button',{'class':'btn cbi-button-positive important','click':L.bind(this.showAdd,this)},_('Add User')),
            E('p'),table
        ]);
    },

    renderOnline: function(data) {
        var sess = (data[1] && Array.isArray(data[1].sessions)) ? data[1].sessions : [];
        var rows = sess.map(function(s,i){
            return [
                i+1, s.username||'?', s.cip, s.mac, s.gateway, fmtDuration(s.duration),
                E('button',{'class':'btn cbi-button-negative important','click':L.bind(this.handleKill,this,s.pid,s.cip)},_('Force Offline'))
            ];
        }.bind(this));
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
        cbi_update_table(table, rows, E('em',_('No active sessions.')));
        return E('div',{'class':'cbi-section'},[E('h3',_('Online Users')),table]);
    },

    renderSettings: function() {
        var m = new form.Map('ppoemanager', _('PPPoE Server Settings'));
        var s = m.section(form.TypedSection,'pppoe_server',_('Server Configuration'));
        s.anonymous = true; s.addremove = false;
        var o;
        o = s.option(form.Flag,'enabled',_('Enable'),_('Enable the PPPoE server')); o.rmempty = false;
        o = s.option(widgets.NetworkSelect,'interface',_('Interface'),_('Listen on this interface')); o.nocreate = true; o.unspecified = true;
        o = s.option(form.Value,'ac_name',_('AC Name'));
        o = s.option(form.DynamicList,'service_name',_('Service Names'));
        o = s.option(form.Value,'localip',_('Server IP')); o.datatype='ipaddr';
        o = s.option(form.Value,'firstremoteip',_('First Client IP')); o.datatype='ipaddr';
        o = s.option(form.Value,'maxsessions',_('Max Sessions')); o.datatype='uinteger'; o.default='32';
        o = s.option(form.Value,'maxsessionsperpeer',_('Max Sessions per Peer')); o.datatype='uinteger'; o.default='1';
        o = s.option(form.Value,'mss',_('MSS')); o.datatype='uinteger'; o.default='1468';
        o = s.option(form.Value,'timeout',_('Timeout (s)')); o.datatype='uinteger'; o.default='60';
        o = s.option(form.Value,'optionsfile',_('Options File')); o.default='/etc/ppp/pppoe-server-options';
        o = s.option(form.Flag,'randomsession',_('Randomize Sessions')); o.default='0';

        s = m.section(form.TypedSection, 'coordination', _('Advanced Coordination'));
        s.anonymous = true;
        o = s.option(form.Flag, 'manage_mwan3', _('Auto-manage mwan3'),
            _('Automatically disable mwan3 when PPPoE server is active, and re-enable it when stopped.'));
        o.default = '1'; o.rmempty = false;
        o = s.option(form.Flag, 'manage_offloading', _('Auto-manage flow offloading'),
            _('Disable hardware/software offloading when mwan3 is active to prevent routing conflicts.'));
        o.default = '1'; o.rmempty = false;
        o = s.option(form.ListValue, 'offload_mode', _('Preferred offload mode'),
            _('Software offloading is safe with mwan3 failover (with conntrack fix). Hardware offloading is incompatible with mwan3.'));
        o.value('software', _('Software (recommended)'));
        o.value('hardware', _('Hardware (fastest, but no mwan3 failover)'));
        o.value('auto', _('Auto (try hardware, fall back to software)'));
        o.default = 'software'; o.rmempty = false;
        o = s.option(form.Flag, 'conntrack_flush_on_failover', _('Install mwan3 conntrack fix'),
            _('Adds a hook to flush dead flows on failover, preventing hung connections when offloading is enabled.'));
        o.default = '1'; o.rmempty = false;

        return m.render();
    },

    render: function(data) {
        var self = this;
        var tabs = [
            { id:'users',    name:_('Users Manager') },
            { id:'online',   name:_('Online Users') },
            { id:'settings', name:_('General Settings') }
        ];
        var currentTab = 'users';
        var container = E('div',{});

        function draw() {
            container.innerHTML = '';
            tabs.forEach(function(t){
                container.appendChild(E('button',{
                    'class':'btn '+(currentTab===t.id?'cbi-button-positive':'cbi-button'),
                    'style':'margin-right:5px',
                    'click':function(){ currentTab=t.id; draw(); }
                }, t.name));
            });
            container.appendChild(E('hr'));
            if (currentTab==='users')    container.appendChild(self.renderUsers(data));
            if (currentTab==='online')   container.appendChild(self.renderOnline(data));
            if (currentTab==='settings') self.renderSettings().then(function(node){ container.appendChild(node); });
        }

        draw();

        poll.add(L.bind(function(){
            return callGetOnline().then(function(nd){
                if (currentTab === 'online') { data[1] = nd; draw(); }
            });
        }, this), 10);

        return container;
    }
});
