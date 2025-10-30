/**
 * MeetingForm Component
 *
 * Form for creating new meetings with date/time selection.
 *
 * @module MeetingForm
 */

import React from 'react';
import { Calendar } from '~/components/ui/calendar';
import { Input } from '~/components/ui/input';
import { Textarea } from '~/components/ui/textarea';
import { IxTime } from '~/lib/ixtime';
import type { MeetingForm as MeetingFormData } from '~/hooks/useMeetingScheduler';

interface MeetingFormProps {
  form: MeetingFormData;
  onChange: (form: MeetingFormData) => void;
  className?: string;
}

export const MeetingForm = React.memo<MeetingFormProps>(({
  form,
  onChange,
  className
}) => {
  return (
    <div className={className}>
      <div className="space-y-4 py-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Meeting Title</label>
          <Input
            placeholder="e.g., Budget Review Meeting"
            value={form.title}
            onChange={(e) => onChange({ ...form, title: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Description</label>
          <Textarea
            placeholder="Meeting objectives and context..."
            value={form.description || ''}
            onChange={(e) => onChange({ ...form, description: e.target.value })}
            rows={3}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Scheduled Date</label>
            <Calendar
              mode="single"
              selected={form.scheduledDate}
              onSelect={(date) => date && onChange({ ...form, scheduledDate: date })}
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
                value={form.duration}
                onChange={(e) =>
                  onChange({ ...form, duration: parseInt(e.target.value) || 60 })
                }
              />
            </div>

            <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>IxTime:</strong>{' '}
                {IxTime.formatIxTime(IxTime.convertToIxTime(form.scheduledDate.getTime()))}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

MeetingForm.displayName = 'MeetingForm';
