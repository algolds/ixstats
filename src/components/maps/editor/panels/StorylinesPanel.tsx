"use client";

import React, { useMemo, useState } from "react";
import { Bookmark } from "iconoir-react";
import { api, type RouterOutputs } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
import { Skeleton } from "~/components/ui/skeleton";
import { OptionSelect } from "~/components/maps/shared/OptionSelect";
import { StorylineTimeline } from "~/components/maps/core/components/StorylineTimeline";
import { useNotify } from "~/hooks/useNotify";
import { STORY_CATEGORIES, type StoryCategory } from "~/hooks/map-editor/history-coercion";
import type { EditorFeature } from "~/hooks/map-editor/editor-types";
import { capitalizedOptions } from "../optionLists";
import { Field, inputClasses } from "../properties/fields";
import { nextStorylineOrder, storyPlaceOptions } from "./storyline-helpers";

const CATEGORY_OPTIONS = capitalizedOptions(STORY_CATEGORIES);
const DEFAULT_COLOR = "#3b82f6";

interface StorylinesPanelProps {
  countryId: string;
  features: readonly EditorFeature[];
  /** Selects a story pin on the editor map (timeline rows). */
  onFocusFeature?: (featureId: string) => void;
}

type Storyline = RouterOutputs["geoFeatures"]["getCountryStorylines"]["storylines"][number];

/**
 * Map editor Stories tab (AT-14): create storylines, add the country's story pins to them (or
 * write a new event at one of its places), and preview the timeline the map's story pin modal
 * shows once a storyline has two or more pins.
 */
