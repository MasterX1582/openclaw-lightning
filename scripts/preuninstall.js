#!/usr/bin/env node
/**
 * OpenClaw Lightning - Pre-uninstall Script
 * Stops Lightning service before uninstall
 */

const { execSync } = require('child_process');

function stopService() {
  try {
    // Check if systemd is available
    try {
      execSync('systemctl --user --version', { stdio: 'ignore' });
    } catch {
      console.log('systemd not available, skipping service stop');
      return;
    }
    
    // Check if service exists
    try {
      execSync('systemctl --user is-enabled openclaw-lightning', { stdio: 'ignore' });
    } catch {
      // Service doesn't exist, nothing to do
      return;
    }
    
    console.log('Stopping Agent Lightning service...');
    execSync('systemctl --user stop openclaw-lightning', { stdio: 'inherit' });
    console.log('✓ Service stopped');
    
  } catch (error) {
    console.warn('Failed to stop service:', error.message);
  }
}

// Only run if called directly during uninstall
if (require.main === module) {
  stopService();
}

module.exports = { stopService };
