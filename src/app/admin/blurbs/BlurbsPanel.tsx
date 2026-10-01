"use client";
// src/app/admin/blurbs/BlurbsPanel.tsx
// Blurbs Topic & Community Prompt Management Suite

import { useState } from "react";
import { usePageTitle } from "~/hooks/usePageTitle";
import { AdminHeader } from "../_components/AdminHeader";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Switch } from "~/components/ui/switch";
import { Label } from "~/components/ui/label";
import { Skeleton } from "~/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "~/components/ui/dialog";
import { api } from "~/trpc/react";
import {
  ChatBubble as MessageCircle,
  Plus,
  Star,
  Star as StarOff,
  Archive,
  CheckCircle,
  Clock,
  Page as FileText,
  User,
  Search,
} from "iconoir-react";
import { useNotify } from "~/hooks/useNotify";
import { FacetCard } from "~/components/ui/facet-container";

export function BlurbsPanel() {
  usePageTitle({ title: "Admin - Blurbs & Prompts" });
  const [activeTab, setActiveTab] = useState("prompts");

  return (
    <div className="space-y-6">
      <AdminHeader
        icon={MessageCircle}
        title="Blurbs & Community Prompts"
        description="Oversee weekly Topic Tuesday prompts, publish interactive discussion topics, and moderate community responses."
      />

      <BlurbStatsSummary />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-fill-3 mb-4 flex w-full max-w-md justify-start gap-1 rounded-full p-1">
          <TabsTrigger
            value="prompts"
            className="text-caption flex flex-1 items-center justify-center gap-2 transition-transform active:scale-[0.98]"
          >
            <FileText className="text-teal h-4 w-4" />
            Prompt Catalog
          </TabsTrigger>
          <TabsTrigger
            value="moderation"
            className="text-caption flex flex-1 items-center justify-center gap-2 transition-transform active:scale-[0.98]"
          >
            <MessageCircle className="text-purple h-4 w-4" />
            Response Moderation
          </TabsTrigger>
        </TabsList>

        <TabsContent value="prompts" className="mt-4 focus-visible:outline-none">
          <PromptManagementSection />
        </TabsContent>

        <TabsContent value="moderation" className="mt-4 focus-visible:outline-none">
          <ResponseModerationSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Stats Summary ────────────────────────────────────────────────────────────

function BlurbStatsSummary() {
  const { data: blurbCount, isLoading: countLoading } = api.blurbs.getBlurbCount.useQuery();
  const { data: activePrompts, isLoading: activeLoading } = api.blurbs.getAllPrompts.useQuery({
    status: "ACTIVE",
  });
  const { data: allPrompts, isLoading: allLoading } = api.blurbs.getAllPrompts.useQuery({
    limit: 100,
  });

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <FacetCard className="p-4">
        <p className="text-label-secondary text-eyebrow">Total Responses</p>
        {countLoading ? (
          <Skeleton className="mt-1 h-7 w-16" />
        ) : (
          <p className="text-label text-title-2 mt-1 tabular-nums">
            {(blurbCount ?? 0).toLocaleString()}
          </p>
        )}
      </FacetCard>

      <FacetCard className="p-4">
        <p className="text-label-secondary text-eyebrow">Active Prompts</p>
        {activeLoading ? (
          <Skeleton className="mt-1 h-7 w-16" />
        ) : (
          <p className="text-title-2 text-green mt-1 tabular-nums">{activePrompts?.length ?? 0}</p>
        )}
      </FacetCard>

      <FacetCard className="p-4">
        <p className="text-label-secondary text-eyebrow">All Prompts Catalog</p>
        {allLoading ? (
          <Skeleton className="mt-1 h-7 w-16" />
        ) : (
          <p className="text-title-2 text-teal mt-1 tabular-nums">{allPrompts?.length ?? 0}</p>
        )}
      </FacetCard>
    </div>
  );
}

// ── Prompt Management Section ────────────────────────────────────────────────

const STATUS_CONFIG = {
  DRAFT: { label: "Draft", icon: FileText, variant: "secondary" as const },
  ACTIVE: { label: "Active", icon: CheckCircle, variant: "default" as const },
  CLOSED: { label: "Closed", icon: Clock, variant: "outline" as const },
  ARCHIVED: { label: "Archived", icon: Archive, variant: "outline" as const },
};

function PromptManagementSection() {
  const notify = useNotify();
  const [statusFilter, setStatusFilter] = useState<
    "DRAFT" | "ACTIVE" | "CLOSED" | "ARCHIVED" | undefined
  >(undefined);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const [form, setForm] = useState({
    title: "",
    question: "",
    slug: "",
    publishNow: true,
  });

  const { data: prompts, isLoading } = api.blurbs.getAllPrompts.useQuery({
    status: statusFilter,
    limit: 100,
  });

  const utils = api.useUtils();

  const createMutation = api.blurbs.createPrompt.useMutation({
    onSuccess: () => {
      notify.success("Prompt Created", "New blurb prompt has been registered.");
      utils.blurbs.getAllPrompts.invalidate();
      utils.blurbs.getBlurbCount.invalidate();
      setIsCreateOpen(false);
      setForm({ title: "", question: "", slug: "", publishNow: true });
    },
    onError: (err: { message?: string }) => {
      notify.error("Creation Failed", err.message || "Failed to create prompt.");
    },
  });

  const updateMutation = api.blurbs.updatePrompt.useMutation({
    onSuccess: () => {
      notify.success("Status Updated", "Prompt state successfully refreshed.");
      utils.blurbs.getAllPrompts.invalidate();
      utils.blurbs.getActivePrompts.invalidate();
    },
  });

  const featureMutation = api.blurbs.featurePrompt.useMutation({
    onSuccess: () => {
      notify.success("Pin Toggled", "Featured prompt pin updated.");
      utils.blurbs.getAllPrompts.invalidate();
    },
  });

  const autoSlug = (t: string) =>
    t
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 100);

  const filteredPrompts = prompts?.filter((p) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return p.title.toLowerCase().includes(q) || p.question.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative max-w-sm flex-1">
            <Search className="text-label-secondary absolute top-1/2 left-2 h-3.5 w-3.5 -translate-y-1/2" />
            <Input
              placeholder="Search prompts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="rounded-control-sm md:text-footnote h-(--control-height-sm) pl-8"
            />
          </div>

          <div className="flex gap-1">
            {[undefined, "ACTIVE", "DRAFT", "CLOSED", "ARCHIVED"].map((s) => (
              <Button
                key={s ?? "all"}
                variant={statusFilter === s ? "default" : "ghost"}
                size="sm"

                onClick={() =>
                  setStatusFilter(s as "DRAFT" | "ACTIVE" | "CLOSED" | "ARCHIVED" | undefined)
                }
              >
                {s ?? "All"}
              </Button>
            ))}
          </div>
        </div>

        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-2 h-3.5 w-3.5" />
              New Prompt
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create Community Topic Prompt</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-3">
              <div className="space-y-2">
                <Label className="text-label text-caption">Title</Label>
                <Input
                  value={form.title}
                  onChange={(e) => {
                    const title = e.target.value;
                    setForm((prev) => ({
                      ...prev,
                      title,
                      slug:
                        !prev.slug || prev.slug === autoSlug(prev.title)
                          ? autoSlug(title)
                          : prev.slug,
                    }));
                  }}
                  placeholder="Topic Tuesday: National Cuisine"
                  className="rounded-control-sm md:text-footnote h-(--control-height-sm)"
                  maxLength={200}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-label text-caption">Question / Description</Label>
                <Textarea
                  value={form.question}
                  onChange={(e) => setForm((prev) => ({ ...prev, question: e.target.value }))}
                  placeholder="What is your realm's national dish, and how is it prepared?"
                  rows={3}
                  className="md:text-footnote"
                  maxLength={500}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-label text-caption">URL Slug</Label>
                <Input
                  value={form.slug}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      slug: e.target.value.replace(/[^a-z0-9-]/g, ""),
                    }))
                  }
                  placeholder="topic-tuesday-cuisine"
                  className="rounded-control-sm md:text-footnote h-(--control-height-sm) font-mono"
                  maxLength={100}
                />
              </div>

              <div className="border-separator bg-fill-3 rounded-row flex items-center justify-between border p-3">
                <Label className="text-caption">Publish Immediately</Label>
                <Switch
                  checked={form.publishNow}
                  onCheckedChange={(val) => setForm((prev) => ({ ...prev, publishNow: val }))}
                  className="scale-90"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() =>
                  createMutation.mutate({
                    title: form.title,
                    question: form.question,
                    slug: form.slug,
                    status: form.publishNow ? "ACTIVE" : "DRAFT",
                  })
                }
                disabled={
                  !form.title.trim() ||
                  !form.question.trim() ||
                  !form.slug.trim() ||
                  createMutation.isPending
                }
              >
                {createMutation.isPending ? "Creating..." : "Create Prompt"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-2">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="rounded-row h-14 w-full" />
            ))}
          </div>
        ) : !filteredPrompts || filteredPrompts.length === 0 ? (
          <FacetCard className="p-8 text-center">
            <p className="text-label-secondary text-footnote">No prompts found matching query.</p>
          </FacetCard>
        ) : (
          filteredPrompts.map((prompt) => {
            const config = STATUS_CONFIG[prompt.status];
            const StatusIcon = config.icon;
            return (
              <FacetCard
                key={prompt.id}
                className="hover:border-separator flex flex-col justify-between gap-3 p-4 transition-colors sm:flex-row sm:items-center"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="bg-tint-fill text-tint rounded-row p-2">
                    <StatusIcon className="h-4 w-4 shrink-0" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-label text-caption truncate">{prompt.title}</span>
                      <Badge variant={config.variant}>{config.label}</Badge>
                      {prompt.featured && <Badge variant="yellow">Featured</Badge>}
                    </div>
                    <p className="text-label-secondary text-footnote mt-0.5 truncate">
                      {prompt.question}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-label-secondary text-footnote tabular-nums">
                    {prompt._count.responses} responses
                  </span>

                  <div className="flex items-center gap-1">
                    {prompt.status === "ACTIVE" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className={`rounded-control h-7 w-7 p-0 ${prompt.featured ? "text-yellow" : "text-label-secondary hover:text-label"}`}
                        onClick={() =>
                          featureMutation.mutate({
                            promptId: prompt.id,
                            featured: !prompt.featured,
                          })
                        }
                        disabled={featureMutation.isPending}
                        title={prompt.featured ? "Unfeature" : "Feature"}
                      >
                        {prompt.featured ? (
                          <StarOff className="h-3.5 w-3.5" />
                        ) : (
                          <Star className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    )}

                    {prompt.status === "DRAFT" && (
                      <Button
                        variant="outline"
                        size="sm"

                        onClick={() => updateMutation.mutate({ id: prompt.id, status: "ACTIVE" })}
                      >
                        Publish
                      </Button>
                    )}

                    {prompt.status === "ACTIVE" && (
                      <Button
                        variant="ghost"
                        size="sm"

                        onClick={() => updateMutation.mutate({ id: prompt.id, status: "CLOSED" })}
                      >
                        Close
                      </Button>
                    )}

                    {(prompt.status === "CLOSED" || prompt.status === "DRAFT") && (
                      <Button
                        variant="ghost"
                        size="sm"

                        onClick={() => updateMutation.mutate({ id: prompt.id, status: "ARCHIVED" })}
                      >
                        Archive
                      </Button>
                    )}
                  </div>
                </div>
              </FacetCard>
            );
          })
        )}
      </div>
    </div>
  );
}

