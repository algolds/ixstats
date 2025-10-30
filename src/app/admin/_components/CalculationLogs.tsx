// src/app/admin/_components/CalculationLogs.tsx
"use client";

import { Database, AlertCircle, Clock, Zap } from "lucide-react";
import type { CalculationLog } from "~/types/ixstats";

interface CalculationLogsProps {
  logs: CalculationLog[] | undefined;
  isLoading: boolean;
  error?: string | null;
}

export function CalculationLogs({ logs, isLoading, error }: CalculationLogsProps) {
  if (error) {
    return (
      <div className="mb-8 rounded-lg border border-gray-200 bg-white p-6 shadow-md dark:border-gray-700 dark:bg-gray-800">
        <h2 className="mb-4 flex items-center text-lg font-semibold text-gray-900 dark:text-white">
          <Database className="mr-2 h-5 w-5" />
          Recent Calculation Logs
        </h2>
        <div className="rounded-md border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
          <div className="flex">
            <AlertCircle className="mr-2 h-5 w-5 text-red-400" />
            <p className="text-sm text-red-800 dark:text-red-200">
              Error loading calculation logs: {error}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="mb-8 rounded-lg border border-gray-200 bg-white p-6 shadow-md dark:border-gray-700 dark:bg-gray-800">
        <h2 className="mb-4 flex items-center text-lg font-semibold text-gray-900 dark:text-white">
          <Database className="mr-2 h-5 w-5" />
          Recent Calculation Logs
        </h2>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded bg-gray-200 dark:bg-gray-700"></div>
          ))}
        </div>
      </div>
    );
  }

  if (!logs || logs.length === 0) {
    return (
      <div className="mb-8 rounded-lg border border-gray-200 bg-white p-6 shadow-md dark:border-gray-700 dark:bg-gray-800">
        <h2 className="mb-4 flex items-center text-lg font-semibold text-gray-900 dark:text-white">
          <Database className="mr-2 h-5 w-5" />
          Recent Calculation Logs
        </h2>
        <div className="py-8 text-center">
          <Clock className="mx-auto mb-4 h-12 w-12 text-gray-400 dark:text-gray-500" />
          <p className="text-gray-500 dark:text-gray-400">No calculation logs available</p>
          <p className="mt-1 text-sm text-gray-400 dark:text-gray-500">
            Logs will appear here after calculations are performed
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-8 rounded-lg border border-gray-200 bg-white p-6 shadow-md dark:border-gray-700 dark:bg-gray-800">
      <h2 className="mb-4 flex items-center text-lg font-semibold text-gray-900 dark:text-white">
        <Database className="mr-2 h-5 w-5" />
        Recent Calculation Logs ({logs.length})
      </h2>

      <div className="scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 max-h-80 overflow-y-auto">
        <div className="space-y-2">
          {logs.map((log) => (
            <div
              key={log.id}
              className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-600 dark:bg-gray-700"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Zap className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {log.countriesUpdated} countries updated
                  </span>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {log.executionTimeMs}ms
                </div>
              </div>

              <div className="mt-2 grid grid-cols-1 gap-2 text-xs text-gray-600 md:grid-cols-2 dark:text-gray-300">
                <div>
                  <span className="font-medium">Real Time:</span>{" "}
                  {new Date(log.timestamp).toLocaleString()}
                </div>
                <div>
                  <span className="font-medium">IxTime:</span>{" "}
                  {new Date(log.ixTimeTimestamp).toLocaleString()}
                </div>
              </div>

              <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Global Growth Factor: {((log.globalGrowthFactor - 1) * 100).toFixed(2)}%
                {log.notes && <span className="ml-2">• {log.notes}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
