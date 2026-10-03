"use client";
// src/app/admin/national-issues/NationalIssuesPanel.tsx
// National Issues Admin Panel with Facet styling and single-page routing

import { useState, useEffect } from "react";
import {
  Journal as Newspaper,
  Plus,
  Play,
  Trash as Trash2,
  ControlSlider as Sliders,
} from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Switch } from "~/components/ui/switch";
import { ValueSelect } from "~/components/ui/value-select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { api } from "~/trpc/react";
import { ALL_REALMS } from "~/lib/realms/realm-ids";
import { TemplateEditorSheet } from "./TemplateEditorSheet";
import { PageHeader } from "~/components/shell/PageHeader";
import { usePageTitle } from "~/hooks/usePageTitle";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "~/components/ui/table";
import { Card } from "~/components/ui/card";

const DOMAIN_COLORS: Record<string, string> = {
  economic: "bg-green/20 text-green border-green/20",
  political: "bg-purple/20 text-purple border-purple/20",
  social: "bg-blue/20 text-blue border-blue/20",
  military: "bg-red/20 text-red border-red/20",
  diplomatic: "bg-teal/20 text-teal border-teal/20",
  infrastructure: "bg-yellow/20 text-yellow border-yellow/20",
  environmental: "bg-green/20 text-green border-green/20",
};

const SEVERITY_COLORS: Record<string, string> = {
  trivial: "bg-fill-3 text-label-secondary border-separator",
  minor: "bg-blue/20 text-blue border-blue/20",
  moderate: "bg-yellow/20 text-yellow border-yellow/20",
  major: "bg-orange/20 text-orange border-orange/20",
  critical: "bg-red/20 text-red border-red/20",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow/10 text-yellow border-yellow/20",
  viewed: "bg-blue/10 text-blue border-blue/20",
  responded: "bg-green/10 text-green border-green/20",
  auto_resolved: "bg-fill-3 text-label-secondary border-separator",
  expired: "bg-red/10 text-red border-red/20",
  dismissed: "bg-fill-3 text-label-secondary border-separator",
};

