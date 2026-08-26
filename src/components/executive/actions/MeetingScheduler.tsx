"use client";

import React, { useState } from "react";
import { api } from "~/trpc/react";
import { IxTime } from "~/lib/ixtime";
import { useUser } from "~/context/auth-context";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

import { Calendar, Plus, Xmark as X, Component as Layers } from "iconoir-react";
import { useNotify } from "~/hooks/useNotify";

import type { AgendaItem, MeetingSchedulerProps } from "./meeting-scheduler-types";
import { AGENDA_CATEGORIES, INTENT_TEMPLATES } from "./meeting-scheduler-intents";

export function MeetingScheduler({
  countryId,
  open,
  onOpenChange,
  defaultMeeting,
  defaultTargetCountryId,
}: MeetingSchedulerProps) {
  const notify = useNotify();
  const { user } = useUser();

  // Redesign state
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("routine");
  const [timePreset, setTimePreset] = useState<"immediately" | "tomorrow" | "custom">(
    "immediately"
  );
  const [isChangingIntent, setIsChangingIntent] = useState(false);

  // Core Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [scheduledIxTime, setScheduledIxTime] = useState(0);
  const [duration, setDuration] = useState(60);
  const [selectedOfficials, setSelectedOfficials] = useState<string[]>([]);
  const [agendaItems, setAgendaItems] = useState<AgendaItem[]>([]);
  const [meetingType, setMeetingType] = useState<"cabinet" | "bilateral">("cabinet");
  const [targetCountryId, setTargetCountryId] = useState<string>("");
  const [linkedIntentId, setLinkedIntentId] = useState<string>("");

  // Agenda and UI state
  const [newAgendaTitle, setNewAgendaTitle] = useState("");
  const [expandedAgendaIndex, setExpandedAgendaIndex] = useState<number | null>(null);

  // Queries
  const { data: selectCountries } = api.countries.getSelectList.useQuery(
    { limit: 100 },
    { enabled: open }
  );

  const { data: intents } = api.intent.getTree.useQuery({ countryId }, { enabled: open });

  const proposedIntents = React.useMemo(() => {
    const list = Array.isArray(intents) ? intents : (intents?.allIntents ?? []);
    return list.filter((i: any) => i.status === "proposed");
  }, [intents]);

  const { data: officials, isLoading: officialsLoading } = api.quickActions.getOfficials.useQuery(
    { countryId, activeOnly: true },
    { enabled: open }
  );

  const { data: targetOfficials, isLoading: targetOfficialsLoading } =
    api.quickActions.getOfficials.useQuery(
      { countryId: targetCountryId, activeOnly: true },
      { enabled: open && meetingType === "bilateral" && !!targetCountryId }
    );

  // Mutations
  const createMeeting = api.meetings.createMeeting.useMutation();
  const addAgendaItemMutation = api.meetings.addAgendaItem.useMutation();
  const recordAttendance = api.meetings.recordAttendance.useMutation();

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Keep scheduledIxTime in sync with presets
  React.useEffect(() => {
    if (open) {
      if (timePreset === "immediately") {
        // oxlint-disable-next-line
        setScheduledIxTime(IxTime.getCurrentIxTime());
      } else if (timePreset === "tomorrow") {
        setScheduledIxTime(IxTime.getCurrentIxTime() + 24 * 60 * 60 * 1000);
      } else if (timePreset === "custom") {
        const tomorrowIx = IxTime.getCurrentIxTime() + 24 * 60 * 60 * 1000;
        const tomorrowDate = new Date(tomorrowIx);
        const defaultCustomTime = Date.UTC(
          tomorrowDate.getUTCFullYear(),
          tomorrowDate.getUTCMonth(),
          tomorrowDate.getUTCDate(),
          9,
          0,
          0,
          0
        );
        setScheduledIxTime(defaultCustomTime);
      }
    }
  }, [timePreset, open]);

  // Handle template selection and configuration
  const handleSelectTemplate = React.useCallback(
    (tpl: (typeof INTENT_TEMPLATES)[0]) => {
      setSelectedTemplateId(tpl.id);
      setMeetingType(tpl.meetingType);
      setTitle(tpl.defaultTitle);
      setDuration(tpl.defaultDuration);
      setAgendaItems(tpl.agenda.map((item) => ({ ...item })));

      if (officials && officials.length > 0) {
        if (tpl.recommendedRoles.length === 0) {
          // Invite all by default for routine review
          setSelectedOfficials(officials.map((o) => o.id));
        } else {
          const matching = officials.filter((o) =>
            tpl.recommendedRoles.some(
              (role) => o.title.toLowerCase().includes(role) || o.role?.toLowerCase().includes(role)
            )
          );
          setSelectedOfficials(matching.map((o) => o.id));
        }
      } else {
        setSelectedOfficials([]);
      }
    },
    [officials]
  );

  // Load prefills / defaults on open
  React.useEffect(() => {
    if (open) {
      if (defaultMeeting) {
        // oxlint-disable-next-line
        setTitle(defaultMeeting.title ?? "");
        setDescription(defaultMeeting.description ?? "");
        if (defaultMeeting.ixTime) {
          setScheduledIxTime(defaultMeeting.ixTime);
          setTimePreset("custom");
        }
        if (defaultMeeting.officialIds) {
          setSelectedOfficials(defaultMeeting.officialIds);
        }

        if (defaultTargetCountryId) {
          setTargetCountryId(defaultTargetCountryId);
          setMeetingType("bilateral");
          setSelectedTemplateId("bilateral");
        }

        if (defaultMeeting.prefilledAgenda) {
          const item = defaultMeeting.prefilledAgenda;
          setAgendaItems([
            {
              title: item.title,
              description: item.description,
              duration: 30,
              category: item.category,
              tags: ["crisis"],
              presenter: "Cabinet President",
              linkedIssueId: item.linkedIssueId,
              linkedPolicyId: item.linkedPolicyId,
            },
          ]);

          if (item.linkedIssueId) {
            setSelectedTemplateId("crisis");
            setMeetingType("cabinet");
          } else if (item.linkedPolicyId) {
            setSelectedTemplateId("economic");
            setMeetingType("cabinet");
          }
        }
        setIsChangingIntent(false);
      } else {
        // Default to routine review
        const defaultTpl = INTENT_TEMPLATES.find((t) => t.id === "routine");
        if (defaultTpl) {
          handleSelectTemplate(defaultTpl);
        }
        setIsChangingIntent(true);
      }
    }
  }, [open, defaultMeeting, defaultTargetCountryId, handleSelectTemplate]);

  const toggleOfficial = (officialId: string) => {
    setSelectedOfficials((prev) =>
      prev.includes(officialId) ? prev.filter((id) => id !== officialId) : [...prev, officialId]
    );
  };

  // Merge host officials and target country officials
  const allOfficials = React.useMemo(() => {
    const hostList = (officials || []).map((o) => ({
      ...o,
      isHost: true,
      countryLabel: "Internal",
    }));

    const targetCountry = selectCountries?.find((c) => c.id === targetCountryId);
    const targetName = targetCountry?.name || "Foreign";

    const targetList = (targetOfficials || []).map((o) => ({
      ...o,
      isHost: false,
      countryLabel: targetName,
    }));

    return [...hostList, ...targetList];
  }, [officials, targetOfficials, targetCountryId, selectCountries]);

  const handleAddQuickAgendaTopic = () => {
    if (!newAgendaTitle.trim()) return;
    const newItem: AgendaItem = {
      title: newAgendaTitle.trim(),
      description: "",
      duration: 15,
      category: "governance",
      tags: [],
      presenter: "Ruler",
    };
    setAgendaItems([...agendaItems, newItem]);
    setNewAgendaTitle("");
    setExpandedAgendaIndex(agendaItems.length); // Auto-expand new item
  };

  const removeAgendaItem = (index: number) => {
    setAgendaItems(agendaItems.filter((_, i) => i !== index));
    if (expandedAgendaIndex === index) {
      setExpandedAgendaIndex(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      notify.error("Meeting title is required");
      return;
    }

    if (meetingType === "bilateral" && !targetCountryId) {
      notify.error("Please select a target country");
      return;
    }

    if (agendaItems.length === 0) {
      notify.error("Please add at least one agenda item");
      return;
    }

    if (allOfficials.length > 0 && selectedOfficials.length === 0) {
      notify.error("Please select at least one attendee");
      return;
    }

    if (!user?.id) {
      notify.error("You must be signed in to schedule a meeting");
      return;
    }

    setIsSubmitting(true);
    try {
      const meeting = await createMeeting.mutateAsync({
        countryId,
        targetCountryId: meetingType === "bilateral" ? targetCountryId : undefined,
        userId: user.id,
        title,
        description: description || undefined,
        scheduledDate: new Date(scheduledIxTime),
        duration,
        scheduledIxTime,
        intentId: linkedIntentId && linkedIntentId !== "none" ? linkedIntentId : undefined,
      });

      const attendancePromises =
        selectedOfficials.length > 0
          ? selectedOfficials.map((officialId) => {
              const official = allOfficials.find((o) => o.id === officialId);
              return recordAttendance.mutateAsync({
                meetingId: meeting.id,
                officialId,
                attendeeName: official?.name ?? "Official",
                attendanceStatus: "invited",
                attendeeRole: official ? `${official.title} (${official.countryLabel})` : undefined,
              });
            })
          : [
              recordAttendance.mutateAsync({
                meetingId: meeting.id,
                officialId: null,
                attendeeName: user.fullName || user.username || "Ruler",
                attendanceStatus: "invited",
                attendeeRole: "Head of State",
              }),
            ];

      await Promise.all([
        ...agendaItems.map((item, index) =>
          addAgendaItemMutation.mutateAsync({
            meetingId: meeting.id,
            title: item.title,
            description: item.description || undefined,
            order: index,
            estimatedDuration: item.duration,
            priority: "medium",
            linkedIssueId: item.linkedIssueId,
            linkedPolicyId: item.linkedPolicyId,
            linkedIntentId: item.linkedIntentId,
          })
        ),
        ...attendancePromises,
      ]);

      const successMsg =
        meetingType === "bilateral"
          ? "Summit request sent to the guest country!"
          : `${title} has been added to your calendar.`;
      notify.success(
        meetingType === "bilateral" ? "Summit Requested" : "Meeting Scheduled",
        successMsg
      );
      onOpenChange(false);

      // Reset form variables
      setSelectedTemplateId("routine");
      setTimePreset("immediately");
      setTitle("");
      setDescription("");
      setAgendaItems([]);
      setSelectedOfficials([]);
      setLinkedIntentId("");
    } catch (error: any) {
      notify.error("Failed to schedule meeting", error?.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalAgendaDuration = agendaItems.reduce((sum, item) => sum + item.duration, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[450px] gap-0 overflow-visible border-none bg-transparent p-0 shadow-none md:max-w-[830px]">
        <div className="flex h-[85vh] max-h-[85vh] w-full flex-col items-start gap-3 overflow-visible md:flex-row">
          {/* Card 1: Setup Details */}
          <div className="bg-background border-border flex h-[85vh] max-h-[85vh] min-w-[320px] flex-1 flex-col overflow-hidden rounded-xl shadow-2xl backdrop-blur-md md:min-w-[450px]">
            <DialogHeader className="shrink-0 border-b border-white/5 px-6 pt-6 pb-4">
              <DialogTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-amber-500" />
                Schedule Meeting
              </DialogTitle>
              <DialogDescription>
                Assemble your cabinet and foreign delegates to deliberate on national crises, draft
                policy reforms, or coordinate diplomatic summits.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
              <div className="flex-1 space-y-5 overflow-y-auto px-6 py-4">
                {/* Linked Prefill Indicator */}
                {defaultMeeting?.prefilledAgenda && (
                  <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-200/90">
                    <span className="mb-0.5 block text-[10px] font-semibold tracking-wider text-amber-500 uppercase">
                      Linked Reference
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-foreground font-medium">
                        {defaultMeeting.prefilledAgenda.title}
                      </span>
                      <Badge
                        variant="outline"
                        className="border-amber-500/35 bg-amber-500/10 px-1.5 py-0 text-[9px] font-semibold text-amber-400"
                      >
                        {defaultMeeting.prefilledAgenda.linkedIssueId
                          ? "CRISIS ISSUE"
                          : "DRAFT POLICY"}
                      </Badge>
                    </div>
                  </div>
                )}

                {/* Intent Selector */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-muted-foreground text-xs font-semibold uppercase">
                      Select Agenda Intent
                    </Label>
                    {!isChangingIntent && (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setIsChangingIntent(true)}
                        className="h-5 cursor-pointer px-1.5 text-[10px] font-bold text-amber-500 hover:bg-amber-500/10 hover:text-amber-600"
                      >
                        Change Intent
                      </Button>
                    )}
                  </div>

                  {!isChangingIntent ? (
                    (() => {
                      const activeTpl =
                        INTENT_TEMPLATES.find((t) => t.id === selectedTemplateId) ||
                        INTENT_TEMPLATES[0];
                      return (
                        <div className="flex flex-col items-start rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-left transition-all duration-300 dark:bg-amber-500/10">
                          <span className="text-xs font-semibold text-amber-900 dark:text-amber-100">
                            {activeTpl.name}
                          </span>
                          <span className="mt-0.5 text-[10px] leading-snug text-amber-800/80 dark:text-amber-300/80">
                            {activeTpl.description}
                          </span>
                        </div>
                      );
                    })()
                  ) : (
                    <div className="animate-in fade-in slide-in-from-top-1 grid grid-cols-2 gap-2 duration-200">
                      {INTENT_TEMPLATES.map((tpl) => {
                        const isSelected = selectedTemplateId === tpl.id;
                        return (
                          <button
                            key={tpl.id}
                            type="button"
                            onClick={() => {
                              handleSelectTemplate(tpl);
                              setIsChangingIntent(false);
                            }}
                            className={cn(
                              "flex cursor-pointer flex-col items-start rounded-lg border p-2.5 text-left text-xs transition-all select-none",
                              isSelected
                                ? "border-amber-500/40 bg-amber-500/10 shadow-sm dark:bg-amber-500/15"
                                : "text-muted-foreground hover:text-foreground border-white/5 hover:border-white/10 hover:bg-white/[0.02]"
                            )}
                          >
                            <span
                              className={cn(
                                "font-semibold",
                                isSelected
                                  ? "text-amber-900 dark:text-amber-100"
                                  : "text-foreground"
                              )}
                            >
                              {tpl.name}
                            </span>
                            <span
                              className={cn(
                                "mt-0.5 line-clamp-1 text-[10px] leading-snug",
                                isSelected
                                  ? "text-amber-800/80 dark:text-amber-300/80"
                                  : "text-muted-foreground"
                              )}
                            >
                              {tpl.description}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Bilateral Target selector */}
                {meetingType === "bilateral" && (
                  <div>
                    <Label htmlFor="targetCountry" className="text-xs">
                      Foreign Guest Country *
                    </Label>
                    <Select
                      value={targetCountryId}
                      onValueChange={setTargetCountryId}
                      disabled={!!defaultTargetCountryId}
                    >
                      <SelectTrigger id="targetCountry" className="mt-1 h-9 text-xs">
                        <SelectValue placeholder="Select invited country..." />
                      </SelectTrigger>
                      <SelectContent>
                        {selectCountries
                          ?.filter((c) => c.id !== countryId)
                          .map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              <span className="flex items-center gap-2">
                                {c.flagUrl && (
                                  <img
                                    src={c.flagUrl}
                                    alt=""
                                    className="h-3 w-4 rounded object-cover"
                                  />
                                )}
                                {c.name}
                              </span>
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Basic Metadata */}
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="title" className="text-xs">
                      Session Title *
                    </Label>
                    <Input
                      id="title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="E.g., Emergency Cabinet Session"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="description" className="text-xs">
                      Context Notes
                    </Label>
                    <Textarea
                      id="description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Optional brief notes about the session objectives..."
                      rows={2}
                    />
                  </div>

                  {proposedIntents.length > 0 && (
                    <div>
                      <Label htmlFor="intent-select" className="text-xs">
                        Link to Proposed Intent
                      </Label>
                      <Select
                        value={linkedIntentId}
                        onValueChange={(val) => {
                          setLinkedIntentId(val);
                          if (val === "none") {
                            setTitle("");
                            setAgendaItems([]);
                          } else {
                            const selected = proposedIntents.find((i: any) => i.id === val);
                            if (selected) {
                              setTitle(`Deliberate Intent: ${selected.goal}`);
                              setAgendaItems([
                                {
                                  title: `Deliberate: ${selected.goal}`,
                                  description: `Evaluate and commit Measured, Moderate, or Extreme packages for "${selected.goal}".`,
                                  duration: 30,
                                  category: selected.category || "governance",
                                  tags: ["intent"],
                                  presenter: "Cabinet President",
                                  linkedIntentId: selected.id,
                                },
                              ]);
                            }
                          }
                        }}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select proposed intent to deliberate..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None (Routine Session)</SelectItem>
                          {proposedIntents.map((intent: any) => (
                            <SelectItem key={intent.id} value={intent.id}>
                              {intent.goal} ({intent.category})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                {/* Scheduling Date presets */}
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs font-semibold uppercase">
                    Scheduled Date & Time
                  </Label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: "immediately", label: "Immediately" },
                      { id: "tomorrow", label: "Tomorrow" },
                      { id: "custom", label: "Custom Date..." },
                    ].map((preset) => {
                      const isActive = timePreset === preset.id;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => setTimePreset(preset.id as any)}
                          className={cn(
                            "cursor-pointer rounded-md border py-2 text-xs font-semibold transition-all",
                            isActive
                              ? "border-amber-500/25 bg-amber-500/10 font-bold text-amber-900 dark:bg-amber-500/15 dark:text-amber-400"
                              : "text-muted-foreground hover:text-foreground border-white/5 hover:border-white/10 hover:bg-white/[0.02]"
                          )}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>

                  {timePreset === "custom" && (
                    <div className="mt-2.5 space-y-2.5 rounded-lg border border-white/5 bg-white/[0.01] p-3">
                      <Label
                        htmlFor="custom-date"
                        className="text-muted-foreground text-xs font-semibold uppercase"
                      >
                        Select Date
                      </Label>
                      <Input
                        id="custom-date"
                        type="date"
                        value={(() => {
                          const d = new Date(scheduledIxTime);
                          const y = d.getUTCFullYear();
                          const m = String(d.getUTCMonth() + 1).padStart(2, "0");
                          const day = String(d.getUTCDate()).padStart(2, "0");
                          return `${y}-${m}-${day}`;
                        })()}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (!val) return;
                          const [y, m, d] = val.split("-").map(Number);
                          const newTime = Date.UTC(y, m - 1, d, 9, 0, 0, 0);
                          setScheduledIxTime(newTime);
                        }}
                        required
                        className="bg-background max-w-[180px] border-white/10 py-1.5 text-xs focus:border-amber-500/50"
                      />
                      <div className="flex items-center gap-1.5 rounded border border-amber-500/10 bg-amber-500/5 px-2.5 py-1 text-xs font-medium text-amber-500/90">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>Scheduled Date:</span>
                        <span className="text-foreground">
                          {IxTime.formatIxTime(scheduledIxTime, false).replace(" (ILT)", "")}
                        </span>
                        <span className="text-muted-foreground ml-auto text-[10px] font-normal">
                          (09:00)
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Attendees Smart Badges removed from Card 1 */}
              </div>

              <DialogFooter className="mt-auto shrink-0 border-t border-white/5 px-6 py-4">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onOpenChange(false)}
                  className="cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="cursor-pointer bg-amber-600 font-semibold text-white hover:bg-amber-700"
                  disabled={
                    isSubmitting ||
                    agendaItems.length === 0 ||
                    (allOfficials.length > 0 && selectedOfficials.length === 0)
                  }
                >
                  {isSubmitting ? "Scheduling..." : "Schedule Meeting"}
                </Button>
              </DialogFooter>
            </form>
          </div>

          {/* Card 2: Attached Agenda & Roster Panel */}
          <div className="bg-background border-border animate-in fade-in slide-in-from-right-2 flex max-h-[85vh] w-full flex-col overflow-hidden rounded-xl shadow-2xl backdrop-blur-md duration-300 md:w-[350px]">
            <div className="shrink-0 border-b border-white/5 px-5 pt-5 pb-3">
              <h3 className="text-foreground flex items-center gap-1.5 text-sm font-semibold">
                <Layers className="h-4 w-4 text-amber-500" />
                Roster & Agenda
              </h3>
              <p className="text-muted-foreground mt-0.5 text-[11px]">
                {selectedOfficials.length} invited · {agendaItems.length} topics
              </p>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto p-5">
              {/* Section 1: Attendees */}
              <div className="space-y-2.5">
                <Label className="text-muted-foreground text-xs font-semibold uppercase">
                  Ministers & Attendees ({selectedOfficials.length} invited)
                </Label>

                {officialsLoading || (meetingType === "bilateral" && targetOfficialsLoading) ? (
                  <div className="text-muted-foreground animate-pulse py-2 text-xs">
                    Loading officials...
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-1.5">
                      {selectedOfficials.map((id) => {
                        const official = allOfficials.find((o) => o.id === id);
                        if (!official) return null;
                        const isRecommended =
                          selectedTemplateId &&
                          INTENT_TEMPLATES.find(
                            (t) => t.id === selectedTemplateId
                          )?.recommendedRoles.some(
                            (role) =>
                              official.title.toLowerCase().includes(role) ||
                              official.role?.toLowerCase().includes(role)
                          );
                        return (
                          <div
                            key={id}
                            className={cn(
                              "flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] transition-all",
                              isRecommended
                                ? "border-amber-500/20 bg-amber-500/10 text-amber-500/90 dark:text-amber-400"
                                : "border-white/5 bg-white/5 text-slate-300"
                            )}
                          >
                            <div className="flex max-w-[100px] min-w-0 flex-col text-left leading-tight">
                              <span className="truncate font-semibold">{official.name}</span>
                              <span className="truncate text-[8px] opacity-60">
                                {official.title}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => toggleOfficial(id)}
                              className="text-muted-foreground ml-0.5 shrink-0 cursor-pointer hover:text-white"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        );
                      })}

                      {selectedOfficials.length === 0 && (
                        <span className="text-muted-foreground/60 py-1 text-xs italic">
                          No attendees selected.
                        </span>
                      )}
                    </div>

                    {allOfficials && allOfficials.length > selectedOfficials.length && (
                      <div className="flex items-center gap-2">
                        <Select
                          value=""
                          onValueChange={(val) => {
                            if (val && !selectedOfficials.includes(val)) {
                              setSelectedOfficials([...selectedOfficials, val]);
                            }
                          }}
                        >
                          <SelectTrigger className="h-7 w-fit min-w-[150px] cursor-pointer border-white/10 bg-white/5 py-1 text-xs">
                            <Plus className="text-muted-foreground mr-1 h-3.5 w-3.5" />
                            <span>Add Invitees...</span>
                          </SelectTrigger>
                          <SelectContent>
                            {allOfficials
                              .filter((o) => !selectedOfficials.includes(o.id))
                              .map((o) => (
                                <SelectItem key={o.id} value={o.id}>
                                  {o.name} ({o.title})
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="border-t border-white/5" />

              {/* Section 2: Agenda Topics */}
              <div className="space-y-3">
                <Label className="text-muted-foreground text-xs font-semibold uppercase">
                  Agenda Topics ({agendaItems.length} items · {totalAgendaDuration} min)
                </Label>

                <div className="space-y-2">
                  {agendaItems.map((item, index) => {
                    const isExpanded = expandedAgendaIndex === index;
                    const categoryConfig = AGENDA_CATEGORIES.find((c) => c.value === item.category);

                    return (
                      <div
                        key={index}
                        className="overflow-hidden rounded-lg border border-white/5 bg-white/[0.01] transition-all"
                      >
                        <div
                          onClick={() => setExpandedAgendaIndex(isExpanded ? null : index)}
                          className="flex cursor-pointer items-center justify-between p-3 select-none hover:bg-white/[0.02]"
                        >
                          <div className="flex min-w-0 flex-1 items-center gap-2">
                            <div
                              className={cn(
                                "h-2.5 w-2.5 shrink-0 rounded-full",
                                categoryConfig?.color ?? "bg-gray-500"
                              )}
                            />
                            <span className="text-foreground/90 truncate text-xs font-semibold">
                              {item.title}
                            </span>
                            <Badge
                              variant="outline"
                              className="text-muted-foreground border-white/10 bg-white/5 px-1.5 py-0 font-mono text-[9px]"
                            >
                              {item.duration}m
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeAgendaItem(index);
                              }}
                              className="text-muted-foreground cursor-pointer rounded p-1 hover:bg-white/5 hover:text-white"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="space-y-3 border-t border-white/5 bg-white/[0.02] p-3 text-xs">
                            <div>
                              <Label className="text-muted-foreground text-[10px] uppercase">
                                Topic Title
                              </Label>
                              <Input
                                value={item.title}
                                onChange={(e) => {
                                  const newItems = [...agendaItems];
                                  newItems[index]!.title = e.target.value;
                                  setAgendaItems(newItems);
                                }}
                                className="mt-1 h-8 text-xs"
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-2.5">
                              <div>
                                <Label className="text-muted-foreground text-[10px] uppercase">
                                  Duration (mins)
                                </Label>
                                <Input
                                  type="number"
                                  value={item.duration}
                                  onChange={(e) => {
                                    const newItems = [...agendaItems];
                                    newItems[index]!.duration = parseInt(e.target.value) || 15;
                                    setAgendaItems(newItems);
                                  }}
                                  className="mt-1 h-8 text-xs"
                                />
                              </div>
                              <div>
                                <Label className="text-muted-foreground text-[10px] uppercase">
                                  Category
                                </Label>
                                <Select
                                  value={item.category}
                                  onValueChange={(val) => {
                                    const newItems = [...agendaItems];
                                    newItems[index]!.category = val;
                                    setAgendaItems(newItems);
                                  }}
                                >
                                  <SelectTrigger className="mt-1 h-8 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {AGENDA_CATEGORIES.map((cat) => (
                                      <SelectItem key={cat.value} value={cat.value}>
                                        {cat.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>

                            <div>
                              <Label className="text-muted-foreground text-[10px] uppercase">
                                Description
                              </Label>
                              <Textarea
                                value={item.description}
                                onChange={(e) => {
                                  const newItems = [...agendaItems];
                                  newItems[index]!.description = e.target.value;
                                  setAgendaItems(newItems);
                                }}
                                placeholder="Describe this agenda topic's purpose..."
                                rows={2}
                                className="mt-1 text-xs"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Add Quick Agenda Topic input */}
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Type a new topic and press Enter..."
                    value={newAgendaTitle}
                    onChange={(e) => setNewAgendaTitle(e.target.value)}
                    className="h-8 flex-1 border-white/10 bg-white/5 text-xs"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddQuickAgendaTopic();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleAddQuickAgendaTopic}
                    className="h-8 cursor-pointer bg-amber-600 px-3 text-xs font-semibold text-white hover:bg-amber-700"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
