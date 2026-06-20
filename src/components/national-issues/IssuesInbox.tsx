"use client";

import { useState, useCallback, memo } from "react";
import { Bell, AlertTriangle, History, Inbox, Flame, CheckCircle } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { useNationalIssues } from "~/hooks/useNationalIssues";
import { IssueCard } from "./IssueCard";
import { IssueDetailModal } from "./IssueDetailModal";

interface IssuesInboxProps {
  countryId: string;
  maxVisible?: number;
  variant?: "compact" | "full";
  onIssueCountChange?: (count: number) => void;
}

type InboxTab = "active" | "urgent" | "history";

function IssuesInboxInner({ countryId, maxVisible, variant = "full" }: IssuesInboxProps) {
  const [activeTab, setActiveTab] = useState<InboxTab>("active");

  const {
    activeIssues,
    historyIssues,
    selectedIssue,
    pendingCount,
    urgentCount,
    isLoadingActive,
    isResponding,
    lastResponse,
    respond,
    openIssue,
    closeIssue,
  } = useNationalIssues(countryId);

  const urgentIssues = activeIssues.filter((i) => i.deadlineIxTime != null);

  const displayActive = maxVisible ? activeIssues.slice(0, maxVisible) : activeIssues;
  const displayUrgent = maxVisible ? urgentIssues.slice(0, maxVisible) : urgentIssues;
  const displayHistory = maxVisible ? historyIssues.slice(0, maxVisible) : historyIssues;

  const handleRespond = useCallback(
    async (issueId: string, optionId: string) => {
      return respond(issueId, optionId);
    },
    [respond]
  );

  if (variant === "compact") {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-amber-400" />
            <span className="text-sm font-medium">National Issues</span>
          </div>
          {pendingCount > 0 && (
            <Badge
              variant="outline"
              className={`text-xs ${urgentCount > 0 ? "border-red-500/30 bg-red-500/20 text-red-400" : "border-amber-500/30 bg-amber-500/20 text-amber-400"}`}
            >
              {pendingCount}
            </Badge>
          )}
        </div>

        {isLoadingActive ? (
          <div className="text-muted-foreground py-3 text-center text-xs">Loading issues...</div>
        ) : displayActive.length === 0 ? (
          <div className="text-muted-foreground py-3 text-center text-xs">No pending issues</div>
        ) : (
          <div className="space-y-1.5">
            {displayActive.map((issue) => (
              <IssueCard key={issue.id} issue={issue} onView={openIssue} variant="compact" />
            ))}
            {activeIssues.length > (maxVisible ?? Infinity) && (
              <p className="text-muted-foreground pt-1 text-center text-xs">
                +{activeIssues.length - (maxVisible ?? 0)} more issues
              </p>
            )}
          </div>
        )}

        <IssueDetailModal
          issue={selectedIssue ?? null}
          isOpen={!!selectedIssue}
          onClose={closeIssue}
          onRespond={handleRespond}
          isResponding={isResponding}
          countryId={countryId}
        />
      </div>
    );
  }

  // Full variant
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="rounded-full bg-amber-500/20 p-1.5">
            <Bell className="h-4 w-4 text-amber-400" />
          </div>
          <div>
            <h2 className="text-base font-semibold">National Issues</h2>
            <p className="text-muted-foreground text-xs">Decisions requiring your attention</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {urgentCount > 0 && (
            <Badge className="border-red-500/30 bg-red-500/20 text-xs text-red-400">
              <Flame className="mr-1 h-3 w-3" />
              {urgentCount} Urgent
            </Badge>
          )}
          <Badge
            variant="outline"
            className="border-amber-500/30 bg-amber-500/20 text-xs text-amber-400"
          >
            {pendingCount} Pending
          </Badge>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as InboxTab)}>
        <TabsList className="grid h-8 w-full grid-cols-3">
          <TabsTrigger value="active" className="gap-1 text-xs">
            <Inbox className="h-3 w-3" />
            Active
            {pendingCount > 0 && (
              <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                {pendingCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="urgent" className="gap-1 text-xs">
            <AlertTriangle className="h-3 w-3" />
            Crises
            {urgentCount > 0 && (
              <Badge variant="destructive" className="h-4 px-1 text-[10px]">
                {urgentCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1 text-xs">
            <History className="h-3 w-3" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-3">
          {isLoadingActive ? (
            <LoadingState />
          ) : displayActive.length === 0 ? (
            <EmptyState
              icon={<CheckCircle className="h-8 w-8 text-green-400/50" />}
              title="All clear"
              description="No pending national issues. Your country is running smoothly."
            />
          ) : (
            <div className="space-y-2">
              {displayActive.map((issue) => (
                <IssueCard key={issue.id} issue={issue} onView={openIssue} variant="full" />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="urgent" className="mt-3">
          {displayUrgent.length === 0 ? (
            <EmptyState
              icon={<Shield className="h-8 w-8 text-green-400/50" />}
              title="No active crises"
              description="No urgent issues requiring immediate attention."
            />
          ) : (
            <div className="space-y-2">
              {displayUrgent.map((issue) => (
                <IssueCard key={issue.id} issue={issue} onView={openIssue} variant="full" />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-3">
          {displayHistory.length === 0 ? (
            <EmptyState
              icon={<History className="text-muted-foreground/30 h-8 w-8" />}
              title="No history yet"
              description="Your past decisions will appear here."
            />
          ) : (
            <div className="space-y-2">
              {displayHistory.map((issue) => (
                <IssueCard key={issue.id} issue={issue} onView={openIssue} variant="full" />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <IssueDetailModal
        issue={selectedIssue ?? null}
        isOpen={!!selectedIssue}
        onClose={closeIssue}
        onRespond={handleRespond}
        isResponding={isResponding}
      />
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-2">
      {[1, 2, 3].map((i) => (
        <div key={i} className="animate-pulse rounded-lg border border-white/10 p-3">
          <div className="flex items-start gap-3">
            <div className="h-7 w-7 rounded-full bg-white/10" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 rounded bg-white/10" />
              <div className="h-3 w-full rounded bg-white/5" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      {icon}
      <h3 className="mt-3 text-sm font-medium">{title}</h3>
      <p className="text-muted-foreground mt-1 text-xs">{description}</p>
    </div>
  );
}

// Import Shield here since it's used in the component
import { Shield } from "lucide-react";

export const IssuesInbox = memo(IssuesInboxInner);
