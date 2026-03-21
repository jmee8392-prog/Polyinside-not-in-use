#!/bin/bash

# ============================================
# Polymarket Insider Tracker - Auto Deployment
# ============================================
# This script sets up the complete system on a fresh Ubuntu/Debian VM
# Usage: bash deploy.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log() {
  echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
  echo -e "${GREEN}✅ $1${NC}"
}

warn() {
  echo -e "${YELLOW}⚠️  $1${NC}"
}

error() {
  echo -e "${RED}❌ $1${NC}"
  exit 1
}

# Check if running as root for system-level installs
check_root() {
  if [[ $EUID -ne 0 ]]; then
    error "This script must be run as root. Use: sudo bash deploy.sh"
  fi
}

# Detect OS
detect_os() {
  if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
    VER=$VERSION_ID
  else
    error "Cannot detect operating system"
  fi
}

# Install Node.js
install_nodejs() {
  log "Installing Node.js 18.x..."
  
  if command -v node &> /dev/null; then
    success "Node.js already installed: $(node --version)"
    return
  fi

  case $OS in
    ubuntu|debian)
      curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
      apt-get install -y nodejs
      ;;
    centos|rhel|fedora)
      dnf install -y nodejs
      ;;
    *)
      warn "Unsupported OS for auto Node.js installation"
      return
      ;;
  esac
  
  success "Node.js installed: $(node --version)"
}

# Install system dependencies
install_dependencies() {
  log "Installing system dependencies..."
  
  case $OS in
    ubuntu|debian)
      apt-get update
      apt-get install -y build-essential python3 git curl wget gnupg lsb-release
      ;;
    centos|rhel|fedora)
      yum groupinstall -y "Development Tools"
      yum install -y python3 git curl wget gnupg
      ;;
  esac
  
  success "System dependencies installed"
}

# Install PM2 (process manager)
install_pm2() {
  log "Installing PM2..."
  
  if npm list -g pm2 &> /dev/null; then
    success "PM2 already installed"
    return
  fi

  npm install -g pm2
  success "PM2 installed"
}

# Install Nginx (reverse proxy)
install_nginx() {
  log "Installing Nginx..."
  
  case $OS in
    ubuntu|debian)
      apt-get install -y nginx
      ;;
    centos|rhel|fedora)
      yum install -y nginx
      ;;
  esac

  systemctl start nginx
  systemctl enable nginx
  success "Nginx installed and started"
}

# Setup project directory
setup_project() {
  log "Setting up project directory..."
  
  PROJECT_DIR="/opt/polymarket-tracker"
  
  if [ -d "$PROJECT_DIR" ]; then
    warn "Project directory already exists at $PROJECT_DIR"
    read -p "Do you want to overwrite it? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
      rm -rf "$PROJECT_DIR"
    else
      log "Using existing directory"
      echo "$PROJECT_DIR"
      return
    fi
  fi

  mkdir -p "$PROJECT_DIR"
  cd "$PROJECT_DIR"
  
  log "Downloading project files..."
  # Copy files (in production, would clone from git)
  # For now, assume files are provided
  
  success "Project directory created: $PROJECT_DIR"
  echo "$PROJECT_DIR"
}

# Install npm dependencies
install_npm_deps() {
  local project_dir=$1
  
  log "Installing npm dependencies..."
  
  cd "$project_dir"
  
  if [ ! -f "package.json" ]; then
    error "package.json not found in $project_dir"
  fi

  npm install --production
  success "npm dependencies installed"
}

# Setup environment file
setup_env() {
  local project_dir=$1
  
  log "Setting up environment configuration..."
  
  if [ -f "$project_dir/.env" ]; then
    warn ".env file already exists"
    return
  fi

  if [ ! -f "$project_dir/.env.example" ]; then
    error ".env.example not found"
  fi

  cp "$project_dir/.env.example" "$project_dir/.env"
  
  log "Environment file created. Please edit: $project_dir/.env"
  success "Environment setup complete"
}

