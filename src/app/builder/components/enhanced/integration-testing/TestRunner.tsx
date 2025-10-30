"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { TestTube, RefreshCw, Play, Clock, Timer, AlertCircle, Eye, EyeOff } from "lucide-react";
import type { ComprehensiveIntegrationReport } from "~/app/builder/services/IntegrationTestingService";

interface TestRunnerProps {
  isRunning: boolean;
  showDetails: boolean;
  integrationReport: ComprehensiveIntegrationReport | null;
  canRunTests: boolean;
  onRunTests: () => void;
  onToggleDetails: () => void;
  formatDuration: (ms: number) => string;
}

export function TestRunner({
  isRunning,
  showDetails,
  integrationReport,
  canRunTests,
  onRunTests,
  onToggleDetails,
  formatDuration,
}: TestRunnerProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <TestTube className="h-6 w-6" />
          <span>Integration Testing</span>
        </CardTitle>
        <p className="text-sm text-gray-600">
          Comprehensive integration testing of all cross-builder functionality including synergy
          detection, bidirectional synchronization, effectiveness calculations, and validation
          systems.
        </p>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              onClick={onRunTests}
              disabled={isRunning || !canRunTests}
              className="flex items-center space-x-2"
            >
              {isRunning ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              <span>{isRunning ? "Running Tests..." : "Run Integration Tests"}</span>
            </Button>

            {integrationReport && (
              <div className="flex items-center space-x-4 text-sm">
                <div className="flex items-center space-x-1">
                  <Clock className="h-4 w-4" />
                  <span>
                    Last run: {new Date(integrationReport.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <div className="flex items-center space-x-1">
                  <Timer className="h-4 w-4" />
                  <span>Duration: {formatDuration(integrationReport.totalExecutionTime)}</span>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onToggleDetails}
              disabled={!integrationReport}
            >
              {showDetails ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              <span className="ml-1">{showDetails ? "Hide Details" : "Show Details"}</span>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function TestConfigurationAlert({ canRunTests }: { canRunTests: boolean }) {
  if (canRunTests) return null;

  return (
    <Alert>
      <AlertCircle className="h-4 w-4" />
      <AlertDescription>
        <strong>Configuration Required:</strong> Please configure economy, government, and tax
        systems before running integration tests.
      </AlertDescription>
    </Alert>
  );
}
