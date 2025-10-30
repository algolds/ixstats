"use client";

import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import { toast } from "sonner";
import {
  RiShakeHandsLine,
  RiGlobalLine,
  RiEyeLine,
  RiShieldLine,
  RiSearchLine,
  RiFilterLine,
  RiCloseLine,
  RiArrowRightLine,
  RiInformationLine,
  RiMapPinLine,
  RiBuildingLine,
  RiCalendarLine,
  RiAddLine,
  RiStarLine,
  RiStarFill,
  RiTrophyLine,
  RiCoinLine,
  RiUploadLine,
  RiPlayLine,
  RiPauseLine,
  RiRefreshLine,
  RiTimeLine,
  RiUserLine,
  RiTeamLine,
  RiLockLine,
  RiSettings2Line,
  RiFireLine,
  RiBarChartLine,
} from "react-icons/ri";

interface DiplomaticRelation {
  id: string;
  countryId: string;
  countryName: string;
  relationType: "alliance" | "trade" | "neutral" | "tension";
  strength: number;
  recentActivity?: string;
  establishedAt: string;
  flagUrl?: string;
  economicTier?: string;
}

interface Embassy {
  id: string;
  targetCountryId: string;
  targetCountryName: string;
  level: number;
  experience: number;
  influence: number;
  budget: number;
  maintenanceCost: number;
  staffCount: number;
  location: string;
  ambassador: string;
  securityLevel: "LOW" | "MEDIUM" | "HIGH" | "MAXIMUM";
  status: "ACTIVE" | "MAINTENANCE" | "SUSPENDED" | "CLOSED";
  specializations: string[];
  establishedAt: string;
  lastMaintenance?: string;
  nextMaintenance?: string;
  availableMissions?: EmbassyMission[];
  availableUpgrades?: EmbassyUpgrade[];
}

interface EmbassyMission {
  id: string;
  type:
    | "TRADE_NEGOTIATION"
    | "CULTURAL_EXCHANGE"
    | "INTELLIGENCE_GATHERING"
    | "CRISIS_MANAGEMENT"
    | "ECONOMIC_COOPERATION";
  title: string;
  description: string;
  difficulty: "EASY" | "MEDIUM" | "HARD" | "EXPERT";
  duration: number;
  requiredLevel: number;
  experienceReward: number;
  influenceReward: number;
  budgetCost: number;
  successChance: number;
  status: "AVAILABLE" | "IN_PROGRESS" | "COMPLETED" | "FAILED";
  startedAt?: string;
  completedAt?: string;
}

interface EmbassyUpgrade {
  id: string;
  name: string;
  description: string;
  type: "SECURITY" | "STAFF" | "FACILITIES" | "TECHNOLOGY" | "SPECIALIZATION";
  cost: number;
  requiredLevel: number;
  effects: Record<string, number>;
  duration?: number;
  isActive: boolean;
  purchasedAt?: string;
}

interface EmbassyNetworkVisualizationProps {
  primaryCountry: {
    id: string;
    name: string;
    flagUrl?: string;
    economicTier?: string;
  };
  diplomaticRelations: DiplomaticRelation[];
  onRelationClick?: (relation: DiplomaticRelation) => void;
  onEstablishEmbassy?: (targetCountryId: string) => void;
  viewerClearanceLevel?: "PUBLIC" | "RESTRICTED" | "CONFIDENTIAL";
}

// Relation type configurations
const RELATION_TYPES = {
  alliance: {
    color: "text-green-400",
    bgColor: "bg-green-500/20",
    borderColor: "border-green-500/40",
    icon: RiShakeHandsLine,
    label: "Alliance",
    priority: 4,
  },
  trade: {
    color: "text-blue-400",
    bgColor: "bg-blue-500/20",
    borderColor: "border-blue-500/40",
    icon: RiGlobalLine,
    label: "Trade Partner",
    priority: 3,
  },
  neutral: {
    color: "text-gray-400",
    bgColor: "bg-gray-500/20",
    borderColor: "border-gray-500/40",
    icon: RiEyeLine,
    label: "Neutral",
    priority: 2,
  },
  tension: {
    color: "text-red-400",
    bgColor: "bg-red-500/20",
    borderColor: "border-red-500/40",
    icon: RiShieldLine,
    label: "Tension",
    priority: 1,
  },
} as const;

