"use client";
export const dynamic = "force-dynamic";

import { useState } from "react";
import { usePageTitle } from "~/hooks/usePageTitle";
import { AdminHeader } from "../_components/AdminHeader";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Input } from "~/components/ui/input";
import { api } from "~/trpc/react";
import {
  MessageCircle,
  Plus,
  Star,
  StarOff,
  Archive,
  CheckCircle,
  Clock,
  FileText,
} from "lucide-react";

// ── Create / Edit Prompt Form ────────────────────────────────────────────────

function CreatePromptForm({ onDone }: { onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [question, setQuestion] = useState("");
  const [slug, setSlug] = useState("");
  const [publishNow, setPublishNow] = useState(true);

  const utils = api.useUtils();
  const createMutation = api.blurbs.createPrompt.useMutation({
    onSuccess: () => {
      utils.blurbs.getAllPrompts.invalidate();
      utils.blurbs.getBlurbCount.invalidate();
      onDone();
    },
  });

  const autoSlug = (t: string) =>
    t
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 100);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">New Prompt</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <label className="text-muted-foreground mb-1 block text-xs font-medium">
            Title
          </label>
          <Input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (!slug || slug === autoSlug(title)) {
                setSlug(autoSlug(e.target.value));
              }
            }}
            placeholder="Topic Tuesday: Fashion"
            maxLength={200}
          />
        </div>
        <div>
          <label className="text-muted-foreground mb-1 block text-xs font-medium">
            Question
          </label>
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="What kind of clothes are popular in your country?"
            maxLength={500}
            rows={3}
            className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <span className="text-muted-foreground text-xs">{question.length}/500</span>
        </div>
        <div>
          <label className="text-muted-foreground mb-1 block text-xs font-medium">
            Slug
          </label>
          <Input
            value={slug}
            onChange={(e) => setSlug(e.target.value.replace(/[^a-z0-9-]/g, ""))}
            placeholder="topic-tuesday-fashion"
            maxLength={100}
          />
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="publish-now"
            checked={publishNow}
            onChange={(e) => setPublishNow(e.target.checked)}
            className="rounded"
          />
          <label htmlFor="publish-now" className="text-sm">
            Publish immediately
          </label>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" size="sm" onClick={onDone}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() =>
              createMutation.mutate({
                title,
                question,
                slug,
                status: publishNow ? "ACTIVE" : "DRAFT",
              })
            }
            disabled={
              !title.trim() ||
              !question.trim() ||
              !slug.trim() ||
              createMutation.isPending
            }
          >
            {createMutation.isPending ? "Creating..." : "Create Prompt"}
          </Button>
        </div>
        {createMutation.error && (
          <p className="text-destructive text-xs">{createMutation.error.message}</p>
        )}
      </CardContent>
    </Card>
  );
}

// ── Prompt Management Table ──────────────────────────────────────────────────

const STATUS_CONFIG = {
  DRAFT: { label: "Draft", icon: FileText, variant: "secondary" as const },
  ACTIVE: { label: "Active", icon: CheckCircle, variant: "default" as const },
  CLOSED: { label: "Closed", icon: Clock, variant: "outline" as const },
  ARCHIVED: { label: "Archived", icon: Archive, variant: "outline" as const },
};

