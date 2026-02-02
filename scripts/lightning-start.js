#!/usr/bin/env node
/**
 * Start Agent Lightning bridge service
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function checkSystemd() {
  try {
    execSync('systemctl --user --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function checkService() {
  try {
    const status = execSync('systemctl --user is-active openclaw-lightning', { encoding: 'utf-8' }).trim();
    return status === 'active';
  } catch {
    return false;
  }
}

function startService() {
  try {
    console.log('⚡ Starting Agent Lightning bridge...');
    
    if (!checkSystemd()) {
      console.error('❌ systemd not available');
      console.error('   Manual start: python3 lightning/bridge/lightning_bridge_service.py');
      process.exit(1);
    }
    
    if (checkService()) {
      console.log('✅ Agent Lightning already running');
      return;
    }
    
    execSync('systemctl --user start openclaw-lightning', { stdio: 'inherit' });
    
    // Wait a moment and check status
    setTimeout(() => {
      if (checkService()) {
        console.log('✅ Agent Lightning started successfully');
        console.log('   Bridge: http://localhost:8765');
        console.log('   Check status: npm run lightning:status');
      } else {
        console.error('❌ Failed to start Agent Lightning');
        console.error('   Check logs: journalctl --user -u openclaw-lightning -n 50');
      }
    }, 1000);
    
  } catch (error) {
    console.error('❌ Failed to start service:', error.message);
    process.exit(1);
  }
}

startService();
