"use client";

/**
 * ReviewQueue Component
 *
 * Displays a paginated, filterable queue of pending map submissions.
 * Used in the admin map editor review interface.
 *
 * Features:
 * - Tabbed interface (Subdivisions/Cities/POIs/All)
 * - Search and filtering
 * - Sortable columns
 * - Bulk selection
 * - Status badges
 *
 * @module components/maps/admin/ReviewQueue
 */

import { useState } from "react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Search, Filter, Clock, CheckCircle2, XCircle } from "lucide-react";

interface ReviewQueueProps {
  items: any[];
  selectedItems: Set<string>;
  onToggleSelection: (id: string) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  onReview: (item: any) => void;
  isLoading?: boolean;
}

/**
 * Status badge with icon
 */
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

/**
 * ReviewQueue Component
 *
 * Displays and manages the review queue for map submissions
 */
export function ReviewQueue({
  items,
  selectedItems,
  onToggleSelection,
  onSelectAll,
  onClearAll,
  onReview,
  isLoading = false,
}: ReviewQueueProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<"name" | "type" | "country" | "createdAt">("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // Filter items based on search
  const filteredItems = items.filter((item) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      item.name.toLowerCase().includes(query) ||
      item.country?.name.toLowerCase().includes(query)
    );
  });

  // Sort items
  const sortedItems = [...filteredItems].sort((a, b) => {
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

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-slate-400">Loading submissions...</div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-slate-400">
        <Filter className="h-16 w-16 mb-4 opacity-50" />
        <p className="text-lg font-medium">No submissions found</p>
        <p className="text-sm">All caught up!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          type="text"
          placeholder="Search by name or country..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 bg-slate-800/50 border-slate-700 text-white"
        />
      </div>

      {/* Table */}
      <div className="glass-panel rounded-lg overflow-hidden">
        <div className="overflow-x-auto -mx-2 sm:mx-0">
          <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <input
                  type="checkbox"
                  onChange={(e) => {
                    if (e.target.checked) {
                      onSelectAll();
                    } else {
                      onClearAll();
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
            {sortedItems.map((item) => {
              const isSelected = selectedItems.has(item.id);

              return (
                <TableRow key={item.id}>
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggleSelection(item.id)}
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
                      onClick={() => onReview(item)}
                    >
                      Review
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        </div>
      </div>

      {/* Summary */}
      <div className="text-sm text-slate-400 text-center">
        Showing {sortedItems.length} of {items.length} submissions
        {selectedItems.size > 0 && ` (${selectedItems.size} selected)`}
      </div>
    </div>
  );
}
