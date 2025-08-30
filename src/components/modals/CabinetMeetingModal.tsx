"use client";

import React, { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { api } from "~/trpc/react";
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
import { Calendar } from "~/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { GlassCard } from "~/components/ui/enhanced-card";
import { Skeleton } from "~/components/ui/skeleton";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Separator } from "~/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { 
  Calendar as CalendarIcon, 
  Users, 
  Plus, 
  X, 
  Clock, 
  CheckCircle,
  AlertCircle,
  FileText,
  Video,
  MapPin
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
  meetingId 
}: CabinetMeetingModalProps) {
  const { user } = useUser();
  const [open, setOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedTime, setSelectedTime] = useState("10:00");
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    attendees: [] as string[],
    agenda: [] as string[],
    location: "",
    meetingType: "in_person" as "in_person" | "virtual" | "hybrid"
  });
  const [newAttendee, setNewAttendee] = useState("");
  const [newAgendaItem, setNewAgendaItem] = useState("");

  // Get existing meetings for context
  const { data: meetings, isLoading: meetingsLoading, refetch } = api.eci.getCabinetMeetings.useQuery(
    { userId: user?.id || '' },
    { enabled: !!user?.id && open }
  );

  // Create meeting mutation
  const createMeeting = api.eci.createCabinetMeeting.useMutation({
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
    upcomingMeetings: meetings?.filter((m: any) => new Date(m.scheduledDate) > new Date()).length || 0,
    completedMeetings: meetings?.filter((m: any) => m.status === 'completed').length || 0,
    averageAttendance: meetings?.length > 0 ? 
      meetings.reduce((sum: number, m: any) => sum + (m.attendees?.length || 0), 0) / meetings.length : 0
  };

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      attendees: [],
      agenda: [],
      location: "",
      meetingType: "in_person"
    });
    setSelectedDate(new Date());
    setSelectedTime("10:00");
    setNewAttendee("");
    setNewAgendaItem("");
  };

  const addAttendee = () => {
    if (newAttendee.trim() && !formData.attendees.includes(newAttendee.trim())) {
      setFormData(prev => ({
        ...prev,
        attendees: [...prev.attendees, newAttendee.trim()]
      }));
      setNewAttendee("");
    }
  };

  const removeAttendee = (attendee: string) => {
    setFormData(prev => ({
      ...prev,
      attendees: prev.attendees.filter(a => a !== attendee)
    }));
  };

  const addAgendaItem = () => {
    if (newAgendaItem.trim() && !formData.agenda.includes(newAgendaItem.trim())) {
      setFormData(prev => ({
        ...prev,
        agenda: [...prev.agenda, newAgendaItem.trim()]
      }));
      setNewAgendaItem("");
    }
  };

  const removeAgendaItem = (item: string) => {
    setFormData(prev => ({
      ...prev,
      agenda: prev.agenda.filter(a => a !== item)
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedDate || !formData.title.trim()) {
      toast.error("Please fill in required fields");
      return;
    }

    const [hours, minutes] = selectedTime.split(':').map(Number);
    const scheduledDateTime = new Date(selectedDate);
    scheduledDateTime.setHours(hours!, minutes);

    createMeeting.mutate({
      userId: user?.id || '',
      title: formData.title,
      description: formData.description,
      scheduledDate: scheduledDateTime,
      attendees: formData.attendees,
      agenda: formData.agenda
    });
  };

  const upcomingMeetings = meetings?.filter((meeting: any) => 
    new Date(meeting.scheduledDate) > new Date() && meeting.status === 'scheduled'
  ).slice(0, 3) || [];

  const recentMeetings = meetings?.filter((meeting: any) => 
    meeting.status === 'completed'
  ).slice(0, 3) || [];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent style={{ width: '100vw', maxWidth: '100vw', height: '100vh', maxHeight: '100vh', padding: '24px', margin: '0px', overflowY: 'auto' }} onEscapeKeyDown={(e) => { e.preventDefault(); setOpen(false); }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-blue-500" />
            {mode === "create" ? "Schedule Cabinet Meeting" : "Cabinet Meeting Details"}
          </DialogTitle>
          <DialogDescription>
            {mode === "create" 
              ? "Schedule a new cabinet meeting with your ministers and government officials."
              : "View and manage cabinet meeting details."
            }
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left Column - Basic Information */}
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="title">Meeting Title *</Label>
                    <Input
                      id="title"
                      placeholder="e.g., Weekly Cabinet Meeting"
                      value={formData.title}
                      onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      placeholder="Brief description of the meeting purpose..."
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      rows={3}
                    />
                  </div>

                  <div>
                    <Label>Date & Time *</Label>
                    <div className="flex gap-2">
                      <Popover>
                        <PopoverTrigger>
                          <Button
                            variant="outline"
                            className={cn(
                              "flex-1 justify-start text-left font-normal",
                              !selectedDate && "text-muted-foreground"
                            )}
                            asChild
                          >
                            <span>
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {selectedDate ? format(selectedDate, "PPP") : "Pick a date"}
                            </span>
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto">
                          <Calendar
                            mode="single"
                            selected={selectedDate}
                            onSelect={setSelectedDate}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <Input
                        type="time"
                        value={selectedTime}
                        onChange={(e) => setSelectedTime(e.target.value)}
                        className="w-32"
                      />
                    </div>
                  </div>

                  <div>
                    <Label>Meeting Type</Label>
                    <div className="flex gap-2 mt-2">
                      {[
                        { value: "in_person", label: "In Person", icon: MapPin },
                        { value: "virtual", label: "Virtual", icon: Video },
                        { value: "hybrid", label: "Hybrid", icon: Users }
                      ].map(({ value, label, icon: Icon }) => (
                        <Button
                          key={value}
                          type="button"
                          variant={formData.meetingType === value ? "default" : "outline"}
                          size="sm"
                          onClick={() => setFormData(prev => ({ ...prev, meetingType: value as any }))}
                          className="flex items-center gap-1"
                        >
                          <Icon className="h-4 w-4" />
                          {label}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {(formData.meetingType === "in_person" || formData.meetingType === "hybrid") && (
                    <div>
                      <Label htmlFor="location">Location</Label>
                      <Input
                        id="location"
                        placeholder="e.g., Cabinet Room, Government Building"
                        value={formData.location}
                        onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                      />
                    </div>
                  )}
                </div>

                {/* Right Column - Attendees and Agenda */}
                <div className="space-y-4">
                  <div>
                    <Label>Attendees</Label>
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <Input
                          placeholder="Add attendee (name or role)"
                          value={newAttendee}
                          onChange={(e) => setNewAttendee(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addAttendee())}
                        />
                        <Button type="button" size="sm" onClick={addAttendee}>
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {formData.attendees.map((attendee) => (
                          <Badge key={attendee} variant="secondary" className="flex items-center gap-1">
                            {attendee}
                            <X 
                              className="h-3 w-3 cursor-pointer" 
                              onClick={() => removeAttendee(attendee)}
                            />
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div>
                    <Label>Agenda Items</Label>
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <Input
                          placeholder="Add agenda item"
                          value={newAgendaItem}
                          onChange={(e) => setNewAgendaItem(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addAgendaItem())}
                        />
                        <Button type="button" size="sm" onClick={addAgendaItem}>
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="space-y-1">
                        {formData.agenda.map((item, index) => (
                          <div key={index} className="flex items-center gap-2 p-2 bg-muted rounded-md">
                            <span className="text-sm font-medium text-muted-foreground">{index + 1}.</span>
                            <span className="flex-1 text-sm">{item}</span>
                            <X 
                              className="h-3 w-3 cursor-pointer text-muted-foreground hover:text-foreground" 
                              onClick={() => removeAgendaItem(item)}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createMeeting.isPending}>
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
                      <h3 className="text-lg font-semibold flex items-center gap-2">
                        <Clock className="h-5 w-5 text-blue-500" />
                        Upcoming Meetings
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1">Your scheduled cabinet meetings</p>
                    </div>
                    <div className="p-6">
                      {upcomingMeetings.length > 0 ? (
                        <div className="space-y-3">
                          {upcomingMeetings.map((meeting: any) => (
                            <div key={meeting.id} className="p-4 border rounded-lg">
                              <div className="flex justify-between items-start mb-2">
                                <h4 className="font-semibold">{meeting.title}</h4>
                                <Badge variant="outline">
                                  {meeting.status}
                                </Badge>
                              </div>
                              <div className="text-sm text-muted-foreground mb-2">
                                <div className="flex items-center gap-2">
                                  <CalendarIcon className="h-4 w-4" />
                                  {format(new Date(meeting.scheduledDate), "PPP 'at' p")}
                                </div>
                                {meeting.attendees && meeting.attendees.length > 0 && (
                                  <div className="flex items-center gap-2 mt-1">
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
                        <div className="text-center py-8 text-muted-foreground">
                          <CalendarIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p>No upcoming meetings scheduled</p>
                        </div>
                      )}
                    </div>
                  </GlassCard>

                  {/* Meeting Statistics */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <GlassCard variant="diplomatic">
                      <div className="p-4 text-center">
                        <div className="text-2xl font-bold text-blue-600">
                          {upcomingMeetings.length}
                        </div>
                        <div className="text-sm text-muted-foreground">Upcoming</div>
                      </div>
                    </GlassCard>
                    <GlassCard variant="diplomatic">
                      <div className="p-4 text-center">
                        <div className="text-2xl font-bold text-green-600">
                          {recentMeetings.length}
                        </div>
                        <div className="text-sm text-muted-foreground">Completed</div>
                      </div>
                    </GlassCard>
                    <GlassCard variant="diplomatic">
                      <div className="p-4 text-center">
                        <div className="text-2xl font-bold text-purple-600">
                          {meetings?.length || 0}
                        </div>
                        <div className="text-sm text-muted-foreground">Total</div>
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
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <FileText className="h-5 w-5 text-green-500" />
                  Meeting History
                </h3>
                <p className="text-sm text-muted-foreground mt-1">All cabinet meetings and their status</p>
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
                      <div key={meeting.id} className="p-4 border rounded-lg">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-semibold">{meeting.title}</h4>
                          <div className="flex items-center gap-2">
                            <Badge 
                              variant={
                                meeting.status === 'completed' ? 'default' :
                                meeting.status === 'in_progress' ? 'secondary' :
                                meeting.status === 'cancelled' ? 'destructive' : 'outline'
                              }
                            >
                              {meeting.status}
                            </Badge>
                            {meeting.status === 'completed' && (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            )}
                            {meeting.status === 'cancelled' && (
                              <AlertCircle className="h-4 w-4 text-red-500" />
                            )}
                          </div>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {format(new Date(meeting.scheduledDate), "PPP 'at' p")}
                        </div>
                        {meeting.description && (
                          <p className="text-sm mt-2">{meeting.description}</p>
                        )}
                        <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                          {meeting.attendees && (
                            <span>{meeting.attendees.length} attendees</span>
                          )}
                          {meeting.agenda && (
                            <span>{meeting.agenda.length} agenda items</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No meeting history available</p>
                    <p className="text-sm">Schedule your first cabinet meeting to get started</p>
                  </div>
                )}
              </div>
            </GlassCard>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}