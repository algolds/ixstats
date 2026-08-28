"use client";
// src/app/admin/diplomatic-options/DiplomaticOptionsPanel.tsx
// Admin interface for managing diplomatic options (strategic priorities, partnership goals, key achievements)

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
        <div className="border-border/30 bg-card/25 rounded-2xl border p-3.5 shadow-xs backdrop-blur-md">
          <p className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
            Total Options
          </p>
          <p className="text-foreground mt-1 font-mono text-xl font-bold tracking-tight">
            {options?.length || 0}
          </p>
        </div>
        <div className="border-border/30 bg-card/25 rounded-2xl border p-3.5 shadow-xs backdrop-blur-md">
          <p className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
            Active Registry
          </p>
          <p className="mt-1 font-mono text-xl font-bold tracking-tight text-emerald-400">
            {options?.filter((o) => o.isActive).length || 0}
          </p>
        </div>
        <div className="border-border/30 bg-card/25 rounded-2xl border p-3.5 shadow-xs backdrop-blur-md">
          <p className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
            Filtered Results
          </p>
          <p className="mt-1 font-mono text-xl font-bold tracking-tight text-cyan-400">
            {filteredOptions.length}
          </p>
        </div>
        <div className="border-border/30 bg-card/25 rounded-2xl border p-3.5 shadow-xs backdrop-blur-md">
          <p className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
            Selected
          </p>
          <p className="mt-1 font-mono text-xl font-bold tracking-tight text-purple-400">
            {selectedIds.size}
          </p>
        </div>
      </div>

      <Tabs value={activeMainTab} onValueChange={setActiveMainTab} className="w-full">
        <TabsList className="bg-card/40 border-border/40 mb-4 flex w-full flex-wrap justify-start gap-1 rounded-xl border p-1 backdrop-blur-md">
          <TabsTrigger
            value="catalog"
            className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-transform active:scale-[0.98]"
          >
            <Flag className="h-3.5 w-3.5" />
            Options Catalog
          </TabsTrigger>
          <TabsTrigger
            value="analytics"
            className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-transform active:scale-[0.98]"
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
                <Search className="text-muted-foreground absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2" />
                <Input
                  placeholder="Search options..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="border-border/30 bg-background/50 focus:border-border/60 h-8 rounded-xl pl-8 text-xs backdrop-blur-md"
                />
              </div>

              <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as any)}>
                <SelectTrigger className="border-border/30 bg-background/50 h-8 w-40 rounded-xl text-xs backdrop-blur-md">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">
                    All Types
                  </SelectItem>
                  <SelectItem value="strategic_priority" className="text-xs">
                    Strategic Priority
                  </SelectItem>
                  <SelectItem value="partnership_goal" className="text-xs">
                    Partnership Goal
                  </SelectItem>
                  <SelectItem value="key_achievement" className="text-xs">
                    Key Achievement
                  </SelectItem>
                </SelectContent>
              </Select>

              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="border-border/30 bg-background/50 h-8 w-36 rounded-xl text-xs backdrop-blur-md">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">
                    All Categories
                  </SelectItem>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat} className="text-xs">
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <label className="text-muted-foreground flex cursor-pointer items-center gap-1.5 px-2 text-xs select-none">
                <input
                  type="checkbox"
                  checked={showInactive}
                  onChange={(e) => setShowInactive(e.target.checked)}
                  className="border-border rounded"
                />
                <span>Show inactive</span>
              </label>
            </div>

            <Button
              onClick={() => setIsAddDialogOpen(true)}
              className="h-8 rounded-xl px-3.5 text-xs font-semibold transition-transform active:scale-[0.98]"
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add Option
            </Button>
          </div>

          {/* Bulk actions */}
          {selectedIds.size > 0 && (
            <div className="border-primary/30 bg-primary/10 flex items-center gap-3 rounded-xl border p-2.5 text-xs">
              <span className="text-foreground font-semibold">{selectedIds.size} selected</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleBulkToggle(true)}
                className="h-7 px-2 text-xs active:scale-[0.98]"
              >
                <Check className="mr-1 h-3.5 w-3.5" />
                Activate
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleBulkToggle(false)}
                className="h-7 px-2 text-xs active:scale-[0.98]"
              >
                <X className="mr-1 h-3.5 w-3.5" />
                Deactivate
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelectedIds(new Set())}
                className="h-7 px-2 text-xs active:scale-[0.98]"
              >
                Clear
              </Button>
            </div>
          )}

          {/* High-Density Inset Glass Table */}
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="bg-card/25 h-10 w-full animate-pulse rounded-xl" />
              ))}
            </div>
          ) : filteredOptions.length === 0 ? (
            <div className="border-border/30 bg-card/25 rounded-2xl border p-12 text-center backdrop-blur-md">
              <Filter className="text-muted-foreground mx-auto mb-3 h-8 w-8" />
              <p className="text-muted-foreground text-xs">
                No diplomatic options matching criteria.
              </p>
              <Button
                className="mt-4 h-8 rounded-xl px-3.5 text-xs font-semibold active:scale-[0.98]"
                onClick={() => setIsAddDialogOpen(true)}
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Add First Option
              </Button>
            </div>
          ) : (
            <div className="border-border/30 bg-card/25 overflow-x-auto rounded-2xl border shadow-xs backdrop-blur-md">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-border/30 bg-muted/20 text-muted-foreground border-b font-semibold">
                    <th className="w-10 px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={
                          selectedIds.size === filteredOptions.length && filteredOptions.length > 0
                        }
                        onChange={toggleSelectAll}
                        className="border-border rounded"
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
                <tbody className="divide-border/15 divide-y">
                  {filteredOptions.map((option) => (
                    <tr key={option.id} className="hover:bg-foreground/[0.02] transition-colors">
                      <td className="px-3 py-2.5">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(option.id)}
                          onChange={() => toggleSelection(option.id)}
                          className="border-border rounded"
                        />
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="inline-block rounded-md border border-cyan-500/20 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-semibold text-cyan-400">
                          {TYPE_LABELS[option.type as DiplomaticOptionType]}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="text-foreground font-semibold">{option.value}</div>
                        {option.description && (
                          <div className="text-muted-foreground max-w-sm truncate text-[11px]">
                            {option.description}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        {option.category ? (
                          <span className="text-muted-foreground text-xs">{option.category}</span>
                        ) : (
                          <span className="text-muted-foreground text-xs italic">None</span>
                        )}
                      </td>
                      <td className="text-muted-foreground px-4 py-2.5 font-mono">
                        {option.sortOrder}
                      </td>
                      <td className="px-4 py-2.5">
                        {option.isActive ? (
                          <span className="inline-flex items-center rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-md border border-zinc-500/20 bg-zinc-500/10 px-2 py-0.5 text-[10px] font-medium text-zinc-400">
                            Inactive
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            className="text-muted-foreground hover:bg-muted/50 hover:text-foreground rounded-lg p-1 transition-transform active:scale-[0.98]"
                            onClick={() =>
                              handleUpdate(option.id, { ...option, isActive: !option.isActive })
                            }
                            title="Toggle Status"
                          >
                            {option.isActive ? (
                              <ToggleRight className="h-4 w-4 text-emerald-400" />
                            ) : (
                              <ToggleLeft className="text-muted-foreground h-4 w-4" />
                            )}
                          </button>
                          <button
                            className="rounded-lg p-1 text-red-400 transition-transform hover:bg-red-500/10 hover:text-red-300 active:scale-[0.98]"
                            onClick={() => handleDelete(option.id)}
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
              <label className="text-foreground mb-1.5 block text-xs font-medium">Type</label>
              <Select
                value={formData.type}
                onValueChange={(value) =>
                  setFormData({ ...formData, type: value as DiplomaticOptionType })
                }
              >
                <SelectTrigger className="text-xs">
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
              <label className="text-foreground mb-1.5 block text-xs font-medium">Value *</label>
              <Input
                value={formData.value}
                onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                placeholder="e.g., Economic Growth"
                className="text-xs"
              />
            </div>

            <div>
              <label className="text-foreground mb-1.5 block text-xs font-medium">Category</label>
              <Select
                value={formData.category || "none"}
                onValueChange={(value) =>
                  setFormData({ ...formData, category: value === "none" ? "" : value })
                }
              >
                <SelectTrigger className="text-xs">
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
              <label className="text-foreground mb-1.5 block text-xs font-medium">
                Description
              </label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description..."
                className="text-xs"
              />
            </div>

            <div>
              <label className="text-foreground mb-1.5 block text-xs font-medium">Sort Order</label>
              <Input
                type="number"
                value={formData.sortOrder}
                onChange={(e) =>
                  setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })
                }
                className="text-xs"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsAddDialogOpen(false)}
              className="text-xs active:scale-[0.98]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!formData.value || createMutation.isPending}
              className="text-xs active:scale-[0.98]"
            >
              {createMutation.isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default DiplomaticOptionsPanel;
