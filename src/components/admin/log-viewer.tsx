"use client";

/**
 * jalco-ui
 * LogViewer
 * by Justin Levine
 * ui.justinlevine.me
 *
 * Scrollable log output component for displaying streaming logs or CLI-style
 * output in web apps. Supports colored log levels, timestamps, line numbers,
 * auto-scrolling, and search.
 *
 * Exports:
 * - LogViewerTerminal — full CLI-style interface with toolbar, line numbers, and timestamps
 * - LogViewerMinimal — simple scrolling log lines for compact contexts
 * - LogViewerFilterable — includes level filtering (info/warn/error/debug)
 *
 * Dependencies: iconoir-react
 */

import * as React from "react";
import {
  ArrowDown,
  Check,
  Circle,
  Copy,
  Download,
  Filter,
  Search,
  Trash as Trash2,
  Xmark as X,
} from "iconoir-react";
import { cn } from "~/lib/utils/cn";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { ActionPill, type ActionPillTone } from "~/components/ui/action-pill";

// Types

export type LogLevel = "info" | "warn" | "error" | "debug" | "verbose";

export interface LogEntry {
  /** Log level. */
  level: LogLevel;
  /** Log message text. */
  message: string;
  /** ISO timestamp string. When omitted, the current time is used for display. */
  timestamp?: string;
}

/** Per-level color classes. Each key is optional — omitted levels use defaults. */
type LevelColors = {
  /** CSS class for the level label text (e.g. "text-red"). */
  text: string;
  /** CSS class for the colored dot (e.g. "bg-red"). */
  dot: string;
  /** CSS class for the filter badge when active (e.g. "bg-red/15 text-red"). */
  badge: string;
};

/** Partial map of log levels to custom color classes. */
type LevelColorScale = Partial<Record<LogLevel, Partial<LevelColors>>>;

// Default colors

const DEFAULT_LEVEL_COLORS: Record<LogLevel, LevelColors> = {
  error: {
    text: "text-red",
    dot: "bg-red",
    badge: "bg-red/15 text-red",
  },
  warn: {
    text: "text-yellow",
    dot: "bg-yellow",
    badge: "bg-yellow/15 text-yellow",
  },
  info: {
    text: "text-blue",
    dot: "bg-blue",
    badge: "bg-blue/15 text-blue",
  },
  debug: {
    text: "text-purple",
    dot: "bg-purple",
    badge: "bg-purple/15 text-purple",
  },
  verbose: {
    text: "text-label-secondary",
    dot: "bg-fill",
    badge: "bg-fill-3 text-label-secondary",
  },
};

/** Pressed-filter tone per level (the system colour behind each default `badge`). */
const LEVEL_TONES: Record<LogLevel, ActionPillTone> = {
  error: "destructive",
  warn: "warning",
  info: "info",
  debug: "secondary",
  verbose: "secondary",
};

const LEVEL_LABELS: Record<LogLevel, string> = {
  error: "ERR",
  warn: "WRN",
  info: "INF",
  debug: "DBG",
  verbose: "VRB",
};

function resolveLevelColors(level: LogLevel, colorScale?: LevelColorScale): LevelColors {
  const defaults = DEFAULT_LEVEL_COLORS[level];
  const overrides = colorScale?.[level];
  if (!overrides) return defaults;
  return {
    text: overrides.text ?? defaults.text,
    dot: overrides.dot ?? defaults.dot,
    badge: overrides.badge ?? defaults.badge,
  };
}

// Utilities

function formatTimestamp(ts?: string): string {
  const d = ts ? new Date(ts) : new Date();
  return d.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatTimestampFull(ts?: string): string {
  const d = ts ? new Date(ts) : new Date();
  const ms = d.getMilliseconds().toString().padStart(3, "0");
  return `${d.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })}.${ms}`;
}

function useCopy() {
  const [copied, setCopied] = React.useState(false);

  const copy = React.useCallback(async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API unavailable in insecure contexts
    }
  }, []);

  return { copied, copy };
}

