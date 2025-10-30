"use client";

import React from "react";
import { Card, CardContent } from "~/components/ui/card";
import { Progress } from "~/components/ui/progress";
import { CheckCircle, TestTube, Shield, Timer } from "lucide-react";
import type { ComprehensiveIntegrationReport } from "~/app/builder/services/IntegrationTestingService";

interface TestMetricsProps {
  report: ComprehensiveIntegrationReport;
  formatDuration: (ms: number) => string;
  getPassRateColor: (rate: number) => string;
}

export function TestMetricsOverview({
  report,
  formatDuration,
  getPassRateColor,
}: TestMetricsProps) {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Overall Pass Rate</p>
              <p className={`text-2xl font-bold ${getPassRateColor(report.overallPassRate)}`}>
                {report.overallPassRate.toFixed(1)}%
              </p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <Progress value={report.overallPassRate} className="mt-2" />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Tests</p>
              <p className="text-2xl font-bold text-blue-600">{report.totalTests}</p>
            </div>
            <TestTube className="h-8 w-8 text-blue-600" />
          </div>
          <div className="mt-2 text-sm text-gray-600">
            {report.passedTests} passed, {report.failedTests} failed
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">System Integration</p>
              <p
                className={`text-2xl font-bold ${getPassRateColor(report.systemIntegration.overall)}`}
              >
                {report.systemIntegration.overall.toFixed(0)}
              </p>
            </div>
            <Shield className="h-8 w-8 text-purple-600" />
          </div>
          <Progress value={report.systemIntegration.overall} className="mt-2" />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Execution Time</p>
              <p className="text-2xl font-bold text-gray-600">
                {formatDuration(report.totalExecutionTime)}
              </p>
            </div>
            <Timer className="h-8 w-8 text-gray-600" />
          </div>
          <div className="mt-2 text-sm text-gray-600">
            Avg: {formatDuration(report.performanceMetrics.averageTestTime)}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
