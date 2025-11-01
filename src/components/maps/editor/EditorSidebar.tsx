/**
 * EditorSidebar Component
 *
 * Right-side panel with tabs for managing subdivisions, cities, POIs, and submissions.
 * Displays lists of user-created features with status badges and edit/delete actions.
 * Fully integrated with tRPC for live data fetching, mutations, and real-time updates.
 */

"use client";

import React, { useState } from "react";
import { api } from "~/trpc/react";
import { Loader2, Search, Plus, Edit2, Trash2, Eye, CheckCircle, XCircle, Clock, FileText, X } from "lucide-react";
import type { Feature, Polygon, MultiPolygon } from "geojson";
import { CityPlacement } from "./CityPlacement";
import { POIEditor } from "./POIEditor";
import { SubdivisionEditor } from "./SubdivisionEditor";

interface EditorSidebarProps {
  countryId: string;
  countryGeometry?: Feature<Polygon | MultiPolygon> | null;
  onFeatureSelect?: (featureId: string, featureType: "subdivision" | "city" | "poi") => void;
  onNewFeature?: (type: "subdivision" | "city" | "poi") => void;
  onEditFeature?: (featureId: string, featureType: "subdivision" | "city" | "poi") => void;
}

type TabType = "subdivisions" | "cities" | "pois" | "submissions";
type StatusType = "pending" | "approved" | "rejected" | "draft";
type EditorMode = "list" | "create-city" | "create-poi" | "create-subdivision" | "edit-city" | "edit-poi" | "edit-subdivision";

/**
 * EditorSidebar Component (Memoized)
 * Only re-renders when props actually change
 */
