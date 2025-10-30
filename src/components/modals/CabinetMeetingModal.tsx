"use client";

import React, { useState } from "react";
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
  DialogTrigger,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Badge } from "~/components/ui/badge";
import { IxTimePicker } from "~/components/ui/ixtime-picker";
import { GlassCard } from "~/components/ui/enhanced-card";
import { Skeleton } from "~/components/ui/skeleton";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Separator } from "~/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { AgendaItemSelector } from "~/components/quickactions/AgendaItemSelector";
import type { AgendaItemTemplate } from "~/lib/agenda-taxonomy";
import {
  Calendar as CalendarIcon,
  Users,
  Plus,
  X,
  Clock,
  CheckCircle,
  AlertCircle,
  FileText,
  Tag,
  Sparkles,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "~/lib/utils";
import { toast } from "sonner";
import { NumberFlowDisplay } from "~/components/ui/number-flow";

interface CabinetMeetingModalProps {
  children: React.ReactNode;
  mode?: "create" | "view";
  meetingId?: string;
}

export function CabinetMeetingModal({
  children,
  mode = "create",
  meetingId,
}: CabinetMeetingModalProps) {
  const { user } = useUser();
  const [open, setOpen] = useState(false);
  const [scheduledIxTime, setScheduledIxTime] = useState(
    IxTime.getCurrentIxTime() + 24 * 60 * 60 * 1000 // +1 day in IxTime
  );
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    attendees: [] as string[],
    agenda: [] as AgendaItemTemplate[],
  });
  const [newAttendee, setNewAttendee] = useState("");
  const [showAgendaSelector, setShowAgendaSelector] = useState(false);

  // Get user profile for countryId
  const { data: userProfile } = api.users.getProfile.useQuery(undefined, { enabled: !!user?.id });

  // Get existing meetings for context
  const {
    data: meetings,
    isLoading: meetingsLoading,
    refetch,
  } = api.unifiedIntelligence.getCabinetMeetings.useQuery(
    { countryId: userProfile?.countryId || "" },
    { enabled: !!userProfile?.countryId && open }
  );

  // Create meeting mutation
  const createMeeting = api.unifiedIntelligence.createCabinetMeeting.useMutation({
    onSuccess: () => {
      toast.success("Cabinet meeting scheduled successfully!");
      setOpen(false);
      resetForm();
      void refetch();
    },
    onError: (error) => {
      toast.error(`Failed to schedule meeting: ${error.message}`);
    },
  });

  // Meeting statistics
  const meetingStats = {
    totalMeetings: meetings?.length || 0,
    upcomingMeetings:
      meetings?.filter((m: any) => new Date(m.scheduledDate) > new Date()).length || 0,
    completedMeetings: meetings?.filter((m: any) => m.status === "completed").length || 0,
    averageAttendance:
      (meetings?.length ?? 0) > 0
        ? (meetings ?? []).reduce((sum: number, m: any) => sum + (m.attendees?.length || 0), 0) /
          (meetings?.length ?? 1)
        : 0,
  };

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      attendees: [],
      agenda: [],
    });
    setScheduledIxTime(IxTime.getCurrentIxTime() + 24 * 60 * 60 * 1000); // +1 day in IxTime
    setNewAttendee("");
  };

  const addAttendee = () => {
    if (newAttendee.trim() && !formData.attendees.includes(newAttendee.trim())) {
      setFormData((prev) => ({
        ...prev,
        attendees: [...prev.attendees, newAttendee.trim()],
      }));
      setNewAttendee("");
    }
  };

  const removeAttendee = (attendee: string) => {
    setFormData((prev) => ({
      ...prev,
      attendees: prev.attendees.filter((a) => a !== attendee),
    }));
  };

  const addAgendaItem = (item: AgendaItemTemplate) => {
    // Check if item already exists
    if (!formData.agenda.some((a) => a.id === item.id)) {
      setFormData((prev) => ({
        ...prev,
        agenda: [...prev.agenda, item],
      }));
      toast.success(`Added "${item.label}" to agenda`);
    } else {
      toast.info("This item is already in the agenda");
    }
  };

  const removeAgendaItem = (itemId: string) => {
    setFormData((prev) => ({
      ...prev,
      agenda: prev.agenda.filter((a) => a.id !== itemId),
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      toast.error("Please fill in required fields");
      return;
    }

    createMeeting.mutate({
      countryId: userProfile?.countryId || "",
      title: formData.title,
      description: formData.description,
      scheduledDate: new Date(scheduledIxTime).toISOString(), // IxTime date as ISO string for tRPC
      attendees: formData.attendees,
      agenda: formData.agenda.map((item) => item.label), // Convert to string array for backend
    });
  };

  const upcomingMeetings =
    meetings
      ?.filter(
        (meeting: any) =>
          new Date(meeting.scheduledDate) > new Date() && meeting.status === "scheduled"
      )
      .slice(0, 3) || [];

  const recentMeetings =
    meetings?.filter((meeting: any) => meeting.status === "completed").slice(0, 3) || [];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent
        style={{
          width: "100vw",
          maxWidth: "100vw",
          height: "100vh",
          maxHeight: "100vh",
          padding: "24px",
          margin: "0px",
          overflowY: "auto",
        }}
        onEscapeKeyDown={(e) => {
          e.preventDefault();
          setOpen(false);
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-blue-500" />
            {mode === "create" ? "Schedule Cabinet Meeting" : "Cabinet Meeting Details"}
          </DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Schedule a new cabinet meeting with your ministers and government officials."
              : "View and manage cabinet meeting details."}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue={mode === "create" ? "schedule" : "overview"} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="schedule">Schedule Meeting</TabsTrigger>
            <TabsTrigger value="overview">Meeting Overview</TabsTrigger>
            <TabsTrigger value="history">Meeting History</TabsTrigger>
          </TabsList>

          <TabsContent value="schedule" className="mt-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Information */}
              <div className="space-y-4">
                <div>
                  <Label htmlFor="title">Meeting Title *</Label>
                  <Input
                    id="title"
                    placeholder="e.g., Weekly Cabinet Meeting"
                    value={formData.title}
                    onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="description">Meeting Purpose & Goals</Label>
                  <Textarea
                    id="description"
                    placeholder="What do you want to accomplish in this meeting? List key objectives..."
                    value={formData.description}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, description: e.target.value }))
                    }
                    rows={3}
                  />
                </div>

                <IxTimePicker
                  id="ixtime"
                  label="Date & Time (IxTime) *"
                  value={scheduledIxTime}
                  onChange={setScheduledIxTime}
                  required
                  showRealWorldTime={true}
                />
              </div>

              <Separator />

              {/* Attendees */}
              <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Attendees ({formData.attendees.length} selected)
                </Label>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add attendee (name or role)"
                      value={newAttendee}
                      onChange={(e) => setNewAttendee(e.target.value)}
                      onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addAttendee())}
                    />
                    <Button type="button" size="icon" onClick={addAttendee}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {formData.attendees.length > 0 && (
                    <div className="bg-muted/30 flex flex-wrap gap-2 rounded-lg border p-3">
                      {formData.attendees.map((attendee) => (
                        <Badge
                          key={attendee}
                          variant="secondary"
                          className="flex items-center gap-1"
                        >
                          {attendee}
                          <X
                            className="h-3 w-3 cursor-pointer"
                            onClick={() => removeAttendee(attendee)}
                          />
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              {/* Actionable Agenda Items */}
              <div className="space-y-4">
                <div>
                  <Label className="flex items-center gap-2 text-base">
                    <FileText className="h-5 w-5" />
                    Actionable Agenda Items ({formData.agenda.length} items) *
                  </Label>
                  <p className="text-muted-foreground mt-1 text-sm">
                    Select specific topics from our standardized library. Each item maps to your
                    country's economic and government systems.
                  </p>
                </div>

                {/* Existing agenda items */}
                {formData.agenda.length > 0 && (
                  <div className="space-y-2">
                    {formData.agenda.map((item, index) => {
                      const getCategoryColor = (category: string) => {
                        const colors: Record<string, string> = {
                          economic: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
                          social: "bg-green-500/10 text-green-700 dark:text-green-400",
                          infrastructure: "bg-orange-500/10 text-orange-700 dark:text-orange-400",
                          diplomatic: "bg-purple-500/10 text-purple-700 dark:text-purple-400",
                          governance: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400",
                          security: "bg-red-500/10 text-red-700 dark:text-red-400",
                        };
                        return (
                          colors[category] || "bg-gray-500/10 text-gray-700 dark:text-gray-400"
                        );
                      };

                      return (
                        <div
                          key={item.id}
                          className="bg-card hover:border-primary/50 group flex items-start gap-3 rounded-lg border p-3 transition-colors"
                        >
                          <div className="bg-primary/10 text-primary mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-sm font-semibold">
                            {index + 1}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="mb-1 flex items-center gap-2">
                              <p className="text-sm font-medium">{item.label}</p>
                              <Badge
                                variant="outline"
                                className={cn("text-xs", getCategoryColor(item.category))}
                              >
                                {item.category}
                              </Badge>
                            </div>
                            <p className="text-muted-foreground mb-1 text-xs">{item.description}</p>
                            {item.tags && item.tags.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {item.tags.slice(0, 3).map((tag) => (
                                  <Badge key={tag} variant="secondary" className="text-xs">
                                    <Tag className="mr-1 h-2 w-2" />
                                    {tag}
                                  </Badge>
                                ))}
                              </div>
                            )}
                            {item.relatedMetrics && item.relatedMetrics.length > 0 && (
                              <div className="text-muted-foreground mt-1 text-xs">
                                Affects: {item.relatedMetrics.slice(0, 2).join(", ")}
                                {item.relatedMetrics.length > 2 &&
                                  ` +${item.relatedMetrics.length - 2} more`}
                              </div>
                            )}
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeAgendaItem(item.id)}
                            className="h-6 w-6 flex-shrink-0 p-0 opacity-0 transition-opacity group-hover:opacity-100"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Add new agenda item */}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAgendaSelector(true)}
                  className="hover:border-primary/50 hover:bg-primary/5 h-16 w-full border-2 border-dashed"
                >
                  <div className="flex flex-col items-center gap-1">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4" />
                      <span className="font-medium">Browse Agenda Library</span>
                    </div>
                    <span className="text-muted-foreground text-xs">
                      Select from policy, budget, infrastructure, and more
                    </span>
                  </div>
                </Button>
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  After the meeting, you'll be able to record decisions and action items for each
                  agenda topic.
                </AlertDescription>
              </Alert>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={
                    createMeeting.isPending || !formData.title || formData.agenda.length === 0
                  }
                >
                  {createMeeting.isPending ? "Scheduling..." : "Schedule Meeting"}
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>

          <TabsContent value="overview" className="mt-6">
            <div className="space-y-6">
              {meetingsLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-8 w-1/3" />
                  <Skeleton className="h-32" />
                  <Skeleton className="h-32" />
                </div>
              ) : (
                <>
                  {/* Upcoming Meetings */}
                  <GlassCard variant="diplomatic">
                    <div className="p-6 pb-4">
                      <h3 className="flex items-center gap-2 text-lg font-semibold">
                        <Clock className="h-5 w-5 text-blue-500" />
                        Upcoming Meetings
                      </h3>
                      <p className="text-muted-foreground mt-1 text-sm">
                        Your scheduled cabinet meetings
                      </p>
                    </div>
                    <div className="p-6">
                      {upcomingMeetings.length > 0 ? (
                        <div className="space-y-3">
                          {upcomingMeetings.map((meeting: any) => (
                            <div key={meeting.id} className="rounded-lg border p-4">
                              <div className="mb-2 flex items-start justify-between">
                                <h4 className="font-semibold">{meeting.title}</h4>
                                <Badge variant="outline">{meeting.status}</Badge>
                              </div>
                              <div className="text-muted-foreground mb-2 text-sm">
                                <div className="flex items-center gap-2">
                                  <CalendarIcon className="h-4 w-4" />
                                  {format(new Date(meeting.scheduledDate), "PPP 'at' p")}
                                </div>
                                {meeting.attendees && meeting.attendees.length > 0 && (
                                  <div className="mt-1 flex items-center gap-2">
                                    <Users className="h-4 w-4" />
                                    {meeting.attendees.length} attendees
                                  </div>
                                )}
                              </div>
                              {meeting.agenda && meeting.agenda.length > 0 && (
                                <div className="text-sm">
                                  <strong>Agenda:</strong> {meeting.agenda.length} items
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-muted-foreground py-8 text-center">
                          <CalendarIcon className="mx-auto mb-4 h-12 w-12 opacity-50" />
                          <p>No upcoming meetings scheduled</p>
                        </div>
                      )}
                    </div>
                  </GlassCard>

                  {/* Meeting Statistics */}
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <GlassCard variant="diplomatic">
                      <div className="p-4 text-center">
                        <div className="text-2xl font-bold text-blue-600">
                          {upcomingMeetings.length}
                        </div>
                        <div className="text-muted-foreground text-sm">Upcoming</div>
                      </div>
                    </GlassCard>
                    <GlassCard variant="diplomatic">
                      <div className="p-4 text-center">
                        <div className="text-2xl font-bold text-green-600">
                          {recentMeetings.length}
                        </div>
                        <div className="text-muted-foreground text-sm">Completed</div>
                      </div>
                    </GlassCard>
                    <GlassCard variant="diplomatic">
                      <div className="p-4 text-center">
                        <div className="text-2xl font-bold text-purple-600">
                          {meetings?.length || 0}
                        </div>
                        <div className="text-muted-foreground text-sm">Total</div>
                      </div>
                    </GlassCard>
                  </div>
                </>
              )}
            </div>
          </TabsContent>

          <TabsContent value="history" className="mt-6">
            <GlassCard variant="diplomatic">
              <div className="p-6 pb-4">
                <h3 className="flex items-center gap-2 text-lg font-semibold">
                  <FileText className="h-5 w-5 text-green-500" />
                  Meeting History
                </h3>
                <p className="text-muted-foreground mt-1 text-sm">
                  All cabinet meetings and their status
                </p>
              </div>
              <div className="p-6">
                {meetingsLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-20" />
                    ))}
                  </div>
                ) : meetings && meetings.length > 0 ? (
                  <div className="space-y-3">
                    {meetings.map((meeting: any) => (
                      <div key={meeting.id} className="rounded-lg border p-4">
                        <div className="mb-2 flex items-start justify-between">
                          <h4 className="font-semibold">{meeting.title}</h4>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={
                                meeting.status === "completed"
                                  ? "default"
                                  : meeting.status === "in_progress"
                                    ? "secondary"
                                    : meeting.status === "cancelled"
                                      ? "destructive"
                                      : "outline"
                              }
                            >
                              {meeting.status}
                            </Badge>
                            {meeting.status === "completed" && (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            )}
                            {meeting.status === "cancelled" && (
                              <AlertCircle className="h-4 w-4 text-red-500" />
                            )}
                          </div>
                        </div>
                        <div className="text-muted-foreground text-sm">
                          {format(new Date(meeting.scheduledDate), "PPP 'at' p")}
                        </div>
                        {meeting.description && (
                          <p className="mt-2 text-sm">{meeting.description}</p>
                        )}
                        <div className="text-muted-foreground mt-2 flex gap-4 text-xs">
                          {meeting.attendees && <span>{meeting.attendees.length} attendees</span>}
                          {meeting.agenda && <span>{meeting.agenda.length} agenda items</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-muted-foreground py-8 text-center">
                    <FileText className="mx-auto mb-4 h-12 w-12 opacity-50" />
                    <p>No meeting history available</p>
                    <p className="text-sm">Schedule your first cabinet meeting to get started</p>
                  </div>
                )}
              </div>
            </GlassCard>
          </TabsContent>
        </Tabs>

        {/* Agenda Item Selector Modal */}
        <AgendaItemSelector
          open={showAgendaSelector}
          onOpenChange={setShowAgendaSelector}
          onSelect={addAgendaItem}
        />
      </DialogContent>
    </Dialog>
  );
}
