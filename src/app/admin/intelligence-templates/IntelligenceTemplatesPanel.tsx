"use client";
// src/app/admin/intelligence-templates/IntelligenceTemplatesPanel.tsx
// Admin interface for managing intelligence report templates

import { RowActions } from "../_components/RowActions";
import { useState } from "react";
import { usePageTitle } from "~/hooks/usePageTitle";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { ValueSelect } from "~/components/ui/value-select";
import { useNotify } from "~/hooks/useNotify";
import { Plus, Eye, Search } from "iconoir-react";
import { PageHeader } from "~/components/shell/PageHeader";
import { Skeleton } from "~/components/ui/skeleton";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "~/components/ui/table";
import { Card } from "~/components/ui/card";

interface IntelligenceTemplate {
  id: string;
  reportType: string;
  classification: string;
  summaryTemplate: string;
  findingsTemplate: string;
  minimumLevel: number;
  confidenceBase: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const REPORT_TYPE_LABELS: Record<string, string> = {
  economic: "Economic Intelligence Report",
  political: "Political Intelligence Report",
  security: "Security Intelligence Report",
};

export function IntelligenceTemplatesPanel() {
  usePageTitle({ title: "Admin - Intelligence Templates" });

  const notify = useNotify();

  // State
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<IntelligenceTemplate | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<IntelligenceTemplate | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [classificationFilter, setClassificationFilter] = useState("all");

  // Queries
  const { data: templates, isLoading, refetch } = api.intelligence.getAllTemplates.useQuery();

  const filteredTemplates = (templates || []).filter((template: any) => {
    if (typeFilter !== "all" && template.reportType !== typeFilter) return false;
    if (classificationFilter !== "all" && template.classification !== classificationFilter)
      return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const label = (REPORT_TYPE_LABELS[template.reportType] || template.reportType).toLowerCase();
      const summary = (template.summaryTemplate || "").toLowerCase();
      return label.includes(q) || summary.includes(q);
    }
    return true;
  });

  // Form State
  const [formData, setFormData] = useState<{
    reportType: "economic" | "political" | "security";
    classification: "PUBLIC" | "RESTRICTED";
    summaryTemplate: string;
    findingsTemplate: string;
    minimumLevel: number;
    confidenceBase: number;
  }>({
    reportType: "economic",
    classification: "RESTRICTED",
    summaryTemplate: "",
    findingsTemplate: "[]",
    minimumLevel: 1,
    confidenceBase: 70,
  });

  // Mutations
  const createMutation = api.intelligence.createTemplate.useMutation({
    onSuccess: () => {
      notify.success("Success", "Intelligence template created successfully");
      setIsAddDialogOpen(false);
      resetForm();
      refetch();
    },
    onError: (error) => {
      notify.error("Error", error.message || "Failed to create template");
    },
  });

  const updateMutation = api.intelligence.updateTemplate.useMutation({
    onSuccess: () => {
      notify.success("Success", "Intelligence template updated successfully");
      setEditingTemplate(null);
      resetForm();
      refetch();
    },
    onError: (error) => {
      notify.error("Error", error.message || "Failed to update template");
    },
  });

  const deleteMutation = api.intelligence.deleteTemplate.useMutation({
    onSuccess: () => {
      notify.success("Success", "Intelligence template deleted successfully");
      refetch();
    },
    onError: (error) => {
      notify.error("Error", error.message || "Failed to delete template");
    },
  });

  const resetForm = () => {
    setFormData({
      reportType: "economic",
      classification: "RESTRICTED",
      summaryTemplate: "",
      findingsTemplate: "[]",
      minimumLevel: 1,
      confidenceBase: 70,
    });
  };

