"use client";

import React, { useState } from "react";
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
  isMember?: boolean;
}

type Mode = "view" | "create" | "edit";

function useDocInvalidation(groupId: string) {
  const utils = api.useUtils();
  return () => void utils.thinkpages.getThinktankDocuments.invalidate({ groupId });
}

interface DocListProps {
  docs: any[];
  total: number;
  isLoading: boolean;
  isMember: boolean;
  selectedId?: string;
  onNew: () => void;
  onSelect: (id: string) => void;
}

function DocList({ docs, total, isLoading, isMember, selectedId, onNew, onSelect }: DocListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const query = searchQuery.trim().toLowerCase();
  const visible = query
    ? docs.filter(
        (d) => d.title.toLowerCase().includes(query) || d.content?.toLowerCase().includes(query)
      )
    : docs;

  return (
    <div className="border-separator bg-fill-4 lg:col-span-3.5 flex h-full flex-col border-r md:col-span-4">
      <div className="border-separator space-y-2 border-b p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-subhead text-label-secondary">Docs ({total})</h3>
          {isMember && (
            <Button size="sm" onClick={onNew}>
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
        ) : visible.length === 0 ? (
          <div className="text-label-secondary text-footnote p-6 text-center">No docs found.</div>
        ) : (
          visible.map((doc) => {
            const VisibilityIcon = doc.isPublic ? Globe : Lock;
            return (
              <button
                key={doc.id}
                onClick={() => onSelect(doc.id)}
                className={cn(
                  "rounded-row flex w-full flex-col items-start p-2 text-left transition-colors duration-150",
                  selectedId === doc.id ? "bg-tint-fill text-tint" : "hover:bg-fill-4 text-label"
                )}
              >
                <div className="flex w-full items-center justify-between gap-1">
                  <span className="text-headline truncate">{doc.title}</span>
                  <VisibilityIcon
                    className="text-label-secondary size-3.5 shrink-0"
                    aria-label={doc.isPublic ? "Public" : "Private"}
                  />
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
  );
}

interface DocEditorProps {
  groupId: string;
  /** The document being edited; absent when drafting a new one. */
  doc?: any;
  onDone: (savedId?: string) => void;
  onCancel: () => void;
}

function DocEditor({ groupId, doc, onDone, onCancel }: DocEditorProps) {
  const notify = useNotify();
  const invalidateDocs = useDocInvalidation(groupId);
  const [title, setTitle] = useState(doc?.title ?? "");
  const [content, setContent] = useState(doc?.content || "");
  const [isPublic, setIsPublic] = useState<boolean>(doc ? doc.isPublic : true);
  const [isPreviewMode, setIsPreviewMode] = useState(false);

  const createDocMutation = api.thinkpages.createThinktankDocument.useMutation({
    onSuccess: (newDoc: any) => {
      soundEffects.success();
      notify.success("Working Paper drafted");
      invalidateDocs();
      onDone(newDoc.id);
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
      invalidateDocs();
      onDone();
    },
    onError: (err: any) => {
      soundEffects.error();
      notify.error(err.message || "Failed to update paper");
    },
  });

  const handleSave = () => {
    if (!title.trim()) {
      notify.error("Please provide a title for the paper");
      return;
    }

    soundEffects.press();
    const fields = { title: title.trim(), content: content.trim(), isPublic };
    if (doc) updateDocMutation.mutate({ documentId: doc.id, ...fields });
    else createDocMutation.mutate({ groupId, ...fields });
  };

  return (
    <div className="flex h-full flex-col space-y-4 p-4 md:p-6">
      <div className="border-separator flex items-center justify-between border-b pb-3">
        <h2 className="text-label text-headline">{doc ? `Edit: ${doc.title}` : "New Document"}</h2>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setIsPreviewMode((prev) => !prev)}>
            <Eye />
            {isPreviewMode ? "Edit Raw" : "Preview"}
          </Button>
          <Button variant="secondary" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={createDocMutation.isPending || updateDocMutation.isPending}
          >
            <Check />
            {doc ? "Save Changes" : "Save Doc"}
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <Input
          placeholder="Document Title..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="text-headline"
        />

        <div className="bg-surface-secondary rounded-row flex items-center justify-between px-4 py-2">
          <span className="text-callout text-label-secondary">
            Publicly visible to all group members
          </span>
          <Switch checked={isPublic} onCheckedChange={setIsPublic} />
        </div>

        {isPreviewMode ? (
          <div
            className="border-separator bg-surface-secondary text-body text-label rounded-row min-h-[300px] border p-4"
            dangerouslySetInnerHTML={{ __html: sanitizeUserContent(content) }}
          />
        ) : (
          <Textarea
            placeholder="Draft your document content in markdown format..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="min-h-[360px] font-mono"
          />
        )}
      </div>
    </div>
  );
}

interface DocReaderProps {
  groupId: string;
  doc: any;
  isMember: boolean;
  onEdit: () => void;
  onDeleted: () => void;
}

function DocReader({ groupId, doc, isMember, onEdit, onDeleted }: DocReaderProps) {
  const notify = useNotify();
  const invalidateDocs = useDocInvalidation(groupId);

  const deleteDocMutation = api.thinkpages.deleteThinktankDocument.useMutation({
    onSuccess: () => {
      soundEffects.release();
      notify.success("Paper removed.");
      onDeleted();
      invalidateDocs();
    },
    onError: (err: any) => {
      soundEffects.error();
      notify.error(err.message || "Failed to delete paper");
    },
  });

  return (
    <div className="flex h-full flex-col p-4 md:p-6">
      <div className="border-separator flex flex-wrap items-start justify-between gap-3 border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-title-2 text-label">{doc.title}</h2>
            <Badge variant="secondary" className="tabular-nums">
              v{doc.version || 1}
            </Badge>
          </div>
          <div className="text-label-secondary text-footnote mt-1 flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Clock className="size-3.5" aria-hidden="true" /> Updated{" "}
              {new Date(doc.updatedAt).toLocaleDateString()}
            </span>
            <span>·</span>
            <span>{doc.content ? doc.content.split(/\s+/).length : 0} words</span>
          </div>
        </div>

        {isMember && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onEdit}>
              <EditPencil /> Edit
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (confirm("Are you sure you want to delete this doc?")) {
                  deleteDocMutation.mutate({ documentId: doc.id });
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
            __html: sanitizeUserContent(doc.content || "*No content drafted yet.*"),
          }}
        />
      </div>
    </div>
  );
}

export function ThinktankPapersTab({ groupId, isMember = true }: ThinktankPapersTabProps) {
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("view");

  const { data: docsData, isLoading } = api.thinkpages.getThinktankDocuments.useQuery(
    { groupId },
    { enabled: Boolean(groupId) }
  );
  const docs = (docsData as any[]) || [];

  const activeDoc = selectedDocId
    ? (docs.find((d) => d.id === selectedDocId) ?? null)
    : (docs[0] ?? null);

  const view = (id?: string) => {
    if (id) setSelectedDocId(id);
    setMode("view");
  };

  return (
    <div className="grid h-full w-full grid-cols-1 overflow-hidden bg-transparent md:grid-cols-12">
      <DocList
        docs={docs}
        total={docs.length}
        isLoading={isLoading}
        isMember={isMember}
        selectedId={mode === "create" ? undefined : activeDoc?.id}
        onNew={() => {
          soundEffects.press();
          setMode("create");
        }}
        onSelect={(id) => {
          soundEffects.press();
          view(id);
        }}
      />

      <div className="lg:col-span-8.5 flex h-full flex-col overflow-y-auto md:col-span-8">
        {mode === "create" || (mode === "edit" && activeDoc) ? (
          <DocEditor
            key={mode === "edit" ? activeDoc.id : "new"}
            groupId={groupId}
            doc={mode === "edit" ? activeDoc : undefined}
            onDone={view}
            onCancel={() => view()}
          />
        ) : activeDoc ? (
          <DocReader
            groupId={groupId}
            doc={activeDoc}
            isMember={isMember}
            onEdit={() => {
              soundEffects.press();
              setMode("edit");
            }}
            onDeleted={() => setSelectedDocId(null)}
          />
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
