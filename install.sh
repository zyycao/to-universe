#!/bin/bash

# X-UI Manager 一键安装脚本
# 适用于 Debian/Ubuntu/CentOS

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

detect_os() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$ID
        VERSION=$VERSION_ID
    else
        print_error "无法检测操作系统"
        exit 1
    fi
    
    print_info "检测到操作系统: $OS $VERSION"
}

check_root() {
    if [ "$EUID" -ne 0 ]; then
        print_error "请使用 root 用户或 sudo 运行此脚本"
        exit 1
    fi
}

install_nodejs() {
    print_info "检查 Node.js 安装状态..."
    
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node -v)
        print_success "Node.js 已安装: $NODE_VERSION"
        return
    fi
    
    print_info "开始安装 Node.js..."
    
    if [ "$OS" = "ubuntu" ] || [ "$OS" = "debian" ]; then
        curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
        apt-get install -y nodejs
    elif [ "$OS" = "centos" ] || [ "$OS" = "rhel" ]; then
        curl -fsSL https://rpm.nodesource.com/setup_18.x | bash -
        yum install -y nodejs
    else
        print_error "不支持的操作系统: $OS"
        exit 1
    fi
    
    if command -v node &> /dev/null; then
        print_success "Node.js 安装成功: $(node -v)"
    else
        print_error "Node.js 安装失败"
        exit 1
    fi
}

install_git() {
    print_info "检查 Git 安装状态..."
    
    if command -v git &> /dev/null; then
        print_success "Git 已安装: $(git --version)"
        return
    fi
    
    print_info "开始安装 Git..."
    
    if [ "$OS" = "ubuntu" ] || [ "$OS" = "debian" ]; then
        apt-get update
        apt-get install -y git
    elif [ "$OS" = "centos" ] || [ "$OS" = "rhel" ]; then
        yum install -y git
    fi
    
    print_success "Git 安装成功"
}

clone_project() {
    INSTALL_DIR="/opt/xui-manager"
    GITHUB_REPO="https://github.com/你的用户名/xui-manager.git"
    
    print_info "开始下载项目..."
    
    if [ -d "$INSTALL_DIR" ]; then
        print_warning "目录 $INSTALL_DIR 已存在"
        read -p "是否删除并重新安装？(y/n): " -r
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            rm -rf "$INSTALL_DIR"
        else
            print_error "安装已取消"
            exit 1
        fi
    fi
    
    git clone "$GITHUB_REPO" "$INSTALL_DIR"
    cd "$INSTALL_DIR"
    
    print_success "项目下载成功"
}

install_dependencies() {
    print_info "安装项目依赖..."
    cd "$INSTALL_DIR"
    npm install
    print_success "依赖安装成功"
}

configure_env() {
    print_info "配置环境变量..."
    cd "$INSTALL_DIR"
    
    if [ -f .env ]; then
        print_warning ".env 文件已存在，跳过配置"
        return
    fi
    
    JWT_SECRET=$(openssl rand -base64 32)
    
    read -p "请输入服务端口 (默认 3000): " PORT
    PORT=${PORT:-3000}
    
    cat > .env << EOF
PORT=$PORT
JWT_SECRET=$JWT_SECRET
EOF
    
    print_success "环境变量配置成功"
}

configure_firewall() {
    print_info "配置防火墙..."
    
    PORT=$(grep PORT "$INSTALL_DIR/.env" | cut -d '=' -f2)
    
    if command -v ufw &> /dev/null; then
        ufw allow "$PORT/tcp"
        print_success "UFW 防火墙已配置"
    elif command -v firewall-cmd &> /dev/null; then
        firewall-cmd --permanent --add-port="$PORT/tcp"
        firewall-cmd --reload
        print_success "Firewalld 防火墙已配置"
    else
        print_warning "未检测到防火墙，请手动开放端口 $PORT"
    fi
}

install_pm2() {
    print_info "安装 PM2..."
    
    if command -v pm2 &> /dev/null; then
        print_success "PM2 已安装"
        return
    fi
    
    npm install -g pm2
    print_success "PM2 安装成功"
}

start_service() {
    print_info "启动服务..."
    cd "$INSTALL_DIR"
    
    pm2 delete xui-manager 2>/dev/null || true
    
    pm2 start server.js --name xui-manager
    pm2 save
    
    pm2 startup | tail -n 1 | bash
    
    print_success "服务启动成功"
}

show_completion_info() {
    PORT=$(grep PORT "$INSTALL_DIR/.env" | cut -d '=' -f2)
    IP=$(curl -s http://ipv4.icanhazip.com)
    
    echo ""
    echo "========================================"
    echo -e "${GREEN}X-UI Manager 安装完成！${NC}"
    echo "========================================"
    echo ""
    echo -e "访问地址: ${BLUE}http://${IP}:${PORT}${NC}"
    echo -e "默认账号: ${YELLOW}admin${NC}"
    echo -e "默认密码: ${YELLOW}admin123${NC}"
    echo ""
    echo -e "${RED}⚠️  请登录后立即修改默认密码！${NC}"
    echo ""
    echo "常用命令："
    echo "  启动服务: pm2 start xui-manager"
    echo "  停止服务: pm2 stop xui-manager"
    echo "  重启服务: pm2 restart xui-manager"
    echo "  查看日志: pm2 logs xui-manager"
    echo "  查看状态: pm2 status"
    echo ""
    echo "项目目录: $INSTALL_DIR"
    echo "========================================"
}

main() {
    clear
    echo "========================================"
    echo "   X-UI Manager 一键安装脚本"
    echo "========================================"
    echo ""
    
    check_root
    detect_os
    
    echo ""
    read -p "确认开始安装？(y/n): " -r
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_error "安装已取消"
        exit 1
    fi
    
    echo ""
    print_info "开始安装..."
    echo ""
    
    install_git
    install_nodejs
    clone_project
    install_dependencies
    configure_env
    configure_firewall
    install_pm2
    start_service
    
    echo ""
    show_completion_info
}

main