  const handleEdit = (template: any) => {
    setEditingTemplate(template);
    setFormData({
      reportType: template.reportType as "economic" | "political" | "security",
      classification: (template.classification === "PUBLIC" ? "PUBLIC" : "RESTRICTED") as
        "PUBLIC" | "RESTRICTED",
      summaryTemplate: template.summaryTemplate,
      findingsTemplate: template.findingsTemplate || "[]",
      minimumLevel: template.minimumLevel,
      confidenceBase: template.confidenceBase,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingTemplate) {
      updateMutation.mutate({
        id: editingTemplate.id,
        ...formData,
      });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this template?")) {
      deleteMutation.mutate({ id });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Intelligence report templates"
        subtitle="Analytical templates, classification rules and findings formats."
      />

      {/* Metric Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-4">
          <p className="text-label-secondary text-stat-label">Total templates</p>
          <p className="text-label text-title-2 mt-1 tabular-nums">{templates?.length || 0}</p>
        </Card>
        <Card className="p-4">
          <p className="text-label-secondary text-stat-label">Restricted clearance</p>
          <p className="text-title-2 text-yellow mt-1 tabular-nums">
            {templates?.filter((t: any) => t.classification === "RESTRICTED").length || 0}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-label-secondary text-stat-label">Public briefings</p>
          <p className="text-title-2 text-teal mt-1 tabular-nums">
            {templates?.filter((t: any) => t.classification === "PUBLIC").length || 0}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-label-secondary text-stat-label">Active registry</p>
          <p className="text-title-2 text-green mt-1 tabular-nums">
            {templates?.filter((t: any) => t.isActive).length || 0}
          </p>
        </Card>
      </div>

      {/* Filter & Action Rail */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative max-w-sm min-w-[200px] flex-1">
            <Search className="text-label-secondary absolute top-1/2 left-2 h-3.5 w-3.5 -translate-y-1/2" />
            <Input
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="rounded-control-sm md:text-footnote h-(--control-height-sm) pl-8"
            />
          </div>

          <ValueSelect
            value={typeFilter}
            onValueChange={setTypeFilter}
            options={[
              ["all", "All report types"],
              ["economic", "Economic report"],
              ["political", "Political report"],
              ["security", "Security report"],
            ]}
            size="sm"
            className="w-44"
            placeholder="All report types"
            itemClassName="text-footnote"
          />

          <ValueSelect
            value={classificationFilter}
            onValueChange={setClassificationFilter}
            options={[
              ["all", "All clearances"],
              ["PUBLIC", "PUBLIC"],
              ["RESTRICTED", "RESTRICTED"],
            ]}
            size="sm"
            className="w-36"
            placeholder="All clearances"
            itemClassName="text-footnote"
          />
        </div>

        <Button
          onClick={() => {
            resetForm();
            setIsAddDialogOpen(true);
          }}
        >
          <Plus className="mr-2 h-3.5 w-3.5" />
          Add template
        </Button>
      </div>

      {/* High-Density Inset Glass Table */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="rounded-row h-12 w-full" />
          ))}
        </div>
      ) : filteredTemplates.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-label-secondary text-footnote">
            No intelligence templates matching filters.
          </p>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="px-4">Report type & summary</TableHead>
                <TableHead className="px-4">Classification</TableHead>
                <TableHead className="px-4">Clearance</TableHead>
                <TableHead className="px-4">Confidence</TableHead>
                <TableHead className="px-4">Status</TableHead>
                <TableHead className="px-4 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTemplates.map((template: any) => (
                <TableRow key={template.id}>
                  <TableCell className="px-4">
                    <div className="text-label font-semibold">
                      {REPORT_TYPE_LABELS[template.reportType] || template.reportType}
                    </div>
                    {template.summaryTemplate && (
                      <div className="text-label-secondary text-footnote max-w-sm truncate">
                        {template.summaryTemplate}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="px-4">
                    <span
                      className={`rounded-control-sm text-eyebrow inline-block border px-2 py-0.5 ${
                        template.classification === "RESTRICTED"
                          ? "border-yellow/30 bg-yellow/10 text-yellow"
                          : "border-teal/30 bg-teal/10 text-teal"
                      }`}
                    >
                      {template.classification}
                    </span>
                  </TableCell>
                  <TableCell className="text-label-secondary px-4">
                    Level {template.minimumLevel}+
                  </TableCell>
                  <TableCell className="text-label px-4 font-medium">
                    {template.confidenceBase}%
                  </TableCell>
                  <TableCell className="px-4">
                    <span
                      className={`rounded-control-sm text-caption inline-block px-2 py-0.5 ${
                        template.isActive
                          ? "border-green/20 bg-green/10 text-green border"
                          : "bg-fill-3 text-label-secondary border-separator border"
                      }`}
                    >
                      {template.isActive ? "Active" : "Inactive"}
                    </span>
                  </TableCell>
                  <TableCell className="px-4 text-right">
                    <RowActions
                      before={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Preview"
                          onClick={() => setPreviewTemplate(template)}

                          title="Preview"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      }
                      onEdit={() => handleEdit(template)}
                      onDelete={() => handleDelete(template.id)}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Add/Edit Dialog */}
      <Dialog
        open={isAddDialogOpen || !!editingTemplate}
        onOpenChange={(open) => {
          if (!open) {
            setIsAddDialogOpen(false);
            setEditingTemplate(null);
            resetForm();
          }
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? "Edit Intelligence Template" : "Add Intelligence Template"}
            </DialogTitle>
            <DialogDescription>
              Define the report type, security clearance level, and dynamic text templates.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-label text-caption mb-2 block">Report type</label>
                <ValueSelect
                  value={formData.reportType}
                  onValueChange={(val: any) =>
                    setFormData((prev) => ({ ...prev, reportType: val }))
                  }
                  options={[
                    ["economic", "Economic report"],
                    ["political", "Political report"],
                    ["security", "Security report"],
                  ]}
                  size="sm"
                />
              </div>

              <div>
                <label className="text-label text-caption mb-2 block">Classification</label>
                <ValueSelect
                  value={formData.classification}
                  onValueChange={(val: any) =>
                    setFormData((prev) => ({ ...prev, classification: val }))
                  }
                  options={[
                    ["PUBLIC", "PUBLIC"],
                    ["RESTRICTED", "RESTRICTED"],
                  ]}
                  size="sm"
                />
              </div>
            </div>

            <div>
              <label className="text-label text-caption mb-2 block">Summary template</label>
              <Textarea
                value={formData.summaryTemplate}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, summaryTemplate: e.target.value }))
                }
                placeholder="Template text with {{tags}}..."
                rows={3}
                className="md:text-footnote"
              />
            </div>

            <div>
              <label className="text-label text-caption mb-2 block">Findings template</label>
              <Textarea
                value={formData.findingsTemplate}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, findingsTemplate: e.target.value }))
                }
                placeholder="Findings section format..."
                rows={4}
                className="md:text-footnote"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-label text-caption mb-2 block">Minimum level required</label>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={formData.minimumLevel}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      minimumLevel: parseInt(e.target.value) || 1,
                    }))
                  }
                  className="rounded-control-sm md:text-footnote h-(--control-height-sm)"
                />
              </div>

              <div>
                <label className="text-label text-caption mb-2 block">Confidence Base (%)</label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={formData.confidenceBase}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      confidenceBase: parseInt(e.target.value) || 50,
                    }))
                  }
                  className="rounded-control-sm md:text-footnote h-(--control-height-sm)"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsAddDialogOpen(false);
                  setEditingTemplate(null);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {editingTemplate ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      {previewTemplate && (
        <Dialog open={!!previewTemplate} onOpenChange={() => setPreviewTemplate(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Template preview</DialogTitle>
              <DialogDescription>
                {REPORT_TYPE_LABELS[previewTemplate.reportType]} ({previewTemplate.classification})
              </DialogDescription>
            </DialogHeader>

            <div className="text-footnote space-y-4">
              <div className="bg-surface border-separator rounded-row border p-4">
                <h4 className="text-label mb-1 font-semibold">Summary structure</h4>
                <p className="text-label-secondary whitespace-pre-wrap">
                  {previewTemplate.summaryTemplate}
                </p>
              </div>

              <div className="bg-surface border-separator rounded-row border p-4">
                <h4 className="text-label mb-1 font-semibold">Findings structure</h4>
                <p className="text-label-secondary whitespace-pre-wrap">
                  {previewTemplate.findingsTemplate}
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button onClick={() => setPreviewTemplate(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
