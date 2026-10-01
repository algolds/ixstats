"use client";
// src/app/admin/diplomatic-options/DiplomaticOptionsPanel.tsx
// Admin interface for managing diplomatic options (strategic priorities, partnership goals, key achievements)

import { Skeleton } from "~/components/ui/skeleton";
import { useState, useMemo } from "react";
import { usePageTitle } from "~/hooks/usePageTitle";
import { api } from "~/trpc/react";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { useNotify } from "~/hooks/useNotify";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { DiplomaticOptionsAnalyticsTab } from "./_components/DiplomaticOptionsAnalyticsTab";
import {
  WhiteFlag as Flag,
  Plus,
  Trash as Trash2,
  Check,
  Xmark as X,
  Search,
  Filter,
  SwitchOff as ToggleLeft,
  SwitchOn as ToggleRight,
  StatsReport as BarChart3,
} from "iconoir-react";
import { AdminHeader } from "../_components/AdminHeader";
import { Badge } from "~/components/ui/badge";
import { FacetCard } from "~/components/ui/facet-container";

type DiplomaticOptionType = "strategic_priority" | "partnership_goal" | "key_achievement";

interface DiplomaticOption {
  id: string;
  type: string;
  value: string;
  category: string | null;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const TYPE_LABELS: Record<DiplomaticOptionType, string> = {
  strategic_priority: "Strategic Priority",
  partnership_goal: "Partnership Goal",
  key_achievement: "Key Achievement",
};

const CATEGORIES = [
  "Economic",
  "Military",
  "Cultural",
  "Scientific",
  "Environmental",
  "Humanitarian",
  "Trade",
  "Defense",
  "Education",
  "Health",
];

export function DiplomaticOptionsPanel() {
  usePageTitle({ title: "Admin - Diplomatic Options" });

  const notify = useNotify();
  const [activeMainTab, setActiveMainTab] = useState("catalog");

  // State
  const [typeFilter, setTypeFilter] = useState<DiplomaticOptionType | "all">("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Form state
  const [formData, setFormData] = useState({
    type: "strategic_priority" as DiplomaticOptionType,
    value: "",
    category: "",
    description: "",
    sortOrder: 0,
    isActive: true,
  });

  // Queries
  const { data: options, isLoading, refetch } = api.admin.getDiplomaticOptions.useQuery();

  // Mutations
  const createMutation = api.admin.createDiplomaticOption.useMutation({
    onSuccess: () => {
      notify.success("Success", "Diplomatic option created successfully");
      setIsAddDialogOpen(false);
      setFormData({
        type: "strategic_priority",
        value: "",
        category: "",
        description: "",
        sortOrder: 0,
        isActive: true,
      });
      refetch();
    },
    onError: (error: { message?: string }) => {
      notify.error("Error", error.message || "Failed to create diplomatic option");
    },
  });

  const updateMutation = api.admin.updateDiplomaticOption.useMutation({
    onSuccess: () => {
      notify.success("Success", "Diplomatic option updated successfully");
      refetch();
    },
    onError: (error: { message?: string }) => {
      notify.error("Error", error.message || "Failed to update diplomatic option");
    },
  });

  const deleteMutation = api.admin.deleteDiplomaticOption.useMutation({
    onSuccess: () => {
      notify.success("Success", "Diplomatic option deleted successfully");
      refetch();
    },
    onError: (error: { message?: string }) => {
      notify.error("Error", error.message || "Failed to delete diplomatic option");
    },
  });

  // Filter options
  const filteredOptions = useMemo(() => {
    if (!options) return [];

    return options.filter((option) => {
      // Type filter
      if (typeFilter !== "all" && option.type !== typeFilter) {
        return false;
      }

      // Category filter
      if (categoryFilter !== "all" && option.category !== categoryFilter) {
        return false;
      }

      // Inactive filter
      if (!showInactive && !option.isActive) {
        return false;
      }

      // Search query
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesValue = option.value.toLowerCase().includes(query);
        const matchesCategory = option.category?.toLowerCase().includes(query);
        const matchesDescription = option.description?.toLowerCase().includes(query);
        return matchesValue || matchesCategory || matchesDescription;
      }

      return true;
    });
  }, [options, typeFilter, categoryFilter, showInactive, searchQuery]);

  // Handlers
  const handleCreate = () => {
    if (!formData.value.trim()) {
      notify.error("Validation Error", "Value is required");
      return;
    }

    createMutation.mutate({
      type: formData.type,
      value: formData.value.trim(),
      category: formData.category || undefined,
      description: formData.description || undefined,
      sortOrder: formData.sortOrder,
      isActive: formData.isActive,
    });
  };

  const handleUpdate = (id: string, data: Partial<DiplomaticOption>) => {
    updateMutation.mutate({
      id,
      data: {
        value: data.value,
        category: data.category || undefined,
        description: data.description || undefined,
        sortOrder: data.sortOrder,
        isActive: data.isActive,
      },
    });
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this diplomatic option?")) {
      deleteMutation.mutate({ id });
    }
  };

