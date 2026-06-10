"use client";

import React, { useState, useEffect, useMemo } from "react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import {
  Bookmark,
  Calendar,
  Save,
  Trash2,
  Highlighter,
  FileText,
  ExternalLink,
  Loader2,
  ChevronRight,
  ChevronLeft,
  ArrowUpRight,
  Sparkles,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { cn } from "~/lib/utils";
import { CutoutCorner } from "~/components/ui/cutout-card";

interface MessagesStashItemViewerProps {
  itemId: string;
  onClose: () => void;
}

export function MessagesStashItemViewer({ itemId, onClose }: MessagesStashItemViewerProps) {
  const notify = useNotify();
  const utils = api.useUtils();
  const [noteContent, setNoteContent] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  // Fetch the individual item
  const { data: item, isLoading: isLoadingItem } = api.wikios.getStashItem.useQuery(
    { itemId },
    { enabled: !!itemId }
  );

  // Sync note state when item loads
  useEffect(() => {
    if (item) {
      setNoteContent(item.note ?? "");
    }
  }, [item]);

  // Fetch annotations for this item's pageTitle
  const { data: annotations = [], isLoading: isLoadingAnnotations } =
    api.wikios.getAnnotations.useQuery(
      { pageTitle: item?.pageTitle ?? "" },
      { enabled: !!item?.pageTitle }
    );

  // Mutation to update notes
  const updateNoteMutation = api.wikios.updateItemNote.useMutation({
    onSuccess: () => {
      notify.success("Notes saved successfully");
      setIsEditing(false);
      void utils.wikios.getStashItem.invalidate({ itemId });
      void utils.wikios.getStashItems.invalidate();
    },
    onError: (err) => {
      notify.error(err.message || "Failed to save notes");
    },
  });

  const handleSaveNotes = () => {
    updateNoteMutation.mutate({
      itemId,
      note: noteContent,
    });
  };

  // Mutation to delete annotation
  const deleteAnnotationMutation = api.wikios.deleteAnnotation.useMutation({
    onSuccess: () => {
      notify.success("Annotation removed");
      void utils.wikios.getAnnotations.invalidate({ pageTitle: item?.pageTitle ?? "" });
      void utils.wikios.getStashItems.invalidate();
    },
    onError: (err) => {
      notify.error(err.message || "Failed to remove annotation");
    },
  });

  const handleDeleteAnnotation = (id: string) => {
    if (confirm("Remove this highlight?")) {
      deleteAnnotationMutation.mutate({ id });
    }
  };

  if (isLoadingItem) {
    return (
      <div className="flex h-full flex-col items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
        <p className="mt-2 text-xs font-medium text-slate-400">Loading item details...</p>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-6 text-center">
        <Bookmark className="mb-3 h-12 w-12 text-rose-500/50" />
        <h3 className="mb-1 font-semibold text-slate-200">Item Not Found</h3>
        <p className="text-sm text-slate-400">
          The selected stash item could not be retrieved or has been removed.
        </p>
      </div>
    );
  }

  // Generate public Wiki OS URL
  const wikiUrl = `/wiki/${item.pageSlug}`;

  return (
    <div className="flex h-full flex-col bg-transparent">
      {/* Header */}
      <header className="relative z-10 flex h-16 shrink-0 items-center justify-between border-b border-blue-500/20 bg-blue-500/10 px-4">
        <div className="flex min-w-0 items-center gap-2">
          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="shrink-0 text-slate-400 hover:text-white"
              title="Back to stash list"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
          )}
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-slate-950/40"
            style={{ borderLeftColor: item.stashColor, borderLeftWidth: "3.5px" }}
          >
            <Bookmark className="h-4.5 w-4.5" style={{ color: item.stashColor }} />
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-sm leading-tight font-semibold text-slate-200">
              {item.pageTitle}
            </h3>
            <div className="mt-1 flex items-center gap-1.5">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: item.stashColor }}
              />
              <span className="truncate text-[10px] font-medium text-slate-400">
                In {item.stashName}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <a
            href={wikiUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="relative z-10 flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-300 shadow-sm transition-all hover:bg-white/10 hover:text-white"
          >
            Go to Page
            <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
        </div>

        {/* Cutout corners for the tab effect */}
        <CutoutCorner
          className="dark:text-card absolute -bottom-px left-0 text-slate-950"
          size={20}
        />
        <CutoutCorner
          className="dark:text-card absolute right-0 -bottom-px -scale-x-100 text-slate-950"
          size={20}
        />
      </header>

      {/* Main Content Area */}
      <div className="flex-1 scrollbar-none space-y-6 overflow-y-auto p-6">
        {/* Saved Date */}
        <div className="flex w-fit items-center gap-2 rounded-lg border border-white/5 bg-white/5 px-3 py-1.5 text-[10px] font-semibold text-slate-500">
          <Calendar className="h-3.5 w-3.5" />
          Saved on{" "}
          {new Date(item.savedAt).toLocaleDateString(undefined, {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </div>

        {/* Note Box */}
        <div className="space-y-3.5 rounded-xl border border-white/10 bg-slate-900/30 p-5 shadow-lg">
          <div className="flex items-center justify-between">
            <h4 className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-indigo-400 uppercase">
              <FileText className="h-4 w-4" />
              Notes & Annotations
            </h4>
            {isEditing ? (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setNoteContent(item.note ?? "");
                    setIsEditing(false);
                  }}
                  className="h-7 px-2.5 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveNotes}
                  disabled={updateNoteMutation.isPending}
                  className="flex h-7 items-center gap-1 bg-indigo-600 px-2.5 text-xs text-white hover:bg-indigo-700"
                >
                  {updateNoteMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                  Save
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsEditing(true)}
                className="h-7 border border-white/5 bg-white/5 px-2.5 text-xs hover:border-white/10 hover:bg-white/10"
              >
                Edit Notes
              </Button>
            )}
          </div>

          {isEditing ? (
            <Textarea
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              placeholder="Add your notes, cross references, or summaries for this lore page..."
              className="min-h-[140px] border-white/10 bg-slate-950/60 text-sm text-white placeholder-slate-400 focus-visible:ring-amber-500 focus-visible:ring-offset-0"
            />
          ) : (
            <div className="min-h-[60px] text-sm leading-relaxed whitespace-pre-wrap text-slate-300">
              {item.note ? (
                item.note
              ) : (
                <p className="text-xs text-slate-500 italic">
                  No notes written yet. Click &quot;Edit Notes&quot; to write thoughts or log links.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Highlights & Text Selections */}
        <div className="space-y-3">
          <h4 className="flex items-center gap-1.5 px-1 text-xs font-bold tracking-wider text-indigo-400 uppercase">
            <Highlighter className="h-4 w-4" />
            Wiki Page Highlights ({annotations.length})
          </h4>

          {isLoadingAnnotations ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-indigo-400" />
            </div>
          ) : annotations.length === 0 ? (
            <div className="rounded-xl border border-white/5 bg-white/5 p-6 text-center">
              <Highlighter className="mx-auto mb-2 h-6 w-6 animate-bounce text-slate-500/40" />
              <p className="text-xs text-slate-400">No highlights saved from the Wiki</p>
              <p className="mt-1 text-[10px] text-slate-500">
                Select text on the Wiki page and click &quot;Stash Highlight&quot; to save excerpts.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {annotations.map((ann) => (
                <div
                  key={ann.id}
                  className="group relative rounded-xl border border-amber-500/10 bg-gradient-to-r from-amber-500/5 to-transparent p-4 shadow-sm"
                >
                  {/* Selected Text excerpt */}
                  <blockquote className="border-l-2 border-amber-500/40 pl-3 text-xs leading-relaxed text-slate-300 italic">
                    &ldquo;{ann.selectedText}&rdquo;
                  </blockquote>

                  {/* Comment context */}
                  {ann.comment && (
                    <div className="mt-2.5 flex items-start gap-1.5 rounded-lg border border-white/5 bg-black/10 p-2.5 text-xs text-slate-400">
                      <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
                      <div>
                        <span className="mb-0.5 block font-semibold text-slate-300">
                          Annotation Comment
                        </span>
                        {ann.comment}
                      </div>
                    </div>
                  )}

                  {/* Actions overlay */}
                  <div className="absolute top-3 right-3 opacity-0 transition-opacity group-hover:opacity-100">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDeleteAnnotation(ann.id)}
                      className="h-7 w-7 rounded-lg text-slate-400 transition-colors hover:bg-rose-500/10 hover:text-rose-400"
                      title="Delete highlight"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
