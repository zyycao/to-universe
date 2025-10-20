const { useState, useEffect } = React;
const API_BASE_URL = window.location.origin + '/api';

const XUIManager = () => {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [servers, setServers] = useState([]);
  const [showAddServer, setShowAddServer] = useState(false);
  const [serverStatus, setServerStatus] = useState({});
  const [inbounds, setInbounds] = useState({});
  const [loading, setLoading] = useState({});
  const [activeTab, setActiveTab] = useState('dashboard');
  const [newServer, setNewServer] = useState({
    name: '', host: '', port: '', username: '', password: '', webBasePath: ''
  });
  const [showInboundModal, setShowInboundModal] = useState(false);
  const [editingInbound, setEditingInbound] = useState(null);
  const [currentServerId, setCurrentServerId] = useState(null);
  const [inboundForm, setInboundForm] = useState({
    remark: '',
    protocol: 'vmess',
    port: '',
    enable: true,
    settings: '',
    streamSettings: '',
    sniffing: '{"enabled":true,"destOverride":["http","tls"]}'
  });

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await response.json();
      if (data.success) {
        localStorage.setItem('token', data.token);
        setToken(data.token);
        fetchServers(data.token);
      } else {
        alert(data.msg || '登录失败');
      }
    } catch (error) {
      alert('登录失败: ' + error.message);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setServers([]);
    setServerStatus({});
    setInbounds({});
  };

  const fetchServers = async (authToken = token) => {
    try {
      const response = await fetch(`${API_BASE_URL}/servers`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      const data = await response.json();
      if (data.success) setServers(data.data);
    } catch (error) {
      console.error('获取服务器列表失败:', error);
    }
  };

  const addServer = async () => {
    if (!newServer.name || !newServer.host || !newServer.port) {
      alert('请填写必填字段');
      return;
    }
    try {
      const response = await fetch(`${API_BASE_URL}/servers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newServer)
      });
      const data = await response.json();
      if (data.success) {
        fetchServers();
        setNewServer({ name: '', host: '', port: '', username: '', password: '', webBasePath: '' });
        setShowAddServer(false);
      } else {
        alert(data.msg || '添加失败');
      }
    } catch (error) {
      alert('添加服务器失败: ' + error.message);
    }
  };

  const deleteServer = async (id) => {
    if (!window.confirm('确定要删除这台服务器吗？')) return;
    try {
      const response = await fetch(`${API_BASE_URL}/servers/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        fetchServers();
        const newStatus = { ...serverStatus };
        delete newStatus[id];
        setServerStatus(newStatus);
      }
    } catch (error) {
      alert('删除服务器失败: ' + error.message);
    }
  };

  const fetchServerStatus = async (serverId) => {
    setLoading(prev => ({ ...prev, [serverId]: true }));
    try {
      const response = await fetch(`${API_BASE_URL}/xui/server/${serverId}/status`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success && data.data.obj) {
        setServerStatus(prev => ({
          ...prev,
          [serverId]: { online: true, ...data.data.obj }
        }));
      } else {
        setServerStatus(prev => ({ ...prev, [serverId]: { online: false } }));
      }
    } catch (error) {
      console.error('获取服务器状态失败:', error);
      setServerStatus(prev => ({ ...prev, [serverId]: { online: false } }));
    } finally {
      setLoading(prev => ({ ...prev, [serverId]: false }));
    }
  };

  const fetchInbounds = async (serverId) => {
    setLoading(prev => ({ ...prev, [`inbound_${serverId}`]: true }));
    try {
      const response = await fetch(`${API_BASE_URL}/xui/server/${serverId}/inbounds`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success && data.data.obj) {
        setInbounds(prev => ({ ...prev, [serverId]: data.data.obj }));
      }
    } catch (error) {
      console.error('获取入站配置失败:', error);
      alert('获取入站配置失败: ' + error.message);
    } finally {
      setLoading(prev => ({ ...prev, [`inbound_${serverId}`]: false }));
    }
  };

  const openAddInbound = (serverId) => {
    setCurrentServerId(serverId);
    setEditingInbound(null);
    setInboundForm({
      remark: '',
      protocol: 'vmess',
      port: '',
      enable: true,
      settings: JSON.stringify({
        clients: [{
          id: generateUUID(),
          alterId: 0
        }],
        disableInsecure: false
      }, null, 2),
      streamSettings: JSON.stringify({
        network: 'tcp',
        security: 'none'
      }, null, 2),
      sniffing: JSON.stringify({
        enabled: true,
        destOverride: ['http', 'tls']
      }, null, 2)
    });
    setShowInboundModal(true);
  };

  const openEditInbound = (serverId, inbound) => {
    setCurrentServerId(serverId);
    setEditingInbound(inbound);
    setInboundForm({
      remark: inbound.remark || '',
      protocol: inbound.protocol || 'vmess',
      port: inbound.port || '',
      enable: inbound.enable,
      settings: inbound.settings || '{}',
      streamSettings: inbound.streamSettings || '{}',
      sniffing: inbound.sniffing || '{}'
    });
    setShowInboundModal(true);
  };

  const generateUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };

  const saveInbound = async () => {
    if (!inboundForm.remark || !inboundForm.port) {
      alert('请填写备注和端口');
      return;
    }

    try {
      const url = editingInbound
        ? `${API_BASE_URL}/xui/server/${currentServerId}/inbounds/${editingInbound.id}`
        : `${API_BASE_URL}/xui/server/${currentServerId}/inbounds`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          remark: inboundForm.remark,
          enable: inboundForm.enable,
          port: parseInt(inboundForm.port),
          protocol: inboundForm.protocol,
          settings: inboundForm.settings,
          streamSettings: inboundForm.streamSettings,
          sniffing: inboundForm.sniffing,
          up: editingInbound?.up || 0,
          down: editingInbound?.down || 0,
          total: editingInbound?.total || 0,
          expiryTime: editingInbound?.expiryTime || 0
        })
      });

      const data = await response.json();
      if (data.success) {
        alert(editingInbound ? '修改成功' : '添加成功');
        setShowInboundModal(false);
        fetchInbounds(currentServerId);
      } else {
        alert(data.msg || '操作失败');
      }
    } catch (error) {
      alert('操作失败: ' + error.message);
    }
  };

  const deleteInbound = async (serverId, inboundId) => {
    if (!window.confirm('确定要删除这个入站配置吗？')) return;

    try {
      const response = await fetch(`${API_BASE_URL}/xui/server/${serverId}/inbounds/del/${inboundId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        alert('删除成功');
        fetchInbounds(serverId);
      } else {
        alert(data.msg || '删除失败');
      }
    } catch (error) {
      alert('删除失败: ' + error.message);
    }
  };

  const refreshAll = async () => {
    try {
      const statusResponse = await fetch(`${API_BASE_URL}/xui/all-servers/status`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const statusData = await statusResponse.json();
      if (statusData.success) {
        const newStatus = {};
        statusData.data.forEach(item => {
          newStatus[item.serverId] = item.success && item.data.obj ? 
            { online: true, ...item.data.obj } : { online: false };
        });
        setServerStatus(newStatus);
      }
      const inboundsResponse = await fetch(`${API_BASE_URL}/xui/all-servers/inbounds`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const inboundsData = await inboundsResponse.json();
      if (inboundsData.success) {
        const newInbounds = {};
        inboundsData.data.forEach(item => {
          if (item.success && item.data.obj) newInbounds[item.serverId] = item.data.obj;
        });
        setInbounds(newInbounds);
      }
    } catch (error) {
      console.error('批量刷新失败:', error);
    }
  };

  useEffect(() => {
    if (token) fetchServers();
  }, [token]);

  const formatBytes = (bytes) => {
    if (!bytes || isNaN(bytes)) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const formatUptime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0天 0小时';
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    return `${days}天 ${hours}小时`;
  };

  const safeNumber = (val) => {
    const num = parseFloat(val);
    return isNaN(num) ? 0 : num;
  };

  if (!token) {
    return React.createElement('div', { className: "min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center" },
      React.createElement('div', { className: "bg-white rounded-lg shadow-xl p-8 w-full max-w-md" },
        React.createElement('div', { className: "flex items-center justify-center mb-8" },
          React.createElement('svg', { className: "w-12 h-12 text-blue-600 mr-3", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24" },
            React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" })
          ),
          React.createElement('h1', { className: "text-2xl font-bold text-gray-900" }, 'X-UI 管理面板')
        ),
        React.createElement('form', { onSubmit: handleLogin, className: "space-y-4" },
          React.createElement('div', null,
            React.createElement('label', { className: "block text-sm font-medium text-gray-700 mb-1" }, '用户名'),
            React.createElement('input', {
              type: "text", value: username,
              onChange: (e) => setUsername(e.target.value),
              className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500",
              placeholder: "请输入用户名", required: true
            })
          ),
          React.createElement('div', null,
            React.createElement('label', { className: "block text-sm font-medium text-gray-700 mb-1" }, '密码'),
            React.createElement('input', {
              type: "password", value: password,
              onChange: (e) => setPassword(e.target.value),
              className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500",
              placeholder: "请输入密码", required: true
            })
          ),
          React.createElement('button', {
            type: "submit",
            className: "w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          }, '登录')
        ),
        React.createElement('p', { className: "text-xs text-gray-500 text-center mt-4" }, '默认账号: admin / admin123')
      )
    );
  }

  const ServerCard = ({ server }) => {
    const status = serverStatus[server.id];
    return React.createElement('div', { className: "bg-white rounded-lg shadow-md p-6" },
      React.createElement('div', { className: "flex justify-between items-start mb-4" },
        React.createElement('div', null,
          React.createElement('h3', { className: "text-lg font-semibold text-gray-900" }, server.name),
          React.createElement('p', { className: "text-sm text-gray-500" }, `${server.host}:${server.port}`)
        ),
        React.createElement('div', {
          className: `px-2 py-1 rounded-full text-xs font-medium ${status?.online ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`
        }, status?.online ? '在线' : '未知')
      ),
      status?.online ? React.createElement('div', { className: "space-y-3" },
        [{ k: 'cpu', l: 'CPU', c: 'blue' }, { k: 'mem', l: '内存', c: 'green' }, { k: 'disk', l: '磁盘', c: 'yellow' }].map(({ k, l, c }) =>
          React.createElement('div', { key: k },
            React.createElement('div', { className: "flex items-center justify-between" },
              React.createElement('span', { className: "text-sm text-gray-600" }, l),
              React.createElement('span', { className: "text-sm font-medium" }, `${safeNumber(status[k]).toFixed(1)}%`)
            ),
            React.createElement('div', { className: "w-full bg-gray-200 rounded-full h-2" },
              React.createElement('div', {
                className: `h-2 rounded-full bg-${c}-600`,
                style: { width: `${safeNumber(status[k])}%` }
              })
            )
          )
        ),
        React.createElement('div', { className: "pt-3 border-t text-sm space-y-1" },
          React.createElement('div', { className: "flex justify-between" },
            React.createElement('span', { className: "text-gray-600" }, '运行时间'),
            React.createElement('span', { className: "font-medium" }, formatUptime(status.uptime))
          ),
          React.createElement('div', { className: "flex justify-between" },
            React.createElement('span', { className: "text-gray-600" }, '上传'),
            React.createElement('span', { className: "font-medium text-green-600" }, `${formatBytes(status.netIO?.up)}/s`)
          ),
          React.createElement('div', { className: "flex justify-between" },
            React.createElement('span', { className: "text-gray-600" }, '下载'),
            React.createElement('span', { className: "font-medium text-blue-600" }, `${formatBytes(status.netIO?.down)}/s`)
          )
        )
      ) : React.createElement('div', { className: "text-center py-8" },
        React.createElement('button', {
          onClick: () => fetchServerStatus(server.id),
          disabled: loading[server.id],
          className: "px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
        }, loading[server.id] ? '加载中...' : '获取状态')
      )
    );
  };

  return React.createElement('div', { className: "min-h-screen bg-gray-50" },
    React.createElement('div', { className: "bg-white shadow" },
      React.createElement('div', { className: "max-w-7xl mx-auto px-4 py-4" },
        React.createElement('div', { className: "flex justify-between items-center" },
          React.createElement('h1', { className: "text-2xl font-bold text-gray-900" }, 'X-UI 统一管理面板'),
          React.createElement('div', { className: "flex space-x-2" },
            ['刷新全部', '添加服务器', '登出'].map((t, i) =>
              React.createElement('button', {
                key: t,
                onClick: i === 0 ? refreshAll : i === 1 ? () => setShowAddServer(true) : handleLogout,
                className: `px-4 py-2 rounded-lg text-white ${i === 0 ? 'bg-blue-600 hover:bg-blue-700' : i === 1 ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`
              }, t)
            )
          )
        )
      )
    ),
    React.createElement('div', { className: "max-w-7xl mx-auto px-4 mt-6" },
      React.createElement('nav', { className: "flex space-x-8 border-b" },
        [['dashboard', '服务器状态'], ['inbounds', '入站配置'], ['servers', '服务器管理']].map(([k, l]) =>
          React.createElement('button', {
            key: k,
            onClick: () => setActiveTab(k),
            className: `py-4 px-1 border-b-2 text-sm font-medium ${activeTab === k ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500'}`
          }, l)
        )
      )
    ),
    React.createElement('div', { className: "max-w-7xl mx-auto px-4 py-8" },
      activeTab === 'dashboard' && React.createElement('div', { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" },
        servers.map(s => React.createElement(ServerCard, { key: s.id, server: s })),
        servers.length === 0 && React.createElement('div', { className: "col-span-full text-center py-12" },
          React.createElement('p', { className: "text-gray-500 mb-4" }, '还没有添加服务器'),
          React.createElement('button', {
            onClick: () => setShowAddServer(true),
            className: "px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          }, '添加第一台服务器')
        )
      ),
      activeTab === 'inbounds' && React.createElement('div', { className: "space-y-6" },
        servers.map(server => {
          const serverInbounds = inbounds[server.id] || [];
          const isLoading = loading[`inbound_${server.id}`];
          return React.createElement('div', { key: server.id, className: "bg-white rounded-lg shadow-md overflow-hidden" },
            React.createElement('div', { className: "bg-gray-50 px-6 py-4 border-b" },
              React.createElement('div', { className: "flex justify-between items-center" },
                React.createElement('h3', { className: "text-lg font-semibold text-gray-900" }, server.name),
                React.createElement('div', { className: "flex space-x-2" },
                  React.createElement('button', {
                    onClick: () => openAddInbound(server.id),
                    className: "px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                  }, '添加入站'),
                  React.createElement('button', {
                    onClick: () => fetchInbounds(server.id),
                    disabled: isLoading,
                    className: "text-sm text-blue-600 hover:text-blue-700 disabled:text-gray-400"
                  }, isLoading ? '加载中...' : '刷新')
                )
              )
            ),
            serverInbounds.length > 0 ? React.createElement('div', { className: "overflow-x-auto" },
              React.createElement('table', { className: "min-w-full divide-y divide-gray-200" },
                React.createElement('thead', { className: "bg-gray-50" },
                  React.createElement('tr', null,
                    ['备注', '协议', '端口', '状态', '上传', '下载', '操作'].map(h =>
                      React.createElement('th', { key: h, className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase" }, h)
                    )
                  )
                ),
                React.createElement('tbody', { className: "bg-white divide-y divide-gray-200" },
                  serverInbounds.map(inbound =>
                    React.createElement('tr', { key: inbound.id },
                      React.createElement('td', { className: "px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900" }, inbound.remark || '-'),
                      React.createElement('td', { className: "px-6 py-4 whitespace-nowrap text-sm" },
                        React.createElement('span', { className: "px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium" }, inbound.protocol)
                      ),
                      React.createElement('td', { className: "px-6 py-4 whitespace-nowrap text-sm text-gray-500" }, inbound.port),
                      React.createElement('td', { className: "px-6 py-4 whitespace-nowrap" },
                        React.createElement('span', {
                          className: `px-2 py-1 rounded text-xs font-medium ${inbound.enable ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`
                        }, inbound.enable ? '启用' : '禁用')
                      ),
                      React.createElement('td', { className: "px-6 py-4 whitespace-nowrap text-sm text-gray-500" }, formatBytes(inbound.up)),
                      React.createElement('td', { className: "px-6 py-4 whitespace-nowrap text-sm text-gray-500" }, formatBytes(inbound.down)),
                      React.createElement('td', { className: "px-6 py-4 whitespace-nowrap text-sm space-x-2" },
                        React.createElement('button', {
                          onClick: () => openEditInbound(server.id, inbound),
                          className: "text-blue-600 hover:text-blue-900"
                        }, '编辑'),
                        React.createElement('button', {
                          onClick: () => deleteInbound(server.id, inbound.id),
                          className: "text-red-600 hover:text-red-900"
                        }, '删除')
                      )
                    )
                  )
                )
              )
            ) : React.createElement('div', { className: "text-center py-8" },
              React.createElement('button', {
                onClick: () => fetchInbounds(server.id),
                disabled: isLoading,
                className: "px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
              }, isLoading ? '加载中...' : '加载入站配置')
            )
          );
        }),
        servers.length === 0 && React.createElement('div', { className: "text-center py-12 bg-white rounded-lg shadow-md" },
          React.createElement('p', { className: "text-gray-500" }, '请先添加服务器')
        )
      ),
      activeTab === 'servers' && React.createElement('div', { className: "bg-white rounded-lg shadow-md overflow-hidden" },
        React.createElement('table', { className: "min-w-full divide-y divide-gray-200" },
          React.createElement('thead', { className: "bg-gray-50" },
            React.createElement('tr', null,
              ['名称', '地址', '端口', '用户名', '操作'].map(h =>
                React.createElement('th', { key: h, className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase" }, h)
              )
            )
          ),
          React.createElement('tbody', { className: "bg-white divide-y divide-gray-200" },
            servers.map(server =>
              React.createElement('tr', { key: server.id },
                React.createElement('td', { className: "px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900" }, server.name),
                React.createElement('td', { className: "px-6 py-4 whitespace-nowrap text-sm text-gray-500" }, server.host),
                React.createElement('td', { className: "px-6 py-4 whitespace-nowrap text-sm text-gray-500" }, server.port),
                React.createElement('td', { className: "px-6 py-4 whitespace-nowrap text-sm text-gray-500" }, server.username),
                React.createElement('td', { className: "px-6 py-4 whitespace-nowrap text-sm space-x-2" },
                  React.createElement('button', {
                    onClick: () => window.open(`http://${server.host}:${server.port}${server.web_base_path || ''}`, '_blank'),
                    className: "text-blue-600 hover:text-blue-900"
                  }, '打开面板'),
                  React.createElement('button', {
                    onClick: () => deleteServer(server.id),
                    className: "text-red-600 hover:text-red-900"
                  }, '删除')
                )
              )
            )
          )
        ),
        servers.length === 0 && React.createElement('div', { className: "text-center py-12" },
          React.createElement('p', { className: "text-gray-500" }, '还没有添加服务器')
        )
      )
    ),
    showAddServer && React.createElement('div', { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" },
      React.createElement('div', { className: "bg-white rounded-lg shadow-xl p-6 w-full max-w-md" },
        React.createElement('h2', { className: "text-xl font-bold mb-4" }, '添加服务器'),
        React.createElement('div', { className: "space-y-4" },
          [
            ['服务器名称', 'name', '例如: 美国服务器-1'],
            ['服务器IP/域名', 'host', '例如: 192.168.1.100'],
            ['端口', 'port', '例如: 54321'],
            ['用户名', 'username', 'x-ui登录用户名'],
            ['密码', 'password', 'x-ui登录密码', 'password'],
            ['Web路径 (可选)', 'webBasePath', '例如: /xui']
          ].map(([label, key, placeholder, type]) =>
            React.createElement('div', { key },
              React.createElement('label', { className: "block text-sm font-medium text-gray-700 mb-1" }, label),
              React.createElement('input', {
                type: type || 'text',
                value: newServer[key],
                onChange: (e) => setNewServer({ ...newServer, [key]: e.target.value }),
                placeholder,
                className: "w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              })
            )
          )
        ),
        React.createElement('div', { className: "flex space-x-3 mt-6" },
          React.createElement('button', {
            onClick: addServer,
            className: "flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          }, '添加'),
          React.createElement('button', {
            onClick: () => setShowAddServer(false),
            className: "flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
          }, '取消')
        )
      )
    ),
    showInboundModal && React.createElement('div', { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto" },
      React.createElement('div', { className: "bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl m-4" },
        React.createElement('h2', { className: "text-xl font-bold mb-4" }, editingInbound ? '编辑入站' : '添加入站'),
        React.createElement('div', { className: "space-y-4 max-h-[70vh] overflow-y-auto" },
          React.createElement('div', { className: "grid grid-cols-2 gap-4" },
            React.createElement('div', null,
              React.createElement('label', { className: "block text-sm font-medium text-gray-700 mb-1" }, '备注'),
              React.createElement('input', {
                type: "text",
                value: inboundForm.remark,
                onChange: (e) => setInboundForm({ ...inboundForm, remark: e.target.value }),
                className: "w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              })
            ),
            React.createElement('div', null,
              React.createElement('label', { className: "block text-sm font-medium text-gray-700 mb-1" }, '端口'),
              React.createElement('input', {
                type: "number",
                value: inboundForm.port,
                onChange: (e) => setInboundForm({ ...inboundForm, port: e.target.value }),
                className: "w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              })
            )
          ),
          React.createElement('div', { className: "grid grid-cols-2 gap-4" },
            React.createElement('div', null,
              React.createElement('label', { className: "block text-sm font-medium text-gray-700 mb-1" }, '协议'),
              React.createElement('select', {
                value: inboundForm.protocol,
                onChange: (e) => setInboundForm({ ...inboundForm, protocol: e.target.value }),
                className: "w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              },
                ['vmess', 'vless', 'trojan', 'shadowsocks', 'dokodemo-door', 'socks', 'http'].map(p =>
                  React.createElement('option', { key: p, value: p }, p)
                )
              )
            ),
            React.createElement('div', { className: "flex items-center" },
              React.createElement('label', { className: "flex items-center space-x-2 cursor-pointer" },
                React.createElement('input', {
                  type: "checkbox",
                  checked: inboundForm.enable,
                  onChange: (e) => setInboundForm({ ...inboundForm, enable: e.target.checked }),
                  className: "w-4 h-4 text-blue-600"
                }),
                React.createElement('span', { className: "text-sm font-medium text-gray-700" }, '启用')
              )
            )
          ),
          React.createElement('div', null,
            React.createElement('label', { className: "block text-sm font-medium text-gray-700 mb-1" }, 
              'Settings (JSON)',
              React.createElement('span', { className: "text-xs text-gray-500 ml-2" }, '协议配置')
            ),
            React.createElement('textarea', {
              value: inboundForm.settings,
              onChange: (e) => setInboundForm({ ...inboundForm, settings: e.target.value }),
              className: "w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-xs",
              rows: 6
            })
          ),
          React.createElement('div', null,
            React.createElement('label', { className: "block text-sm font-medium text-gray-700 mb-1" }, 
              'Stream Settings (JSON)',
              React.createElement('span', { className: "text-xs text-gray-500 ml-2" }, '传输配置')
            ),
            React.createElement('textarea', {
              value: inboundForm.streamSettings,
              onChange: (e) => setInboundForm({ ...inboundForm, streamSettings: e.target.value }),
              className: "w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-xs",
              rows: 6
            })
          ),
          React.createElement('div', null,
            React.createElement('label', { className: "block text-sm font-medium text-gray-700 mb-1" }, 
              'Sniffing (JSON)',
              React.createElement('span', { className: "text-xs text-gray-500 ml-2" }, '流量探测')
            ),
            React.createElement('textarea', {
              value: inboundForm.sniffing,
              onChange: (e) => setInboundForm({ ...inboundForm, sniffing: e.target.value }),
              className: "w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-xs",
              rows: 3
            })
          )
        ),
        React.createElement('div', { className: "flex space-x-3 mt-6" },
          React.createElement('button', {
            onClick: saveInbound,
            className: "flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          }, editingInbound ? '保存' : '添加'),
          React.createElement('button', {
            onClick: () => setShowInboundModal(false),
            className: "flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
          }, '取消')
        )
      )
    )
  );
};

ReactDOM.render(React.createElement(XUIManager), document.getElementById('root'));
