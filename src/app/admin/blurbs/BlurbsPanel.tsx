// src/app/admin/blurbs/BlurbsPanel.tsx
// Blurbs Topic & Community Prompt Management Suite
"use client";

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
        <TabsList className="bg-card/40 border-border/40 mb-4 flex w-full max-w-md justify-start gap-1 rounded-xl border p-1 backdrop-blur-md">
          <TabsTrigger
            value="prompts"
            className="flex-1 flex items-center justify-center gap-2 text-xs font-semibold active:scale-[0.98] transition-transform"
          >
            <FileText className="h-4 w-4 text-cyan-400" />
            Prompt Catalog
          </TabsTrigger>
          <TabsTrigger
            value="moderation"
            className="flex-1 flex items-center justify-center gap-2 text-xs font-semibold active:scale-[0.98] transition-transform"
          >
            <MessageCircle className="h-4 w-4 text-purple-400" />
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
      <div className="rounded-2xl border border-border/30 bg-card/25 p-3.5 backdrop-blur-md shadow-xs">
        <p className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider">Total Responses</p>
        {countLoading ? (
          <Skeleton className="h-7 w-16 mt-1" />
        ) : (
          <p className="text-foreground mt-1 font-mono text-xl font-bold tracking-tight">
            {(blurbCount ?? 0).toLocaleString()}
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-border/30 bg-card/25 p-3.5 backdrop-blur-md shadow-xs">
        <p className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider">Active Prompts</p>
        {activeLoading ? (
          <Skeleton className="h-7 w-16 mt-1" />
        ) : (
          <p className="text-emerald-400 mt-1 font-mono text-xl font-bold tracking-tight">
            {activePrompts?.length ?? 0}
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-border/30 bg-card/25 p-3.5 backdrop-blur-md shadow-xs">
        <p className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider">All Prompts Catalog</p>
        {allLoading ? (
          <Skeleton className="h-7 w-16 mt-1" />
        ) : (
          <p className="text-cyan-400 mt-1 font-mono text-xl font-bold tracking-tight">
            {allPrompts?.length ?? 0}
          </p>
        )}
      </div>
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
            <Search className="text-muted-foreground absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2" />
            <Input
              placeholder="Search prompts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 rounded-xl border-border/30 bg-background/50 pl-8 text-xs backdrop-blur-md"
            />
          </div>

          <div className="flex gap-1">
            {[undefined, "ACTIVE", "DRAFT", "CLOSED", "ARCHIVED"].map((s) => (
              <Button
                key={s ?? "all"}
                variant={statusFilter === s ? "default" : "ghost"}
                size="sm"
                className="h-8 rounded-xl px-2.5 text-xs font-semibold active:scale-[0.98]"
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
            <Button size="sm" className="h-8 rounded-xl px-3.5 text-xs font-semibold active:scale-[0.98] transition-transform">
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              New Prompt
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md rounded-2xl border-border/30 bg-card/95 backdrop-blur-md">
            <DialogHeader>
              <DialogTitle className="text-sm font-bold">Create Community Topic Prompt</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-3">
              <div className="space-y-1.5">
                <Label className="text-foreground text-xs font-medium">Title</Label>
                <Input
                  value={form.title}
                  onChange={(e) => {
                    const title = e.target.value;
                    setForm((prev) => ({
                      ...prev,
                      title,
                      slug: !prev.slug || prev.slug === autoSlug(prev.title) ? autoSlug(title) : prev.slug,
                    }));
                  }}
                  placeholder="Topic Tuesday: National Cuisine"
                  className="h-8 rounded-xl border-border/30 bg-background/50 text-xs"
                  maxLength={200}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-foreground text-xs font-medium">Question / Description</Label>
                <Textarea
                  value={form.question}
                  onChange={(e) => setForm((prev) => ({ ...prev, question: e.target.value }))}
                  placeholder="What is your realm's national dish, and how is it prepared?"
                  rows={3}
                  className="rounded-xl border-border/30 bg-background/50 text-xs"
                  maxLength={500}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-foreground text-xs font-medium">URL Slug</Label>
                <Input
                  value={form.slug}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      slug: e.target.value.replace(/[^a-z0-9-]/g, ""),
                    }))
                  }
                  placeholder="topic-tuesday-cuisine"
                  className="h-8 rounded-xl border-border/30 bg-background/50 text-xs font-mono"
                  maxLength={100}
                />
              </div>

              <div className="flex items-center justify-between rounded-xl border border-border/20 bg-background/30 p-3">
                <Label className="text-xs font-medium">Publish Immediately</Label>
                <Switch
                  checked={form.publishNow}
                  onCheckedChange={(val) => setForm((prev) => ({ ...prev, publishNow: val }))}
                  className="scale-90"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setIsCreateOpen(false)} className="h-8 rounded-xl px-3 text-xs">
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
                disabled={!form.title.trim() || !form.question.trim() || !form.slug.trim() || createMutation.isPending}
                className="h-8 rounded-xl px-3.5 text-xs font-semibold active:scale-[0.98]"
              >
                {createMutation.isPending ? "Creating..." : "Create Prompt"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-2.5">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-xl" />
            ))}
          </div>
        ) : !filteredPrompts || filteredPrompts.length === 0 ? (
          <div className="rounded-2xl border border-border/30 bg-card/25 p-8 text-center backdrop-blur-md">
            <p className="text-muted-foreground text-xs">No prompts found matching query.</p>
          </div>
        ) : (
          filteredPrompts.map((prompt) => {
            const config = STATUS_CONFIG[prompt.status];
            const StatusIcon = config.icon;
            return (
              <div
                key={prompt.id}
                className="rounded-2xl border border-border/30 bg-card/25 p-3.5 backdrop-blur-md shadow-xs flex flex-col justify-between gap-3 sm:flex-row sm:items-center hover:border-border/50 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="rounded-xl bg-primary/10 p-2 text-primary">
                    <StatusIcon className="h-4 w-4 shrink-0" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-foreground truncate text-xs font-bold">{prompt.title}</span>
                      <Badge variant={config.variant} className="text-[10px]">
                        {config.label}
                      </Badge>
                      {prompt.featured && (
                        <Badge
                          variant="outline"
                          className="border-amber-500/30 bg-amber-500/10 text-amber-400 text-[10px]"
                        >
                          Featured
                        </Badge>
                      )}
                    </div>
                    <p className="text-muted-foreground truncate text-[11px] mt-0.5">{prompt.question}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-muted-foreground font-mono text-xs">
                    {prompt._count.responses} responses
                  </span>

                  <div className="flex items-center gap-1">
                    {prompt.status === "ACTIVE" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className={`h-7 w-7 p-0 rounded-lg ${prompt.featured ? "text-amber-400" : "text-muted-foreground hover:text-foreground"}`}
                        onClick={() =>
                          featureMutation.mutate({
                            promptId: prompt.id,
                            featured: !prompt.featured,
                          })
                        }
                        disabled={featureMutation.isPending}
                        title={prompt.featured ? "Unfeature" : "Feature"}
                      >
                        {prompt.featured ? <StarOff className="h-3.5 w-3.5" /> : <Star className="h-3.5 w-3.5" />}
                      </Button>
                    )}

                    {prompt.status === "DRAFT" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 rounded-lg px-2.5 text-xs active:scale-[0.98]"
                        onClick={() => updateMutation.mutate({ id: prompt.id, status: "ACTIVE" })}
                      >
                        Publish
                      </Button>
                    )}

                    {prompt.status === "ACTIVE" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 rounded-lg px-2.5 text-xs text-amber-400 hover:bg-amber-500/10 active:scale-[0.98]"
                        onClick={() => updateMutation.mutate({ id: prompt.id, status: "CLOSED" })}
                      >
                        Close
                      </Button>
                    )}

                    {(prompt.status === "CLOSED" || prompt.status === "DRAFT") && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 rounded-lg px-2.5 text-xs text-muted-foreground active:scale-[0.98]"
                        onClick={() => updateMutation.mutate({ id: prompt.id, status: "ARCHIVED" })}
                      >
                        Archive
                      </Button>
                    )}
                  </div>
                </div>
              </div>
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
    <div className="rounded-2xl border border-border/30 bg-card/25 p-5 backdrop-blur-md shadow-xs space-y-4">
      <div className="max-w-md space-y-1.5 border-b border-border/20 pb-4">
        <Label className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider">Select Discussion Prompt</Label>
        <Select value={selectedPromptId} onValueChange={setSelectedPromptId}>
          <SelectTrigger className="h-8 rounded-xl border-border/30 bg-background/50 text-xs">
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
        <p className="text-muted-foreground p-8 text-center text-xs">
          Select a prompt from the dropdown above to inspect and moderate replies.
        </p>
      ) : responsesLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : responses.length === 0 ? (
        <p className="text-muted-foreground p-8 text-center text-xs">No responses posted for this topic yet.</p>
      ) : (
        <div className="space-y-2.5">
          {responses.map((r) => (
            <div
              key={r.id}
              className={`rounded-xl border p-3.5 backdrop-blur-md ${
                r.featured ? "border-amber-500/30 bg-amber-500/5" : "border-border/20 bg-background/30"
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <div className="rounded-lg bg-primary/10 p-1 text-primary">
                    <User className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-foreground text-xs font-bold">{r.country?.name ?? "Unknown Realm"}</span>
                  {r.featured && (
                    <Badge
                      variant="outline"
                      className="border-amber-500/30 bg-amber-500/10 text-amber-400 text-[10px]"
                    >
                      Featured
                    </Badge>
                  )}
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 rounded-lg"
                  onClick={() => featureMutation.mutate({ responseId: r.id, featured: !r.featured })}
                  disabled={featureMutation.isPending}
                >
                  {r.featured ? (
                    <StarOff className="h-3.5 w-3.5 text-amber-400" />
                  ) : (
                    <Star className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                </Button>
              </div>

              <p className="text-muted-foreground text-xs leading-relaxed whitespace-pre-wrap">{r.content}</p>
              <span className="text-muted-foreground/60 font-mono text-[10px] block mt-2">
                {new Date(r.createdAt).toLocaleDateString()}
              </span>
            </div>
          ))}

          {hasNextPage && (
            <div className="pt-2 text-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchNextPage()}
                className="h-8 rounded-xl px-3.5 text-xs font-semibold active:scale-[0.98]"
              >
                Load More Responses
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default BlurbsPanel;
