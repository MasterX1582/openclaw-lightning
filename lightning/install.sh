#!/bin/bash
# Agent Lightning Installer for OpenClaw
# Adds RL-powered learning to your OpenClaw instance

set -e

echo "============================================================"
echo "Agent Lightning Installer for OpenClaw"
echo "============================================================"
echo ""

# Check if running as root
if [ "$EUID" -eq 0 ]; then 
   echo "❌ Please don't run as root - use a normal user"
   exit 1
fi

# Detect OpenClaw installation
OPENCLAW_DIR="${OPENCLAW_DIR:-$HOME/.openclaw}"
LIGHTNING_DIR="${LIGHTNING_DIR:-$HOME/clawd/agent-lightning}"

echo "📍 OpenClaw directory: $OPENCLAW_DIR"
echo "📍 Lightning directory: $LIGHTNING_DIR"
echo ""

# Check Python version
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 not found. Please install Python 3.10+"
    exit 1
fi

PYTHON_VERSION=$(python3 --version | cut -d' ' -f2 | cut -d'.' -f1,2)
echo "✓ Python version: $PYTHON_VERSION"

# Check if Lightning directory exists
if [ ! -d "$LIGHTNING_DIR" ]; then
    echo ""
    echo "📦 Cloning Agent Lightning..."
    mkdir -p "$(dirname $LIGHTNING_DIR)"
    cd "$(dirname $LIGHTNING_DIR)"
    git clone https://github.com/microsoft/agent-lightning.git
    cd agent-lightning
else
    echo "✓ Agent Lightning directory exists"
    cd "$LIGHTNING_DIR"
fi

# Create venv if needed
if [ ! -d "venv" ]; then
    echo ""
    echo "🔧 Creating Python virtual environment..."
    python3 -m venv venv
fi

# Activate venv and install
echo ""
echo "📦 Installing Agent Lightning..."
source venv/bin/activate
pip install -q --upgrade pip
pip install -q -e .
pip install -q aiohttp  # For bridge service

echo "✓ Agent Lightning installed"

# Copy integration files
echo ""
echo "📋 Installing integration files..."

# Determine package location
if [ -n "$NPM_PREFIX_OPENCLAW_LIGHTNING" ]; then
    PACKAGE_DIR="$NPM_PREFIX_OPENCLAW_LIGHTNING"
elif [ -d "$(npm root -g)/openclaw-lightning" ]; then
    PACKAGE_DIR="$(npm root -g)/openclaw-lightning"
elif [ -d "node_modules/openclaw-lightning" ]; then
    PACKAGE_DIR="node_modules/openclaw-lightning"
else
    echo "⚠️  Could not find openclaw-lightning package"
    echo "   Trying to copy from current directory..."
    PACKAGE_DIR="."
fi

echo "📦 Package location: $PACKAGE_DIR"

# Copy bridge service files
if [ -f "$PACKAGE_DIR/lightning/bridge/lightning_bridge_service.py" ]; then
    cp "$PACKAGE_DIR/lightning/bridge/lightning_bridge_service.py" .
    echo "✓ Copied lightning_bridge_service.py"
else
    echo "❌ lightning_bridge_service.py not found"
    exit 1
fi

if [ -f "$PACKAGE_DIR/lightning/bridge/openclaw_integration.py" ]; then
    cp "$PACKAGE_DIR/lightning/bridge/openclaw_integration.py" .
    echo "✓ Copied openclaw_integration.py"
else
    echo "❌ openclaw_integration.py not found"
    exit 1
fi

# Copy systemd service file
echo ""
echo "🔧 Setting up systemd service..."

SERVICE_FILE="$HOME/.config/systemd/user/openclaw-lightning.service"
mkdir -p "$HOME/.config/systemd/user"

cat > "$SERVICE_FILE" << EOF
[Unit]
Description=Agent Lightning Bridge for OpenClaw
After=network.target

[Service]
Type=simple
WorkingDirectory=$LIGHTNING_DIR
Environment="ENABLE_AGENT_LIGHTNING=true"
Environment="LIGHTNING_BRIDGE_PORT=8765"
ExecStart=$LIGHTNING_DIR/venv/bin/python3 $LIGHTNING_DIR/lightning_bridge_service.py
Restart=always
RestartSec=10

[Install]
WantedBy=default.target
EOF

echo "✓ Systemd service created: $SERVICE_FILE"

# Enable and start service
echo ""
echo "🚀 Starting Agent Lightning bridge service..."
systemctl --user daemon-reload
systemctl --user enable openclaw-lightning.service
systemctl --user start openclaw-lightning.service

# Check status
sleep 2
if systemctl --user is-active --quiet openclaw-lightning.service; then
    echo "✓ Bridge service is running"
else
    echo "⚠️  Bridge service failed to start - check logs:"
    echo "   journalctl --user -u openclaw-lightning.service"
fi

# Test the service
echo ""
echo "🧪 Testing bridge service..."
if curl -s http://localhost:8765/health > /dev/null; then
    echo "✓ Bridge service responding"
    curl -s http://localhost:8765/health | python3 -m json.tool
else
    echo "⚠️  Bridge service not responding on port 8765"
fi

echo ""
echo "============================================================"
echo "✅ Agent Lightning Installation Complete!"
echo "============================================================"
echo ""
echo "Service status:"
echo "  systemctl --user status openclaw-lightning.service"
echo ""
echo "View logs:"
echo "  journalctl --user -u openclaw-lightning.service -f"
echo ""
echo "Health check:"
echo "  curl http://localhost:8765/health"
echo ""
echo "To disable:"
echo "  systemctl --user stop openclaw-lightning.service"
echo "  systemctl --user disable openclaw-lightning.service"
echo ""
echo "To enable tracing in OpenClaw:"
echo "  Add to your OpenClaw config or environment:"
echo "  LIGHTNING_BRIDGE_URL=http://localhost:8765"
echo ""
echo "Next steps:"
echo "  1. Restart OpenClaw gateway"
echo "  2. Check that tracing is enabled in logs"
echo "  3. Monitor performance for 1-2 days"
echo "  4. Analyze collected data"
echo ""
