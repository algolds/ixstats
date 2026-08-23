"use client";

import { useState, useEffect } from "react";
import { Journal as Newspaper, Plus, Search, Play, Eye, Trash as Trash2, SwitchOff as ToggleLeft, SwitchOn as ToggleRight, StatsReport as BarChart3, Refresh as RefreshCw, Send, ControlSlider as Sliders, Database, Upload, OpenBook as BookOpen, Calendar, CheckCircle } from "iconoir-react";
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
import { Checkbox } from "~/components/ui/checkbox";
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
  const [injectScope, setInjectScope] = useState<"country" | "region" | "continent" | "all">(
    "country"
  );
  const [injectTarget, setInjectTarget] = useState("");
  const [injectLabel, setInjectLabel] = useState("");

  // Engine Limits State
  const [maxIssuesPerSession, setMaxIssuesPerSession] = useState<number>(3);
  const [maxIssuesPerWeek, setMaxIssuesPerWeek] = useState<number>(5);
  const [bypassLimits, setBypassLimits] = useState(false);

  // Bulk Import
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [bulkImportText, setBulkImportText] = useState("");
  const [bulkImportError, setBulkImportError] = useState<string | null>(null);
  const [bulkImportResult, setBulkImportResult] = useState<string | null>(null);

  // Seeding feedback
  const [seedResult, setSeedResult] = useState<{
    created: number;
    updated: number;
    errors: number;
  } | null>(null);
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
  const { data: stats, refetch: refetchStats } = api.nationalIssues.getGenerationStats.useQuery({
    days: 7,
  });

  // Fetch engine config
  const { data: engineConfig, refetch: refetchEngineConfig } =
    api.nationalIssues.getEngineConfig.useQuery();

  const updateEngineConfig = api.nationalIssues.updateEngineConfig.useMutation({
    onSuccess: () => {
      void refetchEngineConfig();
    },
  });

  // Sync inputs with database config when it changes
  useEffect(() => {
    if (engineConfig) {
      setMaxIssuesPerSession(engineConfig.maxIssuesPerSession);
      setMaxIssuesPerWeek(engineConfig.maxIssuesPerWeek);
    }
  }, [engineConfig]);

  // Fetch active/recent issues
  const {
    data: activeIssuesData,
    isLoading: isIssuesLoading,
    refetch: refetchActiveIssues,
  } = api.nationalIssues.getActiveIssues.useQuery({
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
              <p className="mt-0.5 text-xs text-slate-400">
                Configure event templates, evaluate simulation criteria, and monitor live issues
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleGlobalRefresh}
              className="h-8 border-white/10 bg-white/5 text-xs"
            >
              <RefreshCw className="mr-1 h-3.5 w-3.5" />
              Refresh All
            </Button>
          </div>
        </div>

        {/* Layout Grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* LEFT COLUMN: Fixed Sticky Panel */}
          <div className="space-y-4 lg:col-span-1">
            {/* Stats Summary Panel */}
            {stats && (
              <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
                <div className="mb-3 flex items-center justify-between border-b border-white/10 pb-2">
                  <h3 className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-amber-400 uppercase">
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

            {/* Engine Limits Panel */}
            <div className="space-y-4 rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
              <h3 className="flex items-center gap-1.5 border-b border-white/10 pb-2 text-xs font-bold tracking-wider text-amber-400 uppercase">
                <Sliders className="h-4 w-4" />
                Engine Generation Limits
              </h3>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                      Max Per Session
                    </label>
                    <Input
                      type="number"
                      min={1}
                      max={10}
                      value={maxIssuesPerSession}
                      onChange={(e) => setMaxIssuesPerSession(parseInt(e.target.value) || 1)}
                      className="h-8 border-white/10 bg-white/5 text-xs text-white"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                      Max Per Week (7d)
                    </label>
                    <Input
                      type="number"
                      min={1}
                      max={50}
                      value={maxIssuesPerWeek}
                      onChange={(e) => setMaxIssuesPerWeek(parseInt(e.target.value) || 1)}
                      className="h-8 border-white/10 bg-white/5 text-xs text-white"
                    />
                  </div>
                </div>
                <Button
                  size="sm"
                  className="h-8 w-full bg-amber-500 text-xs font-semibold text-black hover:bg-amber-400"
                  disabled={updateEngineConfig.isPending}
                  onClick={() =>
                    updateEngineConfig.mutate({
                      maxIssuesPerSession,
                      maxIssuesPerWeek,
                    })
                  }
                >
                  {updateEngineConfig.isPending ? "Saving..." : "Save Config"}
                </Button>
                {updateEngineConfig.isSuccess && (
                  <p className="text-[10px] text-green-400">Configuration saved successfully.</p>
                )}
              </div>
            </div>

            {/* Engine & Seeding Control Panel */}
            <div className="space-y-4 rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
              <h3 className="flex items-center gap-1.5 border-b border-white/10 pb-2 text-xs font-bold tracking-wider text-amber-400 uppercase">
                <Database className="h-4 w-4" />
                Global Engine Operations
              </h3>

              {/* Evaluate Engine Trigger */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                  Evaluate Simulation Criteria
                </label>
                <div className="flex gap-2">
                  <Select value={evalCountryId} onValueChange={setEvalCountryId}>
                    <SelectTrigger className="h-8 border-white/10 bg-white/5 text-xs text-white">
                      <SelectValue placeholder="Select country..." />
                    </SelectTrigger>
                    <SelectContent className="border-white/10 bg-slate-900 text-white">
                      <SelectItem
                        value="all"
                        className="text-xs focus:bg-white/10 focus:text-white"
                      >
                        All Countries
                      </SelectItem>
                      {countries?.map((c: any) => (
                        <SelectItem
                          key={c.id}
                          value={c.id}
                          className="text-xs focus:bg-white/10 focus:text-white"
                        >
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Button
                    size="sm"
                    className="h-8 bg-amber-500 text-xs font-semibold text-black hover:bg-amber-400"
                    disabled={!evalCountryId || triggerEvaluation.isPending}
                    onClick={() =>
                      triggerEvaluation.mutate({
                        countryId: evalCountryId === "all" ? "" : evalCountryId,
                        domain: evalDomain !== "all" ? evalDomain : undefined,
                        bypassLimits,
                      })
                    }
                  >
                    {triggerEvaluation.isPending ? "..." : "Evaluate"}
                  </Button>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <Checkbox
                    id="bypass-limits"
                    checked={bypassLimits}
                    onCheckedChange={(checked) => setBypassLimits(!!checked)}
                  />
                  <label
                    htmlFor="bypass-limits"
                    className="cursor-pointer text-[10px] font-medium text-slate-400 select-none"
                  >
                    Override limits / Bypass weekly cap
                  </label>
                </div>
                {triggerEvaluation.data && (
                  <p className="text-[10px] text-green-400">Criteria check finished.</p>
                )}
              </div>

              {/* Seeding & Imports */}
              <div className="space-y-2 border-t border-white/10 pt-3">
                <label className="block text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                  Template Seeding
                </label>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 border-white/10 bg-white/5 text-xs hover:bg-white/10"
                    disabled={isSeeding}
                    onClick={handleSeedDefaults}
                  >
                    Seed System Templates
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 border-white/10 bg-white/5 text-xs hover:bg-white/10"
                    onClick={() => setBulkImportOpen(!bulkImportOpen)}
                  >
                    <Upload className="mr-1 h-3.5 w-3.5" />
                    JSON Import
                  </Button>
                </div>

                {seedResult && (
                  <div className="rounded border border-green-500/20 bg-green-500/10 p-2 text-[10px] text-green-400">
                    Default Seeding completed. Created: {seedResult.created}, Updated:{" "}
                    {seedResult.updated}, Errors: {seedResult.errors}.
                  </div>
                )}

                {/* Bulk Import Box */}
                {bulkImportOpen && (
                  <div className="mt-2 space-y-2 rounded border border-white/10 bg-white/5 p-2.5">
                    <label className="block text-[9px] font-semibold tracking-wider text-slate-400 uppercase">
                      Paste JSON Template array
                    </label>
                    <Textarea
                      placeholder="[ { 'slug': 'test_issue', ... } ]"
                      value={bulkImportText}
                      onChange={(e) => setBulkImportText(e.target.value)}
                      rows={4}
                      className="border-white/10 bg-black/30 font-mono text-[10px]"
                    />
                    <div className="flex items-center justify-between">
                      <Button
                        size="sm"
                        disabled={!bulkImportText || bulkImportMutation.isPending}
                        onClick={handleBulkImport}
                        className="h-6 bg-amber-500 text-[10px] font-semibold text-black hover:bg-amber-400"
                      >
                        {bulkImportMutation.isPending ? "Importing..." : "Submit Import"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setBulkImportOpen(false)}
                        className="h-6 text-[10px] hover:bg-white/5"
                      >
                        Cancel
                      </Button>
                    </div>
                    {bulkImportError && (
                      <p className="text-[9px] text-red-400">{bulkImportError}</p>
                    )}
                    {bulkImportResult && (
                      <p className="text-[9px] text-green-400">{bulkImportResult}</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Force Generate Panel */}
            <div className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
              <h3 className="flex items-center gap-1.5 border-b border-white/10 pb-2 text-xs font-bold tracking-wider text-amber-400 uppercase">
                <Sliders className="h-4 w-4" />
                Force Generate Issue
              </h3>
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[9px] font-semibold tracking-wider text-slate-400 uppercase">
                      Country
                    </label>
                    <Select value={forceGenCountryId} onValueChange={setForceGenCountryId}>
                      <SelectTrigger className="h-8 border-white/10 bg-white/5 text-xs text-white">
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent className="border-white/10 bg-slate-900 text-white">
                        {countries?.map((c: any) => (
                          <SelectItem
                            key={c.id}
                            value={c.id}
                            className="text-xs focus:bg-white/10 focus:text-white"
                          >
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-[9px] font-semibold tracking-wider text-slate-400 uppercase">
                      Template
                    </label>
                    <Select value={forceGenTemplateId} onValueChange={setForceGenTemplateId}>
                      <SelectTrigger className="h-8 border-white/10 bg-white/5 text-xs text-white">
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent className="border-white/10 bg-slate-900 text-white">
                        {templates.map((t) => (
                          <SelectItem
                            key={t.id}
                            value={t.id}
                            className="text-xs focus:bg-white/10 focus:text-white"
                          >
                            {t.slug}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button
                  size="sm"
                  className="h-8 w-full bg-amber-500 text-xs font-semibold text-black hover:bg-amber-400"
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
            <div className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
              <h3 className="flex items-center gap-1.5 border-b border-white/10 pb-2 text-xs font-bold tracking-wider text-amber-400 uppercase">
                <Send className="h-4 w-4" />
                Inject Narrative Event
              </h3>
              <div className="space-y-2">
                <div>
                  <label className="text-[9px] font-semibold tracking-wider text-slate-400 uppercase">
                    Template
                  </label>
                  <Select value={injectTemplateId} onValueChange={setInjectTemplateId}>
                    <SelectTrigger className="h-8 border-white/10 bg-white/5 text-xs text-white">
                      <SelectValue placeholder="Select template..." />
                    </SelectTrigger>
                    <SelectContent className="border-white/10 bg-slate-900 text-white">
                      {templates.map((t) => (
                        <SelectItem
                          key={t.id}
                          value={t.id}
                          className="text-xs focus:bg-white/10 focus:text-white"
                        >
                          {t.slug}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[9px] font-semibold tracking-wider text-slate-400 uppercase">
                      Scope
                    </label>
                    <Select
                      value={injectScope}
                      onValueChange={(v) => {
                        setInjectScope(v as any);
                        setInjectTarget("");
                      }}
                    >
                      <SelectTrigger className="h-8 border-white/10 bg-white/5 text-xs text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="border-white/10 bg-slate-900 text-white">
                        <SelectItem
                          value="country"
                          className="text-xs focus:bg-white/10 focus:text-white"
                        >
                          Country
                        </SelectItem>
                        <SelectItem
                          value="region"
                          className="text-xs focus:bg-white/10 focus:text-white"
                        >
                          Region
                        </SelectItem>
                        <SelectItem
                          value="continent"
                          className="text-xs focus:bg-white/10 focus:text-white"
                        >
                          Continent
                        </SelectItem>
                        <SelectItem
                          value="all"
                          className="text-xs focus:bg-white/10 focus:text-white"
                        >
                          All
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {injectScope === "country" ? (
                    <div>
                      <label className="text-[9px] font-semibold tracking-wider text-slate-400 uppercase">
                        Target
                      </label>
                      <Select value={injectTarget} onValueChange={setInjectTarget}>
                        <SelectTrigger className="h-8 border-white/10 bg-white/5 text-xs text-white">
                          <SelectValue placeholder="Country..." />
                        </SelectTrigger>
                        <SelectContent className="border-white/10 bg-slate-900 text-white">
                          {countries?.map((c: any) => (
                            <SelectItem
                              key={c.id}
                              value={c.id}
                              className="text-xs focus:bg-white/10 focus:text-white"
                            >
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : injectScope !== "all" ? (
                    <div>
                      <label className="text-[9px] font-semibold tracking-wider text-slate-400 uppercase">
                        Target Name
                      </label>
                      <Input
                        value={injectTarget}
                        onChange={(e) => setInjectTarget(e.target.value)}
                        placeholder={injectScope === "region" ? "e.g. Europe" : "e.g. Asia"}
                        className="h-8 border-white/10 bg-white/5 text-xs text-white"
                      />
                    </div>
                  ) : (
                    <div />
                  )}
                </div>
                <div>
                  <label className="text-[9px] font-semibold tracking-wider text-slate-400 uppercase">
                    Label (optional)
                  </label>
                  <Input
                    value={injectLabel}
                    onChange={(e) => setInjectLabel(e.target.value)}
                    placeholder="e.g. Summer arc event"
                    className="h-8 border-white/10 bg-white/5 text-xs text-white"
                  />
                </div>
                <Button
                  size="sm"
                  className="h-8 w-full bg-amber-500 text-xs font-semibold text-black hover:bg-amber-400"
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
          <div className="space-y-4 lg:col-span-2">
            {/* Navigation Tabs and Quick Search Filter */}
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/5 p-3 backdrop-blur-md">
              <div className="flex gap-2">
                <Button
                  variant={activeTab === "templates" ? "default" : "ghost"}
                  onClick={() => setActiveTab("templates")}
                  className={`h-8 text-xs ${activeTab === "templates" ? "bg-amber-500 font-semibold text-black hover:bg-amber-400" : "text-slate-300 hover:bg-white/5"}`}
                >
                  <BookOpen className="mr-1 h-4 w-4" />
                  Templates Manager
                </Button>
                <Button
                  variant={activeTab === "issues" ? "default" : "ghost"}
                  onClick={() => setActiveTab("issues")}
                  className={`h-8 text-xs ${activeTab === "issues" ? "bg-amber-500 font-semibold text-black hover:bg-amber-400" : "text-slate-300 hover:bg-white/5"}`}
                >
                  <Calendar className="mr-1 h-4 w-4" />
                  Active Issues Monitor
                </Button>
              </div>

              {activeTab === "templates" && (
                <div className="flex max-w-md flex-1 justify-end gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    <Input
                      placeholder="Search slug/title..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="h-8 border-white/10 bg-black/20 pl-8 text-xs text-white"
                    />
                  </div>
                  <Select value={domainFilter} onValueChange={setDomainFilter}>
                    <SelectTrigger className="h-8 w-32 border-white/10 bg-black/20 text-xs text-white">
                      <SelectValue placeholder="All domains" />
                    </SelectTrigger>
                    <SelectContent className="border-white/10 bg-slate-900 text-white">
                      <SelectItem
                        value="all"
                        className="text-xs focus:bg-white/10 focus:text-white"
                      >
                        All domains
                      </SelectItem>
                      {DOMAINS.map((d) => (
                        <SelectItem
                          key={d}
                          value={d}
                          className="text-xs focus:bg-white/10 focus:text-white"
                        >
                          {d} ({domainCounts[d] ?? 0})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    onClick={() => setEditorSheet({ isOpen: true, templateId: null })}
                    className="h-8 shrink-0 bg-green-600 text-xs font-semibold text-white hover:bg-green-500"
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    Create
                  </Button>
                </div>
              )}
            </div>

            {/* Templates Workspace */}
            {activeTab === "templates" ? (
              <div className="max-h-[calc(100vh-220px)] scrollbar-thin space-y-2 overflow-y-auto pr-1">
                {isTemplatesLoading ? (
                  <div className="py-8 text-center text-xs text-slate-400">
                    Loading templates...
                  </div>
                ) : templates.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-white/10 bg-white/5 py-8 text-center text-xs text-slate-400">
                    No templates found matching your filters. Seed the defaults or create a new
                    template.
                  </div>
                ) : (
                  templates.map((template) => (
                    <div
                      key={template.id}
                      className={`rounded-xl border bg-white/5 p-3.5 transition-all ${
                        template.isActive
                          ? "border-white/10 hover:border-white/20"
                          : "border-white/5 opacity-50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="mb-1 flex flex-wrap items-center gap-1.5">
                            <span className="rounded border border-white/5 bg-black/40 px-1.5 py-0.5 font-mono text-[10px] text-slate-300">
                              {template.slug}
                            </span>
                            <Badge
                              variant="outline"
                              className={`px-1.5 py-0 text-[9px] font-semibold uppercase ${DOMAIN_COLORS[template.domain] ?? ""}`}
                            >
                              {template.domain}
                            </Badge>
                            <Badge
                              variant="outline"
                              className={`px-1.5 py-0 text-[9px] font-semibold uppercase ${SEVERITY_COLORS[template.baseSeverity as string] ?? ""}`}
                            >
                              {template.baseSeverity as string}
                            </Badge>
                            {template.deadlineDaysBase && (
                              <Badge
                                variant="outline"
                                className="border-red-500/15 bg-red-500/10 text-[9px] text-red-400"
                              >
                                {template.deadlineDaysBase}d deadline
                              </Badge>
                            )}
                            <span className="ml-1 text-[10px] text-slate-400">
                              {(template as any)._count?.instances ?? 0} instances
                            </span>
                          </div>
                          <h4 className="mt-1 text-xs font-semibold text-white">
                            {template.title}
                          </h4>
                          <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-slate-400">
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
                              <ToggleLeft className="h-4.5 w-4.5 text-slate-500" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                            title="Delete template"
                            onClick={() => {
                              if (
                                confirm(`Delete template "${template.slug}"? This is destructive.`)
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
                  ))
                )}
              </div>
            ) : (
              /* Active Issues Monitor View */
              <div className="space-y-4 rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
                {/* Active Issues filters */}
                <div className="flex items-center gap-2">
                  <span className="mr-2 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                    Audit Filters
                  </span>
                  <Select
                    value={activeStatusFilter}
                    onValueChange={(val) => {
                      setActiveStatusFilter(val);
                      void refetchActiveIssues();
                    }}
                  >
                    <SelectTrigger className="h-8 w-36 border-white/10 bg-black/20 text-xs text-white">
                      <SelectValue placeholder="Status..." />
                    </SelectTrigger>
                    <SelectContent className="border-white/10 bg-slate-900 text-white">
                      <SelectItem value="all" className="text-xs">
                        All statuses
                      </SelectItem>
                      <SelectItem value="pending" className="text-xs">
                        Pending
                      </SelectItem>
                      <SelectItem value="viewed" className="text-xs">
                        Viewed
                      </SelectItem>
                      <SelectItem value="responded" className="text-xs">
                        Responded
                      </SelectItem>
                      <SelectItem value="auto_resolved" className="text-xs">
                        Auto Resolved
                      </SelectItem>
                      <SelectItem value="expired" className="text-xs">
                        Expired
                      </SelectItem>
                      <SelectItem value="dismissed" className="text-xs">
                        Dismissed
                      </SelectItem>
                    </SelectContent>
                  </Select>

                  <Select
                    value={activeCountryFilter}
                    onValueChange={(val) => {
                      setActiveCountryFilter(val);
                      void refetchActiveIssues();
                    }}
                  >
                    <SelectTrigger className="h-8 w-44 border-white/10 bg-black/20 text-xs text-white">
                      <SelectValue placeholder="Country..." />
                    </SelectTrigger>
                    <SelectContent className="border-white/10 bg-slate-900 text-white">
                      <SelectItem value="all" className="text-xs">
                        All Countries
                      </SelectItem>
                      {countries?.map((c: any) => (
                        <SelectItem key={c.id} value={c.id} className="text-xs">
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void refetchActiveIssues()}
                    className="h-8 text-slate-300 hover:bg-white/5"
                  >
                    <RefreshCw className="mr-1 h-3.5 w-3.5" />
                    Refresh Feed
                  </Button>
                </div>

                {/* Issues List Container */}
                <div className="max-h-[calc(100vh-280px)] scrollbar-thin space-y-2 overflow-y-auto pr-1">
                  {isIssuesLoading ? (
                    <div className="py-8 text-center text-xs text-slate-400">
                      Loading active issues...
                    </div>
                  ) : activeIssues.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-white/10 bg-white/5 py-8 text-center text-xs text-slate-400">
                      No active issues match the selected filters.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs text-slate-300">
                        <thead className="border-b border-white/10 bg-black/40 text-[10px] tracking-wider text-slate-400 uppercase">
                          <tr>
                            <th className="px-3 py-2">Country</th>
                            <th className="px-3 py-2">Issue Title</th>
                            <th className="px-3 py-2">Severity</th>
                            <th className="px-3 py-2">Urgency</th>
                            <th className="px-3 py-2">Status</th>
                            <th className="px-3 py-2">Resolution Choice</th>
                            <th className="px-3 py-2 text-right">Created At</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {activeIssues.map((issue) => (
                            <tr key={issue.id} className="hover:bg-white/5">
                              <td className="px-3 py-2.5 font-semibold text-white">
                                {issue.country.name}
                              </td>
                              <td
                                className="max-w-[200px] truncate px-3 py-2.5"
                                title={issue.title}
                              >
                                {issue.title}
                              </td>
                              <td className="px-3 py-2.5">
                                <Badge
                                  variant="outline"
                                  className={`px-1 py-0 text-[9px] uppercase ${SEVERITY_COLORS[issue.severity] ?? ""}`}
                                >
                                  {issue.severity}
                                </Badge>
                              </td>
                              <td className="px-3 py-2.5 font-mono">{issue.urgency}%</td>
                              <td className="px-3 py-2.5">
                                <Badge
                                  variant="outline"
                                  className={`px-1 py-0 text-[9px] uppercase ${STATUS_COLORS[issue.status] ?? ""}`}
                                >
                                  {issue.status}
                                </Badge>
                              </td>
                              <td
                                className="max-w-[150px] truncate px-3 py-2.5"
                                title={issue.chosenOptionLabel ?? ""}
                              >
                                {issue.chosenOptionLabel ? (
                                  <span className="flex items-center gap-1 text-green-400">
                                    <CheckCircle className="inline h-3 w-3 shrink-0" />
                                    {issue.chosenOptionLabel}
                                  </span>
                                ) : (
                                  <span className="text-slate-500">Unresolved</span>
                                )}
                              </td>
                              <td className="px-3 py-2.5 text-right font-mono text-[10px] text-slate-400">
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
          <DialogContent className="max-w-xl border-white/10 bg-slate-900 text-white">
            <DialogHeader>
              <DialogTitle className="text-md text-white">
                Issue Template Execution Preview
              </DialogTitle>
            </DialogHeader>
            {isPreviewLoading ? (
              <div className="py-4 text-center text-xs text-slate-400">Evaluating triggers...</div>
            ) : previewData ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Badge
                    variant={previewData.triggersPassed ? "default" : "outline"}
                    className={
                      previewData.triggersPassed
                        ? "border-green-500/20 bg-green-500/20 text-xs text-green-400"
                        : "border-red-500/20 bg-red-500/20 text-xs text-red-400"
                    }
                  >
                    Criteria Check:{" "}
                    {previewData.triggersPassed ? "CRITERIA PASSED" : "CRITERIA FAILED"}
                  </Badge>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/5 p-3.5">
                  <h4 className="mb-1 text-xs font-bold text-amber-400">
                    {previewData.rendered.title}
                  </h4>
                  <p className="text-xs leading-relaxed text-slate-300">
                    {previewData.rendered.description}
                  </p>
                  {previewData.rendered.longDescription && (
                    <p className="mt-2.5 border-l-2 border-white/15 pl-2.5 text-xs leading-relaxed whitespace-pre-line text-slate-400">
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
                        <p className="mt-0.5 text-[10px] text-slate-400">{opt.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="border-t border-white/5 pt-2.5 text-[10px] text-slate-500">
                  Tested Against Country: {previewData.snapshot.name} | GDP: $
                  {previewData.snapshot.gdp?.toLocaleString()} | Public Approval:{" "}
                  {previewData.snapshot.approval}%
                </div>
              </div>
            ) : null}
          </DialogContent>
        </Dialog>

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
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col justify-between rounded-lg border border-white/10 bg-white/5 p-3">
      <div className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
        {label}
      </div>
      <div className="mt-1 text-lg font-bold text-white">{value}</div>
    </div>
  );
}