# Configure Nginx
configure_nginx() {
  local domain=${1:-localhost}
  
  log "Configuring Nginx reverse proxy..."
  
  cat > /etc/nginx/sites-available/polymarket << 'EOF'
upstream polymarket_backend {
    server localhost:3001;
}

server {
    listen 80;
    server_name _;
    
    client_max_body_size 20M;
    
    # WebSocket support
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;
    
    location / {
        proxy_pass http://polymarket_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts for real-time updates
        proxy_connect_timeout 60s;
        proxy_send_timeout 3600s;
        proxy_read_timeout 3600s;
    }
    
    # Health check endpoint
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
EOF
  
  # Enable site
  if [ -e /etc/nginx/sites-enabled/default ]; then
    rm /etc/nginx/sites-enabled/default
  fi
  
  ln -sf /etc/nginx/sites-available/polymarket /etc/nginx/sites-enabled/
  
  # Test and reload
  nginx -t && systemctl reload nginx
  success "Nginx configured"
}

# Start application with PM2
start_application() {
  local project_dir=$1
  
  log "Starting application with PM2..."
  
  cd "$project_dir"
  
  # Create PM2 ecosystem file
  cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'polymarket-tracker',
    script: './polymarket_backend.js',
    instances: 1,
    exec_mode: 'cluster',
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production'
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    autorestart: true,
    watch: false,
    ignore_watch: ['node_modules', 'logs'],
    max_restarts: 10,
    min_uptime: '10s'
  }]
};
EOF
  
  mkdir -p logs
  pm2 start ecosystem.config.js
  pm2 save
  pm2 startup -u root --hp /root > /dev/null 2>&1 || true
  
  success "Application started with PM2"
}

# Setup firewall
setup_firewall() {
  log "Configuring firewall..."
  
  case $OS in
    ubuntu|debian)
      if command -v ufw &> /dev/null; then
        ufw allow 22/tcp
        ufw allow 80/tcp
        ufw allow 443/tcp
        ufw --force enable
        success "Firewall configured (UFW)"
      fi
      ;;
    centos|rhel|fedora)
      if command -v firewall-cmd &> /dev/null; then
        firewall-cmd --permanent --add-service=http
        firewall-cmd --permanent --add-service=https
        firewall-cmd --permanent --add-port=3001/tcp
        firewall-cmd --reload
        success "Firewall configured (firewalld)"
      fi
      ;;
  esac
}

# Setup backup cron
setup_backup() {
  local project_dir=$1
  
  log "Setting up database backup cron..."
  
  mkdir -p "$project_dir/backups"
  
  cat > /usr/local/bin/polymarket-backup.sh << EOF
#!/bin/bash
BACKUP_DIR="$project_dir/backups"
DB_PATH="$project_dir/polymarket_tracker.db"
DATE=\$(date +%Y%m%d_%H%M%S)

cp "\$DB_PATH" "\$BACKUP_DIR/tracker_\$DATE.db"

# Keep only last 7 days of backups
find "\$BACKUP_DIR" -name "tracker_*.db" -mtime +7 -delete

echo "Backup completed: \$DATE"
EOF
  
  chmod +x /usr/local/bin/polymarket-backup.sh
  
  # Add to crontab (every 6 hours)
  (crontab -l 2>/dev/null; echo "0 */6 * * * /usr/local/bin/polymarket-backup.sh") | crontab -
  
  success "Backup cron setup (every 6 hours)"
}

# Display summary
display_summary() {
  local project_dir=$1
  
  echo ""
  echo -e "${GREEN}╔════════════════════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║  ✅ POLYMARKET TRACKER DEPLOYED SUCCESSFULLY           ║${NC}"
  echo -e "${GREEN}╚════════════════════════════════════════════════════════╝${NC}"
  echo ""
  echo -e "${BLUE}📍 Project Directory:${NC} $project_dir"
  echo -e "${BLUE}🌐 Access Frontend:${NC} http://$(hostname -I | awk '{print $1}'):80"
  echo -e "${BLUE}📊 REST API:${NC} http://$(hostname -I | awk '{print $1}'):3001/api"
  echo -e "${BLUE}🔌 WebSocket:${NC} ws://$(hostname -I | awk '{print $1}'):3001"
  echo ""
  echo -e "${YELLOW}📝 Next Steps:${NC}"
  echo "1. Edit configuration: $project_dir/.env"
  echo "2. Check logs: pm2 logs polymarket-tracker"
  echo "3. Monitor system: pm2 monit"
  echo ""
  echo -e "${YELLOW}📚 Useful Commands:${NC}"
  echo "  pm2 start polymarket-tracker       # Start service"
  echo "  pm2 stop polymarket-tracker        # Stop service"
  echo "  pm2 restart polymarket-tracker     # Restart service"
  echo "  pm2 logs polymarket-tracker        # View logs"
  echo "  pm2 monit                          # Monitor system"
  echo "  pm2 delete polymarket-tracker      # Remove from PM2"
  echo ""
}

# Main deployment flow
main() {
  log "Starting Polymarket Insider Tracker deployment..."
  echo ""
  
  check_root
  detect_os
  
  log "Detected OS: $OS"
  
  install_dependencies
  install_nodejs
  install_pm2
  install_nginx
  
  PROJECT_DIR=$(setup_project)
  install_npm_deps "$PROJECT_DIR"
  setup_env "$PROJECT_DIR"
  
  configure_nginx
  setup_firewall
  setup_backup "$PROJECT_DIR"
  
  start_application "$PROJECT_DIR"
  
  sleep 2
  display_summary "$PROJECT_DIR"
}

# Run deployment
main

exit 0
