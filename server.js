// server.js - X-UI 统一管理面板后端服务
// 使用 Node.js + Express + SQLite

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const https = require('https');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// 忽略自签名证书（开发环境）
const httpsAgent = new https.Agent({
  rejectUnauthorized: false
});

// 初始化数据库
const db = new sqlite3.Database('./xui-manager.db', (err) => {
  if (err) {
    console.error('数据库连接失败:', err);
  } else {
    console.log('数据库连接成功');
    initDatabase();
  }
});

// 创建数据表
function initDatabase() {
  db.run(`
    CREATE TABLE IF NOT EXISTS servers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      host TEXT NOT NULL,
      port INTEGER NOT NULL,
      username TEXT NOT NULL,
      password TEXT NOT NULL,
      web_base_path TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 创建默认管理员账号 (admin/admin123)
  const defaultPassword = bcrypt.hashSync('admin123', 10);
  db.run(
    'INSERT OR IGNORE INTO admin_users (username, password) VALUES (?, ?)',
    ['admin', defaultPassword]
  );
}

// JWT 验证中间件
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, msg: '未授权访问' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ success: false, msg: '无效的令牌' });
    }
    req.user = user;
    next();
  });
}

// ============ 管理员认证相关 API ============

// 管理员登录
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;

  db.get(
    'SELECT * FROM admin_users WHERE username = ?',
    [username],
    (err, user) => {
      if (err) {
        return res.status(500).json({ success: false, msg: '服务器错误' });
      }

      if (!user || !bcrypt.compareSync(password, user.password)) {
        return res.status(401).json({ success: false, msg: '用户名或密码错误' });
      }

      const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, {
        expiresIn: '24h'
      });

      res.json({ success: true, token, username: user.username });
    }
  );
});

// 修改管理员密码
app.post('/api/auth/change-password', authenticateToken, (req, res) => {
  const { oldPassword, newPassword } = req.body;

  db.get(
    'SELECT * FROM admin_users WHERE id = ?',
    [req.user.id],
    (err, user) => {
      if (err || !user) {
        return res.status(500).json({ success: false, msg: '服务器错误' });
      }

      if (!bcrypt.compareSync(oldPassword, user.password)) {
        return res.status(401).json({ success: false, msg: '原密码错误' });
      }

      const hashedPassword = bcrypt.hashSync(newPassword, 10);
      db.run(
        'UPDATE admin_users SET password = ? WHERE id = ?',
        [hashedPassword, req.user.id],
        (err) => {
          if (err) {
            return res.status(500).json({ success: false, msg: '密码更新失败' });
          }
          res.json({ success: true, msg: '密码修改成功' });
        }
      );
    }
  );
});

// ============ 服务器管理 API ============

// 获取所有服务器
app.get('/api/servers', authenticateToken, (req, res) => {
  db.all('SELECT id, name, host, port, username, web_base_path, created_at FROM servers', [], (err, rows) => {
    if (err) {
      return res.status(500).json({ success: false, msg: '获取服务器列表失败' });
    }
    res.json({ success: true, data: rows });
  });
});

// 添加服务器
app.post('/api/servers', authenticateToken, (req, res) => {
  const { name, host, port, username, password, webBasePath } = req.body;

  if (!name || !host || !port || !username || !password) {
    return res.status(400).json({ success: false, msg: '缺少必填字段' });
  }

  db.run(
    'INSERT INTO servers (name, host, port, username, password, web_base_path) VALUES (?, ?, ?, ?, ?, ?)',
    [name, host, port, username, password, webBasePath || ''],
    function(err) {
      if (err) {
        return res.status(500).json({ success: false, msg: '添加服务器失败' });
      }
      res.json({ success: true, msg: '服务器添加成功', id: this.lastID });
    }
  );
});

// 删除服务器
app.delete('/api/servers/:id', authenticateToken, (req, res) => {
  const { id } = req.params;

  db.run('DELETE FROM servers WHERE id = ?', [id], function(err) {
    if (err) {
      return res.status(500).json({ success: false, msg: '删除服务器失败' });
    }
    res.json({ success: true, msg: '服务器删除成功' });
  });
});

// 更新服务器信息
app.put('/api/servers/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { name, host, port, username, password, webBasePath } = req.body;

  db.run(
    'UPDATE servers SET name = ?, host = ?, port = ?, username = ?, password = ?, web_base_path = ? WHERE id = ?',
    [name, host, port, username, password, webBasePath || '', id],
    function(err) {
      if (err) {
        return res.status(500).json({ success: false, msg: '更新服务器失败' });
      }
      res.json({ success: true, msg: '服务器更新成功' });
    }
  );
});

// ============ X-UI API 代理 ============

// X-UI 登录并获取 session
async function xuiLogin(server) {
  try {
    const baseUrl = `http://${server.host}:${server.port}${server.web_base_path || ''}`;
    const response = await axios.post(
      `${baseUrl}/login`,
      {
        username: server.username,
        password: server.password
      },
      {
        httpsAgent,
        timeout: 10000
      }
    );

    // 获取 session cookie
    const cookies = response.headers['set-cookie'];
    if (cookies) {
      const sessionCookie = cookies.find(c => c.startsWith('session=') || c.startsWith('3x-ui='));
      if (sessionCookie) {
        return sessionCookie.split(';')[0];
      }
    }

    return null;
  } catch (error) {
    console.error(`登录服务器 ${server.name} 失败:`, error.message);
    throw error;
  }
}