  const handleBulkToggle = (setActive: boolean) => {
    selectedIds.forEach((id) => {
      const option = options?.find((o) => o.id === id);
      if (option) {
        handleUpdate(id, { ...option, isActive: setActive });
      }
    });
    setSelectedIds(new Set());
  };

  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredOptions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredOptions.map((o) => o.id)));
    }
  };

  return (
    <div className="space-y-6">
      <AdminHeader
        icon={Flag}
        title="Diplomatic Options"
        description="Manage reference catalog for diplomatic profiles, strategic priorities, and partnership goals."
      />

      {/* Metric Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <FacetCard className="p-3.5">
          <p className="text-label-secondary text-eyebrow">Total Options</p>
          <p className="text-label text-title-2 mt-1 tabular-nums">{options?.length || 0}</p>
        </FacetCard>
        <FacetCard className="p-3.5">
          <p className="text-label-secondary text-eyebrow">Active Registry</p>
          <p className="text-title-2 text-green mt-1 tabular-nums">
            {options?.filter((o) => o.isActive).length || 0}
          </p>
        </FacetCard>
        <FacetCard className="p-3.5">
          <p className="text-label-secondary text-eyebrow">Filtered Results</p>
          <p className="text-title-2 text-teal mt-1 tabular-nums">{filteredOptions.length}</p>
        </FacetCard>
        <FacetCard className="p-3.5">
          <p className="text-label-secondary text-eyebrow">Selected</p>
          <p className="text-title-2 text-purple mt-1 tabular-nums">{selectedIds.size}</p>
        </FacetCard>
      </div>

      <Tabs value={activeMainTab} onValueChange={setActiveMainTab} className="w-full">
        <TabsList className="bg-fill-3 rounded-row mb-4 flex w-full flex-wrap justify-start gap-1 p-1">
          <TabsTrigger
            value="catalog"
            className="rounded-control text-caption flex items-center gap-2 px-3 py-1.5 transition-transform active:scale-[0.98]"
          >
            <Flag className="h-3.5 w-3.5" />
            Options Catalog
          </TabsTrigger>
          <TabsTrigger
            value="analytics"
            className="rounded-control text-caption flex items-center gap-2 px-3 py-1.5 transition-transform active:scale-[0.98]"
          >
            <BarChart3 className="h-3.5 w-3.5" />
            Usage Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="catalog" className="mt-4 space-y-4 focus-visible:outline-none">
          {/* Filters & Actions */}
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 flex-wrap items-center gap-2">
              <div className="relative max-w-xs min-w-[180px] flex-1">
                <Search className="text-label-secondary absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2" />
                <Input
                  placeholder="Search options..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="rounded-control-sm md:text-footnote h-(--control-height-sm) pl-8"
                />
              </div>

              <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as any)}>
                <SelectTrigger size="sm" className="w-40">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-footnote">
                    All Types
                  </SelectItem>
                  <SelectItem value="strategic_priority" className="text-footnote">
                    Strategic Priority
                  </SelectItem>
                  <SelectItem value="partnership_goal" className="text-footnote">
                    Partnership Goal
                  </SelectItem>
                  <SelectItem value="key_achievement" className="text-footnote">
                    Key Achievement
                  </SelectItem>
                </SelectContent>
              </Select>

              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger size="sm" className="w-36">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-footnote">
                    All Categories
                  </SelectItem>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat} className="text-footnote">
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <label className="text-label-secondary text-footnote flex cursor-pointer items-center gap-1.5 px-2 select-none">
                <input
                  type="checkbox"
                  checked={showInactive}
                  onChange={(e) => setShowInactive(e.target.checked)}
                  className="border-separator rounded-control-sm"
                />
                <span>Show inactive</span>
              </label>
            </div>

            <Button onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add Option
            </Button>
          </div>

          {/* Bulk actions */}
          {selectedIds.size > 0 && (
            <div className="border-tint/30 bg-tint-fill rounded-row text-footnote flex items-center gap-3 border p-2.5">
              <span className="text-label font-semibold">{selectedIds.size} selected</span>
              <Button size="sm" variant="outline" onClick={() => handleBulkToggle(true)}>
                <Check className="mr-1 h-3.5 w-3.5" />
                Activate
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleBulkToggle(false)}>
                <X className="mr-1 h-3.5 w-3.5" />
                Deactivate
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
                Clear
              </Button>
            </div>
          )}

          {/* High-Density Inset Glass Table */}
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="rounded-row h-10 w-full" />
              ))}
            </div>
          ) : filteredOptions.length === 0 ? (
            <FacetCard className="p-12 text-center">
              <Filter className="text-label-secondary mx-auto mb-3 h-8 w-8" />
              <p className="text-label-secondary text-footnote">
                No diplomatic options matching criteria.
              </p>
              <Button className="mt-4" onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Add First Option
              </Button>
            </FacetCard>
          ) : (
            <FacetCard className="overflow-x-auto">
              <table className="text-footnote w-full tabular-nums">
                <thead>
                  <tr className="border-separator bg-fill-4 text-label-secondary border-b font-semibold">
                    <th className="w-10 px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={
                          selectedIds.size === filteredOptions.length && filteredOptions.length > 0
                        }
                        onChange={toggleSelectAll}
                        className="border-separator rounded-control-sm"
                      />
                    </th>
                    <th className="px-4 py-2.5 text-left font-medium">Type</th>
                    <th className="px-4 py-2.5 text-left font-medium">Value & Description</th>
                    <th className="px-4 py-2.5 text-left font-medium">Category</th>
                    <th className="px-4 py-2.5 text-left font-medium">Order</th>
                    <th className="px-4 py-2.5 text-left font-medium">Status</th>
                    <th className="px-4 py-2.5 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-separator divide-y">
                  {filteredOptions.map((option) => (
                    <tr key={option.id} className="hover:bg-fill-4 transition-colors">
                      <td className="px-3 py-2.5">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(option.id)}
                          onChange={() => toggleSelection(option.id)}
                          className="border-separator rounded-control-sm"
                        />
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge variant="teal">
                          {TYPE_LABELS[option.type as DiplomaticOptionType]}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="text-label font-semibold">{option.value}</div>
                        {option.description && (
                          <div className="text-label-secondary text-footnote max-w-sm truncate">
                            {option.description}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        {option.category ? (
                          <span className="text-label-secondary text-footnote">
                            {option.category}
                          </span>
                        ) : (
                          <span className="text-label-secondary text-footnote italic">None</span>
                        )}
                      </td>
                      <td className="text-label-secondary px-4 py-2.5 tabular-nums">
                        {option.sortOrder}
                      </td>
                      <td className="px-4 py-2.5">
                        {option.isActive ? (
                          <Badge variant="green">Active</Badge>
                        ) : (
                          <Badge variant="neutral">Inactive</Badge>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            className="text-label-secondary hover:bg-fill-4 hover:text-label rounded-control p-1 transition-transform active:scale-[0.98]"
                            onClick={() =>
                              handleUpdate(option.id, { ...option, isActive: !option.isActive })
                            }
                            title="Toggle Status"
                          >
                            {option.isActive ? (
                              <ToggleRight className="text-green h-4 w-4" />
                            ) : (
                              <ToggleLeft className="text-label-secondary h-4 w-4" />
                            )}
                          </button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Delete"
                            className="text-destructive"
                            onClick={() => handleDelete(option.id)}
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
        </TabsContent>

        <TabsContent value="analytics" className="mt-4 focus-visible:outline-none">
          <DiplomaticOptionsAnalyticsTab />
        </TabsContent>
      </Tabs>

      {/* Add Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Diplomatic Option</DialogTitle>
            <DialogDescription>Create a new diplomatic option for user profiles</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-label text-caption mb-1.5 block">Type</label>
              <Select
                value={formData.type}
                onValueChange={(value) =>
                  setFormData({ ...formData, type: value as DiplomaticOptionType })
                }
              >
                <SelectTrigger size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="strategic_priority">Strategic Priority</SelectItem>
                  <SelectItem value="partnership_goal">Partnership Goal</SelectItem>
                  <SelectItem value="key_achievement">Key Achievement</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-label text-caption mb-1.5 block">Value *</label>
              <Input
                value={formData.value}
                onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                placeholder="e.g., Economic Growth"
                className="rounded-control-sm md:text-footnote h-(--control-height-sm)"
              />
            </div>

            <div>
              <label className="text-label text-caption mb-1.5 block">Category</label>
              <Select
                value={formData.category || "none"}
                onValueChange={(value) =>
                  setFormData({ ...formData, category: value === "none" ? "" : value })
                }
              >
                <SelectTrigger size="sm">
                  <SelectValue placeholder="Select category..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-label text-caption mb-1.5 block">Description</label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description..."
                className="rounded-control-sm md:text-footnote h-(--control-height-sm)"
              />
            </div>

            <div>
              <label className="text-label text-caption mb-1.5 block">Sort Order</label>
              <Input
                type="number"
                value={formData.sortOrder}
                onChange={(e) =>
                  setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })
                }
                className="rounded-control-sm md:text-footnote h-(--control-height-sm)"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={!formData.value || createMutation.isPending}>
              {createMutation.isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default DiplomaticOptionsPanel;
