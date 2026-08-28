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
        <div className="border-border/30 bg-card/25 rounded-2xl border p-3.5 shadow-xs backdrop-blur-md">
          <p className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
            Total Templates
          </p>
          <p className="text-foreground mt-1 font-mono text-xl font-bold tracking-tight">
            {templates?.length || 0}
          </p>
        </div>
        <div className="border-border/30 bg-card/25 rounded-2xl border p-3.5 shadow-xs backdrop-blur-md">
          <p className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
            Restricted Clearance
          </p>
          <p className="mt-1 font-mono text-xl font-bold tracking-tight text-amber-400">
            {templates?.filter((t: any) => t.classification === "RESTRICTED").length || 0}
          </p>
        </div>
        <div className="border-border/30 bg-card/25 rounded-2xl border p-3.5 shadow-xs backdrop-blur-md">
          <p className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
            Public Briefings
          </p>
          <p className="mt-1 font-mono text-xl font-bold tracking-tight text-cyan-400">
            {templates?.filter((t: any) => t.classification === "PUBLIC").length || 0}
          </p>
        </div>
        <div className="border-border/30 bg-card/25 rounded-2xl border p-3.5 shadow-xs backdrop-blur-md">
          <p className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
            Active Registry
          </p>
          <p className="mt-1 font-mono text-xl font-bold tracking-tight text-emerald-400">
            {templates?.filter((t: any) => t.isActive).length || 0}
          </p>
        </div>
      </div>

      {/* Filter & Action Rail */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative max-w-sm min-w-[200px] flex-1">
            <Search className="text-muted-foreground absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2" />
            <Input
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="border-border/30 bg-background/50 focus:border-border/60 h-8 rounded-xl pl-8 text-xs backdrop-blur-md"
            />
          </div>

          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="border-border/30 bg-background/50 h-8 w-44 rounded-xl text-xs backdrop-blur-md">
              <SelectValue placeholder="All Report Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">
                All Report Types
              </SelectItem>
              <SelectItem value="economic" className="text-xs">
                Economic Report
              </SelectItem>
              <SelectItem value="political" className="text-xs">
                Political Report
              </SelectItem>
              <SelectItem value="security" className="text-xs">
                Security Report
              </SelectItem>
            </SelectContent>
          </Select>

          <Select value={classificationFilter} onValueChange={setClassificationFilter}>
            <SelectTrigger className="border-border/30 bg-background/50 h-8 w-36 rounded-xl text-xs backdrop-blur-md">
              <SelectValue placeholder="All Clearances" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">
                All Clearances
              </SelectItem>
              <SelectItem value="PUBLIC" className="text-xs">
                PUBLIC
              </SelectItem>
              <SelectItem value="RESTRICTED" className="text-xs">
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
          className="h-8 rounded-xl px-3.5 text-xs font-semibold transition-transform active:scale-[0.98]"
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add Template
        </Button>
      </div>

      {/* High-Density Inset Glass Table */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-xl" />
          ))}
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="border-border/30 bg-card/25 rounded-2xl border p-12 text-center backdrop-blur-md">
          <p className="text-muted-foreground text-xs">
            No intelligence templates matching filters.
          </p>
        </div>
      ) : (
        <div className="border-border/30 bg-card/25 overflow-x-auto rounded-2xl border shadow-xs backdrop-blur-md">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-border/30 bg-muted/20 text-muted-foreground border-b font-semibold">
                <th className="px-4 py-2.5 text-left font-medium">Report Type & Summary</th>
                <th className="px-4 py-2.5 text-left font-medium">Classification</th>
                <th className="px-4 py-2.5 text-left font-medium">Clearance</th>
                <th className="px-4 py-2.5 text-left font-medium">Confidence</th>
                <th className="px-4 py-2.5 text-left font-medium">Status</th>
                <th className="px-4 py-2.5 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-border/15 divide-y">
              {filteredTemplates.map((template: any) => (
                <tr key={template.id} className="hover:bg-foreground/[0.02] transition-colors">
                  <td className="px-4 py-2.5">
                    <div className="text-foreground font-semibold">
                      {REPORT_TYPE_LABELS[template.reportType] || template.reportType}
                    </div>
                    {template.summaryTemplate && (
                      <div className="text-muted-foreground max-w-sm truncate text-[11px]">
                        {template.summaryTemplate}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`inline-block rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase ${
                        template.classification === "RESTRICTED"
                          ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                          : "border-cyan-500/30 bg-cyan-500/10 text-cyan-400"
                      }`}
                    >
                      {template.classification}
                    </span>
                  </td>
                  <td className="text-muted-foreground px-4 py-2.5 font-mono">
                    Level {template.minimumLevel}+
                  </td>
                  <td className="text-foreground px-4 py-2.5 font-mono font-medium">
                    {template.confidenceBase}%
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-semibold ${
                        template.isActive
                          ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                          : "bg-muted/50 text-muted-foreground border-border border"
                      }`}
                    >
                      {template.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button
                        onClick={() => setPreviewTemplate(template)}
                        className="text-muted-foreground hover:bg-muted/50 hover:text-foreground rounded-lg p-1 transition-transform active:scale-[0.98]"
                        title="Preview"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleEdit(template)}
                        className="text-muted-foreground hover:bg-muted/50 hover:text-foreground rounded-lg p-1 transition-transform active:scale-[0.98]"
                        title="Edit"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(template.id)}
                        className="rounded-lg p-1 text-red-400 transition-transform hover:bg-red-500/10 hover:text-red-300 active:scale-[0.98]"
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
                <label className="text-foreground mb-1.5 block text-xs font-medium">
                  Report Type
                </label>
                <Select
                  value={formData.reportType}
                  onValueChange={(val: any) =>
                    setFormData((prev) => ({ ...prev, reportType: val }))
                  }
                >
                  <SelectTrigger className="text-xs">
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
                <label className="text-foreground mb-1.5 block text-xs font-medium">
                  Classification
                </label>
                <Select
                  value={formData.classification}
                  onValueChange={(val: any) =>
                    setFormData((prev) => ({ ...prev, classification: val }))
                  }
                >
                  <SelectTrigger className="text-xs">
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
              <label className="text-foreground mb-1.5 block text-xs font-medium">
                Summary Template
              </label>
              <Textarea
                value={formData.summaryTemplate}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, summaryTemplate: e.target.value }))
                }
                placeholder="Template text with {{tags}}..."
                rows={3}
                className="text-xs"
              />
            </div>

            <div>
              <label className="text-foreground mb-1.5 block text-xs font-medium">
                Findings Template
              </label>
              <Textarea
                value={formData.findingsTemplate}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, findingsTemplate: e.target.value }))
                }
                placeholder="Findings section format..."
                rows={4}
                className="text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-foreground mb-1.5 block text-xs font-medium">
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
                  className="text-xs"
                />
              </div>

              <div>
                <label className="text-foreground mb-1.5 block text-xs font-medium">
                  Confidence Base (%)
                </label>
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
                  className="text-xs"
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
                className="text-xs active:scale-[0.98]"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
                className="text-xs active:scale-[0.98]"
              >
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

            <div className="space-y-4 text-xs">
              <div className="bg-card/40 border-border/40 rounded-xl border p-4">
                <h4 className="text-foreground mb-1 font-semibold">Summary Structure</h4>
                <p className="text-muted-foreground whitespace-pre-wrap">
                  {previewTemplate.summaryTemplate}
                </p>
              </div>

              <div className="bg-card/40 border-border/40 rounded-xl border p-4">
                <h4 className="text-foreground mb-1 font-semibold">Findings Structure</h4>
                <p className="text-muted-foreground whitespace-pre-wrap">
                  {previewTemplate.findingsTemplate}
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button
                onClick={() => setPreviewTemplate(null)}
                className="text-xs active:scale-[0.98]"
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

export default IntelligenceTemplatesPanel;
