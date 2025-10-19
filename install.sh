#!/bin/bash

set -e

echo "======================================"
echo "   X-UI Manager 安装脚本"
echo "======================================"
echo ""

# 检查 root 权限
if [ "$EUID" -ne 0 ]; then
    echo "错误: 请使用 root 用户或 sudo 运行"
    exit 1
fi

# 检测系统
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
else
    echo "无法检测操作系统"
    exit 1
fi

echo "检测到系统: $OS"
echo ""

# 安装 Git
echo "检查 Git..."
if ! command -v git &> /dev/null; then
    echo "安装 Git..."
    if [ "$OS" = "ubuntu" ] || [ "$OS" = "debian" ]; then
        apt-get update && apt-get install -y git
    elif [ "$OS" = "centos" ] || [ "$OS" = "rhel" ]; then
        yum install -y git
    fi
fi
echo "✓ Git 已安装"

# 安装 Node.js
echo "检查 Node.js..."
if ! command -v node &> /dev/null; then
    echo "安装 Node.js..."
    if [ "$OS" = "ubuntu" ] || [ "$OS" = "debian" ]; then
        curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
        apt-get install -y nodejs
    elif [ "$OS" = "centos" ] || [ "$OS" = "rhel" ]; then
        curl -fsSL https://rpm.nodesource.com/setup_18.x | bash -
        yum install -y nodejs
    fi
fi
echo "✓ Node.js 已安装: $(node -v)"

# 克隆项目
INSTALL_DIR="/opt/xui-manager"
echo ""
echo "下载项目到 $INSTALL_DIR ..."

if [ -d "$INSTALL_DIR" ]; then
    echo "目录已存在，删除旧版本..."
    rm -rf "$INSTALL_DIR"
fi

git clone https://github.com/zyycao/to-universe.git "$INSTALL_DIR"
cd "$INSTALL_DIR"
echo "✓ 项目下载成功"

# 安装依赖
echo ""
echo "安装依赖..."
npm install
echo "✓ 依赖安装成功"

# 配置环境
echo ""
echo "配置环境变量..."
JWT_SECRET=$(openssl rand -base64 32)
cat > .env << EOF
PORT=3000
JWT_SECRET=$JWT_SECRET
EOF
echo "✓ 环境配置完成"

# 安装 PM2
echo ""
echo "安装 PM2..."
npm install -g pm2
echo "✓ PM2 安装成功"

# 启动服务
echo ""
echo "启动服务..."
pm2 delete xui-manager 2>/dev/null || true
pm2 start server.js --name xui-manager
pm2 save
pm2 startup | tail -n 1 | bash

# 配置防火墙
echo ""
echo "配置防火墙..."
if command -v ufw &> /dev/null; then
    ufw allow 3000/tcp
elif command -v firewall-cmd &> /dev/null; then
    firewall-cmd --permanent --add-port=3000/tcp
    firewall-cmd --reload
fi

# 完成
IP=$(curl -s http://ipv4.icanhazip.com)
echo ""
echo "======================================"
echo "✓ 安装完成！"
echo "======================================"
echo ""
echo "访问地址: http://${IP}:3000"
echo "默认账号: admin"
echo "默认密码: admin123"
echo ""
echo "⚠️  请登录后立即修改密码！"
echo ""
echo "常用命令:"
echo "  pm2 status        # 查看状态"
echo "  pm2 logs xui-manager  # 查看日志"
echo "  pm2 restart xui-manager  # 重启服务"
echo "======================================"
