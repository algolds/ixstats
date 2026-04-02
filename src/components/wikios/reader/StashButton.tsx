// src/components/wikios/reader/StashButton.tsx
// Lore Stash button — one-click save with color-coded stash popover.
// Glass physics animated with shine, pulse, ripple, and color-shift.

"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import {
  Bookmark, BookmarkCheck, Check, Plus, X,
  ChevronRight, AlertCircle, Loader2,
} from "lucide-react";
import Link from "next/link";
import { withBasePath } from "~/lib/base-path";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";

const PRESET_COLORS = [
  "#3b82f6", "#8b5cf6", "#ec4899", "#ef4444",
  "#f97316", "#eab308", "#22c55e", "#06b6d4",
];

interface StashButtonProps {
  title: string;
  isAuthenticated: boolean;
}

export function StashButton({ title, isAuthenticated }: StashButtonProps) {
  const [animState, setAnimState] = useState<"idle" | "pulse" | "ripple" | "color-shift">("idle");
  const [showPopover, setShowPopover] = useState(false);
  const [showManager, setShowManager] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const hoverTimeout = useRef<NodeJS.Timeout | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const showFeedback = useCallback((type: "success" | "error", text: string) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 2000);
  }, []);

  const utils = api.useUtils();

  // Queries
  const stashQuery = api.wikios.isStashed.useQuery(
    { pageTitle: title },
    { enabled: isAuthenticated, retry: false }
  );
  const stashesQuery = api.wikios.getStashes.useQuery(
    undefined,
    { enabled: isAuthenticated, staleTime: 30000 }
  );

  // Mutations with proper invalidation + feedback
  const stashMutation = api.wikios.stashPage.useMutation({
    onSuccess: () => {
      utils.wikios.isStashed.invalidate({ pageTitle: title });
      utils.wikios.getStashes.invalidate();
      setAnimState("ripple");
      setTimeout(() => setAnimState("color-shift"), 600);
      setTimeout(() => setAnimState("idle"), 1000);
      showFeedback("success", "Stashed!");
    },
    onError: (err) => showFeedback("error", err.message ?? "Failed to stash"),
  });

  const unstashMutation = api.wikios.unstashPage.useMutation({
    onSuccess: () => {
      utils.wikios.isStashed.invalidate({ pageTitle: title });
      utils.wikios.getStashes.invalidate();
      setAnimState("idle");
      showFeedback("success", "Removed");
      setShowPopover(false);
    },
    onError: (err) => showFeedback("error", err.message ?? "Failed to remove"),
  });

  const isStashed = stashQuery.data?.stashed ?? false;
  const stashedIn = useMemo(() => stashQuery.data?.stashes ?? [], [stashQuery.data?.stashes]);
  const primaryColor = stashedIn[0]?.color ?? "#3b82f6";
  const isPending = stashMutation.isPending || unstashMutation.isPending;

  // One-click stash to default
  const handleClick = useCallback(() => {
    if (!isAuthenticated || isPending) return;
    if (isStashed) {
      setShowPopover((v) => !v);
      return;
    }
    setAnimState("pulse");
    stashMutation.mutate({ pageTitle: title });
  }, [isAuthenticated, isPending, isStashed, title, stashMutation]);

  // Hover to show popover (only when not stashed — avoids accidental show)
  const handleMouseEnter = useCallback(() => {
    if (isStashed) return;
    hoverTimeout.current = setTimeout(() => setShowPopover(true), 400);
  }, [isStashed]);

  const handleMouseLeave = useCallback(() => {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
  }, []);

  // Close popover on click outside
  useEffect(() => {
    if (!showPopover) return;
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowPopover(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showPopover]);

  // Toggle stash for a specific stash id
  const handleToggleStash = useCallback((stashId: string) => {
    const inThisStash = stashedIn.some((s) => s.id === stashId);
    if (inThisStash) {
      unstashMutation.mutate({ pageTitle: title, stashId });
    } else {
      stashMutation.mutate({ pageTitle: title, stashId });
    }
  }, [stashedIn, title, stashMutation, unstashMutation]);

  if (!isAuthenticated) return null;

  const allStashes = stashesQuery.data ?? [];
  const recentStashes = allStashes.slice(0, 4);

  return (
    <div className="wikios-stash-wrapper" ref={wrapperRef}>
      <button
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        disabled={isPending}
        className={cn(
          "wikios-stash-glass",
          isStashed && "wikios-stash-glass-active",
          isStashed && !showPopover && "wikios-stash-collapsed",
          animState === "pulse" && "wikios-stash-pulse",
          animState === "ripple" && "wikios-stash-ripple",
          animState === "color-shift" && "wikios-stash-color-shift",
        )}
        style={isStashed ? { "--stash-color": primaryColor } as React.CSSProperties : undefined}
        title={isStashed ? "Manage stashes" : "Stash this page"}
      >
        <span className="wikios-stash-glass-bg" />
        <span className="wikios-stash-glass-shine" />
        {isPending ? (
          <Loader2 size={13} className="animate-spin" />
        ) : isStashed ? (
          <BookmarkCheck size={13} />
        ) : (
          <Bookmark size={13} />
        )}
        <span className="wikios-stash-label-reveal">
          {isPending ? "Saving..." : isStashed ? "Stashed" : "Stash"}
        </span>
        {/* Multi-stash color dots — only when expanded on hover */}
        {stashedIn.length > 1 && (
          <span className="wikios-stash-dots wikios-stash-label-reveal">
            {stashedIn.slice(0, 3).map((s) => (
              <span key={s.id} className="wikios-stash-dot" style={{ background: s.color }} />
            ))}
          </span>
        )}
        {animState === "ripple" && <span className="wikios-stash-ring" style={{ borderColor: primaryColor }} />}
      </button>

      {/* Inline feedback toast */}
      {feedback && (
        <div className={cn("wikios-stash-feedback", `wikios-stash-feedback-${feedback.type}`)}>
          {feedback.type === "success" ? <Check size={12} /> : <AlertCircle size={12} />}
          {feedback.text}
        </div>
      )}

      {/* Popover */}
      {showPopover && (
        <div
          ref={popoverRef}
          className="wikios-stash-popover"
          onMouseLeave={() => { if (!isStashed) setShowPopover(false); }}
        >
          {allStashes.length === 0 && (
            <div className="wikios-stash-popover-empty">
              No stashes yet. Click Stash to create your first one.
            </div>
          )}
          {/* Quick color circles */}
          {recentStashes.length > 0 && (
            <div className="wikios-stash-popover-colors">
              {recentStashes.map((s) => {
                const active = stashedIn.some((st) => st.id === s.id);
                return (
                  <div key={s.id} className="wikios-stash-circle-wrapper">
                    <button
                      onClick={() => handleToggleStash(s.id)}
                      className={cn("wikios-stash-color-circle", active && "wikios-stash-color-circle-active")}
                      style={{ "--circle-color": s.color } as React.CSSProperties}
                      title={s.name}
                    >
                      {active && <Check size={10} className="wikios-stash-check" />}
                    </button>
                    <span className="wikios-stash-circle-label">{s.name}</span>
                  </div>
                );
              })}
              <div className="wikios-stash-circle-wrapper">
                <button
                  onClick={() => { setShowPopover(false); setShowManager(true); }}
                  className="wikios-stash-color-circle wikios-stash-see-all"
                  title="All stashes"
                >
                  <Plus size={10} />
                </button>
                <span className="wikios-stash-circle-label">More</span>
              </div>
            </div>
          )}

          {/* Quick actions when stashed */}
          {isStashed && (
            <div className="wikios-stash-popover-actions">
              <button
                onClick={() => unstashMutation.mutate({ pageTitle: title })}
                className="wikios-stash-popover-action wikios-stash-remove"
                disabled={unstashMutation.isPending}
              >
                {unstashMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}
                Remove from all
              </button>
              <Link
                href={withBasePath("/w/special/stashes")}
                className="wikios-stash-popover-action"
                onClick={() => setShowPopover(false)}
              >
                <ChevronRight size={12} />
                My Stashes
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Full stash manager modal */}
      {showManager && (
        <StashManagerModal
          pageTitle={title}
          stashedIn={stashedIn}
          onClose={() => { setShowManager(false); utils.wikios.isStashed.invalidate({ pageTitle: title }); }}
          onToggle={handleToggleStash}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stash Manager Modal
// ---------------------------------------------------------------------------
function StashManagerModal({
  pageTitle,
  stashedIn,
  onClose,
  onToggle,
}: {
  pageTitle: string;
  stashedIn: Array<{ id: string; color: string; name: string }>;
  onClose: () => void;
  onToggle: (stashId: string) => void;
}) {
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#3b82f6");
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const utils = api.useUtils();
  const stashesQuery = api.wikios.getStashes.useQuery(undefined, { staleTime: 5000 });
  const createMutation = api.wikios.createStash.useMutation({
    onSuccess: () => {
      utils.wikios.getStashes.invalidate();
      stashesQuery.refetch();
      setNewName("");
      setNewColor("#3b82f6");
      setShowCreate(false);
      setError(null);
    },
    onError: (err) => setError(err.message ?? "Failed to create stash"),
  });

  const allStashes = stashesQuery.data ?? [];
  const activeIds = new Set(stashedIn.map((s) => s.id));

  const handleCreate = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    if (allStashes.some((s) => s.name.toLowerCase() === trimmed.toLowerCase())) {
      setError(`A stash named "${trimmed}" already exists`);
      return;
    }
    setError(null);
    createMutation.mutate({ name: trimmed, color: newColor });
  };

  return (
    <div className="wikios-modal-backdrop" onClick={onClose}>
      <div className="wikios-quick-modal wikios-stash-modal" onClick={(e) => e.stopPropagation()}>
        <div className="wikios-quick-modal-header">
          <div className="wikios-quick-modal-title">
            <Bookmark size={16} />
            <span>Save to Lore Stash</span>
          </div>
          <button onClick={onClose} className="wikios-quick-modal-close"><X size={16} /></button>
        </div>

        <p className="wikios-stash-modal-subtitle">
          Choose which stashes to save <strong>{pageTitle.replace(/_/g, " ")}</strong> to:
        </p>

        <div className="wikios-quick-modal-body">
          {stashesQuery.isLoading && (
            <div className="wikios-quick-modal-loading">
              <Loader2 size={16} className="animate-spin" /> Loading stashes...
            </div>
          )}

          {allStashes.map((s) => {
            const active = activeIds.has(s.id);
            return (
              <button
                key={s.id}
                onClick={() => onToggle(s.id)}
                className={cn("wikios-stash-manager-row", active && "wikios-stash-manager-row-active")}
              >
                <span className="wikios-stash-manager-color" style={{ background: s.color }} />
                <span className="wikios-stash-manager-name">{s.name}</span>
                <span className="wikios-stash-manager-count">{s.itemCount} pages</span>
                <span className={cn("wikios-stash-manager-toggle", active && "wikios-stash-manager-toggle-active")}>
                  {active ? <Check size={14} /> : <Plus size={14} />}
                </span>
              </button>
            );
          })}

          {/* Create new stash */}
          {showCreate ? (
            <div className="wikios-stash-create-form">
              <input
                type="text"
                value={newName}
                onChange={(e) => { setNewName(e.target.value); setError(null); }}
                placeholder="e.g. Characters, Geography, Timeline..."
                className="wikios-stash-create-input"
                autoFocus
                maxLength={100}
                onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") setShowCreate(false); }}
              />
              <div className="wikios-stash-create-colors">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setNewColor(c)}
                    className={cn("wikios-stash-preset-color", newColor === c && "wikios-stash-preset-active")}
                    style={{ background: c }}
                  />
                ))}
              </div>
              {error && (
                <div className="wikios-stash-error">
                  <AlertCircle size={12} /> {error}
                </div>
              )}
              <div className="wikios-stash-create-actions">
                <button onClick={() => { setShowCreate(false); setError(null); }} className="wikios-stash-create-cancel">Cancel</button>
                <button
                  onClick={handleCreate}
                  className="wikios-stash-create-save"
                  disabled={!newName.trim() || createMutation.isPending}
                >
                  {createMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : null}
                  {createMutation.isPending ? "Creating..." : "Create"}
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowCreate(true)} className="wikios-stash-manager-add">
              <Plus size={14} />
              Create new stash
              <span className="wikios-stash-manager-hint">{allStashes.length}/25</span>
            </button>
          )}
        </div>

        <Link
          href={withBasePath("/w/special/stashes")}
          className="wikios-quick-modal-fullpage"
          onClick={onClose}
        >
          <ChevronRight size={12} />
          Go to My Stashes
        </Link>
      </div>
    </div>
  );
}
