# X-UI 统一管理面板

🚀 一个用于统一管理多台 X-UI 服务器的 Web 面板

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D14.0.0-brightgreen.svg)

## ✨ 功能特点

- 🖥️ 统一管理多台 X-UI 服务器
- 📊 实时监控服务器状态（CPU、内存、磁盘、网络）
- 📡 查看和管理所有入站配置
- 🔄 批量操作支持
- 🔐 安全的 JWT 认证
- 📱 响应式设计，支持移动端
- 🌍 中文界面

## 📸 功能预览

- 统一仪表盘查看所有服务器状态
- 实时流量监控
- 入站配置管理
- 批量刷新状态

## 🚀 快速开始

### 前置要求

- Node.js >= 14.0.0
- npm 或 yarn
- 至少一台已安装 X-UI 的服务器

### 方式1: 一键安装（推荐）
```bash
bash <(curl -Ls https://raw.githubusercontent.com/zyycao/to-universe/main/install.sh)
```

### 方式2: 手动安装

#### 1. 克隆项目
```bash
git clone https://github.com/zyycao/to-universe.git
cd to-universe
```

#### 2. 安装依赖
```bash
npm install
```

#### 3. 配置环境变量
```bash
cp .env.example .env
nano .env
```

编辑 `.env` 文件：
```env
PORT=3000
JWT_SECRET=your-super-secret-key-change-this
```

**⚠️ 重要：请修改 JWT_SECRET 为复杂的随机字符串！**

#### 4. 启动服务
```bash
# 开发模式
npm run dev

# 生产模式
npm start
```

#### 5. 访问面板

打开浏览器访问: `http://localhost:3000`

**默认登录信息：**
- 用户名: `admin`
- 密码: `admin123`

**⚠️ 首次登录后请立即修改密码！**

---

## 📦 使用 PM2 部署（推荐生产环境）
```bash
# 安装 PM2
npm install -g pm2

# 启动服务
pm2 start server.js --name xui-manager

# 设置开机自启
pm2 startup
pm2 save

# 常用命令
pm2 status              # 查看状态
pm2 logs xui-manager    # 查看日志
pm2 restart xui-manager # 重启服务
pm2 stop xui-manager    # 停止服务
```

---

## 🔧 使用说明

### 1. 添加服务器

1. 登录管理面板
2. 点击右上角 "**添加服务器**" 按钮
3. 填写服务器信息：
   - **服务器名称**：自定义名称，如 "美国-洛杉矶-1"
   - **服务器IP/域名**：X-UI 面板的 IP 地址或域名
   - **端口**：X-UI 面板端口（默认 54321）
   - **用户名**：X-UI 登录用户名
   - **密码**：X-UI 登录密码
   - **Web路径**（可选）：如果设置了自定义路径，填写（如 `/xui`）

### 2. 查看服务器状态

- 切换到 "**服务器状态**" 标签页
- 点击单个服务器的 "**获取状态**" 按钮
- 或点击顶部 "**刷新全部**" 批量查看所有服务器

### 3. 管理入站配置

- 切换到 "**入站配置**" 标签页
- 查看所有服务器的入站配置
- 查看协议、端口、流量使用情况

### 4. 服务器管理

- 切换到 "**服务器管理**" 标签页
- 查看所有已添加的服务器列表
- 可以直接打开原 X-UI 面板
- 删除不需要的服务器

---

## 🔒 安全建议

1. ✅ **修改默认密码**
   - 登录后立即在面板中修改管理员密码

2. ✅ **设置强 JWT 密钥**
   - 在 `.env` 文件中设置复杂的随机字符串
```bash
   JWT_SECRET=$(openssl rand -base64 32)
```

3. ✅ **使用防火墙限制访问**
```bash
   # 只允许特定IP访问
   ufw allow from 你的IP地址 to any port 3000
```

4. ✅ **配置 HTTPS**
   - 使用 Nginx 反向代理
   - 配置 SSL 证书（推荐使用 Let's Encrypt）

5. ✅ **定期备份数据库**
```bash
   cp /opt/to-universe/xui-manager.db /backup/xui-manager-$(date +%Y%m%d).db
```

---

## 🌐 配置 Nginx 反向代理（可选）

### 基础配置
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 配置 HTTPS
```bash
# 安装 Certbot
apt install certbot python3-certbot-nginx

# 申请证书
certbot --nginx -d your-domain.com

# 自动续期
certbot renew --dry-run
```

---

## 🐛 故障排查

### 问题1: 无法连接到 X-UI 服务器

**症状**：显示 "登录失败" 或 "获取服务器状态失败"

**解决方法**：
1. 检查服务器 IP 和端口是否正确
2. 确认 X-UI 面板可以正常访问
3. 检查防火墙是否开放了对应端口
4. 确认用户名和密码正确
5. 检查 Web 路径是否填写正确

### 问题2: 端口被占用

**症状**：`Error: listen EADDRINUSE: address already in use :::3000`

**解决方法**：
```bash
# 查找占用端口的进程
lsof -i :3000
# 或
netstat -tlnp | grep 3000

# 停止进程或修改端口
PORT=3001 npm start
```

### 问题3: 数据库错误

**症状**：启动时提示数据库错误

**解决方法**：
```bash
# 删除数据库重新创建
cd /opt/to-universe
rm xui-manager.db
npm start  # 会自动重新创建
```

### 问题4: PM2 服务无法启动

**解决方法**：
```bash
# 查看详细日志
pm2 logs xui-manager --lines 100

# 删除并重新启动
pm2 delete xui-manager
pm2 start server.js --name xui-manager
```

---

## 📚 API 文档

完整的 API 文档请查看：[API.md](docs/API.md)

主要端点：
- `POST /api/auth/login` - 管理员登录
- `GET /api/servers` - 获取服务器列表
- `POST /api/servers` - 添加服务器
- `GET /api/xui/server/:id/status` - 获取服务器状态
- `GET /api/xui/server/:id/inbounds` - 获取入站列表
- `GET /api/xui/all-servers/status` - 批量获取所有服务器状态

---

## 🔄 更新升级
```bash
cd /opt/to-universe

# 备份数据库
cp xui-manager.db xui-manager.db.backup

# 停止服务
pm2 stop xui-manager

# 拉取最新代码
git pull origin main

# 更新依赖
npm install

# 重启服务
pm2 restart xui-manager
```

---

## 🤝 贡献

欢迎提交 Pull Request 或 Issue！

### 贡献步骤

1. Fork 本项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 提交 Pull Request

---

## 📋 待开发功能

- [ ] 批量添加用户到所有服务器
- [ ] 流量统计图表
- [ ] 告警通知（Telegram Bot / 邮件）
- [ ] 多管理员支持
- [ ] 自动备份配置
- [ ] Docker 一键部署

---

## 📜 开源协议

本项目采用 [MIT](LICENSE) 协议

---

## ⚠️ 免责声明

本项目仅供学习和个人使用，请勿用于非法用途。使用本项目所产生的一切后果由使用者自行承担。

---

## 📧 联系方式

- GitHub Issues: [提交问题](https://github.com/zyycao/to-universe/issues)
- 项目地址: https://github.com/zyycao/to-universe

---

## 🌟 Star History

如果这个项目对你有帮助，请给个 Star ⭐️

[![Star History Chart](https://api.star-history.com/svg?repos=zyycao/to-universe&type=Date)](https://star-history.com/#zyycao/to-universe&Date)

---

**Made with ❤️ by zyycao**
