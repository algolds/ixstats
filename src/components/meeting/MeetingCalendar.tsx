/**
 * MeetingCalendar Component
 *
 * Displays calendar view with meeting selection and date filtering.
 *
 * @module MeetingCalendar
 */

import React from "react";
import { Calendar } from "~/components/ui/calendar";
import { Card, CardContent } from "~/components/ui/card";

interface MeetingCalendarProps {
  selectedDate: Date | undefined;
  onSelectDate: (date: Date | undefined) => void;
  meetingCount?: number;
  className?: string;
}

export const MeetingCalendar = React.memo<MeetingCalendarProps>(
  ({ selectedDate, onSelectDate, meetingCount = 0, className }) => {
    return (
      <div className={className}>
        <Card className="glass-hierarchy-child">
          <CardContent className="p-4">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={onSelectDate}
              className="rounded-md"
            />
          </CardContent>
        </Card>

        {selectedDate && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/20">
            <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
              {meetingCount} meeting{meetingCount !== 1 ? "s" : ""} on{" "}
              {selectedDate.toLocaleDateString()}
            </p>
          </div>
        )}
      </div>
    );
  }
);

MeetingCalendar.displayName = "MeetingCalendar";