function useAutoScroll(entries: LogEntry[], enabled: boolean) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = React.useState(true);

  React.useEffect(() => {
    if (!enabled || !isAtBottom) return;
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
    // oxlint-disable-next-line
  }, [entries.length, enabled, isAtBottom]);

  const handleScroll = React.useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const threshold = 40;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
    setIsAtBottom(atBottom);
  }, []);

  const scrollToBottom = React.useCallback(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
      setIsAtBottom(true);
    }
  }, []);

  return { scrollRef, isAtBottom, handleScroll, scrollToBottom };
}

function exportLogs(entries: LogEntry[]): void {
  const text = entries
    .map((e) => `[${formatTimestampFull(e.timestamp)}] [${LEVEL_LABELS[e.level]}] ${e.message}`)
    .join("\n");
  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `logs-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

function highlightSearch(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"));
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <mark key={i} className="rounded-control-sm bg-yellow/40 px-0.5 text-inherit">
        {part}
      </mark>
    ) : (
      part
    )
  );
}

// Small Toolbar Button

function ToolbarButton({
  onClick,
  label,
  active,
  children,
  className,
}: {
  onClick: () => void;
  label: string;
  active?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      onClick={onClick}
      aria-label={label}
      className={cn(
        "text-label-secondary hover:text-label size-7",
        active && "bg-fill-3 text-label",
        className
      )}
    >
      {children}
    </Button>
  );
}

// LogViewerFilterable

interface LogViewerFilterableProps extends Omit<React.ComponentProps<"div">, "children" | "title"> {
  /** Log entries to display. */
  entries: LogEntry[];
  /** Title shown in the header. @default "Logs" */
  title?: string;
  /** Maximum visible height in pixels. @default 400 */
  maxHeight?: number;
  /** Show timestamps. @default true */
  timestamps?: boolean;
  /** Enable auto-scroll to bottom on new entries. @default true */
  autoScroll?: boolean;
  /** Levels shown in the filter bar. @default ["error", "warn", "info", "debug"] */
  levels?: LogLevel[];
  /** Custom colors per log level. Merges with defaults — only override what you need. */
  colorScale?: LevelColorScale;
  /** Called when the user clicks "Clear". When provided, a clear button appears. */
  onClear?: () => void;
}

function LogViewerFilterable({
  entries,
  title = "Logs",
  maxHeight = 400,
  timestamps = true,
  autoScroll = true,
  levels = ["error", "warn", "info", "debug"],
  colorScale,
  onClear,
  className,
  ...props
}: LogViewerFilterableProps) {
  const [activeLevels, setActiveLevels] = React.useState<Set<LogLevel>>(() => new Set(levels));
  const [searchQuery, setSearchQuery] = React.useState("");
  const { copied, copy } = useCopy();
  const { scrollRef, isAtBottom, handleScroll, scrollToBottom } = useAutoScroll(
    entries,
    autoScroll
  );

  function toggleLevel(level: LogLevel) {
    setActiveLevels((prev) => {
      const next = new Set(prev);
      if (next.has(level)) {
        next.delete(level);
      } else {
        next.add(level);
      }
      return next;
    });
  }

  const filteredEntries = entries.filter((e) => {
    if (!activeLevels.has(e.level)) return false;
    if (searchQuery && !e.message.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const levelCounts = React.useMemo(() => {
    const counts: Partial<Record<LogLevel, number>> = {};
    for (const entry of entries) {
      counts[entry.level] = (counts[entry.level] ?? 0) + 1;
    }
    return counts;
  }, [entries]);

  function handleCopyFiltered() {
    const text = filteredEntries
      .map((e) => `[${formatTimestampFull(e.timestamp)}] [${LEVEL_LABELS[e.level]}] ${e.message}`)
      .join("\n");
    copy(text);
  }

  return (
    <div
      data-slot="log-viewer-filterable"
      className={cn(
        "border-separator bg-surface rounded-row flex flex-col overflow-hidden border",
        className
      )}
      {...props}
    >
      <div className="border-separator bg-fill-4 flex items-center gap-2 border-b px-3 py-2">
        <Filter className="text-label-secondary size-3.5 shrink-0" />
        <span className="text-label text-body flex-1 truncate font-medium">{title}</span>

        <span className="text-label-secondary text-footnote mr-1 tabular-nums">
          {filteredEntries.length} / {entries.length}
        </span>

        <div className="flex items-center gap-0.5">
          <ToolbarButton
            onClick={handleCopyFiltered}
            label={copied ? "Copied" : "Copy filtered logs"}
          >
            {copied ? <Check className="text-green size-3.5" /> : <Copy className="size-3.5" />}
          </ToolbarButton>

          <ToolbarButton onClick={() => exportLogs(filteredEntries)} label="Download logs">
            <Download className="size-3.5" />
          </ToolbarButton>

          {onClear && (
            <ToolbarButton onClick={onClear} label="Clear logs">
              <Trash2 className="size-3.5" />
            </ToolbarButton>
          )}
        </div>
      </div>

      <div className="border-separator bg-fill-4 flex flex-wrap items-center gap-2 border-b px-3 py-2">
        <div role="group" aria-label="Log levels" className="flex items-center gap-1">
          {levels.map((level) => {
            const customBadge = colorScale?.[level]?.badge;
            const isActive = activeLevels.has(level);
            const count = levelCounts[level] ?? 0;
            // Pressed pills take the level's system colour (or a caller's `colorScale` badge).
            return (
              <ActionPill
                key={level}
                pressed={isActive}
                tone={LEVEL_TONES[level]}
                onClick={() => toggleLevel(level)}
                aria-label={`${level} logs`}
                title={`${isActive ? "Hide" : "Show"} ${level} logs`}
                icon={<Circle className="size-1.5 fill-current" />}
                count={count > 0 ? count : null}
                className={cn(
                  isActive ? customBadge : "bg-fill-3 text-label-tertiary line-through"
                )}
              >
                {LEVEL_LABELS[level]}
              </ActionPill>
            );
          })}
        </div>

        <div className="border-separator bg-background rounded-control-sm ml-auto flex items-center gap-2 border px-2 py-1">
          <Search className="text-label-secondary size-3" />
          <Input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter…"
            className="w-24 sm:w-32"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon-sm"
              type="button"
              onClick={() => setSearchQuery("")}

              aria-label="Clear search"
            >
              <X className="size-3" />
            </Button>
          )}
        </div>
      </div>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="text-footnote [scrollbar-width:thin] overflow-auto font-mono leading-relaxed"
        style={{ maxHeight }}
        role="log"
        aria-live="polite"
        aria-label={title}
      >
        {filteredEntries.length === 0 ? (
          <div className="text-label-secondary text-body flex flex-col items-center justify-center gap-1 py-10">
            <span>No matching log entries.</span>
            {(searchQuery || activeLevels.size < levels.length) && (
              <Button
                type="button"
                variant="link"
                size="sm"
                onClick={() => {
                  setSearchQuery("");
                  setActiveLevels(new Set(levels));
                }}
                className="text-label-secondary hover:text-label h-auto px-0"
              >
                Reset filters
              </Button>
            )}
          </div>
        ) : (
          filteredEntries.map((entry, i) => {
            const colors = resolveLevelColors(entry.level, colorScale);
            return (
              <div
                key={i}
                className="border-separator hover:bg-fill-4 flex items-start gap-3 border-b px-3 py-2 transition-colors"
              >
                <Circle
                  className={cn("mt-[5px] size-2 shrink-0 fill-current", colors.text)}
                  aria-hidden="true"
                />
                {timestamps && (
                  <span className="text-label-secondary shrink-0">
                    {formatTimestamp(entry.timestamp)}
                  </span>
                )}
                <span className={cn("w-[3ch] shrink-0 text-right font-semibold", colors.text)}>
                  {LEVEL_LABELS[entry.level]}
                </span>
                <span className="text-label min-w-0 flex-1 break-all whitespace-pre-wrap">
                  {highlightSearch(entry.message, searchQuery)}
                </span>
              </div>
            );
          })
        )}
      </div>

      {!isAtBottom && (
        <Button
          variant="ghost"
          onClick={scrollToBottom}
          className="border-separator bg-fill-4 text-label-secondary hover:text-label text-caption h-auto w-full gap-2 rounded-none border-t py-2 font-normal"
          aria-label="Scroll to latest"
        >
          <ArrowDown className="size-3" />
          New logs below
        </Button>
      )}
    </div>
  );
}

export { LogViewerFilterable };
