# OpenClaw Lightning - Architecture

## Overview

OpenClaw Lightning Edition is a **hybrid package** that combines:
- OpenClaw (Node.js/TypeScript agent framework)
- Agent Lightning (Python RL engine)

Connected via an HTTP bridge service running on localhost.

## Architecture Diagram

```
┌────────────────────────────────────────────────────────────┐
│                    OpenClaw Agent                          │
│                  (Node.js/TypeScript)                      │
│                                                            │
│  ┌──────────────┐      ┌─────────────────────────┐       │
│  │   Session    │      │  Lightning Integration  │       │
│  │   Manager    │─────▶│      (middleware)       │       │
│  └──────────────┘      └───────────┬─────────────┘       │
│                                    │                       │
│                                    │ HTTP                  │
└────────────────────────────────────┼───────────────────────┘
                                     │
                                     │ localhost:8765
                                     │
┌────────────────────────────────────┼───────────────────────┐
│                                    ▼                       │
│              ┌──────────────────────────────┐             │
│              │   Lightning Bridge Service   │             │
│              │      (FastAPI/Python)        │             │
│              └─────────────┬────────────────┘             │
│                            │                               │
│                            ▼                               │
│              ┌──────────────────────────────┐             │
│              │      Agent Lightning         │             │
│              │      (RL Engine)             │             │
│              │                              │             │
│              │  ┌────────────────────────┐  │             │
│              │  │  Tracing Layer         │  │             │
│              │  ├────────────────────────┤  │             │
│              │  │  Storage (SQLite)      │  │             │
│              │  ├────────────────────────┤  │             │
│              │  │  Optimizer (APO)       │  │             │
│              │  └────────────────────────┘  │             │
│              └──────────────────────────────┘             │
│                       (Python)                             │
└────────────────────────────────────────────────────────────┘
```

## Components

### 1. OpenClaw Agent (Node.js)

**Location:** User's OpenClaw installation  
**Role:** Main agent runtime

- Executes agent turns
- Manages sessions
- Calls tools
- Generates responses

**Lightning Integration:**
- Optional middleware hooks into execution
- Traces sessions, tools, outcomes
- Sends data to bridge via HTTP

### 2. Lightning Integration (JavaScript)

**Location:** `lib/integration.js`  
**Role:** Bridge between OpenClaw and Lightning

**Key Methods:**
- `startSession()` - Begin tracing a new session
- `traceTool()` - Log tool call with params/results
- `emitReward()` - Send performance signal
- `endSession()` - Finalize session trace

**Feature Flag:** `ENABLE_AGENT_LIGHTNING`
- When false: All methods become no-ops
- When true: Data flows to Lightning

### 3. Bridge Service (Python)

**Location:** `lightning/bridge/lightning_bridge_service.py`  
**Role:** HTTP API for Lightning

**Endpoints:**
```
GET  /health              - Health check
POST /session/start       - Start session trace
POST /tool/trace          - Trace tool call
POST /reward/emit         - Emit reward signal
POST /session/end         - End session
GET  /optimize/suggestions - Get optimizations
GET  /stats               - Performance stats
```

**Technology:**
- FastAPI (async Python web framework)
- Runs on localhost:8765
- Managed by systemd (Linux)

### 4. Agent Lightning (Python)

**Location:** `~/.openclaw/lightning/venv/`  
**Role:** RL engine

**Features:**
- Trace storage (SQLite)
- Pattern detection
- APO (Automatic Prompt Optimization)
- Multi-session learning
- Performance analytics

## Data Flow

### Session Lifecycle

```
1. User Message Arrives
   ↓
2. OpenClaw: lightning.startSession(sessionKey, message)
   ↓
3. Bridge: POST /session/start → Lightning.start_trace()
   ↓
4. Lightning: Creates trace, returns trace_id
   ↓
5. OpenClaw: Executes tools
   ↓
6. OpenClaw: lightning.traceTool(toolName, params, result)
   ↓
7. Bridge: POST /tool/trace → Lightning.trace_tool_call()
   ↓
8. Lightning: Stores tool event
   ↓
9. OpenClaw: Generates response
   ↓
10. OpenClaw: lightning.emitReward({ success, tokens, latency })
    ↓
11. Bridge: POST /reward/emit → Lightning.emit_reward()
    ↓
12. Lightning: Records reward signal
    ↓
13. OpenClaw: lightning.endSession()
    ↓
14. Bridge: POST /session/end → Lightning.finalize_trace()
    ↓
15. Lightning: Closes trace, triggers optimization
```

### Optimization Loop

```
1. Lightning accumulates traces (10+ sessions)
   ↓
2. Pattern detection identifies successful strategies
   ↓
3. APO generates prompt optimization suggestions
   ↓
4. Suggestions exposed via /optimize/suggestions
   ↓
5. User reviews and applies (manual or auto)
   ↓
6. New prompts tested in production
   ↓
7. Results traced, cycle repeats
```

## Storage

### OpenClaw Data

**Location:** `~/.openclaw/`
```
.openclaw/
├── config.yaml           # Main config
├── sessions/             # Session state
├── memory/               # Agent memory
└── logs/                 # OpenClaw logs
```

### Lightning Data

