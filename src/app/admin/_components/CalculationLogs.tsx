// src/app/admin/_components/CalculationLogs.tsx
"use client";

import { ListChecks, AlertCircle, Loader2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge"; // For status
import { ScrollArea } from "~/components/ui/scroll-area";
import type { CalculationLog } from "~/types/ixstats"; // Assuming type definition

interface CalculationLogsProps {
  logs: CalculationLog[] | null | undefined;
  isLoading: boolean;
  error?: string | null;
}

export function CalculationLogs({ logs, isLoading, error }: CalculationLogsProps) {
  return (
    <Card className="dark:bg-gray-800 border-gray-200 dark:border-gray-700">
      <CardHeader>
        <CardTitle className="text-lg text-gray-900 dark:text-white flex items-center">
          <ListChecks className="h-5 w-5 mr-2" />
          Recent Calculation Logs
        </CardTitle>
        <CardDescription className="text-gray-600 dark:text-gray-400">
          Shows the status of recent automated and manual calculations.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
            <p className="ml-2 text-gray-600 dark:text-gray-400">Loading logs...</p>
          </div>
        )}
        {error && !isLoading && (
          <Alert variant="destructive" className="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700">
            <AlertCircle className="h-5 w-5 text-red-500" />
            <AlertTitle className="text-red-700 dark:text-red-300">Error Loading Logs</AlertTitle>
            <AlertDescription className="text-red-700 dark:text-red-300">
              {error}
            </AlertDescription>
          </Alert>
        )}
        {!isLoading && !error && (!logs || logs.length === 0) && (
          <p className="text-center text-gray-500 dark:text-gray-400 py-6">
            No calculation logs found.
          </p>
        )}
        {!isLoading && !error && logs && logs.length > 0 && (
          <ScrollArea className="h-[300px] w-full rounded-md border dark:border-gray-700">
            <Table>
              <TableHeader className="sticky top-0 bg-gray-50 dark:bg-gray-700">
                <TableRow>
                  <TableHead className="w-[180px] text-gray-700 dark:text-gray-300">Timestamp</TableHead>
                  <TableHead className="text-gray-700 dark:text-gray-300">Status</TableHead>
                  <TableHead className="text-gray-700 dark:text-gray-300">Type</TableHead>
                  <TableHead className="text-gray-700 dark:text-gray-300">Duration</TableHead>
                  <TableHead className="text-gray-700 dark:text-gray-300">Details/Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id} className="dark:border-gray-700">
                    <TableCell className="font-medium text-gray-700 dark:text-gray-300">
                      {new Date(log.timestamp).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={log.status === "SUCCESS" ? "default" : "destructive"}
                        className={
                            log.status === "SUCCESS" 
                            ? "bg-green-100 text-green-700 dark:bg-green-700/30 dark:text-green-300 border-green-300 dark:border-green-600" 
                            : "bg-red-100 text-red-700 dark:bg-red-700/30 dark:text-red-300 border-red-300 dark:border-red-600"
                        }
                      >
                        {log.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-gray-600 dark:text-gray-400">{log.type}</TableCell>
                    <TableCell className="text-gray-600 dark:text-gray-400">
                      {log.durationMs !== null ? `${log.durationMs} ms` : "N/A"}
                    </TableCell>
                    <TableCell className="text-xs text-gray-500 dark:text-gray-500 max-w-xs truncate" title={log.details ?? undefined}>
                      {log.details ?? "N/A"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
