"use client";

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUser } from '@clerk/nextjs';
import { api } from '~/trpc/react';
import { IxTime } from '~/lib/ixtime';
import { toast } from 'sonner';
import { cn } from '~/lib/utils';
import {
  Calendar as CalendarIcon,
  Clock,
  Plus,
  Users,
  FileText,
  CheckCircle,
  AlertCircle,
  Trash2,
  Edit,
  ChevronRight,
  ChevronDown,
  GripVertical,
  Target,
  Vote,
  ListChecks,
  Building2,
  User,
  Save,
  X,
  MoreHorizontal,
  Flag,
  AlertTriangle,
  Info,
  TrendingUp,
  Activity
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { Calendar } from '~/components/ui/calendar';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '~/components/ui/dialog';
import { Input } from '~/components/ui/input';
import { Textarea } from '~/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { Progress } from '~/components/ui/progress';
import { Separator } from '~/components/ui/separator';

interface MeetingSchedulerProps {
  countryId: string;
  userId: string;
  governmentStructureId?: string;
  className?: string;
}

interface AgendaItemForm {
  title: string;
  description: string;
  order: number;
  estimatedDuration: number;
  priority: 'high' | 'medium' | 'low';
}

interface DecisionForm {
  title: string;
  description: string;
  decisionType: 'policy' | 'budget' | 'personnel' | 'strategic' | 'other';
  outcome: 'approved' | 'rejected' | 'deferred' | 'requires_review';
  votesFor?: number;
  votesAgainst?: number;
  votesAbstain?: number;
}

interface ActionItemForm {
  title: string;
  description: string;
  assignedToId: string;
  dueDate: Date;
  priority: 'high' | 'medium' | 'low';
}

export function MeetingScheduler({
  countryId,
  userId,
  governmentStructureId,
  className
}: MeetingSchedulerProps) {
  const { user } = useUser();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [createMeetingOpen, setCreateMeetingOpen] = useState(false);
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'calendar' | 'agenda' | 'minutes' | 'actions'>('calendar');
  const [expandedMeetings, setExpandedMeetings] = useState<Set<string>>(new Set());

  // Form states
  const [meetingForm, setMeetingForm] = useState({
    title: '',
    description: '',
    scheduledDate: new Date(),
    duration: 60,
  });

  const [agendaForm, setAgendaForm] = useState<AgendaItemForm>({
    title: '',
    description: '',
    order: 0,
    estimatedDuration: 15,
    priority: 'medium',
  });

  const [decisionForm, setDecisionForm] = useState<DecisionForm>({
    title: '',
    description: '',
    decisionType: 'policy',
    outcome: 'approved',
  });

  const [actionForm, setActionForm] = useState<ActionItemForm>({
    title: '',
    description: '',
    assignedToId: '',
    dueDate: new Date(),
    priority: 'medium',
  });

  // Queries
  const { data: meetings, refetch: refetchMeetings, isLoading: meetingsLoading } = api.meetings.getMeetings.useQuery(
    { countryId },
    { enabled: !!countryId }
  );

  const { data: selectedMeeting } = api.meetings.getMeeting.useQuery(
    { id: selectedMeetingId! },
    { enabled: !!selectedMeetingId }
  );

  const { data: departments } = api.meetings.getDepartments.useQuery(
    { governmentStructureId: governmentStructureId! },
    { enabled: !!governmentStructureId }
  );

  const { data: officials } = api.meetings.getOfficials.useQuery(
    { governmentStructureId: governmentStructureId, active: true },
    { enabled: !!governmentStructureId }
  );

  // Mutations
  const createMeeting = api.meetings.createMeeting.useMutation({
    onSuccess: () => {
      toast.success('Meeting created successfully');
      void refetchMeetings();
      setCreateMeetingOpen(false);
      resetMeetingForm();
    },
    onError: (error) => {
      toast.error(`Failed to create meeting: ${error.message}`);
    },
  });

  const updateMeeting = api.meetings.updateMeeting.useMutation({
    onSuccess: () => {
      toast.success('Meeting updated successfully');
      void refetchMeetings();
    },
    onError: (error) => {
      toast.error(`Failed to update meeting: ${error.message}`);
    },
  });

  const deleteMeeting = api.meetings.deleteMeeting.useMutation({
    onSuccess: () => {
      toast.success('Meeting deleted successfully');
      void refetchMeetings();
      setSelectedMeetingId(null);
    },
    onError: (error) => {
      toast.error(`Failed to delete meeting: ${error.message}`);
    },
  });

  const addAgendaItem = api.meetings.addAgendaItem.useMutation({
    onSuccess: () => {
      toast.success('Agenda item added');
      void refetchMeetings();
      resetAgendaForm();
    },
    onError: (error) => {
      toast.error(`Failed to add agenda item: ${error.message}`);
    },
  });

  const recordAttendance = api.meetings.recordAttendance.useMutation({
    onSuccess: () => {
      toast.success('Attendance recorded');
      void refetchMeetings();
    },
    onError: (error) => {
      toast.error(`Failed to record attendance: ${error.message}`);
    },
  });

  const recordDecision = api.meetings.recordDecision.useMutation({
    onSuccess: () => {
      toast.success('Decision recorded');
      void refetchMeetings();
      resetDecisionForm();
    },
    onError: (error) => {
      toast.error(`Failed to record decision: ${error.message}`);
    },
  });

  const createActionItem = api.meetings.createActionItem.useMutation({
    onSuccess: () => {
      toast.success('Action item created');
      void refetchMeetings();
      resetActionForm();
    },
    onError: (error) => {
      toast.error(`Failed to create action item: ${error.message}`);
    },
  });

  // Reset functions
  const resetMeetingForm = () => {
    setMeetingForm({
      title: '',
      description: '',
      scheduledDate: new Date(),
      duration: 60,
    });
  };

  const resetAgendaForm = () => {
    setAgendaForm({
      title: '',
      description: '',
      order: 0,
      estimatedDuration: 15,
      priority: 'medium',
    });
  };

  const resetDecisionForm = () => {
    setDecisionForm({
      title: '',
      description: '',
      decisionType: 'policy',
      outcome: 'approved',
    });
  };

  const resetActionForm = () => {
    setActionForm({
      title: '',
      description: '',
      assignedToId: '',
      dueDate: new Date(),
      priority: 'medium',
    });
  };

  // Handle meeting creation
  const handleCreateMeeting = () => {
    if (!meetingForm.title.trim()) {
      toast.error('Please enter a meeting title');
      return;
    }

    const ixTime = IxTime.convertToIxTime(meetingForm.scheduledDate.getTime());

    createMeeting.mutate({
      countryId,
      userId,
      title: meetingForm.title,
      scheduledDate: new Date(ixTime),
      description: meetingForm.description,
      duration: meetingForm.duration,
      scheduledIxTime: ixTime,
    });
  };

  // Handle agenda item creation
  const handleAddAgendaItem = () => {
    if (!selectedMeetingId) {
      toast.error('Please select a meeting first');
      return;
    }

    if (!agendaForm.title.trim()) {
      toast.error('Please enter an agenda item title');
      return;
    }

    addAgendaItem.mutate({
      meetingId: selectedMeetingId,
      title: agendaForm.title,
      description: agendaForm.description,
      order: agendaForm.order,
      estimatedDuration: agendaForm.estimatedDuration,
      priority: agendaForm.priority,
    });
  };

  // Handle decision recording
  const handleRecordDecision = () => {
    if (!selectedMeetingId) {
      toast.error('Please select a meeting first');
      return;
    }

    if (!decisionForm.title.trim()) {
      toast.error('Please enter a decision title');
      return;
    }

    recordDecision.mutate({
      meetingId: selectedMeetingId,
      title: decisionForm.title,
      description: decisionForm.description,
      decisionType: decisionForm.decisionType,
      outcome: decisionForm.outcome,
      votesFor: decisionForm.votesFor,
      votesAgainst: decisionForm.votesAgainst,
      votesAbstain: decisionForm.votesAbstain,
    });
  };

  // Handle action item creation
  const handleCreateActionItem = () => {
    if (!selectedMeetingId) {
      toast.error('Please select a meeting first');
      return;
    }

    if (!actionForm.title.trim()) {
      toast.error('Please enter an action item title');
      return;
    }

    if (!actionForm.assignedToId) {
      toast.error('Please assign the action item to someone');
      return;
    }

    createActionItem.mutate({
      meetingId: selectedMeetingId,
      title: actionForm.title,
      description: actionForm.description,
      assignedToId: actionForm.assignedToId,
      dueDate: actionForm.dueDate,
      priority: actionForm.priority,
    });
  };

  // Toggle meeting expansion
  const toggleMeetingExpanded = (meetingId: string) => {
    setExpandedMeetings(prev => {
      const newSet = new Set(prev);
      if (newSet.has(meetingId)) {
        newSet.delete(meetingId);
      } else {
        newSet.add(meetingId);
      }
      return newSet;
    });
  };

  // Filter meetings by selected date
  const filteredMeetings = useMemo(() => {
    if (!meetings || !selectedDate) return [];

    return meetings.filter(meeting => {
      const meetingDate = new Date(meeting.scheduledDate);
      return (
        meetingDate.getDate() === selectedDate.getDate() &&
        meetingDate.getMonth() === selectedDate.getMonth() &&
        meetingDate.getFullYear() === selectedDate.getFullYear()
      );
    });
  }, [meetings, selectedDate]);

  // Get meeting status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'in_progress':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'cancelled':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Get priority color
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Get outcome color
  const getOutcomeColor = (outcome: string) => {
    switch (outcome) {
      case 'approved':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'rejected':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'deferred':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'requires_review':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (meetingsLoading) {
    return (
      <Card className={cn('glass-hierarchy-parent', className)}>
        <CardContent className="p-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/3"></div>
            <div className="h-48 bg-muted rounded"></div>
            <div className="h-24 bg-muted rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className={className}
    >
      <Card className="glass-hierarchy-parent">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5 text-amber-600" />
                Meeting Scheduler
              </CardTitle>
              <CardDescription>
                Schedule cabinet meetings, manage agendas, and track decisions
              </CardDescription>
            </div>
            <Dialog open={createMeetingOpen} onOpenChange={setCreateMeetingOpen}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-to-r from-amber-600 to-amber-700 text-white">
                  <Plus className="h-4 w-4 mr-2" />
                  Schedule Meeting
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl glass-hierarchy-modal">
                <DialogHeader>
                  <DialogTitle>Schedule New Meeting</DialogTitle>
                  <DialogDescription>
                    Create a new cabinet meeting with agenda items and attendees
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Meeting Title</label>
                    <Input
                      placeholder="e.g., Budget Review Meeting"
                      value={meetingForm.title}
                      onChange={(e) => setMeetingForm({ ...meetingForm, title: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Description</label>
                    <Textarea
                      placeholder="Meeting objectives and context..."
                      value={meetingForm.description || ''}
                      onChange={(e) => setMeetingForm({ ...meetingForm, description: e.target.value })}
                      rows={3}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Scheduled Date</label>
                      <Calendar
                        mode="single"
                        selected={meetingForm.scheduledDate}
                        onSelect={(date) => date && setMeetingForm({ ...meetingForm, scheduledDate: date })}
                        className="rounded-md border glass-hierarchy-child"
                      />
                    </div>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Duration (minutes)</label>
                        <Input
                          type="number"
                          min={15}
                          max={480}
                          value={meetingForm.duration}
                          onChange={(e) => setMeetingForm({ ...meetingForm, duration: parseInt(e.target.value) || 60 })}
                        />
                      </div>
                      <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
                        <p className="text-sm text-blue-800 dark:text-blue-200">
                          <strong>IxTime:</strong> {IxTime.formatIxTime(IxTime.convertToIxTime(meetingForm.scheduledDate.getTime()))}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCreateMeetingOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreateMeeting}
                    disabled={createMeeting.isPending}
                    className="bg-gradient-to-r from-amber-600 to-amber-700 text-white"
                  >
                    {createMeeting.isPending ? 'Creating...' : 'Create Meeting'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>

        <CardContent>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="space-y-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="calendar" className="flex items-center gap-2">
                <CalendarIcon className="h-4 w-4" />
                Calendar
              </TabsTrigger>
              <TabsTrigger value="agenda" className="flex items-center gap-2">
                <ListChecks className="h-4 w-4" />
                Agenda
              </TabsTrigger>
              <TabsTrigger value="minutes" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Minutes
              </TabsTrigger>
              <TabsTrigger value="actions" className="flex items-center gap-2">
                <Target className="h-4 w-4" />
                Actions
              </TabsTrigger>
            </TabsList>

            <TabsContent value="calendar" className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1">
                  <Card className="glass-hierarchy-child">
                    <CardContent className="p-4">
                      <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={setSelectedDate}
                        className="rounded-md"
                      />
                    </CardContent>
                  </Card>

                  {selectedDate && (
                    <div className="mt-4 p-4 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                      <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                        {filteredMeetings.length} meeting{filteredMeetings.length !== 1 ? 's' : ''} on {selectedDate.toLocaleDateString()}
                      </p>
                    </div>
                  )}
                </div>

                <div className="lg:col-span-2 space-y-4">
                  <h3 className="text-lg font-semibold">
                    Scheduled Meetings
                  </h3>

                  <AnimatePresence>
                    {filteredMeetings.length === 0 ? (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="text-center py-12"
                      >
                        <CalendarIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                        <p className="text-muted-foreground">No meetings scheduled for this date</p>
                      </motion.div>
                    ) : (
                      filteredMeetings.map((meeting, index) => (
                        <motion.div
                          key={meeting.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -20 }}
                          transition={{ delay: index * 0.1 }}
                        >
                          <Card
                            className={cn(
                              'glass-hierarchy-child hover:shadow-md transition-all cursor-pointer',
                              selectedMeetingId === meeting.id && 'ring-2 ring-amber-500'
                            )}
                            onClick={() => {
                              setSelectedMeetingId(meeting.id);
                              toggleMeetingExpanded(meeting.id);
                            }}
                          >
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-2">
                                    <h4 className="font-semibold">{meeting.title}</h4>
                                    <Badge className={getStatusColor(meeting.status || 'scheduled')}>
                                      {meeting.status || 'scheduled'}
                                    </Badge>
                                  </div>

                                  <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
                                    <span className="flex items-center gap-1">
                                      <Clock className="h-3 w-3" />
                                      {new Date(meeting.scheduledDate).toLocaleTimeString()}
                                    </span>
                                    {meeting.duration && (
                                      <span>{meeting.duration} min</span>
                                    )}
                                    <span className="flex items-center gap-1">
                                      <Users className="h-3 w-3" />
                                      {meeting.attendances?.length || 0} attendees
                                    </span>
                                  </div>

                                  {meeting.description && (
                                    <p className="text-sm text-muted-foreground line-clamp-2">
                                      {meeting.description}
                                    </p>
                                  )}

                                  {expandedMeetings.has(meeting.id) && (
                                    <motion.div
                                      initial={{ opacity: 0, height: 0 }}
                                      animate={{ opacity: 1, height: 'auto' }}
                                      exit={{ opacity: 0, height: 0 }}
                                      className="mt-4 pt-4 border-t space-y-3"
                                    >
                                      <div className="grid grid-cols-3 gap-4 text-sm">
                                        <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20">
                                          <p className="text-xs text-muted-foreground mb-1">Agenda Items</p>
                                          <p className="text-lg font-bold text-blue-600">
                                            {meeting.agendaItems?.length || 0}
                                          </p>
                                        </div>
                                        <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/20">
                                          <p className="text-xs text-muted-foreground mb-1">Decisions</p>
                                          <p className="text-lg font-bold text-green-600">
                                            {meeting.decisions?.length || 0}
                                          </p>
                                        </div>
                                        <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-950/20">
                                          <p className="text-xs text-muted-foreground mb-1">Actions</p>
                                          <p className="text-lg font-bold text-purple-600">
                                            {meeting.actionItems?.length || 0}
                                          </p>
                                        </div>
                                      </div>

                                      <div className="flex gap-2">
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setActiveTab('agenda');
                                          }}
                                        >
                                          <ListChecks className="h-4 w-4 mr-1" />
                                          Manage Agenda
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setActiveTab('minutes');
                                          }}
                                        >
                                          <FileText className="h-4 w-4 mr-1" />
                                          View Minutes
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="destructive"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            if (confirm('Delete this meeting?')) {
                                              deleteMeeting.mutate({ id: meeting.id });
                                            }
                                          }}
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    </motion.div>
                                  )}
                                </div>
                                <ChevronRight
                                  className={cn(
                                    'h-5 w-5 text-muted-foreground transition-transform',
                                    expandedMeetings.has(meeting.id) && 'rotate-90'
                                  )}
                                />
                              </div>
                            </CardContent>
                          </Card>
                        </motion.div>
                      ))
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="agenda" className="space-y-4">
              {!selectedMeetingId ? (
                <div className="text-center py-12">
                  <ListChecks className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Select a meeting to manage its agenda</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card className="glass-hierarchy-child">
                    <CardHeader>
                      <CardTitle className="text-lg">Add Agenda Item</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Title</label>
                        <Input
                          placeholder="e.g., Budget allocation discussion"
                          value={agendaForm.title}
                          onChange={(e) => setAgendaForm({ ...agendaForm, title: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Description</label>
                        <Textarea
                          placeholder="Details and context..."
                          value={agendaForm.description}
                          onChange={(e) => setAgendaForm({ ...agendaForm, description: e.target.value })}
                          rows={3}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Duration (min)</label>
                          <Input
                            type="number"
                            min={5}
                            max={120}
                            value={agendaForm.estimatedDuration}
                            onChange={(e) => setAgendaForm({ ...agendaForm, estimatedDuration: parseInt(e.target.value) || 15 })}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Priority</label>
                          <Select
                            value={agendaForm.priority}
                            onValueChange={(v) => setAgendaForm({ ...agendaForm, priority: v as any })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="high">High</SelectItem>
                              <SelectItem value="medium">Medium</SelectItem>
                              <SelectItem value="low">Low</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <Button
                        onClick={handleAddAgendaItem}
                        disabled={addAgendaItem.isPending}
                        className="w-full bg-gradient-to-r from-amber-600 to-amber-700 text-white"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Item
                      </Button>
                    </CardContent>
                  </Card>

                  <Card className="glass-hierarchy-child">
                    <CardHeader>
                      <CardTitle className="text-lg">Current Agenda</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {selectedMeeting?.agendaItems && selectedMeeting.agendaItems.length > 0 ? (
                        selectedMeeting.agendaItems
                          .sort((a, b) => a.order - b.order)
                          .map((item, index) => (
                            <motion.div
                              key={item.id}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: index * 0.1 }}
                              className="p-3 rounded-lg border border-border bg-card hover:shadow-sm transition-all"
                            >
                              <div className="flex items-start gap-3">
                                <div className="flex items-center gap-2">
                                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                                  <span className="text-sm font-bold text-muted-foreground">
                                    {index + 1}
                                  </span>
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <h4 className="font-medium text-sm">{item.title}</h4>
                                    <Badge className={getPriorityColor((item as any).priority || 'medium')}>
                                      {(item as any).priority || 'medium'}
                                    </Badge>
                                  </div>
                                  {item.description && (
                                    <p className="text-xs text-muted-foreground mb-2">
                                      {item.description}
                                    </p>
                                  )}
                                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                    <span className="flex items-center gap-1">
                                      <Clock className="h-3 w-3" />
                                      {(item as any).estimatedDuration || item.duration || 30} min
                                    </span>
                                    {(item as any).status && (
                                      <Badge variant="outline" className="text-xs">
                                        {(item as any).status}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          ))
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          <ListChecks className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">No agenda items yet</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}
            </TabsContent>

            <TabsContent value="minutes" className="space-y-4">
              {!selectedMeetingId ? (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Select a meeting to view or record minutes</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card className="glass-hierarchy-child">
                    <CardHeader>
                      <CardTitle className="text-lg">Record Decision</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Decision Title</label>
                        <Input
                          placeholder="e.g., Approve education budget increase"
                          value={decisionForm.title}
                          onChange={(e) => setDecisionForm({ ...decisionForm, title: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Description</label>
                        <Textarea
                          placeholder="Decision details and rationale..."
                          value={decisionForm.description}
                          onChange={(e) => setDecisionForm({ ...decisionForm, description: e.target.value })}
                          rows={3}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Type</label>
                          <Select
                            value={decisionForm.decisionType}
                            onValueChange={(v) => setDecisionForm({ ...decisionForm, decisionType: v as any })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="policy">Policy</SelectItem>
                              <SelectItem value="budget">Budget</SelectItem>
                              <SelectItem value="personnel">Personnel</SelectItem>
                              <SelectItem value="strategic">Strategic</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Outcome</label>
                          <Select
                            value={decisionForm.outcome}
                            onValueChange={(v) => setDecisionForm({ ...decisionForm, outcome: v as any })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="approved">Approved</SelectItem>
                              <SelectItem value="rejected">Rejected</SelectItem>
                              <SelectItem value="deferred">Deferred</SelectItem>
                              <SelectItem value="requires_review">Requires Review</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Votes For</label>
                          <Input
                            type="number"
                            min={0}
                            value={decisionForm.votesFor || ''}
                            onChange={(e) => setDecisionForm({ ...decisionForm, votesFor: parseInt(e.target.value) || undefined })}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Votes Against</label>
                          <Input
                            type="number"
                            min={0}
                            value={decisionForm.votesAgainst || ''}
                            onChange={(e) => setDecisionForm({ ...decisionForm, votesAgainst: parseInt(e.target.value) || undefined })}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Abstain</label>
                          <Input
                            type="number"
                            min={0}
                            value={decisionForm.votesAbstain || ''}
                            onChange={(e) => setDecisionForm({ ...decisionForm, votesAbstain: parseInt(e.target.value) || undefined })}
                          />
                        </div>
                      </div>
                      <Button
                        onClick={handleRecordDecision}
                        disabled={recordDecision.isPending}
                        className="w-full bg-gradient-to-r from-green-600 to-green-700 text-white"
                      >
                        <Vote className="h-4 w-4 mr-2" />
                        Record Decision
                      </Button>
                    </CardContent>
                  </Card>

                  <Card className="glass-hierarchy-child">
                    <CardHeader>
                      <CardTitle className="text-lg">Recorded Decisions</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {selectedMeeting?.decisions && selectedMeeting.decisions.length > 0 ? (
                        selectedMeeting.decisions.map((decision, index) => (
                          <motion.div
                            key={decision.id}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className="p-3 rounded-lg border border-border bg-card"
                          >
                            <div className="flex items-start gap-3">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <h4 className="font-medium text-sm">{decision.title}</h4>
                                  <Badge className={getOutcomeColor((decision as any).outcome || 'pending')}>
                                    {(decision as any).outcome || 'pending'}
                                  </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground mb-2">
                                  {decision.description}
                                </p>
                                <div className="flex items-center gap-3 text-xs">
                                  <Badge variant="outline">{decision.decisionType}</Badge>
                                  {((decision as any).votesFor !== null || (decision as any).votesAgainst !== null) && (
                                    <span className="text-muted-foreground">
                                      {(decision as any).votesFor || 0} for, {(decision as any).votesAgainst || 0} against
                                      {(decision as any).votesAbstain ? `, ${(decision as any).votesAbstain} abstain` : ''}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        ))
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          <Vote className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">No decisions recorded yet</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}
            </TabsContent>

            <TabsContent value="actions" className="space-y-4">
              {!selectedMeetingId ? (
                <div className="text-center py-12">
                  <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Select a meeting to create action items</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card className="glass-hierarchy-child">
                    <CardHeader>
                      <CardTitle className="text-lg">Create Action Item</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Title</label>
                        <Input
                          placeholder="e.g., Draft new policy document"
                          value={actionForm.title}
                          onChange={(e) => setActionForm({ ...actionForm, title: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Description</label>
                        <Textarea
                          placeholder="Action details and requirements..."
                          value={actionForm.description}
                          onChange={(e) => setActionForm({ ...actionForm, description: e.target.value })}
                          rows={3}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Assign To</label>
                        <Select
                          value={actionForm.assignedToId}
                          onValueChange={(v) => setActionForm({ ...actionForm, assignedToId: v })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select official" />
                          </SelectTrigger>
                          <SelectContent>
                            {officials && officials.length > 0 ? (
                              officials.map((official) => (
                                <SelectItem key={official.id} value={official.id}>
                                  {official.name} - {official.title}
                                </SelectItem>
                              ))
                            ) : (
                              <SelectItem value="none" disabled>
                                No officials available
                              </SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Due Date</label>
                          <Calendar
                            mode="single"
                            selected={actionForm.dueDate}
                            onSelect={(date) => date && setActionForm({ ...actionForm, dueDate: date })}
                            className="rounded-md border"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Priority</label>
                          <Select
                            value={actionForm.priority}
                            onValueChange={(v) => setActionForm({ ...actionForm, priority: v as any })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="high">High</SelectItem>
                              <SelectItem value="medium">Medium</SelectItem>
                              <SelectItem value="low">Low</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <Button
                        onClick={handleCreateActionItem}
                        disabled={createActionItem.isPending}
                        className="w-full bg-gradient-to-r from-purple-600 to-purple-700 text-white"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Create Action
                      </Button>
                    </CardContent>
                  </Card>

                  <Card className="glass-hierarchy-child">
                    <CardHeader>
                      <CardTitle className="text-lg">Action Items</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {selectedMeeting?.actionItems && selectedMeeting.actionItems.length > 0 ? (
                        selectedMeeting.actionItems.map((item, index) => (
                          <motion.div
                            key={item.id}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className="p-3 rounded-lg border border-border bg-card"
                          >
                            <div className="flex items-start gap-3">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <h4 className="font-medium text-sm">{item.title}</h4>
                                  <Badge className={getPriorityColor(item.priority || 'medium')}>
                                    {item.priority}
                                  </Badge>
                                  {item.status && (
                                    <Badge variant="outline" className="text-xs">
                                      {item.status}
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground mb-2">
                                  {item.description}
                                </p>
                                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                  <span className="flex items-center gap-1">
                                    <User className="h-3 w-3" />
                                    Assigned
                                  </span>
                                  {item.dueDate && (
                                    <span className="flex items-center gap-1">
                                      <CalendarIcon className="h-3 w-3" />
                                      Due {new Date(item.dueDate).toLocaleDateString()}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        ))
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">No action items yet</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default MeetingScheduler;
