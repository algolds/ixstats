import { NextRequest, NextResponse } from 'next/server';
import { IxTimeAccuracyVerifier } from '~/lib/ixtime-accuracy';

export async function GET(request: NextRequest) {
  try {
    console.log('🧪 Testing IxTime Accuracy System');
    
    // Test the specific failing tests mentioned by the user
    const transitionTest = IxTimeAccuracyVerifier.runSingleTest('transition_4x_to_2x');
    const continuityTest = IxTimeAccuracyVerifier.runSingleTest('transition_continuity');
    
    // Run comprehensive test suite
    const allResults = IxTimeAccuracyVerifier.runAllTests();
    const status = IxTimeAccuracyVerifier.getAccuracyStatus();
    
    const results = {
      specificTests: {
        transitionPoint: {
          name: transitionTest?.test.name || 'Not found',
          passed: transitionTest?.result.passed || false,
          accuracy: transitionTest?.result.accuracy || 0,
          details: transitionTest?.result.details || 'Test not found',
          expectedValue: transitionTest?.result.expectedValue || 'N/A',
          actualValue: transitionTest?.result.actualValue || 'N/A',
          errorMargin: transitionTest?.result.errorMargin || 0
        },
        continuity: {
          name: continuityTest?.test.name || 'Not found',
          passed: continuityTest?.result.passed || false,
          accuracy: continuityTest?.result.accuracy || 0,
          details: continuityTest?.result.details || 'Test not found',
          expectedValue: continuityTest?.result.expectedValue || 'N/A',
          actualValue: continuityTest?.result.actualValue || 'N/A',
          errorMargin: continuityTest?.result.errorMargin || 0
        }
      },
      comprehensive: {
        totalTests: allResults.totalTests,
        passedTests: allResults.passedTests,
        failedTests: allResults.failedTests,
        overallAccuracy: allResults.overallAccuracy,
        averageExecutionTime: allResults.averageExecutionTime,
        categoryResults: allResults.categoryResults,
        criticalIssues: allResults.criticalIssues.map(issue => ({
          details: issue.details,
          expectedValue: issue.expectedValue,
          actualValue: issue.actualValue,
          errorMargin: issue.errorMargin
        }))
      },
      status: {
        isAccurate: status.isAccurate,
        accuracy: status.accuracy,
        status: status.status,
        message: status.message,
        meetsRequirement: status.isAccurate
      },
      summary: {
        transitionPassed: transitionTest?.result.passed || false,
        continuityPassed: continuityTest?.result.passed || false,
        overallAccuracy: allResults.overallAccuracy,
        meetsRequirement: status.isAccurate,
        allTestsPassed: allResults.failedTests === 0
      }
    };

    return NextResponse.json(results, { status: 200 });

  } catch (error) {
    console.error('❌ Accuracy test failed:', error);
    return NextResponse.json(
      { 
        error: 'Test execution failed', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      }, 
      { status: 500 }
    );
  }
}