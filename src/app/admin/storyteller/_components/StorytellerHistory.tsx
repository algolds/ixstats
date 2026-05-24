// src/app/admin/storyteller/_components/StorytellerHistory.tsx
// Audit log of admin storyteller actions
"use client";

import { api } from "~/trpc/react";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import { ScrollArea } from "~/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";
import { Clock, User, FileText } from "lucide-react";

const ACTION_COLORS: Record<string, string> = {
  CREATE_WORLD_EVENT: "border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-300",
  UPDATE_COUNTRY: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  ADD_STORYTELLER_EFFECT: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  DELETE_STORYTELLER_EFFECT: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300",
  TRIGGER_CALCULATION: "border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-300",
  CONFIG_UPDATE: "border-indigo-500/30 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
};

export function StorytellerHistory() {
  const { data, isLoading } = api.admin.getAdminAuditLog.useQuery(
    { limit: 50 },
    { refetchInterval: 30000, refetchOnWindowFocus: false }
  );

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  const logs = data ?? [];

  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <FileText className="text-muted-foreground mb-3 h-10 w-10" />
        <h3 className="text-foreground text-lg font-semibold">No History</h3>
        <p className="text-muted-foreground mt-1 text-sm">
          Admin actions will appear here as they occur.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <Clock className="text-muted-foreground h-5 w-5" />
        <h3 className="text-foreground text-lg font-semibold">Admin History</h3>
        <Badge variant="outline" className="text-xs">
          {logs.length} entries
        </Badge>
      </div>

      <ScrollArea className="h-[500px]">
        <div className="space-y-2">
          {logs.map(
            (log: {
              id: string;
              action: string;
              adminName: string;
              details: string | null;
              timestamp: Date;
            }) => {
              const colorClass =
                ACTION_COLORS[log.action] ?? "border-gray-500/30 bg-gray-500/10 text-gray-600";
              let details: Record<string, unknown> | null = null;
              try {
                details = log.details ? JSON.parse(log.details) : null;
              } catch {
                // ignore parse errors
              }

              return (
                <div
                  key={log.id}
                  className="border-border/30 hover:bg-muted/10 rounded-lg border p-3 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`text-xs ${colorClass}`}>
                        {log.action.replace(/_/g, " ")}
                      </Badge>
                    </div>
                    <span className="text-muted-foreground flex items-center gap-1 text-xs">
                      <Clock className="h-3 w-3" />
                      {formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })}
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2 text-xs">
                    <User className="text-muted-foreground h-3 w-3" />
                    <span className="text-muted-foreground">{log.adminName}</span>
                  </div>
                  {details && (
                    <div className="text-muted-foreground mt-1 text-xs">
                      {Object.entries(details)
                        .filter(([k]) => k !== "eventId" && k !== "countryId")
                        .map(([k, v]) => (
                          <span key={k} className="mr-3">
                            <span className="font-medium">{k}:</span>{" "}
                            {typeof v === "number" ? v.toLocaleString() : String(v)}
                          </span>
                        ))}
                    </div>
                  )}
                </div>
              );
            }
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
