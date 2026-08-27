import { IxTimeAccuracyVerifier } from "~/lib/ixtime";

describe("IxTime Accuracy & Verification Suites", () => {
  it("should run all accuracy test suites with 100% pass rate", () => {
    const report = IxTimeAccuracyVerifier.runAllTests();

    expect(report.totalTests).toBeGreaterThanOrEqual(11);
    expect(report.failedTests).toBe(0);
    expect(report.passedTests).toBe(report.totalTests);
    expect(report.overallAccuracy).toBeGreaterThanOrEqual(99.9998);
    expect(report.criticalIssues).toHaveLength(0);
  });

  it("should verify status report passes threshold with excellent grade", () => {
    const status = IxTimeAccuracyVerifier.getAccuracyStatus();
    expect(status.isAccurate).toBe(true);
    expect(status.status).toBe("excellent");
    expect(status.accuracy).toBeGreaterThanOrEqual(99.9998);
  });

  it("should verify individual detailed test results", () => {
    const report = IxTimeAccuracyVerifier.runAllTests();

    for (const { test, result } of report.detailedResults) {
      expect(result.passed).toBe(true);
      expect(result.accuracy).toBeGreaterThanOrEqual(99.99);
      expect(result.errorMargin).toBeLessThanOrEqual(1);
    }
  });
});
