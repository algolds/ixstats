// @ts-nocheck — Suppressed due to Zod v4 extended type inference gaps
// src/components/quickactions/MeetingScheduler.tsx
"use client";

import React, { useState } from "react";
import { motion } from "motion/react";
import { api } from "~/trpc/react";
import { IxTime } from "~/lib/ixtime";
import { useLocalActions } from "~/hooks/useLocalActions";
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
  };
}

interface AgendaItem {
  title: string;
  description: string;
  duration: number;
  category: string;
  tags: string[];
  presenter: string;
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
}: MeetingSchedulerProps) {
  const notify = useNotify();
  const { saveAction } = useLocalActions(countryId);

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

  // Agenda item form
  const [newAgendaTitle, setNewAgendaTitle] = useState("");
  const [newAgendaDuration, setNewAgendaDuration] = useState(15);
  const [showAdvancedAgenda, setShowAdvancedAgenda] = useState(false);
  const [newAgendaDesc, setNewAgendaDesc] = useState("");
  const [newAgendaCategory, setNewAgendaCategory] = useState("economic");
  const [newAgendaTags, setNewAgendaTags] = useState<string[]>([]);
  const [newAgendaPresenter, setNewAgendaPresenter] = useState("");
  const [tagInput, setTagInput] = useState("");

  // Get government officials
  const { data: officials, isLoading: officialsLoading } = api.quickActions.getOfficials.useQuery(
    { countryId, activeOnly: true },
    { enabled: open }
  );

  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setScheduledIxTime(IxTime.getCurrentIxTime() + 24 * 60 * 60 * 1000);
    setDuration(60);
    setSelectedOfficials([]);
    setAgendaItems([]);
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
  };

  const toggleOfficial = (officialId: string) => {
    setSelectedOfficials((prev) =>
      prev.includes(officialId) ? prev.filter((id) => id !== officialId) : [...prev, officialId]
    );
  };

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      notify.error("Meeting title is required");
      return;
    }

    if (agendaItems.length === 0) {
      notify.error("Please add at least one agenda item");
      return;
    }

    if (selectedOfficials.length === 0) {
      notify.error("Please select at least one attendee");
      return;
    }

    setIsSubmitting(true);
    saveAction("meeting_scheduled", {
      title,
      description: description || undefined,
      scheduledDate: new Date().toISOString(),
      scheduledIxTime,
      duration,
      attendeeIds: selectedOfficials,
      agendaItems: agendaItems.map((item) => ({
        title: item.title,
        description: item.description || undefined,
        duration: item.duration,
        category: item.category,
        tags: item.tags,
        presenter: item.presenter || undefined,
      })),
    });
    notify.success("Meeting saved locally!");
    onOpenChange(false);
    resetForm();
    setIsSubmitting(false);
  };

  const totalAgendaDuration = agendaItems.reduce((sum, item) => sum + item.duration, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" style={{ display: "flex", flexDirection: "column", gap: 0, padding: 0, maxHeight: "85vh", overflow: "hidden" }}>
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-amber-500" />
            Schedule Meeting
          </DialogTitle>
          <DialogDescription>Create a meeting with agenda items and attendees.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
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
                  placeholder="e.g., Weekly Cabinet Meeting"
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
              {officialsLoading ? (
                <div className="text-muted-foreground text-sm">Loading officials...</div>
              ) : officials && officials.length > 0 ? (
                <div className="grid max-h-36 grid-cols-2 gap-1.5 overflow-y-auto">
                  {officials.map((official) => (
                    <div
                      key={official.id}
                      onClick={() => toggleOfficial(official.id)}
                      className={`cursor-pointer rounded-md border p-2 text-xs transition-all ${
                        selectedOfficials.includes(official.id)
                          ? "border-amber-400/50 bg-amber-50 dark:bg-amber-950/30"
                          : "hover:bg-muted border-border/40"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{official.name}</p>
                          <p className="text-muted-foreground truncate">{official.title}</p>
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
              disabled={isSubmitting || agendaItems.length === 0 || selectedOfficials.length === 0}
            >
              {isSubmitting ? "Scheduling..." : "Schedule Meeting"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
