# OpenClaw Lightning Edition - Installation Guide

## Prerequisites

### Required
- **Node.js:** 18.0.0 or higher
- **npm:** 8.0.0 or higher

### Optional (for Lightning)
- **Python:** 3.10 or higher
- **systemd:** For service management (Linux only)

## Installation Methods

### Method 1: Global Install (Recommended)

Install OpenClaw Lightning globally:

```bash
npm install -g openclaw-lightning
```

During installation:
1. You'll be prompted to install Agent Lightning
2. If Python 3.10+ is detected, installation proceeds automatically
3. If Python is missing, Lightning is skipped (can install later)

### Method 2: Local Install

Install in your project:

```bash
npm install openclaw-lightning
```

Then run setup:

```bash
npx openclaw-lightning setup
```

### Method 3: From Source

Clone and build:

```bash
git clone https://github.com/openclaw/openclaw-lightning.git
cd openclaw-lightning
npm install
npm run lightning:setup
npm link  # For global use
```

## Post-Install Setup

### 1. Verify Installation

```bash
# Check OpenClaw
openclaw --version

# Check Lightning
openclaw-lightning status
```

Expected output:
```
Service:      ✅ active
Bridge:       ✅ healthy
URL:          http://localhost:8765
```

### 2. Enable Lightning

Add to your OpenClaw config (`~/.openclaw/config.yaml`):

```yaml
agent:
  lightning:
    enabled: true
    bridgeUrl: http://localhost:8765
```

Or use environment variable:

```bash
export ENABLE_AGENT_LIGHTNING=true
```

### 3. Start Services

```bash
# Start Lightning bridge
openclaw-lightning start

# Start OpenClaw
openclaw start
```

## Manual Lightning Installation

If you skipped Lightning during install:

```bash
npm run lightning:setup
```

This will:
1. Check Python version
2. Create virtual environment
3. Install agentlightning package
4. Set up bridge service
5. Configure systemd (Linux)

## Platform-Specific Notes

### Linux (Ubuntu/Debian)

Install Python 3.10+ if needed:

```bash
sudo apt update
sudo apt install python3.10 python3.10-venv python3-pip
```

systemd service is automatically configured.

### macOS

Install Python via Homebrew:

```bash
brew install python@3.10
```

**Note:** systemd not available on macOS. Run bridge manually:

```bash
python3 lightning/bridge/lightning_bridge_service.py
```

Or use launchd (advanced).

### Windows

Install Python from [python.org](https://www.python.org/downloads/) (3.10+)

**Note:** systemd not available. Run bridge as a Windows service or manually:

```bash
python lightning\bridge\lightning_bridge_service.py
```

## Configuration

### OpenClaw Config

Edit `~/.openclaw/config.yaml`:

```yaml
agent:
  # Enable Lightning
  lightning:
    enabled: true
    bridgeUrl: http://localhost:8765
    
  # Optimization settings
  optimization:
    mode: conservative  # or aggressive
    autoApply: false    # Review suggestions manually
    
  # Storage
  storage:
    dir: ~/.openclaw/lightning/storage
    maxSize: 1GB
```

### Lightning Config

Lightning configuration is in `~/.openclaw/lightning/config.json`:

```json
{
  "bridge": {
    "host": "127.0.0.1",
    "port": 8765
  },
  "optimization": {
    "mode": "conservative",
    "minSessions": 10,
    "confidence": 0.8
  },
  "storage": {
    "backend": "local",
    "dir": "~/.openclaw/lightning/storage"
  }
}
```

## Verification

### Test Lightning Integration

```bash
# Create test session
cat > test-lightning.js << 'EOF'
const { LightningIntegration } = require('openclaw-lightning');

async function test() {
  const lightning = new LightningIntegration();
  
  // Check health
  const healthy = await lightning.checkHealth();
  console.log('Bridge healthy:', healthy);
  
  // Test session
  const traceId = await lightning.startSession('test-1', 'Test message');
  console.log('Session started:', traceId);
  
  await lightning.endSession('test-1');
  console.log('Session ended');
}

test().catch(console.error);
EOF

node test-lightning.js
```

Expected output:
```
Bridge healthy: true
Session started: trace_abc123
Session ended
```

### Check Service Status

```bash
openclaw-lightning status
```

Should show all green checkmarks.

### View Logs

```bash
# Lightning bridge logs
journalctl --user -u openclaw-lightning -f

# OpenClaw logs
openclaw logs
```

## Troubleshooting

### Problem: "Python not found"

**Solution:**
```bash
# Install Python 3.10+
sudo apt install python3.10 python3.10-venv  # Ubuntu/Debian
brew install python@3.10                      # macOS

# Verify
python3 --version
```

### Problem: "Bridge unreachable"

**Solution:**
```bash
# Check if bridge is running
curl http://localhost:8765/health

# If not, start it
openclaw-lightning start

# Check logs
journalctl --user -u openclaw-lightning -n 50
```

### Problem: "Port 8765 already in use"

**Solution:**
```bash
# Find process using port
lsof -i :8765

# Kill it
kill -9 <PID>

# Or change bridge port in config
```

### Problem: "Permission denied"

**Solution:**
```bash
# Make scripts executable
chmod +x ~/.openclaw/lightning/bridge/*.py
chmod +x $(npm root -g)/openclaw-lightning/scripts/*.js

# If systemd service fails, check permissions
systemctl --user status openclaw-lightning
```

### Problem: "Module not found: agentlightning"

**Solution:**
```bash
# Activate venv and reinstall
cd ~/.openclaw/lightning
source venv/bin/activate
pip install agentlightning
```

## Uninstallation

### Remove OpenClaw Lightning

```bash
# Stop services
openclaw-lightning stop
openclaw stop

# Uninstall package
npm uninstall -g openclaw-lightning

# Remove data (optional)
rm -rf ~/.openclaw/lightning
```

### Keep Learning Data

To preserve learned data for future reinstall:

```bash
# Backup before uninstall
tar -czf ~/openclaw-lightning-backup.tar.gz ~/.openclaw/lightning

# Restore after reinstall
tar -xzf ~/openclaw-lightning-backup.tar.gz -C ~/
```

## Upgrade

### Upgrade OpenClaw Lightning

```bash
npm update -g openclaw-lightning
```

Learning data is preserved during upgrades.

### Upgrade Agent Lightning

```bash
cd ~/.openclaw/lightning
source venv/bin/activate
pip install --upgrade agentlightning
```

## Next Steps

- Read [USAGE.md](./USAGE.md) for usage guide
- Check [QUICKSTART.md](./QUICKSTART.md) for first steps
- Explore [examples/](./examples/) for code samples

## Support

- **Documentation:** https://openclaw.ai/docs/lightning
- **Issues:** https://github.com/openclaw/openclaw-lightning/issues
- **Discord:** https://discord.com/invite/clawd
- **Email:** support@openclaw.ai
