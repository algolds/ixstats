"use client";

import { useState } from "react";
import {
  Newspaper,
  Plus,
  Search,
  Play,
  Eye,
  Trash2,
  ToggleLeft,
  ToggleRight,
  BarChart3,
  RefreshCw,
} from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
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
} from "~/components/ui/dialog";
import { api } from "~/trpc/react";

const DOMAINS = [
  "economic",
  "political",
  "social",
  "military",
  "diplomatic",
  "infrastructure",
  "environmental",
] as const;

const DOMAIN_COLORS: Record<string, string> = {
  economic: "bg-emerald-500/20 text-emerald-400",
  political: "bg-purple-500/20 text-purple-400",
  social: "bg-blue-500/20 text-blue-400",
  military: "bg-red-500/20 text-red-400",
  diplomatic: "bg-cyan-500/20 text-cyan-400",
  infrastructure: "bg-amber-500/20 text-amber-400",
  environmental: "bg-green-500/20 text-green-400",
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: "bg-red-500/20 text-red-400",
  high: "bg-amber-500/20 text-amber-400",
  medium: "bg-blue-500/20 text-blue-400",
  low: "bg-slate-500/20 text-slate-400",
};

export default function NationalIssuesAdminPage() {
  const [domainFilter, setDomainFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [previewModal, setPreviewModal] = useState<{
    templateId: string;
    countryId: string;
  } | null>(null);
  const [forceGenCountryId, setForceGenCountryId] = useState("");
  const [forceGenTemplateId, setForceGenTemplateId] = useState("");
  const [showStats, setShowStats] = useState(false);

  // Fetch templates
  const {
    data: templatesData,
    isLoading,
    refetch,
  } = api.nationalIssues.getTemplates.useQuery({
    domain: domainFilter !== "all" ? domainFilter : undefined,
    search: search || undefined,
    limit: 100,
  });

  // Fetch countries for preview/force-gen
  const { data: countriesData } = api.countries.getAll.useQuery(undefined);
  const countries = countriesData?.countries;

  // Fetch stats
  const { data: stats } = api.nationalIssues.getGenerationStats.useQuery(
    { days: 7 },
    { enabled: showStats }
  );

  // Preview template
  const { data: previewData, isLoading: isPreviewLoading } =
    api.nationalIssues.previewTemplate.useQuery(
      {
        templateId: previewModal?.templateId ?? "",
        countryId: previewModal?.countryId ?? "",
      },
      { enabled: !!previewModal }
    );

  // Mutations
  const toggleActive = api.nationalIssues.toggleTemplateActive.useMutation({
    onSuccess: () => void refetch(),
  });

  const deleteTemplate = api.nationalIssues.deleteTemplate.useMutation({
    onSuccess: () => void refetch(),
  });

  const forceGenerate = api.nationalIssues.forceGenerate.useMutation();

  const templates = templatesData?.templates ?? [];

  // Domain summary
  const domainCounts = templates.reduce(
    (acc, t) => {
      acc[t.domain] = (acc[t.domain] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-amber-500/20 p-2">
              <Newspaper className="h-6 w-6 text-amber-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">National Issues Engine</h1>
              <p className="text-muted-foreground text-sm">
                Manage issue templates, preview, and diagnostics
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowStats(!showStats)}
            >
              <BarChart3 className="h-4 w-4 mr-1" />
              Stats
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void refetch()}
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Stats Panel */}
        {showStats && stats && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <h3 className="text-sm font-semibold mb-3">
              Generation Stats (Last 7 Days)
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard
                label="Evaluations"
                value={stats.totalEvaluations}
              />
              <StatCard
                label="Issues Generated"
                value={stats.totalIssuesGenerated}
              />
              <StatCard
                label="Avg Exec Time"
                value={`${stats.avgExecutionTime}ms`}
              />
              <StatCard
                label="Templates"
                value={templates.length}
              />
            </div>
            {stats.domainStats.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {stats.domainStats.map((d: any) => (
                  <Badge
                    key={d.domain}
                    variant="outline"
                    className={`text-xs ${DOMAIN_COLORS[d.domain] ?? ""}`}
                  >
                    {d.domain}: {d._count.id}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Force Generate Panel */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <h3 className="text-sm font-semibold mb-2">Force Generate Issue</h3>
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground">Country</label>
              <Select
                value={forceGenCountryId}
                onValueChange={setForceGenCountryId}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select country..." />
                </SelectTrigger>
                <SelectContent>
                  {countries?.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <label className="text-xs text-muted-foreground">Template</label>
              <Select
                value={forceGenTemplateId}
                onValueChange={setForceGenTemplateId}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select template..." />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.slug}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              size="sm"
              className="h-8"
              disabled={
                !forceGenCountryId ||
                !forceGenTemplateId ||
                forceGenerate.isPending
              }
              onClick={() =>
                forceGenerate.mutate({
                  templateId: forceGenTemplateId,
                  countryId: forceGenCountryId,
                })
              }
            >
              <Play className="h-3 w-3 mr-1" />
              {forceGenerate.isPending ? "..." : "Generate"}
            </Button>
          </div>
          {forceGenerate.data && (
            <p className="mt-2 text-xs text-green-400">
              Issue created: {forceGenerate.data.issueId}
            </p>
          )}
        </div>

        {/* Filters */}
        <div className="flex gap-3 items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search templates..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-8 text-sm"
            />
          </div>
          <Select
            value={domainFilter}
            onValueChange={setDomainFilter}
          >
            <SelectTrigger className="w-40 h-8 text-xs">
              <SelectValue placeholder="All domains" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All domains</SelectItem>
              {DOMAINS.map((d) => (
                <SelectItem key={d} value={d}>
                  {d} ({domainCounts[d] ?? 0})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Badge variant="outline" className="text-xs">
            {templates.length} templates
          </Badge>
        </div>

        {/* Template List */}
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">
            Loading templates...
          </div>
        ) : templates.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No templates found. Seed the database to get started.
          </div>
        ) : (
          <div className="space-y-2">
            {templates.map((template) => (
              <div
                key={template.id}
                className={`rounded-lg border p-3 transition-all ${
                  template.isActive
                    ? "border-white/10 hover:border-white/20"
                    : "border-white/5 opacity-60"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-muted-foreground">
                        {template.slug}
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${DOMAIN_COLORS[template.domain] ?? ""}`}
                      >
                        {template.domain}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${SEVERITY_COLORS[template.baseSeverity as string] ?? ""}`}
                      >
                        {(template.baseSeverity as string).toUpperCase()}
                      </Badge>
                      {template.deadlineDaysBase && (
                        <Badge
                          variant="outline"
                          className="text-[10px] bg-red-500/10 text-red-400"
                        >
                          {template.deadlineDaysBase}d deadline
                        </Badge>
                      )}
                      <span className="text-[10px] text-muted-foreground">
                        {(template as any)._count?.instances ?? 0} instances
                      </span>
                    </div>
                    <h4 className="text-sm font-medium truncate">
                      {template.title}
                    </h4>
                    <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                      {template.description}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {forceGenCountryId && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        title="Preview"
                        onClick={() =>
                          setPreviewModal({
                            templateId: template.id,
                            countryId: forceGenCountryId,
                          })
                        }
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      title={
                        template.isActive ? "Deactivate" : "Activate"
                      }
                      onClick={() =>
                        toggleActive.mutate({
                          id: template.id,
                          isActive: !template.isActive,
                        })
                      }
                    >
                      {template.isActive ? (
                        <ToggleRight className="h-3.5 w-3.5 text-green-400" />
                      ) : (
                        <ToggleLeft className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-red-400 hover:text-red-300"
                      title="Delete"
                      onClick={() => {
                        if (
                          confirm(
                            `Delete template "${template.slug}"?`
                          )
                        ) {
                          deleteTemplate.mutate({ id: template.id });
                        }
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Preview Modal */}
        <Dialog
          open={!!previewModal}
          onOpenChange={(open) => !open && setPreviewModal(null)}
        >
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>Template Preview</DialogTitle>
            </DialogHeader>
            {isPreviewLoading ? (
              <div className="py-4 text-center text-muted-foreground">
                Evaluating...
              </div>
            ) : previewData ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      previewData.triggersPassed ? "default" : "outline"
                    }
                    className={
                      previewData.triggersPassed
                        ? "bg-green-500/20 text-green-400"
                        : "bg-red-500/20 text-red-400"
                    }
                  >
                    Triggers:{" "}
                    {previewData.triggersPassed ? "PASSED" : "FAILED"}
                  </Badge>
                </div>
                <div className="rounded-lg border border-white/10 p-3">
                  <h4 className="font-medium text-sm mb-1">
                    {previewData.rendered.title}
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    {previewData.rendered.description}
                  </p>
                  {previewData.rendered.longDescription && (
                    <p className="text-xs text-muted-foreground mt-2 whitespace-pre-line border-l-2 border-white/10 pl-2">
                      {previewData.rendered.longDescription}
                    </p>
                  )}
                </div>
                <div>
                  <h5 className="text-xs font-medium mb-1">
                    Response Options:
                  </h5>
                  <div className="space-y-1.5">
                    {previewData.rendered.responseOptions.map(
                      (opt: any, i: number) => (
                        <div
                          key={i}
                          className="rounded border border-white/10 p-2"
                        >
                          <span className="text-xs font-medium">
                            {opt.label}
                          </span>
                          <p className="text-[10px] text-muted-foreground">
                            {opt.description}
                          </p>
                        </div>
                      )
                    )}
                  </div>
                </div>
                <div className="text-[10px] text-muted-foreground">
                  Country: {previewData.snapshot.name} | GDP:{" "}
                  {previewData.snapshot.gdp?.toLocaleString()} | Approval:{" "}
                  {previewData.snapshot.approval}%
                </div>
              </div>
            ) : null}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-lg bg-white/5 border border-white/10 px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-bold">{value}</div>
    </div>
  );
}
