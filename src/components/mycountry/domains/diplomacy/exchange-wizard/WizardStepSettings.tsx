"use client";

import React from "react";
import { Calendar, Eye, EyeClosed, Group } from "iconoir-react";
import { Input } from "~/components/ui/input";
import { Checkbox } from "~/components/ui/checkbox";
import { Label } from "~/components/ui/label";
import { Skeleton } from "~/components/ui/skeleton";
import { RealmDayInput } from "~/components/realms/RealmDayInput";
import { formatRealmDate, type RealmCalendar } from "~/lib/realms/realm-clock";
import { fromWireDate, toWireDate } from "./exchange-wizard-dates";

interface WizardStepSettingsProps {
  startDate: string;
  onStartDateChange: (value: string) => void;
  endDate: string;
  onEndDateChange: (value: string) => void;
  /** Today on the host nation's realm clock (`YYYY-MM-DD`). */
  todayDate: string;
  /** The host nation's realm calendar; null while its clock loads. */
  calendar: RealmCalendar | null;
  maxParticipants: number;
  onMaxParticipantsChange: (value: number) => void;
  isPublic: boolean;
  onIsPublicChange: (value: boolean) => void;
}

/** Step 4 — schedule, capacity and visibility. */
export const WizardStepSettings = React.memo(function WizardStepSettings({
  startDate,
  onStartDateChange,
  endDate,
  onEndDateChange,
  todayDate,
  calendar,
  maxParticipants,
  onMaxParticipantsChange,
  isPublic,
  onIsPublicChange,
}: WizardStepSettingsProps) {
  const today = fromWireDate(todayDate);
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-label text-title-3 mb-2">Configuration & settings</h3>
        <p className="text-label-secondary text-body">
          Set the schedule, capacity, and visibility of your exchange.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="startDate" className="text-label flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Start date *
          </Label>
          {calendar ? (
            <RealmDayInput
              id="startDate"
              calendar={calendar}
              value={fromWireDate(startDate)}
              min={today}
              onChange={(ms) => onStartDateChange(toWireDate(ms))}
            />
          ) : (
            <Skeleton className="h-9 w-full" />
          )}
          <p className="text-label-secondary text-footnote">
            Today: {calendar && today !== null ? formatRealmDate(today, calendar) : "–"}
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="endDate" className="text-label flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            End date *
          </Label>
          {calendar ? (
            <RealmDayInput
              id="endDate"
              calendar={calendar}
              value={fromWireDate(endDate)}
              min={fromWireDate(startDate) ?? today}
              onChange={(ms) => onEndDateChange(toWireDate(ms))}
            />
          ) : (
            <Skeleton className="h-9 w-full" />
          )}
          <p className="text-label-secondary text-footnote">Must be after start date</p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="maxParticipants" className="text-label flex items-center gap-2">
          <Group className="h-4 w-4" />
          Maximum Participants *
        </Label>
        <Input
          id="maxParticipants"
          type="number"
          min="1"
          value={maxParticipants}
          onChange={(e) => onMaxParticipantsChange(Math.max(1, parseInt(e.target.value) || 1))}
        />
        <p className="text-label-secondary text-footnote">
          Number of people who can participate in this exchange.
        </p>
      </div>

      <div className="border-separator bg-surface rounded-row border p-4">
        <div
          onClick={() => onIsPublicChange(!isPublic)}
          className="flex w-full cursor-pointer items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <Checkbox checked={isPublic} className="pointer-events-none" />
            <div className="text-left">
              <p className="text-label flex items-center gap-2 font-medium">
                {isPublic ? <Eye className="h-4 w-4" /> : <EyeClosed className="h-4 w-4" />}
                Public Exchange
              </p>
              <p className="text-label-secondary text-body">
                {isPublic
                  ? "Visible to all countries and can accept participants"
                  : "Restricted to invited participants only"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
