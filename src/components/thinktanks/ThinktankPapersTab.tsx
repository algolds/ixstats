"use client";

import React, { useState, useMemo } from "react";
import {
  Plus,
  Search,
  Clock,
  Trash,
  EditPencil,
  Eye,
  Book,
  Check,
  Globe,
  Lock,
} from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Badge } from "~/components/ui/badge";
import { Switch } from "~/components/ui/switch";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";
import { soundEffects } from "~/lib/sound/cuelume";
import { useNotify } from "~/hooks/useNotify";
import { sanitizeUserContent } from "~/lib/utils/sanitize-html";

interface ThinktankPapersTabProps {
  groupId: string;
  groupName?: string;
  isMember?: boolean;
  currentUserId: string;
}

export function ThinktankPapersTab({
  groupId,
  // oxlint-disable-next-line eslint/no-unused-vars
  groupName = "Group",
  isMember = true,
  currentUserId,
}: ThinktankPapersTabProps) {
  const notify = useNotify();
  const utils = api.useUtils();

  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Editor form state
  const [docTitle, setDocTitle] = useState("");
  const [docContent, setDocContent] = useState("");
  const [docIsPublic, setDocIsPublic] = useState(false);
  const [isPreviewMode, setIsPreviewMode] = useState(false);

  // Queries
  const { data: docsData, isLoading } = api.thinkpages.getThinktankDocuments.useQuery(
    { groupId },
    { enabled: Boolean(groupId) }
  );

  const docs = (docsData as any[]) || [];

  // Filter docs
  const filteredDocs = useMemo(() => {
    if (!searchQuery.trim()) return docs;
    const query = searchQuery.toLowerCase();
    return docs.filter(
      (d) =>
        d.title.toLowerCase().includes(query) ||
        (d.content && d.content.toLowerCase().includes(query))
    );
  // oxlint-disable-next-line
  }, [docs, searchQuery]);

  // Selected doc
  const activeDoc = useMemo(() => {
    if (!selectedDocId && docs.length > 0) return docs[0];
    return docs.find((d) => d.id === selectedDocId) || null;
  // oxlint-disable-next-line
  }, [docs, selectedDocId]);

  // Mutations
  const createDocMutation = api.thinkpages.createThinktankDocument.useMutation({
    onSuccess: (newDoc: any) => {
      soundEffects.success();
      notify.success("Working Paper drafted successfully!");
      setIsCreating(false);
      setSelectedDocId(newDoc.id);
      void utils.thinkpages.getThinktankDocuments.invalidate({ groupId });
    },
    onError: (err: any) => {
      soundEffects.error();
      notify.error(err.message || "Failed to draft paper");
    },
  });

  const updateDocMutation = api.thinkpages.updateThinktankDocument.useMutation({
    onSuccess: () => {
      soundEffects.success();
      notify.success("Paper updated successfully!");
      setIsEditing(false);
      void utils.thinkpages.getThinktankDocuments.invalidate({ groupId });
    },
    onError: (err: any) => {
      soundEffects.error();
      notify.error(err.message || "Failed to update paper");
    },
  });

  const deleteDocMutation = api.thinkpages.deleteThinktankDocument.useMutation({
    onSuccess: () => {
      soundEffects.release();
      notify.success("Paper removed.");
      setSelectedDocId(null);
      void utils.thinkpages.getThinktankDocuments.invalidate({ groupId });
    },
    onError: (err: any) => {
      soundEffects.error();
      notify.error(err.message || "Failed to delete paper");
    },
  });

  const handleStartCreate = () => {
    soundEffects.press();
    setDocTitle("");
    setDocContent("");
    setDocIsPublic(true);
    setIsCreating(true);
    setIsEditing(false);
  };

  const handleStartEdit = () => {
    if (!activeDoc) return;
    soundEffects.press();
    setDocTitle(activeDoc.title);
    setDocContent(activeDoc.content || "");
    setDocIsPublic(activeDoc.isPublic);
    setIsEditing(true);
    setIsCreating(false);
  };

  const handleSaveDoc = () => {
    if (!docTitle.trim()) {
      notify.error("Please provide a title for the paper");
      return;
    }

    soundEffects.press();
    if (isCreating) {
      createDocMutation.mutate({
        groupId,
        title: docTitle.trim(),
        content: docContent.trim(),
        isPublic: docIsPublic,
        createdBy: currentUserId,
      });
    } else if (isEditing && activeDoc) {
      updateDocMutation.mutate({
        documentId: activeDoc.id,
        title: docTitle.trim(),
        content: docContent.trim(),
        isPublic: docIsPublic,
        userId: currentUserId,
      });
    }
  };

  return (
    <div className="grid h-full w-full grid-cols-1 overflow-hidden bg-transparent md:grid-cols-12">
      {/* ── Left Sidebar: Document List ── */}
      <div className="flex h-full flex-col border-r border-border/30 bg-muted/20 md:col-span-4 lg:col-span-3.5">
        <div className="p-3.5 border-b border-border/30 space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Docs ({docs.length})
            </h3>
            {isMember && (
              <Button
                size="sm"
                onClick={handleStartCreate}
                className="h-7.5 rounded-lg bg-emerald-600 px-2.5 text-[11px] font-semibold text-white shadow-sm hover:bg-emerald-700 active:scale-95 dark:bg-emerald-500"
              >
                <Plus className="mr-1 h-3 w-3" /> New Doc
              </Button>
            )}
          </div>

          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search docs & notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 rounded-lg bg-background/50 pl-8 text-xs placeholder:text-muted-foreground/60 border-border/40"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12">
              <span className="h-4 w-4 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
              <p className="text-[11px] text-muted-foreground">Loading documents...</p>
            </div>
          ) : filteredDocs.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              No docs found.
            </div>
          ) : (
            filteredDocs.map((doc: any) => {
              const isSelected = activeDoc?.id === doc.id && !isCreating;
              return (
                <button
                  key={doc.id}
                  onClick={() => {
                    soundEffects.press();
                    setSelectedDocId(doc.id);
                    setIsCreating(false);
                    setIsEditing(false);
                  }}
                  className={cn(
                    "flex w-full flex-col items-start rounded-xl p-2.5 text-left transition-all duration-150",
                    isSelected
                      ? "bg-emerald-500/15 text-emerald-700 shadow-sm dark:bg-emerald-500/20 dark:text-emerald-300"
                      : "hover:bg-accent/40 text-foreground"
                  )}
                >
                  <div className="flex w-full items-center justify-between gap-1">
                    <span className="truncate text-xs font-semibold">{doc.title}</span>
                    {doc.isPublic ? (
                      <Globe className="h-3 w-3 shrink-0 text-emerald-500/70" />
                    ) : (
                      <Lock className="h-3 w-3 shrink-0 text-amber-500/70" />
                    )}
                  </div>
                  <div className="mt-1 flex w-full items-center justify-between text-[10px] text-muted-foreground">
                    <span>v{doc.version || 1}</span>
                    <span>{new Date(doc.updatedAt).toLocaleDateString()}</span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ── Right Canvas: Editor / Viewer ── */}
      <div className="flex h-full flex-col overflow-y-auto md:col-span-8 lg:col-span-8.5">
        {isCreating || isEditing ? (
          /* Editor View */
          <div className="flex h-full flex-col p-4 md:p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-border/30 pb-3">
              <h2 className="text-base font-bold text-foreground">
                {isCreating ? "New Document" : `Edit: ${activeDoc?.title}`}
              </h2>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsPreviewMode((prev) => !prev)}
                  className="h-8 rounded-lg text-xs"
                >
                  <Eye className="mr-1.5 h-3.5 w-3.5" />
                  {isPreviewMode ? "Edit Raw" : "Preview"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsCreating(false);
                    setIsEditing(false);
                  }}
                  className="h-8 rounded-lg text-xs"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveDoc}
                  disabled={createDocMutation.isPending || updateDocMutation.isPending}
                  className="h-8 rounded-xl bg-emerald-600 px-4 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 active:scale-95 dark:bg-emerald-500"
                >
                  <Check className="mr-1.5 h-3.5 w-3.5" />
                  {isCreating ? "Save Doc" : "Save Changes"}
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              <Input
                placeholder="Document Title..."
                value={docTitle}
                onChange={(e) => setDocTitle(e.target.value)}
                className="h-10 rounded-xl bg-background/50 text-sm font-semibold border-border/40"
              />

              <div className="flex items-center justify-between rounded-xl bg-muted/30 px-3.5 py-2 border border-border/30">
                <span className="text-xs font-medium text-muted-foreground">Publicly visible to all group members</span>
                <Switch checked={docIsPublic} onCheckedChange={setDocIsPublic} />
              </div>

              {isPreviewMode ? (
                <div
                  className="min-h-[300px] rounded-xl border border-border/40 bg-background/40 p-4 text-xs leading-relaxed text-foreground"
                  dangerouslySetInnerHTML={{ __html: sanitizeUserContent(docContent) }}
                />
              ) : (
                <Textarea
                  placeholder="Draft your document content in markdown format..."
                  value={docContent}
                  onChange={(e) => setDocContent(e.target.value)}
                  className="min-h-[360px] rounded-xl bg-background/40 font-mono text-xs border-border/40 leading-relaxed"
                />
              )}
            </div>
          </div>
        ) : activeDoc ? (
          /* Reader View */
          <div className="flex h-full flex-col p-4 md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/30 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-foreground md:text-xl">
                    {activeDoc.title}
                  </h2>
                  <Badge variant="outline" className="text-[10px] uppercase text-emerald-600 dark:text-emerald-400">
                    v{activeDoc.version || 1}
                  </Badge>
                </div>
                <div className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" /> Updated {new Date(activeDoc.updatedAt).toLocaleDateString()}
                  </span>
                  <span>·</span>
                  <span>{activeDoc.content ? activeDoc.content.split(/\s+/).length : 0} words</span>
                </div>
              </div>

              {isMember && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleStartEdit}
                    className="h-8 rounded-lg text-xs"
                  >
                    <EditPencil className="mr-1.5 h-3.5 w-3.5" /> Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (confirm("Are you sure you want to delete this doc?")) {
                        deleteDocMutation.mutate({ documentId: activeDoc.id, userId: currentUserId });
                      }
                    }}
                    className="h-8 rounded-lg text-xs text-rose-500 hover:bg-rose-500/10 hover:text-rose-600"
                  >
                    <Trash className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>

            <div className="prose prose-sm dark:prose-invert max-w-none pt-4 text-xs leading-relaxed">
              <div
                className="whitespace-pre-wrap font-sans text-foreground/90 leading-relaxed"
                dangerouslySetInnerHTML={{ __html: sanitizeUserContent(activeDoc.content || "*No content drafted yet.*") }}
              />
            </div>
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center p-8 text-center text-muted-foreground">
            <Book className="h-10 w-10 text-muted-foreground/40" />
            <h3 className="mt-3 text-sm font-semibold text-foreground">Select a Document</h3>
            <p className="mt-1 max-w-sm text-xs">
              Choose a document from the list on the left to read or edit.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
