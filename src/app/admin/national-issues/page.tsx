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
  Send,
  Sliders,
  Database,
  Upload,
  BookOpen,
  Calendar,
  CheckCircle,
} from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { api } from "~/trpc/react";
import { TemplateEditorSheet } from "./TemplateEditorSheet";

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
  economic: "bg-emerald-500/20 text-emerald-400 border-emerald-500/20",
  political: "bg-purple-500/20 text-purple-400 border-purple-500/20",
  social: "bg-blue-500/20 text-blue-400 border-blue-500/20",
  military: "bg-red-500/20 text-red-400 border-red-500/20",
  diplomatic: "bg-cyan-500/20 text-cyan-400 border-cyan-500/20",
  infrastructure: "bg-amber-500/20 text-amber-400 border-amber-500/20",
  environmental: "bg-green-500/20 text-green-400 border-green-500/20",
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: "bg-red-600/30 text-red-400 border-red-500/20",
  high: "bg-amber-600/30 text-amber-400 border-amber-500/20",
  medium: "bg-blue-600/30 text-blue-400 border-blue-500/20",
  low: "bg-slate-500/20 text-slate-400 border-slate-500/10",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  viewed: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  responded: "bg-green-500/10 text-green-400 border-green-500/20",
  auto_resolved: "bg-slate-500/20 text-slate-400 border-slate-500/20",
  expired: "bg-red-500/10 text-red-400 border-red-500/20",
  dismissed: "bg-slate-500/20 text-slate-400 border-slate-500/20",
};

