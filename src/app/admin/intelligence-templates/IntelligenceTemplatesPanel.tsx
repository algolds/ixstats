"use client";
// src/app/admin/intelligence-templates/IntelligenceTemplatesPanel.tsx
// Admin interface for managing intelligence report templates

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { useNotify } from "~/hooks/useNotify";
import { Plus, EditPencil as Pencil, Trash as Trash2, Eye, Shield, Search } from "iconoir-react";
import { AdminHeader } from "../_components/AdminHeader";
import { Skeleton } from "~/components/ui/skeleton";
import { FacetCard } from "~/components/ui/facet-container";

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
      <AdminHeader
        icon={Shield}
        title="Intelligence Report Templates"
        description="Configure structured analytical templates, classification clearance rules, and findings formats."
      />

      {/* Metric Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <FacetCard className="p-3.5">
          <p className="text-label-secondary text-eyebrow">Total Templates</p>
          <p className="text-label text-title-2 mt-1 tabular-nums">{templates?.length || 0}</p>
        </FacetCard>
        <FacetCard className="p-3.5">
          <p className="text-label-secondary text-eyebrow">Restricted Clearance</p>
          <p className="text-title-2 text-yellow mt-1 tabular-nums">
            {templates?.filter((t: any) => t.classification === "RESTRICTED").length || 0}
          </p>
        </FacetCard>
        <FacetCard className="p-3.5">
          <p className="text-label-secondary text-eyebrow">Public Briefings</p>
          <p className="text-title-2 text-teal mt-1 tabular-nums">
            {templates?.filter((t: any) => t.classification === "PUBLIC").length || 0}
          </p>
        </FacetCard>
        <FacetCard className="p-3.5">
          <p className="text-label-secondary text-eyebrow">Active Registry</p>
          <p className="text-title-2 text-green mt-1 tabular-nums">
            {templates?.filter((t: any) => t.isActive).length || 0}
          </p>
        </FacetCard>
      </div>

      {/* Filter & Action Rail */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative max-w-sm min-w-[200px] flex-1">
            <Search className="text-label-secondary absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2" />
            <Input
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="rounded-control-sm md:text-footnote h-(--control-height-sm) pl-8"
            />
          </div>

          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger size="sm" className="w-44">
              <SelectValue placeholder="All Report Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-footnote">
                All Report Types
              </SelectItem>
              <SelectItem value="economic" className="text-footnote">
                Economic Report
              </SelectItem>
              <SelectItem value="political" className="text-footnote">
                Political Report
              </SelectItem>
              <SelectItem value="security" className="text-footnote">
                Security Report
              </SelectItem>
            </SelectContent>
          </Select>

          <Select value={classificationFilter} onValueChange={setClassificationFilter}>
            <SelectTrigger size="sm" className="w-36">
              <SelectValue placeholder="All Clearances" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-footnote">
                All Clearances
              </SelectItem>
              <SelectItem value="PUBLIC" className="text-footnote">
                PUBLIC
              </SelectItem>
              <SelectItem value="RESTRICTED" className="text-footnote">
                RESTRICTED
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button
          onClick={() => {
            resetForm();
            setIsAddDialogOpen(true);
          }}
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add Template
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
        <FacetCard className="p-12 text-center">
          <p className="text-label-secondary text-footnote">
            No intelligence templates matching filters.
          </p>
        </FacetCard>
      ) : (
        <FacetCard className="overflow-x-auto">
          <table className="text-footnote w-full tabular-nums">
            <thead>
              <tr className="border-separator bg-fill-4 text-label-secondary border-b font-semibold">
                <th className="px-4 py-2.5 text-left font-medium">Report Type & Summary</th>
                <th className="px-4 py-2.5 text-left font-medium">Classification</th>
                <th className="px-4 py-2.5 text-left font-medium">Clearance</th>
                <th className="px-4 py-2.5 text-left font-medium">Confidence</th>
                <th className="px-4 py-2.5 text-left font-medium">Status</th>
                <th className="px-4 py-2.5 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-separator divide-y">
              {filteredTemplates.map((template: any) => (
                <tr key={template.id} className="hover:bg-fill-4 transition-colors">
                  <td className="px-4 py-2.5">
                    <div className="text-label font-semibold">
                      {REPORT_TYPE_LABELS[template.reportType] || template.reportType}
                    </div>
                    {template.summaryTemplate && (
                      <div className="text-label-secondary text-footnote max-w-sm truncate">
                        {template.summaryTemplate}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`rounded-control-sm text-eyebrow inline-block border px-2 py-0.5 ${
                        template.classification === "RESTRICTED"
                          ? "border-yellow/30 bg-yellow/10 text-yellow"
                          : "border-teal/30 bg-teal/10 text-teal"
                      }`}
                    >
                      {template.classification}
                    </span>
                  </td>
                  <td className="text-label-secondary px-4 py-2.5 tabular-nums">
                    Level {template.minimumLevel}+
                  </td>
                  <td className="text-label px-4 py-2.5 font-medium tabular-nums">
                    {template.confidenceBase}%
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`rounded-control-sm text-caption inline-block px-2 py-0.5 ${
                        template.isActive
                          ? "border-green/20 bg-green/10 text-green border"
                          : "bg-fill-3 text-label-secondary border-separator border"
                      }`}
                    >
                      {template.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="inline-flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Preview"
                        onClick={() => setPreviewTemplate(template)}

                        title="Preview"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Edit"
                        onClick={() => handleEdit(template)}

                        title="Edit"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Delete"
                        onClick={() => handleDelete(template.id)}
                        className="text-destructive"
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </FacetCard>
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
                <label className="text-label text-caption mb-1.5 block">Report Type</label>
                <Select
                  value={formData.reportType}
                  onValueChange={(val: any) =>
                    setFormData((prev) => ({ ...prev, reportType: val }))
                  }
                >
                  <SelectTrigger size="sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="economic">Economic Report</SelectItem>
                    <SelectItem value="political">Political Report</SelectItem>
                    <SelectItem value="security">Security Report</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-label text-caption mb-1.5 block">Classification</label>
                <Select
                  value={formData.classification}
                  onValueChange={(val: any) =>
                    setFormData((prev) => ({ ...prev, classification: val }))
                  }
                >
                  <SelectTrigger size="sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PUBLIC">PUBLIC</SelectItem>
                    <SelectItem value="RESTRICTED">RESTRICTED</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-label text-caption mb-1.5 block">Summary Template</label>
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
              <label className="text-label text-caption mb-1.5 block">Findings Template</label>
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
                <label className="text-label text-caption mb-1.5 block">
                  Minimum Level Required
                </label>
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
                <label className="text-label text-caption mb-1.5 block">Confidence Base (%)</label>
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
              <DialogTitle>Template Preview</DialogTitle>
              <DialogDescription>
                {REPORT_TYPE_LABELS[previewTemplate.reportType]} ({previewTemplate.classification})
              </DialogDescription>
            </DialogHeader>

            <div className="text-footnote space-y-4">
              <div className="bg-surface border-separator rounded-row border p-4">
                <h4 className="text-label mb-1 font-semibold">Summary Structure</h4>
                <p className="text-label-secondary whitespace-pre-wrap">
                  {previewTemplate.summaryTemplate}
                </p>
              </div>

              <div className="bg-surface border-separator rounded-row border p-4">
                <h4 className="text-label mb-1 font-semibold">Findings Structure</h4>
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

export default IntelligenceTemplatesPanel;
