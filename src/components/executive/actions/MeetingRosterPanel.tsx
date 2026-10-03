"use client";

import React, { useState } from "react";
import { Plus, Xmark as X } from "iconoir-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { cn } from "~/lib/utils";
import type { AgendaItem } from "./meeting-scheduler-types";
import { AGENDA_CATEGORIES } from "./meeting-scheduler-intents";
import { matchesRoles, type RosterOfficial } from "./meeting-scheduler-logic";

const CAPTION = "text-label-secondary text-eyebrow";

function AttendeeChip({
  official,
  recommended,
  onRemove,
}: {
  official: RosterOfficial;
  recommended: boolean;
  onRemove: () => void;
}) {
  return (
    <div
      className={cn(
        "text-footnote flex items-center gap-2 rounded-full border px-2 py-0.5 transition-[color,background-color,border-color,box-shadow,opacity,transform]",
        recommended
          ? "border-separator bg-fill-3 text-label"
          : "border-separator bg-fill-4 text-label-tertiary"
      )}
    >
      <div className="flex max-w-[100px] min-w-0 flex-col text-left leading-tight">
        <span className="truncate font-semibold">{official.name}</span>
        <span className="text-footnote truncate opacity-60">{official.title}</span>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={onRemove}
        aria-label="Remove official"
        className="text-label-secondary hover:text-label ml-0.5 size-4 rounded-full"
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}

function AttendeesSection({
  officials,
  selected,
  onChange,
  loading,
  recommendedRoles,
}: {
  officials: RosterOfficial[];
  selected: string[];
  onChange: (ids: string[]) => void;
  loading: boolean;
  recommendedRoles: string[];
}) {
  const available = officials.filter((o) => !selected.includes(o.id));
  return (
    <div className="space-y-2">
      <Label className={CAPTION}>Attendees ({selected.length} invited)</Label>

      {loading ? (
        <div className="text-label-secondary text-footnote animate-pulse py-2">
          Loading officials
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {selected.map((id) => {
              const official = officials.find((o) => o.id === id);
              return (
                official && (
                  <AttendeeChip
                    key={id}
                    official={official}
                    recommended={matchesRoles(official, recommendedRoles)}
                    onRemove={() => onChange(selected.filter((s) => s !== id))}
                  />
                )
              );
            })}
            {selected.length === 0 && (
              <span className="text-label-tertiary text-footnote py-1 italic">
                No attendees selected.
              </span>
            )}
          </div>

          {available.length > 0 && (
            <div className="flex items-center gap-2">
              <Select value="" onValueChange={(val) => val && onChange([...selected, val])}>
                <SelectTrigger className="border-separator bg-fill-4 text-footnote h-7 w-fit min-w-[150px] cursor-pointer py-1">
                  <Plus className="text-label-secondary mr-1 h-3.5 w-3.5" />
                  <span>Add invitees</span>
                </SelectTrigger>
                <SelectContent>
                  {available.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name} ({o.title})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function LabeledField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className={CAPTION}>{label}</Label>
      {children}
    </div>
  );
}

function AgendaTopicEditor({
  item,
  onChange,
}: {
  item: AgendaItem;
  onChange: (patch: Partial<AgendaItem>) => void;
}) {
  return (
    <div className="border-separator bg-fill-4 text-footnote space-y-3 border-t p-3">
      <LabeledField label="Topic title">
        <Input
          value={item.title}
          onChange={(e) => onChange({ title: e.target.value })}
          className="text-footnote mt-1 h-8"
        />
      </LabeledField>

      <div className="grid grid-cols-2 gap-2">
        <LabeledField label="Duration (min)">
          <Input
            type="number"
            value={item.duration}
            onChange={(e) => onChange({ duration: parseInt(e.target.value) || 15 })}
            className="text-footnote mt-1 h-8"
          />
        </LabeledField>
        <LabeledField label="Category">
          <Select value={item.category} onValueChange={(category) => onChange({ category })}>
            <SelectTrigger className="text-footnote mt-1 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AGENDA_CATEGORIES.map((cat) => (
                <SelectItem key={cat.value} value={cat.value}>
                  {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </LabeledField>
      </div>

      <LabeledField label="Description">
        <Textarea
          value={item.description}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="What this topic covers"
          rows={2}
          className="text-footnote mt-1"
        />
      </LabeledField>
    </div>
  );
}

function AgendaSection({
  items,
  onChange,
}: {
  items: AgendaItem[];
  onChange: (items: AgendaItem[]) => void;
}) {
  const [newTitle, setNewTitle] = useState("");
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const totalDuration = items.reduce((sum, item) => sum + item.duration, 0);

  const addTopic = () => {
    if (!newTitle.trim()) return;
    onChange([
      ...items,
      {
        title: newTitle.trim(),
        description: "",
        duration: 15,
        category: "governance",
        tags: [],
        presenter: "Ruler",
      },
    ]);
    setNewTitle("");
    setExpandedIndex(items.length);
  };

  const removeTopic = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
    if (expandedIndex === index) setExpandedIndex(null);
  };

  return (
    <div className="space-y-3">
      <Label className={CAPTION}>
        Agenda topics ({items.length} items · {totalDuration} min)
      </Label>

      <div className="space-y-2">
        {items.map((item, index) => {
          const isExpanded = expandedIndex === index;
          const categoryConfig = AGENDA_CATEGORIES.find((c) => c.value === item.category);
          return (
            <div
              key={index}
              className="rounded-control border-separator bg-fill-4 overflow-hidden border transition-[color,background-color,border-color,box-shadow,opacity,transform]"
            >
              <div
                onClick={() => setExpandedIndex(isExpanded ? null : index)}
                className="hover:bg-fill-4 flex cursor-pointer items-center justify-between p-3 select-none"
              >
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <div
                    className={cn(
                      "h-2.5 w-2.5 shrink-0 rounded-full",
                      categoryConfig?.color ?? "bg-fill"
                    )}
                  />
                  <span className="text-label text-caption truncate font-semibold">
                    {item.title}
                  </span>
                  <Badge variant="default" className="tabular-nums">
                    {item.duration}m
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeTopic(index);
                    }}
                    aria-label="Remove agenda item"
                    className="text-label-secondary hover:text-label size-6"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {isExpanded && (
                <AgendaTopicEditor
                  item={item}
                  onChange={(patch) =>
                    onChange(items.map((it, i) => (i === index ? { ...it, ...patch } : it)))
                  }
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-2">
        <Input
          placeholder="New topic, then press Enter"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          className="border-separator bg-fill-4 text-footnote h-8 flex-1"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addTopic();
            }
          }}
        />
        <Button
          type="button"
          size="sm"
          onClick={addTopic}
          aria-label="Add agenda topic"
          title="Add agenda topic"
          className="text-caption h-8 cursor-pointer px-3 font-semibold"
        >
          <Plus aria-hidden="true" className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

interface MeetingRosterPanelProps {
  officials: RosterOfficial[];
  selectedOfficials: string[];
  onOfficialsChange: (ids: string[]) => void;
  officialsLoading: boolean;
  recommendedRoles: string[];
  agendaItems: AgendaItem[];
  onAgendaChange: (items: AgendaItem[]) => void;
}

/** The second card of the scheduler: who is invited and what is on the agenda. */
export function MeetingRosterPanel({
  officials,
  selectedOfficials,
  onOfficialsChange,
  officialsLoading,
  recommendedRoles,
  agendaItems,
  onAgendaChange,
}: MeetingRosterPanelProps) {
  return (
    <div className="bg-surface border-separator animate-in fade-in slide-in-from-right-2 rounded-row shadow-floating flex max-h-[85vh] w-full flex-col overflow-hidden duration-300 md:w-[350px]">
      <div className="border-separator shrink-0 border-b px-5 pt-5 pb-3">
        <h3 className="text-label text-headline flex items-center gap-2">Roster and agenda</h3>
        <p className="text-label-secondary text-footnote mt-0.5">
          {selectedOfficials.length} invited · {agendaItems.length} topics
        </p>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto p-5">
        <AttendeesSection
          officials={officials}
          selected={selectedOfficials}
          onChange={onOfficialsChange}
          loading={officialsLoading}
          recommendedRoles={recommendedRoles}
        />
        <div className="border-separator border-t" />
        <AgendaSection items={agendaItems} onChange={onAgendaChange} />
      </div>
    </div>
  );
}
