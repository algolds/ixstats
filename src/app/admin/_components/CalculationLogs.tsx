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
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-8 border border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
          <Database className="h-5 w-5 mr-2" />
          Recent Calculation Logs
        </h2>
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-400 mr-2" />
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
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-8 border border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
          <Database className="h-5 w-5 mr-2" />
          Recent Calculation Logs
        </h2>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse bg-gray-200 dark:bg-gray-700 h-12 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  if (!logs || logs.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-8 border border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
          <Database className="h-5 w-5 mr-2" />
          Recent Calculation Logs
        </h2>
        <div className="text-center py-8">
          <Clock className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">No calculation logs available</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
            Logs will appear here after calculations are performed
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-8 border border-gray-200 dark:border-gray-700">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
        <Database className="h-5 w-5 mr-2" />
        Recent Calculation Logs ({logs.length})
      </h2>
      
      <div className="max-h-80 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600">
        <div className="space-y-2">
          {logs.map((log) => (
            <div 
              key={log.id} 
              className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600"
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
              
              <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-gray-600 dark:text-gray-300">
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
                {log.notes && (
                  <span className="ml-2">• {log.notes}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}