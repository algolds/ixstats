"use client";

/**
 * Map Editor Admin Review Interface
 *
 * Admin-only interface for reviewing user-submitted map features:
 * - Subdivisions (administrative regions)
 * - Cities (settlements)
 * - Points of Interest (POIs)
 *
 * Features:
 * - Multi-tab review queue (Pending Subdivisions/Cities/POIs/All Submissions)
 * - Sortable, filterable tables with search
 * - Detailed review panel with map preview
 * - Bulk approve/reject operations
 * - Audit log viewer
 * - Status badges and filters
 *
 * Access: Admin role (level >= 90) required
 */

import { useEffect, useState, useMemo } from "react";
import { useUser } from "~/context/auth-context";
import { useRouter } from "next/navigation";
import { createUrl } from "~/lib/url-utils";
import { LoadingState } from "~/components/shared/feedback/LoadingState";
import { api } from "~/trpc/react";
import { ReviewQueue } from "~/components/maps/admin/ReviewQueue";
import { ReviewPanel } from "~/components/maps/admin/ReviewPanel";
import { BulkActions } from "~/components/maps/admin/BulkActions";
import { Badge } from "~/components/ui/badge";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import {
  MapPin,
  Building2,
  Layers,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  ChevronLeft,
  AlertTriangle,
} from "lucide-react";

export const dynamic = "force-dynamic";

type TabType = "subdivisions" | "cities" | "pois" | "all";
type StatusFilter = "pending" | "approved" | "rejected" | "all";
type SortField = "name" | "type" | "country" | "submittedBy" | "createdAt";
type SortOrder = "asc" | "desc";

interface SelectedItems {
  subdivisions: Set<string>;
  cities: Set<string>;
  pois: Set<string>;
}

/**
 * Map Editor Admin Review Page
 *
 * Protected admin page that requires role level >= 90
 */
