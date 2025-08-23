// Quick test of unified flag service
const { unifiedFlagService } = require('./src/lib/unified-flag-service.js');

async function testFlagService() {
  console.log('Testing unified flag service...');
  
  // Test a country we know should have a flag
  const flagUrl = await unifiedFlagService.getFlagUrl('Caphiria');
  console.log('Caphiria flag URL:', flagUrl);
  
  const stats = unifiedFlagService.getStats();
  console.log('Service stats:', stats);
}

testFlagService().catch(console.error);