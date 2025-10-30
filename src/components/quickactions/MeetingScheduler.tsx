// src/components/quickactions/MeetingScheduler.tsx
"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useUser } from "~/context/auth-context";
import { api } from "~/trpc/react";
import { IxTime } from "~/lib/ixtime";
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
import { Separator } from "~/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
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
  Clock,
  FileText,
  CheckCircle2,
  AlertCircle,
  Tag,
  Layers,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface MeetingSchedulerProps {
  countryId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultMeeting?: {
    title?: string;
    description?: string;
    ixTime?: number; // IxTime timestamp
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

export function MeetingScheduler({
  countryId,
  open,
  onOpenChange,
  defaultMeeting,
}: MeetingSchedulerProps) {
  const { user } = useUser();

  // Form state
  const [title, setTitle] = useState(defaultMeeting?.title ?? "");
  const [description, setDescription] = useState(defaultMeeting?.description ?? "");
  const [scheduledIxTime, setScheduledIxTime] = useState(
    defaultMeeting?.ixTime ?? IxTime.getCurrentIxTime() + 24 * 60 * 60 * 1000 // +1 day in IxTime
  );
  const [duration, setDuration] = useState(60);
  const [selectedOfficials, setSelectedOfficials] = useState<string[]>(
    defaultMeeting?.officialIds ?? []
  );
  const [agendaItems, setAgendaItems] = useState<AgendaItem[]>([]);

  // Current agenda item being added
  const [newAgendaTitle, setNewAgendaTitle] = useState("");
  const [newAgendaDesc, setNewAgendaDesc] = useState("");
  const [newAgendaDuration, setNewAgendaDuration] = useState(15);
  const [newAgendaCategory, setNewAgendaCategory] = useState("economic");
  const [newAgendaTags, setNewAgendaTags] = useState<string[]>([]);
  const [newAgendaPresenter, setNewAgendaPresenter] = useState("");
  const [tagInput, setTagInput] = useState("");

  // Get government officials
  const { data: officials, isLoading: officialsLoading } = api.quickActions.getOfficials.useQuery(
    { countryId, activeOnly: true },
    { enabled: open }
  );

  // Create meeting mutation
  const createMeeting = api.quickActions.createMeeting.useMutation({
    onSuccess: (result) => {
      toast.success("Meeting scheduled successfully!");
      onOpenChange(false);
      resetForm();
    },
    onError: (error) => {
      toast.error(`Failed to schedule meeting: ${error.message}`);
    },
  });

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setScheduledIxTime(IxTime.getCurrentIxTime() + 24 * 60 * 60 * 1000); // +1 day in IxTime
    setDuration(60);
    setSelectedOfficials([]);
    setAgendaItems([]);
    setNewAgendaTitle("");
    setNewAgendaDesc("");
    setNewAgendaDuration(15);
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
      toast.error("Agenda item title is required");
      return;
    }

    const item: AgendaItem = {
      title: newAgendaTitle,
      description: newAgendaDesc,
      duration: newAgendaDuration,
      category: newAgendaCategory,
      tags: newAgendaTags,
      presenter: newAgendaPresenter,
    };

    setAgendaItems([...agendaItems, item]);

    // Reset agenda form
    setNewAgendaTitle("");
    setNewAgendaDesc("");
    setNewAgendaDuration(15);
    setNewAgendaCategory("economic");
    setNewAgendaTags([]);
    setNewAgendaPresenter("");
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
      toast.error("Meeting title is required");
      return;
    }

    if (agendaItems.length === 0) {
      toast.error("Please add at least one agenda item");
      return;
    }

    if (selectedOfficials.length === 0) {
      toast.error("Please select at least one attendee");
      return;
    }

    createMeeting.mutate({
      countryId,
      userId: user?.id ?? "",
      meeting: {
        title,
        description: description || undefined,
        scheduledDate: new Date(scheduledIxTime), // IxTime date as Date object
        scheduledIxTime, // Pass IxTime timestamp so backend knows not to convert
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
      },
    });
  };

  const totalAgendaDuration = agendaItems.reduce((sum, item) => sum + item.duration, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-500" />
            Schedule Cabinet Meeting
          </DialogTitle>
          <DialogDescription>
            Create a new meeting with agenda items and attendees. Decisions can be recorded after
            the meeting concludes.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Meeting Title *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Weekly Cabinet Meeting"
                required
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of the meeting purpose..."
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <IxTimePicker
                id="ixtime"
                label="Meeting Date & Time (IxTime) *"
                value={scheduledIxTime}
                onChange={setScheduledIxTime}
                required
                showRealWorldTime={false}
              />

              <div>
                <Label htmlFor="duration">Estimated Duration (minutes)</Label>
                <Input
                  id="duration"
                  type="number"
                  min={15}
                  max={480}
                  value={duration}
                  onChange={(e) => setDuration(parseInt(e.target.value) || 60)}
                />
                {totalAgendaDuration > 0 && (
                  <p className="text-muted-foreground mt-1 text-xs">
                    Agenda total: {totalAgendaDuration} minutes
                  </p>
                )}
              </div>
            </div>
          </div>

          <Separator />

          {/* Attendees */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Attendees * ({selectedOfficials.length} selected)
            </Label>

            {officialsLoading ? (
              <div className="text-muted-foreground text-sm">Loading officials...</div>
            ) : officials && officials.length > 0 ? (
              <div className="bg-muted/30 grid max-h-40 grid-cols-2 gap-2 overflow-y-auto rounded-lg border p-3">
                {officials.map((official) => (
                  <div
                    key={official.id}
                    onClick={() => toggleOfficial(official.id)}
                    className={`cursor-pointer rounded-md border p-2 transition-all ${
                      selectedOfficials.includes(official.id)
                        ? "border-blue-300 bg-blue-50 dark:bg-blue-950/30"
                        : "hover:bg-muted"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{official.name}</p>
                        <p className="text-muted-foreground truncate text-xs">{official.title}</p>
                      </div>
                      {selectedOfficials.includes(official.id) && (
                        <CheckCircle2 className="ml-2 h-4 w-4 flex-shrink-0 text-blue-600" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-muted-foreground bg-muted/30 rounded-lg border p-4 text-sm">
                <AlertCircle className="mr-2 inline h-4 w-4" />
                No government officials found. Add officials first in Government Management.
              </div>
            )}
          </div>

          <Separator />

          {/* Agenda Items */}
          <div className="space-y-4">
            <Label className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Agenda Items * ({agendaItems.length} items)
            </Label>

            {/* Existing agenda items */}
            {agendaItems.length > 0 && (
              <div className="mb-4 space-y-2">
                {agendaItems.map((item, index) => {
                  const categoryConfig = AGENDA_CATEGORIES.find((c) => c.value === item.category);
                  return (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className="bg-card rounded-lg border p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="mb-1 flex items-center gap-2">
                            <div
                              className={`h-2 w-2 rounded-full ${categoryConfig?.color ?? "bg-gray-500"}`}
                            />
                            <h4 className="text-sm font-medium">{item.title}</h4>
                            <Badge variant="outline" className="text-xs">
                              {item.duration} min
                            </Badge>
                          </div>
                          {item.description && (
                            <p className="text-muted-foreground mb-2 text-sm">{item.description}</p>
                          )}
                          <div className="flex flex-wrap gap-1">
                            {item.tags.map((tag) => (
                              <Badge key={tag} variant="secondary" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                          {item.presenter && (
                            <p className="text-muted-foreground mt-1 text-xs">
                              Presenter: {item.presenter}
                            </p>
                          )}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeAgendaItem(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}

            {/* Add new agenda item */}
            <div className="bg-muted/20 space-y-3 rounded-lg border-2 border-dashed p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Plus className="h-4 w-4" />
                Add Agenda Item
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Input
                    placeholder="Agenda item title *"
                    value={newAgendaTitle}
                    onChange={(e) => setNewAgendaTitle(e.target.value)}
                  />
                </div>

                <div className="col-span-2">
                  <Textarea
                    placeholder="Description (optional)"
                    value={newAgendaDesc}
                    onChange={(e) => setNewAgendaDesc(e.target.value)}
                    rows={2}
                  />
                </div>

                <div>
                  <Select value={newAgendaCategory} onValueChange={setNewAgendaCategory}>
                    <SelectTrigger>
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

                <div>
                  <Input
                    type="number"
                    placeholder="Duration (min)"
                    value={newAgendaDuration}
                    onChange={(e) => setNewAgendaDuration(parseInt(e.target.value) || 15)}
                    min={5}
                    max={180}
                  />
                </div>

                <div className="col-span-2">
                  <Input
                    placeholder="Presenter (optional)"
                    value={newAgendaPresenter}
                    onChange={(e) => setNewAgendaPresenter(e.target.value)}
                  />
                </div>

                {/* Tags */}
                <div className="col-span-2">
                  <div className="mb-2 flex gap-2">
                    <Input
                      placeholder="Add tags..."
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addTag(tagInput);
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => addTag(tagInput)}
                    >
                      <Tag className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Common tags */}
                  <div className="mb-2 flex flex-wrap gap-1">
                    {COMMON_TAGS.map((tag) => (
                      <Badge
                        key={tag}
                        variant="outline"
                        className="hover:bg-primary/10 cursor-pointer"
                        onClick={() => addTag(tag)}
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>

                  {/* Selected tags */}
                  {newAgendaTags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {newAgendaTags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="flex items-center gap-1">
                          {tag}
                          <X className="h-3 w-3 cursor-pointer" onClick={() => removeTag(tag)} />
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={addAgendaItem}
                className="w-full"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add to Agenda
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                createMeeting.isPending ||
                agendaItems.length === 0 ||
                selectedOfficials.length === 0
              }
            >
              {createMeeting.isPending ? "Scheduling..." : "Schedule Meeting"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
