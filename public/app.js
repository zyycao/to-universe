const { useState, useEffect } = React;
const API_BASE_URL = window.location.origin + '/api';

// 二维码ID计数器
let qrcodeCounter = 0;

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
  const [expandedServers, setExpandedServers] = useState({});
  const [showQRCode, setShowQRCode] = useState(false);
  const [qrCodeData, setQRCodeData] = useState({ title: '', content: '' });
  const [newServer, setNewServer] = useState({
    name: '', host: '', port: '', username: '', password: '', webBasePath: ''
  });
  const [showInboundModal, setShowInboundModal] = useState(false);
  const [editingInbound, setEditingInbound] = useState(null);
  const [currentServerId, setCurrentServerId] = useState(null);
  
  const [inboundForm, setInboundForm] = useState({
    remark: '', enable: true, protocol: 'vmess', listen: '', port: '', totalGB: 0, expiryTime: '',
    id: '', alterId: 0, flow: '', password: '', fallbacks: [], method: 'aes-256-gcm', ssPassword: '',
    address: '', targetPort: '', network: 'tcp,udp', authUser: '', authPass: '', udp: false, ip: '',
    streamNetwork: 'tcp', security: 'none', serverName: '', certFile: '', keyFile: '', certContent: '',
    keyContent: '', useCertFile: true, tcpHeaderType: 'none', wsPath: '/', wsHost: '', h2Path: '/',
    h2Host: '', grpcServiceName: '', kcpSeed: '', kcpType: 'none', quicSecurity: 'none', quicKey: '',
    quicType: 'none', sniffing: true
  });

  const generateUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };

  const toggleServer = (serverId) => {
    setExpandedServers(prev => ({ ...prev, [serverId]: !prev[serverId] }));
    if (!expandedServers[serverId] && !inbounds[serverId]) {
      fetchInbounds(serverId);
    }
  };

  const generateVMessLink = (inbound, server) => {
    try {
      const settings = typeof inbound.settings === 'string' ? JSON.parse(inbound.settings) : inbound.settings;
      const streamSettings = typeof inbound.streamSettings === 'string' ? JSON.parse(inbound.streamSettings) : inbound.streamSettings;
      
      const config = {
        v: '2', ps: inbound.remark || server.name, add: server.host, port: inbound.port,
        id: settings.clients?.[0]?.id || settings.vmesses?.[0]?.id || '',
        aid: settings.vmesses?.[0]?.alterId || settings.clients?.[0]?.alterId || 0,
        net: streamSettings.network || 'tcp', type: 'none', host: '', path: '',
        tls: streamSettings.security === 'tls' ? 'tls' : ''
      };

      if (streamSettings.network === 'ws') {
        config.path = streamSettings.wsSettings?.path || '/';
        config.host = streamSettings.wsSettings?.headers?.Host || '';
      } else if (streamSettings.network === 'http') {
        config.path = streamSettings.httpSettings?.path || '/';
        config.host = streamSettings.httpSettings?.host?.[0] || '';
      } else if (streamSettings.network === 'grpc') {
        config.path = streamSettings.grpcSettings?.serviceName || '';
      }

      return 'vmess://' + btoa(JSON.stringify(config));
    } catch (e) {
      return '';
    }
  };

  const generateVLESSLink = (inbound, server) => {
    try {
      const settings = typeof inbound.settings === 'string' ? JSON.parse(inbound.settings) : inbound.settings;
      const streamSettings = typeof inbound.streamSettings === 'string' ? JSON.parse(inbound.streamSettings) : inbound.streamSettings;
      
      const uuid = settings.clients?.[0]?.id || settings.vlesses?.[0]?.id || '';
      let link = `vless://${uuid}@${server.host}:${inbound.port}?`;
      
      const params = new URLSearchParams();
      params.append('type', streamSettings.network || 'tcp');
      params.append('security', streamSettings.security || 'none');
      
      if (streamSettings.security === 'tls' || streamSettings.security === 'xtls') {
        const tlsSettings = streamSettings.tlsSettings || streamSettings.xtlsSettings;
        if (tlsSettings?.serverName) params.append('sni', tlsSettings.serverName);
      }
      
      if (streamSettings.network === 'ws') {
        params.append('path', streamSettings.wsSettings?.path || '/');
        if (streamSettings.wsSettings?.headers?.Host) {
          params.append('host', streamSettings.wsSettings.headers.Host);
        }
      } else if (streamSettings.network === 'grpc') {
        params.append('serviceName', streamSettings.grpcSettings?.serviceName || '');
      }
      
      if (settings.clients?.[0]?.flow || settings.vlesses?.[0]?.flow) {
        params.append('flow', settings.clients?.[0]?.flow || settings.vlesses?.[0]?.flow);
      }
      
      link += params.toString();
      link += `#${encodeURIComponent(inbound.remark || server.name)}`;
      
      return link;
    } catch (e) {
      return '';
    }
  };

  const generateTrojanLink = (inbound, server) => {
    try {
      const settings = typeof inbound.settings === 'string' ? JSON.parse(inbound.settings) : inbound.settings;
      const streamSettings = typeof inbound.streamSettings === 'string' ? JSON.parse(inbound.streamSettings) : inbound.streamSettings;
      
      const password = settings.clients?.[0]?.password || '';
      let link = `trojan://${password}@${server.host}:${inbound.port}?`;
      
      const params = new URLSearchParams();
      params.append('type', streamSettings.network || 'tcp');
      params.append('security', streamSettings.security || 'tls');
      
      if (streamSettings.security === 'tls' || streamSettings.security === 'xtls') {
        const tlsSettings = streamSettings.tlsSettings || streamSettings.xtlsSettings;
        if (tlsSettings?.serverName) params.append('sni', tlsSettings.serverName);
      }
      
      if (streamSettings.network === 'ws') {
        params.append('path', streamSettings.wsSettings?.path || '/');
        if (streamSettings.wsSettings?.headers?.Host) {
          params.append('host', streamSettings.wsSettings.headers.Host);
        }
      } else if (streamSettings.network === 'grpc') {
        params.append('serviceName', streamSettings.grpcSettings?.serviceName || '');
      }
      
      link += params.toString();
      link += `#${encodeURIComponent(inbound.remark || server.name)}`;
      
      return link;
    } catch (e) {
      return '';
    }
  };

  const generateLink = (inbound, server) => {
    switch (inbound.protocol) {
      case 'vmess': return generateVMessLink(inbound, server);
      case 'vless': return generateVLESSLink(inbound, server);
      case 'trojan': return generateTrojanLink(inbound, server);
      default: return '';
    }
  };

  const showQRCodeModal = (inbound, server) => {
    const link = generateLink(inbound, server);
    if (link) {
      setQRCodeData({ title: inbound.remark || '入站配置', content: link });
      setShowQRCode(true);
    } else {
      alert('该协议不支持生成链接');
    }
  };

  const resetTraffic = async (serverId, inbound) => {
    if (!window.confirm('确定要重置流量吗？')) return;

    try {
      const response = await fetch(`${API_BASE_URL}/xui/server/${serverId}/inbounds/${inbound.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...buildInboundDataFromExisting(inbound),
          up: 0, down: 0
        })
      });

      const data = await response.json();
      if (data.success) {
        alert('流量重置成功');
        fetchInbounds(serverId);
      } else {
        alert(data.msg || '重置失败');
      }
    } catch (error) {
      alert('重置失败: ' + error.message);
    }
  };

  const buildInboundDataFromExisting = (inbound) => {
    return {
      remark: inbound.remark, enable: inbound.enable, port: parseInt(inbound.port),
      protocol: inbound.protocol, listen: inbound.listen || '', settings: inbound.settings,
      streamSettings: inbound.streamSettings, sniffing: inbound.sniffing,
      total: inbound.total, expiryTime: inbound.expiryTime
    };
  };

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
      remark: '', enable: true, protocol: 'vmess', listen: '', port: '', totalGB: 0, expiryTime: '',
      id: generateUUID(), alterId: 0, flow: '', password: generateUUID().substring(0, 8), fallbacks: [],
      method: 'aes-256-gcm', ssPassword: '', address: '', targetPort: '', network: 'tcp,udp',
      authUser: '', authPass: '', udp: false, ip: '', streamNetwork: 'tcp', security: 'none',
      serverName: '', certFile: '', keyFile: '', certContent: '', keyContent: '', useCertFile: true,
      tcpHeaderType: 'none', wsPath: '/', wsHost: '', h2Path: '/', h2Host: '', grpcServiceName: '',
      kcpSeed: '', kcpType: 'none', quicSecurity: 'none', quicKey: '', quicType: 'none', sniffing: true
    });
    setShowInboundModal(true);
  };

  const openEditInbound = (serverId, inbound) => {
    setCurrentServerId(serverId);
    setEditingInbound(inbound);
    
    let settings = {}, streamSettings = {}, sniffingEnabled = true;
    try {
      settings = typeof inbound.settings === 'string' ? JSON.parse(inbound.settings) : inbound.settings;
    } catch (e) {}
    try {
      streamSettings = typeof inbound.streamSettings === 'string' ? JSON.parse(inbound.streamSettings) : inbound.streamSettings;
    } catch (e) {}
    try {
      const sniffingObj = typeof inbound.sniffing === 'string' ? JSON.parse(inbound.sniffing) : inbound.sniffing;
      sniffingEnabled = sniffingObj.enabled !== false;
    } catch (e) {}

    setInboundForm({
      remark: inbound.remark || '', enable: inbound.enable, protocol: inbound.protocol || 'vmess',
      listen: inbound.listen || '', port: inbound.port || '',
      totalGB: inbound.total ? Math.round(inbound.total / (1024 * 1024 * 1024)) : 0,
      expiryTime: inbound.expiryTime ? new Date(inbound.expiryTime).toISOString().slice(0, 16) : '',
      id: settings.clients?.[0]?.id || settings.vlesses?.[0]?.id || settings.vmesses?.[0]?.id || '',
      alterId: settings.vmesses?.[0]?.alterId || settings.clients?.[0]?.alterId || 0,
      flow: settings.vlesses?.[0]?.flow || settings.clients?.[0]?.flow || '',
      password: settings.clients?.[0]?.password || '', fallbacks: settings.fallbacks || [],
      method: settings.method || 'aes-256-gcm', ssPassword: settings.password || '',
      address: settings.address || '', targetPort: settings.port || '', network: settings.network || 'tcp,udp',
      authUser: settings.accounts?.[0]?.user || '', authPass: settings.accounts?.[0]?.pass || '',
      udp: settings.udp || false, ip: settings.ip || '',
      streamNetwork: streamSettings.network || 'tcp', security: streamSettings.security || 'none',
      serverName: streamSettings.tlsSettings?.serverName || streamSettings.xtlsSettings?.serverName || '',
      certFile: streamSettings.tlsSettings?.certificates?.[0]?.certificateFile || streamSettings.xtlsSettings?.certificates?.[0]?.certificateFile || '',
      keyFile: streamSettings.tlsSettings?.certificates?.[0]?.keyFile || streamSettings.xtlsSettings?.certificates?.[0]?.keyFile || '',
      certContent: streamSettings.tlsSettings?.certificates?.[0]?.certificate || streamSettings.xtlsSettings?.certificates?.[0]?.certificate || '',
      keyContent: streamSettings.tlsSettings?.certificates?.[0]?.key || streamSettings.xtlsSettings?.certificates?.[0]?.key || '',
      useCertFile: !!(streamSettings.tlsSettings?.certificates?.[0]?.certificateFile || streamSettings.xtlsSettings?.certificates?.[0]?.certificateFile),
      tcpHeaderType: streamSettings.tcpSettings?.header?.type || 'none',
      wsPath: streamSettings.wsSettings?.path || '/', wsHost: streamSettings.wsSettings?.headers?.Host || '',
      h2Path: streamSettings.httpSettings?.path || '/', h2Host: streamSettings.httpSettings?.host?.[0] || '',
      grpcServiceName: streamSettings.grpcSettings?.serviceName || '',
      kcpSeed: streamSettings.kcpSettings?.seed || '', kcpType: streamSettings.kcpSettings?.header?.type || 'none',
      quicSecurity: streamSettings.quicSettings?.security || 'none', quicKey: streamSettings.quicSettings?.key || '',
      quicType: streamSettings.quicSettings?.header?.type || 'none', sniffing: sniffingEnabled
    });
    
    setShowInboundModal(true);
  };

  const buildInboundData = () => {
    const form = inboundForm;
    let settings = {};
    
    switch (form.protocol) {
      case 'vmess':
        settings = { clients: [{ id: form.id, alterId: parseInt(form.alterId) || 0 }], disableInsecure: false };
        break;
      case 'vless':
        settings = { clients: [{ id: form.id, flow: form.security === 'xtls' ? form.flow : '' }], decryption: 'none', fallbacks: form.fallbacks };
        break;
      case 'trojan':
        settings = { clients: [{ password: form.password, flow: form.security === 'xtls' ? form.flow : '' }], fallbacks: form.fallbacks };
        break;
      case 'shadowsocks':
        settings = { method: form.method, password: form.ssPassword, network: form.network };
        break;
      case 'dokodemo-door':
        settings = { address: form.address, port: parseInt(form.targetPort) || 0, network: form.network };
        break;
      case 'socks':
        settings = { auth: form.authUser ? 'password' : 'noauth', accounts: form.authUser ? [{ user: form.authUser, pass: form.authPass }] : [], udp: form.udp, ip: form.ip };
        break;
      case 'http':
        settings = { accounts: form.authUser ? [{ user: form.authUser, pass: form.authPass }] : [] };
        break;
    }
    
    let streamSettings = { network: form.streamNetwork };
    
    switch (form.streamNetwork) {
      case 'tcp':
        streamSettings.tcpSettings = { header: { type: form.tcpHeaderType } };
        break;
      case 'ws':
        streamSettings.wsSettings = { path: form.wsPath, headers: form.wsHost ? { Host: form.wsHost } : {} };
        break;
      case 'http':
        streamSettings.httpSettings = { path: form.h2Path, host: form.h2Host ? [form.h2Host] : [] };
        break;
      case 'grpc':
        streamSettings.grpcSettings = { serviceName: form.grpcServiceName };
        break;
      case 'kcp':
        streamSettings.kcpSettings = { seed: form.kcpSeed, header: { type: form.kcpType } };
        break;
      case 'quic':
        streamSettings.quicSettings = { security: form.quicSecurity, key: form.quicKey, header: { type: form.quicType } };
        break;
    }
    
    streamSettings.security = form.security;
    if (form.security === 'tls') {
      streamSettings.tlsSettings = {
        serverName: form.serverName,
        certificates: [{
          certificateFile: form.useCertFile ? form.certFile : '',
          keyFile: form.useCertFile ? form.keyFile : '',
          certificate: !form.useCertFile ? (form.certContent ? form.certContent.split('\\n') : []) : [],
          key: !form.useCertFile ? (form.keyContent ? form.keyContent.split('\\n') : []) : []
        }]
      };
    } else if (form.security === 'xtls') {
      streamSettings.xtlsSettings = {
        serverName: form.serverName,
        certificates: [{
          certificateFile: form.useCertFile ? form.certFile : '',
          keyFile: form.useCertFile ? form.keyFile : '',
          certificate: !form.useCertFile ? (form.certContent ? form.certContent.split('\\n') : []) : [],
          key: !form.useCertFile ? (form.keyContent ? form.keyContent.split('\\n') : []) : []
        }]
      };
    }
    
    const sniffing = { enabled: form.sniffing, destOverride: ['http', 'tls'] };
    
    return {
      remark: form.remark, enable: form.enable, port: parseInt(form.port), protocol: form.protocol,
      listen: form.listen, settings: JSON.stringify(settings), streamSettings: JSON.stringify(streamSettings),
      sniffing: JSON.stringify(sniffing), up: editingInbound?.up || 0, down: editingInbound?.down || 0,
      total: form.totalGB * 1024 * 1024 * 1024,
      expiryTime: form.expiryTime ? new Date(form.expiryTime).getTime() : 0
    };
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

      const data = buildInboundData();

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(data)
      });

      const result = await response.json();
      if (result.success) {
        alert(editingInbound ? '修改成功' : '添加成功');
        setShowInboundModal(false);
        fetchInbounds(currentServerId);
      } else {
        alert(result.msg || '操作失败');
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

  const ActionMenu = ({ serverId, inbound, server }) => {
    const [showMenu, setShowMenu] = useState(false);

    return React.createElement('div', { className: "relative" },
      React.createElement('button', {
        onClick: () => setShowMenu(!showMenu),
        className: "text-blue-600 hover:text-blue-900 px-2 py-1"
      }, '操作 ▼'),
      showMenu && React.createElement('div', {
        className: "absolute right-0 mt-1 w-40 bg-white rounded-lg shadow-lg border z-10",
        onMouseLeave: () => setShowMenu(false)
      },
        React.createElement('div', { className: "py-1" },
          React.createElement('button', {
            onClick: () => { setShowMenu(false); showQRCodeModal(inbound, server); },
            className: "w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center space-x-2"
          },
            React.createElement('span', null, '📱'),
            React.createElement('span', null, '二维码')
          ),
          React.createElement('button', {
            onClick: () => { setShowMenu(false); openEditInbound(serverId, inbound); },
            className: "w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center space-x-2"
          },
            React.createElement('span', null, '✏️'),
            React.createElement('span', null, '编辑')
          ),
          React.createElement('button', {
            onClick: () => { setShowMenu(false); resetTraffic(serverId, inbound); },
            className: "w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center space-x-2"
          },
            React.createElement('span', null, '🔄'),
            React.createElement('span', null, '重置流量')
          ),
          React.createElement('button', {
            onClick: () => { setShowMenu(false); deleteInbound(serverId, inbound.id); },
            className: "w-full text-left px-4 py-2 text-sm hover:bg-gray-100 text-red-600 flex items-center space-x-2"
          },
            React.createElement('span', null, '🗑️'),
            React.createElement('span', null, '删除')
          )
        )
      )
    );
  };

  const QRCodeModal = () => {
    const [qrId] = useState(() => `qrcode-${++qrcodeCounter}`);
    
    useEffect(() => {
      if (showQRCode && qrCodeData.content) {
        const container = document.getElementById(qrId);
        if (container && window.QRCode) {
          container.innerHTML = '';
          try {
            new QRCode(container, {
              text: qrCodeData.content,
              width: 256,
              height: 256,
              colorDark: '#000000',
              colorLight: '#ffffff',
              correctLevel: QRCode.CorrectLevel.H
            });
          } catch (e) {
            console.error('生成二维码失败:', e);
            container.innerHTML = '<div class="text-center text-red-500 p-4">二维码生成失败</div>';
          }
        } else if (container && !window.QRCode) {
          container.innerHTML = '<div class="text-center text-orange-500 p-4">QRCode库未加载，请刷新页面</div>';
        }
      }
    }, [showQRCode, qrCodeData.content, qrId]);

    if (!showQRCode) return null;

    return React.createElement('div', {
      className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4",
      onClick: () => setShowQRCode(false)
    },
      React.createElement('div', {
        className: "bg-white rounded-lg shadow-xl p-6 max-w-md w-full",
        onClick: (e) => e.stopPropagation()
      },
        React.createElement('div', { className: "flex justify-between items-center mb-4" },
          React.createElement('h3', { className: "text-xl font-bold" }, qrCodeData.title),
          React.createElement('button', {
            onClick: () => setShowQRCode(false),
            className: "text-gray-400 hover:text-gray-600 text-2xl font-bold leading-none"
          }, '×')
        ),
        React.createElement('div', { className: "bg-gray-50 p-4 border-2 border-gray-200 rounded-lg mb-4 flex justify-center" },
          React.createElement('div', { 
            id: qrId,
            className: "inline-block bg-white p-2"
          })
        ),
        React.createElement('div', { className: "mb-4" },
          React.createElement('label', { className: "block text-sm font-medium text-gray-700 mb-2" }, '配置链接：'),
          React.createElement('textarea', {
            value: qrCodeData.content,
            readOnly: true,
            className: "w-full px-3 py-2 border rounded-lg text-xs font-mono bg-gray-50 focus:outline-none",
            rows: 3,
            onClick: (e) => e.target.select()
          })
        ),
        React.createElement('div', { className: "flex space-x-3" },
          React.createElement('button', {
            onClick: () => {
              navigator.clipboard.writeText(qrCodeData.content).then(() => {
                alert('✅ 已复制到剪贴板');
              }).catch(() => {
                alert('❌ 复制失败，请手动复制');
              });
            },
            className: "flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition"
          }, '📋 复制链接'),
          React.createElement('button', {
            onClick: () => setShowQRCode(false),
            className: "flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-medium transition"
          }, '关闭')
        )
      )
    );
  };

  const InboundModal = () => {
    if (!showInboundModal) return null;

    const form = inboundForm;
    const updateForm = (updates) => setInboundForm({ ...form, ...updates });

    return React.createElement('div', { 
      className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4",
      onClick: (e) => {
        if (e.target === e.currentTarget) setShowInboundModal(false);
      }
    },
      React.createElement('div', { 
        className: "bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto",
        onClick: (e) => e.stopPropagation()
      },
        React.createElement('div', { className: "sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center z-10" },
          React.createElement('h2', { className: "text-xl font-bold" }, editingInbound ? '修改入站' : '添加入站'),
          React.createElement('button', {
            onClick: () => setShowInboundModal(false),
            className: "text-gray-400 hover:text-gray-600 text-2xl leading-none"
          }, '×')
        ),
        
        React.createElement('div', { className: "p-6 space-y-4" },
          React.createElement('div', { className: "grid grid-cols-2 gap-4" },
            React.createElement('div', null,
              React.createElement('label', { className: "block text-sm font-medium mb-1" }, 'remark :'),
              React.createElement('input', {
                type: "text", value: form.remark,
                onChange: (e) => updateForm({ remark: e.target.value }),
                className: "w-full px-3 py-2 border rounded-lg"
              })
            ),
            React.createElement('div', { className: "flex items-center" },
              React.createElement('label', { className: "flex items-center space-x-2 cursor-pointer" },
                React.createElement('span', { className: "text-sm font-medium" }, 'enable :'),
                React.createElement('div', {
                  className: `relative inline-block w-12 h-6 transition duration-200 ease-in-out rounded-full ${form.enable ? 'bg-blue-600' : 'bg-gray-300'}`,
                  onClick: () => updateForm({ enable: !form.enable })
                },
                  React.createElement('span', {
                    className: `absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform duration-200 ${form.enable ? 'transform translate-x-6' : ''}`
                  })
                )
              )
            )
          ),

          React.createElement('div', { className: "grid grid-cols-2 gap-4" },
            React.createElement('div', null,
              React.createElement('label', { className: "block text-sm font-medium mb-1" }, 'protocol :'),
              React.createElement('select', {
                value: form.protocol,
                onChange: (e) => updateForm({ protocol: e.target.value }),
                className: "w-full px-3 py-2 border rounded-lg"
              },
                ['vmess', 'vless', 'trojan', 'shadowsocks', 'dokodemo-door', 'socks', 'http'].map(p =>
                  React.createElement('option', { key: p, value: p }, p)
                )
              )
            ),
            React.createElement('div', null,
              React.createElement('label', { className: "block text-sm font-medium mb-1" }, '监听 IP :'),
              React.createElement('input', {
                type: "text", value: form.listen,
                onChange: (e) => updateForm({ listen: e.target.value }),
                placeholder: "留空为 0.0.0.0",
                className: "w-full px-3 py-2 border rounded-lg"
              })
            )
          ),

          React.createElement('div', { className: "grid grid-cols-2 gap-4" },
            React.createElement('div', null,
              React.createElement('label', { className: "block text-sm font-medium mb-1" }, '端口 :'),
              React.createElement('input', {
                type: "number", value: form.port,
                onChange: (e) => updateForm({ port: e.target.value }),
                className: "w-full px-3 py-2 border rounded-lg"
              })
            ),
            React.createElement('div', null,
              React.createElement('label', { className: "block text-sm font-medium mb-1" }, '总流量(GB) :'),
              React.createElement('input', {
                type: "number", value: form.totalGB,
                onChange: (e) => updateForm({ totalGB: e.target.value }),
                placeholder: "0 表示不限制",
                className: "w-full px-3 py-2 border rounded-lg"
              })
            )
          ),

          React.createElement('div', null,
            React.createElement('label', { className: "block text-sm font-medium mb-1" }, '到期时间 :'),
            React.createElement('input', {
              type: "datetime-local", value: form.expiryTime,
              onChange: (e) => updateForm({ expiryTime: e.target.value }),
              className: "w-full px-3 py-2 border rounded-lg"
            })
          ),

          (form.protocol === 'vmess' || form.protocol === 'vless') && React.createElement('div', { className: "space-y-4 border-t pt-4" },
            React.createElement('h3', { className: "font-semibold" }, form.protocol.toUpperCase() + ' 设置'),
            React.createElement('div', null,
              React.createElement('label', { className: "block text-sm font-medium mb-1" }, 'id (UUID) :'),
              React.createElement('input', {
                type: "text", value: form.id,
                onChange: (e) => updateForm({ id: e.target.value }),
                className: "w-full px-3 py-2 border rounded-lg font-mono text-sm"
              })
            ),
            form.protocol === 'vmess' && React.createElement('div', null,
              React.createElement('label', { className: "block text-sm font-medium mb-1" }, 'alterId :'),
              React.createElement('input', {
                type: "number", value: form.alterId,
                onChange: (e) => updateForm({ alterId: e.target.value }),
                className: "w-full px-3 py-2 border rounded-lg"
              })
            )
          ),

          form.protocol === 'trojan' && React.createElement('div', { className: "space-y-4 border-t pt-4" },
            React.createElement('h3', { className: "font-semibold" }, 'Trojan 设置'),
            React.createElement('div', null,
              React.createElement('label', { className: "block text-sm font-medium mb-1" }, '密码 :'),
              React.createElement('input', {
                type: "text", value: form.password,
                onChange: (e) => updateForm({ password: e.target.value }),
                className: "w-full px-3 py-2 border rounded-lg"
              })
            )
          ),

          form.protocol === 'shadowsocks' && React.createElement('div', { className: "space-y-4 border-t pt-4" },
            React.createElement('h3', { className: "font-semibold" }, 'Shadowsocks 设置'),
            React.createElement('div', { className: "grid grid-cols-2 gap-4" },
              React.createElement('div', null,
                React.createElement('label', { className: "block text-sm font-medium mb-1" }, '加密方式 :'),
                React.createElement('select', {
                  value: form.method,
                  onChange: (e) => updateForm({ method: e.target.value }),
                  className: "w-full px-3 py-2 border rounded-lg"
                },
                  ['aes-256-gcm', 'aes-128-gcm', 'chacha20-poly1305', 'chacha20-ietf-poly1305'].map(m =>
                    React.createElement('option', { key: m, value: m }, m)
                  )
                )
              ),
              React.createElement('div', null,
                React.createElement('label', { className: "block text-sm font-medium mb-1" }, '密码 :'),
                React.createElement('input', {
                  type: "text", value: form.ssPassword,
                  onChange: (e) => updateForm({ ssPassword: e.target.value }),
                  className: "w-full px-3 py-2 border rounded-lg"
                })
              )
            )
          ),

          React.createElement('div', { className: "space-y-4 border-t pt-4" },
            React.createElement('h3', { className: "font-semibold" }, '传输设置'),
            React.createElement('div', { className: "grid grid-cols-2 gap-4" },
              React.createElement('div', null,
                React.createElement('label', { className: "block text-sm font-medium mb-1" }, '传输协议 :'),
                React.createElement('select', {
                  value: form.streamNetwork,
                  onChange: (e) => updateForm({ streamNetwork: e.target.value }),
                  className: "w-full px-3 py-2 border rounded-lg"
                },
                  ['tcp', 'kcp', 'ws', 'http', 'quic', 'grpc'].map(n =>
                    React.createElement('option', { key: n, value: n }, n)
                  )
                )
              ),
              React.createElement('div', null,
                React.createElement('label', { className: "block text-sm font-medium mb-1" }, '安全类型 :'),
                React.createElement('select', {
                  value: form.security,
                  onChange: (e) => updateForm({ security: e.target.value }),
                  className: "w-full px-3 py-2 border rounded-lg"
                },
                  ['none', 'tls', 'xtls'].map(s =>
                    React.createElement('option', { key: s, value: s }, s)
                  )
                )
              )
            ),

            form.streamNetwork === 'ws' && React.createElement('div', { className: "grid grid-cols-2 gap-4" },
              React.createElement('div', null,
                React.createElement('label', { className: "block text-sm font-medium mb-1" }, 'path :'),
                React.createElement('input', {
                  type: "text", value: form.wsPath,
                  onChange: (e) => updateForm({ wsPath: e.target.value }),
                  className: "w-full px-3 py-2 border rounded-lg"
                })
              ),
              React.createElement('div', null,
                React.createElement('label', { className: "block text-sm font-medium mb-1" }, 'host :'),
                React.createElement('input', {
                  type: "text", value: form.wsHost,
                  onChange: (e) => updateForm({ wsHost: e.target.value }),
                  className: "w-full px-3 py-2 border rounded-lg"
                })
              )
            ),

            form.streamNetwork === 'grpc' && React.createElement('div', null,
              React.createElement('label', { className: "block text-sm font-medium mb-1" }, 'serviceName :'),
              React.createElement('input', {
                type: "text", value: form.grpcServiceName,
                onChange: (e) => updateForm({ grpcServiceName: e.target.value }),
                className: "w-full px-3 py-2 border rounded-lg"
              })
            ),

            (form.security === 'tls' || form.security === 'xtls') && React.createElement('div', { className: "space-y-4 border-t pt-4" },
              React.createElement('h3', { className: "font-semibold" }, (form.security === 'tls' ? 'TLS' : 'XTLS') + ' 设置'),
              React.createElement('div', null,
                React.createElement('label', { className: "block text-sm font-medium mb-1" }, '域名 :'),
                React.createElement('input', {
                  type: "text", value: form.serverName,
                  onChange: (e) => updateForm({ serverName: e.target.value }),
                  className: "w-full px-3 py-2 border rounded-lg"
                })
              ),
              React.createElement('div', { className: "flex space-x-2 mb-2" },
                React.createElement('button', {
                  type: "button",
                  onClick: () => updateForm({ useCertFile: true }),
                  className: `flex-1 px-4 py-2 rounded-lg ${form.useCertFile ? 'bg-blue-600 text-white' : 'bg-gray-200'}`
                }, 'certificate file path'),
                React.createElement('button', {
                  type: "button",
                  onClick: () => updateForm({ useCertFile: false }),
                  className: `flex-1 px-4 py-2 rounded-lg ${!form.useCertFile ? 'bg-blue-600 text-white' : 'bg-gray-200'}`
                }, 'certificate file content')
              ),
              form.useCertFile ? React.createElement('div', { className: "space-y-4" },
                React.createElement('div', null,
                  React.createElement('label', { className: "block text-sm font-medium mb-1" }, '公钥文件路径 :'),
                  React.createElement('input', {
                    type: "text", value: form.certFile,
                    onChange: (e) => updateForm({ certFile: e.target.value }),
                    placeholder: "/path/to/cert.crt",
                    className: "w-full px-3 py-2 border rounded-lg"
                  })
                ),
                React.createElement('div', null,
                  React.createElement('label', { className: "block text-sm font-medium mb-1" }, '密钥文件路径 :'),
                  React.createElement('input', {
                    type: "text", value: form.keyFile,
                    onChange: (e) => updateForm({ keyFile: e.target.value }),
                    placeholder: "/path/to/key.key",
                    className: "w-full px-3 py-2 border rounded-lg"
                  })
                )
              ) : React.createElement('div', { className: "space-y-4" },
                React.createElement('div', null,
                  React.createElement('label', { className: "block text-sm font-medium mb-1" }, '公钥内容 :'),
                  React.createElement('textarea', {
                    value: form.certContent,
                    onChange: (e) => updateForm({ certContent: e.target.value }),
                    rows: 4,
                    className: "w-full px-3 py-2 border rounded-lg font-mono text-xs"
                  })
                ),
                React.createElement('div', null,
                  React.createElement('label', { className: "block text-sm font-medium mb-1" }, '密钥内容 :'),
                  React.createElement('textarea', {
                    value: form.keyContent,
                    onChange: (e) => updateForm({ keyContent: e.target.value }),
                    rows: 4,
                    className: "w-full px-3 py-2 border rounded-lg font-mono text-xs"
                  })
                )
              )
            )
          ),

          React.createElement('div', { className: "flex items-center space-x-2 border-t pt-4" },
            React.createElement('span', { className: "text-sm font-medium" }, 'sniffing :'),
            React.createElement('div', {
              className: `relative inline-block w-12 h-6 transition duration-200 ease-in-out rounded-full ${form.sniffing ? 'bg-blue-600' : 'bg-gray-300'}`,
              onClick: () => updateForm({ sniffing: !form.sniffing })
            },
              React.createElement('span', {
                className: `absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform duration-200 ${form.sniffing ? 'transform translate-x-6' : ''}`
              })
            )
          )
        ),

        React.createElement('div', { className: "sticky bottom-0 bg-white border-t px-6 py-4 flex justify-end space-x-3" },
          React.createElement('button', {
            type: "button",
            onClick: () => setShowInboundModal(false),
            className: "px-6 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
          }, 'close'),
          React.createElement('button', {
            type: "button",
            onClick: saveInbound,
            className: "px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          }, editingInbound ? '修改' : '添加')
        )
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
      
      activeTab === 'inbounds' && React.createElement('div', { className: "space-y-4" },
        servers.map(server => {
          const serverInbounds = inbounds[server.id] || [];
          const isExpanded = expandedServers[server.id];
          const isLoading = loading[`inbound_${server.id}`];
          
          return React.createElement('div', { key: server.id, className: "bg-white rounded-lg shadow-md overflow-hidden" },
            React.createElement('div', { 
              className: "bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-b cursor-pointer hover:bg-gray-100 transition",
              onClick: () => toggleServer(server.id)
            },
              React.createElement('div', { className: "flex justify-between items-center" },
                React.createElement('div', { className: "flex items-center space-x-3" },
                  React.createElement('span', { className: "text-xl" }, isExpanded ? '▼' : '▶'),
                  React.createElement('h3', { className: "text-lg font-semibold text-gray-900" }, server.name),
                  React.createElement('span', { className: "text-sm text-gray-500" }, 
                    `(${serverInbounds.length} 个入站)`
                  )
                ),
                React.createElement('button', {
                  onClick: (e) => {
                    e.stopPropagation();
                    openAddInbound(server.id);
                  },
                  className: "px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                }, '+ 添加入站')
              )
            ),
            
            isExpanded && React.createElement('div', null,
              isLoading ? React.createElement('div', { className: "text-center py-8" },
                React.createElement('span', { className: "text-gray-500" }, '加载中...')
              ) : serverInbounds.length > 0 ? React.createElement('div', { className: "overflow-x-auto" },
                React.createElement('table', { className: "min-w-full divide-y divide-gray-200" },
                  React.createElement('thead', { className: "bg-gray-50" },
                    React.createElement('tr', null,
                      ['操作', '启用', 'ID', '备注', '协议', '端口', '上传 / 下载', '总用量', '到期时间'].map(h =>
                        React.createElement('th', { key: h, className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" }, h)
                      )
                    )
                  ),
                  React.createElement('tbody', { className: "bg-white divide-y divide-gray-200" },
                    serverInbounds.map(inbound =>
                      React.createElement('tr', { key: inbound.id, className: "hover:bg-gray-50" },
                        React.createElement('td', { className: "px-6 py-4 whitespace-nowrap text-sm" },
                          React.createElement(ActionMenu, { serverId: server.id, inbound: inbound, server: server })
                        ),
                        React.createElement('td', { className: "px-6 py-4 whitespace-nowrap" },
                          React.createElement('div', {
                            className: `relative inline-block w-10 h-5 transition duration-200 ease-in-out rounded-full ${inbound.enable ? 'bg-blue-600' : 'bg-gray-300'}`
                          },
                            React.createElement('span', {
                              className: `absolute left-1 top-0.5 bg-white w-4 h-4 rounded-full transition-transform duration-200 ${inbound.enable ? 'transform translate-x-5' : ''}`
                            })
                          )
                        ),
                        React.createElement('td', { className: "px-6 py-4 whitespace-nowrap text-sm text-gray-500" }, inbound.id),
                        React.createElement('td', { className: "px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900" }, inbound.remark || '-'),
                        React.createElement('td', { className: "px-6 py-4 whitespace-nowrap text-sm" },
                          React.createElement('span', { className: "px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium" }, inbound.protocol)
                        ),
                        React.createElement('td', { className: "px-6 py-4 whitespace-nowrap text-sm text-gray-500" }, inbound.port),
                        React.createElement('td', { className: "px-6 py-4 whitespace-nowrap text-sm" },
                          React.createElement('div', { className: "text-green-600" }, formatBytes(inbound.up)),
                          React.createElement('div', { className: "text-blue-600" }, formatBytes(inbound.down))
                        ),
                        React.createElement('td', { className: "px-6 py-4 whitespace-nowrap text-sm" },
                          inbound.total > 0 
                            ? React.createElement('span', { 
                                className: `px-2 py-1 rounded text-xs font-medium ${
                                  (inbound.up + inbound.down) >= inbound.total ? 'bg-red-100 text-red-800' : 'bg-cyan-100 text-cyan-800'
                                }`
                              }, formatBytes(inbound.total))
                            : React.createElement('span', { className: "px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-medium" }, '无限制')
                        ),
                        React.createElement('td', { className: "px-6 py-4 whitespace-nowrap text-sm" },
                          inbound.expiryTime > 0 
                            ? React.createElement('span', {
                                className: `px-2 py-1 rounded text-xs font-medium ${
                                  inbound.expiryTime < Date.now() ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
                                }`
                              }, new Date(inbound.expiryTime).toLocaleString('zh-CN'))
                            : React.createElement('span', { className: "px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-medium" }, '无限期')
                        )
                      )
                    )
                  )
                )
              ) : React.createElement('div', { className: "text-center py-8" },
                React.createElement('p', { className: "text-gray-500 mb-4" }, '暂无入站配置'),
                React.createElement('button', {
                  onClick: () => openAddInbound(server.id),
                  className: "px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                }, '添加第一个入站')
              )
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
    React.createElement(InboundModal),
    React.createElement(QRCodeModal)
  );
};

ReactDOM.render(React.createElement(XUIManager), document.getElementById('root'));
