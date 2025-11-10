"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { CheckCircle, XCircle, AlertTriangle, Timer, Eye, EyeOff } from "lucide-react";
import type { IntegrationTestResult } from "~/app/builder/services/IntegrationTestingService";

interface TestResultsProps {
  result: IntegrationTestResult;
  isExpanded: boolean;
  onToggleExpansion: (testId: string) => void;
  formatDuration: (ms: number) => string;
}

export function TestResultCard({
  result,
  isExpanded,
  onToggleExpansion,
  formatDuration,
}: TestResultsProps) {
  return (
    <Card key={result.testId} className="mb-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {result.passed ? (
              <CheckCircle className="h-5 w-5 text-green-600" />
            ) : (
              <XCircle className="h-5 w-5 text-red-600" />
            )}
            <div>
              <CardTitle className="text-lg">{result.testId.replace(/-/g, " ")}</CardTitle>
              <p className="text-sm text-gray-600">{result.message}</p>
              <div className="mt-1 flex items-center space-x-2">
                <span className="text-xs text-gray-500">
                  <Timer className="mr-1 inline h-3 w-3" />
                  {formatDuration(result.executionTime)}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {result.errors.length > 0 && (
              <Badge variant="destructive">
                <XCircle className="mr-1 h-3 w-3" />
                {result.errors.length} errors
              </Badge>
            )}
            {result.warnings.length > 0 && (
              <Badge variant="outline" className="border-orange-600 text-orange-600">
                <AlertTriangle className="mr-1 h-3 w-3" />
                {result.warnings.length} warnings
              </Badge>
            )}
            <Button variant="ghost" size="sm" onClick={() => onToggleExpansion(result.testId)}>
              {isExpanded ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-4">
          {Object.keys(result.metrics).length > 0 && (
            <div>
              <h4 className="mb-2 text-sm font-medium">Test Metrics</h4>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {Object.entries(result.metrics).map(([key, value]) => (
                  <div key={key} className="text-center">
                    <div className="text-lg font-bold">
                      {typeof value === "number" ? value.toFixed(1) : value}
                    </div>
                    <div className="text-xs text-gray-600 capitalize">
                      {key.replace(/([A-Z])/g, " $1")}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.details.length > 0 && (
            <div>
              <h4 className="mb-2 text-sm font-medium">Test Details</h4>
              <ul className="space-y-1">
                {result.details.map((detail, index) => (
                  <li key={index} className="flex items-start space-x-2">
                    <span className="mt-1 text-blue-600">•</span>
                    <span className="text-sm">{detail}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.errors.length > 0 && (
            <div>
              <h4 className="mb-2 text-sm font-medium text-red-600">Errors</h4>
              <ul className="space-y-1">
                {result.errors.map((error, index) => (
                  <li key={index} className="flex items-start space-x-2">
                    <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-600" />
                    <span className="text-sm text-red-600">{error}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.warnings.length > 0 && (
            <div>
              <h4 className="mb-2 text-sm font-medium text-orange-600">Warnings</h4>
              <ul className="space-y-1">
                {result.warnings.map((warning, index) => (
                  <li key={index} className="flex items-start space-x-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-orange-600" />
                    <span className="text-sm text-orange-600">{warning}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.recommendations.length > 0 && (
            <div>
              <h4 className="mb-2 text-sm font-medium">Recommendations</h4>
              <ul className="space-y-1">
                {result.recommendations.map((rec, index) => (
                  <li key={index} className="flex items-start space-x-2">
                    <span className="mt-1 text-green-600">•</span>
                    <span className="text-sm">{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
