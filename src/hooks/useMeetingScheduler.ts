/**
 * Meeting Scheduler State Management Hook
 *
 * Encapsulates all state management, data fetching, and business logic
 * for the Meeting Scheduler component.
 *
 * @module useMeetingScheduler
 */

import { useState, useMemo, useCallback } from 'react';
import { api } from '~/trpc/react';
import { toast } from 'sonner';
import {
  filterMeetingsByDate,
  sortMeetingsByTime,
  calculateMeetingStats,
  convertToIxTime,
  validateMeetingData,
  validateAgendaItemData,
  validateDecisionData,
  validateActionItemData,
  type Meeting,
  type AgendaItem as SchedulerAgendaItem,
  type Decision as SchedulerDecision,
  type ActionItem as SchedulerActionItem,
  type Attendance as SchedulerAttendance,
} from '~/lib/meeting-scheduler-utils';

// ============================================================================
// Types
// ============================================================================

export interface AgendaItemForm {
  title: string;
  description: string;
  order: number;
  estimatedDuration: number;
  priority: 'high' | 'medium' | 'low';
}

export interface DecisionForm {
  title: string;
  description: string;
  decisionType: 'policy' | 'budget' | 'personnel' | 'strategic' | 'other';
  outcome: 'approved' | 'rejected' | 'deferred' | 'requires_review';
  votesFor?: number;
  votesAgainst?: number;
  votesAbstain?: number;
}

export interface ActionItemForm {
  title: string;
  description: string;
  assignedToId: string;
  dueDate: Date;
  priority: 'high' | 'medium' | 'low';
}

export interface MeetingForm {
  title: string;
  description: string;
  scheduledDate: Date;
  duration: number;
}

// ============================================================================
// Normalization Utilities
// ============================================================================

const ensureString = (value: unknown, fallback: string): string =>
  typeof value === 'string' && value.trim().length > 0
    ? value
    : fallback;

const ensureNumber = (value: unknown): number | null =>
  typeof value === 'number' && !Number.isNaN(value) ? value : null;

const parseDate = (value: unknown): Date => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return new Date();
};

const normalizeAgendaItems = (
  items: any[] | undefined,
): SchedulerAgendaItem[] => {
  if (!Array.isArray(items)) return [];

  return items.map((item, index) => ({
    id: ensureString(item?.id, `agenda-${index}`),
    title: ensureString(item?.title, `Agenda Item ${index + 1}`),
    description: item?.description ?? null,
    order: typeof item?.order === 'number' ? item.order : index,
    duration: ensureNumber(item?.duration),
    estimatedDuration: ensureNumber(item?.estimatedDuration ?? item?.duration) ?? undefined,
    priority: typeof item?.priority === 'string' ? item.priority : undefined,
    status: item?.status ?? null,
  }));
};

const normalizeDecisions = (
  decisions: any[] | undefined,
): SchedulerDecision[] => {
  if (!Array.isArray(decisions)) return [];

  return decisions.map((decision, index) => ({
    id: ensureString(decision?.id, `decision-${index}`),
    title: ensureString(decision?.title, `Decision ${index + 1}`),
    description: decision?.description ?? null,
    decisionType: ensureString(decision?.decisionType, 'general'),
    outcome: decision?.outcome ?? undefined,
    votesFor: ensureNumber(decision?.votesFor) ?? undefined,
    votesAgainst: ensureNumber(decision?.votesAgainst) ?? undefined,
    votesAbstain: ensureNumber(decision?.votesAbstain) ?? undefined,
  }));
};

const normalizeActionItems = (
  items: any[] | undefined,
): SchedulerActionItem[] => {
  if (!Array.isArray(items)) return [];

  return items.map((action, index) => ({
    id: ensureString(action?.id, `action-${index}`),
    title: ensureString(action?.title, `Action Item ${index + 1}`),
    description: action?.description ?? null,
    assignedToId: action?.assignedToId ?? action?.assignedTo ?? undefined,
    dueDate: action?.dueDate ?? action?.dueIxTime ?? null,
    priority: action?.priority ?? null,
    status: action?.status ?? null,
  }));
};

