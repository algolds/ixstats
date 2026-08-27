"use client";

import React, { useState, useCallback, useRef } from "react";
import {
  Download,
  NavArrowDown as ChevronDown,
  SystemRestart as Loader2,
  Bold,
  Italic,
  TextSize as Heading2,
  TextSize as Heading3,
  Link as Link2,
  List,
  MediaImage as ImageIcon,
  Eye,
  EyeClosed as EyeOff,
  Xmark as X,
  Plus,
  Sparks as Sparkles,
  Search,
} from "iconoir-react";
import dynamic from "next/dynamic";
import remarkGfm from "remark-gfm";

const ReactMarkdown = dynamic(() => import("react-markdown"), { ssr: false });
import { api } from "~/trpc/react";
import type { StoryPinFormData } from "~/hooks/useMapEditor";

const STORY_PIN_CATEGORIES = [
  "battle",
  "founding",
  "treaty",
  "cultural",
  "religious",
  "trade",
  "naval",
  "settlement",
  "government",
  "biography",
  "linguistic",
  "upheaval",
  "natural",
  "exploration",
];

const IMPORTANCE_LEVELS = [
  { value: 0, label: "Normal", desc: "Standard marker" },
  { value: 1, label: "Major", desc: "Glowing marker" },
  { value: 2, label: "Legendary", desc: "Large glowing marker" },
];

const inputClasses =
  "w-full rounded-lg border border-border bg-background px-3 py-2.5 sm:py-1.5 text-base sm:text-sm text-foreground placeholder:text-muted-foreground transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";

const selectClasses =
  "w-full rounded-lg border border-border bg-background px-3 py-2.5 sm:py-1.5 text-base sm:text-sm text-foreground transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";

const btnSmall =
  "flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors";

// ─── Wiki Section Importer ───────────────────────────────────────────────────