// 获取服务器状态
app.get('/api/xui/server/:id/status', authenticateToken, async (req, res) => {
  const { id } = req.params;

  db.get('SELECT * FROM servers WHERE id = ?', [id], async (err, server) => {
    if (err || !server) {
      return res.status(404).json({ success: false, msg: '服务器不存在' });
    }

    try {
      const sessionCookie = await xuiLogin(server);
      if (!sessionCookie) {
        return res.status(401).json({ success: false, msg: '登录失败' });
      }

      const baseUrl = `http://${server.host}:${server.port}${server.web_base_path || ''}`;
      const response = await axios.post(
        `${baseUrl}/server/status`,
        {},
        {
          headers: { Cookie: sessionCookie },
          httpsAgent,
          timeout: 10000
        }
      );

      res.json({ success: true, data: response.data });
    } catch (error) {
      console.error(`获取服务器状态失败:`, error.message);
      res.status(500).json({ success: false, msg: '获取服务器状态失败', error: error.message });
    }
  });
});

// 获取入站列表
app.get('/api/xui/server/:id/inbounds', authenticateToken, async (req, res) => {
  const { id } = req.params;

  db.get('SELECT * FROM servers WHERE id = ?', [id], async (err, server) => {
    if (err || !server) {
      return res.status(404).json({ success: false, msg: '服务器不存在' });
    }

    try {
      const sessionCookie = await xuiLogin(server);
      if (!sessionCookie) {
        return res.status(401).json({ success: false, msg: '登录失败' });
      }

      const baseUrl = `http://${server.host}:${server.port}${server.web_base_path || ''}`;
      const response = await axios.get(
        `${baseUrl}/xui/inbounds`,
        {
          headers: { Cookie: sessionCookie },
          httpsAgent,
          timeout: 10000
        }
      );

      res.json({ success: true, data: response.data });
    } catch (error) {
      console.error(`获取入站列表失败:`, error.message);
      res.status(500).json({ success: false, msg: '获取入站列表失败', error: error.message });
    }
  });
});

// 添加入站
app.post('/api/xui/server/:id/inbounds', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const inboundData = req.body;

  db.get('SELECT * FROM servers WHERE id = ?', [id], async (err, server) => {
    if (err || !server) {
      return res.status(404).json({ success: false, msg: '服务器不存在' });
    }

    try {
      const sessionCookie = await xuiLogin(server);
      if (!sessionCookie) {
        return res.status(401).json({ success: false, msg: '登录失败' });
      }

      const baseUrl = `http://${server.host}:${server.port}${server.web_base_path || ''}`;
      const response = await axios.post(
        `${baseUrl}/xui/inbounds/add`,
        inboundData,
        {
          headers: { Cookie: sessionCookie },
          httpsAgent,
          timeout: 10000
        }
      );

      res.json({ success: true, data: response.data });
    } catch (error) {
      console.error(`添加入站失败:`, error.message);
      res.status(500).json({ success: false, msg: '添加入站失败', error: error.message });
    }
  });
});

