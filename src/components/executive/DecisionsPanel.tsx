"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Layers, CheckCircle, Clock, AlertTriangle } from "lucide-react";
import { api } from "~/trpc/react";
import { SectionHelpIcon } from "~/components/ui/help-icon";

interface DecisionsPanelProps {
  countryId: string;
}

export function DecisionsPanel({ countryId }: DecisionsPanelProps) {
  // Fetch meetings with decisions and action items
  const { data: meetings = [] } = api.meetings.getMeetings.useQuery(
    { countryId },
    { enabled: !!countryId }
  );

  // Extract all decisions and action items from meetings
  const { decisions, actionItems } = useMemo(() => {
    const allDecisions: any[] = [];
    const allActionItems: any[] = [];

    meetings.forEach((meeting: any) => {
      if (meeting.decisions) {
        meeting.decisions.forEach((decision: any) => {
          allDecisions.push({
            ...decision,
            meetingTitle: meeting.title,
            meetingDate: meeting.scheduledDate,
          });
        });
      }

      if (meeting.actionItems) {
        meeting.actionItems.forEach((action: any) => {
          allActionItems.push({
            ...action,
            meetingTitle: meeting.title,
            meetingDate: meeting.scheduledDate,
          });
        });
      }
    });

    return {
      decisions: allDecisions.sort((a, b) => new Date(b.createdAt ?? b.meetingDate).getTime() - new Date(a.createdAt ?? a.meetingDate).getTime()),
      actionItems: allActionItems,
    };
  }, [meetings]);

  // Categorize action items
  const { pending, inProgress, completed, overdue } = useMemo(() => {
    const now = new Date();
    return {
      pending: actionItems.filter((item: any) => item.status === "PENDING"),
      inProgress: actionItems.filter((item: any) => item.status === "IN_PROGRESS"),
      completed: actionItems.filter((item: any) => item.status === "COMPLETED"),
      overdue: actionItems.filter(
        (item: any) =>
          item.dueDate &&
          new Date(item.dueDate) < now &&
          item.status !== "COMPLETED"
      ),
    };
  }, [actionItems]);

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  };

  const getActionStatusBadge = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return (
          <Badge variant="secondary" className="bg-green-50 text-green-700 dark:bg-green-950/20">
            <CheckCircle className="mr-1 h-3 w-3" />
            COMPLETED
          </Badge>
        );
      case "IN_PROGRESS":
        return (
          <Badge variant="secondary" className="bg-blue-50 text-blue-700 dark:bg-blue-950/20">
            <Clock className="mr-1 h-3 w-3" />
            IN PROGRESS
          </Badge>
        );
      case "PENDING":
      default:
        return (
          <Badge variant="secondary" className="bg-yellow-50 text-yellow-700 dark:bg-yellow-950/20">
            <AlertTriangle className="mr-1 h-3 w-3" />
            PENDING
          </Badge>
        );
    }
  };

  const DecisionCard = ({ decision }: { decision: any }) => {
    return (
      <div className="border-border/40 bg-muted/40 rounded-lg border p-3 transition-all hover:shadow-sm">
        <div className="flex items-center gap-2">
          <Layers className="h-3.5 w-3.5 flex-shrink-0 text-blue-500" />
          <span className="truncate text-sm font-semibold">{decision.title}</span>
        </div>
        {decision.description && (
          <div className="text-muted-foreground mt-1 line-clamp-1 text-xs">
            {decision.description}
          </div>
        )}
        <div className="text-muted-foreground mt-1 flex items-center gap-2 text-xs">
          <span>{decision.meetingTitle}</span>
          <span>•</span>
          <span>{formatDate(decision.meetingDate)}</span>
        </div>
      </div>
    );
  };

  const ActionItemCard = ({ action }: { action: any }) => {
    const isOverdue =
      action.dueDate &&
      new Date(action.dueDate) < new Date() &&
      action.status !== "COMPLETED";

    return (
      <div
        className={`border-border/40 bg-muted/40 rounded-lg border p-3 transition-all hover:shadow-sm ${
          isOverdue ? "border-red-300 dark:border-red-800" : ""
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-semibold">{action.title}</span>
              {getActionStatusBadge(action.status)}
              {isOverdue && (
                <Badge variant="destructive" className="text-xs">
                  OVERDUE
                </Badge>
              )}
            </div>
            <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-2 text-xs">
              <span>{action.meetingTitle}</span>
              {action.assignedToId && (
                <><span>•</span><span>Assigned</span></>
              )}
              {action.dueDate && (
                <>
                  <span>•</span>
                  <span className={isOverdue ? "text-red-600 font-medium" : ""}>
                    Due: {formatDate(action.dueDate)}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Section Header */}
      <div className="flex items-center gap-2">
        <Layers className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        <h3 className="text-sm font-semibold">Decisions & Action Items</h3>
        <SectionHelpIcon
          title="Decisions & Action Items"
          content="Track and manage executive decisions made during meetings and their associated action items. This system ensures decisions are documented, accountable, and followed through. Action items represent concrete tasks that result from decisions, with assigned owners and due dates to ensure implementation."
        />
      </div>

      {/* Action Items Stats Strip */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        <div className="glass-hierarchy-child rounded-lg bg-yellow-50 p-2.5 dark:bg-yellow-950/20">
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 text-yellow-600" />
            <span className="text-muted-foreground text-xs font-medium">Pending</span>
          </div>
          <div className="mt-0.5 text-lg font-bold">{pending.length}</div>
        </div>
        <div className="glass-hierarchy-child rounded-lg bg-blue-50 p-2.5 dark:bg-blue-950/20">
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 flex-shrink-0 text-blue-600" />
            <span className="text-muted-foreground text-xs font-medium">In Progress</span>
          </div>
          <div className="mt-0.5 text-lg font-bold">{inProgress.length}</div>
        </div>
        <div className="glass-hierarchy-child rounded-lg bg-green-50 p-2.5 dark:bg-green-950/20">
          <div className="flex items-center gap-1.5">
            <CheckCircle className="h-3.5 w-3.5 flex-shrink-0 text-green-600" />
            <span className="text-muted-foreground text-xs font-medium">Completed</span>
          </div>
          <div className="mt-0.5 text-lg font-bold">{completed.length}</div>
        </div>
        <div className="glass-hierarchy-child rounded-lg bg-red-50 p-2.5 dark:bg-red-950/20">
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 text-red-600" />
            <span className="text-muted-foreground text-xs font-medium">Overdue</span>
          </div>
          <div className="mt-0.5 text-lg font-bold">{overdue.length}</div>
        </div>
      </div>

      {/* Overdue Action Items Alert */}
      {overdue.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950/20">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
            <div>
              <p className="font-medium text-red-900 dark:text-red-100">
                {overdue.length} action item{overdue.length !== 1 ? "s" : ""} overdue
              </p>
              <p className="text-muted-foreground mt-1 text-sm">
                These items require immediate attention from the assigned officials
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Recent Decisions */}
      <Card className="glass-hierarchy-child">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-blue-600" />
            Recent Decisions
          </CardTitle>
        </CardHeader>
        <CardContent>
          {decisions.length > 0 ? (
            <div className="space-y-3">
              {decisions.slice(0, 10).map((decision: any) => (
                <DecisionCard key={decision.id} decision={decision} />
              ))}
              {decisions.length > 10 && (
                <div className="text-muted-foreground pt-2 text-center text-sm">
                  Showing 10 of {decisions.length} decisions
                </div>
              )}
            </div>
          ) : (
            <div className="border-border/50 text-muted-foreground flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-6 text-center text-sm">
              <Layers className="text-muted-foreground/70 h-6 w-6" />
              <p>No decisions recorded yet.</p>
              <p className="text-xs">Decisions are recorded during cabinet meetings</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Items by Status */}
      {actionItems.length > 0 && (
        <>
          {/* Pending & Overdue */}
          {(pending.length > 0 || overdue.length > 0) && (
            <Card className="glass-hierarchy-child">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-600" />
                  Pending Action Items
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[...overdue, ...pending.filter((item: any) => !overdue.includes(item))]
                    .slice(0, 10)
                    .map((action: any) => (
                      <ActionItemCard key={action.id} action={action} />
                    ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* In Progress */}
          {inProgress.length > 0 && (
            <Card className="glass-hierarchy-child">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-blue-600" />
                  In Progress
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {inProgress.slice(0, 10).map((action: any) => (
                    <ActionItemCard key={action.id} action={action} />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Completed */}
          {completed.length > 0 && (
            <Card className="glass-hierarchy-child">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  Completed
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {completed.slice(0, 5).map((action: any) => (
                    <ActionItemCard key={action.id} action={action} />
                  ))}
                  {completed.length > 5 && (
                    <div className="text-muted-foreground pt-2 text-center text-sm">
                      Showing 5 of {completed.length} completed actions
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* No Action Items */}
      {actionItems.length === 0 && (
        <Card className="glass-hierarchy-child">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-gray-600" />
              Action Items
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border-border/50 text-muted-foreground flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-6 text-center text-sm">
              <Layers className="text-muted-foreground/70 h-6 w-6" />
              <p>No action items yet.</p>
              <p className="text-xs">Action items are created during cabinet meetings</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
