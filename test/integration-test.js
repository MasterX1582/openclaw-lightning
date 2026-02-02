#!/usr/bin/env node
/**
 * Integration Test - Verify Lightning Bridge Works
 */

const { LightningIntegration } = require('../index');

async function runTest() {
  console.log('🧪 Testing OpenClaw Lightning Integration\n');
  
  const lightning = new LightningIntegration({
    bridgeUrl: 'http://localhost:8765'
  });
  
  // Test 1: Health check
  console.log('Test 1: Health check...');
  const healthy = await lightning.checkHealth();
  if (!healthy) {
    console.error('❌ Bridge not healthy');
    process.exit(1);
  }
  console.log('✅ Bridge healthy\n');
  
  // Test 2: Start session
  console.log('Test 2: Start session...');
  const sessionKey = `test-${Date.now()}`;
  const traceId = await lightning.startSession(sessionKey, 'Test message');
  if (!traceId) {
    console.error('❌ Failed to start session');
    process.exit(1);
  }
  console.log(`✅ Session started: ${traceId}\n`);
  
  // Test 3: Trace tool
  console.log('Test 3: Trace tool call...');
  await lightning.traceTool(sessionKey, 'test_tool', { 
    param: 'value' 
  }, { 
    result: 'success' 
  });
  console.log('✅ Tool traced\n');
  
  // Test 4: Emit reward
  console.log('Test 4: Emit reward...');
  await lightning.emitReward(sessionKey, {
    success: true,
    tokensUsed: 100,
    latencyMs: 500
  });
  console.log('✅ Reward emitted\n');
  
  // Test 5: End session
  console.log('Test 5: End session...');
  await lightning.endSession(sessionKey, {
    success: true
  });
  console.log('✅ Session ended\n');
  
  // Test 6: Get stats
  console.log('Test 6: Get stats...');
  const stats = await lightning.getStats();
  if (!stats) {
    console.error('❌ Failed to get stats');
    process.exit(1);
  }
  console.log('✅ Stats retrieved:', stats, '\n');
  
  console.log('🎉 All tests passed!');
}

runTest().catch(error => {
  console.error('❌ Test failed:', error.message);
  process.exit(1);
});