export default function NationalIssuesAdminPage() {
  const [activeTab, setActiveTab] = useState<"templates" | "issues">("templates");
  const [domainFilter, setDomainFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  
  // Modals & Side Sheets
  const [editorSheet, setEditorSheet] = useState<{ isOpen: boolean; templateId: string | null }>({
    isOpen: false,
    templateId: null,
  });
  const [previewModal, setPreviewModal] = useState<{
    templateId: string;
    countryId: string;
  } | null>(null);

  // Forms State Left Panel
  const [evalCountryId, setEvalCountryId] = useState("");
  const [evalDomain, setEvalDomain] = useState("all");
  const [forceGenCountryId, setForceGenCountryId] = useState("");
  const [forceGenTemplateId, setForceGenTemplateId] = useState("");
  const [injectTemplateId, setInjectTemplateId] = useState("");
  const [injectScope, setInjectScope] = useState<"country" | "region" | "continent" | "all">("country");
  const [injectTarget, setInjectTarget] = useState("");
  const [injectLabel, setInjectLabel] = useState("");

  // Bulk Import
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [bulkImportText, setBulkImportText] = useState("");
  const [bulkImportError, setBulkImportError] = useState<string | null>(null);
  const [bulkImportResult, setBulkImportResult] = useState<string | null>(null);

  // Seeding feedback
  const [seedResult, setSeedResult] = useState<{ created: number; updated: number; errors: number } | null>(null);
  const [isSeeding, setIsSeeding] = useState(false);

  // Active Issues Filtering
  const [activeStatusFilter, setActiveStatusFilter] = useState("all");
  const [activeCountryFilter, setActiveCountryFilter] = useState("all");

  // Fetch templates
  const {
    data: templatesData,
    isLoading: isTemplatesLoading,
    refetch: refetchTemplates,
  } = api.nationalIssues.getTemplates.useQuery({
    domain: domainFilter !== "all" ? domainFilter : undefined,
    search: search || undefined,
    limit: 100,
  });

  // Fetch countries
  const { data: countries } = api.countries.getSelectList.useQuery({ limit: 250 });

  // Fetch stats
  const { data: stats, refetch: refetchStats } = api.nationalIssues.getGenerationStats.useQuery(
    { days: 7 }
  );

  // Fetch active/recent issues
  const { data: activeIssuesData, isLoading: isIssuesLoading, refetch: refetchActiveIssues } =
    api.nationalIssues.getActiveIssues.useQuery({
      status: activeStatusFilter !== "all" ? activeStatusFilter : undefined,
      countryId: activeCountryFilter !== "all" ? activeCountryFilter : undefined,
      limit: 100,
    });

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
    onSuccess: () => void refetchTemplates(),
  });

  const deleteTemplate = api.nationalIssues.deleteTemplate.useMutation({
    onSuccess: () => void refetchTemplates(),
  });

  const forceGenerate = api.nationalIssues.forceGenerate.useMutation({
    onSuccess: () => {
      void refetchStats();
      void refetchActiveIssues();
    },
  });

  const injectEvent = api.nationalIssues.injectEvent.useMutation({
    onSuccess: () => {
      void refetchStats();
      void refetchActiveIssues();
    },
  });

  const triggerEvaluation = api.nationalIssues.triggerEvaluation.useMutation({
    onSuccess: () => {
      void refetchStats();
      void refetchActiveIssues();
    },
  });

  const bulkImportMutation = api.nationalIssues.batchCreateTemplates.useMutation({
    onSuccess: () => void refetchTemplates(),
  });

  const seedDefaultMutation = api.nationalIssues.seedDefaultTemplates.useMutation({
    onSuccess: () => {
      void refetchTemplates();
      void refetchStats();
    },
  });

  const templates = templatesData?.templates ?? [];
  const activeIssues = activeIssuesData?.issues ?? [];

  // Domain summary counts
  const domainCounts = templates.reduce(
    (acc, t) => {
      acc[t.domain] = (acc[t.domain] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const handleSeedDefaults = async () => {
    setIsSeeding(true);
    setSeedResult(null);
    try {
      const res = await seedDefaultMutation.mutateAsync();
      setSeedResult(res);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSeeding(false);
    }
  };

  const handleBulkImport = async () => {
    setBulkImportError(null);
    setBulkImportResult(null);
    try {
      const parsed = JSON.parse(bulkImportText);
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      
      const res = await bulkImportMutation.mutateAsync({ templates: arr });
      setBulkImportResult(`Processed: ${res.total} templates. Check logs if any failed.`);
      setBulkImportText("");
    } catch (err: any) {
      setBulkImportError(err.message || "Invalid JSON array.");
    }
  };

  const handleGlobalRefresh = () => {
    void refetchTemplates();
    void refetchActiveIssues();
    void refetchStats();
  };

  return (
    <div className="bg-background min-h-screen p-6 text-white">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-amber-500/20 p-2.5">
              <Newspaper className="h-6 w-6 text-amber-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">National Issues System Controls</h1>
              <p className="text-slate-400 text-xs mt-0.5">
                Configure event templates, evaluate simulation criteria, and monitor live issues
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleGlobalRefresh} className="bg-white/5 border-white/10 text-xs h-8">
              <RefreshCw className="mr-1 h-3.5 w-3.5" />
              Refresh All
            </Button>
          </div>
        </div>

        {/* Layout Grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          
          {/* LEFT COLUMN: Fixed Sticky Panel */}
          <div className="lg:col-span-1 space-y-4">
            
            {/* Stats Summary Panel */}
            {stats && (
              <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
                <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                    <BarChart3 className="h-4 w-4" />
                    Engine Statistics (7d)
                  </h3>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <StatCard label="Evaluations" value={stats.totalEvaluations} />
                  <StatCard label="Issues Created" value={stats.totalIssuesGenerated} />
                  <StatCard label="Avg Exec Time" value={`${stats.avgExecutionTime}ms`} />
                  <StatCard label="Total Templates" value={templates.length} />
                </div>
              </div>
            )}

            {/* Engine & Seeding Control Panel */}
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-md space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 border-b border-white/10 pb-2 flex items-center gap-1.5">
                <Database className="h-4 w-4" />
                Global Engine Operations
              </h3>

              {/* Evaluate Engine Trigger */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Evaluate Simulation Criteria</label>
                <div className="flex gap-2">
                  <Select value={evalCountryId} onValueChange={setEvalCountryId}>
                    <SelectTrigger className="h-8 text-xs bg-white/5 border-white/10 text-white">
                      <SelectValue placeholder="Select country..." />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-white/10 text-white">
                      <SelectItem value="all" className="text-xs focus:bg-white/10 focus:text-white">All Countries</SelectItem>
                      {countries?.map((c: any) => (
                        <SelectItem key={c.id} value={c.id} className="text-xs focus:bg-white/10 focus:text-white">
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Button
                    size="sm"
                    className="h-8 text-xs bg-amber-500 text-black hover:bg-amber-400 font-semibold"
                    disabled={!evalCountryId || triggerEvaluation.isPending}
                    onClick={() =>
                      triggerEvaluation.mutate({
                        countryId: evalCountryId === "all" ? "" : evalCountryId,
                        domain: evalDomain !== "all" ? evalDomain : undefined,
                      })
                    }
                  >
                    {triggerEvaluation.isPending ? "..." : "Evaluate"}
                  </Button>
                </div>
                {triggerEvaluation.data && (
                  <p className="text-[10px] text-green-400">
                    Criteria check finished.
                  </p>
                )}
              </div>

              {/* Seeding & Imports */}
              <div className="border-t border-white/10 pt-3 space-y-2">
                <label className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">Template Seeding</label>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs border-white/10 bg-white/5 hover:bg-white/10"
                    disabled={isSeeding}
                    onClick={handleSeedDefaults}
                  >
                    Seed System Templates
                  </Button>
                  
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs border-white/10 bg-white/5 hover:bg-white/10"
                    onClick={() => setBulkImportOpen(!bulkImportOpen)}
                  >
                    <Upload className="h-3.5 w-3.5 mr-1" />
                    JSON Import
                  </Button>
                </div>

                {seedResult && (
                  <div className="rounded bg-green-500/10 border border-green-500/20 p-2 text-[10px] text-green-400">
                    Default Seeding completed. Created: {seedResult.created}, Updated: {seedResult.updated}, Errors: {seedResult.errors}.
                  </div>
                )}

                {/* Bulk Import Box */}
                {bulkImportOpen && (
                  <div className="bg-white/5 border border-white/10 rounded p-2.5 space-y-2 mt-2">
                    <label className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider block">Paste JSON Template array</label>
                    <Textarea
                      placeholder="[ { 'slug': 'test_issue', ... } ]"
                      value={bulkImportText}
                      onChange={(e) => setBulkImportText(e.target.value)}
                      rows={4}
                      className="bg-black/30 border-white/10 text-[10px] font-mono"
                    />
                    <div className="flex justify-between items-center">
                      <Button
                        size="sm"
                        disabled={!bulkImportText || bulkImportMutation.isPending}
                        onClick={handleBulkImport}
                        className="h-6 text-[10px] bg-amber-500 text-black hover:bg-amber-400 font-semibold"
                      >
                        {bulkImportMutation.isPending ? "Importing..." : "Submit Import"}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setBulkImportOpen(false)} className="h-6 text-[10px] hover:bg-white/5">
                        Cancel
                      </Button>
                    </div>
                    {bulkImportError && <p className="text-[9px] text-red-400">{bulkImportError}</p>}
                    {bulkImportResult && <p className="text-[9px] text-green-400">{bulkImportResult}</p>}
                  </div>
                )}
              </div>
            </div>

            {/* Force Generate Panel */}
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-md space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 border-b border-white/10 pb-2 flex items-center gap-1.5">
                <Sliders className="h-4 w-4" />
                Force Generate Issue
              </h3>
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider">Country</label>
                    <Select value={forceGenCountryId} onValueChange={setForceGenCountryId}>
                      <SelectTrigger className="h-8 text-xs bg-white/5 border-white/10 text-white">
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-white/10 text-white">
                        {countries?.map((c: any) => (
                          <SelectItem key={c.id} value={c.id} className="text-xs focus:bg-white/10 focus:text-white">
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider">Template</label>
                    <Select value={forceGenTemplateId} onValueChange={setForceGenTemplateId}>
                      <SelectTrigger className="h-8 text-xs bg-white/5 border-white/10 text-white">
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-white/10 text-white">
                        {templates.map((t) => (
                          <SelectItem key={t.id} value={t.id} className="text-xs focus:bg-white/10 focus:text-white">
                            {t.slug}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button
                  size="sm"
                  className="w-full h-8 text-xs bg-amber-500 text-black hover:bg-amber-400 font-semibold"
                  disabled={!forceGenCountryId || !forceGenTemplateId || forceGenerate.isPending}
                  onClick={() =>
                    forceGenerate.mutate({
                      templateId: forceGenTemplateId,
                      countryId: forceGenCountryId,
                    })
                  }
                >
                  <Play className="mr-1 h-3 w-3" />
                  {forceGenerate.isPending ? "Generating..." : "Force Generate Issue"}
                </Button>
                {forceGenerate.data && (
                  <p className="text-[10px] text-green-400">
                    Created issue ID: {forceGenerate.data.issueId}
                  </p>
                )}
              </div>
            </div>

            {/* Inject DM Event Panel */}
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-md space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 border-b border-white/10 pb-2 flex items-center gap-1.5">
                <Send className="h-4 w-4" />
                Inject Narrative Event
              </h3>
              <div className="space-y-2">
                <div>
                  <label className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider">Template</label>
                  <Select value={injectTemplateId} onValueChange={setInjectTemplateId}>
                    <SelectTrigger className="h-8 text-xs bg-white/5 border-white/10 text-white">
                      <SelectValue placeholder="Select template..." />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-white/10 text-white">
                      {templates.map((t) => (
                        <SelectItem key={t.id} value={t.id} className="text-xs focus:bg-white/10 focus:text-white">
                          {t.slug}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider">Scope</label>
                    <Select
                      value={injectScope}
                      onValueChange={(v) => {
                        setInjectScope(v as any);
                        setInjectTarget("");
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs bg-white/5 border-white/10 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-white/10 text-white">
                        <SelectItem value="country" className="text-xs focus:bg-white/10 focus:text-white">Country</SelectItem>
                        <SelectItem value="region" className="text-xs focus:bg-white/10 focus:text-white">Region</SelectItem>
                        <SelectItem value="continent" className="text-xs focus:bg-white/10 focus:text-white">Continent</SelectItem>
                        <SelectItem value="all" className="text-xs focus:bg-white/10 focus:text-white">All</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {injectScope === "country" ? (
                    <div>
                      <label className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider">Target</label>
                      <Select value={injectTarget} onValueChange={setInjectTarget}>
                        <SelectTrigger className="h-8 text-xs bg-white/5 border-white/10 text-white">
                          <SelectValue placeholder="Country..." />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-white/10 text-white">
                          {countries?.map((c: any) => (
                            <SelectItem key={c.id} value={c.id} className="text-xs focus:bg-white/10 focus:text-white">
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : injectScope !== "all" ? (
                    <div>
                      <label className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider">Target Name</label>
                      <Input
                        value={injectTarget}
                        onChange={(e) => setInjectTarget(e.target.value)}
                        placeholder={injectScope === "region" ? "e.g. Europe" : "e.g. Asia"}
                        className="bg-white/5 border-white/10 text-xs h-8 text-white"
                      />
                    </div>
                  ) : (
                    <div />
                  )}
                </div>
                <div>
                  <label className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider">Label (optional)</label>
                  <Input
                    value={injectLabel}
                    onChange={(e) => setInjectLabel(e.target.value)}
                    placeholder="e.g. Summer arc event"
                    className="bg-white/5 border-white/10 text-xs h-8 text-white"
                  />
                </div>
                <Button
                  size="sm"
                  className="w-full h-8 text-xs bg-amber-500 text-black hover:bg-amber-400 font-semibold"
                  disabled={
                    !injectTemplateId ||
                    (injectScope !== "all" && !injectTarget) ||
                    injectEvent.isPending
                  }
                  onClick={() => {
                    const target =
                      injectScope === "country"
                        ? { scope: "country" as const, countryId: injectTarget }
                        : injectScope === "region"
                          ? { scope: "region" as const, region: injectTarget }
                          : injectScope === "continent"
                            ? { scope: "continent" as const, continent: injectTarget }
                            : { scope: "all" as const };
                    injectEvent.mutate({
                      templateId: injectTemplateId,
                      target,
                      label: injectLabel || undefined,
                    });
                  }}
                >
                  <Send className="mr-1 h-3 w-3" />
                  {injectEvent.isPending ? "Injecting..." : "Inject Event"}
                </Button>
                {injectEvent.data && (
                  <p className="text-[10px] text-green-400">
                    Injected {injectEvent.data.created}/{injectEvent.data.requested} issues
                  </p>
                )}
                {injectEvent.error && (
                  <p className="text-[10px] text-red-400">{injectEvent.error.message}</p>
                )}
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN: Workspace List Panel */}
          <div className="lg:col-span-2 space-y-4">
            
            {/* Navigation Tabs and Quick Search Filter */}
            <div className="rounded-xl border border-white/10 bg-white/5 p-3 flex flex-wrap gap-4 items-center justify-between backdrop-blur-md">
              <div className="flex gap-2">
                <Button
                  variant={activeTab === "templates" ? "default" : "ghost"}
                  onClick={() => setActiveTab("templates")}
                  className={`text-xs h-8 ${activeTab === "templates" ? "bg-amber-500 text-black hover:bg-amber-400 font-semibold" : "hover:bg-white/5 text-slate-300"}`}
                >
                  <BookOpen className="h-4 w-4 mr-1" />
                  Templates Manager
                </Button>
                <Button
                  variant={activeTab === "issues" ? "default" : "ghost"}
                  onClick={() => setActiveTab("issues")}
                  className={`text-xs h-8 ${activeTab === "issues" ? "bg-amber-500 text-black hover:bg-amber-400 font-semibold" : "hover:bg-white/5 text-slate-300"}`}
                >
                  <Calendar className="h-4 w-4 mr-1" />
                  Active Issues Monitor
                </Button>
              </div>

              {activeTab === "templates" && (
                <div className="flex gap-2 flex-1 max-w-md justify-end">
                  <div className="relative flex-1">
                    <Search className="text-slate-400 absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2" />
                    <Input
                      placeholder="Search slug/title..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="h-8 pl-8 text-xs bg-black/20 border-white/10 text-white"
                    />
                  </div>
                  <Select value={domainFilter} onValueChange={setDomainFilter}>
                    <SelectTrigger className="h-8 w-32 text-xs bg-black/20 border-white/10 text-white">
                      <SelectValue placeholder="All domains" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-white/10 text-white">
                      <SelectItem value="all" className="text-xs focus:bg-white/10 focus:text-white">All domains</SelectItem>
                      {DOMAINS.map((d) => (
                        <SelectItem key={d} value={d} className="text-xs focus:bg-white/10 focus:text-white">
                          {d} ({domainCounts[d] ?? 0})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    onClick={() => setEditorSheet({ isOpen: true, templateId: null })}
                    className="h-8 text-xs bg-green-600 text-white hover:bg-green-500 font-semibold shrink-0"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Create
                  </Button>
                </div>
              )}
            </div>

            {/* Templates Workspace */}
            {activeTab === "templates" ? (
              <div className="max-h-[calc(100vh-220px)] overflow-y-auto pr-1 space-y-2 scrollbar-thin">
                {isTemplatesLoading ? (
                  <div className="text-slate-400 py-8 text-center text-xs">Loading templates...</div>
                ) : templates.length === 0 ? (
                  <div className="text-slate-400 py-8 text-center text-xs border border-dashed border-white/10 rounded-xl bg-white/5">
                    No templates found matching your filters. Seed the defaults or create a new template.
                  </div>
                ) : (
                  templates.map((template) => (
                    <div
                      key={template.id}
                      className={`rounded-xl border p-3.5 transition-all bg-white/5 ${
                        template.isActive
                          ? "border-white/10 hover:border-white/20"
                          : "border-white/5 opacity-50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="mb-1 flex flex-wrap items-center gap-1.5">
                            <span className="text-slate-300 font-mono text-[10px] bg-black/40 px-1.5 py-0.5 rounded border border-white/5">
                              {template.slug}
                            </span>
                            <Badge
                              variant="outline"
                              className={`text-[9px] font-semibold py-0 px-1.5 uppercase ${DOMAIN_COLORS[template.domain] ?? ""}`}
                            >
                              {template.domain}
                            </Badge>
                            <Badge
                              variant="outline"
                              className={`text-[9px] font-semibold py-0 px-1.5 uppercase ${SEVERITY_COLORS[template.baseSeverity as string] ?? ""}`}
                            >
                              {(template.baseSeverity as string)}
                            </Badge>
                            {template.deadlineDaysBase && (
                              <Badge variant="outline" className="bg-red-500/10 text-[9px] text-red-400 border-red-500/15">
                                {template.deadlineDaysBase}d deadline
                              </Badge>
                            )}
                            <span className="text-slate-400 text-[10px] ml-1">
                              {(template as any)._count?.instances ?? 0} instances
                            </span>
                          </div>
                          <h4 className="text-xs font-semibold text-white mt-1">{template.title}</h4>
                          <p className="text-slate-400 mt-1 line-clamp-2 text-[11px] leading-relaxed">
                            {template.description}
                          </p>
                        </div>

                        <div className="flex shrink-0 items-center gap-1">
                          {forceGenCountryId && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 hover:bg-white/10 hover:text-white"
                              title="Preview against selected country"
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
                            className="h-7 w-7 p-0 hover:bg-white/10 hover:text-white"
                            title="Edit template details"
                            onClick={() =>
                              setEditorSheet({
                                isOpen: true,
                                templateId: template.id,
                              })
                            }
                          >
                            <Sliders className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 hover:bg-white/10"
                            title={template.isActive ? "Deactivate" : "Activate"}
                            onClick={() =>
                              toggleActive.mutate({
                                id: template.id,
                                isActive: !template.isActive,
                              })
                            }
                          >
                            {template.isActive ? (
                              <ToggleRight className="h-4.5 w-4.5 text-green-400" />
                            ) : (
                              <ToggleLeft className="text-slate-500 h-4.5 w-4.5" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                            title="Delete template"
                            onClick={() => {
                              if (confirm(`Delete template "${template.slug}"? This is destructive.`)) {
                                deleteTemplate.mutate({ id: template.id });
                              }
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : (
              
              /* Active Issues Monitor View */
              <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-md space-y-4">
                
                {/* Active Issues filters */}
                <div className="flex gap-2 items-center">
                  <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mr-2">Audit Filters</span>
                  <Select value={activeStatusFilter} onValueChange={(val) => {
                    setActiveStatusFilter(val);
                    void refetchActiveIssues();
                  }}>
                    <SelectTrigger className="h-8 w-36 text-xs bg-black/20 border-white/10 text-white">
                      <SelectValue placeholder="Status..." />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-white/10 text-white">
                      <SelectItem value="all" className="text-xs">All statuses</SelectItem>
                      <SelectItem value="pending" className="text-xs">Pending</SelectItem>
                      <SelectItem value="viewed" className="text-xs">Viewed</SelectItem>
                      <SelectItem value="responded" className="text-xs">Responded</SelectItem>
                      <SelectItem value="auto_resolved" className="text-xs">Auto Resolved</SelectItem>
                      <SelectItem value="expired" className="text-xs">Expired</SelectItem>
                      <SelectItem value="dismissed" className="text-xs">Dismissed</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={activeCountryFilter} onValueChange={(val) => {
                    setActiveCountryFilter(val);
                    void refetchActiveIssues();
                  }}>
                    <SelectTrigger className="h-8 w-44 text-xs bg-black/20 border-white/10 text-white">
                      <SelectValue placeholder="Country..." />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-white/10 text-white">
                      <SelectItem value="all" className="text-xs">All Countries</SelectItem>
                      {countries?.map((c: any) => (
                        <SelectItem key={c.id} value={c.id} className="text-xs">
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Button variant="ghost" size="sm" onClick={() => void refetchActiveIssues()} className="h-8 hover:bg-white/5 text-slate-300">
                    <RefreshCw className="h-3.5 w-3.5 mr-1" />
                    Refresh Feed
                  </Button>
                </div>

                {/* Issues List Container */}
                <div className="max-h-[calc(100vh-280px)] overflow-y-auto pr-1 space-y-2 scrollbar-thin">
                  {isIssuesLoading ? (
                    <div className="text-slate-400 py-8 text-center text-xs">Loading active issues...</div>
                  ) : activeIssues.length === 0 ? (
                    <div className="text-slate-400 py-8 text-center text-xs border border-dashed border-white/10 rounded-xl bg-white/5">
                      No active issues match the selected filters.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left text-slate-300">
                        <thead className="text-[10px] text-slate-400 uppercase tracking-wider bg-black/40 border-b border-white/10">
                          <tr>
                            <th className="py-2 px-3">Country</th>
                            <th className="py-2 px-3">Issue Title</th>
                            <th className="py-2 px-3">Severity</th>
                            <th className="py-2 px-3">Urgency</th>
                            <th className="py-2 px-3">Status</th>
                            <th className="py-2 px-3">Resolution Choice</th>
                            <th className="py-2 px-3 text-right">Created At</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {activeIssues.map((issue) => (
                            <tr key={issue.id} className="hover:bg-white/5">
                              <td className="py-2.5 px-3 font-semibold text-white">{issue.country.name}</td>
                              <td className="py-2.5 px-3 truncate max-w-[200px]" title={issue.title}>{issue.title}</td>
                              <td className="py-2.5 px-3">
                                <Badge variant="outline" className={`text-[9px] py-0 px-1 uppercase ${SEVERITY_COLORS[issue.severity] ?? ""}`}>
                                  {issue.severity}
                                </Badge>
                              </td>
                              <td className="py-2.5 px-3 font-mono">{issue.urgency}%</td>
                              <td className="py-2.5 px-3">
                                <Badge variant="outline" className={`text-[9px] py-0 px-1 uppercase ${STATUS_COLORS[issue.status] ?? ""}`}>
                                  {issue.status}
                                </Badge>
                              </td>
                              <td className="py-2.5 px-3 truncate max-w-[150px]" title={issue.chosenOptionLabel ?? ""}>
                                {issue.chosenOptionLabel ? (
                                  <span className="text-green-400 flex items-center gap-1">
                                    <CheckCircle className="h-3 w-3 inline shrink-0" />
                                    {issue.chosenOptionLabel}
                                  </span>
                                ) : (
                                  <span className="text-slate-500">Unresolved</span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-right text-slate-400 font-mono text-[10px]">
                                {new Date(issue.createdAt).toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Preview Dialog */}
        <Dialog open={!!previewModal} onOpenChange={(open) => !open && setPreviewModal(null)}>
          <DialogContent className="max-w-xl bg-slate-900 border-white/10 text-white">
            <DialogHeader>
              <DialogTitle className="text-white text-md">Issue Template Execution Preview</DialogTitle>
            </DialogHeader>
            {isPreviewLoading ? (
              <div className="text-slate-400 py-4 text-center text-xs">Evaluating triggers...</div>
            ) : previewData ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Badge
                    variant={previewData.triggersPassed ? "default" : "outline"}
                    className={
                      previewData.triggersPassed
                        ? "bg-green-500/20 text-green-400 border-green-500/20 text-xs"
                        : "bg-red-500/20 text-red-400 border-red-500/20 text-xs"
                    }
                  >
                    Criteria Check: {previewData.triggersPassed ? "CRITERIA PASSED" : "CRITERIA FAILED"}
                  </Badge>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/5 p-3.5">
                  <h4 className="mb-1 text-xs font-bold text-amber-400">{previewData.rendered.title}</h4>
                  <p className="text-slate-300 text-xs leading-relaxed">
                    {previewData.rendered.description}
                  </p>
                  {previewData.rendered.longDescription && (
                    <p className="text-slate-400 mt-2.5 border-l-2 border-white/15 pl-2.5 text-xs whitespace-pre-line leading-relaxed">
                      {previewData.rendered.longDescription}
                    </p>
                  )}
                </div>
                <div>
                  <h5 className="mb-2 text-xs font-semibold text-slate-400">Rendered Options:</h5>
                  <div className="space-y-2">
                    {previewData.rendered.responseOptions.map((opt: any, i: number) => (
                      <div key={i} className="rounded-lg border border-white/10 bg-black/20 p-2.5">
                        <span className="text-xs font-semibold text-white">{opt.label}</span>
                        <p className="text-slate-400 text-[10px] mt-0.5">{opt.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="text-slate-500 text-[10px] border-t border-white/5 pt-2.5">
                  Tested Against Country: {previewData.snapshot.name} | GDP: ${previewData.snapshot.gdp?.toLocaleString()} | Public Approval: {previewData.snapshot.approval}%
                </div>
              </div>
            ) : null}
          </DialogContent>
        </Dialog>

        {/* Template CRUD Editor Side Sheet */}
        <TemplateEditorSheet
          isOpen={editorSheet.isOpen}
          onOpenChange={(open) => setEditorSheet({ isOpen: open, templateId: editorSheet.templateId })}
          templateId={editorSheet.templateId}
          onSuccess={handleGlobalRefresh}
        />

      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-3 flex flex-col justify-between">
      <div className="text-slate-400 text-[10px] uppercase font-semibold tracking-wider">{label}</div>
      <div className="text-lg font-bold mt-1 text-white">{value}</div>
    </div>
  );
}
