"use client";

import { useState, useCallback, memo } from "react";
import { Bell, AlertTriangle, History, Inbox, Flame, CheckCircle } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Tabs, TabsContent } from "~/components/ui/tabs";
import { useNationalIssues } from "~/hooks/useNationalIssues";
import { IssueCard } from "./IssueCard";
import { IssueDetailModal } from "./IssueDetailModal";
import { FacetTabs } from "~/components/ui/facet";

interface IssuesInboxProps {
  countryId: string;
  maxVisible?: number;
  variant?: "compact" | "full";
  /** Scope the inbox to one issue domain, e.g. "political" for the politics tab. */
  domain?: string;
  onIssueCountChange?: (count: number) => void;
}

type InboxTab = "active" | "urgent" | "history";

function IssuesInboxInner({ countryId, maxVisible, variant = "full", domain }: IssuesInboxProps) {
  const [activeTab, setActiveTab] = useState<InboxTab>("active");

  const {
    activeIssues,
    historyIssues,
    selectedIssue,
    pendingCount,
    urgentCount,
    isLoadingActive,
    isResponding,
    respond,
    dismiss,
    openIssue,
    closeIssue,
  } = useNationalIssues(countryId, domain);

  const crises = activeIssues.filter((i) => i.urgency > 70 || i.deadlineIxTime != null);
  const discourse = activeIssues.filter((i) => !(i.urgency > 70 || i.deadlineIxTime != null));

  const displayActive = maxVisible ? activeIssues.slice(0, maxVisible) : activeIssues;
  const displayCrises = maxVisible ? crises.slice(0, maxVisible) : crises;
  const displayDiscourse = maxVisible ? discourse.slice(0, maxVisible) : discourse;
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
              <IssueCard
                key={issue.id}
                issue={issue}
                onView={openIssue}
                onDismiss={dismiss}
                variant="compact"
              />
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
          onDismiss={dismiss}
          isResponding={isResponding}
          countryId={countryId}
        />
      </div>
    );
  }

  // Full variant
  const tabItems = [
    {
      id: "active",
      label: (
        <span className="flex items-center gap-1.5">
          <span>Active</span>
          {pendingCount > 0 && (
            <Badge
              variant="secondary"
              className="h-4 shrink-0 border-none bg-white/10 px-1 text-[10px] text-white"
            >
              {pendingCount}
            </Badge>
          )}
        </span>
      ),
      icon: Inbox,
    },
    {
      id: "urgent",
      label: (
        <span className="flex items-center gap-1.5">
          <span>Crises</span>
          {urgentCount > 0 && (
            <Badge
              variant="destructive"
              className="h-4 shrink-0 border-none bg-red-500/25 px-1 text-[10px] font-semibold text-red-400"
            >
              {urgentCount}
            </Badge>
          )}
        </span>
      ),
      icon: AlertTriangle,
    },
    {
      id: "history",
      label: <span>History</span>,
      icon: History,
    },
  ];

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
        <div className="w-full">
          <FacetTabs
            tabs={tabItems}
            activeTab={activeTab}
            onChange={(tabId) => setActiveTab(tabId as InboxTab)}
            tone="mycountry"
            size="sm"
            className="mb-4"
          />
        </div>

        <TabsContent value="active" className="mt-3">
          {isLoadingActive ? (
            <LoadingState />
          ) : activeIssues.length === 0 ? (
            <EmptyState
              icon={<CheckCircle className="h-8 w-8 text-green-400/50" />}
              title="All clear"
              description="No pending national issues. Your country is running smoothly."
            />
          ) : (
            <div className="space-y-5">
              {/* Crises Section */}
              {displayCrises.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 px-1 text-red-400">
                    <Flame className="h-3.5 w-3.5 animate-pulse" />
                    <span className="text-[10px] font-bold tracking-wider uppercase">Crises</span>
                    <Badge
                      variant="destructive"
                      className="h-4 shrink-0 border-red-500/40 bg-red-500/25 px-1 text-[9px] font-semibold text-red-400"
                    >
                      Must Answer
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    {displayCrises.map((issue) => (
                      <IssueCard key={issue.id} issue={issue} onView={openIssue} variant="full" />
                    ))}
                  </div>
                </div>
              )}

              {/* Discourse Section */}
              {displayDiscourse.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 px-1 text-slate-400">
                    <Inbox className="h-3.5 w-3.5" />
                    <span className="text-[10px] font-bold tracking-wider uppercase">
                      National Discourse
                    </span>
                  </div>
                  <div className="space-y-2">
                    {displayDiscourse.map((issue) => (
                      <IssueCard
                        key={issue.id}
                        issue={issue}
                        onView={openIssue}
                        onDismiss={dismiss}
                        variant="full"
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="urgent" className="mt-3">
          {displayCrises.length === 0 ? (
            <EmptyState
              icon={<Shield className="h-8 w-8 text-green-400/50" />}
              title="No active crises"
              description="No urgent issues requiring immediate attention."
            />
          ) : (
            <div className="space-y-2">
              {displayCrises.map((issue) => (
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
        onDismiss={dismiss}
        isResponding={isResponding}
        countryId={countryId}
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
