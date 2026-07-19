"use client";

import React, { memo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
  Loader2,
  Plus,
} from "lucide-react";
import { api } from "~/trpc/react";
import { IxTimeDate } from "~/components/ui/ix-time-date";
import { ParadoxFlavorCard } from "~/components/narrator/ParadoxFlavorCard";
import { Label } from "~/components/ui/label";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { useNotify } from "~/hooks/useNotify";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

interface MeetingDetailModalProps {
  meetingId: string | null;
  onClose: () => void;
}

export function MeetingDetailModal({ meetingId, onClose }: MeetingDetailModalProps) {
  const isOpen = meetingId !== null;
  const utils = api.useUtils();
  const notify = useNotify();

  const [notes, setNotes] = useState("");
  const [showNotesForm, setShowNotesForm] = useState(false);

  const [isRecordingDecision, setIsRecordingDecision] = useState(false);
  const [newDecisionTitle, setNewDecisionTitle] = useState("");
  const [newDecisionDesc, setNewDecisionDesc] = useState("");
  const [newDecisionType, setNewDecisionType] = useState<
    "policy" | "budget" | "personnel" | "strategic" | "other"
  >("strategic");
  const [selectedMetric, setSelectedMetric] = useState("politicalStability");
  const [metricValue, setMetricValue] = useState(1);
  const [metricOp, setMetricOp] = useState<"add" | "subtract">("add");

  const { data: meeting, isLoading } = api.meetings.getMeeting.useQuery(
    { id: meetingId! },
    { enabled: !!meetingId }
  );

  const { data: intent } = api.intent.getIntent.useQuery(
    { id: meeting?.intentId || "" },
    { enabled: !!meeting?.intentId }
  );

  const { data: suggestion, isLoading: suggestionsLoading } = api.intent.suggest.useQuery(
    { countryId: meeting?.countryId || "", goal: intent?.goal || "" },
    { enabled: !!meeting?.countryId && !!intent?.goal && intent.status === "proposed" }
  );

  const commitIntentMutation = api.intent.commit.useMutation({
    onSuccess: async (res) => {
      try {
        await recordDecisionMutation.mutateAsync({
          meetingId: meeting!.id,
          title: `Committed Intent: ${intent!.goal} (${res.intent.tier})`,
          description: res.summary,
          decisionType: "strategic",
          targetModel: "Intent",
          targetField: "status",
          operation: "set",
          value: 1,
        });
        await completeMutation.mutateAsync({
          meetingId: meeting!.id,
          notes: `Deliberation complete. Rulers committed to the ${res.intent.tier} package course for goal: "${intent!.goal}".`,
        });
      } catch (err: any) {
        notify.error(`Failed to record decision: ${err.message}`);
      }
    },
    onError: (err) => {
      notify.error(`Failed to commit intent: ${err.message}`);
    },
  });

  const completeMutation = api.quickActions.completeMeeting.useMutation({
    onSuccess: () => {
      notify.success("Cabinet meeting completed successfully!");
      void utils.meetings.getMeeting.invalidate({ id: meetingId! });
      void utils.meetings.getMeetings.invalidate();
    },
    onError: (err) => {
      notify.error(`Failed to complete meeting: ${err.message}`);
    },
  });

  const implementMutation = api.quickActions.implementDecision.useMutation({
    onSuccess: () => {
      notify.success("Decision implemented and consequences applied to national ledger!");
      void utils.meetings.getMeeting.invalidate({ id: meetingId! });
      void utils.meetings.getMeetings.invalidate();
      void utils.mycountry.getChangeLog.invalidate();
    },
    onError: (err) => {
      notify.error(`Failed to implement decision: ${err.message}`);
    },
  });

  const recordDecisionMutation = api.quickActions.createDecision.useMutation({
    onSuccess: () => {
      notify.success("Decision recorded successfully!");
      setNewDecisionTitle("");
      setNewDecisionDesc("");
      setIsRecordingDecision(false);
      void utils.meetings.getMeeting.invalidate({ id: meetingId! });
      void utils.meetings.getMeetings.invalidate();
    },
    onError: (err) => {
      notify.error(`Failed to record decision: ${err.message}`);
    },
  });

  const getTargetModel = (field: string): string => {
    const govFields = [
      "politicalStability",
      "governmentEffectiveness",
      "democracyIndex",
      "ruleOfLaw",
      "corruptionIndex",
      "politicalPolarization",
    ];
    const stabilityFields = ["stabilityScore", "crimeRate", "socialCohesion", "trustInGovernment"];
    if (govFields.includes(field)) return "GovernmentStructure";
    if (stabilityFields.includes(field)) return "InternalStabilityMetrics";
    return "Country";
  };

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

            {/* V2 Intent Deliberation Section */}
            {intent && intent.status === "proposed" && meeting.status !== "completed" && (
              <div className="space-y-4 rounded-xl border border-amber-500/25 bg-amber-500/5 p-4 dark:bg-amber-500/10">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-amber-500">
                    Cabinet Deliberation: {intent.goal}
                  </h3>
                </div>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  Your cabinet ministries have prepared three policy execution packages. Select one course of action to commit resources, set the national policy active, and conclude this session.
                </p>

                {suggestionsLoading ? (
                  <div className="space-y-2 py-4">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                ) : suggestion?.packages ? (
                  <div className="flex flex-col gap-3">
                    {suggestion.packages.map((pkg) => {
                      const isPending = commitIntentMutation.isPending && commitIntentMutation.variables?.tier === pkg.tier;
                      return (
                        <div
                          key={pkg.tier}
                          className="flex flex-col items-start gap-3 rounded-lg border border-white/5 bg-white/[0.02] p-3 text-left transition-[border-color,background-color,transform] duration-150 ease-out hover:border-amber-500/20 hover:bg-amber-500/[0.04] active:scale-[0.98] shadow-sm relative overflow-hidden"
                        >
                          <div className="flex w-full items-center justify-between">
                            <div>
                              <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                                {pkg.tier} course
                              </span>
                              <span className="ml-2 text-[10px] text-muted-foreground font-semibold">
                                Accept: {pkg.acceptance}%
                              </span>
                            </div>
                            <Button
                              size="xs"
                              disabled={commitIntentMutation.isPending}
                              onClick={() => {
                                commitIntentMutation.mutate({
                                  countryId: meeting.countryId,
                                  goal: intent.goal,
                                  tier: pkg.tier as any,
                                  intentId: intent.id,
                                });
                              }}
                              className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10px] h-6 px-3.5 cursor-pointer rounded"
                            >
                              {isPending ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                "Authorize"
                              )}
                            </Button>
                          </div>
                          
                          <div className="space-y-1 w-full">
                            {pkg.changes.map((change: any, i: number) => (
                              <div key={i} className="flex items-center gap-1.5 text-[11px] leading-snug text-muted-foreground">
                                <span className="text-amber-500">✦</span>
                                <span>{change.label}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-red-400">Failed to load deliberation packages.</p>
                )}
              </div>
            )}

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
                      {(item.linkedIssueId || item.linkedPolicyId) && (
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {item.linkedIssueId && (
                            <Badge
                              variant="outline"
                              className="border-yellow-500/20 bg-yellow-500/10 px-1.5 py-0 text-[10px] text-yellow-400"
                            >
                              Linked Issue
                            </Badge>
                          )}
                          {item.linkedPolicyId && (
                            <Badge
                              variant="outline"
                              className="border-indigo-500/20 bg-indigo-500/10 px-1.5 py-0 text-[10px] text-indigo-400"
                            >
                              Linked Policy
                            </Badge>
                          )}
                        </div>
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
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
                  <Layers className="h-3.5 w-3.5 text-blue-500" />
                  Decisions
                </h3>
              </div>

              {meeting.decisions && meeting.decisions.length > 0 ? (
                <div className="space-y-2">
                  {meeting.decisions.map((dec) => (
                    <div
                      key={dec.id}
                      className="rounded-lg border border-white/5 bg-white/5 p-3 text-xs"
                    >
                      <div className="mb-1 flex items-start justify-between">
                        <h4 className="font-medium text-blue-400">{dec.title}</h4>
                        <Badge
                          variant="secondary"
                          className={`px-1.5 py-0 text-[9px] ${
                            dec.implementationStatus === "implemented"
                              ? "bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400"
                              : "bg-yellow-100 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-400"
                          }`}
                        >
                          {dec.implementationStatus.toUpperCase()}
                        </Badge>
                      </div>
                      <ParadoxFlavorCard
                        id={dec.id}
                        type="decision"
                        title={dec.title}
                        description={dec.description}
                        countryId={meeting.countryId}
                      />
                      <p className="text-muted-foreground mt-1.5 mb-2 whitespace-pre-line">
                        {dec.description}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-white/5 pt-2">
                        <div className="flex flex-wrap gap-2 text-[10px]">
                          <Badge variant="outline">{dec.decisionType.toUpperCase()}</Badge>
                          {dec.estimatedEffect && (
                            <Badge
                              variant="outline"
                              className="border-blue-500/25 bg-blue-500/5 text-blue-400"
                            >
                              Has Consequences
                            </Badge>
                          )}
                        </div>
                        {dec.implementationStatus === "pending" && (
                          <Button
                            size="xs"
                            className="h-6 bg-blue-600 px-2.5 py-0.5 text-[10px] font-semibold text-white hover:bg-blue-700"
                            onClick={() => implementMutation.mutate({ decisionId: dec.id })}
                            disabled={implementMutation.isPending}
                          >
                            {implementMutation.isPending ? (
                              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                            ) : null}
                            Implement
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-xs italic">No decisions recorded yet.</p>
              )}

              {/* Record custom decisions if meeting is completed */}
              {meeting.status === "completed" && (
                <div className="mt-4 border-t border-white/5 pt-3">
                  {!isRecordingDecision ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setIsRecordingDecision(true)}
                      className="h-8 w-full gap-1.5 text-xs font-semibold"
                    >
                      <Plus className="h-3.5 w-3.5" /> Record New Decision
                    </Button>
                  ) : (
                    <div className="space-y-3 rounded-lg border border-white/10 bg-white/5 p-3 text-xs">
                      <h4 className="text-xs font-semibold tracking-wider text-blue-400 uppercase">
                        Record New Decision
                      </h4>
                      <div className="space-y-1.5">
                        <Label
                          htmlFor="dec-title"
                          className="text-muted-foreground text-[10px] font-medium uppercase"
                        >
                          Title
                        </Label>
                        <Input
                          id="dec-title"
                          value={newDecisionTitle}
                          onChange={(e) => setNewDecisionTitle(e.target.value)}
                          placeholder="e.g. Expand Infrastructure Budget"
                          className="h-8 border-white/10 bg-black/20 text-xs"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label
                          htmlFor="dec-desc"
                          className="text-muted-foreground text-[10px] font-medium uppercase"
                        >
                          Description
                        </Label>
                        <Textarea
                          id="dec-desc"
                          value={newDecisionDesc}
                          onChange={(e) => setNewDecisionDesc(e.target.value)}
                          placeholder="Describe the decision and its context..."
                          className="min-h-[60px] border-white/10 bg-black/20 text-xs"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1.5">
                          <Label className="text-muted-foreground text-[10px] font-medium uppercase">
                            Type
                          </Label>
                          <Select
                            value={newDecisionType}
                            onValueChange={(v) => setNewDecisionType(v as any)}
                          >
                            <SelectTrigger className="h-8 border-white/10 bg-black/20 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="border-white/10 bg-slate-900">
                              <SelectItem value="strategic">Strategic Directive</SelectItem>
                              <SelectItem value="budget">Budget Allocation</SelectItem>
                              <SelectItem value="policy">Policy Approval</SelectItem>
                              <SelectItem value="personnel">Personnel Appointment</SelectItem>
                              <SelectItem value="other">Other Resolution</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-muted-foreground text-[10px] font-medium uppercase">
                            Impacted Metric
                          </Label>
                          <Select value={selectedMetric} onValueChange={setSelectedMetric}>
                            <SelectTrigger className="h-8 border-white/10 bg-black/20 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="border-white/10 bg-slate-900">
                              <SelectItem value="politicalStability">
                                Political Stability
                              </SelectItem>
                              <SelectItem value="governmentEffectiveness">
                                Gov Effectiveness
                              </SelectItem>
                              <SelectItem value="publicApproval">Public Approval</SelectItem>
                              <SelectItem value="povertyRate">Poverty Rate</SelectItem>
                              <SelectItem value="unemploymentRate">Unemployment</SelectItem>
                              <SelectItem value="inflationRate">Inflation</SelectItem>
                              <SelectItem value="stabilityScore">Internal Stability</SelectItem>
                              <SelectItem value="crimeRate">Crime Rate</SelectItem>
                              <SelectItem value="socialCohesion">Social Cohesion</SelectItem>
                              <SelectItem value="trustInGovernment">Trust in Govt</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1.5">
                          <Label className="text-muted-foreground text-[10px] font-medium uppercase">
                            Operation
                          </Label>
                          <Select value={metricOp} onValueChange={(v) => setMetricOp(v as any)}>
                            <SelectTrigger className="h-8 border-white/10 bg-black/20 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="border-white/10 bg-slate-900">
                              <SelectItem value="add">Improve (+)</SelectItem>
                              <SelectItem value="subtract">Worsen (-)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-muted-foreground text-[10px] font-medium uppercase">
                            Value Change (%)
                          </Label>
                          <Input
                            type="number"
                            value={metricValue}
                            onChange={(e) => setMetricValue(parseFloat(e.target.value) || 0)}
                            className="h-8 border-white/10 bg-black/20 text-xs"
                            min="0.1"
                            max="50"
                            step="0.1"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-2">
                        <Button
                          size="xs"
                          variant="ghost"
                          className="h-7"
                          onClick={() => setIsRecordingDecision(false)}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="xs"
                          className="h-7 bg-blue-600 font-semibold text-white hover:bg-blue-700"
                          disabled={
                            recordDecisionMutation.isPending ||
                            !newDecisionTitle ||
                            !newDecisionDesc
                          }
                          onClick={() => {
                            const targetModel = getTargetModel(selectedMetric);
                            const serialized = JSON.stringify([
                              {
                                targetModel,
                                targetField: selectedMetric,
                                operation: metricOp,
                                value: metricValue,
                                effectType: "DECISION_EFFECT",
                              },
                            ]);
                            recordDecisionMutation.mutate({
                              meetingId: meeting.id,
                              title: newDecisionTitle,
                              description: newDecisionDesc,
                              decisionType: newDecisionType,
                              outcome: "approved",
                              estimatedEffect: serialized,
                            });
                          }}
                        >
                          {recordDecisionMutation.isPending && (
                            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                          )}
                          Record Decision
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

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

        <DialogFooter className="flex flex-col gap-3 border-t border-white/5 pt-4">
          {meeting &&
            (showNotesForm ? (
              <div className="w-full space-y-2 rounded-lg border border-white/10 bg-white/5 p-3 text-left text-xs">
                <Label
                  htmlFor="meeting-notes"
                  className="text-muted-foreground text-[10px] font-medium uppercase"
                >
                  Final Meeting Notes
                </Label>
                <Textarea
                  id="meeting-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Enter meeting notes, outcomes, or summaries..."
                  className="border-white/10 bg-black/20 text-xs"
                />
                <div className="flex justify-end gap-2">
                  <Button size="xs" variant="ghost" onClick={() => setShowNotesForm(false)}>
                    Cancel
                  </Button>
                  <Button
                    size="xs"
                    className="bg-emerald-600 font-semibold text-white hover:bg-emerald-700"
                    disabled={completeMutation.isPending}
                    onClick={() => {
                      completeMutation.mutate({
                        meetingId: meeting.id,
                        notes,
                      });
                      setShowNotesForm(false);
                    }}
                  >
                    {completeMutation.isPending ? (
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    ) : null}
                    Complete Meeting
                  </Button>
                </div>
              </div>
            ) : (
              meeting.status !== "completed" &&
              meeting.status !== "cancelled" &&
              !(intent && intent.status === "proposed") && (
                <Button
                  size="sm"
                  className="mb-2 w-full bg-emerald-600 font-medium text-white hover:bg-emerald-700"
                  onClick={() => setShowNotesForm(true)}
                >
                  Complete & Finalize Meeting
                </Button>
              )
            ))}

          <div className="flex w-full justify-end">
            <Button id="btn-close-meeting-modal" variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default memo(MeetingDetailModal);
