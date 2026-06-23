// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck — Suppressed due to Zod v4 extended type inference gaps
// src/components/quickactions/MeetingScheduler.tsx
"use client";

import React, { useState } from "react";
import { motion } from "motion/react";
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
import { IxTimePicker } from "~/components/ui/ixtime-picker";
import {
  Calendar,
  Users,
  Plus,
  X,
  FileText,
  CheckCircle2,
  AlertCircle,
  Tag,
  ChevronDown,
  ChevronRight,
  Settings2,
} from "lucide-react";
import { useNotify } from "~/hooks/useNotify";

interface MeetingSchedulerProps {
  countryId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultMeeting?: {
    title?: string;
    description?: string;
    ixTime?: number;
    officialIds?: string[];
    prefilledAgenda?: {
      title: string;
      description: string;
      category: string;
      linkedIssueId?: string;
      linkedPolicyId?: string;
    };
  };
  defaultTargetCountryId?: string;
}

interface AgendaItem {
  title: string;
  description: string;
  duration: number;
  category: string;
  tags: string[];
  presenter: string;
  linkedIssueId?: string;
  linkedPolicyId?: string;
}

const AGENDA_CATEGORIES = [
  { value: "economic", label: "Economic Affairs", color: "bg-blue-500" },
  { value: "social", label: "Social Policy", color: "bg-green-500" },
  { value: "infrastructure", label: "Infrastructure", color: "bg-orange-500" },
  { value: "diplomatic", label: "Diplomatic Relations", color: "bg-purple-500" },
  { value: "governance", label: "Governance & Administration", color: "bg-indigo-500" },
  { value: "other", label: "Other", color: "bg-gray-500" },
];

const COMMON_TAGS = [
  "urgent",
  "budget",
  "policy",
  "review",
  "appointment",
  "quarterly",
  "annual",
  "strategic",
  "operational",
  "reform",
];

function CollapsibleSection({
  title,
  icon: Icon,
  badge,
  defaultOpen = true,
  children,
}: {
  title: string;
  icon: React.ElementType;
  badge?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-border/50 rounded-lg border">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="hover:bg-muted/50 flex w-full items-center justify-between rounded-lg p-3 text-sm font-medium transition-colors"
      >
        <div className="flex items-center gap-2">
          <Icon className="text-muted-foreground h-4 w-4" />
          <span>{title}</span>
          {badge && (
            <Badge variant="secondary" className="px-1.5 py-0 text-[0.65rem]">
              {badge}
            </Badge>
          )}
        </div>
        {isOpen ? (
          <ChevronDown className="text-muted-foreground h-4 w-4" />
        ) : (
          <ChevronRight className="text-muted-foreground h-4 w-4" />
        )}
      </button>
      {isOpen && <div className="px-3 pb-3">{children}</div>}
    </div>
  );
}