const normalizeAttendances = (
  attendances: any[] | undefined,
  meetingId: string,
): SchedulerAttendance[] => {
  if (!Array.isArray(attendances)) return [];

  return attendances
    .map((attendance, index) => {
      const userId =
        attendance?.userId ??
        attendance?.officialId ??
        attendance?.attendeeId ??
        attendance?.attendeeUserId ??
        null;

      if (!userId) {
        return null;
      }

      return {
        id: ensureString(attendance?.id, `attendance-${meetingId}-${index}`),
        userId: ensureString(userId, `user-${meetingId}-${index}`),
        status: ensureString(
          attendance?.status ?? attendance?.attendanceStatus,
          'pending',
        ),
      } as SchedulerAttendance;
    })
    .filter((attendance): attendance is SchedulerAttendance => attendance !== null);
};

const normalizeMeeting = (meeting: any): Meeting => {
  const id = ensureString(meeting?.id ?? meeting?.meetingId, `meeting-${Math.random().toString(36).slice(2, 10)}`);
  const scheduledDate = parseDate(
    meeting?.scheduledDate ??
      meeting?.scheduledFor ??
      meeting?.scheduledIxTime ??
      meeting?.createdAt,
  );

  return {
    id,
    title: ensureString(meeting?.title, 'Untitled Meeting'),
    description: meeting?.description ?? null,
    scheduledDate,
    duration: ensureNumber(meeting?.duration ?? meeting?.meetingDuration),
    status: meeting?.status ?? meeting?.meetingStatus ?? null,
    scheduledIxTime:
      typeof meeting?.scheduledIxTime === 'number'
        ? meeting.scheduledIxTime
        : convertToIxTime(scheduledDate),
    agendaItems: normalizeAgendaItems(meeting?.agendaItems),
    decisions: normalizeDecisions(meeting?.decisions),
    actionItems: normalizeActionItems(meeting?.actionItems),
    attendances: normalizeAttendances(meeting?.attendances, id),
  };
};

const normalizeMeetings = (meetings: unknown): Meeting[] => {
  if (!Array.isArray(meetings)) return [];
  return meetings.map(normalizeMeeting);
};

export type ActiveTab = 'calendar' | 'agenda' | 'minutes' | 'actions';

// ============================================================================
// Hook
// ============================================================================

