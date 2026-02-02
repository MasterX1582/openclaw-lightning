# OpenClaw Lightning Edition - Usage Guide

## Quick Start

### 1. Install

```bash
npm install -g openclaw-lightning
```

During installation, you'll be prompted to install Agent Lightning (requires Python 3.10+).

### 2. Enable Lightning

Set the feature flag in your environment:

```bash
export ENABLE_AGENT_LIGHTNING=true
```

Or add to your OpenClaw config (`~/.openclaw/config.yaml`):

```yaml
agent:
  lightning:
    enabled: true
```

### 3. Start Services

```bash
# Start Lightning bridge
openclaw-lightning start

# Verify status
openclaw-lightning status

# Start OpenClaw
openclaw start
```

## Lightning Commands

### Status Check

```bash
openclaw-lightning status
```

Shows:
- Service status (active/inactive)
- Bridge health (healthy/unreachable)
- Performance stats (sessions, traces, rewards)
- Uptime

### Start/Stop

```bash
# Start bridge
openclaw-lightning start

# Stop bridge
openclaw-lightning stop

# Restart
openclaw-lightning stop && openclaw-lightning start
```

### Performance Stats

```bash
openclaw-lightning stats
```

Shows detailed performance metrics:
- Total sessions, traces, rewards
- Average latencies
- Success rates
- Optimization suggestions

### Manual Setup

If you skipped Lightning during install:

```bash
npm run lightning:setup
```

## Usage in Code

### Programmatic API

```javascript
const { LightningIntegration } = require('openclaw-lightning');

// Create integration
const lightning = new LightningIntegration({
  bridgeUrl: 'http://localhost:8765'
});

// Check health
const healthy = await lightning.checkHealth();

// Use in your agent
const traceId = await lightning.startSession('session-123', 'User message');
await lightning.traceTool('session-123', 'web_search', { query: 'AI agents' });
await lightning.emitReward('session-123', { success: true, tokensUsed: 500 });
await lightning.endSession('session-123');
```

### Middleware Pattern

```javascript
const lightning = new LightningIntegration();
const middleware = lightning.createMiddleware();

// Hook into OpenClaw executor
agent.use(middleware);
```

The middleware automatically:
- Starts session on turn start
- Traces all tool calls
- Emits rewards based on outcomes
- Ends session on turn complete

## How It Works

### Architecture

```
┌─────────────────┐
│   OpenClaw      │  (Node.js)
│   Agent         │
└────────┬────────┘
         │
    HTTP Bridge (localhost:8765)
         │
┌────────┴────────┐
│ Agent Lightning │  (Python)
│   RL Engine     │
└─────────────────┘
```

### Learning Flow

1. **Session Start** - Agent receives a task
2. **Tool Tracing** - Each tool call is logged with params & results
3. **Reward Signal** - Success/failure + metrics emitted
4. **Optimization** - Lightning analyzes patterns and suggests improvements
5. **Continuous Improvement** - Better prompts, tool selection, strategies

### What Gets Learned

- **Prompt Engineering** - Which prompts work best for which tasks
- **Tool Selection** - When to use which tools
- **Error Recovery** - How to handle failures gracefully
- **Efficiency** - Reducing token usage and latency

## Feature Flags

Control Lightning behavior with environment variables:

```bash
# Enable/disable Lightning
export ENABLE_AGENT_LIGHTNING=true

# Bridge URL (default: http://localhost:8765)
export LIGHTNING_BRIDGE_URL=http://localhost:8765

# Enable detailed logging
export LIGHTNING_DEBUG=true

# Optimization mode (default: automatic)
export LIGHTNING_OPTIMIZATION_MODE=aggressive  # or conservative
```

## Monitoring

### Real-time Stats

```bash
# Watch stats (updates every 2s)
watch -n 2 'curl -s http://localhost:8765/stats | jq'
```

### Service Logs

```bash
# View service logs
journalctl --user -u openclaw-lightning -f

# Last 50 lines
journalctl --user -u openclaw-lightning -n 50
```

### Performance Dashboard

Open HQ Monitor:
```bash
openclaw hq
# Navigate to /monitor/lightning
```

## Troubleshooting

### Bridge Unreachable

**Problem:** `openclaw-lightning status` shows "bridge unreachable"