export const EditorSidebar = React.memo(function EditorSidebar({
  countryId,
  countryGeometry,
  onFeatureSelect,
  onNewFeature,
  onEditFeature,
}: EditorSidebarProps) {
  const [activeTab, setActiveTab] = useState<TabType>("subdivisions");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusType | "all">("all");
  const [currentPage, setCurrentPage] = useState(0);
  const [editorMode, setEditorMode] = useState<EditorMode>("list");
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const itemsPerPage = 10;

  const utils = api.useUtils();

  // Reset pagination when tab or filters change
  React.useEffect(() => {
    setCurrentPage(0);
  }, [activeTab, searchQuery, statusFilter]);

  // Handlers for opening/closing forms
  const handleOpenCityForm = () => {
    setEditorMode("create-city");
    setActiveTab("cities");
  };

  const handleOpenPOIForm = () => {
    setEditorMode("create-poi");
    setActiveTab("pois");
  };

  const handleOpenSubdivisionForm = () => {
    setEditorMode("create-subdivision");
    setActiveTab("subdivisions");
  };

  const handleCloseForm = () => {
    setEditorMode("list");
    setEditingItemId(null);
  };

  const handleEditCity = (cityId: string) => {
    setEditorMode("edit-city");
    setEditingItemId(cityId);
    setActiveTab("cities");
  };

  const handleEditPOI = (poiId: string) => {
    setEditorMode("edit-poi");
    setEditingItemId(poiId);
    setActiveTab("pois");
  };

  const handleEditSubdivision = (subdivisionId: string) => {
    setEditorMode("edit-subdivision");
    setEditingItemId(subdivisionId);
    setActiveTab("subdivisions");
  };

  const handleSaveSuccess = () => {
    // Invalidate all queries to refresh lists
    void utils.mapEditor.getMyCities.invalidate();
    void utils.mapEditor.getMyPOIs.invalidate();
    void utils.mapEditor.getMySubdivisions.invalidate();
    handleCloseForm();
  };

  // If in editor mode, show the form
  if (editorMode !== "list") {
    return (
      <div className="h-full flex flex-col bg-white dark:bg-slate-900/50">
        {/* Header with back button */}
        <div className="glass-panel border-b border-slate-200 dark:border-slate-700/50 px-4 py-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              {editorMode === "create-city" && "New City"}
              {editorMode === "create-poi" && "New POI"}
              {editorMode === "create-subdivision" && "New Subdivision"}
              {editorMode === "edit-city" && "Edit City"}
              {editorMode === "edit-poi" && "Edit POI"}
              {editorMode === "edit-subdivision" && "Edit Subdivision"}
            </h3>
            <button
              onClick={handleCloseForm}
              className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700/50 rounded transition-colors"
            >
              <X className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            </button>
          </div>
        </div>

        {/* Form Content */}
        <div className="flex-1 overflow-y-auto">
          {(editorMode === "create-city" || editorMode === "edit-city") && (
            <CityPlacement
              countryId={countryId}
              countryGeometry={countryGeometry}
              onCityPlaced={handleSaveSuccess}
              onCityUpdated={handleSaveSuccess}
            />
          )}
          {(editorMode === "create-poi" || editorMode === "edit-poi") && (
            <POIEditor
              countryId={countryId}
              countryGeometry={countryGeometry}
              mode={editorMode === "create-poi" ? "create" : "edit"}
              poiId={editingItemId ?? undefined}
              onSuccess={handleSaveSuccess}
              onCancel={handleCloseForm}
            />
          )}
          {(editorMode === "create-subdivision" || editorMode === "edit-subdivision") && (
            <SubdivisionEditor
              map={(window as any).__mapEditorInstance || null}
              countryId={countryId}
              isActive={true}
              onClose={handleCloseForm}
              onSaved={handleSaveSuccess}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white dark:bg-slate-900/50">
      {/* Tab Navigation */}
      <div className="glass-panel border-b border-slate-200 dark:border-slate-700/50">
        <div className="flex gap-1 p-2">
          <TabButton
            label="Subdivisions"
            active={activeTab === "subdivisions"}
            onClick={() => { setActiveTab("subdivisions"); setEditorMode("list"); }}
          />
          <TabButton
            label="Cities"
            active={activeTab === "cities"}
            onClick={() => { setActiveTab("cities"); setEditorMode("list"); }}
          />
          <TabButton
            label="POIs"
            active={activeTab === "pois"}
            onClick={() => { setActiveTab("pois"); setEditorMode("list"); }}
          />
          <TabButton
            label="My Submissions"
            active={activeTab === "submissions"}
            onClick={() => { setActiveTab("submissions"); setEditorMode("list"); }}
          />
        </div>
      </div>

      {/* Search and Filter Bar */}
      <div className="glass-panel border-b border-slate-200 dark:border-slate-700/50 p-3 space-y-2">
        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-400" />
          <input
            type="text"
            placeholder={`Search ${activeTab}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-lg text-slate-900 dark:text-white text-sm placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-gold-500/50"
          />
        </div>

        {/* Status Filter */}
        <div className="flex gap-1">
          <FilterButton
            label="All"
            active={statusFilter === "all"}
            onClick={() => setStatusFilter("all")}
          />
          <FilterButton
            label="Draft"
            active={statusFilter === "draft"}
            onClick={() => setStatusFilter("draft")}
          />
          <FilterButton
            label="Pending"
            active={statusFilter === "pending"}
            onClick={() => setStatusFilter("pending")}
          />
          <FilterButton
            label="Approved"
            active={statusFilter === "approved"}
            onClick={() => setStatusFilter("approved")}
          />
          <FilterButton
            label="Rejected"
            active={statusFilter === "rejected"}
            onClick={() => setStatusFilter("rejected")}
          />
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "subdivisions" && (
          <SubdivisionsTab
            countryId={countryId}
            searchQuery={searchQuery}
            statusFilter={statusFilter}
            currentPage={currentPage}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
            onFeatureSelect={onFeatureSelect}
            onEditFeature={handleEditSubdivision}
            onNewFeature={handleOpenSubdivisionForm}
          />
        )}
        {activeTab === "cities" && (
          <CitiesTab
            countryId={countryId}
            searchQuery={searchQuery}
            statusFilter={statusFilter}
            currentPage={currentPage}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
            onFeatureSelect={onFeatureSelect}
            onEditFeature={handleEditCity}
            onNewFeature={handleOpenCityForm}
          />
        )}
        {activeTab === "pois" && (
          <POIsTab
            countryId={countryId}
            searchQuery={searchQuery}
            statusFilter={statusFilter}
            currentPage={currentPage}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
            onFeatureSelect={onFeatureSelect}
            onEditFeature={handleEditPOI}
            onNewFeature={handleOpenPOIForm}
          />
        )}
        {activeTab === "submissions" && (
          <SubmissionsTab
            countryId={countryId}
            searchQuery={searchQuery}
            statusFilter={statusFilter}
            currentPage={currentPage}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
            onFeatureSelect={onFeatureSelect}
            onEditCity={handleEditCity}
            onEditPOI={handleEditPOI}
            onEditSubdivision={handleEditSubdivision}
          />
        )}
      </div>
    </div>
  );
});

// ============================================================================
// Tab Components
// ============================================================================

interface TabContentProps {
  countryId: string;
  searchQuery: string;
  statusFilter: StatusType | "all";
  currentPage: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  onFeatureSelect?: (featureId: string, featureType: "subdivision" | "city" | "poi") => void;
  onEditFeature?: (featureId: string) => void;
  onNewFeature?: () => void;
}

function SubdivisionsTab({
  countryId,
  searchQuery,
  statusFilter,
  currentPage,
  itemsPerPage,
  onPageChange,
  onFeatureSelect,
  onEditFeature,
  onNewFeature,
}: TabContentProps) {
  const utils = api.useUtils();

  const { data, isLoading, error, refetch } = api.mapEditor.getMySubdivisions.useQuery({
    countryId,
    status: statusFilter === "all" ? undefined : statusFilter,
    limit: 100, // Fetch more, filter client-side
    offset: 0,
  });

  // DEBUG: Log query state
  React.useEffect(() => {
    console.log("[SubdivisionsTab] Query state:", {
      countryId,
      statusFilter,
      isLoading,
      hasError: !!error,
      errorMessage: error?.message,
      hasData: !!data,
      subdivisionCount: data?.subdivisions?.length ?? 0,
      subdivisions: data?.subdivisions,
    });
  }, [countryId, statusFilter, isLoading, error, data]);

  const deleteSubdivision = api.mapEditor.deleteSubdivision.useMutation({
    onSuccess: () => {
      void utils.mapEditor.getMySubdivisions.invalidate();
    },
  });

  const submitForReview = api.mapEditor.submitSubdivisionForReview.useMutation({
    onSuccess: () => {
      void utils.mapEditor.getMySubdivisions.invalidate();
    },
  });

  // Client-side filtering
  const filteredItems = React.useMemo(() => {
    if (!data?.subdivisions) return [];
    return data.subdivisions.filter((item) =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [data?.subdivisions, searchQuery]);

  // Pagination
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
  const paginatedItems = filteredItems.slice(
    currentPage * itemsPerPage,
    (currentPage + 1) * itemsPerPage
  );

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (error) {
    return (
      <ErrorState
        message={error.message || "Failed to load subdivisions"}
        onRetry={() => void refetch()}
      />
    );
  }

  if (filteredItems.length === 0) {
    return (
      <EmptyState
        title="No Subdivisions Found"
        description={searchQuery ? "Try adjusting your search or filters" : "Get started by creating your first subdivision"}
        actionLabel="New Subdivision"
        onAction={() => onNewFeature?.("subdivision")}
      />
    );
  }

  return (
    <div className="p-4 space-y-3">
      {/* New Button */}
      <button
        onClick={onNewFeature}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gold-500/20 hover:bg-gold-500/30 text-gold-700 dark:text-gold-300 rounded-lg transition-colors font-medium"
      >
        <Plus className="w-4 h-4" />
        New Subdivision
      </button>

      {/* Items List */}
      {paginatedItems.map((item) => (
        <FeatureCard
          key={item.id}
          id={item.id}
          name={item.name}
          status={item.status as StatusType}
          type="subdivision"
          metadata={{
            type: item.type,
            level: `Level ${item.level}`,
            population: item.population ? formatNumber(item.population) : undefined,
            area: item.areaSqKm ? `${formatNumber(item.areaSqKm)} km²` : undefined,
          }}
          rejectionReason={item.rejectionReason ?? undefined}
          onView={() => onFeatureSelect?.(item.id, "subdivision")}
          onEdit={() => onEditFeature?.(item.id)}
          onDelete={() => {
            if (confirm(`Are you sure you want to delete ${item.name}?`)) {
              deleteSubdivision.mutate({ id: item.id });
            }
          }}
          onSubmit={
            item.status === "draft" || item.status === "rejected"
              ? () => submitForReview.mutate({ id: item.id })
              : undefined
          }
          isDeleting={deleteSubdivision.isPending}
          isSubmitting={submitForReview.isPending}
        />
      ))}

      {/* Pagination */}
      {totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={onPageChange}
        />
      )}
    </div>
  );
}

function CitiesTab({
  countryId,
  searchQuery,
  statusFilter,
  currentPage,
  itemsPerPage,
  onPageChange,
  onFeatureSelect,
  onEditFeature,
  onNewFeature,
}: TabContentProps) {
  const utils = api.useUtils();

  const { data, isLoading, error, refetch } = api.mapEditor.getMyCities.useQuery({
    countryId,
    status: statusFilter === "all" ? undefined : statusFilter,
    limit: 100,
    offset: 0,
  });

  // DEBUG: Log query state
  React.useEffect(() => {
    console.log("[CitiesTab] Query state:", {
      countryId,
      statusFilter,
      isLoading,
      hasError: !!error,
      errorMessage: error?.message,
      hasData: !!data,
      cityCount: data?.cities?.length ?? 0,
      cities: data?.cities,
    });
  }, [countryId, statusFilter, isLoading, error, data]);

  const deleteCity = api.mapEditor.deleteCity.useMutation({
    onSuccess: () => {
      void utils.mapEditor.getMyCities.invalidate();
    },
  });

  const submitForReview = api.mapEditor.submitCityForReview.useMutation({
    onSuccess: () => {
      void utils.mapEditor.getMyCities.invalidate();
    },
  });

  const filteredItems = React.useMemo(() => {
    if (!data?.cities) return [];
    return data.cities.filter((item) =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [data?.cities, searchQuery]);

  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
  const paginatedItems = filteredItems.slice(
    currentPage * itemsPerPage,
    (currentPage + 1) * itemsPerPage
  );

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (error) {
    return (
      <ErrorState
        message={error.message || "Failed to load cities"}
        onRetry={() => void refetch()}
      />
    );
  }

  if (filteredItems.length === 0) {
    return (
      <EmptyState
        title="No Cities Found"
        description={searchQuery ? "Try adjusting your search or filters" : "Get started by creating your first city"}
        actionLabel="New City"
        onAction={() => onNewFeature?.("city")}
      />
    );
  }

  return (
    <div className="p-4 space-y-3">
      <button
        onClick={onNewFeature}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gold-500/20 hover:bg-gold-500/30 text-gold-700 dark:text-gold-300 rounded-lg transition-colors font-medium"
      >
        <Plus className="w-4 h-4" />
        New City
      </button>

      {paginatedItems.map((item) => (
        <FeatureCard
          key={item.id}
          id={item.id}
          name={item.name}
          status={item.status as StatusType}
          type="city"
          metadata={{
            type: item.type,
            population: item.population ? formatNumber(item.population) : undefined,
            subdivision: item.subdivision?.name,
            capital: item.isNationalCapital ? "National Capital" : item.isSubdivisionCapital ? "Subdivision Capital" : undefined,
          }}
          rejectionReason={item.rejectionReason ?? undefined}
          onView={() => onFeatureSelect?.(item.id, "city")}
          onEdit={() => onEditFeature?.(item.id)}
          onDelete={() => {
            if (confirm(`Are you sure you want to delete ${item.name}?`)) {
              deleteCity.mutate({ id: item.id });
            }
          }}
          onSubmit={
            item.status === "draft" || item.status === "rejected"
              ? () => submitForReview.mutate({ id: item.id })
              : undefined
          }
          isDeleting={deleteCity.isPending}
          isSubmitting={submitForReview.isPending}
        />
      ))}

      {totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={onPageChange}
        />
      )}
    </div>
  );
}

function POIsTab({
  countryId,
  searchQuery,
  statusFilter,
  currentPage,
  itemsPerPage,
  onPageChange,
  onFeatureSelect,
  onEditFeature,
  onNewFeature,
}: TabContentProps) {
  const utils = api.useUtils();

  const { data, isLoading, error, refetch } = api.mapEditor.getMyPOIs.useQuery({
    countryId,
    status: statusFilter === "all" ? undefined : statusFilter,
    limit: 100,
    offset: 0,
  });

  // DEBUG: Log query state
  React.useEffect(() => {
    console.log("[POIsTab] Query state:", {
      countryId,
      statusFilter,
      isLoading,
      hasError: !!error,
      errorMessage: error?.message,
      hasData: !!data,
      poiCount: data?.pois?.length ?? 0,
      pois: data?.pois,
    });
  }, [countryId, statusFilter, isLoading, error, data]);

  const deletePOI = api.mapEditor.deletePOI.useMutation({
    onSuccess: () => {
      void utils.mapEditor.getMyPOIs.invalidate();
    },
  });

  const submitForReview = api.mapEditor.submitPOIForReview.useMutation({
    onSuccess: () => {
      void utils.mapEditor.getMyPOIs.invalidate();
    },
  });

  const filteredItems = React.useMemo(() => {
    if (!data?.pois) return [];
    return data.pois.filter((item) =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [data?.pois, searchQuery]);

  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
  const paginatedItems = filteredItems.slice(
    currentPage * itemsPerPage,
    (currentPage + 1) * itemsPerPage
  );

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (error) {
    return (
      <ErrorState
        message={error.message || "Failed to load POIs"}
        onRetry={() => void refetch()}
      />
    );
  }

  if (filteredItems.length === 0) {
    return (
      <EmptyState
        title="No POIs Found"
        description={searchQuery ? "Try adjusting your search or filters" : "Get started by creating your first point of interest"}
        actionLabel="New POI"
        onAction={() => onNewFeature?.("poi")}
      />
    );
  }

  return (
    <div className="p-4 space-y-3">
      <button
        onClick={onNewFeature}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gold-500/20 hover:bg-gold-500/30 text-gold-700 dark:text-gold-300 rounded-lg transition-colors font-medium"
      >
        <Plus className="w-4 h-4" />
        New POI
      </button>

      {paginatedItems.map((item) => (
        <FeatureCard
          key={item.id}
          id={item.id}
          name={item.name}
          status={item.status as StatusType}
          type="poi"
          metadata={{
            category: item.category,
            subdivision: item.subdivision?.name,
          }}
          rejectionReason={item.rejectionReason ?? undefined}
          onView={() => onFeatureSelect?.(item.id, "poi")}
          onEdit={() => onEditFeature?.(item.id)}
          onDelete={() => {
            if (confirm(`Are you sure you want to delete ${item.name}?`)) {
              deletePOI.mutate({ id: item.id });
            }
          }}
          onSubmit={
            item.status === "draft" || item.status === "rejected"
              ? () => submitForReview.mutate({ id: item.id })
              : undefined
          }
          isDeleting={deletePOI.isPending}
          isSubmitting={submitForReview.isPending}
        />
      ))}

      {totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={onPageChange}
        />
      )}
    </div>
  );
}

function SubmissionsTab({
  countryId,
  searchQuery,
  statusFilter,
  currentPage,
  itemsPerPage,
  onPageChange,
  onFeatureSelect,
  onEditCity,
  onEditPOI,
  onEditSubdivision,
}: Omit<TabContentProps, "onNewFeature" | "onEditFeature"> & {
  onEditCity?: (id: string) => void;
  onEditPOI?: (id: string) => void;
  onEditSubdivision?: (id: string) => void;
}) {
  const utils = api.useUtils();

  const subdivisions = api.mapEditor.getMySubdivisions.useQuery({
    countryId,
    status: statusFilter === "all" ? undefined : statusFilter,
    limit: 100,
    offset: 0,
  });

  const cities = api.mapEditor.getMyCities.useQuery({
    countryId,
    status: statusFilter === "all" ? undefined : statusFilter,
    limit: 100,
    offset: 0,
  });

  const pois = api.mapEditor.getMyPOIs.useQuery({
    countryId,
    status: statusFilter === "all" ? undefined : statusFilter,
    limit: 100,
    offset: 0,
  });

  const deleteSubdivision = api.mapEditor.deleteSubdivision.useMutation({
    onSuccess: () => void utils.mapEditor.getMySubdivisions.invalidate(),
  });

  const deleteCity = api.mapEditor.deleteCity.useMutation({
    onSuccess: () => void utils.mapEditor.getMyCities.invalidate(),
  });

  const deletePOI = api.mapEditor.deletePOI.useMutation({
    onSuccess: () => void utils.mapEditor.getMyPOIs.invalidate(),
  });

  const submitSubdivision = api.mapEditor.submitSubdivisionForReview.useMutation({
    onSuccess: () => void utils.mapEditor.getMySubdivisions.invalidate(),
  });

  const submitCity = api.mapEditor.submitCityForReview.useMutation({
    onSuccess: () => void utils.mapEditor.getMyCities.invalidate(),
  });

  const submitPOI = api.mapEditor.submitPOIForReview.useMutation({
    onSuccess: () => void utils.mapEditor.getMyPOIs.invalidate(),
  });

  const isLoading = subdivisions.isLoading || cities.isLoading || pois.isLoading;
  const hasError = subdivisions.error || cities.error || pois.error;

  // Combine all submissions
  const allSubmissions = React.useMemo(() => {
    const items: Array<{
      id: string;
      name: string;
      status: StatusType;
      type: "subdivision" | "city" | "poi";
      createdAt: Date;
      metadata: Record<string, string | undefined>;
      rejectionReason?: string;
    }> = [];

    if (subdivisions.data?.subdivisions) {
      subdivisions.data.subdivisions.forEach((item) => {
        items.push({
          id: item.id,
          name: item.name,
          status: item.status as StatusType,
          type: "subdivision",
          createdAt: item.createdAt,
          metadata: {
            type: item.type,
            level: `Level ${item.level}`,
            population: item.population ? formatNumber(item.population) : undefined,
          },
          rejectionReason: item.rejectionReason ?? undefined,
        });
      });
    }

    if (cities.data?.cities) {
      cities.data.cities.forEach((item) => {
        items.push({
          id: item.id,
          name: item.name,
          status: item.status as StatusType,
          type: "city",
          createdAt: item.createdAt,
          metadata: {
            type: item.type,
            population: item.population ? formatNumber(item.population) : undefined,
          },
          rejectionReason: item.rejectionReason ?? undefined,
        });
      });
    }

    if (pois.data?.pois) {
      pois.data.pois.forEach((item) => {
        items.push({
          id: item.id,
          name: item.name,
          status: item.status as StatusType,
          type: "poi",
          createdAt: item.createdAt,
          metadata: {
            category: item.category,
          },
          rejectionReason: item.rejectionReason ?? undefined,
        });
      });
    }

    // Sort by creation date (newest first)
    return items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }, [subdivisions.data, cities.data, pois.data]);

  // Filter by search query
  const filteredItems = React.useMemo(() => {
    return allSubmissions.filter((item) =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [allSubmissions, searchQuery]);

  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
  const paginatedItems = filteredItems.slice(
    currentPage * itemsPerPage,
    (currentPage + 1) * itemsPerPage
  );

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (hasError) {
    return (
      <ErrorState
        message="Failed to load submissions"
        onRetry={() => {
          void subdivisions.refetch();
          void cities.refetch();
          void pois.refetch();
        }}
      />
    );
  }

  if (filteredItems.length === 0) {
    return (
      <EmptyState
        title="No Submissions Found"
        description={searchQuery ? "Try adjusting your search or filters" : "Your map submissions will appear here"}
      />
    );
  }

  return (
    <div className="p-4 space-y-3">
      {paginatedItems.map((item) => (
        <FeatureCard
          key={`${item.type}-${item.id}`}
          id={item.id}
          name={item.name}
          status={item.status}
          type={item.type}
          metadata={item.metadata}
          rejectionReason={item.rejectionReason}
          onView={() => onFeatureSelect?.(item.id, item.type)}
          onEdit={() => {
            if (item.type === "subdivision") {
              onEditSubdivision?.(item.id);
            } else if (item.type === "city") {
              onEditCity?.(item.id);
            } else {
              onEditPOI?.(item.id);
            }
          }}
          onDelete={() => {
            if (confirm(`Are you sure you want to delete ${item.name}?`)) {
              if (item.type === "subdivision") {
                deleteSubdivision.mutate({ id: item.id });
              } else if (item.type === "city") {
                deleteCity.mutate({ id: item.id });
              } else {
                deletePOI.mutate({ id: item.id });
              }
            }
          }}
          onSubmit={
            item.status === "draft" || item.status === "rejected"
              ? () => {
                  if (item.type === "subdivision") {
                    submitSubdivision.mutate({ id: item.id });
                  } else if (item.type === "city") {
                    submitCity.mutate({ id: item.id });
                  } else {
                    submitPOI.mutate({ id: item.id });
                  }
                }
              : undefined
          }
          isDeleting={
            deleteSubdivision.isPending || deleteCity.isPending || deletePOI.isPending
          }
          isSubmitting={
            submitSubdivision.isPending || submitCity.isPending || submitPOI.isPending
          }
        />
      ))}

      {totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={onPageChange}
        />
      )}
    </div>
  );
}

// ============================================================================
// UI Components
// ============================================================================

function TabButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
        active
          ? "bg-gold-500/20 text-gold-600 dark:text-gold-300"
          : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700/30"
      }`}
    >
      {label}
    </button>
  );
}

function FilterButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 px-3 py-1.5 text-xs font-medium rounded transition-colors ${
        active
          ? "bg-gold-500/20 text-gold-600 dark:text-gold-300"
          : "bg-slate-100 dark:bg-slate-800/30 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700/30 hover:text-slate-900 dark:hover:text-white"
      }`}
    >
      {label}
    </button>
  );
}

function FeatureCard({
  id,
  name,
  status,
  type,
  metadata,
  rejectionReason,
  onView,
  onEdit,
  onDelete,
  onSubmit,
  isDeleting,
  isSubmitting,
}: {
  id: string;
  name: string;
  status: StatusType;
  type: "subdivision" | "city" | "poi";
  metadata: Record<string, string | undefined>;
  rejectionReason?: string;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onSubmit?: () => void;
  isDeleting?: boolean;
  isSubmitting?: boolean;
}) {
  return (
    <div className="glass-panel p-3 space-y-2 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h4 className="text-slate-900 dark:text-white font-medium truncate">{name}</h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">{type}</p>
        </div>
        <StatusBadge status={status} />
      </div>

      {/* Metadata */}
      <div className="space-y-1">
        {Object.entries(metadata).map(([key, value]) =>
          value ? (
            <div key={key} className="flex justify-between text-xs">
              <span className="text-slate-500 dark:text-slate-400 capitalize">{key}:</span>
              <span className="text-slate-700 dark:text-slate-300">{value}</span>
            </div>
          ) : null
        )}
      </div>

      {/* Rejection Reason */}
      {status === "rejected" && rejectionReason && (
        <div className="p-2 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-700 dark:text-red-300">
          <strong>Reason:</strong> {rejectionReason}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={onView}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-200 dark:bg-slate-700/30 hover:bg-slate-300 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-300 text-xs font-medium rounded transition-colors"
        >
          <Eye className="w-3.5 h-3.5" />
          View
        </button>
        <button
          onClick={onEdit}
          disabled={status === "approved"}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-700 dark:text-blue-300 text-xs font-medium rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Edit2 className="w-3.5 h-3.5" />
          Edit
        </button>
        <button
          onClick={onDelete}
          disabled={isDeleting || status === "approved"}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-700 dark:text-red-300 text-xs font-medium rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isDeleting ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Trash2 className="w-3.5 h-3.5" />
          )}
          Delete
        </button>
      </div>

      {/* Submit for Review Button */}
      {onSubmit && (
        <button
          onClick={onSubmit}
          disabled={isSubmitting}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-700 dark:text-green-300 text-xs font-medium rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <CheckCircle className="w-3.5 h-3.5" />
          )}
          Submit for Review
        </button>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: StatusType }) {
  const config = {
    draft: {
      label: "Draft",
      className: "bg-slate-500/20 text-slate-300 border-slate-500/30",
      icon: FileText,
    },
    pending: {
      label: "Pending",
      className: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
      icon: Clock,
    },
    approved: {
      label: "Approved",
      className: "bg-green-500/20 text-green-300 border-green-500/30",
      icon: CheckCircle,
    },
    rejected: {
      label: "Rejected",
      className: "bg-red-500/20 text-red-300 border-red-500/30",
      icon: XCircle,
    },
  };

  const { label, className, icon: Icon } = config[status];

  return (
    <div
      className={`flex items-center gap-1 px-2 py-1 border rounded-full text-xs font-medium ${className}`}
    >
      <Icon className="w-3 h-3" />
      {label}
    </div>
  );
}

function Pagination({
  currentPage,
  totalPages,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3 glass-panel border-t border-slate-200 dark:border-slate-700/50">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 0}
        className="px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-200 dark:bg-slate-700/30 hover:bg-slate-300 dark:hover:bg-slate-700/50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Previous
      </button>
      <span className="text-sm text-slate-600 dark:text-slate-400">
        Page {currentPage + 1} of {totalPages}
      </span>
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage >= totalPages - 1}
        className="px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-200 dark:bg-slate-700/30 hover:bg-slate-300 dark:hover:bg-slate-700/50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Next
      </button>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="p-4 space-y-3">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="glass-panel p-3 space-y-2 animate-pulse">
          <div className="h-5 bg-slate-700/50 rounded w-3/4" />
          <div className="h-4 bg-slate-700/30 rounded w-1/2" />
          <div className="flex gap-2">
            <div className="flex-1 h-8 bg-slate-700/30 rounded" />
            <div className="flex-1 h-8 bg-slate-700/30 rounded" />
            <div className="flex-1 h-8 bg-slate-700/30 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="p-4 flex flex-col items-center justify-center h-full text-center space-y-4">
      <XCircle className="w-12 h-12 text-red-400 dark:text-red-400" />
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Error Loading Data</h3>
        <p className="text-sm text-slate-600 dark:text-slate-400">{message}</p>
      </div>
      <button
        onClick={onRetry}
        className="px-4 py-2 bg-gold-500/20 hover:bg-gold-500/30 text-gold-700 dark:text-gold-300 rounded-lg transition-colors font-medium"
      >
        Retry
      </button>
    </div>
  );
}

function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="p-4 flex flex-col items-center justify-center h-full text-center space-y-4">
      <FileText className="w-12 h-12 text-slate-400 dark:text-slate-500" />
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h3>
        <p className="text-sm text-slate-600 dark:text-slate-400">{description}</p>
      </div>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="px-4 py-2 bg-gold-500/20 hover:bg-gold-500/30 text-gold-700 dark:text-gold-300 rounded-lg transition-colors font-medium"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

// ============================================================================
// Utility Functions
// ============================================================================

function formatNumber(num: number): string {
  return new Intl.NumberFormat("en-US").format(Math.round(num));
}
