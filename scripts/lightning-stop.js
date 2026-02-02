#!/usr/bin/env node
/**
 * Stop Agent Lightning bridge service
 */

const { execSync } = require('child_process');

function checkSystemd() {
  try {
    execSync('systemctl --user --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function stopService() {
  try {
    console.log('⚡ Stopping Agent Lightning bridge...');
    
    if (!checkSystemd()) {
      console.error('❌ systemd not available');
      console.error('   Manual stop: pkill -f lightning_bridge_service.py');
      process.exit(1);
    }
    
    execSync('systemctl --user stop openclaw-lightning', { stdio: 'inherit' });
    
    console.log('✅ Agent Lightning stopped');
    
  } catch (error) {
    console.error('❌ Failed to stop service:', error.message);
    process.exit(1);
  }
}

stopService();
