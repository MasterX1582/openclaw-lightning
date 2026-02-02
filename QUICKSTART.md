# OpenClaw Lightning - Quick Start

Get your self-improving AI agent running in 5 minutes.

## Installation

```bash
npm install -g openclaw-lightning
```

During install, say **Yes** when prompted to install Agent Lightning.

## Enable Lightning

```bash
export ENABLE_AGENT_LIGHTNING=true
```

## Start Services

```bash
# Start Lightning bridge
openclaw-lightning start

# Start OpenClaw
openclaw start
```

## Verify

```bash
openclaw-lightning status
```

You should see:
```
✅ Service:  active
✅ Bridge:   healthy
```

## That's it!

Your agent is now learning from every interaction. It will:
- Optimize prompts automatically
- Improve tool selection
- Get faster over time
- Reduce token usage

## Watch It Learn

```bash
# View stats
openclaw-lightning stats

# Watch in real-time
watch -n 5 openclaw-lightning stats
```

## Next Steps

- **Chat with your agent** - It's learning from every conversation
- **Read [USAGE.md](./USAGE.md)** - Learn advanced features
- **Check [INSTALL.md](./INSTALL.md)** - Detailed setup guide

## Need Help?

- **Docs:** https://openclaw.ai/docs/lightning
- **Discord:** https://discord.com/invite/clawd
- **Issues:** https://github.com/openclaw/openclaw-lightning/issues

## Disable Lightning

Don't want it? Just:

```bash
unset ENABLE_AGENT_LIGHTNING
openclaw restart
```

Learning data is preserved if you want to re-enable later.