**Location:** `~/.openclaw/lightning/`
```
lightning/
├── venv/                 # Python environment
├── storage/
│   ├── traces.db         # SQLite database
│   ├── optimizations/    # APO suggestions
│   └── metrics/          # Performance data
├── bridge/
│   ├── lightning_bridge_service.py
│   └── openclaw_integration.py
└── config.json           # Lightning config
```

### Trace Schema

```sql
CREATE TABLE traces (
  trace_id TEXT PRIMARY KEY,
  session_key TEXT,
  message TEXT,
  start_time INTEGER,
  end_time INTEGER,
  success BOOLEAN,
  tokens_used INTEGER,
  latency_ms INTEGER,
  tools_used TEXT,  -- JSON array
  metadata TEXT     -- JSON object
);

CREATE TABLE tool_calls (
  id INTEGER PRIMARY KEY,
  trace_id TEXT,
  tool_name TEXT,
  params TEXT,      -- JSON
  result TEXT,      -- JSON
  error TEXT,
  timestamp INTEGER
);
```

## Security

### Isolation

- Bridge only binds to `127.0.0.1` (localhost)
- No external network access
- All data stays local

### Authentication

- Bridge has no authentication (localhost only)
- If exposing externally: Add API key auth

### Privacy

- No telemetry
- No external API calls
- No data sharing
- Fully self-contained

## Performance

### Overhead

**Tracing:**
- Per-call overhead: ~2µs
- Network latency: ~0.5ms (localhost HTTP)
- Storage write: ~1ms (async)

**Total per session:** ~5-10ms

**Negligible impact** - less than 1% of typical agent execution time.

### Resource Usage

**Bridge Service:**
- Memory: ~50MB
- CPU: <1% idle, ~5% during active tracing
- Disk I/O: ~10KB/session

**Lightning Engine:**
- Memory: ~100MB (SQLite cache)
- CPU: <1% except during optimization
- Disk: ~100MB per 1000 sessions

### Scaling

**Concurrent Sessions:**
- Bridge handles 100+ concurrent sessions
- SQLite supports high write throughput
- No bottlenecks observed in testing

**Long-term:**
- Database grows ~100MB per 1000 sessions
- Auto-cleanup after 30 days (configurable)
- Optimization runs incrementally

## Deployment

### Development

```bash
# Start bridge manually
cd ~/.openclaw/lightning
source venv/bin/activate
python bridge/lightning_bridge_service.py
```

### Production (Linux)

```bash
# systemd service (auto-starts on boot)
systemctl --user enable openclaw-lightning
systemctl --user start openclaw-lightning
```

### Production (macOS)

```bash
# launchd plist (advanced users)
cp lightning/launchd/com.openclaw.lightning.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.openclaw.lightning.plist
```

### Production (Windows)

```bash
# NSSM (Non-Sucking Service Manager)
nssm install OpenClawLightning python lightning\bridge\lightning_bridge_service.py
nssm start OpenClawLightning
```

## Failure Modes

### Bridge Unavailable

**Scenario:** Bridge service crashes or port blocked

**Behavior:**
- Lightning integration catches connection errors
- Falls back to no-op (agent continues normally)
- Logs warning, no data traced

**Recovery:**
- Restart bridge service
- Tracing resumes automatically

### Python Error

**Scenario:** Lightning engine throws exception

**Behavior:**
- Bridge catches exception, returns 500
- Integration logs error, continues
- Session completes without tracing

**Recovery:**
- Check logs: `journalctl --user -u openclaw-lightning`
- Fix config or code issue
- Restart service

### Disk Full

**Scenario:** Storage disk fills up

**Behavior:**
- SQLite write fails
- Bridge returns error
- Integration logs, continues

**Recovery:**
- Free disk space
- Run cleanup: `rm -rf ~/.openclaw/lightning/storage/*`
- Restart bridge

## Monitoring

### Health Check

```bash
curl http://localhost:8765/health
# {"status": "healthy", "uptime": 3600}
```

### Metrics

```bash
curl http://localhost:8765/stats
# {
#   "total_sessions": 150,
#   "total_traces": 450,
#   "avg_latency_ms": 3.2,
#   "success_rate": 0.89
# }
```

### Logs

```bash
# Service logs
journalctl --user -u openclaw-lightning -f

# Application logs (if configured)
tail -f ~/.openclaw/lightning/logs/bridge.log
```

## Testing

### Unit Tests

```bash
cd openclaw-lightning
npm test
```

### Integration Tests

```bash
# Test bridge connectivity
node test/integration/bridge-test.js

# Test full flow
node test/integration/e2e-test.js
```

### Load Tests

```bash
# Simulate 100 concurrent sessions
node test/load/concurrent-sessions.js
```

## Future Enhancements

### Planned Features

- **Cloud Storage:** Sync learning across instances
- **Distributed Training:** Multi-agent shared learning
- **Advanced APO:** More sophisticated prompt optimization
- **Real-time Dashboard:** Web UI for monitoring

### Plugin System

Lightning will support plugins for:
- Custom reward functions
- Alternative storage backends
- External optimization algorithms
- Integration with other frameworks

## References

- [Agent Lightning Docs](https://github.com/MasterX1582/agent-lightning)
- [OpenClaw Docs](https://openclaw.ai/docs)
- [FastAPI](https://fastapi.tiangolo.com/)
- [Reinforcement Learning](https://spinningup.openai.com/)