function PromptManagementSection() {
  const [statusFilter, setStatusFilter] = useState<
    "DRAFT" | "ACTIVE" | "CLOSED" | "ARCHIVED" | undefined
  >(undefined);

  const { data: prompts, isLoading } = api.blurbs.getAllPrompts.useQuery({
    status: statusFilter,
    limit: 100,
  });

  const utils = api.useUtils();

  const updateMutation = api.blurbs.updatePrompt.useMutation({
    onSuccess: () => {
      utils.blurbs.getAllPrompts.invalidate();
      utils.blurbs.getActivePrompts.invalidate();
    },
  });

  const featureMutation = api.blurbs.featurePrompt.useMutation({
    onSuccess: () => {
      utils.blurbs.getAllPrompts.invalidate();
    },
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Prompts</CardTitle>
          <div className="flex gap-1">
            {[undefined, "ACTIVE", "DRAFT", "CLOSED", "ARCHIVED"].map((s) => (
              <Button
                key={s ?? "all"}
                variant={statusFilter === s ? "default" : "ghost"}
                size="sm"
                className="text-xs"
                onClick={() =>
                  setStatusFilter(
                    s as "DRAFT" | "ACTIVE" | "CLOSED" | "ARCHIVED" | undefined
                  )
                }
              >
                {s ?? "All"}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <p className="text-muted-foreground py-4 text-center text-sm">
            Loading...
          </p>
        )}

        {!isLoading && (!prompts || prompts.length === 0) && (
          <p className="text-muted-foreground py-4 text-center text-sm">
            No prompts found.
          </p>
        )}

        <div className="space-y-2">
          {prompts?.map((prompt) => {
            const config = STATUS_CONFIG[prompt.status];
            const StatusIcon = config.icon;
            return (
              <div
                key={prompt.id}
                className="flex items-center gap-3 rounded-lg border p-3"
              >
                <StatusIcon className="text-muted-foreground h-4 w-4 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">
                      {prompt.title}
                    </span>
                    <Badge variant={config.variant} className="text-[10px] shrink-0">
                      {config.label}
                    </Badge>
                    {prompt.featured && (
                      <Badge variant="outline" className="border-amber-500/30 text-[10px] text-amber-400 shrink-0">
                        Featured
                      </Badge>
                    )}
                  </div>
                  <p className="text-muted-foreground truncate text-xs">
                    {prompt.question}
                  </p>
                </div>
                <div className="text-muted-foreground shrink-0 text-xs">
                  {prompt._count.responses} responses
                </div>
                <div className="flex shrink-0 gap-1">
                  {prompt.status === "ACTIVE" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`h-7 w-7 p-0 ${prompt.featured ? "text-amber-400" : ""}`}
                      onClick={() =>
                        featureMutation.mutate({
                          promptId: prompt.id,
                          featured: !prompt.featured,
                        })
                      }
                      disabled={featureMutation.isPending}
                      title={prompt.featured ? "Remove featured" : "Feature this prompt"}
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
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() =>
                        updateMutation.mutate({
                          id: prompt.id,
                          status: "ACTIVE",
                        })
                      }
                      disabled={updateMutation.isPending}
                    >
                      Publish
                    </Button>
                  )}
                  {prompt.status === "ACTIVE" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() =>
                        updateMutation.mutate({
                          id: prompt.id,
                          status: "CLOSED",
                        })
                      }
                      disabled={updateMutation.isPending}
                    >
                      Close
                    </Button>
                  )}
                  {(prompt.status === "CLOSED" || prompt.status === "DRAFT") && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() =>
                        updateMutation.mutate({
                          id: prompt.id,
                          status: "ARCHIVED",
                        })
                      }
                      disabled={updateMutation.isPending}
                    >
                      Archive
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Response Moderation ──────────────────────────────────────────────────────

function ResponseModerationSection() {
  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(null);

  const { data: prompts } = api.blurbs.getAllPrompts.useQuery({
    limit: 50,
  });

  const {
    data: responsesData,
    isLoading: responsesLoading,
    fetchNextPage,
    hasNextPage,
  } = api.blurbs.getResponsesForPrompt.useInfiniteQuery(
    { promptId: selectedPromptId ?? "", limit: 20, featuredFirst: true },
    {
      enabled: !!selectedPromptId,
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    }
  );

  const utils = api.useUtils();
  const featureMutation = api.blurbs.featureResponse.useMutation({
    onSuccess: () => {
      if (selectedPromptId) {
        utils.blurbs.getResponsesForPrompt.invalidate({
          promptId: selectedPromptId,
        });
      }
    },
  });

  const responses = responsesData?.pages.flatMap((p) => p.responses) ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Responses</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-3">
          <select
            value={selectedPromptId ?? ""}
            onChange={(e) => setSelectedPromptId(e.target.value || null)}
            className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
          >
            <option value="">Select a prompt...</option>
            {prompts?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title} ({p._count.responses} responses)
              </option>
            ))}
          </select>
        </div>

        {!selectedPromptId && (
          <p className="text-muted-foreground py-4 text-center text-sm">
            Select a prompt to view responses.
          </p>
        )}

        {selectedPromptId && responsesLoading && (
          <p className="text-muted-foreground py-4 text-center text-sm">
            Loading...
          </p>
        )}

        {selectedPromptId && !responsesLoading && responses.length === 0 && (
          <p className="text-muted-foreground py-4 text-center text-sm">
            No responses yet.
          </p>
        )}

        <div className="space-y-2">
          {responses.map((r) => (
            <div
              key={r.id}
              className={`rounded-lg border p-3 ${
                r.featured ? "border-amber-500/30 bg-amber-500/5" : ""
              }`}
            >
              <div className="mb-1 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {r.country?.flag && (
                    <img
                      src={r.country.flag}
                      alt=""
                      className="h-3.5 w-5 rounded-sm object-cover"
                    />
                  )}
                  <span className="text-sm font-medium">
                    {r.country?.name ?? "Unknown"}
                  </span>
                  {r.featured && (
                    <Badge
                      variant="outline"
                      className="border-amber-500/30 text-[10px] text-amber-400"
                    >
                      Featured
                    </Badge>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() =>
                    featureMutation.mutate({
                      responseId: r.id,
                      featured: !r.featured,
                    })
                  }
                  disabled={featureMutation.isPending}
                  title={r.featured ? "Remove featured" : "Feature this response"}
                >
                  {r.featured ? (
                    <StarOff className="h-3.5 w-3.5 text-amber-400" />
                  ) : (
                    <Star className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
              <p className="text-muted-foreground whitespace-pre-wrap text-sm">
                {r.content}
              </p>
              <p className="text-muted-foreground/50 mt-1 text-xs">
                {new Date(r.createdAt).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>

        {hasNextPage && (
          <div className="pt-2 text-center">
            <Button variant="ghost" size="sm" onClick={() => fetchNextPage()}>
              Load more
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Stats Summary ────────────────────────────────────────────────────────────

function BlurbStatsSummary() {
  const { data: blurbCount } = api.blurbs.getBlurbCount.useQuery();
  const { data: activePrompts } = api.blurbs.getAllPrompts.useQuery({
    status: "ACTIVE",
  });
  const { data: allPrompts } = api.blurbs.getAllPrompts.useQuery({
    limit: 100,
  });

  const stats = [
    {
      label: "Total Responses",
      value: blurbCount ?? 0,
      icon: MessageCircle,
    },
    {
      label: "Active Prompts",
      value: activePrompts?.length ?? 0,
      icon: CheckCircle,
    },
    {
      label: "Total Prompts",
      value: allPrompts?.length ?? 0,
      icon: FileText,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {stats.map((stat) => (
        <Card key={stat.label}>
          <CardContent className="flex items-center gap-3 p-4">
            <stat.icon className="text-muted-foreground h-5 w-5" />
            <div>
              <p className="text-2xl font-bold">{stat.value}</p>
              <p className="text-muted-foreground text-xs">{stat.label}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function AdminBlurbsPage() {
  usePageTitle({ title: "Admin - Blurbs" });
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div className="space-y-6">
      <AdminHeader
        icon={MessageCircle}
        title="Blurbs"
        description="Manage Topic Tuesday prompts and moderate responses"
      >
        <Button size="sm" onClick={() => setShowCreate(!showCreate)}>
          <Plus className="mr-1 h-4 w-4" />
          New Prompt
        </Button>
      </AdminHeader>

      <BlurbStatsSummary />

      {showCreate && (
        <CreatePromptForm onDone={() => setShowCreate(false)} />
      )}

      <PromptManagementSection />

      <ResponseModerationSection />
    </div>
  );
}