function WikiSectionImporter({
  wikiTitle,
  onImport,
}: {
  wikiTitle: string;
  onImport: (content: string) => void;
}) {
  const [showSections, setShowSections] = useState(false);
  const [loadingSection, setLoadingSection] = useState<string | null>(null);

  const { data: sections, isLoading: loadingSections } = api.wikios.getSections.useQuery(
    { title: wikiTitle },
    { enabled: showSections, staleTime: 5 * 60_000 }
  );

  const utils = api.useUtils();

  const handleSelectSection = async (sectionTitle: string) => {
    setLoadingSection(sectionTitle);
    try {
      const result = await utils.wikios.getSectionContent.fetch({
        title: wikiTitle,
        section: sectionTitle,
        source: "ixwiki",
      });
      if (result?.content) {
        onImport(result.content);
      }
    } catch {
      // Silently fail
    } finally {
      setLoadingSection(null);
      setShowSections(false);
    }
  };

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => setShowSections(!showSections)}
        className={`${btnSmall} bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 dark:text-blue-400`}
      >
        <Download className="h-3 w-3" />
        Import Section
        <ChevronDown
          className={`h-3 w-3 transition-transform ${showSections ? "" : "-rotate-90"}`}
        />
      </button>

      {showSections && (
        <div className="border-border bg-background max-h-40 overflow-y-auto rounded-lg border p-1">
          {loadingSections ? (
            <div className="text-muted-foreground flex items-center gap-2 px-2 py-2 text-xs">
              <Loader2 className="h-3 w-3 animate-spin" />
              Loading sections...
            </div>
          ) : sections && Array.isArray(sections) && sections.length > 0 ? (
            sections.map((section: { title: string; level: number }, i: number) => (
              <button
                key={`${section.title}-${i}`}
                type="button"
                onClick={() => handleSelectSection(section.title)}
                disabled={loadingSection !== null}
                className="text-foreground hover:bg-accent flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs transition-colors disabled:opacity-50"
                style={{ paddingLeft: `${(section.level - 1) * 12 + 8}px` }}
              >
                {loadingSection === section.title ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : null}
                {section.title}
              </button>
            ))
          ) : (
            <div className="text-muted-foreground px-2 py-2 text-xs">No sections found</div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Wiki Search Autocomplete ────────────────────────────────────────────────

function WikiSearchInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [query, setQuery] = useState(value ?? "");
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: results } = api.wikios.searchPages.useQuery(
    { query, limit: 6 },
    { enabled: query.length >= 3 && showDropdown, staleTime: 60_000 }
  );

  return (
    <div className="relative">
      <div className="relative">
        <Search className="text-muted-foreground absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Search wiki pages..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowDropdown(true);
            if (!e.target.value) onChange("");
          }}
          onFocus={() => setShowDropdown(true)}
          onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
          className={`${inputClasses} pl-8`}
        />
      </div>
      {showDropdown && results && results.length > 0 && (
        <div className="border-border bg-card absolute z-20 mt-1 w-full rounded-lg border shadow-lg">
          {results.map((r: { title: string }, i: number) => (
            <button
              key={i}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setQuery(r.title);
                onChange(r.title);
                setShowDropdown(false);
              }}
              className="text-foreground hover:bg-accent w-full px-3 py-1.5 text-left text-xs transition-colors first:rounded-t-lg last:rounded-b-lg"
            >
              {r.title}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Markdown Toolbar ────────────────────────────────────────────────────────

function MarkdownToolbar({ onInsert }: { onInsert: (before: string, after?: string) => void }) {
  return (
    <div className="border-border bg-muted/30 flex flex-wrap gap-0.5 rounded-t-lg border border-b-0 px-1.5 py-1">
      <button
        type="button"
        onClick={() => onInsert("**", "**")}
        className="hover:bg-accent rounded p-1"
        title="Bold"
      >
        <Bold className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => onInsert("*", "*")}
        className="hover:bg-accent rounded p-1"
        title="Italic"
      >
        <Italic className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => onInsert("\n## ")}
        className="hover:bg-accent rounded p-1"
        title="Heading 2"
      >
        <Heading2 className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => onInsert("\n### ")}
        className="hover:bg-accent rounded p-1"
        title="Heading 3"
      >
        <Heading3 className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => onInsert("[", "](url)")}
        className="hover:bg-accent rounded p-1"
        title="Link"
      >
        <Link2 className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => onInsert("\n- ")}
        className="hover:bg-accent rounded p-1"
        title="List"
      >
        <List className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => onInsert("![alt](", ")")}
        className="hover:bg-accent rounded p-1"
        title="Image"
      >
        <ImageIcon className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ─── Image Management ────────────────────────────────────────────────────────

function ImageManager({
  photos,
  onChange,
}: {
  photos: string[];
  onChange: (photos: string[]) => void;
}) {
  const [newUrl, setNewUrl] = useState("");

  const addUrl = () => {
    const url = newUrl.trim();
    if (!url || photos.length >= 10) return;
    try {
      new URL(url); // validate
      onChange([...photos, url]);
      setNewUrl("");
    } catch {
      // invalid URL
    }
  };

  return (
    <div className="space-y-2">
      <label className="text-muted-foreground text-[11px] font-medium tracking-wider uppercase">
        Images ({photos.length}/10)
      </label>
      {photos.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {photos.map((url, i) => (
            <div
              key={i}
              className="group border-border relative h-14 w-14 overflow-hidden rounded-md border"
            >
              <img src={url} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => onChange(photos.filter((_, j) => j !== i))}
                className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100"
              >
                <X className="h-3.5 w-3.5 text-white" />
              </button>
            </div>
          ))}
        </div>
      )}
      {photos.length < 10 && (
        <div className="flex gap-1.5">
          <input
            type="url"
            placeholder="Image URL..."
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addUrl())}
            className={`${inputClasses} flex-1`}
          />
          <button
            type="button"
            onClick={addUrl}
            disabled={!newUrl.trim()}
            className="bg-primary text-primary-foreground shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-medium disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Storyline Selector ──────────────────────────────────────────────────────

function StorylineSelector({
  countryId,
  value,
  order,
  onChangeId,
  onChangeOrder,
}: {
  countryId: string;
  value?: string;
  order?: number;
  onChangeId: (id: string | undefined) => void;
  onChangeOrder: (order: number | undefined) => void;
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  const { data: storylines } = api.geoFeatures.getStorylinesByCountry.useQuery(
    { countryId },
    { staleTime: 60_000, enabled: !!countryId }
  );

  const utils = api.useUtils();
  const createStoryline = api.geoFeatures.createStoryline.useMutation({
    onSuccess: (created) => {
      onChangeId(created.id);
      setShowCreate(false);
      setNewTitle("");
      utils.geoFeatures.getStorylinesByCountry.invalidate({ countryId });
    },
  });

  return (
    <div className="space-y-1.5">
      <label className="text-muted-foreground text-[11px] font-medium tracking-wider uppercase">
        Storyline
      </label>
      <select
        value={value ?? ""}
        onChange={(e) => onChangeId(e.target.value || undefined)}
        className={selectClasses}
      >
        <option value="">None (standalone)</option>
        {storylines?.map((sl) => (
          <option key={sl.id} value={sl.id}>
            {sl.title} ({sl._count.pins} pins)
          </option>
        ))}
      </select>
      {!showCreate ? (
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className={`${btnSmall} bg-indigo-500/10 text-indigo-600 hover:bg-indigo-500/20`}
        >
          <Plus className="h-3 w-3" />
          New Storyline
        </button>
      ) : (
        <div className="flex gap-1.5">
          <input
            type="text"
            placeholder="Storyline title..."
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className={`${inputClasses} flex-1`}
            autoFocus
          />
          <button
            type="button"
            onClick={() => {
              if (newTitle.trim()) {
                createStoryline.mutate({ countryId, title: newTitle.trim() });
              }
            }}
            disabled={!newTitle.trim() || createStoryline.isPending}
            className="shrink-0 rounded-lg bg-indigo-600 px-2.5 py-1.5 text-xs font-medium text-white disabled:opacity-50"
          >
            {createStoryline.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Create"}
          </button>
          <button
            type="button"
            onClick={() => {
              setShowCreate(false);
              setNewTitle("");
            }}
            className="bg-muted shrink-0 rounded-lg px-2 py-1.5 text-xs"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
      {value && (
        <input
          type="number"
          placeholder="Order in storyline"
          value={order ?? ""}
          onChange={(e) => onChangeOrder(e.target.value ? parseInt(e.target.value, 10) : undefined)}
          className={inputClasses}
        />
      )}
    </div>
  );
}

// ─── Auto-Populate from Wiki ─────────────────────────────────────────────────

function WikiAutoPopulate({
  wikiTitle,
  onPopulate,
}: {
  wikiTitle: string;
  onPopulate: (data: { content?: string; thumbnailUrl?: string; photos?: string[] }) => void;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const utils = api.useUtils();

  const handlePopulate = async () => {
    setIsLoading(true);
    try {
      const [intro, images] = await Promise.all([
        utils.wiki.getIntro.fetch({ title: wikiTitle }),
        utils.wiki.getPageImages.fetch({ title: wikiTitle } as any),
      ]);

      const result: { content?: string; thumbnailUrl?: string; photos?: string[] } = {};
      if (intro) {
        result.content = typeof intro === "string" ? intro : intro.intro || intro.text || "";
      }
      if (images && images.length > 0) {
        result.thumbnailUrl = (images[0] as any)?.thumbUrl || (images[0] as any)?.url;
        result.photos = images.slice(0, 6).map((img: any) => img.url);
      }
      onPopulate(result);
    } catch {
      // Best effort
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handlePopulate}
      disabled={isLoading}
      className={`${btnSmall} bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 dark:text-amber-400`}
    >
      {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
      Auto-populate from wiki
    </button>
  );
}

import { MapPin } from "iconoir-react";

// ─── Main Form ───────────────────────────────────────────────────────────────

interface StoryPinPropertyFormProps {
  form: StoryPinFormData;
  onChange: (form: StoryPinFormData) => void;
  countryId?: string;
  pendingCoordinates?: [number, number] | null;
  isPickingLocation?: boolean;
  setIsPickingLocation?: (active: boolean) => void;
}

export const StoryPinPropertyForm = React.memo(function StoryPinPropertyForm({
  form,
  onChange,
  countryId,
  pendingCoordinates,
  isPickingLocation = false,
  setIsPickingLocation,
}: StoryPinPropertyFormProps) {
  const activeCoords = form.coordinates ?? pendingCoordinates;
  const [showPreview, setShowPreview] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isMarkdown = form.contentFormat === "markdown";
  const photos = form.photos ?? [];

  // Insert markdown syntax at cursor position
  const insertMarkdown = useCallback(
    (before: string, after?: string) => {
      const ta = textareaRef.current;
      if (!ta) return;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const text = form.content;
      const selected = text.substring(start, end);
      const newText =
        text.substring(0, start) + before + selected + (after ?? "") + text.substring(end);
      onChange({ ...form, content: newText });
      // Restore cursor
      requestAnimationFrame(() => {
        ta.focus();
        const newPos = start + before.length + selected.length + (after?.length ?? 0);
        ta.setSelectionRange(newPos, newPos);
      });
    },
    [form, onChange]
  );

  return (
    <div className="space-y-3">
      {/* Title */}
      <input
        type="text"
        placeholder="Title"
        value={form.title}
        onChange={(e) => onChange({ ...form, title: e.target.value })}
        className={inputClasses}
        autoFocus
      />

      {/* Coordinate Picker Block */}
      {countryId && (
        <div className="border-border/60 bg-muted/20 flex items-center justify-between rounded-lg border px-3 py-2 text-xs">
          <div className="text-muted-foreground text-left font-medium">
            Coordinates:{" "}
            {activeCoords ? (
              <span className="text-foreground font-semibold tabular-nums">
                {activeCoords[1].toFixed(4)}&deg; N, {activeCoords[0].toFixed(4)}&deg; E
              </span>
            ) : (
              <span className="italic">Not placed yet</span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setIsPickingLocation?.(!isPickingLocation)}
            className={`flex shrink-0 items-center gap-1 font-semibold transition-colors focus:outline-none ${
              isPickingLocation
                ? "animate-pulse font-bold text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300"
                : "text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
            }`}
          >
            <MapPin className="h-3.5 w-3.5" />
            <span>{isPickingLocation ? "Click on Map..." : "Pick on Map"}</span>
          </button>
        </div>
      )}

      {/* Category + Importance row */}
      <div className="grid grid-cols-2 gap-2">
        <select
          value={form.category}
          onChange={(e) => onChange({ ...form, category: e.target.value })}
          className={selectClasses}
        >
          {STORY_PIN_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c.charAt(0).toUpperCase() + c.slice(1)}
            </option>
          ))}
        </select>
        <select
          value={form.importance}
          onChange={(e) => onChange({ ...form, importance: parseInt(e.target.value, 10) })}
          className={selectClasses}
        >
          {IMPORTANCE_LEVELS.map((level) => (
            <option key={level.value} value={level.value}>
              {level.label}
            </option>
          ))}
        </select>
      </div>

      {/* Timeline row */}
      <div className="grid grid-cols-2 gap-2">
        <input
          type="number"
          placeholder="IxTime Year"
          value={form.ixTimeYear ?? ""}
          onChange={(e) =>
            onChange({
              ...form,
              ixTimeYear: e.target.value ? parseInt(e.target.value, 10) : undefined,
            })
          }
          className={inputClasses}
        />
        <input
          type="text"
          placeholder="Era Label"
          value={form.eraLabel ?? ""}
          onChange={(e) => onChange({ ...form, eraLabel: e.target.value || undefined })}
          className={inputClasses}
        />
      </div>

      {/* Content format toggle + editor */}
      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="text-muted-foreground text-[11px] font-medium tracking-wider uppercase">
            Content
          </label>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowPreview(!showPreview)}
              className={`${btnSmall} ${showPreview ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground hover:text-foreground"}`}
            >
              {showPreview ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              {showPreview ? "Edit" : "Preview"}
            </button>
            <button
              type="button"
              onClick={() =>
                onChange({ ...form, contentFormat: isMarkdown ? "plain" : "markdown" })
              }
              className={`${btnSmall} ${isMarkdown ? "bg-purple-500/10 text-purple-600" : "bg-muted text-muted-foreground hover:text-foreground"}`}
            >
              {isMarkdown ? "Markdown" : "Plain Text"}
            </button>
          </div>
        </div>

        {showPreview ? (
          <div className="border-border bg-background prose prose-sm dark:prose-invert min-h-[100px] max-w-none rounded-lg border p-3">
            {isMarkdown ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {form.content || "*No content yet*"}
              </ReactMarkdown>
            ) : (
              form.content.split("\n\n").map((para, i) => (
                <p key={i} className="text-sm">
                  {para}
                </p>
              ))
            )}
          </div>
        ) : (
          <div>
            {isMarkdown && <MarkdownToolbar onInsert={insertMarkdown} />}
            <textarea
              ref={textareaRef}
              placeholder={isMarkdown ? "Write in markdown..." : "Content"}
              value={form.content}
              onChange={(e) => onChange({ ...form, content: e.target.value })}
              rows={6}
              maxLength={15000}
              className={`${inputClasses} ${isMarkdown ? "rounded-t-none border-t-0 font-mono text-xs" : ""}`}
            />
          </div>
        )}
        <div className="text-muted-foreground text-right text-[10px]">
          {form.content.length}/15000
        </div>
      </div>

      {/* Wiki integration */}
      <div className="space-y-1.5">
        <label className="text-muted-foreground text-[11px] font-medium tracking-wider uppercase">
          Wiki Page Link
        </label>
        <WikiSearchInput
          value={form.wikiPageTitle ?? ""}
          onChange={(val) => onChange({ ...form, wikiPageTitle: val || undefined })}
        />
        {form.wikiPageTitle && (
          <div className="flex flex-wrap gap-1.5">
            <WikiSectionImporter
              wikiTitle={form.wikiPageTitle}
              onImport={(content) => onChange({ ...form, content })}
            />
            <WikiAutoPopulate
              wikiTitle={form.wikiPageTitle}
              onPopulate={(data) => {
                onChange({
                  ...form,
                  ...(data.content && !form.content ? { content: data.content } : {}),
                  ...(data.thumbnailUrl ? { thumbnailUrl: data.thumbnailUrl } : {}),
                  ...(data.photos ? { photos: data.photos } : {}),
                });
              }}
            />
          </div>
        )}
      </div>

      {/* Image management */}
      <ImageManager
        photos={photos}
        onChange={(newPhotos) =>
          onChange({
            ...form,
            photos: newPhotos,
            thumbnailUrl: newPhotos.length > 0 ? newPhotos[0] : form.thumbnailUrl,
          })
        }
      />

      {/* Storyline */}
      {countryId && (
        <StorylineSelector
          countryId={countryId}
          value={form.storylineId}
          order={form.storylineOrder}
          onChangeId={(id) => onChange({ ...form, storylineId: id })}
          onChangeOrder={(order) => onChange({ ...form, storylineOrder: order })}
        />
      )}
    </div>
  );
});
