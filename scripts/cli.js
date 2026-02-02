#!/usr/bin/env node
/**
 * OpenClaw Lightning CLI
 * Additional commands for Lightning management
 */

const { execSync } = require('child_process');

const command = process.argv[2];

const commands = {
  'status': 'Check Lightning status',
  'start': 'Start Lightning bridge',
  'stop': 'Stop Lightning bridge',
  'setup': 'Install Agent Lightning',
  'stats': 'Show performance stats',
  'help': 'Show this help'
};

function showHelp() {
  console.log('');
  console.log('⚡ OpenClaw Lightning Edition');
  console.log('');
  console.log('Usage: openclaw-lightning <command>');
  console.log('');
  console.log('Commands:');
  Object.entries(commands).forEach(([cmd, desc]) => {
    console.log(`  ${cmd.padEnd(12)} ${desc}`);
  });
  console.log('');
  console.log('OpenClaw commands:');
  console.log('  Use "openclaw" command for core OpenClaw functionality');
  console.log('');
}

function runCommand(cmd) {
  switch(cmd) {
    case 'status':
      require('./lightning-status.js');
      break;
    case 'start':
      require('./lightning-start.js');
      break;
    case 'stop':
      require('./lightning-stop.js');
      break;
    case 'setup':
      execSync('npm run lightning:setup', { stdio: 'inherit' });
      break;
    case 'stats':
      execSync('npm run lightning:stats', { stdio: 'inherit' });
      break;
    case 'help':
    default:
      showHelp();
      break;
  }
}

if (!command || command === 'help') {
  showHelp();
} else if (commands[command]) {
  runCommand(command);
} else {
  console.error(`Unknown command: ${command}`);
  console.error('Run "openclaw-lightning help" for available commands');
  process.exit(1);
}
