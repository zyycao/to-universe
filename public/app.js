const { useState, useEffect } = React;

const API_BASE_URL = 'http://localhost:3000/api';

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
    name: '',
    host: '',
    port: '',
    username: '',
    password: '',
    webBasePath: ''
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
      
      if (data.success) {
        setServers(data.data);
      }
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
      } else {
        alert(data.msg || '删除失败');
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
          [serverId]: {
            online: true,
            ...data.data.obj
          }
        }));
      } else {
        setServerStatus(prev => ({
          ...prev,
          [serverId]: { online: false }
        }));
      }
    } catch (error) {
      console.error('获取服务器状态失败:', error);
      setServerStatus(prev => ({
        ...prev,
        [serverId]: { online: false }
      }));
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
        setInbounds(prev => ({
          ...prev,
          [serverId]: data.data.obj
        }));
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
          if (item.success && item.data.obj) {
            newStatus[item.serverId] = {
              online: true,
              ...item.data.obj
            };
          } else {
            newStatus[item.serverId] = { online: false };
          }
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
          if (item.success && item.data.obj) {
            newInbounds[item.serverId] = item.data.obj;
          }
        });
        setInbounds(newInbounds);
      }
    } catch (error) {
      console.error('批量刷新失败:', error);
    }
  };

  useEffect(() => {
    if (token) {
      fetchServers();
    }
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
              type: "text",
              value: username,
              onChange: (e) => setUsername(e.target.value),
              className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent",
              placeholder: "请输入用户名",
              required: true
            })
          ),
          React.createElement('div', null,
            React.createElement('label', { className: "block text-sm font-medium text-gray-700 mb-1" }, '密码'),
            React.createElement('input', {
              type: "password",
              value: password,
              onChange: (e) => setPassword(e.target.value),
              className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent",
              placeholder: "请输入密码",
              required: true
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

  return React.createElement('div', { className: "min-h-screen bg-gray-50" },
    React.createElement('div', { className: "bg-white shadow" },
      React.createElement('div', { className: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" },
        React.createElement('div', { className: "flex justify-between items-center py-4" },
          React.createElement('div', { className: "flex items-center space-x-3" },
            React.createElement('svg', { className: "w-8 h-8 text-blue-600", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24" },
              React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" })
            ),
            React.createElement('h1', { className: "text-2xl font-bold text-gray-900" }, 'X-UI 统一管理面板')
          ),
          React.createElement('div', { className: "flex space-x-2" },
            React.createElement('button', {
              onClick: refreshAll,
              className: "px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2"
            },
              React.createElement('svg', { className: "w-4 h-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24" },
                React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" })
              ),
              React.createElement('span', null, '刷新全部')
            ),
            React.createElement('button', {
              onClick: () => setShowAddServer(true),
              className: "px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center space-x-2"
            },
              React.createElement('svg', { className: "w-4 h-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24" },
                React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M12 4v16m8-8H4" })
              ),
              React.createElement('span', null, '添加服务器')
            ),
            React.createElement('button', {
              onClick: handleLogout,
              className: "px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center space-x-2"
            },
              React.createElement('svg', { className: "w-4 h-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24" },
                React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" })
              ),
              React.createElement('span', null, '登出')
            )
          )
        )
      )
    ),
    React.createElement('div', { className: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6" },
      React.createElement('div', { className: "border-b border-gray-200" },
        React.createElement('nav', { className: "-mb-px flex space-x-8" },
          React.createElement('button', {
            onClick: () => setActiveTab('dashboard'),
            className: `py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'dashboard' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`
          }, '服务器状态'),
          React.createElement('button', {
            onClick: () => setActiveTab('inbounds'),
            className: `py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'inbounds' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`
          }, '入站配置'),
          React.createElement('button', {
            onClick: () => setActiveTab('servers'),
            className: `py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'servers' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`
          }, '服务器管理')
        )
      )
    ),
    React.createElement('div', { className: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" },
      activeTab === 'dashboard' && React.createElement('div', { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" },
        servers.map(server => {
          const status = serverStatus[server.id];
          return React.createElement('div', { key: server.id, className: "bg-white rounded-lg shadow-md p-6" },
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
              React.createElement('div', { className: "flex items-center justify-between" },
                React.createElement('div', { className: "flex items-center space-x-2" },
                  React.createElement('svg', { className: "w-4 h-4 text-gray-400", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24" },
                    React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" })
                  ),
                  React.createElement('span', { className: "text-sm text-gray-600" }, 'CPU')
                ),
                React.createElement('span', { className: "text-sm font-medium" }, `${status.cpu?.toFixed(1)}%`)
              ),
              React.createElement('div', { className: "w-full bg-gray-200 rounded-full h-2" },
                React.createElement('div', { className: "bg-blue-600 h-2 rounded-full", style: { width: `${status.cpu || 0}%` } })
              ),
              React.createElement('div', { className: "flex items-center justify-between" },
                React.createElement('div', { className: "flex items-center space-x-2" },
                  React.createElement('svg', { className: "w-4 h-4 text-gray-400", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24" },
                    React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M13 10V3L4 14h7v7l9-11h-7z" })
                  ),
                  React.createElement('span', { className: "text-sm text-gray-600" }, '内存')
                ),
                React.createElement('span', { className: "text-sm font-medium" }, `${status.mem?.toFixed(1)}%`)
              ),
              React.createElement('div', { className: "w-full bg-gray-200 rounded-full h-2" },
                React.createElement('div', { className: "bg-green-600 h-2 rounded-full", style: { width: `${status.mem || 0}%` } })
              ),
              React.createElement('div', { className: "flex items-center justify-between" },
                React.createElement('div', { className: "flex items-center space-x-2" },
                  React.createElement('svg', { className: "w-4 h-4 text-gray-400", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24" },
                    React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" })
                  ),
                  React.createElement('span', { className: "text-sm text-gray-600" }, '磁盘')
                ),
                React.createElement('span', { className: "text-sm font-medium" }, `${status.disk?.toFixed(1)}%`)
              ),
              React.createElement('div', { className: "w-full bg-gray-200 rounded-full h-2" },
                React.createElement('div', { className: "bg-yellow-600 h-2 rounded-full", style: { width: `${status.disk || 0}%` } })
              ),
              React.createElement('div', { className: "pt-3 border-t border-gray-200" },
                React.createElement('div', { className: "flex items-center justify-between text-sm" },
                  React.createElement('span', { className: "text-gray-600" }, '运行时间'),
                  React.createElement('span', { className: "font-medium" }, formatUptime(status.uptime))
                ),
                React.createElement('div', { className: "flex items-center justify-between text-sm mt-2" },
                  React.createElement('span', { className: "text-gray-600" }, '上传'),
                  React.createElement('span', { className: "font-medium text-green-600" }, `${formatBytes(status.netIO?.up)}/s`)
                ),
                React.createElement('div', { className: "flex items-center justify-between text-sm mt-1" },
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
        }),
        servers.length === 0 && React.createElement('div', { className: "col-span-full text-center py-12" },
          React.createElement('svg', { className: "w-16 h-16 text-gray-400 mx-auto mb-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24" },
            React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" })
          ),
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
          return React.createElement('div', { key: server.id, className: "bg-white rounded-lg shadow-md overflow-hidden" },
            React.createElement('div', { className: "bg-gray-50 px-6 py-4 border-b border-gray-200" },
              React.createElement('div', { className: "flex justify-between items-center" },
                React.createElement('h3', { className: "text-lg font-semibold text-gray-900" }, server.name),
                React.createElement('button', {
                  onClick: () => fetchInbounds(server.id),
                  className: "text-sm text-blue-600 hover:text-blue-700"
                }, '刷新')
              )
            ),
            serverInbounds.length > 0 ? React.createElement('div', { className: "overflow-x-auto" },
              React.createElement('table', { className: "min-w-full divide-y divide-gray-200" },
                React.createElement('thead', { className: "bg-gray-50" },
                  React.createElement('tr', null,
                    React.createElement('th', { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase" }, '备注'),
                    React.createElement('th', { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase" }, '协议'),
                    React.createElement('th', { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase" }, '端口'),
                    React.createElement('th', { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase" }, '状态'),
                    React.createElement('th', { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase" }, '上传'),
                    React.createElement('th', { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase" }, '下载')
                  )
                ),
                React.createElement('tbody', { className: "bg-white divide-y divide-gray-200" },
                  serverInbounds.map(inbound =>
                    React.createElement('tr', { key: inbound.id },
                      React.createElement('td', { className: "px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900" }, inbound.remark),
                      React.createElement('td', { className: "px-6 py-4 whitespace-nowrap text-sm text-gray-500" },
                        React.createElement('span', { className: "px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium" }, inbound.protocol)
                      ),
                      React.createElement('td', { className: "px-6 py-4 whitespace-nowrap text-sm text-gray-500" }, inbound.port),
                      React.createElement('td', { className: "px-6 py-4 whitespace-nowrap" },
                        React.createElement('span', {
                          className: `px-2 py-1 rounded text-xs font-medium ${inbound.enable ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`
                        }, inbound.enable ? '启用' : '禁用')
                      ),
                      React.createElement('td', { className: "px-6 py-4 whitespace-nowrap text-sm text-gray-500" }, formatBytes(inbound.up)),
                      React.createElement('td', { className: "px-6 py-4 whitespace-nowrap text-sm text-gray-500" }, formatBytes(inbound.down))
                    )
                  )
                )
              )
            ) : React.createElement('div', { className: "text-center py-8" },
              React.createElement('button', {
                onClick: () => fetchInbounds(server.id),
                className: "px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              }, '加载入站配置')
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
              React.createElement('th', { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase" }, '名称'),
              React.createElement('th', { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase" }, '地址'),
              React.createElement('th', { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase" }, '端口'),
              React.createElement('th', { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase" }, '用户名'),
              React.createElement('th', { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase" }, '操作')
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
          React.createElement('div', null,
            React.createElement('label', { className: "block text-sm font-medium text-gray-700 mb-1" }, '服务器名称'),
            React.createElement('input', {
              type: "text",
              value: newServer.name,
              onChange: (e) => setNewServer({...newServer, name: e.target.value}),
              placeholder: "例如: 美国服务器-1",
              className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            })
          ),
          React.createElement('div', null,
            React.createElement('label', { className: "block text-sm font-medium text-gray-700 mb-1" }, '服务器IP/域名'),
            React.createElement('input', {
              type: "text",
              value: newServer.host,
              onChange: (e) => setNewServer({...newServer, host: e.target.value}),
              placeholder: "例如: 192.168.1.100",
              className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            })
          ),
          React.createElement('div', null,
            React.createElement('label', { className: "block text-sm font-medium text-gray-700 mb-1" }, '端口'),
            React.createElement('input', {
              type: "text",
              value: newServer.port,
              onChange: (e) => setNewServer({...newServer, port: e.target.value}),
              placeholder: "例如: 54321",
              className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            })
          ),
          React.createElement('div', null,
            React.createElement('label', { className: "block text-sm font-medium text-gray-700 mb-1" }, '用户名'),
            React.createElement('input', {
              type: "text",
              value: newServer.username,
              onChange: (e) => setNewServer({...newServer, username: e.target.value}),
              placeholder: "x-ui登录用户名",
              className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            })
          ),
          React.createElement('div', null,
            React.createElement('label', { className: "block text-sm font-medium text-gray-700 mb-1" }, '密码'),
            React.createElement('input', {
              type: "password",
              value: newServer.password,
              onChange: (e) => setNewServer({...newServer, password: e.target.value}),
              placeholder: "x-ui登录密码",
              className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            })
          ),
          React.createElement('div', null,
            React.createElement('label', { className: "block text-sm font-medium text-gray-700 mb-1" }, 'Web路径 (可选)'),
            React.createElement('input', {
              type: "text",
              value: newServer.webBasePath,
              onChange: (e) => setNewServer({...newServer, webBasePath: e.target.value}),
              placeholder: "例如: /xui (如果设置了web路径)",
              className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            })
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
APPJS_EOF

echo "✅ app.js 文件创建完成"
