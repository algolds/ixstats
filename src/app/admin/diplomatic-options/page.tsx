// src/app/admin/diplomatic-options/page.tsx
// Admin interface for managing diplomatic options (strategic priorities, partnership goals, key achievements)

"use client";

import { useState, useMemo } from "react";
import { usePageTitle } from "~/hooks/usePageTitle";
import { api } from "~/trpc/react";
import { SignInButton, useUser } from "~/context/auth-context";
import { isSystemOwner } from "~/lib/system-owner-constants";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "~/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { useToast } from "~/components/ui/toast";
import {
  Flag,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  Search,
  Filter,
  ToggleLeft,
  ToggleRight,
  ArrowLeft
} from "lucide-react";
import Link from "next/link";

type DiplomaticOptionType = 'strategic_priority' | 'partnership_goal' | 'key_achievement';

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
  strategic_priority: 'Strategic Priority',
  partnership_goal: 'Partnership Goal',
  key_achievement: 'Key Achievement'
};

const CATEGORIES = [
  'Economic',
  'Military',
  'Cultural',
  'Scientific',
  'Environmental',
  'Humanitarian',
  'Trade',
  'Defense',
  'Education',
  'Health'
];

export default function DiplomaticOptionsPage() {
  usePageTitle({ title: "Diplomatic Options Admin" });

  const { user, isLoaded } = useUser();
  const { toast } = useToast();

  // State
  const [typeFilter, setTypeFilter] = useState<DiplomaticOptionType | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Form state
  const [formData, setFormData] = useState({
    type: 'strategic_priority' as DiplomaticOptionType,
    value: '',
    category: '',
    description: '',
    sortOrder: 0,
    isActive: true
  });

  // Queries
  const { data: options, isLoading, refetch } = api.admin.getDiplomaticOptions.useQuery(
    {
      isActive: showInactive ? undefined : true
    },
    {
      refetchOnWindowFocus: false,
    }
  );

  // Mutations
  const createMutation = api.admin.createDiplomaticOption.useMutation({
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Diplomatic option created successfully",
        type: "success"
      });
      refetch();
      setIsAddDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create diplomatic option",
        type: "error"
      });
    }
  });

  const updateMutation = api.admin.updateDiplomaticOption.useMutation({
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Diplomatic option updated successfully",
        type: "success"
      });
      refetch();
      setEditingId(null);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update diplomatic option",
        type: "error"
      });
    }
  });

  const deleteMutation = api.admin.deleteDiplomaticOption.useMutation({
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Diplomatic option deleted successfully",
        type: "success"
      });
      refetch();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete diplomatic option",
        type: "error"
      });
    }
  });

  const bulkToggleMutation = api.admin.bulkToggleDiplomaticOptions.useMutation({
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Bulk operation completed successfully",
        type: "success"
      });
      refetch();
      setSelectedIds(new Set());
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to complete bulk operation",
        type: "error"
      });
    }
  });

  // Filtered options
  const filteredOptions = useMemo(() => {
    if (!options) return [];

    return options.filter(option => {
      // Type filter
      if (typeFilter !== 'all' && option.type !== typeFilter) return false;

      // Category filter
      if (categoryFilter !== 'all' && option.category !== categoryFilter) return false;

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          option.value.toLowerCase().includes(query) ||
          option.description?.toLowerCase().includes(query) ||
          option.category?.toLowerCase().includes(query)
        );
      }

      return true;
    });
  }, [options, typeFilter, categoryFilter, searchQuery]);

  // Handlers
  const resetForm = () => {
    setFormData({
      type: 'strategic_priority',
      value: '',
      category: '',
      description: '',
      sortOrder: 0,
      isActive: true
    });
  };

  const handleCreate = () => {
    createMutation.mutate(formData);
  };

  const handleUpdate = (id: string, data: Partial<DiplomaticOption>) => {
    updateMutation.mutate({
      id,
      data: {
        value: data.value,
        category: data.category ?? undefined,
        description: data.description ?? undefined,
        sortOrder: data.sortOrder,
        isActive: data.isActive
      }
    });
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this diplomatic option?')) {
      deleteMutation.mutate({ id });
    }
  };

  const handleBulkToggle = (isActive: boolean) => {
    if (selectedIds.size === 0) {
      toast({
        title: "No selection",
        description: "Please select at least one option",
        type: "warning"
      });
      return;
    }

    bulkToggleMutation.mutate({
      ids: Array.from(selectedIds),
      isActive
    });
  };

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredOptions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredOptions.map(o => o.id)));
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
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="glass-card-parent p-6 rounded-xl border-2 border-primary/20 bg-gradient-to-br from-primary/5 via-transparent to-primary/10 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <Link href="/admin">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Admin
                </Button>
              </Link>
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-primary/10 border border-primary/20">
                  <Flag className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                    Diplomatic Options
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Manage reference data for diplomatic profiles
                  </p>
                </div>
              </div>
            </div>
            <Button onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Option
            </Button>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search options..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Type filter */}
            <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as any)}>
              <SelectTrigger>
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="strategic_priority">Strategic Priority</SelectItem>
                <SelectItem value="partnership_goal">Partnership Goal</SelectItem>
                <SelectItem value="key_achievement">Key Achievement</SelectItem>
              </SelectContent>
            </Select>

            {/* Category filter */}
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {CATEGORIES.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Show inactive toggle */}
            <Button
              variant={showInactive ? "default" : "outline"}
              onClick={() => setShowInactive(!showInactive)}
              className="w-full"
            >
              {showInactive ? <ToggleRight className="h-4 w-4 mr-2" /> : <ToggleLeft className="h-4 w-4 mr-2" />}
              {showInactive ? "Showing All" : "Active Only"}
            </Button>
          </div>

          {/* Bulk actions */}
          {selectedIds.size > 0 && (
            <div className="mt-4 flex items-center gap-3 p-3 rounded-lg bg-primary/10 border border-primary/20">
              <span className="text-sm font-medium text-foreground">
                {selectedIds.size} selected
              </span>
              <Button size="sm" variant="outline" onClick={() => handleBulkToggle(true)}>
                <Check className="h-4 w-4 mr-2" />
                Activate
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleBulkToggle(false)}>
                <X className="h-4 w-4 mr-2" />
                Deactivate
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
                Clear Selection
              </Button>
            </div>
          )}
        </div>

        {/* Table */}
        <div className="glass-card-child p-6 rounded-xl border border-border/50">
          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading diplomatic options...</p>
            </div>
          ) : filteredOptions.length === 0 ? (
            <div className="text-center py-12">
              <Filter className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No diplomatic options found</p>
              <Button className="mt-4" onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add First Option
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === filteredOptions.length && filteredOptions.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded border-border"
                    />
                  </TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Sort Order</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOptions.map((option) => (
                  <TableRow key={option.id}>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(option.id)}
                        onChange={() => toggleSelection(option.id)}
                        className="rounded border-border"
                      />
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                        {TYPE_LABELS[option.type as DiplomaticOptionType]}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium">{option.value}</TableCell>
                    <TableCell>
                      {option.category ? (
                        <span className="text-sm text-muted-foreground">{option.category}</span>
                      ) : (
                        <span className="text-sm text-muted-foreground italic">None</span>
                      )}
                    </TableCell>
                    <TableCell>{option.sortOrder}</TableCell>
                    <TableCell>
                      {option.isActive ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400">
                          Inactive
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            // Toggle active status
                            handleUpdate(option.id, { ...option, isActive: !option.isActive });
                          }}
                        >
                          {option.isActive ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(option.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Stats */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="glass-card-child p-4 rounded-lg border border-border/50">
            <div className="text-2xl font-bold text-foreground">{options?.length || 0}</div>
            <div className="text-sm text-muted-foreground">Total Options</div>
          </div>
          <div className="glass-card-child p-4 rounded-lg border border-border/50">
            <div className="text-2xl font-bold text-foreground">
              {options?.filter(o => o.isActive).length || 0}
            </div>
            <div className="text-sm text-muted-foreground">Active Options</div>
          </div>
          <div className="glass-card-child p-4 rounded-lg border border-border/50">
            <div className="text-2xl font-bold text-foreground">
              {filteredOptions.length}
            </div>
            <div className="text-sm text-muted-foreground">Filtered Results</div>
          </div>
          <div className="glass-card-child p-4 rounded-lg border border-border/50">
            <div className="text-2xl font-bold text-foreground">
              {new Set(options?.map(o => o.category).filter(Boolean)).size}
            </div>
            <div className="text-sm text-muted-foreground">Categories</div>
          </div>
        </div>

        {/* Add Dialog */}
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add Diplomatic Option</DialogTitle>
              <DialogDescription>
                Create a new diplomatic option for user profiles
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">Type</label>
                <Select
                  value={formData.type}
                  onValueChange={(value) => setFormData({ ...formData, type: value as DiplomaticOptionType })}
                >
                  <SelectTrigger>
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
                <label className="text-sm font-medium text-foreground mb-2 block">Value *</label>
                <Input
                  value={formData.value}
                  onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                  placeholder="e.g., Economic Growth"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">Category</label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {CATEGORIES.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">Description</label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Optional description..."
                />
              </div>

              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">Sort Order</label>
                <Input
                  type="number"
                  value={formData.sortOrder}
                  onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={!formData.value || createMutation.isPending}
              >
                {createMutation.isPending ? "Creating..." : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