const EmbassyNetworkVisualizationComponent: React.FC<EmbassyNetworkVisualizationProps> = ({
  primaryCountry,
  diplomaticRelations: propRelations,
  onRelationClick,
  onEstablishEmbassy,
  viewerClearanceLevel = "PUBLIC",
}) => {
  const [selectedRelation, setSelectedRelation] = useState<DiplomaticRelation | null>(null);
  const [selectedEmbassy, setSelectedEmbassy] = useState<Embassy | null>(null);
  const [filterType, setFilterType] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"network" | "list" | "game">("network");
  const [showEmbassyDetails, setShowEmbassyDetails] = useState(false);
  const [showEstablishEmbassy, setShowEstablishEmbassy] = useState(false);
  const [showMissionsPanel, setShowMissionsPanel] = useState(false);
  const [showUpgradesPanel, setShowUpgradesPanel] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "missions" | "upgrades" | "economics">(
    "overview"
  );
  const networkContainerRef = useRef<HTMLDivElement>(null);
  const [selectedHostCountryId, setSelectedHostCountryId] = useState<string>("");
  const [newEmbassyName, setNewEmbassyName] = useState<string>("");
  const [newEmbassyLocation, setNewEmbassyLocation] = useState<string>("");
  const [newAmbassadorName, setNewAmbassadorName] = useState<string>("");
  const [embassyFormError, setEmbassyFormError] = useState<string | null>(null);

  // Fetch live diplomatic relationships
  const {
    data: liveRelations,
    isLoading,
    error,
  } = api.diplomatic.getRelationships.useQuery(
    { countryId: primaryCountry.id },
    { enabled: !!primaryCountry.id, refetchInterval: 30000 } // Refetch every 30 seconds
  );

  // Fetch embassy game data
  const { data: embassyData, isLoading: embassyLoading } =
    api.diplomatic.getEmbassyDetails.useQuery(
      { embassyId: primaryCountry.id },
      { enabled: !!primaryCountry.id && viewMode === "game", refetchInterval: 60000 }
    );

  // Fetch available missions
  const { data: availableMissions } = api.diplomatic.getAvailableMissions.useQuery(
    { embassyId: primaryCountry.id },
    { enabled: !!primaryCountry.id && viewMode === "game" }
  );

  // Fetch available upgrades
  const { data: availableUpgrades } = api.diplomatic.getAvailableUpgrades.useQuery(
    { embassyId: primaryCountry.id },
    { enabled: !!primaryCountry.id && viewMode === "game" }
  );

  const { data: embassyList, refetch: refetchEmbassyList } = api.diplomatic.getEmbassies.useQuery(
    { countryId: primaryCountry.id },
    { enabled: !!primaryCountry.id, refetchInterval: 60000 }
  );

  const { data: countryOptionsData, isLoading: countryOptionsLoading } =
    api.countries.getSelectList.useQuery();

  const hostCountryOptions = useMemo(
    () => (countryOptionsData ?? []).filter((country) => country.id !== primaryCountry.id),
    [countryOptionsData, primaryCountry.id]
  );

  const existingEmbassyHosts = useMemo(() => {
    if (!embassyList || embassyList.length === 0) return new Set<string>();
    return new Set(
      embassyList
        .filter(
          (embassy: any) => embassy.guestCountryId === primaryCountry.id || embassy.role === "guest"
        )
        .map((embassy: any) => embassy.hostCountryId)
        .filter((id: string | undefined): id is string => Boolean(id))
    );
  }, [embassyList, primaryCountry.id]);

  useEffect(() => {
    if (!showEstablishEmbassy || hostCountryOptions.length === 0) return;

    setEmbassyFormError(null);
    setSelectedHostCountryId((current) => {
      if (current && hostCountryOptions.some((option) => option.id === current)) {
        return current;
      }

      const preferred = selectedRelation?.countryId;
      const relationOption = preferred
        ? hostCountryOptions.find((option) => option.id === preferred)
        : undefined;

      const availableOption =
        relationOption && !existingEmbassyHosts.has(relationOption.id)
          ? relationOption
          : hostCountryOptions.find((option) => !existingEmbassyHosts.has(option.id)) ||
            hostCountryOptions[0];

      if (!availableOption) return "";

      setNewEmbassyName(`Embassy of ${primaryCountry.name} in ${availableOption.name}`);
      return availableOption.id;
    });
    setNewEmbassyLocation("");
    setNewAmbassadorName("");
  }, [
    showEstablishEmbassy,
    hostCountryOptions,
    existingEmbassyHosts,
    primaryCountry.name,
    selectedRelation,
  ]);

  // Game action mutations
  const establishEmbassyMutation = api.diplomatic.establishEmbassy.useMutation({
    onSuccess: (data) => {
      toast.success(`Embassy established`, {
        description: `Embassy now active in ${(data as any).hostCountryName || "the host nation"}.`,
      });
      setShowEstablishEmbassy(false);
      setSelectedHostCountryId("");
      setNewEmbassyName("");
      setNewEmbassyLocation("");
      setNewAmbassadorName("");
      setEmbassyFormError(null);
      void refetchEmbassyList();
      if (onEstablishEmbassy) {
        onEstablishEmbassy((data as any).hostCountryId || selectedHostCountryId);
      }
    },
    onError: (error) => {
      toast.error("Failed to establish embassy", {
        description: error.message,
      });
    },
  });

  const handleHostCountrySelect = useCallback(
    (value: string) => {
      setSelectedHostCountryId(value);
      const selected = hostCountryOptions.find((option) => option.id === value);
      setEmbassyFormError(null);
      if (selected) {
        setNewEmbassyName((current) => {
          if (!current || current.startsWith(`Embassy of ${primaryCountry.name} in `)) {
            return `Embassy of ${primaryCountry.name} in ${selected.name}`;
          }
          return current;
        });
      }
    },
    [hostCountryOptions, primaryCountry.name]
  );

  const handleEstablishEmbassySubmit = useCallback(() => {
    if (!selectedHostCountryId) {
      setEmbassyFormError("Please select a host country.");
      return;
    }

    const selected = hostCountryOptions.find((option) => option.id === selectedHostCountryId);
    const embassyName =
      newEmbassyName.trim() ||
      (selected ? `Embassy of ${primaryCountry.name} in ${selected.name}` : "");

    if (!embassyName) {
      setEmbassyFormError("Embassy name is required.");
      return;
    }

    setEmbassyFormError(null);

    establishEmbassyMutation.mutate({
      hostCountryId: selectedHostCountryId,
      guestCountryId: primaryCountry.id,
      name: embassyName,
      location: newEmbassyLocation.trim() || undefined,
      ambassadorName: newAmbassadorName.trim() || undefined,
    });
  }, [
    selectedHostCountryId,
    hostCountryOptions,
    newEmbassyName,
    newEmbassyLocation,
    newAmbassadorName,
    establishEmbassyMutation,
    primaryCountry.id,
    primaryCountry.name,
  ]);

  const startMissionMutation = api.diplomatic.startMission.useMutation({
    onSuccess: (data) => {
      toast.success(`Mission "${(data as any).name || "Mission"}" started!`, {
        description: `Expected completion in ${(data as any).duration || 0} hours.`,
      });
    },
    onError: (error) => {
      toast.error("Failed to start mission", {
        description: error.message,
      });
    },
  });

  const completeMissionMutation = api.diplomatic.completeMission.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success(`Mission completed successfully!`, {
          description: `Gained ${(data as any).rewards?.experience || 0} XP and ${(data as any).rewards?.influence || 0} influence.`,
        });
      } else {
        toast.warning(`Mission failed`, {
          description:
            (data as any).message || "The mission did not succeed, but experience was gained.",
        });
      }
    },
    onError: (error) => {
      toast.error("Error completing mission", {
        description: error.message,
      });
    },
  });

  const upgradeEmbassyMutation = api.diplomatic.upgradeEmbassy.useMutation({
    onSuccess: (data) => {
      toast.success(`Embassy upgraded!`, {
        description: `${(data as any).upgradeType || "Upgrade"} has been installed successfully.`,
      });
    },
    onError: (error) => {
      toast.error("Failed to upgrade embassy", {
        description: error.message,
      });
    },
  });

  const payMaintenanceMutation = api.diplomatic.payMaintenance.useMutation({
    onSuccess: (data) => {
      toast.success("Maintenance paid successfully!", {
        description: `Embassy maintenance paid successfully`,
      });
    },
    onError: (error) => {
      toast.error("Failed to pay maintenance", {
        description: error.message,
      });
    },
  });

  // Use live data if available, fallback to prop data
  const diplomaticRelations: DiplomaticRelation[] = useMemo(() => {
    if (liveRelations && liveRelations.length > 0) {
      return liveRelations.map(
        (relation: any): DiplomaticRelation => ({
          id: relation.id,
          countryId: relation.targetCountryId,
          countryName: relation.targetCountry,
          relationType: relation.relationship as "alliance" | "trade" | "neutral" | "tension",
          strength: relation.strength,
          recentActivity: relation.recentActivity,
          establishedAt: relation.establishedAt,
          flagUrl: relation.flagUrl,
          economicTier: relation.economicTier,
        })
      );
    }
    return propRelations;
  }, [liveRelations, propRelations]);

  // Transform embassy data
  const embassies = useMemo(() => {
    if (viewMode === "game" && embassyData) {
      return (embassyData as any).map((embassy: any) => ({
        id: embassy.id,
        targetCountryId: embassy.targetCountryId,
        targetCountryName: embassy.targetCountry || "Unknown",
        level: embassy.level || 1,
        experience: embassy.experience || 0,
        influence: embassy.influence || 0,
        budget: embassy.budget || 0,
        maintenanceCost: embassy.maintenanceCost || 1000,
        staffCount: embassy.staffCount || 10,
        location: embassy.location || "Diplomatic Quarter",
        ambassador: embassy.ambassador || "TBD",
        securityLevel: embassy.securityLevel as "LOW" | "MEDIUM" | "HIGH" | "MAXIMUM",
        status: embassy.status as "ACTIVE" | "MAINTENANCE" | "SUSPENDED" | "CLOSED",
        specializations: embassy.specializations || [],
        establishedAt: embassy.establishedAt,
        lastMaintenance: embassy.lastMaintenance,
        nextMaintenance: embassy.nextMaintenance,
        availableMissions: availableMissions?.filter((m: any) => m.embassyId === embassy.id) || [],
        availableUpgrades:
          availableUpgrades?.filter((u: any) => u && u.embassyId === embassy.id) || [],
      }));
    }

    if (embassyList && embassyList.length > 0) {
      return embassyList.map((embassy: any) => {
        const normalizedSecurity = (() => {
          const level = (embassy.securityLevel || "").toString().toUpperCase();
          if (level === "LOW" || level === "MEDIUM" || level === "HIGH" || level === "MAXIMUM") {
            return level as "LOW" | "MEDIUM" | "HIGH" | "MAXIMUM";
          }
          return "MEDIUM" as const;
        })();

        const normalizedStatus = (() => {
          const status = (embassy.status || "").toString().toUpperCase();
          if (
            status === "ACTIVE" ||
            status === "MAINTENANCE" ||
            status === "SUSPENDED" ||
            status === "CLOSED"
          ) {
            return status as "ACTIVE" | "MAINTENANCE" | "SUSPENDED" | "CLOSED";
          }
          return "ACTIVE" as const;
        })();

        return {
          id: embassy.id,
          targetCountryId: embassy.countryId,
          targetCountryName: embassy.country,
          level: embassy.level || 1,
          experience: embassy.experience || 0,
          influence: embassy.influence || 0,
          budget: embassy.budget || 0,
          maintenanceCost: embassy.maintenanceCost || 0,
          staffCount: embassy.staffCount || 0,
          location: embassy.location || "Diplomatic Quarter",
          ambassador: embassy.ambassadorName || "TBD",
          securityLevel: normalizedSecurity,
          status: normalizedStatus,
          specializations: embassy.specialization ? [embassy.specialization] : [],
          establishedAt: embassy.establishedAt,
          lastMaintenance: embassy.lastMaintenance,
          nextMaintenance: embassy.nextMaintenance,
          availableMissions: [],
          availableUpgrades: [],
        };
      });
    }

    return [];
  }, [embassyData, embassyList, viewMode, availableMissions, availableUpgrades]);

  // Filter and sort relations
  const filteredRelations = useMemo(() => {
    let filtered = diplomaticRelations;

    // Apply type filter
    if (filterType !== "all") {
      filtered = filtered.filter((relation) => relation.relationType === filterType);
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (relation) =>
          relation.countryName.toLowerCase().includes(query) ||
          relation.relationType.toLowerCase().includes(query)
      );
    }

    // Sort by priority and strength
    return filtered.sort((a, b) => {
      const aPriority = RELATION_TYPES[a.relationType]?.priority || 0;
      const bPriority = RELATION_TYPES[b.relationType]?.priority || 0;

      if (aPriority !== bPriority) {
        return bPriority - aPriority; // Higher priority first
      }

      return b.strength - a.strength; // Higher strength first
    });
  }, [diplomaticRelations, filterType, searchQuery]);

  // Calculate network positions for visualization
  const networkPositions = useMemo(() => {
    const positions: Array<{ relation: DiplomaticRelation; x: number; y: number; angle: number }> =
      [];
    const centerX = 200;
    const centerY = 200;
    const baseRadius = 120;

    filteredRelations.forEach((relation, index) => {
      // Calculate position based on relation type and strength
      const typeConfig = RELATION_TYPES[relation.relationType] || { priority: 0 };
      const radius = baseRadius + ((relation.strength || 0) / 100) * 40; // Stronger relations further out
      const angleStep = filteredRelations.length > 0 ? (Math.PI * 2) / filteredRelations.length : 0;
      const angle = angleStep * index - Math.PI / 2; // Start from top

      // Add some variation based on relation type
      const typeOffset = (typeConfig?.priority || 0) * 10;
      const finalRadius = radius + Math.sin(angle * 3) * typeOffset;

      // Ensure coordinates are valid numbers
      const x =
        isFinite(finalRadius) && isFinite(angle)
          ? centerX + Math.cos(angle) * finalRadius
          : centerX;
      const y =
        isFinite(finalRadius) && isFinite(angle)
          ? centerY + Math.sin(angle) * finalRadius
          : centerY;

      positions.push({ relation: relation as DiplomaticRelation, x, y, angle });
    });

    return positions;
  }, [filteredRelations]);

  const handleRelationClick = useCallback(
    (relation: DiplomaticRelation) => {
      setSelectedRelation(relation);
      onRelationClick?.(relation);
    },
    [onRelationClick]
  );

  return (
    <div className="embassy-network-visualization space-y-6">
      {/* Header and Controls */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="flex items-center gap-3 text-xl font-bold text-[--intel-gold]">
            <RiBuildingLine className="h-6 w-6" />
            Embassy Network
            <span className="ml-2 text-sm font-normal text-[--intel-silver]">
              ({filteredRelations.length} active relations)
            </span>
            {isLoading && (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-[--intel-gold]/20 border-t-[--intel-gold]" />
            )}
          </h3>
          <p className="mt-1 text-sm text-[--intel-silver]">
            Interactive diplomatic relationship visualization for {primaryCountry.name}
            {error && <span className="ml-2 text-red-400">(Using fallback data)</span>}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 rounded-lg bg-white/5 p-1">
            <button
              onClick={() => setViewMode("network")}
              className={cn(
                "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                viewMode === "network"
                  ? "bg-[--intel-gold]/20 text-[--intel-gold]"
                  : "hover:text-foreground text-[--intel-silver]"
              )}
            >
              Network
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={cn(
                "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                viewMode === "list"
                  ? "bg-[--intel-gold]/20 text-[--intel-gold]"
                  : "hover:text-foreground text-[--intel-silver]"
              )}
            >
              List
            </button>
            {viewerClearanceLevel !== "PUBLIC" && (
              <button
                onClick={() => setViewMode("game")}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  viewMode === "game"
                    ? "bg-[--intel-gold]/20 text-[--intel-gold]"
                    : "hover:text-foreground text-[--intel-silver]"
                )}
              >
                <RiTrophyLine className="h-4 w-4" />
                Game
                {embassyLoading && (
                  <div className="h-3 w-3 animate-spin rounded-full border border-[--intel-gold]/20 border-t-[--intel-gold]" />
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Search and Filter Controls */}
      <div className="flex items-center gap-4 rounded-lg border border-[--intel-gold]/20 bg-white/5 p-4">
        <div className="relative flex-1">
          <RiSearchLine className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[--intel-silver]" />
          <input
            type="text"
            placeholder="Search diplomatic relations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="text-foreground w-full rounded-lg border border-white/20 bg-white/10 py-2 pr-4 pl-10 placeholder:text-[--intel-silver] focus:border-[--intel-gold]/50 focus:outline-none dark:bg-black/20"
          />
        </div>

        <div className="flex items-center gap-2">
          <RiFilterLine className="h-4 w-4 text-[--intel-silver]" />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="text-foreground rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm focus:border-[--intel-gold]/50 focus:outline-none dark:bg-black/20"
          >
            <option value="all">All Relations</option>
            <option value="alliance">Alliances</option>
            <option value="trade">Trade Partners</option>
            <option value="neutral">Neutral</option>
            <option value="tension">Tensions</option>
          </select>
        </div>
      </div>

      {/* Main Visualization Area */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Main View Area */}
        <div className={cn(viewMode === "game" ? "col-span-full" : "xl:col-span-2")}>
          <div
            className="glass-hierarchy-child rounded-lg p-6"
            style={{ minHeight: viewMode === "game" ? "600px" : "500px" }}
          >
            {viewMode === "game" ? (
              /* Embassy Game Management View */
              <div className="space-y-6">
                {/* Game Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <h4 className="flex items-center gap-2 text-xl font-bold text-[--intel-gold]">
                      <RiTrophyLine className="h-6 w-6" />
                      Embassy Management System
                    </h4>
                    {embassyLoading && (
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-[--intel-gold]/20 border-t-[--intel-gold]" />
                    )}
                  </div>

                  {/* Game Stats */}
                  <div className="flex items-center gap-6 text-sm">
                    <div className="flex items-center gap-2">
                      <RiBuildingLine className="h-4 w-4 text-[--intel-gold]" />
                      <span className="text-foreground font-medium">{embassies.length}</span>
                      <span className="text-[--intel-silver]">Embassies</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <RiCoinLine className="h-4 w-4 text-yellow-400" />
                      <span className="text-foreground font-medium">
                        {embassies
                          .reduce((sum: number, e: Embassy) => sum + e.budget, 0)
                          .toLocaleString()}
                      </span>
                      <span className="text-[--intel-silver]">Budget</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <RiBarChartLine className="h-4 w-4 text-blue-400" />
                      <span className="text-foreground font-medium">
                        {embassies
                          .reduce((sum: number, e: Embassy) => sum + e.influence, 0)
                          .toLocaleString()}
                      </span>
                      <span className="text-[--intel-silver]">Influence</span>
                    </div>
                  </div>
                </div>

                {/* Game Tabs */}
                <div className="flex w-fit items-center gap-1 rounded-lg bg-white/5 p-1">
                  {[
                    { id: "overview", label: "Overview", icon: RiEyeLine },
                    { id: "missions", label: "Missions", icon: RiPlayLine },
                    { id: "upgrades", label: "Upgrades", icon: RiUploadLine },
                    { id: "economics", label: "Economics", icon: RiCoinLine },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as typeof activeTab)}
                      className={cn(
                        "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                        activeTab === tab.id
                          ? "bg-[--intel-gold]/20 text-[--intel-gold]"
                          : "hover:text-foreground text-[--intel-silver]"
                      )}
                    >
                      <tab.icon className="h-4 w-4" />
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Game Content */}
                {activeTab === "overview" && (
                  <div className="space-y-6">
                    {embassies.length === 0 ? (
                      <div className="py-12 text-center">
                        <RiBuildingLine className="mx-auto mb-4 h-16 w-16 text-[--intel-silver] opacity-50" />
                        <h3 className="text-foreground mb-2 text-lg font-semibold">
                          No Embassies Yet
                        </h3>
                        <p className="mb-6 text-[--intel-silver]">
                          Establish your first embassy to begin diplomatic expansion
                        </p>
                        <button
                          onClick={() => setShowEstablishEmbassy(true)}
                          className="inline-flex items-center gap-2 rounded-lg bg-[--intel-gold]/20 px-6 py-3 font-medium text-[--intel-gold] transition-colors hover:bg-[--intel-gold]/30"
                        >
                          <RiAddLine className="h-5 w-5" />
                          Establish First Embassy
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                        {embassies.map((embassy: Embassy) => (
                          <EmbassyGameCard
                            key={embassy.id}
                            embassy={embassy}
                            onSelect={setSelectedEmbassy}
                            onStartMission={(missionId: string) => {
                              startMissionMutation.mutate({
                                missionType: "trade_negotiation",
                                staffAssigned: 1,
                              } as any);
                            }}
                            onUpgrade={(upgradeId: string) => {
                              upgradeEmbassyMutation.mutate({
                                upgradeType: "staff_expansion",
                                level: 1,
                              } as any);
                            }}
                          />
                        ))}

                        {/* Add New Embassy Card */}
                        <div
                          onClick={() => setShowEstablishEmbassy(true)}
                          className="glass-hierarchy-interactive group cursor-pointer rounded-lg border-2 border-dashed border-[--intel-gold]/30 p-6 transition-colors hover:border-[--intel-gold]/50"
                        >
                          <div className="py-8 text-center">
                            <RiAddLine className="mx-auto mb-4 h-12 w-12 text-[--intel-gold] transition-transform group-hover:scale-110" />
                            <h4 className="mb-2 font-semibold text-[--intel-gold]">
                              Establish Embassy
                            </h4>
                            <p className="text-sm text-[--intel-silver]">
                              Expand your diplomatic network
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "missions" && (
                  <MissionsPanel
                    embassies={embassies}
                    onStartMission={(embassyId: string, missionId: string) => {
                      startMissionMutation.mutate({
                        missionType: "trade_negotiation",
                        staffAssigned: 1,
                      } as any);
                    }}
                    onCompleteMission={(embassyId: string, missionId: string) => {
                      completeMissionMutation.mutate({ missionId });
                    }}
                  />
                )}

                {activeTab === "upgrades" && (
                  <UpgradesPanel
                    embassies={embassies}
                    onUpgrade={(embassyId: string, upgradeId: string) => {
                      upgradeEmbassyMutation.mutate({
                        upgradeType: "staff_expansion",
                        level: 1,
                      } as any);
                    }}
                  />
                )}

                {activeTab === "economics" && (
                  <EconomicsPanel
                    embassies={embassies}
                    onPayMaintenance={(embassyId) => {
                      payMaintenanceMutation.mutate({ embassyId });
                    }}
                  />
                )}
              </div>
            ) : viewMode === "network" ? (
              /* Network Visualization */
              <div className="relative h-[400px] w-full overflow-hidden">
                <svg width="400" height="400" className="h-full w-full" viewBox="0 0 400 400">
                  {/* Connection Lines */}
                  {networkPositions.map(({ relation, x, y }) => (
                    <line
                      key={`line-${relation.id}`}
                      x1="200"
                      y1="200"
                      x2={isNaN(x) ? 200 : x}
                      y2={isNaN(y) ? 200 : y}
                      stroke={`rgba(212, 175, 55, ${0.2 + ((relation.strength || 0) / 100) * 0.3})`}
                      strokeWidth={1 + ((relation.strength || 0) / 100) * 2}
                      strokeDasharray={relation.relationType === "tension" ? "5,5" : "none"}
                      className="transition-all duration-300"
                    />
                  ))}

                  {/* Central Country Node */}
                  <circle
                    cx="200"
                    cy="200"
                    r="30"
                    fill="rgba(212, 175, 55, 0.3)"
                    stroke="rgba(212, 175, 55, 0.8)"
                    strokeWidth="2"
                    className="cursor-pointer"
                  />
                  <text
                    x="200"
                    y="205"
                    textAnchor="middle"
                    fontSize="12"
                    fill="white"
                    className="pointer-events-none font-semibold"
                  >
                    {primaryCountry.name.length > 10
                      ? primaryCountry.name.substring(0, 8) + "..."
                      : primaryCountry.name}
                  </text>

                  {/* Relation Nodes */}
                  {networkPositions.map(({ relation, x, y }) => {
                    const typeConfig = RELATION_TYPES[relation.relationType] || { priority: 0 };
                    const isSelected = selectedRelation?.id === relation.id;

                    return (
                      <g key={relation.id}>
                        <circle
                          cx={isNaN(x) ? 200 : x}
                          cy={isNaN(y) ? 200 : y}
                          r={isSelected ? 25 : 15 + ((relation.strength || 0) / 100) * 5}
                          fill={(typeConfig.bgColor || "bg-white/20")
                            .replace("bg-", "rgba(")
                            .replace("/20", ", 0.2)")}
                          stroke={(typeConfig.color || "text-white")
                            .replace("text-", "rgba(")
                            .replace("400", "400, 1)")}
                          strokeWidth={isSelected ? 3 : 2}
                          className="cursor-pointer transition-all duration-300 hover:opacity-80"
                          onClick={() => handleRelationClick(relation as DiplomaticRelation)}
                        />
                        <text
                          x={isNaN(x) ? 200 : x}
                          y={(isNaN(y) ? 200 : y) + 4}
                          textAnchor="middle"
                          fontSize={isSelected ? "11" : "9"}
                          fill="white"
                          className="pointer-events-none font-medium"
                        >
                          {relation.countryName.length > 8
                            ? relation.countryName.substring(0, 6) + ".."
                            : relation.countryName}
                        </text>
                      </g>
                    );
                  })}
                </svg>

                {/* Network Legend */}
                <div className="absolute bottom-4 left-4 rounded-lg bg-black/60 p-3 backdrop-blur-sm">
                  <h4 className="text-foreground mb-2 text-sm font-semibold">Relations</h4>
                  <div className="space-y-1">
                    {Object.entries(RELATION_TYPES).map(([type, config]) => (
                      <div key={type} className="flex items-center gap-2 text-xs">
                        <div
                          className={cn(
                            "h-3 w-3 rounded-full",
                            config.bgColor,
                            config.borderColor,
                            "border"
                          )}
                        />
                        <span className="text-foreground">{config.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              /* List View */
              <div className="space-y-3">
                {filteredRelations.map((relation, index) => {
                  const typeConfig = RELATION_TYPES[relation.relationType] || { priority: 0 };
                  const Icon = typeConfig.icon || RiGlobalLine;

                  return (
                    <motion.div
                      key={relation.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      onClick={() => handleRelationClick(relation as DiplomaticRelation)}
                      className={cn(
                        "flex cursor-pointer items-center justify-between rounded-lg border p-4 transition-all",
                        "border-white/10 bg-white/5 hover:border-[--intel-gold]/30 hover:bg-white/10",
                        selectedRelation?.id === relation.id &&
                          "border-[--intel-gold]/50 bg-[--intel-gold]/10"
                      )}
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={cn(
                            "flex h-10 w-10 items-center justify-center rounded-full",
                            typeConfig.bgColor || "bg-white/20",
                            typeConfig.borderColor || "border-white/20",
                            "border"
                          )}
                        >
                          <Icon className={cn("h-5 w-5", typeConfig.color || "text-white")} />
                        </div>

                        <div>
                          <div className="text-foreground font-semibold">
                            {relation.countryName}
                          </div>
                          <div className="flex items-center gap-3 text-sm text-[--intel-silver]">
                            <span className={cn("capitalize", typeConfig.color || "text-white")}>
                              {typeConfig.label || relation.relationType}
                            </span>
                            <span>•</span>
                            <span>Strength: {relation.strength || 0}%</span>
                            {relation.economicTier && (
                              <>
                                <span>•</span>
                                <span>{relation.economicTier}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-sm text-[--intel-silver]">
                          Est. {new Date(relation.establishedAt).getFullYear()}
                        </div>
                        {relation.recentActivity && (
                          <div className="mt-1 text-xs text-[--intel-amber]">Recent Activity</div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}

                {filteredRelations.length === 0 && (
                  <div className="py-12 text-center text-[--intel-silver]">
                    <RiSearchLine className="mx-auto mb-4 h-12 w-12 opacity-50" />
                    <p className="text-lg">No diplomatic relations found</p>
                    <p className="mb-4 text-sm">Try adjusting your search or filter criteria</p>
                    {viewerClearanceLevel !== "PUBLIC" && onEstablishEmbassy && (
                      <button
                        onClick={() => setShowEstablishEmbassy(true)}
                        className="inline-flex items-center gap-2 rounded-lg bg-[--intel-gold]/20 px-4 py-2 font-medium text-[--intel-gold] transition-colors hover:bg-[--intel-gold]/30"
                      >
                        <RiBuildingLine className="h-4 w-4" />
                        Establish Embassy
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Relation Details Panel - Hidden in game mode */}
        {viewMode !== "game" && (
          <div className="xl:col-span-1">
            <div className="glass-hierarchy-child sticky top-6 rounded-lg p-6">
              {selectedRelation ? (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h4 className="text-foreground text-lg font-bold">Diplomatic Relation</h4>
                    <button
                      onClick={() => setSelectedRelation(null)}
                      className="hover:text-foreground rounded-lg p-2 text-[--intel-silver] transition-colors hover:bg-black/10 dark:hover:bg-white/10"
                    >
                      <RiCloseLine className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Country Info */}
                  <div className="flex items-center gap-4">
                    {selectedRelation.flagUrl && (
                      <img
                        src={selectedRelation.flagUrl}
                        alt={`${selectedRelation.countryName} flag`}
                        className="h-8 w-12 rounded border border-white/20 object-cover"
                      />
                    )}
                    <div>
                      <h5 className="text-foreground text-xl font-bold">
                        {selectedRelation.countryName}
                      </h5>
                      {selectedRelation.economicTier && (
                        <p className="text-sm text-[--intel-silver]">
                          {selectedRelation.economicTier}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Relation Details */}
                  <div className="space-y-4">
                    <div>
                      <div className="mb-2 flex items-center gap-2">
                        {React.createElement(
                          RELATION_TYPES[selectedRelation.relationType]?.icon || RiGlobalLine,
                          {
                            className: cn(
                              "h-5 w-5",
                              RELATION_TYPES[selectedRelation.relationType]?.color || "text-white"
                            ),
                          }
                        )}
                        <span className="text-foreground font-medium">
                          {RELATION_TYPES[selectedRelation.relationType]?.label ||
                            selectedRelation.relationType}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-2 flex-1 rounded-full bg-white/10">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all duration-300",
                              RELATION_TYPES[selectedRelation.relationType]?.bgColor ||
                                "bg-white/20"
                            )}
                            style={{ width: `${selectedRelation.strength}%` }}
                          />
                        </div>
                        <span className="min-w-[3rem] text-sm text-[--intel-silver]">
                          {selectedRelation.strength}%
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-[--intel-silver]">
                      <RiCalendarLine className="h-4 w-4" />
                      <span>
                        Established: {new Date(selectedRelation.establishedAt).toLocaleDateString()}
                      </span>
                    </div>

                    {selectedRelation.recentActivity && (
                      <div className="rounded-lg border border-[--intel-amber]/20 bg-[--intel-amber]/10 p-3">
                        <div className="flex items-start gap-2">
                          <RiInformationLine className="mt-0.5 h-4 w-4 flex-shrink-0 text-[--intel-amber]" />
                          <div>
                            <p className="text-sm font-medium text-[--intel-amber]">
                              Recent Activity
                            </p>
                            <p className="text-foreground mt-1 text-sm">
                              {selectedRelation.recentActivity}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="space-y-3 border-t border-white/10 pt-4">
                    <button
                      onClick={() => onRelationClick?.(selectedRelation)}
                      className="flex w-full items-center justify-center gap-2 rounded-lg bg-[--intel-gold]/20 px-4 py-3 font-medium text-[--intel-gold] transition-colors hover:bg-[--intel-gold]/30"
                    >
                      <RiArrowRightLine className="h-4 w-4" />
                      View Country Profile
                    </button>

                    {viewerClearanceLevel !== "PUBLIC" && (
                      <button
                        onClick={() => setShowEmbassyDetails(true)}
                        className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-500/20 px-4 py-3 font-medium text-blue-400 transition-colors hover:bg-blue-500/30"
                      >
                        <RiMapPinLine className="h-4 w-4" />
                        View Embassy Details
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="py-12 text-center text-[--intel-silver]">
                  <RiBuildingLine className="mx-auto mb-4 h-12 w-12 opacity-50" />
                  <p className="text-lg">Select a diplomatic relation</p>
                  <p className="text-sm">
                    Click on a country node or list item to view detailed information
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Embassy Details Modal */}
      <AnimatePresence>
        {showEmbassyDetails && selectedRelation && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
            onClick={() => setShowEmbassyDetails(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass-hierarchy-modal max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-lg"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="glass-hierarchy-child rounded-t-lg border-b border-[--intel-gold]/20 p-4">
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-xl font-bold text-[--intel-gold]">
                    <RiBuildingLine className="h-6 w-6" />
                    Embassy Details - {selectedRelation.countryName}
                  </h3>
                  <button
                    onClick={() => setShowEmbassyDetails(false)}
                    className="hover:text-foreground rounded-lg p-2 text-[--intel-silver] transition-colors hover:bg-black/10 dark:hover:bg-white/10"
                  >
                    <RiCloseLine className="h-5 w-5" />
                  </button>
                </div>
                <p className="mt-2 text-sm text-[--intel-silver]">
                  Comprehensive embassy operations and diplomatic status
                </p>
              </div>

              <div className="space-y-6 p-6">
                {/* Embassy Operations */}
                <div className="glass-hierarchy-child rounded-lg p-6">
                  <h4 className="text-foreground mb-4 font-semibold">Embassy Operations</h4>

                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div className="space-y-4">
                      <div>
                        <h5 className="text-foreground mb-2 font-medium">Embassy Status</h5>
                        <div className="rounded-lg bg-green-500/10 px-3 py-2 text-sm text-green-400">
                          Active - Full Operations
                        </div>
                      </div>

                      <div>
                        <h5 className="text-foreground mb-2 font-medium">Location</h5>
                        <p className="text-muted-foreground text-sm">
                          Diplomatic Quarter, Capital City
                        </p>
                      </div>

                      <div>
                        <h5 className="text-foreground mb-2 font-medium">Ambassador</h5>
                        <p className="text-muted-foreground text-sm">Ambassador Sarah Chen</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <h5 className="text-foreground mb-2 font-medium">Established</h5>
                        <p className="text-muted-foreground text-sm">
                          {new Date(
                            selectedRelation.establishedAt || Date.now()
                          ).toLocaleDateString()}
                        </p>
                      </div>

                      <div>
                        <h5 className="text-foreground mb-2 font-medium">Staff Count</h5>
                        <p className="text-muted-foreground text-sm">24 diplomatic personnel</p>
                      </div>

                      <div>
                        <h5 className="text-foreground mb-2 font-medium">Security Level</h5>
                        <div className="rounded-lg bg-blue-500/10 px-3 py-2 text-sm text-blue-400">
                          Standard Security Protocol
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Embassy Services */}
                <div className="glass-hierarchy-child rounded-lg p-6">
                  <h4 className="text-foreground mb-4 font-semibold">Embassy Services</h4>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                    {[
                      "Visa Processing",
                      "Trade Support",
                      "Consular Services",
                      "Cultural Exchange",
                      "Business Relations",
                      "Emergency Assistance",
                    ].map((service) => (
                      <div key={service} className="flex items-center gap-2 text-sm">
                        <div className="h-2 w-2 rounded-full bg-[--intel-gold]" />
                        <span className="text-muted-foreground">{service}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recent Diplomatic Activity */}
                <div className="glass-hierarchy-child rounded-lg p-6">
                  <h4 className="text-foreground mb-4 font-semibold">Recent Activity</h4>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3 rounded-lg bg-white/5 p-3 dark:bg-black/20">
                      <div className="mt-2 h-2 w-2 rounded-full bg-green-400" />
                      <div>
                        <p className="text-foreground text-sm font-medium">
                          Trade Agreement Renewal
                        </p>
                        <p className="text-muted-foreground mt-1 text-xs">3 days ago</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 rounded-lg bg-white/5 p-3 dark:bg-black/20">
                      <div className="mt-2 h-2 w-2 rounded-full bg-blue-400" />
                      <div>
                        <p className="text-foreground text-sm font-medium">
                          Cultural Exchange Program Planning
                        </p>
                        <p className="text-muted-foreground mt-1 text-xs">1 week ago</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Establish Embassy Modal */}
      <AnimatePresence>
        {showEstablishEmbassy && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
            onClick={() => setShowEstablishEmbassy(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass-hierarchy-modal w-full max-w-lg rounded-lg"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="glass-hierarchy-child rounded-t-lg border-b border-[--intel-gold]/20 p-4">
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-xl font-bold text-[--intel-gold]">
                    <RiAddLine className="h-6 w-6" />
                    Establish Embassy
                  </h3>
                  <button
                    onClick={() => setShowEstablishEmbassy(false)}
                    className="hover:text-foreground rounded-lg p-2 text-[--intel-silver] transition-colors hover:bg-black/10 dark:hover:bg-white/10"
                  >
                    <RiCloseLine className="h-5 w-5" />
                  </button>
                </div>
                <p className="mt-2 text-sm text-[--intel-silver]">
                  Create a new diplomatic post to strengthen international relations
                </p>
              </div>

              <div className="p-6">
                <div className="glass-hierarchy-child space-y-4 rounded-lg p-6">
                  <h4 className="text-foreground mb-4 font-semibold">Embassy Details</h4>

                  <div>
                    <label className="text-foreground mb-2 block text-sm font-medium">
                      Host Country
                    </label>
                    <select
                      className="text-foreground w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 dark:bg-black/20"
                      value={selectedHostCountryId}
                      onChange={(event) => handleHostCountrySelect(event.target.value)}
                      disabled={countryOptionsLoading || hostCountryOptions.length === 0}
                    >
                      <option value="">
                        {countryOptionsLoading ? "Loading countries..." : "Select a country..."}
                      </option>
                      {hostCountryOptions.map((option) => (
                        <option
                          key={option.id}
                          value={option.id}
                          disabled={existingEmbassyHosts.has(option.id)}
                        >
                          {option.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-foreground mb-2 block text-sm font-medium">
                      Embassy Name
                    </label>
                    <input
                      type="text"
                      value={newEmbassyName}
                      onChange={(event) => setNewEmbassyName(event.target.value)}
                      placeholder={`Embassy of ${primaryCountry.name}`}
                      className="text-foreground placeholder:text-muted-foreground w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 dark:bg-black/20"
                    />
                  </div>

                  <div>
                    <label className="text-foreground mb-2 block text-sm font-medium">
                      Embassy Location
                    </label>
                    <input
                      type="text"
                      value={newEmbassyLocation}
                      onChange={(event) => setNewEmbassyLocation(event.target.value)}
                      placeholder="e.g., Diplomatic Quarter, Capital City"
                      className="text-foreground placeholder:text-muted-foreground w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 dark:bg-black/20"
                    />
                  </div>

                  <div>
                    <label className="text-foreground mb-2 block text-sm font-medium">
                      Ambassador Name
                    </label>
                    <input
                      type="text"
                      value={newAmbassadorName}
                      onChange={(event) => setNewAmbassadorName(event.target.value)}
                      placeholder="e.g., Ambassador John Smith"
                      className="text-foreground placeholder:text-muted-foreground w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 dark:bg-black/20"
                    />
                  </div>

                  {embassyFormError && <p className="text-sm text-red-500">{embassyFormError}</p>}
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setShowEstablishEmbassy(false)}
                    className="text-muted-foreground hover:text-foreground flex-1 px-4 py-2 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleEstablishEmbassySubmit}
                    disabled={establishEmbassyMutation.isPending || hostCountryOptions.length === 0}
                    className={cn(
                      "flex-1 rounded-lg bg-[--intel-gold]/20 px-4 py-2 font-medium text-[--intel-gold] transition-colors hover:bg-[--intel-gold]/30",
                      (establishEmbassyMutation.isPending || hostCountryOptions.length === 0) &&
                        "cursor-not-allowed opacity-60"
                    )}
                  >
                    {establishEmbassyMutation.isPending ? "Establishing..." : "Establish Embassy"}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Embassy Game Components
const EmbassyGameCard: React.FC<{
  embassy: Embassy;
  onSelect: (embassy: Embassy) => void;
  onStartMission: (missionId: string) => void;
  onUpgrade: (upgradeId: string) => void;
}> = ({ embassy, onSelect, onStartMission, onUpgrade }) => {
  const levelProgress = (embassy.experience % 1000) / 1000; // Each level = 1000 XP
  const statusColor = {
    ACTIVE: "text-green-400",
    MAINTENANCE: "text-yellow-400",
    SUSPENDED: "text-red-400",
    CLOSED: "text-gray-400",
  }[embassy.status];

  const securityColor = {
    LOW: "text-gray-400",
    MEDIUM: "text-yellow-400",
    HIGH: "text-orange-400",
    MAXIMUM: "text-red-400",
  }[embassy.securityLevel];

  return (
    <div
      onClick={() => onSelect(embassy)}
      className="glass-hierarchy-interactive group cursor-pointer rounded-lg p-4 transition-all duration-200 hover:scale-[1.02]"
    >
      {/* Header */}
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h4 className="text-foreground text-lg font-bold">{embassy.targetCountryName}</h4>
          <p className="text-sm text-[--intel-silver]">{embassy.location}</p>
        </div>
        <div className="text-right">
          <div className="mb-1 flex items-center gap-1">
            {[...Array(5)].map((_, i) => (
              <RiStarFill
                key={i}
                className={cn(
                  "h-3 w-3",
                  i < embassy.level ? "text-[--intel-gold]" : "text-gray-600"
                )}
              />
            ))}
            <span className="ml-1 text-sm text-[--intel-gold]">L{embassy.level}</span>
          </div>
          <div className={cn("text-xs", statusColor)}>{embassy.status}</div>
        </div>
      </div>

      {/* Stats */}
      <div className="mb-4 grid grid-cols-3 gap-3">
        <div className="text-center">
          <div className="text-sm font-bold text-blue-400">
            {embassy.influence.toLocaleString()}
          </div>
          <div className="text-xs text-[--intel-silver]">Influence</div>
        </div>
        <div className="text-center">
          <div className="text-sm font-bold text-yellow-400">
            ₫{embassy.budget.toLocaleString()}
          </div>
          <div className="text-xs text-[--intel-silver]">Budget</div>
        </div>
        <div className="text-center">
          <div className="text-sm font-bold text-[--intel-silver]">{embassy.staffCount}</div>
          <div className="text-xs text-[--intel-silver]">Staff</div>
        </div>
      </div>

      {/* Level Progress */}
      <div className="mb-4">
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="text-[--intel-silver]">Level {embassy.level} Progress</span>
          <span className="text-[--intel-gold]">{embassy.experience} XP</span>
        </div>
        <div className="h-2 w-full rounded-full bg-white/10">
          <div
            className="h-2 rounded-full bg-[--intel-gold] transition-all duration-300"
            style={{ width: `${levelProgress * 100}%` }}
          />
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <RiLockLine className={cn("h-3 w-3", securityColor)} />
          <span className="text-[--intel-silver]">{embassy.securityLevel}</span>
        </div>

        {embassy.availableMissions && embassy.availableMissions.length > 0 && (
          <div className="flex items-center gap-1 text-green-400">
            <RiPlayLine className="h-3 w-3" />
            <span>{embassy.availableMissions.length} missions</span>
          </div>
        )}

        {embassy.availableUpgrades && embassy.availableUpgrades.length > 0 && (
          <div className="flex items-center gap-1 text-blue-400">
            <RiUploadLine className="h-3 w-3" />
            <span>{embassy.availableUpgrades.length} upgrades</span>
          </div>
        )}
      </div>
    </div>
  );
};

const MissionsPanel: React.FC<{
  embassies: Embassy[];
  onStartMission: (embassyId: string, missionId: string) => void;
  onCompleteMission: (embassyId: string, missionId: string) => void;
}> = ({ embassies, onStartMission, onCompleteMission }) => {
  const [selectedMissionType, setSelectedMissionType] = useState<string>("all");
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>("all");
  const allMissions = embassies.flatMap((embassy) =>
    (embassy.availableMissions || []).map((mission) => ({
      ...mission,
      embassyId: embassy.id,
      embassyName: embassy.targetCountryName,
      embassyLevel: embassy.level,
      progress: mission.status === "IN_PROGRESS" ? calculateMissionProgress(mission) : 0,
      timeRemaining:
        mission.status === "IN_PROGRESS" && mission.startedAt
          ? calculateTimeRemaining(mission.startedAt, mission.duration)
          : null,
    }))
  );

  // Filter missions
  const filteredMissions = allMissions.filter((mission) => {
    if (selectedMissionType !== "all" && mission.type !== selectedMissionType) return false;
    if (selectedDifficulty !== "all" && mission.difficulty !== selectedDifficulty) return false;
    return true;
  });

  // Group missions by status
  const missionsByStatus = {
    available: filteredMissions.filter((m) => m.status === "AVAILABLE"),
    inProgress: filteredMissions.filter((m) => m.status === "IN_PROGRESS"),
    completed: filteredMissions.filter((m) => m.status === "COMPLETED"),
    failed: filteredMissions.filter((m) => m.status === "FAILED"),
  };

  const difficultyColor = {
    EASY: "text-green-400",
    MEDIUM: "text-yellow-400",
    HARD: "text-orange-400",
    EXPERT: "text-red-400",
  };

  const missionTypeColor = {
    TRADE_NEGOTIATION: "text-yellow-400",
    CULTURAL_EXCHANGE: "text-purple-400",
    INTELLIGENCE_GATHERING: "text-red-400",
    CRISIS_MANAGEMENT: "text-orange-400",
    ECONOMIC_COOPERATION: "text-green-400",
  };

  return (
    <div className="space-y-6">
      {/* Mission Filters and Stats */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <select
            value={selectedMissionType}
            onChange={(e) => setSelectedMissionType(e.target.value)}
            className="text-foreground rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm dark:bg-black/20"
          >
            <option value="all">All Types</option>
            <option value="TRADE_NEGOTIATION">Trade Negotiation</option>
            <option value="CULTURAL_EXCHANGE">Cultural Exchange</option>
            <option value="INTELLIGENCE_GATHERING">Intelligence Gathering</option>
            <option value="CRISIS_MANAGEMENT">Crisis Management</option>
            <option value="ECONOMIC_COOPERATION">Economic Cooperation</option>
          </select>

          <select
            value={selectedDifficulty}
            onChange={(e) => setSelectedDifficulty(e.target.value)}
            className="text-foreground rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm dark:bg-black/20"
          >
            <option value="all">All Difficulties</option>
            <option value="EASY">Easy</option>
            <option value="MEDIUM">Medium</option>
            <option value="HARD">Hard</option>
            <option value="EXPERT">Expert</option>
          </select>
        </div>

        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-green-400" />
            <span className="text-[--intel-silver]">
              Available: {missionsByStatus.available.length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-blue-400" />
            <span className="text-[--intel-silver]">
              Active: {missionsByStatus.inProgress.length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-[--intel-gold]" />
            <span className="text-[--intel-silver]">
              Completed: {missionsByStatus.completed.length}
            </span>
          </div>
        </div>
      </div>

      {/* Mission Tabs */}
      <div className="flex w-fit items-center gap-1 rounded-lg bg-white/5 p-1">
        {[
          {
            id: "available",
            label: `Available (${missionsByStatus.available.length})`,
            icon: RiPlayLine,
          },
          {
            id: "active",
            label: `Active (${missionsByStatus.inProgress.length})`,
            icon: RiTimeLine,
          },
          {
            id: "completed",
            label: `Completed (${missionsByStatus.completed.length})`,
            icon: RiTrophyLine,
          },
        ].map((tab) => (
          <button
            key={tab.id}
            className="hover:text-foreground flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-[--intel-silver] transition-colors"
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Mission Content */}
      {filteredMissions.length === 0 ? (
        <div className="py-12 text-center text-[--intel-silver]">
          <RiPlayLine className="mx-auto mb-4 h-16 w-16 opacity-50" />
          <h3 className="mb-2 text-lg font-semibold">No Missions Available</h3>
          <p>Check back later or upgrade your embassies to unlock new missions</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {filteredMissions.map((mission) => (
            <div key={mission.id} className="glass-hierarchy-child rounded-lg p-4">
              <div className="mb-3 flex items-start justify-between">
                <div className="flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <h4 className="text-foreground font-semibold">{mission.title}</h4>
                    <div
                      className={cn(
                        "rounded px-2 py-1 text-xs font-medium",
                        missionTypeColor[mission.type]
                      )}
                    >
                      {mission.type.replace("_", " ")}
                    </div>
                  </div>
                  <p className="text-sm text-[--intel-silver]">
                    {mission.embassyName} • Level {mission.embassyLevel}
                  </p>
                </div>
                <div
                  className={cn(
                    "rounded px-2 py-1 text-xs font-medium",
                    difficultyColor[mission.difficulty]
                  )}
                >
                  {mission.difficulty}
                </div>
              </div>

              <p className="mb-4 text-sm text-[--intel-silver]">{mission.description}</p>

              {/* Mission Progress (for active missions) */}
              {mission.status === "IN_PROGRESS" && (
                <div className="mb-4">
                  <div className="mb-2 flex items-center justify-between text-xs">
                    <span className="text-[--intel-silver]">Progress</span>
                    <span className="text-[--intel-gold]">{Math.round(mission.progress)}%</span>
                  </div>
                  <div className="mb-2 h-2 w-full rounded-full bg-white/10">
                    <div
                      className="h-2 rounded-full bg-[--intel-gold] transition-all duration-300"
                      style={{ width: `${mission.progress}%` }}
                    />
                  </div>
                  {mission.timeRemaining && (
                    <div className="flex items-center gap-2 text-xs text-[--intel-silver]">
                      <RiTimeLine className="h-3 w-3" />
                      <span>{mission.timeRemaining} remaining</span>
                    </div>
                  )}
                </div>
              )}

              {/* Mission Rewards and Stats */}
              <div className="mb-4 flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <RiTrophyLine className="h-3 w-3 text-[--intel-gold]" />
                    {mission.experienceReward} XP
                  </span>
                  <span className="flex items-center gap-1">
                    <RiBarChartLine className="h-3 w-3 text-blue-400" />
                    {mission.influenceReward} Influence
                  </span>
                  <span className="flex items-center gap-1">
                    <RiCoinLine className="h-3 w-3 text-yellow-400" />₫
                    {mission.budgetCost.toLocaleString()}
                  </span>
                </div>
                <div className="text-[--intel-silver]">
                  {mission.duration}h • {mission.successChance}% success
                </div>
              </div>

              {/* Mission Actions */}
              {mission.status === "AVAILABLE" && (
                <button
                  onClick={() => onStartMission(mission.embassyId, mission.id)}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-500/20 px-4 py-2 font-medium text-green-400 transition-colors hover:bg-green-500/30"
                >
                  <RiPlayLine className="h-4 w-4" />
                  Start Mission
                </button>
              )}

              {mission.status === "IN_PROGRESS" && (
                <div className="flex gap-2">
                  <button
                    onClick={() => onCompleteMission(mission.embassyId, mission.id)}
                    disabled={mission.progress < 100}
                    className={cn(
                      "flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 font-medium transition-colors",
                      mission.progress >= 100
                        ? "bg-[--intel-gold]/20 text-[--intel-gold] hover:bg-[--intel-gold]/30"
                        : "cursor-not-allowed bg-gray-500/20 text-gray-400"
                    )}
                  >
                    <RiTrophyLine className="h-4 w-4" />
                    {mission.progress >= 100 ? "Complete Mission" : "In Progress"}
                  </button>
                  <button className="rounded-lg bg-red-500/20 px-3 py-2 font-medium text-red-400 transition-colors hover:bg-red-500/30">
                    <RiPauseLine className="h-4 w-4" />
                  </button>
                </div>
              )}

              {mission.status === "COMPLETED" && (
                <div className="flex items-center justify-center py-2 text-sm font-medium text-[--intel-gold]">
                  <RiTrophyLine className="mr-2 h-4 w-4" />
                  Mission Completed
                </div>
              )}

              {mission.status === "FAILED" && (
                <div className="flex items-center justify-center py-2 text-sm font-medium text-red-400">
                  <RiCloseLine className="mr-2 h-4 w-4" />
                  Mission Failed
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const UpgradesPanel: React.FC<{
  embassies: Embassy[];
  onUpgrade: (embassyId: string, upgradeId: string) => void;
}> = ({ embassies, onUpgrade }) => {
  const allUpgrades = embassies.flatMap((embassy) =>
    (embassy.availableUpgrades || []).map((upgrade) => ({
      ...upgrade,
      embassyId: embassy.id,
      embassyName: embassy.targetCountryName,
    }))
  );

  const upgradeTypeColor = {
    SECURITY: "text-red-400",
    STAFF: "text-blue-400",
    FACILITIES: "text-green-400",
    TECHNOLOGY: "text-purple-400",
    SPECIALIZATION: "text-[--intel-gold]",
  };

  return (
    <div className="space-y-4">
      {allUpgrades.length === 0 ? (
        <div className="py-12 text-center text-[--intel-silver]">
          <RiUploadLine className="mx-auto mb-4 h-16 w-16 opacity-50" />
          <h3 className="mb-2 text-lg font-semibold">No Upgrades Available</h3>
          <p>Level up your embassies to unlock more upgrade options</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {allUpgrades.map((upgrade) => (
            <div key={upgrade.id} className="glass-hierarchy-child rounded-lg p-4">
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <h4 className="text-foreground font-semibold">{upgrade.name}</h4>
                  <p className="text-sm text-[--intel-silver]">{upgrade.embassyName}</p>
                </div>
                <div className={cn("text-xs font-medium", upgradeTypeColor[upgrade.type])}>
                  {upgrade.type}
                </div>
              </div>

              <p className="mb-4 text-sm text-[--intel-silver]">{upgrade.description}</p>

              <div className="mb-4 space-y-2">
                {Object.entries(upgrade.effects).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between text-xs">
                    <span className="text-[--intel-silver] capitalize">
                      {key.replace(/([A-Z])/g, " $1")}
                    </span>
                    <span className="text-green-400">
                      +{value}
                      {typeof value === "number" && value < 1 ? "%" : ""}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mb-4 flex items-center justify-between text-xs">
                <span className="font-medium text-yellow-400">
                  ₫{upgrade.cost.toLocaleString()}
                </span>
                <span className="text-[--intel-silver]">
                  Level {upgrade.requiredLevel}+ required
                </span>
              </div>

              <button
                onClick={() => onUpgrade(upgrade.embassyId, upgrade.id)}
                disabled={upgrade.isActive}
                className={cn(
                  "flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2 font-medium transition-colors",
                  !upgrade.isActive
                    ? "bg-blue-500/20 text-blue-400 hover:bg-blue-500/30"
                    : "cursor-not-allowed bg-green-500/20 text-green-400"
                )}
              >
                <RiUploadLine className="h-4 w-4" />
                {upgrade.isActive ? "Installed" : "Purchase Upgrade"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const EconomicsPanel: React.FC<{
  embassies: Embassy[];
  onPayMaintenance: (embassyId: string) => void;
}> = ({ embassies, onPayMaintenance }) => {
  const [selectedTimeframe, setSelectedTimeframe] = useState<"monthly" | "quarterly" | "annual">(
    "monthly"
  );
  const [budgetView, setBudgetView] = useState<"current" | "projected" | "optimization">("current");
  const totalBudget = embassies.reduce((sum, e) => sum + e.budget, 0);
  const totalMaintenance = embassies.reduce((sum, e) => sum + e.maintenanceCost, 0);
  const netIncome = totalBudget - totalMaintenance;

  // Calculate timeframe multipliers
  const timeframeMultiplier = { monthly: 1, quarterly: 3, annual: 12 }[selectedTimeframe];
  const projectedMaintenance = totalMaintenance * timeframeMultiplier;
  const projectedIncome = netIncome * timeframeMultiplier;

  // Calculate efficiency metrics
  const averageEfficiency =
    embassies.length > 0
      ? embassies.reduce((sum, e) => sum + (e.influence || 0) / Math.max(e.budget, 1), 0) /
        embassies.length
      : 0;

  // Identify optimization opportunities
  const inefficientEmbassies = embassies.filter(
    (e) => (e.influence || 0) / Math.max(e.budget, 1) < averageEfficiency * 0.7
  );

  const overbudgetEmbassies = embassies.filter(
    (e) => e.budget < e.maintenanceCost * 3 // Less than 3 months of maintenance
  );

  return (
    <div className="space-y-6">
      {/* Economics Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <select
            value={selectedTimeframe}
            onChange={(e) => setSelectedTimeframe(e.target.value as typeof selectedTimeframe)}
            className="text-foreground rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm dark:bg-black/20"
          >
            <option value="monthly">Monthly View</option>
            <option value="quarterly">Quarterly View</option>
            <option value="annual">Annual View</option>
          </select>

          <select
            value={budgetView}
            onChange={(e) => setBudgetView(e.target.value as typeof budgetView)}
            className="text-foreground rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm dark:bg-black/20"
          >
            <option value="current">Current Status</option>
            <option value="projected">Projections</option>
            <option value="optimization">Optimization</option>
          </select>
        </div>

        <div className="text-sm text-[--intel-silver]">
          {embassies.length} embassies • {selectedTimeframe} forecast
        </div>
      </div>

      {budgetView === "optimization" &&
        (inefficientEmbassies.length > 0 || overbudgetEmbassies.length > 0) && (
          <div className="glass-hierarchy-child rounded-lg border-l-4 border-yellow-400 p-4">
            <div className="mb-3 flex items-center gap-2">
              <RiFireLine className="h-5 w-5 text-yellow-400" />
              <h3 className="text-foreground font-semibold">Optimization Opportunities</h3>
            </div>

            <div className="space-y-3 text-sm">
              {inefficientEmbassies.length > 0 && (
                <div>
                  <h4 className="text-foreground mb-2 font-medium">
                    Low Efficiency Embassies ({inefficientEmbassies.length})
                  </h4>
                  <div className="space-y-1">
                    {inefficientEmbassies.slice(0, 3).map((embassy) => (
                      <div
                        key={embassy.id}
                        className="flex items-center justify-between text-[--intel-silver]"
                      >
                        <span>{embassy.targetCountryName}</span>
                        <span className="text-yellow-400">
                          {(((embassy.influence || 0) / Math.max(embassy.budget, 1)) * 100).toFixed(
                            1
                          )}
                          % efficiency
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {overbudgetEmbassies.length > 0 && (
                <div>
                  <h4 className="text-foreground mb-2 font-medium">
                    Budget Concerns ({overbudgetEmbassies.length})
                  </h4>
                  <div className="space-y-1">
                    {overbudgetEmbassies.slice(0, 3).map((embassy) => (
                      <div
                        key={embassy.id}
                        className="flex items-center justify-between text-[--intel-silver]"
                      >
                        <span>{embassy.targetCountryName}</span>
                        <span className="text-red-400">
                          {Math.floor(embassy.budget / embassy.maintenanceCost)} months remaining
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

      {/* Financial Overview */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
        <div className="glass-hierarchy-child rounded-lg p-4 text-center">
          <RiCoinLine className="mx-auto mb-2 h-8 w-8 text-yellow-400" />
          <div className="text-2xl font-bold text-yellow-400">₫{totalBudget.toLocaleString()}</div>
          <div className="text-sm text-[--intel-silver]">Total Budget</div>
        </div>

        <div className="glass-hierarchy-child rounded-lg p-4 text-center">
          <RiRefreshLine className="mx-auto mb-2 h-8 w-8 text-red-400" />
          <div className="text-2xl font-bold text-red-400">
            ₫
            {(budgetView === "projected"
              ? projectedMaintenance
              : totalMaintenance
            ).toLocaleString()}
          </div>
          <div className="text-sm text-[--intel-silver]">
            {budgetView === "projected"
              ? `${selectedTimeframe} Maintenance`
              : "Monthly Maintenance"}
          </div>
        </div>

        <div className="glass-hierarchy-child rounded-lg p-4 text-center">
          <RiBarChartLine
            className={cn(
              "mx-auto mb-2 h-8 w-8",
              (budgetView === "projected" ? projectedIncome : netIncome) >= 0
                ? "text-green-400"
                : "text-red-400"
            )}
          />
          <div
            className={cn(
              "text-2xl font-bold",
              (budgetView === "projected" ? projectedIncome : netIncome) >= 0
                ? "text-green-400"
                : "text-red-400"
            )}
          >
            ₫{(budgetView === "projected" ? projectedIncome : netIncome).toLocaleString()}
          </div>
          <div className="text-sm text-[--intel-silver]">
            {budgetView === "projected" ? `${selectedTimeframe} Net` : "Monthly Net"}
          </div>
        </div>

        <div className="glass-hierarchy-child rounded-lg p-4 text-center">
          <RiFireLine className="mx-auto mb-2 h-8 w-8 text-blue-400" />
          <div className="text-2xl font-bold text-blue-400">
            {(averageEfficiency * 100).toFixed(1)}%
          </div>
          <div className="text-sm text-[--intel-silver]">Avg Efficiency</div>
        </div>
      </div>

      {/* Embassy Financial Details */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-foreground font-semibold">Embassy Resource Management</h4>
          <div className="text-sm text-[--intel-silver]">
            Sorted by {budgetView === "optimization" ? "optimization priority" : "budget size"}
          </div>
        </div>
        {embassies
          .sort((a, b) => {
            if (budgetView === "optimization") {
              // Sort by efficiency (influence per budget unit)
              const efficiencyA = (a.influence || 0) / Math.max(a.budget, 1);
              const efficiencyB = (b.influence || 0) / Math.max(b.budget, 1);
              return efficiencyA - efficiencyB; // Lowest efficiency first for optimization
            }
            return b.budget - a.budget; // Highest budget first
          })
          .map((embassy) => {
            const maintenanceDue =
              embassy.nextMaintenance && new Date(embassy.nextMaintenance) < new Date();
            const monthsRemaining = Math.floor(embassy.budget / embassy.maintenanceCost);
            const efficiency = ((embassy.influence || 0) / Math.max(embassy.budget, 1)) * 100;
            const isInefficient = efficiency < averageEfficiency * 70; // Below 70% of average

            return (
              <div
                key={embassy.id}
                className={cn(
                  "glass-hierarchy-child rounded-lg p-4",
                  budgetView === "optimization" && isInefficient && "border-l-4 border-yellow-400"
                )}
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <h5 className="text-foreground font-medium">{embassy.targetCountryName}</h5>
                      {budgetView === "optimization" && (
                        <div
                          className={cn(
                            "rounded px-2 py-1 text-xs",
                            efficiency >= averageEfficiency * 100
                              ? "bg-green-500/20 text-green-400"
                              : efficiency >= averageEfficiency * 70
                                ? "bg-yellow-500/20 text-yellow-400"
                                : "bg-red-500/20 text-red-400"
                          )}
                        >
                          {efficiency.toFixed(1)}% efficiency
                        </div>
                      )}
                    </div>
                    <p className="text-sm text-[--intel-silver]">
                      Level {embassy.level} •{" "}
                      {embassy.specializations?.join(", ") || "General Purpose"}
                    </p>
                  </div>
                  {maintenanceDue && (
                    <div className="text-sm font-medium text-red-400">Maintenance Due</div>
                  )}
                </div>

                {/* Resource Allocation Bar */}
                <div className="mb-4">
                  <div className="mb-2 flex items-center justify-between text-xs">
                    <span className="text-[--intel-silver]">Resource Allocation</span>
                    <span className="text-foreground">{monthsRemaining} months remaining</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-white/10">
                    <div
                      className={cn(
                        "h-2 rounded-full transition-all duration-300",
                        monthsRemaining >= 6
                          ? "bg-green-400"
                          : monthsRemaining >= 3
                            ? "bg-yellow-400"
                            : "bg-red-400"
                      )}
                      style={{ width: `${Math.min((monthsRemaining / 12) * 100, 100)}%` }}
                    />
                  </div>
                </div>

                <div className="mb-4 grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
                  <div>
                    <div className="text-[--intel-silver]">Budget</div>
                    <div className="font-medium text-yellow-400">
                      ₫{embassy.budget.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-[--intel-silver]">Monthly Cost</div>
                    <div className="font-medium text-red-400">
                      ₫{embassy.maintenanceCost.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-[--intel-silver]">Staff</div>
                    <div className="text-foreground font-medium">{embassy.staffCount}</div>
                  </div>
                  <div>
                    <div className="text-[--intel-silver]">Influence</div>
                    <div className="font-medium text-blue-400">
                      {(embassy.influence || 0).toLocaleString()}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  {maintenanceDue && (
                    <button
                      onClick={() => onPayMaintenance(embassy.id)}
                      className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-500/20 px-4 py-2 font-medium text-red-400 transition-colors hover:bg-red-500/30"
                    >
                      <RiCoinLine className="h-4 w-4" />
                      Pay Maintenance
                    </button>
                  )}

                  {budgetView === "optimization" && isInefficient && (
                    <button className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-yellow-500/20 px-4 py-2 font-medium text-yellow-400 transition-colors hover:bg-yellow-500/30">
                      <RiFireLine className="h-4 w-4" />
                      Optimize
                    </button>
                  )}

                  {monthsRemaining < 3 && (
                    <button className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-500/20 px-4 py-2 font-medium text-blue-400 transition-colors hover:bg-blue-500/30">
                      <RiUploadLine className="h-4 w-4" />
                      Allocate Budget
                    </button>
                  )}
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
};

// Helper functions for mission progress and time calculations
function calculateMissionProgress(mission: EmbassyMission): number {
  if (!mission.startedAt) return 0;

  const startTime = new Date(mission.startedAt).getTime();
  const now = new Date().getTime();
  const durationMs = mission.duration * 60 * 60 * 1000; // Convert hours to milliseconds

  const elapsed = now - startTime;
  const progress = Math.min((elapsed / durationMs) * 100, 100);

  return Math.max(0, progress);
}

function calculateTimeRemaining(startedAt: string, duration: number): string {
  const startTime = new Date(startedAt).getTime();
  const now = new Date().getTime();
  const durationMs = duration * 60 * 60 * 1000; // Convert hours to milliseconds
  const endTime = startTime + durationMs;

  const remaining = endTime - now;

  if (remaining <= 0) return "Ready to complete";

  const hours = Math.floor(remaining / (60 * 60 * 1000));
  const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
}

EmbassyNetworkVisualizationComponent.displayName = "EmbassyNetworkVisualization";

export const EmbassyNetworkVisualization = React.memo(EmbassyNetworkVisualizationComponent);
