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
}

export function ThinktankPapersTab({
  groupId,
  // oxlint-disable-next-line eslint/no-unused-vars
  groupName = "Group",
  isMember = true,
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
      notify.success("Working Paper drafted");
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
      notify.success("Paper updated");
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
      });
    } else if (isEditing && activeDoc) {
      updateDocMutation.mutate({
        documentId: activeDoc.id,
        title: docTitle.trim(),
        content: docContent.trim(),
        isPublic: docIsPublic,
      });
    }
  };

  return (
    <div className="grid h-full w-full grid-cols-1 overflow-hidden bg-transparent md:grid-cols-12">
      {/* ── Left Sidebar: Document List ── */}
      <div className="border-separator bg-fill-4 lg:col-span-3.5 flex h-full flex-col border-r md:col-span-4">
        <div className="border-separator space-y-2 border-b p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-subhead text-label-secondary">Docs ({docs.length})</h3>
            {isMember && (
              <Button size="sm" onClick={handleStartCreate}>
                <Plus /> New Doc
              </Button>
            )}
          </div>

          <div className="relative">
            <Search className="text-label-secondary absolute top-1/2 left-2 h-3.5 w-3.5 -translate-y-1/2" />
            <Input
              placeholder="Search docs & notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>

        <div className="flex-1 space-y-1 overflow-y-auto p-2">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12">
              <span className="border-tint h-4 w-4 animate-spin rounded-full border-2 border-t-transparent" />
              <p className="text-label-secondary text-footnote">Loading documents...</p>
            </div>
          ) : filteredDocs.length === 0 ? (
            <div className="text-label-secondary text-footnote p-6 text-center">No docs found.</div>
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
                    "rounded-row flex w-full flex-col items-start p-2 text-left transition-colors duration-150",
                    isSelected ? "bg-tint-fill text-tint" : "hover:bg-fill-4 text-label"
                  )}
                >
                  <div className="flex w-full items-center justify-between gap-1">
                    <span className="text-headline truncate">{doc.title}</span>
                    {doc.isPublic ? (
                      <Globe
                        className="text-label-secondary size-3.5 shrink-0"
                        aria-label="Public"
                      />
                    ) : (
                      <Lock
                        className="text-label-secondary size-3.5 shrink-0"
                        aria-label="Private"
                      />
                    )}
                  </div>
                  <div className="text-footnote text-label-secondary mt-1 flex w-full items-center justify-between tabular-nums">
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
      <div className="lg:col-span-8.5 flex h-full flex-col overflow-y-auto md:col-span-8">
        {isCreating || isEditing ? (
          /* Editor View */
          <div className="flex h-full flex-col space-y-4 p-4 md:p-6">
            <div className="border-separator flex items-center justify-between border-b pb-3">
              <h2 className="text-label text-headline">
                {isCreating ? "New Document" : `Edit: ${activeDoc?.title}`}
              </h2>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setIsPreviewMode((prev) => !prev)}>
                  <Eye />
                  {isPreviewMode ? "Edit Raw" : "Preview"}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setIsCreating(false);
                    setIsEditing(false);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveDoc}
                  disabled={createDocMutation.isPending || updateDocMutation.isPending}
                >
                  <Check />
                  {isCreating ? "Save Doc" : "Save Changes"}
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              <Input
                placeholder="Document Title..."
                value={docTitle}
                onChange={(e) => setDocTitle(e.target.value)}
                className="text-headline"
              />

              <div className="bg-surface-secondary rounded-row flex items-center justify-between px-4 py-2">
                <span className="text-callout text-label-secondary">
                  Publicly visible to all group members
                </span>
                <Switch checked={docIsPublic} onCheckedChange={setDocIsPublic} />
              </div>

              {isPreviewMode ? (
                <div
                  className="border-separator bg-surface-secondary text-body text-label rounded-row min-h-[300px] border p-4"
                  dangerouslySetInnerHTML={{ __html: sanitizeUserContent(docContent) }}
                />
              ) : (
                <Textarea
                  placeholder="Draft your document content in markdown format..."
                  value={docContent}
                  onChange={(e) => setDocContent(e.target.value)}
                  className="min-h-[360px] font-mono"
                />
              )}
            </div>
          </div>
        ) : activeDoc ? (
          /* Reader View */
          <div className="flex h-full flex-col p-4 md:p-6">
            <div className="border-separator flex flex-wrap items-start justify-between gap-3 border-b pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-title-2 text-label">{activeDoc.title}</h2>
                  <Badge variant="secondary" className="tabular-nums">
                    v{activeDoc.version || 1}
                  </Badge>
                </div>
                <div className="text-label-secondary text-footnote mt-1 flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <Clock className="size-3.5" aria-hidden="true" /> Updated{" "}
                    {new Date(activeDoc.updatedAt).toLocaleDateString()}
                  </span>
                  <span>·</span>
                  <span>{activeDoc.content ? activeDoc.content.split(/\s+/).length : 0} words</span>
                </div>
              </div>

              {isMember && (
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={handleStartEdit}>
                    <EditPencil /> Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (confirm("Are you sure you want to delete this doc?")) {
                        deleteDocMutation.mutate({ documentId: activeDoc.id });
                      }
                    }}
                    className="text-pink hover:bg-pink/10 hover:text-pink"
                  >
                    <Trash className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>

            <div className="prose prose-sm text-footnote max-w-none pt-4 leading-relaxed">
              <div
                className="text-label font-sans leading-relaxed whitespace-pre-wrap"
                dangerouslySetInnerHTML={{
                  __html: sanitizeUserContent(activeDoc.content || "*No content drafted yet.*"),
                }}
              />
            </div>
          </div>
        ) : (
          <div className="text-label-secondary flex h-full flex-col items-center justify-center p-8 text-center">
            <Book className="text-label-tertiary h-10 w-10" />
            <h3 className="text-label text-headline mt-3">Select a document</h3>
            <p className="text-footnote mt-1 max-w-sm">
              Choose a document from the list on the left to read or edit.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