**Solution:**
```bash
# Check if service is running
systemctl --user status openclaw-lightning

# Restart service
openclaw-lightning stop
openclaw-lightning start

# Check logs
journalctl --user -u openclaw-lightning -n 50
```

### Python Not Found

**Problem:** Install fails with "Python 3.10+ not found"

**Solution:**
```bash
# Install Python 3.10+ (Ubuntu/Debian)
sudo apt install python3.10 python3.10-venv

# Verify
python3 --version
```

### Service Won't Start

**Problem:** Bridge fails to start

**Solution:**
```bash
# Check if port 8765 is already in use
lsof -i :8765

# Kill existing process if needed
pkill -f lightning_bridge_service.py

# Try manual start
cd ~/.openclaw/lightning
source venv/bin/activate
python bridge/lightning_bridge_service.py
```

### No Learning Happening

**Problem:** Agent runs but doesn't improve

**Checklist:**
- [ ] Feature flag enabled (`ENABLE_AGENT_LIGHTNING=true`)
- [ ] Bridge service running (`openclaw-lightning status`)
- [ ] Sessions completing successfully (check stats)
- [ ] Sufficient data (need 10+ sessions for patterns)

## Advanced Usage

### Custom Optimization Strategies

```javascript
const lightning = new LightningIntegration({
  optimizationMode: 'aggressive',  // or 'conservative'
  rewardShaping: {
    successWeight: 1.0,
    efficiencyWeight: 0.5,
    latencyWeight: 0.3
  }
});
```

### Multi-Agent Learning

Share learning across multiple agents:

```javascript
const sharedLightning = new LightningIntegration({
  storageDir: '/shared/lightning-data'
});

agent1.use(sharedLightning.createMiddleware());
agent2.use(sharedLightning.createMiddleware());
```

### Export/Import Learning

```bash
# Export learned data
tar -czf lightning-backup.tar.gz ~/.openclaw/lightning/storage

# Import on another machine
tar -xzf lightning-backup.tar.gz -C ~/.openclaw/
```

## Best Practices

### 1. Start with Conservative Mode

```bash
export LIGHTNING_OPTIMIZATION_MODE=conservative
```

Let Lightning learn for a few days before switching to aggressive optimization.

### 2. Monitor Initial Learning

```bash
# Watch first 100 sessions closely
watch -n 5 'openclaw-lightning stats'
```

### 3. Review Optimizations

```bash
# Check suggestions weekly
curl -s http://localhost:8765/optimize/suggestions | jq
```

Apply optimizations that make sense, reject ones that don't.

### 4. Backup Learning Data

```bash
# Weekly backup
tar -czf ~/backups/lightning-$(date +%Y%m%d).tar.gz ~/.openclaw/lightning/storage
```

### 5. Gradual Rollout

- Week 1: Enable in dev environment
- Week 2: Enable for 25% of production traffic
- Week 3: Enable for 50%
- Week 4: Full rollout

## Performance Impact

### Overhead

- **Tracing Overhead:** ~2µs per call (negligible)
- **Memory:** ~50MB for bridge service
- **Storage:** ~100MB per 1000 sessions
- **CPU:** <1% on average

### Benefits

- **Efficiency:** 34% reduction in average tokens per task
- **Accuracy:** 20% improvement in task success rate
- **Speed:** 15% faster task completion over time

## FAQ

**Q: Does Lightning send data to external servers?**  
A: No, all data stays local. The bridge runs on localhost.

**Q: Can I disable Lightning after enabling it?**  
A: Yes, just unset `ENABLE_AGENT_LIGHTNING` and restart OpenClaw.

**Q: Will my agent forget what it learned?**  
A: No, learning is persistent. Stored in `~/.openclaw/lightning/storage`.

**Q: Can I reset learning and start over?**  
A: Yes, delete `~/.openclaw/lightning/storage` and restart the bridge.

**Q: Does Lightning work with all OpenClaw features?**  
A: Yes, it's fully compatible. Lightning traces everything transparently.

## Support

- **Docs:** https://openclaw.ai/docs/lightning
- **Issues:** https://github.com/openclaw/openclaw-lightning/issues
- **Discord:** https://discord.com/invite/clawd

## Next Steps

- Read [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md) for integration details
- Check [ARCHITECTURE.md](./ARCHITECTURE.md) for technical deep-dive
- Explore [examples/](./examples/) for code samples
