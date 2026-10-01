"use client";

import React from "react";
import { Calendar, Eye, EyeClosed, Group } from "iconoir-react";
import { Input } from "~/components/ui/input";
import { Checkbox } from "~/components/ui/checkbox";
import { Label } from "~/components/ui/label";

interface WizardStepSettingsProps {
  startDate: string;
  onStartDateChange: (value: string) => void;
  endDate: string;
  onEndDateChange: (value: string) => void;
  currentIxTimeDate: string;
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
  currentIxTimeDate,
  maxParticipants,
  onMaxParticipantsChange,
  isPublic,
  onIsPublicChange,
}: WizardStepSettingsProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-label text-title-3 mb-2">Configuration & Settings</h3>
        <p className="text-label-secondary text-body">
          Set the schedule, capacity, and visibility of your exchange.
        </p>
      </div>

      {/* Dates */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="startDate" className="text-label flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Start Date (IxTime) *
          </Label>
          <Input
            id="startDate"
            type="date"
            value={startDate}
            min={currentIxTimeDate}
            onChange={(e) => onStartDateChange(e.target.value)}
          />
          <p className="text-label-secondary text-footnote">
            Today in IxTime:{" "}
            {new Date(currentIxTimeDate).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
              timeZone: "UTC",
            })}
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="endDate" className="text-label flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            End Date (IxTime) *
          </Label>
          <Input
            id="endDate"
            type="date"
            value={endDate}
            min={startDate || currentIxTimeDate}
            onChange={(e) => onEndDateChange(e.target.value)}
          />
          <p className="text-label-secondary text-footnote">Must be after start date</p>
        </div>
      </div>

      {/* Max Participants */}
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

      {/* Public/Private */}
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
