// src/app/admin/intelligence-templates/page.tsx
// Admin interface for managing intelligence report templates

"use client";

import { useState } from "react";
import { usePageTitle } from "~/hooks/usePageTitle";
import { api } from "~/trpc/react";
import { SignInButton, useUser } from "~/context/auth-context";
import { isSystemOwner } from "~/lib/system-owner-constants";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { useToast } from "~/components/ui/toast";
import {
  FileText,
  Plus,
  Pencil,
  Trash2,
  Eye,
  ArrowLeft,
  X
} from "lucide-react";
import Link from "next/link";

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

const REPORT_TYPE_ICONS: Record<string, string> = {
  economic: '📊',
  political: '🏛️',
  security: '🛡️'
};

const REPORT_TYPE_LABELS: Record<string, string> = {
  economic: 'Economic Intelligence Report',
  political: 'Political Intelligence Report',
  security: 'Security Intelligence Report'
};

export default function IntelligenceTemplatesPage() {
  usePageTitle({ title: "Intelligence Templates Admin" });

  const { user, isLoaded } = useUser();
  const { toast } = useToast();

  // State
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<IntelligenceTemplate | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<IntelligenceTemplate | null>(null);

  // Queries
  const { data: templates, isLoading, refetch } = api.intelligence.getAllTemplates.useQuery(
    undefined,
    {
      refetchOnWindowFocus: false,
    }
  );

  // Mutations
  const createMutation = api.intelligence.createTemplate.useMutation({
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Intelligence template created successfully",
        type: "success"
      });
      setIsAddDialogOpen(false);
      refetch();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create template",
        type: "error"
      });
    }
  });

  const updateMutation = api.intelligence.updateTemplate.useMutation({
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Intelligence template updated successfully",
        type: "success"
      });
      setEditingTemplate(null);
      refetch();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update template",
        type: "error"
      });
    }
  });

  const deleteMutation = api.intelligence.deleteTemplate.useMutation({
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Intelligence template deleted successfully",
        type: "success"
      });
      refetch();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete template",
        type: "error"
      });
    }
  });

  // Handlers
  const handleDelete = (id: string, reportType: string) => {
    if (confirm(`Delete ${reportType} intelligence template? This action cannot be undone.`)) {
      deleteMutation.mutate({ id });
    }
  };

  // Auth checks
  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <SignInButton mode="modal" />
      </div>
    );
  }

  const allowedRoles = new Set(["admin", "owner", "staff"]);
  const isSystemOwnerUser = !!user && isSystemOwner(user.id);
  const hasAdminRole = typeof user?.publicMetadata?.role === "string" && allowedRoles.has(user.publicMetadata.role);

  if (!isSystemOwnerUser && !hasAdminRole) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center border border-gray-200 dark:border-gray-700">
          <h1 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-4">Access Denied</h1>
          <p className="text-gray-700 dark:text-gray-300 mb-6">You do not have permission to view this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="glass-card-parent p-6 rounded-xl border-2 border-[--intel-gold]/20 bg-gradient-to-br from-[--intel-gold]/5 via-transparent to-[--intel-gold]/10 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <Link href="/admin">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Admin
                </Button>
              </Link>
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-[--intel-gold]/10 border border-[--intel-gold]/20">
                  <FileText className="h-6 w-6 text-[--intel-gold]" />
                </div>
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                    Intelligence Templates
                  </h1>
                  <p className="text-sm text-[--intel-silver]">
                    Manage intelligence report templates for embassy data sharing
                  </p>
                </div>
              </div>
            </div>
            <Button
              onClick={() => setIsAddDialogOpen(true)}
              className="bg-[--intel-gold]/20 hover:bg-[--intel-gold]/30 text-[--intel-gold] border border-[--intel-gold]/30"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Template
            </Button>
          </div>
        </div>

        {/* Templates List */}
        <div className="space-y-4">
          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[--intel-gold] mx-auto mb-4"></div>
              <p className="text-[--intel-silver]">Loading templates...</p>
            </div>
          ) : templates && templates.length === 0 ? (
            <Card className="glass-card-parent p-12 text-center border border-border/50">
              <FileText className="h-12 w-12 text-[--intel-silver] mx-auto mb-4" />
              <p className="text-[--intel-silver] mb-4">No intelligence templates found</p>
              <Button onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add First Template
              </Button>
            </Card>
          ) : (
            templates?.map((template) => (
              <Card key={template.id} className="glass-card-parent p-6 border border-border/50 hover:border-[--intel-gold]/50 transition-all">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-2xl">
                        {REPORT_TYPE_ICONS[template.reportType] || '📄'}
                      </span>
                      <h3 className="font-semibold text-lg text-foreground">
                        {REPORT_TYPE_LABELS[template.reportType] || `${template.reportType} Report`}
                      </h3>
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                        template.classification === 'PUBLIC'
                          ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                          : 'bg-red-500/20 text-red-400 border border-red-500/30'
                      }`}>
                        {template.classification}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 mb-3 text-sm text-[--intel-silver]">
                      <span>Level: {template.minimumLevel}+</span>
                      <span>•</span>
                      <span>Confidence: {template.confidenceBase}%</span>
                      <span>•</span>
                      <span>Findings: {JSON.parse(template.findingsTemplate).length} items</span>
                    </div>

                    <p className="text-sm text-foreground line-clamp-2">
                      {template.summaryTemplate}
                    </p>
                  </div>

                  <div className="flex gap-2 ml-4">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setPreviewTemplate(template)}
                      className="border-border/50"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditingTemplate(template)}
                      className="border-border/50"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(template.id, template.reportType)}
                      className="text-red-400 hover:text-red-300"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>

        {/* Stats */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="glass-card-child p-4 border border-border/50">
            <div className="text-2xl font-bold text-foreground">{templates?.length || 0}</div>
            <div className="text-sm text-[--intel-silver]">Total Templates</div>
          </Card>
          <Card className="glass-card-child p-4 border border-border/50">
            <div className="text-2xl font-bold text-[--intel-gold]">
              {templates?.filter(t => t.isActive).length || 0}
            </div>
            <div className="text-sm text-[--intel-silver]">Active Templates</div>
          </Card>
          <Card className="glass-card-child p-4 border border-border/50">
            <div className="text-2xl font-bold text-green-400">
              {templates?.filter(t => t.classification === 'PUBLIC').length || 0}
            </div>
            <div className="text-sm text-[--intel-silver]">Public Templates</div>
          </Card>
        </div>

        {/* Editor Dialog */}
        {(isAddDialogOpen || editingTemplate) && (
          <TemplateEditorDialog
            template={editingTemplate}
            isOpen={isAddDialogOpen || !!editingTemplate}
            onClose={() => {
              setIsAddDialogOpen(false);
              setEditingTemplate(null);
            }}
            onSave={(data) => {
              if (editingTemplate?.id) {
                updateMutation.mutate({ id: editingTemplate.id, ...data });
              } else {
                createMutation.mutate(data);
              }
            }}
          />
        )}

        {/* Preview Dialog */}
        {previewTemplate && (
          <TemplatePreviewDialog
            template={previewTemplate}
            isOpen={!!previewTemplate}
            onClose={() => setPreviewTemplate(null)}
          />
        )}
      </div>
    </div>
  );
}

// Template Editor Dialog Component
interface TemplateEditorDialogProps {
  template: IntelligenceTemplate | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
}

function TemplateEditorDialog({ template, isOpen, onClose, onSave }: TemplateEditorDialogProps) {
  const [formData, setFormData] = useState({
    reportType: template?.reportType || 'economic',
    classification: template?.classification || 'PUBLIC',
    summaryTemplate: template?.summaryTemplate || '',
    minimumLevel: template?.minimumLevel || 1,
    confidenceBase: template?.confidenceBase || 70
  });

  const [findings, setFindings] = useState<string[]>(
    template ? JSON.parse(template.findingsTemplate) : ['']
  );

  const handleSave = () => {
    if (!formData.summaryTemplate.trim()) {
      alert('Summary template is required');
      return;
    }

    if (findings.filter(f => f.trim()).length === 0) {
      alert('At least one finding is required');
      return;
    }

    onSave({
      ...formData,
      findingsTemplate: JSON.stringify(findings.filter(f => f.trim()))
    });
  };

  const addFinding = () => {
    setFindings([...findings, '']);
  };

  const removeFinding = (index: number) => {
    setFindings(findings.filter((_, i) => i !== index));
  };

  const updateFinding = (index: number, value: string) => {
    const newFindings = [...findings];
    newFindings[index] = value;
    setFindings(newFindings);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-foreground">
            {template?.id ? 'Edit' : 'Add'} Intelligence Template
          </DialogTitle>
          <DialogDescription className="text-[--intel-silver]">
            Configure intelligence report template for embassy data sharing
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Report Type */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Report Type *
            </label>
            <Select
              value={formData.reportType}
              onValueChange={(value) => setFormData(prev => ({ ...prev, reportType: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="economic">📊 Economic</SelectItem>
                <SelectItem value="political">🏛️ Political</SelectItem>
                <SelectItem value="security">🛡️ Security</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Classification */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Classification *
            </label>
            <Select
              value={formData.classification}
              onValueChange={(value) => setFormData(prev => ({ ...prev, classification: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PUBLIC">Public</SelectItem>
                <SelectItem value="RESTRICTED">Restricted</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Summary Template */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Summary Template *
            </label>
            <Textarea
              value={formData.summaryTemplate}
              onChange={(e) => setFormData(prev => ({ ...prev, summaryTemplate: e.target.value }))}
              placeholder="Brief summary of the intelligence report..."
              rows={3}
              className="w-full"
            />
            <p className="text-xs text-[--intel-silver] mt-1">
              This will be shown as the report summary
            </p>
          </div>

          {/* Key Findings */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Key Findings *
            </label>
            <div className="space-y-2">
              {findings.map((finding, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    value={finding}
                    onChange={(e) => updateFinding(index, e.target.value)}
                    placeholder={`Finding ${index + 1}`}
                    className="flex-1"
                  />
                  {findings.length > 1 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeFinding(index)}
                      className="text-red-400 hover:text-red-300"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={addFinding}
              className="mt-2 border-border/50"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Finding
            </Button>
          </div>

          {/* Minimum Level & Confidence */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Minimum Embassy Level *
              </label>
              <Input
                type="number"
                min="1"
                max="5"
                value={formData.minimumLevel}
                onChange={(e) => setFormData(prev => ({ ...prev, minimumLevel: parseInt(e.target.value) || 1 }))}
              />
              <p className="text-xs text-[--intel-silver] mt-1">
                Minimum embassy level required (1-5)
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Base Confidence (%) *
              </label>
              <Input
                type="number"
                min="0"
                max="100"
                value={formData.confidenceBase}
                onChange={(e) => setFormData(prev => ({ ...prev, confidenceBase: parseInt(e.target.value) || 70 }))}
              />
              <p className="text-xs text-[--intel-silver] mt-1">
                Base confidence score (0-100)
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            className="bg-[--intel-gold]/20 hover:bg-[--intel-gold]/30 text-[--intel-gold] border border-[--intel-gold]/30"
          >
            {template?.id ? 'Update' : 'Create'} Template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Template Preview Dialog Component
interface TemplatePreviewDialogProps {
  template: IntelligenceTemplate;
  isOpen: boolean;
  onClose: () => void;
}

function TemplatePreviewDialog({ template, isOpen, onClose }: TemplatePreviewDialogProps) {
  const findings = JSON.parse(template.findingsTemplate);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-foreground">
            Template Preview
          </DialogTitle>
          <DialogDescription className="text-[--intel-silver]">
            How this template will render in intelligence reports
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <Card className="glass-card-child p-6 border border-border/50">
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
              <span className="text-3xl">
                {REPORT_TYPE_ICONS[template.reportType] || '📄'}
              </span>
              <div className="flex-1">
                <h3 className="font-bold text-lg text-foreground">
                  {REPORT_TYPE_LABELS[template.reportType] || `${template.reportType} Report`}
                </h3>
                <div className="flex items-center gap-3 mt-1 text-sm text-[--intel-silver]">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    template.classification === 'PUBLIC'
                      ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                      : 'bg-red-500/20 text-red-400 border border-red-500/30'
                  }`}>
                    {template.classification}
                  </span>
                  <span>Level {template.minimumLevel}+</span>
                  <span>•</span>
                  <span>{template.confidenceBase}% Confidence</span>
                </div>
              </div>
            </div>

            {/* Summary */}
            <div className="mb-4">
              <h4 className="text-sm font-semibold text-[--intel-silver] mb-2">Summary</h4>
              <p className="text-foreground">{template.summaryTemplate}</p>
            </div>

            {/* Findings */}
            <div>
              <h4 className="text-sm font-semibold text-[--intel-silver] mb-2">Key Findings</h4>
              <ul className="space-y-2">
                {findings.map((finding: string, index: number) => (
                  <li key={index} className="flex items-start gap-2 text-foreground">
                    <span className="text-[--intel-gold] mt-1">•</span>
                    <span>{finding}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Card>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
