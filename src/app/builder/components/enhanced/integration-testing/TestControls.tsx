"use client";

import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Progress } from '~/components/ui/progress';
import { Alert, AlertDescription } from '~/components/ui/alert';
import { BarChart3, AlertTriangle, Activity, TrendingUp, Target, Layers } from 'lucide-react';
import type {
  ComprehensiveIntegrationReport,
  IntegrationTestSuite
} from '~/app/builder/services/IntegrationTestingService';
import { TestResultCard } from './TestResults';

interface TestControlsProps {
  activeTab: string;
  report: ComprehensiveIntegrationReport;
  showDetails: boolean;
  expandedResults: Set<string>;
  onTabChange: (tab: string) => void;
  onToggleResultExpansion: (resultId: string) => void;
  formatDuration: (ms: number) => string;
  getPassRateColor: (rate: number) => string;
}

export function TestControlsTabs({
  activeTab,
  report,
  showDetails,
  expandedResults,
  onTabChange,
  onToggleResultExpansion,
  formatDuration,
  getPassRateColor
}: TestControlsProps) {
  return (
    <Tabs value={activeTab} onValueChange={onTabChange}>
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="suites">Test Suites</TabsTrigger>
        <TabsTrigger value="performance">Performance</TabsTrigger>
        <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="space-y-6">
        <SystemIntegrationScores
          report={report}
          getPassRateColor={getPassRateColor}
        />

        {report.criticalIssues.length > 0 && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Critical Issues Found:</strong>
              <ul className="mt-2 space-y-1">
                {report.criticalIssues.map((issue, index) => (
                  <li key={index} className="text-sm">• {issue}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}
      </TabsContent>

      <TabsContent value="suites">
        <div className="space-y-6">
          {report.testSuites.map(suite => (
            <TestSuiteCard
              key={suite.id}
              suite={suite}
              showDetails={showDetails}
              expandedResults={expandedResults}
              onToggleResultExpansion={onToggleResultExpansion}
              formatDuration={formatDuration}
              getPassRateColor={getPassRateColor}
            />
          ))}
        </div>
      </TabsContent>

      <TabsContent value="performance">
        <PerformanceMetrics report={report} formatDuration={formatDuration} />
      </TabsContent>

      <TabsContent value="recommendations">
        <RecommendationsPanel report={report} />
      </TabsContent>
    </Tabs>
  );
}

function SystemIntegrationScores({
  report,
  getPassRateColor
}: {
  report: ComprehensiveIntegrationReport;
  getPassRateColor: (rate: number) => string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <BarChart3 className="h-5 w-5" />
          <span>System Integration Scores</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">Economy-Government</span>
              <span className={`font-bold ${getPassRateColor(report.systemIntegration.economyGovernment)}`}>
                {report.systemIntegration.economyGovernment.toFixed(0)}
              </span>
            </div>
            <Progress value={report.systemIntegration.economyGovernment} className="h-2" />
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">Economy-Tax</span>
              <span className={`font-bold ${getPassRateColor(report.systemIntegration.economyTax)}`}>
                {report.systemIntegration.economyTax.toFixed(0)}
              </span>
            </div>
            <Progress value={report.systemIntegration.economyTax} className="h-2" />
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">Government-Tax</span>
              <span className={`font-bold ${getPassRateColor(report.systemIntegration.governmentTax)}`}>
                {report.systemIntegration.governmentTax.toFixed(0)}
              </span>
            </div>
            <Progress value={report.systemIntegration.governmentTax} className="h-2" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TestSuiteCard({
  suite,
  showDetails,
  expandedResults,
  onToggleResultExpansion,
  formatDuration,
  getPassRateColor
}: {
  suite: IntegrationTestSuite;
  showDetails: boolean;
  expandedResults: Set<string>;
  onToggleResultExpansion: (id: string) => void;
  formatDuration: (ms: number) => string;
  getPassRateColor: (rate: number) => string;
}) {
  return (
    <Card key={suite.id} className="mb-6">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center space-x-2">
              <Layers className="h-5 w-5" />
              <span>{suite.name}</span>
            </CardTitle>
            <p className="text-sm text-gray-600 mt-1">{suite.description}</p>
          </div>
          <div className="text-right">
            <div className={`text-2xl font-bold ${getPassRateColor(suite.overallPassRate)}`}>
              {suite.overallPassRate.toFixed(1)}%
            </div>
            <div className="text-sm text-gray-600">Pass Rate</div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{suite.tests.length}</div>
            <div className="text-sm text-gray-600">Total Tests</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{suite.summary.passed}</div>
            <div className="text-sm text-gray-600">Passed</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{suite.summary.failed}</div>
            <div className="text-sm text-gray-600">Failed</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">{suite.summary.critical}</div>
            <div className="text-sm text-gray-600">Critical</div>
          </div>
        </div>

        <Progress value={suite.overallPassRate} className="mb-4" />

        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>Execution Time: {formatDuration(suite.executionTime)}</span>
          <span>Tests: {suite.summary.passed}/{suite.tests.length} passed</span>
        </div>

        {showDetails && (
          <div className="mt-6 space-y-4">
            <h3 className="font-medium">Test Results</h3>
            {suite.results.map(result => (
              <TestResultCard
                key={result.testId}
                result={result}
                isExpanded={expandedResults.has(result.testId)}
                onToggleExpansion={onToggleResultExpansion}
                formatDuration={formatDuration}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PerformanceMetrics({
  report,
  formatDuration
}: {
  report: ComprehensiveIntegrationReport;
  formatDuration: (ms: number) => string;
}) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Activity className="h-5 w-5" />
            <span>Performance Metrics</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {formatDuration(report.performanceMetrics.averageTestTime)}
              </div>
              <div className="text-sm text-gray-600">Average Test Time</div>
            </div>

            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {report.performanceMetrics.slowestTest.replace(/-/g, ' ')}
              </div>
              <div className="text-sm text-gray-600">Slowest Test</div>
            </div>

            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {report.performanceMetrics.fastestTest.replace(/-/g, ' ')}
              </div>
              <div className="text-sm text-gray-600">Fastest Test</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function RecommendationsPanel({ report }: { report: ComprehensiveIntegrationReport }) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <TrendingUp className="h-5 w-5" />
            <span>Recommendations</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {report.recommendations.map((rec, index) => (
              <li key={index} className="flex items-start space-x-2">
                <span className="text-blue-600 mt-1">•</span>
                <span className="text-sm">{rec}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Target className="h-5 w-5" />
            <span>Next Steps</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {report.nextSteps.map((step, index) => (
              <li key={index} className="flex items-start space-x-2">
                <span className="text-green-600 mt-1">•</span>
                <span className="text-sm">{step}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
