'ENDFILE'
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
      setServerStatus(prev => ({ ...prev, [serverId]: { online: false } }));
    } finally {
      setLoading(prev => ({ ...prev, [serverId]: false }));
    }
  };

  const fetchInbounds = async (serverId) => {
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
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const formatUptime = (seconds) => {
    if (!seconds) return '0天 0小时';
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    return `${days}天 ${hours}小时`;
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
              React.createElement('span', { className: "text-sm font-medium" }, `${(status[k] || 0).toFixed(1)}%`)
            ),
            React.createElement('div', { className: "w-full bg-gray-200 rounded-full h-2" },
              React.createElement('div', {
                className: `h-2 rounded-full bg-${c}-600`,
                style: { width: `${status[k] || 0}%` }
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
    )
  );
};

ReactDOM.render(React.createElement(XUIManager), document.getElementById('root'));
ENDFILE
