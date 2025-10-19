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
async function xuiLogin(server)
