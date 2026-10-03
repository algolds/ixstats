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

import { Calendar, Plus, Xmark as X } from "iconoir-react";
import { useNotify } from "~/hooks/useNotify";

import type { AgendaItem, MeetingSchedulerProps } from "./meeting-scheduler-types";
import { AGENDA_CATEGORIES, INTENT_TEMPLATES } from "./meeting-scheduler-intents";
import { RadioCard, RadioCardGroup } from "~/components/ui/radio-card";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { Card } from "~/components/ui/card";

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
          ? "Summit request sent to the guest country."
          : `${title} has been added to your calendar.`;
      notify.success(
        meetingType === "bilateral" ? "Summit requested" : "Meeting scheduled",
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
          <div className="bg-surface border-separator rounded-row shadow-floating flex h-[85vh] max-h-[85vh] min-w-[320px] flex-1 flex-col overflow-hidden md:min-w-[450px]">
            <DialogHeader className="border-separator shrink-0 border-b px-6 pt-6 pb-4">
              <DialogTitle className="flex items-center gap-2">Schedule meeting</DialogTitle>
              <DialogDescription>
                Invite your cabinet or foreign delegates to discuss a crisis, a policy or a summit.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
              <div className="flex-1 space-y-5 overflow-y-auto px-6 py-4">
                {/* Linked Prefill Indicator */}
                {defaultMeeting?.prefilledAgenda && (
                  <div className="bg-surface-secondary rounded-row text-footnote p-3">
                    <span className="text-eyebrow text-label-secondary mb-0.5 block">
                      Linked reference
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-label font-medium">
                        {defaultMeeting.prefilledAgenda.title}
                      </span>
                      <Badge variant="warning">
                        {defaultMeeting.prefilledAgenda.linkedIssueId
                          ? "Crisis issue"
                          : "Draft policy"}
                      </Badge>
                    </div>
                  </div>
                )}

                {/* Intent Selector */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-label-secondary text-eyebrow">Agenda intent</Label>
                    {!isChangingIntent && (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setIsChangingIntent(true)}
                        className="text-caption h-5 px-2"
                      >
                        Change intent
                      </Button>
                    )}
                  </div>

                  {!isChangingIntent ? (
                    (() => {
                      const activeTpl =
                        INTENT_TEMPLATES.find((t) => t.id === selectedTemplateId) ||
                        INTENT_TEMPLATES[0];
                      return (
                        <div className="rounded-row border-tint bg-tint-fill flex flex-col items-start border p-3 text-left">
                          <span className="text-headline text-label">{activeTpl.name}</span>
                          <span className="text-footnote text-label-secondary mt-0.5 leading-snug">
                            {activeTpl.description}
                          </span>
                        </div>
                      );
                    })()
                  ) : (
                    <RadioCardGroup
                      aria-label="Meeting intent"
                      columns={2}
                      className="animate-in fade-in slide-in-from-top-1 duration-200"
                      value={selectedTemplateId ?? null}
                      onValueChange={(id) => {
                        const tpl = INTENT_TEMPLATES.find((t) => t.id === id);
                        if (!tpl) return;
                        handleSelectTemplate(tpl);
                        setIsChangingIntent(false);
                      }}
                    >
                      {INTENT_TEMPLATES.map((tpl) => (
                        <RadioCard
                          key={tpl.id}
                          value={tpl.id}
                          title={tpl.name}
                          description={tpl.description}
                          indicator={false}
                        />
                      ))}
                    </RadioCardGroup>
                  )}
                </div>

                {/* Bilateral Target selector */}
                {meetingType === "bilateral" && (
                  <div>
                    <Label htmlFor="targetCountry" className="text-footnote">
                      Guest country *
                    </Label>
                    <Select
                      value={targetCountryId}
                      onValueChange={setTargetCountryId}
                      disabled={!!defaultTargetCountryId}
                    >
                      <SelectTrigger id="targetCountry" className="text-footnote mt-1 h-9">
                        <SelectValue placeholder="Select a country" />
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
                                    className="h-3 w-4 rounded-xs object-cover"
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
                    <Label htmlFor="title" className="text-footnote">
                      Session title *
                    </Label>
                    <Input
                      id="title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. Emergency cabinet session"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="description" className="text-footnote">
                      Context notes
                    </Label>
                    <Textarea
                      id="description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Goals for the session (optional)"
                      rows={2}
                    />
                  </div>

                  {proposedIntents.length > 0 && (
                    <div>
                      <Label htmlFor="intent-select" className="text-footnote">
                        Linked intent
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
                              setTitle(`Deliberate: ${selected.goal}`);
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
                          <SelectValue placeholder="Select a proposed intent" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None (routine session)</SelectItem>
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
                  <Label className="text-label-secondary text-eyebrow">
                    Scheduled date and time
                  </Label>
                  <SegmentedControl
                    aria-label="Scheduled date and time"
                    fullWidth
                    size="sm"
                    value={timePreset}
                    onValueChange={(v) => setTimePreset(v as any)}
                    options={[
                      { value: "immediately", label: "Immediately" },
                      { value: "tomorrow", label: "Tomorrow" },
                      { value: "custom", label: "Custom date" },
                    ]}
                  />

                  {timePreset === "custom" && (
                    <Card variant="inset" padding="none" className="mt-2 space-y-2 p-3">
                      <Label htmlFor="custom-date" className="text-label-secondary text-eyebrow">
                        Date
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
                        className="bg-surface border-separator text-footnote max-w-[180px] py-2"
                      />
                      <div className="bg-fill-4 text-caption text-label-secondary rounded-control-sm flex items-center gap-2 px-3 py-1">
                        <Calendar aria-hidden className="h-3.5 w-3.5" />
                        <span>Scheduled date</span>
                        <span className="text-label">
                          {IxTime.formatIxTime(scheduledIxTime, false).replace(" (ILT)", "")}
                        </span>
                        <span className="text-label-secondary text-footnote ml-auto font-normal">
                          (09:00)
                        </span>
                      </div>
                    </Card>
                  )}
                </div>
              </div>

              <DialogFooter className="border-separator mt-auto shrink-0 border-t px-6 py-4">
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
                  className="font-semibold"
                  disabled={
                    isSubmitting ||
                    agendaItems.length === 0 ||
                    (allOfficials.length > 0 && selectedOfficials.length === 0)
                  }
                >
                  {isSubmitting ? "Scheduling" : "Schedule meeting"}
                </Button>
              </DialogFooter>
            </form>
          </div>

          {/* Card 2: Attached Agenda & Roster Panel */}
          <div className="bg-surface border-separator animate-in fade-in slide-in-from-right-2 rounded-row shadow-floating flex max-h-[85vh] w-full flex-col overflow-hidden duration-300 md:w-[350px]">
            <div className="border-separator shrink-0 border-b px-5 pt-5 pb-3">
              <h3 className="text-label text-headline flex items-center gap-2">
                Roster and agenda
              </h3>
              <p className="text-label-secondary text-footnote mt-0.5">
                {selectedOfficials.length} invited · {agendaItems.length} topics
              </p>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto p-5">
              {/* Section 1: Attendees */}
              <div className="space-y-2">
                <Label className="text-label-secondary text-eyebrow">
                  Attendees ({selectedOfficials.length} invited)
                </Label>

                {officialsLoading || (meetingType === "bilateral" && targetOfficialsLoading) ? (
                  <div className="text-label-secondary text-footnote animate-pulse py-2">
                    Loading officials
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
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
                              "text-footnote flex items-center gap-2 rounded-full border px-2 py-0.5 transition-[color,background-color,border-color,box-shadow,opacity,transform]",
                              isRecommended
                                ? "border-separator bg-fill-3 text-label"
                                : "border-separator bg-fill-4 text-label-tertiary"
                            )}
                          >
                            <div className="flex max-w-[100px] min-w-0 flex-col text-left leading-tight">
                              <span className="truncate font-semibold">{official.name}</span>
                              <span className="text-footnote truncate opacity-60">
                                {official.title}
                              </span>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => toggleOfficial(id)}
                              aria-label="Remove official"
                              className="text-label-secondary hover:text-label ml-0.5 size-4 rounded-full"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        );
                      })}

                      {selectedOfficials.length === 0 && (
                        <span className="text-label-tertiary text-footnote py-1 italic">
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
                          <SelectTrigger className="border-separator bg-fill-4 text-footnote h-7 w-fit min-w-[150px] cursor-pointer py-1">
                            <Plus className="text-label-secondary mr-1 h-3.5 w-3.5" />
                            <span>Add invitees</span>
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

              <div className="border-separator border-t" />

              {/* Section 2: Agenda Topics */}
              <div className="space-y-3">
                <Label className="text-label-secondary text-eyebrow">
                  Agenda topics ({agendaItems.length} items · {totalAgendaDuration} min)
                </Label>

                <div className="space-y-2">
                  {agendaItems.map((item, index) => {
                    const isExpanded = expandedAgendaIndex === index;
                    const categoryConfig = AGENDA_CATEGORIES.find((c) => c.value === item.category);

                    return (
                      <div
                        key={index}
                        className="rounded-control border-separator bg-fill-4 overflow-hidden border transition-[color,background-color,border-color,box-shadow,opacity,transform]"
                      >
                        <div
                          onClick={() => setExpandedAgendaIndex(isExpanded ? null : index)}
                          className="hover:bg-fill-4 flex cursor-pointer items-center justify-between p-3 select-none"
                        >
                          <div className="flex min-w-0 flex-1 items-center gap-2">
                            <div
                              className={cn(
                                "h-2.5 w-2.5 shrink-0 rounded-full",
                                categoryConfig?.color ?? "bg-fill"
                              )}
                            />
                            <span className="text-label text-caption truncate font-semibold">
                              {item.title}
                            </span>
                            <Badge variant="default" className="tabular-nums">
                              {item.duration}m
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeAgendaItem(index);
                              }}
                              aria-label="Remove agenda item"
                              className="text-label-secondary hover:text-label size-6"
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="border-separator bg-fill-4 text-footnote space-y-3 border-t p-3">
                            <div>
                              <Label className="text-label-secondary text-eyebrow">
                                Topic title
                              </Label>
                              <Input
                                value={item.title}
                                onChange={(e) => {
                                  const newItems = [...agendaItems];
                                  newItems[index]!.title = e.target.value;
                                  setAgendaItems(newItems);
                                }}
                                className="text-footnote mt-1 h-8"
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <Label className="text-label-secondary text-eyebrow">
                                  Duration (min)
                                </Label>
                                <Input
                                  type="number"
                                  value={item.duration}
                                  onChange={(e) => {
                                    const newItems = [...agendaItems];
                                    newItems[index]!.duration = parseInt(e.target.value) || 15;
                                    setAgendaItems(newItems);
                                  }}
                                  className="text-footnote mt-1 h-8"
                                />
                              </div>
                              <div>
                                <Label className="text-label-secondary text-eyebrow">
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
                                  <SelectTrigger className="text-footnote mt-1 h-8">
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
                              <Label className="text-label-secondary text-eyebrow">
                                Description
                              </Label>
                              <Textarea
                                value={item.description}
                                onChange={(e) => {
                                  const newItems = [...agendaItems];
                                  newItems[index]!.description = e.target.value;
                                  setAgendaItems(newItems);
                                }}
                                placeholder="What this topic covers"
                                rows={2}
                                className="text-footnote mt-1"
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
                    placeholder="New topic, then press Enter"
                    value={newAgendaTitle}
                    onChange={(e) => setNewAgendaTitle(e.target.value)}
                    className="border-separator bg-fill-4 text-footnote h-8 flex-1"
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
                    aria-label="Add agenda topic"
                    title="Add agenda topic"
                    className="text-caption h-8 cursor-pointer px-3 font-semibold"
                  >
                    <Plus aria-hidden="true" className="h-4 w-4" />
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