export function StorylinesPanel({ countryId, features, onFocusFeature }: StorylinesPanelProps) {
  const notify = useNotify();
  const utils = api.useUtils();
  const { data, isLoading } = api.geoFeatures.getCountryStorylines.useQuery(
    { countryId },
    { enabled: !!countryId }
  );
  const [title, setTitle] = useState("");
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [openId, setOpenId] = useState<string | null>(null);

  const refresh = async () => {
    await Promise.all([
      utils.geoFeatures.getCountryStorylines.invalidate({ countryId }),
      utils.geoCore.getCountryFeatures.invalidate({ countryId }),
    ]);
  };
  const onError = (e: { message?: string }) => notify.error("Storyline not saved", e?.message);
  const create = api.geoFeatures.createStoryline.useMutation({
    onSuccess: async (res) => {
      setTitle("");
      setOpenId(res.id);
      await refresh();
    },
    onError,
  });

  const storylines = data?.storylines ?? [];

  return (
    <div className="space-y-3 px-3 py-3">
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (title.trim()) create.mutate({ countryId, title: title.trim(), color });
        }}
      >
        <Field label="New storyline">
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="e.g. The Founding Wars"
              value={title}
              maxLength={200}
              onChange={(e) => setTitle(e.target.value)}
              className={inputClasses}
            />
            <input
              type="color"
              aria-label="Storyline colour"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="border-separator rounded-control h-9 w-10 shrink-0 cursor-pointer border"
            />
          </div>
        </Field>
        <Button type="submit" size="sm" disabled={!title.trim() || create.isPending}>
          Create storyline
        </Button>
      </form>

      {isLoading ? (
        <div className="space-y-2" aria-busy="true">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : storylines.length === 0 ? (
        <EmptyState
          compact
          icon={<Bookmark />}
          title="No storylines yet."
          message="A storyline links story pins in order. The map shows its timeline when a pin in it is opened."
        />
      ) : (
        <ul className="space-y-2">
          {storylines.map((s) => (
            <li key={s.id}>
              <StorylineCard
                storyline={s}
                countryId={countryId}
                open={openId === s.id}
                onToggle={() => setOpenId((cur) => (cur === s.id ? null : s.id))}
                unassignedPins={data?.unassignedPins ?? []}
                features={features}
                onFocusFeature={onFocusFeature}
                refresh={refresh}
                onError={onError}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StorylineCard({
  storyline,
  countryId,
  open,
  onToggle,
  unassignedPins,
  features,
  onFocusFeature,
  refresh,
  onError,
}: {
  storyline: Storyline;
  countryId: string;
  open: boolean;
  onToggle: () => void;
  unassignedPins: ReadonlyArray<{ id: string; title: string; ixTimeYear: number | null }>;
  features: readonly EditorFeature[];
  onFocusFeature?: (featureId: string) => void;
  refresh: () => Promise<void>;
  onError: (e: { message?: string }) => void;
}) {
  const [pinToAdd, setPinToAdd] = useState("");
  const addPin = api.geoFeatures.addPinToStoryline.useMutation({
    onSuccess: async () => {
      setPinToAdd("");
      await refresh();
    },
    onError,
  });
  const removePin = api.geoFeatures.removePinFromStoryline.useMutation({
    onSuccess: refresh,
    onError,
  });
  const remove = api.geoFeatures.deleteStoryline.useMutation({ onSuccess: refresh, onError });
  const count = storyline.pins.length;

  return (
    <Card className="rounded-card p-3">
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="size-3 shrink-0 rounded-full"
          // Storyline colour is authored map data.
          style={{ backgroundColor: storyline.color ?? DEFAULT_COLOR }}
        />
        <button
          type="button"
          aria-expanded={open}
          onClick={onToggle}
          className="text-body text-label min-w-0 flex-1 truncate text-left font-semibold"
        >
          {storyline.title}
        </button>
        <span className="text-caption text-label-secondary shrink-0">
          {count} {count === 1 ? "pin" : "pins"}
        </span>
      </div>

      {open ? (
        <div className="mt-3 space-y-3">
          {count > 0 ? (
            <StorylineTimeline
              pins={storyline.pins}
              currentPinId={storyline.pins[0]!.id}
              storylineTitle={storyline.title}
              storylineColor={storyline.color}
              onNavigate={onFocusFeature}
            />
          ) : null}
          {count === 1 ? (
            <p className="text-footnote text-label-secondary">
              Add one more pin and the timeline appears on the map.
            </p>
          ) : null}

          {count > 0 ? (
            <ul className="space-y-1" aria-label="Pins in this storyline">
              {storyline.pins.map((p) => (
                <li key={p.id} className="text-footnote flex items-center gap-2">
                  <span className="text-label min-w-0 flex-1 truncate">{p.title}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    disabled={removePin.isPending}
                    onClick={() => removePin.mutate({ countryId, pinId: p.id })}
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}

          {unassignedPins.length > 0 ? (
            <div className="flex items-end gap-2">
              <div className="min-w-0 flex-1">
                <Field label="Add a story pin">
                  <OptionSelect
                    aria-label="Story pin to add"
                    size="sm"
                    value={pinToAdd}
                    placeholder="Choose a pin"
                    onValueChange={setPinToAdd}
                    options={unassignedPins.map((p) => ({
                      value: p.id,
                      label: p.ixTimeYear != null ? `${p.title} (${p.ixTimeYear})` : p.title,
                    }))}
                  />
                </Field>
              </div>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={!pinToAdd || addPin.isPending}
                onClick={() =>
                  addPin.mutate({ countryId, storylineId: storyline.id, pinId: pinToAdd })
                }
              >
                Add
              </Button>
            </div>
          ) : null}

          <NewEventForm
            countryId={countryId}
            storyline={storyline}
            features={features}
            refresh={refresh}
            onError={onError}
          />

          <Button
            type="button"
            variant="ghost"
            size="xs"
            disabled={remove.isPending}
            onClick={() => {
              if (window.confirm(`Delete "${storyline.title}"? Its pins stay on the map.`)) {
                remove.mutate({ countryId, storylineId: storyline.id });
              }
            }}
          >
            Delete storyline
          </Button>
        </div>
      ) : null}
    </Card>
  );
}

/** Writes a new story pin straight into the storyline, at one of the country's places. */
function NewEventForm({
  countryId,
  storyline,
  features,
  refresh,
  onError,
}: {
  countryId: string;
  storyline: Storyline;
  features: readonly EditorFeature[];
  refresh: () => Promise<void>;
  onError: (e: { message?: string }) => void;
}) {
  const places = useMemo(() => storyPlaceOptions(features), [features]);
  const [eventTitle, setEventTitle] = useState("");
  const [year, setYear] = useState("");
  const [category, setCategory] = useState<StoryCategory>("founding");
  const [placeId, setPlaceId] = useState("");
  const [content, setContent] = useState("");
  const createPin = api.geoFeatures.createStoryPin.useMutation({
    onSuccess: async () => {
      setEventTitle("");
      setYear("");
      setContent("");
      await refresh();
    },
    onError,
  });

  if (places.length === 0) {
    return (
      <p className="text-footnote text-label-secondary">
        Place a city or point of interest first: new events are pinned at one of your places.
      </p>
    );
  }
  const place = places.find((p) => p.value === placeId);
  const parsedYear = year.trim() === "" ? undefined : Number.parseInt(year, 10);
  const canSubmit = !!eventTitle.trim() && !!content.trim() && !!place && !createPin.isPending;

  return (
    <form
      className="border-separator space-y-2 border-t pt-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!canSubmit || !place) return;
        createPin.mutate({
          countryId,
          title: eventTitle.trim(),
          content: content.trim(),
          category,
          coordinates: place.coordinates,
          ixTimeYear: Number.isFinite(parsedYear) ? parsedYear : undefined,
          storylineId: storyline.id,
          storylineOrder: nextStorylineOrder(storyline.pins),
        });
      }}
    >
      <p className="text-caption text-label-secondary font-semibold">New event</p>
      <input
        type="text"
        placeholder="Event title"
        value={eventTitle}
        maxLength={200}
        onChange={(e) => setEventTitle(e.target.value)}
        className={inputClasses}
      />
      <div className="grid grid-cols-2 gap-2">
        <Field label="IxTime year">
          <input
            type="number"
            placeholder="e.g. 1420"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className={inputClasses}
          />
        </Field>
        <Field label="Category">
          <OptionSelect
            aria-label="Event category"
            size="sm"
            value={category}
            onValueChange={(v) => setCategory(v as StoryCategory)}
            options={CATEGORY_OPTIONS}
          />
        </Field>
      </div>
      <Field label="Where">
        <OptionSelect
          aria-label="Event location"
          size="sm"
          value={placeId}
          placeholder="Choose a place"
          onValueChange={setPlaceId}
          options={places.map(({ value, label }) => ({ value, label }))}
        />
      </Field>
      <textarea
        placeholder="What happened"
        value={content}
        maxLength={15000}
        onChange={(e) => setContent(e.target.value)}
        rows={3}
        className={inputClasses}
      />
      <Button type="submit" size="sm" variant="secondary" disabled={!canSubmit}>
        Add event
      </Button>
    </form>
  );
}
