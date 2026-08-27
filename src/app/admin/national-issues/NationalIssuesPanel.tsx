// src/app/admin/national-issues/NationalIssuesPanel.tsx
// National Issues Admin Panel with Facet styling and single-page routing
"use client";

import { useState, useEffect } from "react";
import {
  Journal as Newspaper,
  Plus,
  Play,
  Trash as Trash2,
  SwitchOff as ToggleLeft,
  SwitchOn as ToggleRight,
  ControlSlider as Sliders,
} from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { api } from "~/trpc/react";
import { TemplateEditorSheet } from "./TemplateEditorSheet";
import { AdminHeader } from "../_components/AdminHeader";
import { usePageTitle } from "~/hooks/usePageTitle";

const DOMAIN_COLORS: Record<string, string> = {
  economic: "bg-emerald-500/20 text-emerald-400 border-emerald-500/20",
  political: "bg-purple-500/20 text-purple-400 border-purple-500/20",
  social: "bg-blue-500/20 text-blue-400 border-blue-500/20",
  military: "bg-red-500/20 text-red-400 border-red-500/20",
  diplomatic: "bg-cyan-500/20 text-cyan-400 border-cyan-500/20",
  infrastructure: "bg-amber-500/20 text-amber-400 border-amber-500/20",
  environmental: "bg-green-500/20 text-green-400 border-green-500/20",
};

const SEVERITY_COLORS: Record<string, string> = {
  trivial: "bg-slate-500/20 text-slate-400 border-slate-500/20",
  minor: "bg-blue-500/20 text-blue-400 border-blue-500/20",
  moderate: "bg-amber-500/20 text-amber-400 border-amber-500/20",
  major: "bg-orange-500/20 text-orange-400 border-orange-500/20",
  critical: "bg-red-500/20 text-red-400 border-red-500/20",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  viewed: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  responded: "bg-green-500/10 text-green-400 border-green-500/20",
  auto_resolved: "bg-slate-500/20 text-slate-400 border-slate-500/20",
  expired: "bg-red-500/10 text-red-400 border-red-500/20",
  dismissed: "bg-slate-500/20 text-slate-400 border-slate-500/20",
};