export function MeetingScheduler({
  countryId,
  open,
  onOpenChange,
  defaultMeeting,
  defaultTargetCountryId,
}: MeetingSchedulerProps) {
  const notify = useNotify();
  const { user } = useUser();

  // Form state
  const [title, setTitle] = useState(defaultMeeting?.title ?? "");
  const [description, setDescription] = useState(defaultMeeting?.description ?? "");
  const [scheduledIxTime, setScheduledIxTime] = useState(
    defaultMeeting?.ixTime ?? IxTime.getCurrentIxTime() + 24 * 60 * 60 * 1000
  );
  const [duration, setDuration] = useState(60);
  const [selectedOfficials, setSelectedOfficials] = useState<string[]>(
    defaultMeeting?.officialIds ?? []
  );
  const [agendaItems, setAgendaItems] = useState<AgendaItem[]>([]);

  // Meeting Type states
  const [meetingType, setMeetingType] = useState<"cabinet" | "bilateral">(
    defaultTargetCountryId ? "bilateral" : "cabinet"
  );
  const [targetCountryId, setTargetCountryId] = useState<string>(defaultTargetCountryId ?? "");

  // Agenda item form
  const [newAgendaTitle, setNewAgendaTitle] = useState("");
  const [newAgendaDuration, setNewAgendaDuration] = useState(15);
  const [showAdvancedAgenda, setShowAdvancedAgenda] = useState(false);
  const [newAgendaDesc, setNewAgendaDesc] = useState("");
  const [newAgendaCategory, setNewAgendaCategory] = useState("economic");
  const [newAgendaTags, setNewAgendaTags] = useState<string[]>([]);
  const [newAgendaPresenter, setNewAgendaPresenter] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [newAgendaLinkedIssueId, setNewAgendaLinkedIssueId] = useState<string | undefined>(undefined);
  const [newAgendaLinkedPolicyId, setNewAgendaLinkedPolicyId] = useState<string | undefined>(undefined);

  // Get simple list of countries for Bilateral meetings selection
  const { data: selectCountries } = api.countries.getSelectList.useQuery(
    { limit: 100 },
    { enabled: open }
  );

  // Get government officials (host country)
  const { data: officials, isLoading: officialsLoading } = api.quickActions.getOfficials.useQuery(
    { countryId, activeOnly: true },
    { enabled: open }
  );

  // Get government officials (target country)
  const { data: targetOfficials, isLoading: targetOfficialsLoading } =
    api.quickActions.getOfficials.useQuery(
      { countryId: targetCountryId, activeOnly: true },
      { enabled: open && meetingType === "bilateral" && !!targetCountryId }
    );

  // Get active national issues (player mode)
  const { data: activeIssuesData } = api.nationalIssues.getMyIssues.useQuery(
    { countryId, status: "active" },
    { enabled: open }
  );
  const activeIssues = activeIssuesData?.issues ?? [];

  // Get draft policies
  const { data: draftPolicies = [] } = api.policies.getPolicies.useQuery(
    { countryId, status: "draft" },
    { enabled: open }
  );

  const [isSubmitting, setIsSubmitting] = useState(false);

  const createMeeting = api.meetings.createMeeting.useMutation();
  const addAgendaItemMutation = api.meetings.addAgendaItem.useMutation();
  const recordAttendance = api.meetings.recordAttendance.useMutation();

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setScheduledIxTime(IxTime.getCurrentIxTime() + 24 * 60 * 60 * 1000);
    setDuration(60);
    setSelectedOfficials([]);
    setAgendaItems([]);
    setMeetingType(defaultTargetCountryId ? "bilateral" : "cabinet");
    setTargetCountryId(defaultTargetCountryId ?? "");
    resetAgendaForm();
  };

  const resetAgendaForm = () => {
    setNewAgendaTitle("");
    setNewAgendaDuration(15);
    setShowAdvancedAgenda(false);
    setNewAgendaDesc("");
    setNewAgendaCategory("economic");
    setNewAgendaTags([]);
    setNewAgendaPresenter("");
    setTagInput("");
    setNewAgendaLinkedIssueId(undefined);
    setNewAgendaLinkedPolicyId(undefined);
  };

  React.useEffect(() => {
    if (open) {
      if (defaultMeeting) {
        setTitle(defaultMeeting.title ?? "");
        setDescription(defaultMeeting.description ?? "");
        if (defaultMeeting.ixTime) {
          setScheduledIxTime(defaultMeeting.ixTime);
        }
        if (defaultMeeting.officialIds) {
          setSelectedOfficials(defaultMeeting.officialIds);
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
        } else {
          setAgendaItems([]);
        }
      } else {
        setTitle("");
        setDescription("");
        setScheduledIxTime(IxTime.getCurrentIxTime() + 24 * 60 * 60 * 1000);
        setDuration(60);
        setSelectedOfficials([]);
        setAgendaItems([]);
        setMeetingType(defaultTargetCountryId ? "bilateral" : "cabinet");
        setTargetCountryId(defaultTargetCountryId ?? "");
      }
    }
  }, [open, defaultMeeting, defaultTargetCountryId]);

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

  const addAgendaItem = () => {
    if (!newAgendaTitle.trim()) {
      notify.error("Agenda item title is required");
      return;
    }

    setAgendaItems([
      ...agendaItems,
      {
        title: newAgendaTitle,
        description: newAgendaDesc,
        duration: newAgendaDuration,
        category: newAgendaCategory,
        tags: newAgendaTags,
        presenter: newAgendaPresenter,
        linkedIssueId: newAgendaLinkedIssueId,
        linkedPolicyId: newAgendaLinkedPolicyId,
      },
    ]);

    resetAgendaForm();
  };

  const removeAgendaItem = (index: number) => {
    setAgendaItems(agendaItems.filter((_, i) => i !== index));
  };

  const addTag = (tag: string) => {
    const trimmed = tag.trim().toLowerCase();
    if (trimmed && !newAgendaTags.includes(trimmed)) {
      setNewAgendaTags([...newAgendaTags, trimmed]);
    }
    setTagInput("");
  };

  const removeTag = (tag: string) => {
    setNewAgendaTags(newAgendaTags.filter((t) => t !== tag));
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
      });

      // Persist agenda items and attendances against the new meeting.
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
      resetForm();
    } catch (error: any) {
      notify.error("Failed to schedule meeting", error?.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalAgendaDuration = agendaItems.reduce((sum, item) => sum + item.duration, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-lg"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 0,
          padding: 0,
          maxHeight: "85vh",
          overflow: "hidden",
        }}
      >
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-amber-500" />
            {meetingType === "bilateral" ? "Request Bilateral Summit" : "Schedule Cabinet Meeting"}
          </DialogTitle>
          <DialogDescription>
            {meetingType === "bilateral"
              ? "Request a bilateral meeting with another country's ruler and cabinet."
              : "Create a cabinet meeting with agenda items and attendees."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
            {/* Meeting Type Selection */}
            <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted p-1">
              <button
                type="button"
                onClick={() => setMeetingType("cabinet")}
                className={cn(
                  "rounded-md py-1.5 text-xs font-medium transition-all",
                  meetingType === "cabinet"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Cabinet Meeting
              </button>
              <button
                type="button"
                onClick={() => setMeetingType("bilateral")}
                className={cn(
                  "rounded-md py-1.5 text-xs font-medium transition-all",
                  meetingType === "bilateral"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Bilateral Summit
              </button>
            </div>

            {/* Target Country Selector (Bilateral only) */}
            {meetingType === "bilateral" && (
              <div>
                <Label htmlFor="targetCountry" className="text-xs">
                  Target Country *
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
                              <img src={c.flagUrl} alt="" className="h-3 w-4 rounded object-cover" />
                            )}
                            {c.name}
                          </span>
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Basic Info — always visible */}
            <div className="space-y-3">
              <div>
                <Label htmlFor="title" className="text-xs">
                  Title *
                </Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={
                    meetingType === "bilateral" ? "e.g., Bilateral Trade Summit" : "e.g., Weekly Cabinet Meeting"
                  }
                  required
                />
              </div>

              <div>
                <Label htmlFor="description" className="text-xs">
                  Description
                </Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description of the meeting purpose..."
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <IxTimePicker
                  id="ixtime"
                  label="Date & Time (IxTime) *"
                  value={scheduledIxTime}
                  onChange={setScheduledIxTime}
                  required
                  showRealWorldTime={false}
                />
                <div>
                  <Label htmlFor="duration" className="text-xs">
                    Duration (min)
                  </Label>
                  <Input
                    id="duration"
                    type="number"
                    min={15}
                    max={480}
                    value={duration}
                    onChange={(e) => setDuration(parseInt(e.target.value) || 60)}
                  />
                  {totalAgendaDuration > 0 && (
                    <p className="text-muted-foreground mt-1 text-[0.65rem]">
                      Agenda total: {totalAgendaDuration} min
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Attendees — collapsible */}
            <CollapsibleSection
              title="Attendees"
              icon={Users}
              badge={`${selectedOfficials.length} selected`}
            >
              {officialsLoading || (meetingType === "bilateral" && targetOfficialsLoading) ? (
                <div className="text-muted-foreground text-sm">Loading officials...</div>
              ) : allOfficials && allOfficials.length > 0 ? (
                <div className="grid max-h-36 grid-cols-2 gap-1.5 overflow-y-auto">
                  {allOfficials.map((official) => (
                    <div
                      key={official.id}
                      onClick={() => toggleOfficial(official.id)}
                      className={cn(
                        "cursor-pointer rounded-md border p-2 text-xs transition-all",
                        selectedOfficials.includes(official.id)
                          ? "border-amber-400/50 bg-amber-50 dark:bg-amber-950/30"
                          : "hover:bg-muted border-border/40"
                      )}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{official.name}</p>
                          <p className="text-muted-foreground truncate text-[10px] flex items-center gap-1">
                            <span>{official.title}</span>
                            <span className="text-[9px] opacity-60">· {official.countryLabel}</span>
                          </p>
                        </div>
                        {selectedOfficials.includes(official.id) && (
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
                  <AlertCircle className="h-3.5 w-3.5" />
                  No officials found. Add officials in Government Management.
                </div>
              )}
            </CollapsibleSection>

            {/* Agenda — collapsible */}
            <CollapsibleSection
              title="Agenda"
              icon={FileText}
              badge={
                agendaItems.length > 0
                  ? `${agendaItems.length} items · ${totalAgendaDuration} min`
                  : undefined
              }
            >
              <div className="space-y-3">
                {/* Existing items */}
                {agendaItems.length > 0 && (
                  <div className="space-y-1.5">
                    {agendaItems.map((item, index) => {
                      const categoryConfig = AGENDA_CATEGORIES.find(
                        (c) => c.value === item.category
                      );
                      return (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="border-border/40 bg-muted/30 flex items-center justify-between gap-2 rounded-md border px-2.5 py-2"
                        >
                          <div className="flex min-w-0 flex-1 items-center gap-2">
                            <div
                              className={`h-2 w-2 shrink-0 rounded-full ${categoryConfig?.color ?? "bg-gray-500"}`}
                            />
                            <span className="truncate text-xs font-medium">{item.title}</span>
                            <Badge variant="outline" className="shrink-0 px-1 py-0 text-[0.6rem]">
                              {item.duration}m
                            </Badge>
                             {item.linkedIssueId && (
                               <Badge variant="outline" className="px-1 py-0 text-[0.55rem] bg-yellow-500/10 text-yellow-400 border-yellow-500/20 shrink-0">
                                 Issue
                               </Badge>
                             )}
                             {item.linkedPolicyId && (
                               <Badge variant="outline" className="px-1 py-0 text-[0.55rem] bg-indigo-500/10 text-indigo-400 border-indigo-500/20 shrink-0">
                                 Policy
                               </Badge>
                             )}
                            {item.tags.length > 0 && (
                              <div className="hidden gap-0.5 sm:flex">
                                {item.tags.slice(0, 2).map((tag) => (
                                  <Badge
                                    key={tag}
                                    variant="secondary"
                                    className="px-1 py-0 text-[0.6rem]"
                                  >
                                    {tag}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => removeAgendaItem(index)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </motion.div>
                      );
                    })}
                  </div>
                )}

                {/* Add new item form */}
                <div className="border-border/50 space-y-2 rounded-lg border-2 border-dashed p-3">
                  <div className="text-muted-foreground flex items-center gap-2 text-xs font-medium">
                    <Plus className="h-3.5 w-3.5" />
                    Add Item
                  </div>

                  {/* Basic: Title + Duration */}
                  <div className="flex gap-2">
                    <Input
                      placeholder="Item title *"
                      value={newAgendaTitle}
                      onChange={(e) => setNewAgendaTitle(e.target.value)}
                      className="h-8 flex-1 text-xs"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !showAdvancedAgenda) {
                          e.preventDefault();
                          addAgendaItem();
                        }
                      }}
                    />
                    <Input
                      type="number"
                      placeholder="Min"
                      value={newAgendaDuration}
                      onChange={(e) => setNewAgendaDuration(parseInt(e.target.value) || 15)}
                      min={5}
                      max={180}
                      className="h-8 w-16 text-xs"
                    />
                  </div>

                  {/* Advanced toggle */}
                  <button
                    type="button"
                    onClick={() => setShowAdvancedAgenda(!showAdvancedAgenda)}
                    className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-[0.65rem] transition-colors"
                  >
                    <Settings2 className="h-3 w-3" />
                    {showAdvancedAgenda ? "Hide" : "Show"} advanced options
                    {showAdvancedAgenda ? (
                      <ChevronDown className="h-3 w-3" />
                    ) : (
                      <ChevronRight className="h-3 w-3" />
                    )}
                  </button>

                  {/* Advanced fields */}
                  {showAdvancedAgenda && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="space-y-2"
                    >
                      <Textarea
                        placeholder="Description (optional)"
                        value={newAgendaDesc}
                        onChange={(e) => setNewAgendaDesc(e.target.value)}
                        rows={2}
                        className="text-xs"
                      />

                      <div className="grid grid-cols-2 gap-2">
                        <Select value={newAgendaCategory} onValueChange={setNewAgendaCategory}>
                          <SelectTrigger className="h-8 text-xs">
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

                        <Input
                          placeholder="Presenter"
                          value={newAgendaPresenter}
                          onChange={(e) => setNewAgendaPresenter(e.target.value)}
                          className="h-8 text-xs"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-[10px] text-muted-foreground">Link National Issue</Label>
                          <Select value={newAgendaLinkedIssueId || "none"} onValueChange={(v) => setNewAgendaLinkedIssueId(v === "none" ? undefined : v)}>
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="None" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">None</SelectItem>
                              {activeIssues.map((issue: any) => (
                                <SelectItem key={issue.id} value={issue.id}>
                                  ⚠️ {issue.title}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-[10px] text-muted-foreground">Link Policy Proposal</Label>
                          <Select value={newAgendaLinkedPolicyId || "none"} onValueChange={(v) => setNewAgendaLinkedPolicyId(v === "none" ? undefined : v)}>
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="None" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">None</SelectItem>
                              {draftPolicies.map((policy: any) => (
                                <SelectItem key={policy.id} value={policy.id}>
                                  📜 {policy.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* Tags */}
                      <div>
                        <div className="flex gap-1.5">
                          <Input
                            placeholder="Add tag... (press Enter)"
                            value={tagInput}
                            onChange={(e) => setTagInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                addTag(tagInput);
                              }
                            }}
                            onBlur={() => {
                              if (tagInput.trim()) addTag(tagInput);
                            }}
                            className="h-8 text-xs"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => addTag(tagInput)}
                          >
                            <Tag className="h-3 w-3" />
                          </Button>
                        </div>

                        {/* Common tag chips */}
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {COMMON_TAGS.filter((t) => !newAgendaTags.includes(t))
                            .slice(0, 6)
                            .map((tag) => (
                              <Badge
                                key={tag}
                                variant="outline"
                                className="hover:bg-muted cursor-pointer px-1.5 py-0 text-[0.6rem]"
                                onClick={() => addTag(tag)}
                              >
                                + {tag}
                              </Badge>
                            ))}
                        </div>

                        {/* Selected tags */}
                        {newAgendaTags.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {newAgendaTags.map((tag) => (
                              <Badge
                                key={tag}
                                variant="secondary"
                                className="flex items-center gap-0.5 px-1.5 py-0 text-[0.6rem]"
                              >
                                {tag}
                                <X
                                  className="h-2.5 w-2.5 cursor-pointer"
                                  onClick={() => removeTag(tag)}
                                />
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}

                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={addAgendaItem}
                    className="h-7 w-full text-xs"
                  >
                    <Plus className="mr-1 h-3 w-3" />
                    Add to Agenda
                  </Button>
                </div>
              </div>
            </CollapsibleSection>
          </div>

          {/* Sticky footer */}
          <DialogFooter className="border-border/50 border-t px-6 py-4">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
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
      </DialogContent>
    </Dialog>
  );
}
