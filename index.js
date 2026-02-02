/**
 * OpenClaw Lightning Edition
 * Main entry point for programmatic use
 */

const LightningIntegration = require('./lib/integration');
const LightningClient = require('./lib/lightning-client');

// Export classes
module.exports = {
  LightningIntegration,
  LightningClient,
  
  // Convenience factory
  create: (options) => new LightningIntegration(options)
};

// Default export
module.exports.default = LightningIntegration;
