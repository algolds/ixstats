"use client";

import React, { memo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "~/components/ui/dialog";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";
import { Skeleton } from "~/components/ui/skeleton";
import {
  Calendar,
  Clock,
  Users,
  Layers,
  AlertTriangle,
  FileText,
  User,
  CheckCircle,
} from "lucide-react";
import { api } from "~/trpc/react";
import { IxTimeDate } from "~/components/ui/ix-time-date";

interface MeetingDetailModalProps {
  meetingId: string | null;
  onClose: () => void;
}

export function MeetingDetailModal({ meetingId, onClose }: MeetingDetailModalProps) {
  const isOpen = meetingId !== null;

  const { data: meeting, isLoading } = api.meetings.getMeeting.useQuery(
    { id: meetingId! },
    { enabled: !!meetingId }
  );

  const getStatusBadge = (status: string | undefined) => {
    switch (status?.toLowerCase()) {
      case "completed":
        return (
          <Badge className="bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400">
            <CheckCircle className="mr-1 h-3.5 w-3.5" />
            Completed
          </Badge>
        );
      case "cancelled":
        return (
          <Badge className="bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400">
            <AlertTriangle className="mr-1 h-3.5 w-3.5" />
            Cancelled
          </Badge>
        );
      case "in_progress":
        return (
          <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400">
            <Clock className="mr-1 h-3.5 w-3.5 animate-pulse" />
            In Progress
          </Badge>
        );
      default:
        return (
          <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
            <Calendar className="mr-1 h-3.5 w-3.5" />
            Scheduled
          </Badge>
        );
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <div className="mb-1 flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-500" />
            {meeting && getStatusBadge(meeting.status)}
            {meeting?.duration && (
              <Badge variant="outline" className="text-xs">
                {meeting.duration} min
              </Badge>
            )}
          </div>
          <DialogTitle className="text-lg">
            {isLoading ? "Loading Meeting..." : (meeting?.title ?? "Meeting Not Found")}
          </DialogTitle>
          <div className="text-muted-foreground mt-1 text-xs">
            {meeting?.scheduledDate && (
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                <IxTimeDate
                  date={meeting.scheduledDate}
                  ixTime={meeting.scheduledIxTime ?? undefined}
                  format="datetime"
                  accentColor="amber"
                  className="text-muted-foreground border-none bg-transparent p-0"
                />
              </span>
            )}
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="animate-pulse space-y-4 py-4">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : meeting ? (
          <div className="mt-2 space-y-5">
            {meeting.description && (
              <p className="text-muted-foreground text-sm leading-relaxed whitespace-pre-line">
                {meeting.description}
              </p>
            )}

            <Separator className="border-white/5" />

            {/* Agenda Items */}
            {meeting.agendaItems && meeting.agendaItems.length > 0 && (
              <div>
                <h3 className="text-muted-foreground mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
                  <FileText className="h-3.5 w-3.5 text-blue-500" />
                  Agenda
                </h3>
                <div className="space-y-2">
                  {meeting.agendaItems.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-lg border border-white/5 bg-white/5 p-3 text-xs"
                    >
                      <div className="mb-1 flex items-center justify-between font-medium">
                        <span>{item.title}</span>
                        {item.duration && (
                          <Badge variant="secondary" className="px-1 py-0 text-[10px]">
                            {item.duration}m
                          </Badge>
                        )}
                      </div>
                      {item.description && (
                        <p className="text-muted-foreground mt-0.5 whitespace-pre-line">
                          {item.description}
                        </p>
                      )}
                      {item.presenter && (
                        <p className="text-muted-foreground mt-1 flex items-center gap-1 text-[10px]">
                          <User className="h-3 w-3" /> Presenter: {item.presenter}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Attendees */}
            {meeting.attendances && meeting.attendances.length > 0 && (
              <div>
                <h3 className="text-muted-foreground mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
                  <Users className="h-3.5 w-3.5 text-blue-500" />
                  Attendees
                </h3>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {meeting.attendances.map((att) => (
                    <div
                      key={att.id}
                      className="flex items-center justify-between rounded-lg border border-white/5 bg-white/5 p-2.5 text-xs"
                    >
                      <div>
                        <p className="font-medium">{att.attendeeName}</p>
                        {att.attendeeRole && (
                          <p className="text-muted-foreground text-[10px]">{att.attendeeRole}</p>
                        )}
                      </div>
                      <Badge
                        variant="secondary"
                        className={`px-1.5 py-0 text-[9px] ${
                          att.attendanceStatus === "attended" || att.attendanceStatus === "present"
                            ? "bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400"
                            : att.attendanceStatus === "declined"
                              ? "bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400"
                              : "bg-yellow-100 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-400"
                        }`}
                      >
                        {att.attendanceStatus.toUpperCase()}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Decisions */}
            {meeting.decisions && meeting.decisions.length > 0 && (
              <div>
                <h3 className="text-muted-foreground mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
                  <Layers className="h-3.5 w-3.5 text-blue-500" />
                  Decisions
                </h3>
                <div className="space-y-2">
                  {meeting.decisions.map((dec) => (
                    <div
                      key={dec.id}
                      className="rounded-lg border border-white/5 bg-white/5 p-3 text-xs"
                    >
                      <h4 className="mb-1 font-medium text-blue-400">{dec.title}</h4>
                      <p className="text-muted-foreground mb-2 whitespace-pre-line">
                        {dec.description}
                      </p>
                      <div className="flex flex-wrap gap-2 text-[10px]">
                        <Badge variant="outline">{dec.decisionType.toUpperCase()}</Badge>
                        <Badge variant="outline">Status: {dec.implementationStatus}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action Items */}
            {meeting.actionItems && meeting.actionItems.length > 0 && (
              <div>
                <h3 className="text-muted-foreground mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
                  <AlertTriangle className="h-3.5 w-3.5 text-blue-500" />
                  Action Items
                </h3>
                <div className="space-y-2">
                  {meeting.actionItems.map((action) => (
                    <div
                      key={action.id}
                      className="flex flex-col gap-1.5 rounded-lg border border-white/5 bg-white/5 p-3 text-xs"
                    >
                      <div className="flex items-center justify-between font-medium">
                        <span>{action.title}</span>
                        <Badge
                          variant="secondary"
                          className={`px-1.5 py-0 text-[9px] ${
                            action.status === "completed"
                              ? "bg-green-100 text-green-700 dark:bg-green-950/30"
                              : "bg-yellow-100 text-yellow-700 dark:bg-yellow-950/30"
                          }`}
                        >
                          {action.status.toUpperCase()}
                        </Badge>
                      </div>
                      {action.description && (
                        <p className="text-muted-foreground whitespace-pre-line">
                          {action.description}
                        </p>
                      )}
                      <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-[10px]">
                        {action.assignedTo && <span>Assigned to: {action.assignedTo}</span>}
                        {action.dueDate && (
                          <span>Due: {new Date(action.dueDate).toLocaleDateString()}</span>
                        )}
                        <span>Priority: {action.priority}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-muted-foreground py-8 text-center text-sm">
            Meeting details could not be found.
          </div>
        )}

        <DialogFooter className="border-t border-white/5 pt-4">
          <Button id="btn-close-meeting-modal" variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default memo(MeetingDetailModal);