export function NationalIssuesPanel() {
  usePageTitle({ title: "Admin - National Issues" });

  const [activeTab, setActiveTab] = useState<"templates" | "issues" | "engine">("templates");
  const [domainFilter, setDomainFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [evalCountryId, setEvalCountryId] = useState("");
  const [evalDomain] = useState("all");

  const [editorSheet, setEditorSheet] = useState<{
    isOpen: boolean;
    templateId: string | null;
  }>({ isOpen: false, templateId: null });

  // Engine config limits
  const [maxIssuesPerSession, setMaxIssuesPerSession] = useState(3);
  const [maxIssuesPerWeek, setMaxIssuesPerWeek] = useState(7);

  // Queries
  const { data: countries } = api.countries.getSelectList.useQuery({ limit: 100 });

  const {
    data: templatesData,
    isLoading: isTemplatesLoading,
    refetch: refetchTemplates,
  } = api.nationalIssues.getTemplates.useQuery({
    domain: domainFilter !== "all" ? (domainFilter as any) : undefined,
    search: search.trim() || undefined,
    limit: 100,
  });

  // Fetch stats
  const { data: stats, refetch: refetchStats } = api.nationalIssues.getGenerationStats.useQuery({
    days: 7,
  });

  // Fetch engine config
  const { data: engineConfig, refetch: refetchEngineConfig } =
    api.nationalIssues.getEngineConfig.useQuery();

  // Load saved config
  useEffect(() => {
    if (engineConfig) {
      if (typeof engineConfig.maxIssuesPerSession === "number") {
        setMaxIssuesPerSession(engineConfig.maxIssuesPerSession);
      }
      if (typeof engineConfig.maxIssuesPerWeek === "number") {
        setMaxIssuesPerWeek(engineConfig.maxIssuesPerWeek);
      }
    }
  }, [engineConfig]);

  // Mutations
  const toggleTemplate = api.nationalIssues.toggleTemplateActive.useMutation({
    onSuccess: () => void refetchTemplates(),
  });

  const deleteTemplate = api.nationalIssues.deleteTemplate.useMutation({
    onSuccess: () => void refetchTemplates(),
  });

  const updateEngineConfig = api.nationalIssues.updateEngineConfig.useMutation({
    onSuccess: () => void refetchEngineConfig(),
  });

  const evaluateIssues = api.nationalIssues.triggerEvaluation.useMutation();

  const {
    data: issuesData,
    isLoading: isIssuesLoading,
    refetch: refetchIssues,
  } = api.nationalIssues.getActiveIssues.useQuery({
    limit: 50,
  });

  const handleGlobalRefresh = () => {
    void refetchTemplates();
    void refetchStats();
    void refetchEngineConfig();
    void refetchIssues();
  };

  const handleSaveEngineLimits = () => {
    updateEngineConfig.mutate({
      maxIssuesPerSession,
      maxIssuesPerWeek,
    });
  };

  return (
    <div className="space-y-6">
      <AdminHeader
        icon={Newspaper}
        title="National Issues Management"
        description="Configure dynamic decision trees, conditional generation triggers, and storyteller injections."
      />

      {/* Global Stat Bar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="border-border/30 bg-card/25 rounded-2xl border p-3.5 shadow-xs backdrop-blur-md">
          <p className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
            Total Evaluations
          </p>
          <p className="text-foreground mt-1 font-mono text-xl font-bold tracking-tight">
            {stats?.totalEvaluations ?? "—"}
          </p>
        </div>
        <div className="border-border/30 bg-card/25 rounded-2xl border p-3.5 shadow-xs backdrop-blur-md">
          <p className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
            Generated (7d)
          </p>
          <p className="mt-1 font-mono text-xl font-bold tracking-tight text-cyan-400">
            {stats?.totalIssuesGenerated ?? "—"}
          </p>
        </div>
        <div className="border-border/30 bg-card/25 rounded-2xl border p-3.5 shadow-xs backdrop-blur-md">
          <p className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
            Avg Exec Time
          </p>
          <p className="mt-1 font-mono text-xl font-bold tracking-tight text-emerald-400">
            {stats?.avgExecutionTime ? `${stats.avgExecutionTime}ms` : "—"}
          </p>
        </div>
        <div className="border-border/30 bg-card/25 rounded-2xl border p-3.5 shadow-xs backdrop-blur-md">
          <p className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
            Top Domain
          </p>
          <p className="mt-1 font-mono text-xl font-bold tracking-tight text-purple-400">
            {stats?.domainStats?.[0]?.domain
              ? String(stats.domainStats[0].domain).toUpperCase()
              : "—"}
          </p>
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(val: string) => setActiveTab(val as any)}
        className="w-full"
      >
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <TabsList className="bg-card/40 border-border/40 flex w-full flex-wrap justify-start gap-1 rounded-xl border p-1 backdrop-blur-md sm:w-auto">
            <TabsTrigger
              value="templates"
              className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-transform active:scale-[0.98]"
            >
              <Newspaper className="h-3.5 w-3.5" />
              Templates ({templatesData?.templates?.length ?? 0})
            </TabsTrigger>
            <TabsTrigger
              value="issues"
              className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-transform active:scale-[0.98]"
            >
              <Play className="h-3.5 w-3.5 text-cyan-400" />
              Active Instances ({issuesData?.issues?.length ?? 0})
            </TabsTrigger>
            <TabsTrigger
              value="engine"
              className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-transform active:scale-[0.98]"
            >
              <Sliders className="h-3.5 w-3.5 text-amber-400" />
              Engine Configuration
            </TabsTrigger>
          </TabsList>

          {activeTab === "templates" && (
            <Button
              size="sm"
              onClick={() => setEditorSheet({ isOpen: true, templateId: null })}
              className="h-8 rounded-xl px-3.5 text-xs font-semibold transition-transform active:scale-[0.98]"
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              New Template
            </Button>
          )}
        </div>

        {/* Templates Tab */}
        <TabsContent value="templates" className="mt-4 space-y-4 focus-visible:outline-none">
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
            <div className="relative max-w-sm min-w-[200px] flex-1">
              <Input
                placeholder="Search templates..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="border-border/30 bg-background/50 focus:border-border/60 h-8 rounded-xl pl-3 text-xs backdrop-blur-md"
              />
            </div>
            <Select value={domainFilter} onValueChange={setDomainFilter}>
              <SelectTrigger className="border-border/30 bg-background/50 h-8 w-44 rounded-xl text-xs backdrop-blur-md">
                <SelectValue placeholder="All Domains" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">
                  All Domains
                </SelectItem>
                <SelectItem value="economic" className="text-xs">
                  Economic
                </SelectItem>
                <SelectItem value="political" className="text-xs">
                  Political
                </SelectItem>
                <SelectItem value="social" className="text-xs">
                  Social
                </SelectItem>
                <SelectItem value="military" className="text-xs">
                  Military
                </SelectItem>
                <SelectItem value="diplomatic" className="text-xs">
                  Diplomatic
                </SelectItem>
                <SelectItem value="infrastructure" className="text-xs">
                  Infrastructure
                </SelectItem>
                <SelectItem value="environmental" className="text-xs">
                  Environmental
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isTemplatesLoading ? (
            <div className="text-muted-foreground p-8 text-center text-xs">
              Loading templates...
            </div>
          ) : templatesData?.templates?.length === 0 ? (
            <div className="border-border/30 bg-card/25 rounded-2xl border p-12 text-center backdrop-blur-md">
              <p className="text-muted-foreground text-xs">No issue templates matching criteria.</p>
            </div>
          ) : (
            <div className="border-border/30 bg-card/25 overflow-x-auto rounded-2xl border shadow-xs backdrop-blur-md">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-border/30 bg-muted/20 text-muted-foreground border-b font-semibold">
                    <th className="px-4 py-2.5 text-left font-medium">Issue Title & Description</th>
                    <th className="px-4 py-2.5 text-left font-medium">Domain</th>
                    <th className="px-4 py-2.5 text-left font-medium">Severity</th>
                    <th className="px-4 py-2.5 text-left font-medium">Active</th>
                    <th className="px-4 py-2.5 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-border/15 divide-y">
                  {templatesData?.templates?.map((t: any) => (
                    <tr key={t.id} className="hover:bg-foreground/[0.02] transition-colors">
                      <td className="px-4 py-2.5">
                        <div className="text-foreground font-semibold">{t.title}</div>
                        <div className="text-muted-foreground max-w-sm truncate text-[11px]">
                          {t.description}
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`inline-block rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase ${DOMAIN_COLORS[t.domain] || ""}`}
                        >
                          {t.domain}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`inline-block rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase ${SEVERITY_COLORS[t.severity] || ""}`}
                        >
                          {t.severity}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <button
                          onClick={() => toggleTemplate.mutate({ id: t.id, isActive: !t.isActive })}
                          className="transition-transform active:scale-[0.98]"
                          title="Toggle Status"
                        >
                          {t.isActive ? (
                            <ToggleRight className="h-5 w-5 text-emerald-400" />
                          ) : (
                            <ToggleLeft className="text-muted-foreground h-5 w-5" />
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="inline-flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditorSheet({ isOpen: true, templateId: t.id })}
                            className="h-7 px-2 text-xs active:scale-[0.98]"
                          >
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              if (confirm(`Delete template "${t.title}"?`)) {
                                deleteTemplate.mutate({ id: t.id });
                              }
                            }}
                            className="h-7 px-1.5 text-xs text-red-400 hover:bg-red-500/10 hover:text-red-300 active:scale-[0.98]"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* Active Issues Tab */}
        <TabsContent value="issues" className="mt-4 focus-visible:outline-none">
          {isIssuesLoading ? (
            <div className="text-muted-foreground p-8 text-center text-xs">
              Loading active instances...
            </div>
          ) : issuesData?.issues?.length === 0 ? (
            <div className="border-border/30 bg-card/25 rounded-2xl border p-12 text-center backdrop-blur-md">
              <p className="text-muted-foreground text-xs">
                No active national issue instances recorded.
              </p>
            </div>
          ) : (
            <div className="border-border/30 bg-card/25 overflow-x-auto rounded-2xl border shadow-xs backdrop-blur-md">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-border/30 bg-muted/20 text-muted-foreground border-b font-semibold">
                    <th className="px-4 py-2.5 text-left font-medium">Issue Title & Description</th>
                    <th className="px-4 py-2.5 text-left font-medium">Nation</th>
                    <th className="px-4 py-2.5 text-left font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-border/15 divide-y">
                  {issuesData?.issues?.map((issue: any) => (
                    <tr key={issue.id} className="hover:bg-foreground/[0.02] transition-colors">
                      <td className="px-4 py-2.5">
                        <div className="text-foreground font-semibold">{issue.title}</div>
                        <div className="text-muted-foreground max-w-sm truncate text-[11px]">
                          {issue.description}
                        </div>
                      </td>
                      <td className="text-muted-foreground px-4 py-2.5 font-mono">
                        {issue.country?.name || issue.countryId}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`inline-block rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase ${STATUS_COLORS[issue.status] || ""}`}
                        >
                          {issue.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* Engine Configuration Tab */}
        <TabsContent value="engine" className="mt-4 focus-visible:outline-none">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="border-border/30 bg-card/25 space-y-4 rounded-2xl border p-5 backdrop-blur-md">
              <h3 className="text-foreground flex items-center gap-2 text-xs font-bold tracking-wider uppercase">
                <Sliders className="h-4 w-4 text-amber-500" />
                Issue Generation Engine Limits
              </h3>
              <div className="space-y-3 text-xs">
                <div>
                  <label className="text-muted-foreground mb-1 block">Max per Session</label>
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    value={maxIssuesPerSession}
                    onChange={(e) => setMaxIssuesPerSession(parseInt(e.target.value) || 1)}
                    className="border-border/30 bg-background/50 h-8 rounded-xl font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="text-muted-foreground mb-1 block">Max per Week</label>
                  <Input
                    type="number"
                    min={1}
                    max={20}
                    value={maxIssuesPerWeek}
                    onChange={(e) => setMaxIssuesPerWeek(parseInt(e.target.value) || 1)}
                    className="border-border/30 bg-background/50 h-8 rounded-xl font-mono text-xs"
                  />
                </div>
                <Button
                  size="sm"
                  onClick={handleSaveEngineLimits}
                  disabled={updateEngineConfig.isPending}
                  className="h-8 rounded-xl px-3.5 text-xs font-semibold transition-transform active:scale-[0.98]"
                >
                  {updateEngineConfig.isPending ? "Saving..." : "Save Engine Config"}
                </Button>
              </div>
            </div>

            <div className="border-border/30 bg-card/25 space-y-4 rounded-2xl border p-5 backdrop-blur-md">
              <h3 className="text-foreground flex items-center gap-2 text-xs font-bold tracking-wider uppercase">
                <Play className="h-4 w-4 text-emerald-500" />
                Live Criteria Evaluation Test
              </h3>
              <div className="space-y-3 text-xs">
                <Select value={evalCountryId} onValueChange={setEvalCountryId}>
                  <SelectTrigger className="border-border/30 bg-background/50 h-8 rounded-xl text-xs">
                    <SelectValue placeholder="Select Target Country..." />
                  </SelectTrigger>
                  <SelectContent>
                    {countries?.map((c) => (
                      <SelectItem key={c.id} value={c.id} className="text-xs">
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!evalCountryId || evaluateIssues.isPending}
                  onClick={() =>
                    evaluateIssues.mutate({
                      countryId: evalCountryId,
                      domain: evalDomain !== "all" ? evalDomain : undefined,
                    })
                  }
                  className="h-8 rounded-xl px-3.5 text-xs transition-transform active:scale-[0.98]"
                >
                  {evaluateIssues.isPending ? "Evaluating..." : "Evaluate Criteria"}
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Template CRUD Editor Side Sheet */}
      <TemplateEditorSheet
        isOpen={editorSheet.isOpen}
        onOpenChange={(open) =>
          setEditorSheet({ isOpen: open, templateId: editorSheet.templateId })
        }
        templateId={editorSheet.templateId}
        onSuccess={handleGlobalRefresh}
      />
    </div>
  );
}

export default NationalIssuesPanel;
