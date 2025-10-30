/**
 * Meeting Scheduler Utility Functions
 *
 * Pure TypeScript functions for meeting scheduling, validation, and data transformations.
 * Contains no React dependencies - fully unit testable.
 *
 * @module meeting-scheduler-utils
 */

import { IxTime } from '~/lib/ixtime';

// ============================================================================
// Types
// ============================================================================

export interface Meeting {
  id: string;
  title: string;
  description?: string | null;
  scheduledDate: Date | string;
  duration?: number | null;
  status?: string | null;
  scheduledIxTime?: number | null;
  agendaItems?: AgendaItem[];
  decisions?: Decision[];
  actionItems?: ActionItem[];
  attendances?: Attendance[];
}

export interface AgendaItem {
  id: string;
  title: string;
  description?: string | null;
  order: number;
  duration?: number | null;
  estimatedDuration?: number;
  priority?: string;
  status?: string | null;
}

export interface Decision {
  id: string;
  title: string;
  description?: string | null;
  decisionType: string;
  outcome?: string;
  votesFor?: number | null;
  votesAgainst?: number | null;
  votesAbstain?: number | null;
}

export interface ActionItem {
  id: string;
  title: string;
  description?: string | null;
  assignedToId?: string | null;
  dueDate?: Date | string | null;
  priority?: string | null;
  status?: string | null;
}

export interface Attendance {
  id: string;
  userId: string;
  status: string;
}

export interface MeetingStats {
  total: number;
  scheduled: number;
  inProgress: number;
  completed: number;
  cancelled: number;
  upcoming: number;
  past: number;
}

