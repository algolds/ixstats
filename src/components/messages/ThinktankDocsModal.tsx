"use client";

import React, { useState, useMemo } from "react";
import {
  Page,
  Plus,
  Search,
  Clock,
  User,
  Trash,
  EditPencil,
  Xmark,
  ArrowLeft,
  Eye,
  Book,
} from "iconoir-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { Switch } from "~/components/ui/switch";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { cn } from "~/lib/utils";
import { soundEffects } from "~/lib/sound/cuelume";
import { sanitizeUserContent } from "~/lib/utils/sanitize-html";

interface ThinktankDocsModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  groupName: string;
  currentUserId: string;
  isMember?: boolean;
}

export function ThinktankDocsModal({
  isOpen,
  onClose,
  groupId,
  groupName,
  currentUserId,
  isMember = true,
}: ThinktankDocsModalProps) {
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

  // Queries & Mutations
  const { data: docsData, isLoading } = api.thinkpages.getThinktankDocuments.useQuery(
    { groupId },
    { enabled: isOpen && !!groupId }
  );

  const docs = useMemo(() => {
    let list = (docsData as any[]) ?? [];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (d: any) =>
          d.title?.toLowerCase().includes(q) || d.content?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [docsData, searchQuery]);

  const selectedDoc = useMemo(() => {
    if (!selectedDocId || !docsData) return null;
    return (docsData as any[]).find((d: any) => d.id === selectedDocId) ?? null;
  }, [docsData, selectedDocId]);

  const createDocMutation = api.thinkpages.createThinktankDocument.useMutation({
    onSuccess: (newDoc) => {
      soundEffects.success();
      notify.success("Document created successfully");
      void utils.thinkpages.getThinktankDocuments.invalidate({ groupId });
      void utils.thinkpages.getThinktanks.invalidate();
      setIsCreating(false);
      setSelectedDocId(newDoc.id);
    },
    onError: (err) => {
      soundEffects.error();
      notify.error(err.message || "Failed to create document");
    },
  });

  const updateDocMutation = api.thinkpages.updateThinktankDocument.useMutation({
    onSuccess: () => {
      soundEffects.success();
      notify.success("Document saved");
      void utils.thinkpages.getThinktankDocuments.invalidate({ groupId });
      setIsEditing(false);
    },
    onError: (err) => {
      soundEffects.error();
      notify.error(err.message || "Failed to update document");
    },
  });

  const deleteDocMutation = api.thinkpages.deleteThinktankDocument.useMutation({
    onSuccess: () => {
      soundEffects.release();
      notify.success("Document deleted");
      void utils.thinkpages.getThinktankDocuments.invalidate({ groupId });
      void utils.thinkpages.getThinktanks.invalidate();
      setSelectedDocId(null);
    },
    onError: (err) => {
      soundEffects.error();
      notify.error(err.message || "Failed to delete document");
    },
  });

  const handleStartCreate = () => {
    soundEffects.press();
    setDocTitle("");
    setDocContent("");
    setDocIsPublic(false);
    setIsPreviewMode(false);
    setIsCreating(true);
    setIsEditing(false);
    setSelectedDocId(null);
  };

  const handleStartEdit = (doc: any) => {
    soundEffects.press();
    setDocTitle(doc.title);
    setDocContent(doc.content || "");
    setDocIsPublic(doc.isPublic ?? false);
    setIsPreviewMode(false);
    setIsEditing(true);
    setIsCreating(false);
  };

  const handleSaveCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!docTitle.trim()) return;
    createDocMutation.mutate({
      groupId,
      title: docTitle.trim(),
      content: docContent,
      isPublic: docIsPublic,
      createdBy: currentUserId,
    });
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDocId || !docTitle.trim()) return;
    updateDocMutation.mutate({
      documentId: selectedDocId,
      userId: currentUserId,
      title: docTitle.trim(),
      content: docContent,
      isPublic: docIsPublic,
    });
  };

  const handleDelete = (docId: string) => {
    soundEffects.press();
    if (confirm("Are you sure you want to delete this document? This cannot be undone.")) {
      deleteDocMutation.mutate({ documentId: docId, userId: currentUserId });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="z-[100060] flex h-[85vh] max-h-[850px] w-[95vw] max-w-5xl flex-col gap-0 overflow-hidden rounded-3xl border border-border/40 bg-card/95 p-0 text-foreground shadow-2xl backdrop-blur-2xl">
        {/* Header Bar */}
        <div className="flex shrink-0 items-center justify-between border-b border-border/30 bg-muted/20 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 shadow-inner">
              <Book className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="flex items-center gap-2 text-base font-bold tracking-tight text-foreground">
                <span>Working Papers & Treaties</span>
                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                  {groupName}
                </span>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Collaborative research, diplomatic treaties, and lore articles.
              </DialogDescription>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isCreating && !isEditing && isMember && (
              <Button
                onClick={handleStartCreate}
                size="sm"
                className="flex h-8 cursor-pointer items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-emerald-700 active:scale-[0.97] dark:bg-emerald-500 dark:hover:bg-emerald-600"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>New Paper</span>
              </Button>
            )}
          </div>
        </div>

        {/* Modal Main Content (Split view) */}
        <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-12">
          {/* Left Column: Document List */}
          <div
            className={cn(
              "flex flex-col border-r border-border/30 bg-muted/10 md:col-span-4",
              (selectedDocId || isCreating) && "hidden md:flex"
            )}
          >
            {/* Search filter */}
            <div className="border-b border-border/30 p-3">
              <div className="relative">
                <Search className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search papers..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8.5 rounded-xl border-input bg-background/70 pl-8 text-xs text-foreground placeholder:text-muted-foreground"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <Xmark className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Document Items List */}
            <div className="scrollbar-none flex-1 overflow-y-auto p-2">
              {isLoading ? (
                <div className="flex items-center justify-center py-16">
                  <span className="h-6 w-6 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
                </div>
              ) : docs.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-6 text-center">
                  <Page className="mb-2 h-8 w-8 text-muted-foreground/60" />
                  <p className="text-xs font-semibold text-muted-foreground">No documents yet</p>
                  <p className="mt-1 text-[11px] text-muted-foreground/80">
                    Draft world history or statecraft proposals with your group.
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {docs.map((doc: any) => {
                    const isSelected = selectedDocId === doc.id;
                    const dateFormatted = new Date(
                      doc.updatedAt ?? doc.createdAt
                    ).toLocaleDateString(undefined, { month: "short", day: "numeric" });

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
                          "group relative flex w-full flex-col gap-1 rounded-2xl border p-3 text-left transition-all duration-150 select-none active:scale-[0.98]",
                          isSelected
                            ? "border-emerald-500/50 bg-emerald-500/15 shadow-xs dark:border-emerald-400/40"
                            : "border-border/20 bg-card/40 hover:border-border/40 hover:bg-accent/40"
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="truncate text-xs font-bold text-foreground">
                            {doc.title}
                          </h4>
                          <span className="shrink-0 rounded-md border border-border/30 bg-muted/40 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-muted-foreground">
                            v{doc.version ?? 1}
                          </span>
                        </div>
                        {doc.content && (
                          <p className="line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
                            {doc.content.replace(/[#*`_]/g, "")}
                          </p>
                        )}
                        <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {dateFormatted}
                          </span>
                          {doc.isPublic && (
                            <span className="font-semibold text-emerald-600 dark:text-emerald-400">• Public</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Reader or Editor */}
          <div className="flex flex-col md:col-span-8">
            {isCreating || isEditing ? (
              /* Editor Form */
              <form
                onSubmit={isCreating ? handleSaveCreate : handleSaveEdit}
                className="flex h-full flex-col justify-between"
              >
                <div className="scrollbar-none flex-1 space-y-4 overflow-y-auto p-6">
                  <div className="flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        soundEffects.press();
                        setIsCreating(false);
                        setIsEditing(false);
                      }}
                      className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground md:hidden"
                    >
                      <ArrowLeft className="h-4 w-4" /> Back
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          soundEffects.press();
                          setIsPreviewMode(!isPreviewMode);
                        }}
                        className={cn(
                          "flex h-7 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition-colors",
                          isPreviewMode
                            ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                            : "border-border/40 bg-muted/30 text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>{isPreviewMode ? "Edit Raw" : "Preview"}</span>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
                      Document Title
                    </label>
                    <Input
                      value={docTitle}
                      onChange={(e) => setDocTitle(e.target.value)}
                      placeholder="e.g. Concord Treaty Draft"
                      className="h-10 rounded-xl border-input bg-background/80 text-sm font-semibold text-foreground"
                      required
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-xl border border-border/30 bg-muted/20 p-3">
                    <div>
                      <span className="text-xs font-bold text-foreground">Public Document</span>
                      <p className="text-[11px] text-muted-foreground">
                        Allow users outside this ThinkTank to read this paper.
                      </p>
                    </div>
                    <Switch checked={docIsPublic} onCheckedChange={setDocIsPublic} />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
                      Content (Markdown Supported)
                    </label>
                    {isPreviewMode ? (
                      <div className="min-h-[260px] rounded-xl border border-border/40 bg-card/40 p-4 text-xs leading-relaxed text-foreground">
                        {docContent ? (
                          <div
                            dangerouslySetInnerHTML={{
                              __html: sanitizeUserContent(docContent),
                            }}
                          />
                        ) : (
                          <span className="italic text-muted-foreground">No content to preview</span>
                        )}
                      </div>
                    ) : (
                      <Textarea
                        value={docContent}
                        onChange={(e) => setDocContent(e.target.value)}
                        placeholder="Write your document, policy draft, or worldbuilding lore here..."
                        rows={12}
                        className="font-mono text-xs leading-relaxed animate-none resize-none rounded-xl border-input bg-background/80 text-foreground"
                      />
                    )}
                  </div>
                </div>

                {/* Editor Footer Actions */}
                <div className="flex items-center justify-end gap-2.5 border-t border-border/30 bg-muted/20 px-6 py-3.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      soundEffects.press();
                      setIsCreating(false);
                      setIsEditing(false);
                    }}
                    className="h-8 rounded-xl text-xs text-muted-foreground hover:text-foreground"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={createDocMutation.isPending || updateDocMutation.isPending}
                    className="flex h-8 cursor-pointer items-center gap-1.5 rounded-xl bg-emerald-600 px-4 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 active:scale-[0.97] dark:bg-emerald-500 dark:hover:bg-emerald-600"
                  >
                    <span>{isCreating ? "Publish Paper" : "Save Changes"}</span>
                  </Button>
                </div>
              </form>
            ) : selectedDoc ? (
              /* Reader View */
              <div className="flex h-full flex-col justify-between">
                <div className="scrollbar-none flex-1 overflow-y-auto p-6">
                  {/* Top action bar */}
                  <div className="mb-4 flex items-center justify-between gap-3 border-b border-border/30 pb-3">
                    <button
                      onClick={() => {
                        soundEffects.press();
                        setSelectedDocId(null);
                      }}
                      className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground md:hidden"
                    >
                      <ArrowLeft className="h-4 w-4" /> Papers
                    </button>

                    <div className="flex items-center gap-2">
                      <span className="rounded-full border border-border/30 bg-muted/40 px-2.5 py-0.5 font-mono text-[10px] font-semibold text-muted-foreground">
                        Version {selectedDoc.version ?? 1}
                      </span>
                      {selectedDoc.isPublic && (
                        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                          Public
                        </span>
                      )}
                    </div>

                    {isMember && (
                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleStartEdit(selectedDoc)}
                          className="h-8 cursor-pointer gap-1.5 rounded-xl border border-border/40 bg-card/60 px-3 text-xs font-semibold text-foreground hover:bg-accent hover:text-accent-foreground"
                        >
                          <EditPencil className="h-3.5 w-3.5" />
                          <span>Edit</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(selectedDoc.id)}
                          className="h-8 w-8 cursor-pointer rounded-xl text-destructive hover:bg-destructive/10 hover:text-destructive"
                          title="Delete Document"
                        >
                          <Trash className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Document Title & Metadata */}
                  <div className="space-y-1.5">
                    <h2 className="text-xl font-bold tracking-tight text-foreground">
                      {selectedDoc.title}
                    </h2>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                        Created by User {selectedDoc.createdBy?.slice(0, 8)}
                      </span>
                      <span>•</span>
                      <span>
                        Updated{" "}
                        {new Date(
                          selectedDoc.updatedAt ?? selectedDoc.createdAt
                        ).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Document Body */}
                  <div className="prose dark:prose-invert mt-6 max-w-none text-xs leading-relaxed text-foreground/90">
                    {selectedDoc.content ? (
                      <div
                        dangerouslySetInnerHTML={{
                          __html: sanitizeUserContent(selectedDoc.content),
                        }}
                      />
                    ) : (
                      <p className="italic text-muted-foreground">
                        This document has no content yet.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* Empty Selection State */
              <div className="flex h-full flex-col items-center justify-center p-8 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-border/40 bg-muted/20 text-muted-foreground">
                  <Page className="h-6 w-6" />
                </div>
                <h3 className="font-semibold text-foreground">Select a paper to read</h3>
                <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                  Choose a paper from the list on the left, or create a new document to start collaborating.
                </p>
                {isMember && (
                  <Button
                    onClick={handleStartCreate}
                    className="mt-4 flex h-8 items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 active:scale-[0.97] dark:bg-emerald-500 dark:hover:bg-emerald-600"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Create Document</span>
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