// 更新入站
app.post('/api/xui/server/:id/inbounds/:inboundId', authenticateToken, async (req, res) => {
  const { id, inboundId } = req.params;
  const inboundData = req.body;

  db.get('SELECT * FROM servers WHERE id = ?', [id], async (err, server) => {
    if (err || !server) {
      return res.status(404).json({ success: false, msg: '服务器不存在' });
    }

    try {
      const sessionCookie = await xuiLogin(server);
      if (!sessionCookie) {
        return res.status(401).json({ success: false, msg: '登录失败' });
      }

      const baseUrl = `http://${server.host}:${server.port}${server.web_base_path || ''}`;
      const response = await axios.post(
        `${baseUrl}/xui/inbounds/update/${inboundId}`,
        inboundData,
        {
          headers: { Cookie: sessionCookie },
          httpsAgent,
          timeout: 10000
        }
      );

      res.json({ success: true, data: response.data });
    } catch (error) {
      console.error(`更新入站失败:`, error.message);
      res.status(500).json({ success: false, msg: '更新入站失败', error: error.message });
    }
  });
});

// 删除入站
app.post('/api/xui/server/:id/inbounds/del/:inboundId', authenticateToken, async (req, res) => {
  const { id, inboundId } = req.params;

  db.get('SELECT * FROM servers WHERE id = ?', [id], async (err, server) => {
    if (err || !server) {
      return res.status(404).json({ success: false, msg: '服务器不存在' });
    }

    try {
      const sessionCookie = await xuiLogin(server);
      if (!sessionCookie) {
        return res.status(401).json({ success: false, msg: '登录失败' });
      }

      const baseUrl = `http://${server.host}:${server.port}${server.web_base_path || ''}`;
      const response = await axios.post(
        `${baseUrl}/xui/inbounds/del/${inboundId}`,
        {},
        {
          headers: { Cookie: sessionCookie },
          httpsAgent,
          timeout: 10000
        }
      );

      res.json({ success: true, data: response.data });
    } catch (error) {
      console.error(`删除入站失败:`, error.message);
      res.status(500).json({ success: false, msg: '删除入站失败', error: error.message });
    }
  });
});

// 批量获取所有服务器状态
app.get('/api/xui/all-servers/status', authenticateToken, async (req, res) => {
  db.all('SELECT * FROM servers', [], async (err, servers) => {
    if (err) {
      return res.status(500).json({ success: false, msg: '获取服务器列表失败' });
    }

    const results = await Promise.all(
      servers.map(async (server) => {
        try {
          const sessionCookie = await xuiLogin(server);
          if (!sessionCookie) {
            return { serverId: server.id, success: false, msg: '登录失败' };
          }

          const baseUrl = `http://${server.host}:${server.port}${server.web_base_path || ''}`;
          const response = await axios.post(
            `${baseUrl}/server/status`,
            {},
            {
              headers: { Cookie: sessionCookie },
              httpsAgent,
              timeout: 10000
            }
          );

          return { serverId: server.id, success: true, data: response.data };
        } catch (error) {
          return { serverId: server.id, success: false, msg: error.message };
        }
      })
    );

    res.json({ success: true, data: results });
  });
});

// 批量获取所有服务器的入站列表
app.get('/api/xui/all-servers/inbounds', authenticateToken, async (req, res) => {
  db.all('SELECT * FROM servers', [], async (err, servers) => {
    if (err) {
      return res.status(500).json({ success: false, msg: '获取服务器列表失败' });
    }

    const results = await Promise.all(
      servers.map(async (server) => {
        try {
          const sessionCookie = await xuiLogin(server);
          if (!sessionCookie) {
            return { serverId: server.id, serverName: server.name, success: false, msg: '登录失败' };
          }

          const baseUrl = `http://${server.host}:${server.port}${server.web_base_path || ''}`;
          const response = await axios.get(
            `${baseUrl}/xui/inbounds`,
            {
              headers: { Cookie: sessionCookie },
              httpsAgent,
              timeout: 10000
            }
          );

          return { serverId: server.id, serverName: server.name, success: true, data: response.data };
        } catch (error) {
          return { serverId: server.id, serverName: server.name, success: false, msg: error.message };
        }
      })
    );

    res.json({ success: true, data: results });
  });
});

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ success: true, msg: 'X-UI Manager API 运行正常' });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`=================================`);
  console.log(`X-UI 统一管理面板后端服务已启动`);
  console.log(`运行端口: ${PORT}`);
  console.log(`默认管理员: admin / admin123`);
  console.log(`请尽快修改默认密码！`);
  console.log(`=================================`);
});

// 优雅退出
process.on('SIGINT', () => {
  db.close((err) => {
    if (err) {
      console.error('关闭数据库失败:', err);
    }
    console.log('数据库已关闭');
    process.exit(0);
  });
});