export interface TimeSlot {
  startTime: string;
  endTime: string;
  available: boolean;
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validates meeting form data
 *
 * @param title - Meeting title
 * @param scheduledDate - Scheduled date
 * @returns Validation result with error message if invalid
 */
export function validateMeetingData(
  title: string,
  scheduledDate: Date
): { valid: boolean; error?: string } {
  if (!title || title.trim().length === 0) {
    return { valid: false, error: 'Meeting title is required' };
  }

  if (title.trim().length > 200) {
    return { valid: false, error: 'Meeting title must be less than 200 characters' };
  }

  if (!scheduledDate || isNaN(scheduledDate.getTime())) {
    return { valid: false, error: 'Valid scheduled date is required' };
  }

  // Check if date is in the past (allowing 5 minutes buffer)
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  if (scheduledDate < fiveMinutesAgo) {
    return { valid: false, error: 'Cannot schedule meetings in the past' };
  }

  return { valid: true };
}

/**
 * Validates agenda item form data
 *
 * @param title - Agenda item title
 * @param estimatedDuration - Estimated duration in minutes
 * @returns Validation result with error message if invalid
 */
export function validateAgendaItemData(
  title: string,
  estimatedDuration: number
): { valid: boolean; error?: string } {
  if (!title || title.trim().length === 0) {
    return { valid: false, error: 'Agenda item title is required' };
  }

  if (title.trim().length > 200) {
    return { valid: false, error: 'Agenda item title must be less than 200 characters' };
  }

  if (estimatedDuration < 1 || estimatedDuration > 480) {
    return { valid: false, error: 'Duration must be between 1 and 480 minutes' };
  }

  return { valid: true };
}

/**
 * Validates decision form data
 *
 * @param title - Decision title
 * @returns Validation result with error message if invalid
 */
export function validateDecisionData(
  title: string
): { valid: boolean; error?: string } {
  if (!title || title.trim().length === 0) {
    return { valid: false, error: 'Decision title is required' };
  }

  if (title.trim().length > 200) {
    return { valid: false, error: 'Decision title must be less than 200 characters' };
  }

  return { valid: true };
}

/**
 * Validates action item form data
 *
 * @param title - Action item title
 * @param assignedToId - Assigned user ID
 * @param dueDate - Due date
 * @returns Validation result with error message if invalid
 */
export function validateActionItemData(
  title: string,
  assignedToId: string,
  dueDate: Date
): { valid: boolean; error?: string } {
  if (!title || title.trim().length === 0) {
    return { valid: false, error: 'Action item title is required' };
  }

  if (title.trim().length > 200) {
    return { valid: false, error: 'Action item title must be less than 200 characters' };
  }

  if (!assignedToId || assignedToId.trim().length === 0) {
    return { valid: false, error: 'Action item must be assigned to someone' };
  }

  if (!dueDate || isNaN(dueDate.getTime())) {
    return { valid: false, error: 'Valid due date is required' };
  }

  return { valid: true };
}

// ============================================================================
// Time & Duration Functions
// ============================================================================

/**
 * Calculates meeting duration in minutes
 *
 * @param startTime - Start time
 * @param endTime - End time
 * @returns Duration in minutes
 */
export function calculateMeetingDuration(startTime: Date, endTime: Date): number {
  const durationMs = endTime.getTime() - startTime.getTime();
  return Math.floor(durationMs / (1000 * 60));
}

/**
 * Formats meeting time for display
 *
 * @param date - Date to format
 * @returns Formatted time string
 */
export function formatMeetingTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

/**
 * Converts real-world date to IxTime
 *
 * @param date - Date to convert
 * @returns IxTime timestamp
 */
export function convertToIxTime(date: Date): number {
  return IxTime.convertToIxTime(date.getTime());
}

/**
 * Formats IxTime for display
 *
 * @param ixTime - IxTime timestamp
 * @returns Formatted IxTime string
 */
export function formatIxTime(ixTime: number): string {
  return IxTime.formatIxTime(ixTime);
}

// ============================================================================
// Meeting Filtering & Sorting
// ============================================================================

/**
 * Filters meetings by selected date
 *
 * @param meetings - Array of meetings
 * @param selectedDate - Date to filter by
 * @returns Filtered meetings
 */
export function filterMeetingsByDate(
  meetings: Meeting[],
  selectedDate: Date | undefined
): Meeting[] {
  if (!meetings || !selectedDate) return [];

  return meetings.filter(meeting => {
    const meetingDate = new Date(meeting.scheduledDate);
    return (
      meetingDate.getDate() === selectedDate.getDate() &&
      meetingDate.getMonth() === selectedDate.getMonth() &&
      meetingDate.getFullYear() === selectedDate.getFullYear()
    );
  });
}

/**
 * Sorts meetings chronologically
 *
 * @param meetings - Array of meetings
 * @returns Sorted meetings (earliest first)
 */
export function sortMeetingsByTime(meetings: Meeting[]): Meeting[] {
  return [...meetings].sort((a, b) => {
    const dateA = new Date(a.scheduledDate).getTime();
    const dateB = new Date(b.scheduledDate).getTime();
    return dateA - dateB;
  });
}

/**
 * Groups meetings by date
 *
 * @param meetings - Array of meetings
 * @returns Meetings grouped by date string (YYYY-MM-DD)
 */
export function groupMeetingsByDate(meetings: Meeting[]): Record<string, Meeting[]> {
  const grouped: Record<string, Meeting[]> = {};

  meetings.forEach(meeting => {
    const date = new Date(meeting.scheduledDate);
    const dateKey = date.toISOString().split('T')[0]!;

    if (!grouped[dateKey]) {
      grouped[dateKey] = [];
    }
    grouped[dateKey]!.push(meeting);
  });

  return grouped;
}

// ============================================================================
// Statistics & Analytics
// ============================================================================

/**
 * Calculates meeting statistics
 *
 * @param meetings - Array of meetings
 * @returns Meeting statistics
 */
export function calculateMeetingStats(meetings: Meeting[]): MeetingStats {
  const now = new Date();

  const stats: MeetingStats = {
    total: meetings.length,
    scheduled: 0,
    inProgress: 0,
    completed: 0,
    cancelled: 0,
    upcoming: 0,
    past: 0
  };

  meetings.forEach(meeting => {
    const status = meeting.status || 'scheduled';
    const meetingDate = new Date(meeting.scheduledDate);

    // Count by status
    if (status === 'scheduled') stats.scheduled++;
    else if (status === 'in_progress') stats.inProgress++;
    else if (status === 'completed') stats.completed++;
    else if (status === 'cancelled') stats.cancelled++;

    // Count upcoming vs past
    if (meetingDate > now) stats.upcoming++;
    else stats.past++;
  });

  return stats;
}

// ============================================================================
// Status & Priority Helpers
// ============================================================================

/**
 * Gets CSS classes for meeting status badge
 *
 * @param status - Meeting status
 * @returns CSS class string
 */
export function getStatusColor(status: string): string {
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
}

/**
 * Gets CSS classes for priority badge
 *
 * @param priority - Priority level
 * @returns CSS class string
 */
export function getPriorityColor(priority: string): string {
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
}

/**
 * Gets CSS classes for decision outcome badge
 *
 * @param outcome - Decision outcome
 * @returns CSS class string
 */
export function getOutcomeColor(outcome: string): string {
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
}