export default function MapEditorAdminPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();

  // Tab and filter state
  const [activeTab, setActiveTab] = useState<TabType>("subdivisions");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");

  // Selection and review state
  const [selectedItems, setSelectedItems] = useState<SelectedItems>({
    subdivisions: new Set(),
    cities: new Set(),
    pois: new Set(),
  });
  const [reviewingItem, setReviewingItem] = useState<{
    type: "subdivision" | "city" | "poi";
    id: string;
  } | null>(null);

  // Pagination
  const [offset, setOffset] = useState(0);
  const limit = 50;

  // Set page title
  useEffect(() => {
    document.title = "Map Editor Admin Review - IxStats";
  }, []);

  // Fetch pending reviews based on active tab
  const {
    data: reviewData,
    isLoading: reviewsLoading,
    refetch: refetchReviews,
  } = api.mapEditor.getPendingReviews.useQuery(
    {
      entityType: activeTab === "all" ? "all" : activeTab.slice(0, -1) as any,
      limit,
      offset,
    },
    {
      refetchOnWindowFocus: false,
    }
  );

  // Fetch audit logs
  const {
    data: auditData,
    isLoading: auditLoading,
  } = api.mapEditor.getEditHistory.useQuery(
    {
      limit: 100,
      offset: 0,
    },
    {
      refetchOnWindowFocus: false,
    }
  );

  // Check admin access
  const isAdmin = useMemo(() => {
    if (!user) return false;
    const roleLevel = user.publicMetadata?.roleLevel as number | undefined;
    return roleLevel !== undefined && roleLevel <= 90;
  }, [user]);

  // Authentication guard
  if (!isLoaded) {
    return <LoadingState message="Loading..." />;
  }

  if (!user) {
    router.push(createUrl("/sign-in"));
    return <LoadingState message="Redirecting to sign in..." />;
  }

  // Admin access guard
  if (!isAdmin) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-900">
        <div className="glass-panel p-8 text-center max-w-md">
          <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-4">Access Denied</h1>
          <p className="text-slate-400 mb-6">
            You need administrator privileges to access the Map Editor review
            interface.
          </p>
          <Button
            onClick={() => router.push(createUrl("/admin"))}
            variant="outline"
          >
            Return to Admin Dashboard
          </Button>
        </div>
      </div>
    );
  }

  // Filter and sort data based on current tab
  const filteredData = useMemo(() => {
    if (!reviewData) return { items: [], total: 0 };

    let items: any[] = [];

    if (activeTab === "subdivisions" || activeTab === "all") {
      items = [...items, ...reviewData.subdivisions.map((s: any) => ({ ...s, entityType: "subdivision" }))];
    }
    if (activeTab === "cities" || activeTab === "all") {
      items = [...items, ...reviewData.cities.map((c: any) => ({ ...c, entityType: "city" }))];
    }
    if (activeTab === "pois" || activeTab === "all") {
      items = [...items, ...reviewData.pois.map((p: any) => ({ ...p, entityType: "poi" }))];
    }

    // Apply status filter
    if (statusFilter !== "all") {
      items = items.filter((item) => item.status === statusFilter);
    }

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      items = items.filter(
        (item) =>
          item.name.toLowerCase().includes(query) ||
          item.country?.name.toLowerCase().includes(query)
      );
    }

    // Apply sorting
    items.sort((a, b) => {
      let aVal: any, bVal: any;

      switch (sortField) {
        case "name":
          aVal = a.name;
          bVal = b.name;
          break;
        case "type":
          aVal = a.type || a.category;
          bVal = b.type || b.category;
          break;
        case "country":
          aVal = a.country?.name || "";
          bVal = b.country?.name || "";
          break;
        case "submittedBy":
          aVal = a.submittedBy;
          bVal = b.submittedBy;
          break;
        case "createdAt":
          aVal = new Date(a.createdAt).getTime();
          bVal = new Date(b.createdAt).getTime();
          break;
        default:
          return 0;
      }

      if (aVal < bVal) return sortOrder === "asc" ? -1 : 1;
      if (aVal > bVal) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

    return { items, total: items.length };
  }, [reviewData, activeTab, statusFilter, searchQuery, sortField, sortOrder]);

  // Toggle item selection
  const toggleSelection = (type: keyof SelectedItems, id: string) => {
    setSelectedItems((prev) => {
      const newSet = new Set(prev[type]);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return { ...prev, [type]: newSet };
    });
  };

  // Select all items in current view
  const selectAll = () => {
    setSelectedItems((prev) => {
      const newState = { ...prev };
      filteredData.items.forEach((item) => {
        const type = item.entityType + "s" as keyof SelectedItems;
        newState[type].add(item.id);
      });
      return newState;
    });
  };

  // Clear all selections
  const clearAll = () => {
    setSelectedItems({
      subdivisions: new Set(),
      cities: new Set(),
      pois: new Set(),
    });
  };

  // Get total selected count
  const totalSelected =
    selectedItems.subdivisions.size +
    selectedItems.cities.size +
    selectedItems.pois.size;

  // Handle sort column click
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  // Status badge component
  const StatusBadge = ({ status }: { status: string }) => {
    const variants: Record<string, { variant: any; icon: any; label: string }> = {
      pending: {
        variant: "outline",
        icon: Clock,
        label: "Pending",
      },
      approved: {
        variant: "default",
        icon: CheckCircle2,
        label: "Approved",
      },
      rejected: {
        variant: "destructive",
        icon: XCircle,
        label: "Rejected",
      },
    };

    const config = variants[status] || variants.pending;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  // Tab configuration
  const tabs = [
    {
      id: "subdivisions" as TabType,
      label: "Subdivisions",
      icon: Layers,
      count: reviewData?.subdivisions.length || 0,
    },
    {
      id: "cities" as TabType,
      label: "Cities",
      icon: Building2,
      count: reviewData?.cities.length || 0,
    },
    {
      id: "pois" as TabType,
      label: "POIs",
      icon: MapPin,
      count: reviewData?.pois.length || 0,
    },
    {
      id: "all" as TabType,
      label: "All Submissions",
      icon: Filter,
      count: (reviewData?.subdivisions.length || 0) + (reviewData?.cities.length || 0) + (reviewData?.pois.length || 0),
    },
  ];

  return (
    <div className="h-screen flex flex-col bg-slate-900">
      {/* Header */}
      <div className="glass-panel border-b border-slate-700/50 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <MapPin className="h-6 w-6 text-indigo-400" />
              Map Editor Review
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Review and approve user-submitted geographic features
            </p>
          </div>
          <Button
            onClick={() => router.push(createUrl("/admin"))}
            variant="outline"
            className="gap-2"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to Admin
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Review Queue */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Tabs */}
          <div className="glass-panel border-b border-slate-700/50 px-6 py-3">
            <div className="flex gap-2">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id);
                      setOffset(0);
                      clearAll();
                    }}
                    className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors flex items-center gap-2 ${
                      activeTab === tab.id
                        ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                        : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                    <Badge variant="outline" className="ml-1">
                      {tab.count}
                    </Badge>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Filters and Search */}
          <div className="glass-panel border-b border-slate-700/50 px-6 py-3">
            <div className="flex items-center gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Search by name or country..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-slate-800/50 border-slate-700 text-white"
                />
              </div>

              <Select
                value={statusFilter}
                onValueChange={(value: StatusFilter) => setStatusFilter(value)}
              >
                <SelectTrigger className="w-40 bg-slate-800/50 border-slate-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>

              {totalSelected > 0 && (
                <div className="text-sm text-slate-400">
                  {totalSelected} selected
                </div>
              )}
            </div>
          </div>

          {/* Bulk Actions */}
          {totalSelected > 0 && (
            <div className="glass-panel border-b border-slate-700/50 px-6 py-3">
              <BulkActions
                selectedItems={selectedItems}
                onClearSelection={clearAll}
                onRefetch={refetchReviews}
              />
            </div>
          )}

          {/* Table */}
          <div className="flex-1 overflow-auto px-6 py-4">
            {reviewsLoading ? (
              <LoadingState message="Loading submissions..." />
            ) : filteredData.items.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400">
                <Filter className="h-16 w-16 mb-4 opacity-50" />
                <p className="text-lg font-medium">No submissions found</p>
                <p className="text-sm">Try adjusting your filters</p>
              </div>
            ) : (
              <div className="glass-panel rounded-lg border border-slate-700/50 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <input
                          type="checkbox"
                          onChange={(e) => {
                            if (e.target.checked) {
                              selectAll();
                            } else {
                              clearAll();
                            }
                          }}
                          className="rounded"
                        />
                      </TableHead>
                      <TableHead
                        className="cursor-pointer hover:text-white"
                        onClick={() => handleSort("name")}
                      >
                        Name {sortField === "name" && (sortOrder === "asc" ? "↑" : "↓")}
                      </TableHead>
                      <TableHead
                        className="cursor-pointer hover:text-white"
                        onClick={() => handleSort("type")}
                      >
                        Type {sortField === "type" && (sortOrder === "asc" ? "↑" : "↓")}
                      </TableHead>
                      <TableHead
                        className="cursor-pointer hover:text-white"
                        onClick={() => handleSort("country")}
                      >
                        Country {sortField === "country" && (sortOrder === "asc" ? "↑" : "↓")}
                      </TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead
                        className="cursor-pointer hover:text-white"
                        onClick={() => handleSort("createdAt")}
                      >
                        Submitted {sortField === "createdAt" && (sortOrder === "asc" ? "↑" : "↓")}
                      </TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredData.items.map((item) => {
                      const entityType = item.entityType + "s" as keyof SelectedItems;
                      const isSelected = selectedItems[entityType].has(item.id);

                      return (
                        <TableRow key={item.id}>
                          <TableCell>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelection(entityType, item.id)}
                              className="rounded"
                            />
                          </TableCell>
                          <TableCell className="font-medium text-white">
                            {item.name}
                          </TableCell>
                          <TableCell className="text-slate-400">
                            {item.type || item.category}
                          </TableCell>
                          <TableCell className="text-slate-400">
                            {item.country?.name || "Unknown"}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={item.status} />
                          </TableCell>
                          <TableCell className="text-slate-400 text-sm">
                            {new Date(item.createdAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                setReviewingItem({
                                  type: item.entityType,
                                  id: item.id,
                                })
                              }
                              className="gap-2"
                            >
                              <Eye className="h-3 w-3" />
                              Review
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>

        {/* Right: Review Panel (conditionally rendered) */}
        {reviewingItem && (
          <ReviewPanel
            entityType={reviewingItem.type}
            entityId={reviewingItem.id}
            onClose={() => setReviewingItem(null)}
            onRefetch={refetchReviews}
          />
        )}
      </div>

      {/* Bottom: Audit Log Viewer */}
      <div className="glass-panel border-t border-slate-700/50 px-6 py-4 max-h-64 overflow-auto">
        <h3 className="text-sm font-semibold text-white mb-3">Recent Audit Log</h3>
        {auditLoading ? (
          <div className="text-slate-400 text-sm">Loading audit log...</div>
        ) : (
          <div className="space-y-2">
            {auditData?.logs.slice(0, 10).map((log) => (
              <div
                key={log.id}
                className="flex items-center gap-3 text-xs text-slate-400 py-1"
              >
                <span className="text-slate-500 font-mono">
                  {new Date(log.createdAt).toLocaleString()}
                </span>
                <Badge variant="outline" className="text-xs">
                  {log.action}
                </Badge>
                <span>{log.entityType}</span>
                <span className="text-slate-500">by</span>
                <span className="text-white">{log.userName}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