export function useMeetingScheduler(
  countryId: string,
  userId: string,
  governmentStructureId?: string
) {
  // ============================================================================
  // State
  // ============================================================================

  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [createMeetingOpen, setCreateMeetingOpen] = useState(false);
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('calendar');
  const [expandedMeetings, setExpandedMeetings] = useState<Set<string>>(new Set());

  // Form states
  const [meetingForm, setMeetingForm] = useState<MeetingForm>({
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

  // ============================================================================
  // Queries
  // ============================================================================

  const { data: meetings, refetch: refetchMeetings, isLoading: meetingsLoading } =
    api.meetings.getMeetings.useQuery(
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
    { governmentStructureId, active: true },
    { enabled: !!governmentStructureId }
  );

  // ============================================================================
  // Mutations
  // ============================================================================

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

  // ============================================================================
  // Computed Values (Memoized)
  // ============================================================================

  const normalizedMeetings = useMemo(
    () => normalizeMeetings(meetings),
    [meetings]
  );

  const normalizedSelectedMeeting = useMemo(
    () => (selectedMeeting ? normalizeMeeting(selectedMeeting) : null),
    [selectedMeeting]
  );

  const filteredMeetings = useMemo(() => {
    return filterMeetingsByDate(normalizedMeetings, selectedDate);
  }, [normalizedMeetings, selectedDate]);

  const sortedMeetings = useMemo(() => {
    return sortMeetingsByTime(filteredMeetings);
  }, [filteredMeetings]);

  const meetingStats = useMemo(() => {
    if (!normalizedMeetings.length) return null;
    return calculateMeetingStats(normalizedMeetings);
  }, [normalizedMeetings]);

  // ============================================================================
  // Form Reset Functions
  // ============================================================================

  const resetMeetingForm = useCallback(() => {
    setMeetingForm({
      title: '',
      description: '',
      scheduledDate: new Date(),
      duration: 60,
    });
  }, []);

  const resetAgendaForm = useCallback(() => {
    setAgendaForm({
      title: '',
      description: '',
      order: 0,
      estimatedDuration: 15,
      priority: 'medium',
    });
  }, []);

  const resetDecisionForm = useCallback(() => {
    setDecisionForm({
      title: '',
      description: '',
      decisionType: 'policy',
      outcome: 'approved',
    });
  }, []);

  const resetActionForm = useCallback(() => {
    setActionForm({
      title: '',
      description: '',
      assignedToId: '',
      dueDate: new Date(),
      priority: 'medium',
    });
  }, []);

  // ============================================================================
  // Event Handlers
  // ============================================================================

  const handleCreateMeeting = useCallback(() => {
    const validation = validateMeetingData(
      meetingForm.title,
      meetingForm.scheduledDate
    );

    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }

    const ixTime = convertToIxTime(meetingForm.scheduledDate);

    createMeeting.mutate({
      countryId,
      userId,
      title: meetingForm.title,
      scheduledDate: new Date(ixTime),
      description: meetingForm.description,
      duration: meetingForm.duration,
      scheduledIxTime: ixTime,
    });
  }, [meetingForm, countryId, userId, createMeeting]);

  const handleAddAgendaItem = useCallback(() => {
    if (!selectedMeetingId) {
      toast.error('Please select a meeting first');
      return;
    }

    const validation = validateAgendaItemData(
      agendaForm.title,
      agendaForm.estimatedDuration
    );

    if (!validation.valid) {
      toast.error(validation.error);
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
  }, [selectedMeetingId, agendaForm, addAgendaItem]);

  const handleRecordDecision = useCallback(() => {
    if (!selectedMeetingId) {
      toast.error('Please select a meeting first');
      return;
    }

    const validation = validateDecisionData(decisionForm.title);

    if (!validation.valid) {
      toast.error(validation.error);
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
  }, [selectedMeetingId, decisionForm, recordDecision]);

  const handleCreateActionItem = useCallback(() => {
    if (!selectedMeetingId) {
      toast.error('Please select a meeting first');
      return;
    }

    const validation = validateActionItemData(
      actionForm.title,
      actionForm.assignedToId,
      actionForm.dueDate
    );

    if (!validation.valid) {
      toast.error(validation.error);
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
  }, [selectedMeetingId, actionForm, createActionItem]);

  const handleDeleteMeeting = useCallback((meetingId: string) => {
    if (confirm('Delete this meeting?')) {
      deleteMeeting.mutate({ id: meetingId });
    }
  }, [deleteMeeting]);

  const toggleMeetingExpanded = useCallback((meetingId: string) => {
    setExpandedMeetings(prev => {
      const newSet = new Set(prev);
      if (newSet.has(meetingId)) {
        newSet.delete(meetingId);
      } else {
        newSet.add(meetingId);
      }
      return newSet;
    });
  }, []);

  // ============================================================================
  // Return Interface
  // ============================================================================

  return {
    // State
    selectedDate,
    setSelectedDate,
    createMeetingOpen,
    setCreateMeetingOpen,
    selectedMeetingId,
    setSelectedMeetingId,
    activeTab,
    setActiveTab,
    expandedMeetings,

    // Forms
    meetingForm,
    setMeetingForm,
    agendaForm,
    setAgendaForm,
    decisionForm,
    setDecisionForm,
    actionForm,
    setActionForm,

    // Data
    meetings: normalizedMeetings,
    filteredMeetings: sortedMeetings,
    selectedMeeting: normalizedSelectedMeeting,
    departments,
    officials,
    meetingStats,

    // Loading states
    meetingsLoading,
    isCreatingMeeting: createMeeting.isPending,
    isAddingAgendaItem: addAgendaItem.isPending,
    isRecordingDecision: recordDecision.isPending,
    isCreatingActionItem: createActionItem.isPending,

    // Handlers
    handleCreateMeeting,
    handleAddAgendaItem,
    handleRecordDecision,
    handleCreateActionItem,
    handleDeleteMeeting,
    toggleMeetingExpanded,
    resetMeetingForm,
    resetAgendaForm,
    resetDecisionForm,
    resetActionForm,
  };
}

export type MeetingSchedulerHook = ReturnType<typeof useMeetingScheduler>;
