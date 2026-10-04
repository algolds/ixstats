"use client";

import { Calendar } from "iconoir-react";
import { Textarea } from "~/components/ui/textarea";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { RadioCard, RadioCardGroup } from "~/components/ui/radio-card";
import { SegmentedControl } from "~/components/ui/segmented-control";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { IxTime } from "~/lib/ixtime";
import { INTENT_TEMPLATES } from "./meeting-scheduler-intents";
import { fromDateInputValue, toDateInputValue, type TimePreset } from "./meeting-scheduler-logic";
import type { IntentTemplate, MeetingSchedulerProps } from "./meeting-scheduler-types";

const EYEBROW = "text-label-secondary text-eyebrow";

const TIME_PRESETS = [
  { value: "immediately", label: "Immediately" },
  { value: "tomorrow", label: "Tomorrow" },
  { value: "custom", label: "Custom date" },
];

/** The linked-reference banner, then the active intent or the list of intents to switch to. */
export function IntentSelector({
  prefilled,
  isChanging,
  onChangingChange,
  selectedTemplateId,
  onSelectTemplate,
}: {
  prefilled?: NonNullable<MeetingSchedulerProps["defaultMeeting"]>["prefilledAgenda"];
  isChanging: boolean;
  onChangingChange: (changing: boolean) => void;
  selectedTemplateId: string;
  onSelectTemplate: (template: IntentTemplate) => void;
}) {
  const active = INTENT_TEMPLATES.find((t) => t.id === selectedTemplateId) ?? INTENT_TEMPLATES[0]!;
  return (
    <>
      {prefilled && (
        <div className="bg-surface-secondary rounded-row text-footnote p-3">
          <span className="text-eyebrow text-label-secondary mb-0.5 block">Linked reference</span>
          <div className="flex items-center gap-2">
            <span className="text-label font-medium">{prefilled.title}</span>
            <Badge variant="warning">
              {prefilled.linkedIssueId ? "Crisis issue" : "Draft policy"}
            </Badge>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className={EYEBROW}>Agenda intent</Label>
          {!isChanging && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => onChangingChange(true)}
              className="text-caption h-5 px-2"
            >
              Change intent
            </Button>
          )}
        </div>

        {!isChanging ? (
          <div className="rounded-row border-tint bg-tint-fill flex flex-col items-start border p-3 text-left">
            <span className="text-headline text-label">{active.name}</span>
            <span className="text-footnote text-label-secondary mt-0.5 leading-snug">
              {active.description}
            </span>
          </div>
        ) : (
          <RadioCardGroup
            aria-label="Meeting intent"
            columns={2}
            className="animate-in fade-in slide-in-from-top-1 duration-200"
            value={selectedTemplateId}
            onValueChange={(id) => {
              const tpl = INTENT_TEMPLATES.find((t) => t.id === id);
              if (!tpl) return;
              onSelectTemplate(tpl);
              onChangingChange(false);
            }}
          >
            {INTENT_TEMPLATES.map((tpl) => (
              <RadioCard
                key={tpl.id}
                value={tpl.id}
                title={tpl.name}
                description={tpl.description}
                indicator={false}
              />
            ))}
          </RadioCardGroup>
        )}
      </div>
    </>
  );
}

export function GuestCountrySelect({
  countries,
  value,
  onChange,
  disabled,
}: {
  countries: { id: string; name: string; flagUrl?: string | null }[];
  value: string;
  onChange: (id: string) => void;
  disabled: boolean;
}) {
  return (
    <div>
      <Label htmlFor="targetCountry" className="text-footnote">
        Guest country *
      </Label>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger id="targetCountry" className="text-footnote mt-1 h-9">
          <SelectValue placeholder="Select a country" />
        </SelectTrigger>
        <SelectContent>
          {countries.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              <span className="flex items-center gap-2">
                {c.flagUrl && (
                  <img src={c.flagUrl} alt="" className="h-3 w-4 rounded-xs object-cover" />
                )}
                {c.name}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function ScheduleFields({
  preset,
  onPresetChange,
  scheduledIxTime,
  onTimeChange,
}: {
  preset: TimePreset;
  onPresetChange: (preset: TimePreset) => void;
  scheduledIxTime: number;
  onTimeChange: (ms: number) => void;
}) {
  return (
    <div className="space-y-2">
      <Label className={EYEBROW}>Scheduled date and time</Label>
      <SegmentedControl
        aria-label="Scheduled date and time"
        fullWidth
        size="sm"
        value={preset}
        onValueChange={(v) => onPresetChange(v as TimePreset)}
        options={TIME_PRESETS}
      />

      {preset === "custom" && (
        <Card variant="well" padding="none" className="mt-2 space-y-2 p-3">
          <Label htmlFor="custom-date" className={EYEBROW}>
            Date
          </Label>
          <Input
            id="custom-date"
            type="date"
            value={toDateInputValue(scheduledIxTime)}
            onChange={(e) => e.target.value && onTimeChange(fromDateInputValue(e.target.value))}
            required
            className="bg-surface border-separator text-footnote max-w-[180px] py-2"
          />
          <div className="bg-fill-4 text-caption text-label-secondary rounded-control-sm flex items-center gap-2 px-3 py-1">
            <Calendar aria-hidden className="h-3.5 w-3.5" />
            <span>Scheduled date</span>
            <span className="text-label">
              {IxTime.formatIxTime(scheduledIxTime, false).replace(" (ILT)", "")}
            </span>
            <span className="text-label-secondary text-footnote ml-auto font-normal">(09:00)</span>
          </div>
        </Card>
      )}
    </div>
  );
}

export interface ProposedIntent {
  id: string;
  goal: string;
  category?: string | null;
  status: string;
}

/** Title and notes for the session, plus the optional link to a proposed intent. */
export function SessionFields({
  title,
  onTitleChange,
  description,
  onDescriptionChange,
  intents,
  linkedIntentId,
  onLinkedIntentChange,
}: {
  title: string;
  onTitleChange: (value: string) => void;
  description: string;
  onDescriptionChange: (value: string) => void;
  intents: ProposedIntent[];
  linkedIntentId: string;
  onLinkedIntentChange: (id: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <Label htmlFor="title" className="text-footnote">
          Session title *
        </Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="e.g. Emergency cabinet session"
          required
        />
      </div>

      <div>
        <Label htmlFor="description" className="text-footnote">
          Context notes
        </Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder="Goals for the session (optional)"
          rows={2}
        />
      </div>

      {intents.length > 0 && (
        <div>
          <Label htmlFor="intent-select" className="text-footnote">
            Linked intent
          </Label>
          <Select value={linkedIntentId} onValueChange={onLinkedIntentChange}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a proposed intent" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None (routine session)</SelectItem>
              {intents.map((intent) => (
                <SelectItem key={intent.id} value={intent.id}>
                  {intent.goal} ({intent.category})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
