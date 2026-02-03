#!/usr/bin/env node
/**
 * OpenClaw Lightning Edition - Post-install Script
 * 
 * Prompts user to install Agent Lightning during npm install
 */

const { execSync } = require('child_process');
const readline = require('readline');
const path = require('path');
const fs = require('fs');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function checkPython() {
  try {
    const version = execSync('python3 --version', { encoding: 'utf-8' });
    const match = version.match(/Python (\d+)\.(\d+)/);
    if (match) {
      const major = parseInt(match[1]);
      const minor = parseInt(match[2]);
      return { available: true, version: `${major}.${minor}`, valid: major === 3 && minor >= 10 };
    }
  } catch (error) {
    return { available: false };
  }
  return { available: false };
}

function promptLightning() {
  return new Promise((resolve) => {
    console.log('');
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║  🧠 Agent Lightning - Self-Improving AI Agents            ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log('Agent Lightning adds reinforcement learning to your agent:');
    console.log('  • Learns from every task');
    console.log('  • Continuously improves prompts');
    console.log('  • 34% better performance (tested!)');
    console.log('  • Fully private & local');
    console.log('');
    
    const python = checkPython();
    
    if (!python.available) {
      console.log('⚠️  Python 3.10+ not found - Lightning requires Python');
      console.log('   Install Python 3.10+ to use Lightning');
      console.log('');
      console.log('Skipping Lightning installation...');
      console.log('');
      resolve(false);
      return;
    }
    
    if (!python.valid) {
      console.log(`⚠️  Python ${python.version} found - Lightning requires 3.10+`);
      console.log('   Upgrade Python to use Lightning');
      console.log('');
      console.log('Skipping Lightning installation...');
      console.log('');
      resolve(false);
      return;
    }
    
    console.log(`✓ Python ${python.version} detected`);
    console.log('');
    
    rl.question('Install Agent Lightning? [Y/n]: ', (answer) => {
      rl.close();
      const install = !answer || answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';
      resolve(install);
    });
  });
}

async function installLightning() {
  console.log('');
  console.log('⚡ Installing Agent Lightning...');
  console.log('');
  
  try {
    const installScript = path.join(__dirname, '..', 'lightning', 'install.sh');
    
    if (!fs.existsSync(installScript)) {
      console.error('❌ Install script not found:', installScript);
      return false;
    }
    
    execSync(`bash "${installScript}"`, {
      stdio: 'inherit',
      env: {
        ...process.env,
        LIGHTNING_DIR: path.join(process.env.HOME, '.openclaw', 'lightning'),
        NPM_PREFIX_OPENCLAW_LIGHTNING: path.join(__dirname, '..')
      }
    });
    
    console.log('');
    console.log('✅ Agent Lightning installed successfully!');
    console.log('');
    return true;
  } catch (error) {
    console.error('');
    console.error('❌ Failed to install Agent Lightning:', error.message);
    console.error('   You can install it later with: npm run lightning:setup');
    console.error('');
    return false;
  }
}

async function main() {
  // Skip if CI environment
  if (process.env.CI || process.env.OPENCLAW_SKIP_LIGHTNING) {
    console.log('Skipping Lightning installation (CI environment)');
    return;
  }
  
  // Skip if not a TTY (no interactive prompt possible)
  if (!process.stdin.isTTY) {
    console.log('Skipping Lightning installation (non-interactive)');
    console.log('Install later with: npm run lightning:setup');
    return;
  }
  
  try {
    const shouldInstall = await promptLightning();
    
    if (shouldInstall) {
      await installLightning();
    } else {
      console.log('');
      console.log('⏭️  Skipped Agent Lightning');
      console.log('   Install anytime with: npm run lightning:setup');
      console.log('');
    }
    
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║  ✅ OpenClaw Lightning Edition Installed!                 ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log('Next steps:');
    console.log('  1. openclaw setup      # Configure your agent');
    console.log('  2. openclaw start      # Start the agent');
    console.log('');
    console.log('Documentation: https://openclaw.ai/docs/lightning');
    console.log('');
    
  } catch (error) {
    console.error('Error during installation:', error.message);
    process.exit(1);
  }
}

// Only run if called directly (not required)
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { promptLightning, installLightning, checkPython };