// ── Response Moderation Section ──────────────────────────────────────────────

function ResponseModerationSection() {
  const notify = useNotify();
  const [selectedPromptId, setSelectedPromptId] = useState<string>("");

  const { data: prompts } = api.blurbs.getAllPrompts.useQuery({
    limit: 50,
  });

  const {
    data: responsesData,
    isLoading: responsesLoading,
    fetchNextPage,
    hasNextPage,
  } = api.blurbs.getResponsesForPrompt.useInfiniteQuery(
    { promptId: selectedPromptId, limit: 20, featuredFirst: true },
    {
      enabled: !!selectedPromptId,
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    }
  );

  const utils = api.useUtils();
  const featureMutation = api.blurbs.featureResponse.useMutation({
    onSuccess: () => {
      notify.success("Response Pin Toggled", "Response status updated.");
      if (selectedPromptId) {
        utils.blurbs.getResponsesForPrompt.invalidate({ promptId: selectedPromptId });
      }
    },
  });

  const responses = responsesData?.pages.flatMap((p) => p.responses) ?? [];

  return (
    <FacetCard className="space-y-4 p-5">
      <div className="border-separator max-w-md space-y-2 border-b pb-4">
        <Label className="text-label-secondary text-subhead">Select Discussion Prompt</Label>
        <Select value={selectedPromptId} onValueChange={setSelectedPromptId}>
          <SelectTrigger size="sm">
            <SelectValue placeholder="Choose a prompt to view responses..." />
          </SelectTrigger>
          <SelectContent>
            {prompts?.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.title} ({p._count.responses} responses)
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!selectedPromptId ? (
        <p className="text-label-secondary text-footnote p-8 text-center">
          Select a prompt from the dropdown above to inspect and moderate replies.
        </p>
      ) : responsesLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="rounded-row h-16 w-full" />
          ))}
        </div>
      ) : responses.length === 0 ? (
        <p className="text-label-secondary text-footnote p-8 text-center">
          No responses posted for this topic yet.
        </p>
      ) : (
        <div className="space-y-2">
          {responses.map((r) => (
            <div
              key={r.id}
              className={`rounded-row border p-4 ${
                r.featured ? "border-yellow/30 bg-yellow/5" : "border-separator bg-fill-3"
              }`}
            >
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="bg-tint-fill text-tint rounded-control p-1">
                    <User className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-label text-caption">
                    {r.country?.name ?? "Unknown Realm"}
                  </span>
                  {r.featured && <Badge variant="yellow">Featured</Badge>}
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  className="w-7 p-0"
                  onClick={() =>
                    featureMutation.mutate({ responseId: r.id, featured: !r.featured })
                  }
                  disabled={featureMutation.isPending}
                >
                  {r.featured ? (
                    <StarOff className="text-yellow h-3.5 w-3.5" />
                  ) : (
                    <Star className="text-label-secondary h-3.5 w-3.5" />
                  )}
                </Button>
              </div>

              <p className="text-label-secondary text-footnote leading-relaxed whitespace-pre-wrap">
                {r.content}
              </p>
              <span className="text-label-secondary text-footnote mt-2 block tabular-nums">
                {new Date(r.createdAt).toLocaleDateString()}
              </span>
            </div>
          ))}

          {hasNextPage && (
            <div className="pt-2 text-center">
              <Button variant="outline" size="sm" onClick={() => fetchNextPage()}>
                Load More Responses
              </Button>
            </div>
          )}
        </div>
      )}
    </FacetCard>
  );
}

export default BlurbsPanel;
