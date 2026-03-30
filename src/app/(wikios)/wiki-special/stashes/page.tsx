// src/app/(wikios)/wiki-special/stashes/page.tsx
// Lore Stash manager — browse, organize, and annotate saved wiki pages.

"use client";

import { useState } from "react";
import Link from "next/link";
import { withBasePath } from "~/lib/base-path";
import { api } from "~/trpc/react";
import { WikiOSLayout } from "~/components/wikios/shared/WikiOSLayout";
import {
  Bookmark, Plus, Trash2, Pencil, X, Check,
  Clock, StickyNote, Highlighter, Loader2, AlertCircle,
  ArrowRight, BookOpen, FolderOpen, Hash,
} from "lucide-react";
import { cn } from "~/lib/utils";

const PRESET_COLORS = [
  "#3b82f6", "#8b5cf6", "#ec4899", "#ef4444",
  "#f97316", "#eab308", "#22c55e", "#06b6d4",
];

export default function StashesPage() {
  const [selectedStashId, setSelectedStashId] = useState<string | null>(null);
  const [editingStash, setEditingStash] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#3b82f6");
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const utils = api.useUtils();

  const stashesQuery = api.wikios.getStashes.useQuery();
  const createMutation = api.wikios.createStash.useMutation({
    onSuccess: (data) => {
      utils.wikios.getStashes.invalidate();
      setNewName(""); setNewColor("#3b82f6"); setShowCreate(false); setError(null);
      setSelectedStashId(data.id);
    },
    onError: (err) => setError(err.message ?? "Failed to create"),
  });
  const updateMutation = api.wikios.updateStash.useMutation({
    onSuccess: () => { utils.wikios.getStashes.invalidate(); setEditingStash(null); },
    onError: (err) => setError(err.message ?? "Failed to update"),
  });
  const deleteMutation = api.wikios.deleteStash.useMutation({
    onSuccess: () => { utils.wikios.getStashes.invalidate(); setSelectedStashId(null); setConfirmDelete(null); },
    onError: (err) => setError(err.message ?? "Failed to delete"),
  });

  const stashes = stashesQuery.data ?? [];
  const activeStash = selectedStashId ? stashes.find((s) => s.id === selectedStashId) : stashes[0];

  const itemsQuery = api.wikios.getStashItems.useQuery(
    { stashId: activeStash?.id ?? "", limit: 50 },
    { enabled: !!activeStash?.id }
  );

  const unstashMutation = api.wikios.unstashPage.useMutation({
    onSuccess: () => { utils.wikios.getStashItems.invalidate(); utils.wikios.getStashes.invalidate(); },
  });

  const items = itemsQuery.data?.items ?? [];
  const totalPages = stashes.reduce((sum, s) => sum + s.itemCount, 0);

  const handleCreate = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    if (stashes.some((s) => s.name.toLowerCase() === trimmed.toLowerCase())) {
      setError(`"${trimmed}" already exists`); return;
    }
    setError(null);
    createMutation.mutate({ name: trimmed, color: newColor });
  };

  return (
    <WikiOSLayout>
      <div className="wikios-special-page">
        {/* Header */}
        <div className="wikios-stashes-page-header">
          <div>
            <h1 className="wikios-stashes-page-title"><Bookmark size={22} /> Lore Stashes</h1>
            <p className="wikios-stashes-page-subtitle">
              {totalPages} {totalPages === 1 ? "page" : "pages"} across {stashes.length} {stashes.length === 1 ? "stash" : "stashes"}
            </p>
          </div>
          {!showCreate && stashes.length > 0 && (
            <button onClick={() => setShowCreate(true)} className="wikios-stashes-create-btn">
              <Plus size={14} /> New Stash
            </button>
          )}
        </div>

        {error && (
          <div className="wikios-stash-error-banner">
            <AlertCircle size={14} /> {error}
            <button onClick={() => setError(null)} className="wikios-stash-error-dismiss"><X size={12} /></button>
          </div>
        )}

        {stashesQuery.isLoading && (
          <div className="wikios-stashes-loading"><Loader2 size={24} className="animate-spin opacity-40" /><span>Loading your stashes...</span></div>
        )}

        {/* Empty state */}
        {!stashesQuery.isLoading && stashes.length === 0 && !showCreate && (
          <div className="wikios-stashes-empty-state">
            <div className="wikios-stashes-empty-icon"><Bookmark size={40} /></div>
            <h2>Start your Lore Stash</h2>
            <p>Save wiki pages to read later, add personal notes, and highlight text with the Markup tool for your worldbuilding research.</p>
            <div className="wikios-stashes-empty-features">
              <div className="wikios-stashes-feature">
                <BookOpen size={16} />
                <div>
                  <strong>Save for later</strong>
                  <span>Bookmark pages across color-coded collections</span>
                </div>
              </div>
              <div className="wikios-stashes-feature">
                <StickyNote size={16} />
                <div>
                  <strong>Personal notes</strong>
                  <span>Add rich text notes to any saved page</span>
                </div>
              </div>
              <div className="wikios-stashes-feature">
                <Highlighter size={16} />
                <div>
                  <strong>Markup tool</strong>
                  <span>Highlight and annotate text directly on articles</span>
                </div>
              </div>
            </div>
            <button onClick={() => setShowCreate(true)} className="wikios-stashes-empty-action">
              <Plus size={14} /> Create your first stash
            </button>
          </div>
        )}

        {/* Create form */}
        {showCreate && (
          <div className="wikios-stash-create-card">
            <h3 className="wikios-stash-create-title">Create a new Lore Stash</h3>
            <input
              type="text" value={newName}
              onChange={(e) => { setNewName(e.target.value); setError(null); }}
              placeholder="e.g. Characters, Geography, Timeline, Magic System..."
              className="wikios-stash-create-input-lg" autoFocus maxLength={100}
              onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") setShowCreate(false); }}
            />
            <div className="wikios-stash-create-color-row">
              <span className="wikios-stash-create-color-label">Color:</span>
              {PRESET_COLORS.map((c) => (
                <button key={c} onClick={() => setNewColor(c)} className={cn("wikios-stash-preset-color-lg", newColor === c && "wikios-stash-preset-active-lg")} style={{ background: c }} />
              ))}
            </div>
            <div className="wikios-stash-create-actions-lg">
              <button onClick={() => { setShowCreate(false); setError(null); }} className="wikios-stash-btn-secondary">Cancel</button>
              <button onClick={handleCreate} className="wikios-stash-btn-primary" disabled={!newName.trim() || createMutation.isPending}>
                {createMutation.isPending && <Loader2 size={13} className="animate-spin" />}
                {createMutation.isPending ? "Creating..." : "Create Stash"}
              </button>
            </div>
          </div>
        )}

        {/* Main layout */}
        {stashes.length > 0 && (
          <div className="wikios-stashes-layout">
            {/* Sidebar */}
            <div className="wikios-stashes-sidebar">
              <div className="wikios-stashes-sidebar-label">Your Stashes</div>
              {stashes.map((s) => (
                <div key={s.id} className="wikios-stash-sidebar-item-wrapper">
                  {editingStash === s.id ? (
                    <div className="wikios-stash-edit-inline">
                      <input value={editName} onChange={(e) => setEditName(e.target.value)} className="wikios-stash-edit-input" autoFocus
                        onKeyDown={(e) => { if (e.key === "Enter") updateMutation.mutate({ id: s.id, name: editName, color: editColor }); if (e.key === "Escape") setEditingStash(null); }} />
                      <div className="wikios-stash-edit-colors">
                        {PRESET_COLORS.map((c) => (<button key={c} onClick={() => setEditColor(c)} className={cn("wikios-stash-preset-color", editColor === c && "wikios-stash-preset-active")} style={{ background: c }} />))}
                      </div>
                      <div className="wikios-stash-edit-actions">
                        <button onClick={() => updateMutation.mutate({ id: s.id, name: editName, color: editColor })} className="wikios-stash-btn-primary-sm" disabled={updateMutation.isPending}>
                          {updateMutation.isPending ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />} Save
                        </button>
                        <button onClick={() => setEditingStash(null)} className="wikios-stash-btn-secondary-sm"><X size={11} /></button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setSelectedStashId(s.id)} className={cn("wikios-stash-sidebar-item", activeStash?.id === s.id && "wikios-stash-sidebar-active")}>
                      <span className="wikios-stash-sidebar-color" style={{ background: s.color }} />
                      <span className="wikios-stash-sidebar-name">{s.name}</span>
                      <span className="wikios-stash-sidebar-count">{s.itemCount}</span>
                    </button>
                  )}
                  {editingStash !== s.id && (
                    <div className="wikios-stash-sidebar-actions">
                      <button onClick={() => { setEditingStash(s.id); setEditName(s.name); setEditColor(s.color); }} className="wikios-stash-sidebar-action" title="Edit"><Pencil size={11} /></button>
                      {!s.isDefault && (
                        confirmDelete === s.id ? (
                          <div className="wikios-stash-confirm-delete">
                            <button onClick={() => deleteMutation.mutate({ id: s.id })} className="wikios-stash-confirm-yes" title="Confirm">
                              {deleteMutation.isPending ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                            </button>
                            <button onClick={() => setConfirmDelete(null)} className="wikios-stash-confirm-no" title="Cancel"><X size={11} /></button>
                          </div>
                        ) : (
                          <button onClick={() => setConfirmDelete(s.id)} className="wikios-stash-sidebar-action wikios-stash-sidebar-delete" title="Delete"><Trash2 size={11} /></button>
                        )
                      )}
                    </div>
                  )}
                </div>
              ))}

              {/* Add new stash inline */}
              <button onClick={() => setShowCreate(true)} className="wikios-stash-sidebar-add">
                <Plus size={12} /> New stash
              </button>
            </div>

            {/* Main content */}
            <div className="wikios-stashes-main">
              {activeStash && (
                <div className="wikios-stashes-content-header">
                  <div className="wikios-stashes-content-title-row">
                    <span className="wikios-stash-header-swatch" style={{ background: activeStash.color }} />
                    <h2 className="wikios-stashes-stash-name">{activeStash.name}</h2>
                  </div>
                  <div className="wikios-stashes-content-stats">
                    <span><Hash size={12} /> {activeStash.itemCount} {activeStash.itemCount === 1 ? "page" : "pages"}</span>
                  </div>
                </div>
              )}

              {itemsQuery.isLoading && (
                <div className="wikios-stashes-loading-sm"><Loader2 size={16} className="animate-spin opacity-40" /></div>
              )}

              {items.length === 0 && !itemsQuery.isLoading && activeStash && (
                <div className="wikios-stashes-empty-stash">
                  <FolderOpen size={36} className="opacity-15" />
                  <p>This stash is empty</p>
                  <p className="wikios-stashes-empty-hint">
                    Browse wiki articles and click <Bookmark size={12} className="inline" /> <strong>Stash</strong> to save pages here.
                    <br />
                    Use the <Highlighter size={12} className="inline" /> <strong>Markup</strong> tool on stashed pages to highlight and annotate text.
                  </p>
                </div>
              )}

              <div className="wikios-stashes-items">
                {items.map((item) => (
                  <div key={item.id} className="wikios-stash-item-card">
                    <Link href={withBasePath(`/w/${item.pageSlug}`)} className="wikios-stash-item-link">
                      <div className="wikios-stash-item-info">
                        <span className="wikios-stash-item-title">{item.pageTitle.replace(/_/g, " ")}</span>
                        <div className="wikios-stash-item-meta">
                          <span><Clock size={10} /> {new Date(item.savedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                          {item.annotationCount > 0 && (
                            <span className="wikios-stash-item-badge wikios-stash-item-badge-highlight">
                              <Highlighter size={10} /> {item.annotationCount} highlight{item.annotationCount !== 1 ? "s" : ""}
                            </span>
                          )}
                          {item.note && (
                            <span className="wikios-stash-item-badge wikios-stash-item-badge-note">
                              <StickyNote size={10} /> Has note
                            </span>
                          )}
                        </div>
                      </div>
                      <ArrowRight size={14} className="wikios-stash-item-arrow" />
                    </Link>
                    {item.note && (
                      <div className="wikios-stash-item-note" dangerouslySetInnerHTML={{ __html: item.note }} />
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); unstashMutation.mutate({ pageTitle: item.pageTitle, stashId: activeStash?.id }); }}
                      className="wikios-stash-item-remove" title="Remove from stash"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </WikiOSLayout>
  );
}
