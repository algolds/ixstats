#!/usr/bin/env node

/**
 * Test script to verify IxTime accuracy fixes
 */

// Use ts-node to handle TypeScript imports
require('ts-node/register');
const { IxTimeAccuracyVerifier } = require('../src/lib/ixtime-accuracy.ts');

async function testAccuracy() {
  console.log('🧪 Testing IxTime Accuracy System');
  console.log('================================\n');

  // Test the specific failing tests mentioned by the user
  console.log('Testing transition point (July 27, 2025 = January 1, 2040)...');
  const transitionTest = IxTimeAccuracyVerifier.runSingleTest('transition_4x_to_2x');
  if (transitionTest) {
    console.log(`✅ ${transitionTest.test.name}: ${transitionTest.result.passed ? 'PASSED' : 'FAILED'}`);
    console.log(`   Accuracy: ${transitionTest.result.accuracy.toFixed(4)}%`);
    console.log(`   Details: ${transitionTest.result.details}`);
    if (!transitionTest.result.passed) {
      console.log(`   Expected: ${transitionTest.result.expectedValue}`);
      console.log(`   Actual: ${transitionTest.result.actualValue}`);
      console.log(`   Error Margin: ${transitionTest.result.errorMargin}ms`);
    }
  }

  console.log('\nTesting time continuity across speed transition...');
  const continuityTest = IxTimeAccuracyVerifier.runSingleTest('transition_continuity');
  if (continuityTest) {
    console.log(`✅ ${continuityTest.test.name}: ${continuityTest.result.passed ? 'PASSED' : 'FAILED'}`);
    console.log(`   Accuracy: ${continuityTest.result.accuracy.toFixed(4)}%`);
    console.log(`   Details: ${continuityTest.result.details}`);
    if (!continuityTest.result.passed) {
      console.log(`   Expected: ${continuityTest.result.expectedValue}`);
      console.log(`   Actual: ${continuityTest.result.actualValue}`);
      console.log(`   Error Margin: ${continuityTest.result.errorMargin}ms`);
    }
  }

  // Run all tests for comprehensive check
  console.log('\n🔍 Running comprehensive accuracy test suite...');
  const allResults = IxTimeAccuracyVerifier.runAllTests();
  
  console.log(`\n📊 Overall Results:`);
  console.log(`   Total Tests: ${allResults.totalTests}`);
  console.log(`   Passed: ${allResults.passedTests}`);
  console.log(`   Failed: ${allResults.failedTests}`);
  console.log(`   Overall Accuracy: ${allResults.overallAccuracy.toFixed(4)}%`);
  console.log(`   Average Execution Time: ${allResults.averageExecutionTime.toFixed(2)}ms`);

  // Show critical issues if any
  if (allResults.criticalIssues.length > 0) {
    console.log(`\n⚠️  Critical Issues (${allResults.criticalIssues.length}):`);
    allResults.criticalIssues.forEach((issue, index) => {
      console.log(`   ${index + 1}. ${issue.details}`);
      console.log(`      Expected: ${issue.expectedValue}, Actual: ${issue.actualValue}`);
    });
  }

  // Category breakdown
  console.log(`\n📈 Results by Category:`);
  Object.entries(allResults.categoryResults).forEach(([category, results]) => {
    console.log(`   ${category}: ${results.passed}/${results.passed + results.failed} passed (${results.accuracy.toFixed(2)}%)`);
  });

  // Check if we meet the >99.9998% requirement
  const status = IxTimeAccuracyVerifier.getAccuracyStatus();
  console.log(`\n🎯 Accuracy Status: ${status.status.toUpperCase()}`);
  console.log(`   ${status.message}`);
  console.log(`   Meets >99.9998% requirement: ${status.isAccurate ? '✅ YES' : '❌ NO'}`);

  return {
    transitionPassed: transitionTest?.result.passed || false,
    continuityPassed: continuityTest?.result.passed || false,
    overallAccuracy: allResults.overallAccuracy,
    meetsRequirement: status.isAccurate
  };
}

// Run the test
testAccuracy()
  .then(results => {
    console.log('\n🏁 Test Summary:');
    console.log(`   Transition Point Test: ${results.transitionPassed ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`   Continuity Test: ${results.continuityPassed ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`   Overall Accuracy: ${results.overallAccuracy.toFixed(4)}%`);
    console.log(`   Meets >99.9998% Requirement: ${results.meetsRequirement ? '✅ YES' : '❌ NO'}`);
    
    process.exit(results.transitionPassed && results.continuityPassed && results.meetsRequirement ? 0 : 1);
  })
  .catch(error => {
    console.error('❌ Test failed with error:', error);
    process.exit(1);
  });