#!/usr/bin/env node
/**
 * Check Agent Lightning status
 */

const { execSync } = require('child_process');
const fetch = require('node-fetch');

async function checkService() {
  // Check systemd service
  let serviceStatus = 'unknown';
  try {
    const status = execSync('systemctl --user is-active openclaw-lightning', { encoding: 'utf-8' }).trim();
    serviceStatus = status;
  } catch {
    serviceStatus = 'inactive';
  }
  
  // Check bridge health
  let bridgeStatus = 'unknown';
  let stats = null;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const response = await fetch('http://localhost:8765/health', { 
      signal: controller.signal 
    });
    clearTimeout(timeout);
    if (response.ok) {
      bridgeStatus = 'healthy';
      
      // Get stats
      const statsResponse = await fetch('http://localhost:8765/stats', { timeout: 2000 });
      if (statsResponse.ok) {
        stats = await statsResponse.json();
      }
    } else {
      bridgeStatus = 'unhealthy';
    }
  } catch {
    bridgeStatus = 'unreachable';
  }
  
  // Display status
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  ⚡ Agent Lightning Status                                 ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');
  
  const serviceIcon = serviceStatus === 'active' ? '✅' : '❌';
  const bridgeIcon = bridgeStatus === 'healthy' ? '✅' : '❌';
  
  console.log(`Service:      ${serviceIcon} ${serviceStatus}`);
  console.log(`Bridge:       ${bridgeIcon} ${bridgeStatus}`);
  console.log(`URL:          http://localhost:8765`);
  console.log('');
  
  if (stats) {
    console.log('Performance:');
    console.log(`  Sessions:   ${stats.total_sessions || 0} total`);
    console.log(`  Traces:     ${stats.total_traces || 0} total`);
    console.log(`  Rewards:    ${stats.total_rewards || 0} total`);
    console.log(`  Uptime:     ${formatUptime(stats.uptime_seconds)}`);
    console.log('');
  }
  
  if (serviceStatus === 'active' && bridgeStatus === 'healthy') {
    console.log('Status: 🟢 All systems operational');
  } else if (serviceStatus === 'active' && bridgeStatus !== 'healthy') {
    console.log('Status: 🟡 Service running but bridge unreachable');
    console.log('        Check logs: journalctl --user -u openclaw-lightning -n 50');
  } else {
    console.log('Status: 🔴 Service not running');
    console.log('        Start with: npm run lightning:start');
  }
  console.log('');
}

function formatUptime(seconds) {
  if (!seconds) return 'unknown';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

checkService().catch(error => {
  console.error('❌ Error checking status:', error.message);
  process.exit(1);
});