function NationalIssuesPanel() {
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
  const { data: countries } = api.countries.getSelectList.useQuery({
    limit: 100,
    realm: ALL_REALMS,
  });

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
      <PageHeader
        title="National issues"
        subtitle="Decision trees, generation triggers and storyteller injections."
      />

      {/* Global Stat Bar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-4">
          <p className="text-label-secondary text-stat-label">Total evaluations</p>
          <p className="text-label text-title-2 mt-1 tabular-nums">
            {stats?.totalEvaluations ?? "—"}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-label-secondary text-stat-label">Generated (7d)</p>
          <p className="text-title-2 text-teal mt-1 tabular-nums">
            {stats?.totalIssuesGenerated ?? "—"}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-label-secondary text-stat-label">Avg exec time</p>
          <p className="text-title-2 text-green mt-1 tabular-nums">
            {stats?.avgExecutionTime ? `${stats.avgExecutionTime}ms` : "—"}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-label-secondary text-stat-label">Top domain</p>
          <p className="text-title-2 text-purple mt-1 tabular-nums">
            {stats?.domainStats?.[0]?.domain
              ? String(stats.domainStats[0].domain).toUpperCase()
              : "—"}
          </p>
        </Card>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(val: string) => setActiveTab(val as any)}
        className="w-full"
      >
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <TabsList className="bg-fill-3 rounded-row flex w-full flex-wrap justify-start gap-1 p-1 sm:w-auto">
            <TabsTrigger
              value="templates"
              className="rounded-control text-caption flex items-center gap-2 px-3 py-2"
            >
              <Newspaper className="h-3.5 w-3.5" />
              Templates ({templatesData?.templates?.length ?? 0})
            </TabsTrigger>
            <TabsTrigger
              value="issues"
              className="rounded-control text-caption flex items-center gap-2 px-3 py-2"
            >
              <Play className="text-teal h-3.5 w-3.5" />
              Active Instances ({issuesData?.issues?.length ?? 0})
            </TabsTrigger>
            <TabsTrigger
              value="engine"
              className="rounded-control text-caption flex items-center gap-2 px-3 py-2"
            >
              <Sliders className="text-yellow h-3.5 w-3.5" />
              Engine configuration
            </TabsTrigger>
          </TabsList>

          {activeTab === "templates" && (
            <Button size="sm" onClick={() => setEditorSheet({ isOpen: true, templateId: null })}>
              <Plus className="mr-2 h-3.5 w-3.5" />
              New template
            </Button>
          )}
        </div>

        {/* Templates Tab */}
        <TabsContent value="templates" className="mt-4 space-y-4 focus-visible:outline-none">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative max-w-sm min-w-[200px] flex-1">
              <Input
                placeholder="Search templates..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="rounded-control-sm md:text-footnote h-(--control-height-sm) pl-3"
              />
            </div>
            <ValueSelect
              value={domainFilter}
              onValueChange={setDomainFilter}
              options={[
                ["all", "All domains"],
                ["economic", "Economic"],
                ["political", "Political"],
                ["social", "Social"],
                ["military", "Military"],
                ["diplomatic", "Diplomatic"],
                ["infrastructure", "Infrastructure"],
                ["environmental", "Environmental"],
              ]}
              size="sm"
              className="w-44"
              placeholder="All domains"
              itemClassName="text-footnote"
            />
          </div>

          {isTemplatesLoading ? (
            <div className="text-label-secondary text-footnote p-8 text-center">
              Loading templates...
            </div>
          ) : templatesData?.templates?.length === 0 ? (
            <Card className="p-12 text-center">
              <p className="text-label-secondary text-footnote">
                No issue templates matching criteria.
              </p>
            </Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="px-4">Issue title & description</TableHead>
                    <TableHead className="px-4">Domain</TableHead>
                    <TableHead className="px-4">Severity</TableHead>
                    <TableHead className="px-4">Active</TableHead>
                    <TableHead className="px-4 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templatesData?.templates?.map((t: any) => (
                    <TableRow key={t.id}>
                      <TableCell className="px-4">
                        <div className="text-label font-semibold">{t.title}</div>
                        <div className="text-label-secondary text-footnote max-w-sm truncate">
                          {t.description}
                        </div>
                      </TableCell>
                      <TableCell className="px-4">
                        <span
                          className={`rounded-control-sm text-eyebrow inline-block border px-2 py-0.5 ${DOMAIN_COLORS[t.domain] || ""}`}
                        >
                          {t.domain}
                        </span>
                      </TableCell>
                      <TableCell className="px-4">
                        <span
                          className={`rounded-control-sm text-eyebrow inline-block border px-2 py-0.5 ${SEVERITY_COLORS[t.severity] || ""}`}
                        >
                          {t.severity}
                        </span>
                      </TableCell>
                      <TableCell className="px-4">
                        <Switch
                          checked={t.isActive}
                          onCheckedChange={(isActive) =>
                            toggleTemplate.mutate({ id: t.id, isActive })
                          }
                          aria-label={`Active: ${t.title}`}
                          title="Toggle status"
                        />
                      </TableCell>
                      <TableCell className="px-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditorSheet({ isOpen: true, templateId: t.id })}
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
                            className="text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        {/* Active Issues Tab */}
        <TabsContent value="issues" className="mt-4 focus-visible:outline-none">
          {isIssuesLoading ? (
            <div className="text-label-secondary text-footnote p-8 text-center">
              Loading active instances...
            </div>
          ) : issuesData?.issues?.length === 0 ? (
            <Card className="p-12 text-center">
              <p className="text-label-secondary text-footnote">
                No active national issue instances recorded.
              </p>
            </Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="px-4">Issue title & description</TableHead>
                    <TableHead className="px-4">Nation</TableHead>
                    <TableHead className="px-4">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {issuesData?.issues?.map((issue: any) => (
                    <TableRow key={issue.id}>
                      <TableCell className="px-4">
                        <div className="text-label font-semibold">{issue.title}</div>
                        <div className="text-label-secondary text-footnote max-w-sm truncate">
                          {issue.description}
                        </div>
                      </TableCell>
                      <TableCell className="text-label-secondary px-4 font-mono">
                        {issue.country?.name || issue.countryId}
                      </TableCell>
                      <TableCell className="px-4">
                        <span
                          className={`rounded-control-sm text-eyebrow inline-block border px-2 py-0.5 ${STATUS_COLORS[issue.status] || ""}`}
                        >
                          {issue.status}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        {/* Engine Configuration Tab */}
        <TabsContent value="engine" className="mt-4 focus-visible:outline-none">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Card className="space-y-4 p-5">
              <h3 className="text-label text-subhead flex items-center gap-2">
                <Sliders className="text-yellow h-4 w-4" />
                Issue generation engine limits
              </h3>
              <div className="text-footnote space-y-3">
                <div>
                  <label className="text-label-secondary mb-1 block">Max per Session</label>
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    value={maxIssuesPerSession}
                    onChange={(e) => setMaxIssuesPerSession(parseInt(e.target.value) || 1)}
                    className="rounded-control-sm md:text-footnote h-(--control-height-sm) font-mono"
                  />
                </div>
                <div>
                  <label className="text-label-secondary mb-1 block">Max per Week</label>
                  <Input
                    type="number"
                    min={1}
                    max={20}
                    value={maxIssuesPerWeek}
                    onChange={(e) => setMaxIssuesPerWeek(parseInt(e.target.value) || 1)}
                    className="rounded-control-sm md:text-footnote h-(--control-height-sm) font-mono"
                  />
                </div>
                <Button
                  size="sm"
                  onClick={handleSaveEngineLimits}
                  disabled={updateEngineConfig.isPending}
                >
                  {updateEngineConfig.isPending ? "Saving..." : "Save Engine Config"}
                </Button>
              </div>
            </Card>

            <Card className="space-y-4 p-5">
              <h3 className="text-label text-subhead flex items-center gap-2">
                <Play className="text-green h-4 w-4" />
                Live criteria evaluation test
              </h3>
              <div className="text-footnote space-y-3">
                <ValueSelect
                  value={evalCountryId}
                  onValueChange={setEvalCountryId}
                  options={countries?.map((c) => [c.id, c.name] as const)}
                  size="sm"
                  placeholder="Select Target Country..."
                  itemClassName="text-footnote"
                />
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
                >
                  {evaluateIssues.isPending ? "Evaluating..." : "Evaluate Criteria"}
                </Button>
              </div>
            </Card>
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
