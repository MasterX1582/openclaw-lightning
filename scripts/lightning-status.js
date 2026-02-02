#!/usr/bin/env node
/**
 * Check Agent Lightning service status
 */

const { execSync } = require('child_process');
const http = require('http');

async function checkHealth() {
  return new Promise((resolve) => {
    const req = http.get('http://localhost:8765/health', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const health = JSON.parse(data);
          resolve({ reachable: true, data: health });
        } catch (e) {
          resolve({ reachable: false, error: 'Invalid response' });
        }
      });
    });
    
    req.on('error', () => {
      resolve({ reachable: false, error: 'Connection refused' });
    });
    
    req.setTimeout(3000, () => {
      req.destroy();
      resolve({ reachable: false, error: 'Timeout' });
    });
  });
}

async function main() {
  console.log('');
  console.log('🔍 Agent Lightning Status');
  console.log('═══════════════════════════════════════');
  console.log('');
  
  // Check systemd service
  try {
    const status = execSync('systemctl --user is-active openclaw-lightning.service', { encoding: 'utf-8' }).trim();
    console.log(`Service: ${status === 'active' ? '✅ Running' : '❌ Not running'}`);
  } catch (e) {
    console.log('Service: ❌ Not found or not running');
    console.log('');
    console.log('To install: npm run lightning:setup');
    process.exit(1);
  }
  
  // Check HTTP endpoint
  const health = await checkHealth();
  
  if (health.reachable) {
    console.log('Bridge: ✅ Reachable (port 8765)');
    console.log(`Tracing: ${health.data.tracing_enabled ? '✅ Enabled' : '⚠️  Disabled'}`);
    console.log(`Active Sessions: ${health.data.active_sessions || 0}`);
  } else {
    console.log(`Bridge: ❌ Not reachable (${health.error})`);
  }
  
  console.log('');
  console.log('Commands:');
  console.log('  npm run lightning:start   # Start service');
  console.log('  npm run lightning:stop    # Stop service');
  console.log('  npm run lightning:stats   # View statistics');
  console.log('');
  
  process.exit(health.reachable ? 0 : 1);
}

main().catch(console.error);
