/**
 * MeetingList Component
 *
 * Displays list of meetings with empty state handling.
 *
 * @module MeetingList
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar as CalendarIcon } from 'lucide-react';
import { MeetingCard } from './MeetingCard';
import type { Meeting } from '~/lib/meeting-scheduler-utils';

interface MeetingListProps {
  meetings: Meeting[];
  selectedMeetingId: string | null;
  expandedMeetings: Set<string>;
  onSelectMeeting: (id: string) => void;
  onToggleExpanded: (id: string) => void;
  onDeleteMeeting: (id: string) => void;
  onManageAgenda: () => void;
  onViewMinutes: () => void;
  className?: string;
}

export const MeetingList = React.memo<MeetingListProps>(({
  meetings,
  selectedMeetingId,
  expandedMeetings,
  onSelectMeeting,
  onToggleExpanded,
  onDeleteMeeting,
  onManageAgenda,
  onViewMinutes,
  className
}) => {
  if (meetings.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="text-center py-12"
      >
        <CalendarIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <p className="text-muted-foreground">No meetings scheduled for this date</p>
      </motion.div>
    );
  }

  return (
    <div className={className}>
      <h3 className="text-lg font-semibold mb-4">Scheduled Meetings</h3>
      <div className="space-y-4">
        <AnimatePresence>
          {meetings.map((meeting, index) => (
            <MeetingCard
              key={meeting.id}
              meeting={meeting}
              isSelected={selectedMeetingId === meeting.id}
              isExpanded={expandedMeetings.has(meeting.id)}
              onSelect={onSelectMeeting}
              onToggleExpanded={onToggleExpanded}
              onDelete={onDeleteMeeting}
              onManageAgenda={onManageAgenda}
              onViewMinutes={onViewMinutes}
              index={index}
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
});

MeetingList.displayName = 'MeetingList';
