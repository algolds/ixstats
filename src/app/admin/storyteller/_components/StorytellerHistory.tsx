"use client";
// src/app/admin/storyteller/_components/StorytellerHistory.tsx
// Audit log of admin storyteller actions

import { api } from "~/trpc/react";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import { ScrollArea } from "~/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";
import { Clock, User, Page as FileText } from "iconoir-react";

const ACTION_COLORS: Record<string, string> = {
  CREATE_WORLD_EVENT: "border-green/30 bg-green/10 text-green",
  UPDATE_COUNTRY: "border-blue/30 bg-blue/10 text-blue",
  ADD_STORYTELLER_EFFECT: "border-yellow/30 bg-yellow/10 text-yellow",
  DELETE_STORYTELLER_EFFECT: "border-red/30 bg-red/10 text-red",
  TRIGGER_CALCULATION: "border-purple/30 bg-purple/10 text-purple",
  CONFIG_UPDATE: "border-indigo/30 bg-indigo/10 text-indigo",
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
          <Skeleton key={i} className="rounded-control h-16 w-full" />
        ))}
      </div>
    );
  }

  const logs = data?.logs ?? [];

  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <FileText className="text-label-secondary mb-3 h-10 w-10" />
        <h3 className="text-label text-title-3">No History</h3>
        <p className="text-label-secondary text-body mt-1">
          Admin actions will appear here as they occur.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <Clock className="text-label-secondary h-5 w-5" />
        <h3 className="text-label text-title-3">Admin History</h3>
        <Badge variant="outline">{logs.length} entries</Badge>
      </div>

      <ScrollArea className="h-[500px]">
        <div className="space-y-2">
          {logs.map((log: any) => {
            const colorClass =
              ACTION_COLORS[log.action] ?? "border-separator bg-fill-3 text-label-secondary";
            let details: Record<string, unknown> | null = null;
            try {
              const raw = log.details ?? log.changes;
              details = raw ? JSON.parse(raw) : null;
            } catch {
              // ignore parse errors
            }

            return (
              <div
                key={log.id}
                className="bg-surface-secondary border-separator hover:bg-fill-4 rounded-control border p-3 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={`text-footnote ${colorClass}`}>
                      {log.action.replace(/_/g, " ")}
                    </Badge>
                  </div>
                  <span className="text-label-secondary text-footnote flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })}
                  </span>
                </div>
                <div className="text-footnote mt-1.5 flex items-center gap-2">
                  <User className="text-label-secondary h-3 w-3" />
                  <span className="text-label-secondary">{log.adminName}</span>
                </div>
                {details && (
                  <div className="text-label-secondary text-footnote mt-1">
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
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
