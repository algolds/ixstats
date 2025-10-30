/**
 * Diplomatic Operations Hook
 *
 * Encapsulates all state management, data fetching, and business logic
 * for the DiplomaticOperationsHub component.
 *
 * @module hooks/useDiplomaticOperations
 */

import { useState, useMemo, useCallback, useEffect } from "react";
import { api } from "~/trpc/react";
import { toast } from "sonner";
import {
  calculateNetworkMetrics,
  filterMissionsByStatus,
  filterExchangesByStatus,
  type NetworkMetrics,
  type Mission,
  type CulturalExchange,
  type MissionStatus,
  type MissionDifficulty,
  type ExchangeStatus,
  type Embassy,
  type EmbassyStatus,
} from "~/lib/diplomatic-operations-utils";

export type TabType = "embassy-network" | "missions" | "cultural-exchanges" | "treaties";
export type MissionFilter = "all" | "active" | "completed" | "available";
export type ExchangeFilter = "all" | "planning" | "active" | "completed";

/**
 * Form data interfaces
 */
export interface NewEmbassyData {
  hostCountry: string;
  name: string;
  location: string;
  ambassador: string;
}

export interface NewMissionData {
  type: string;
  staff: number;
  priority: string;
}

export interface NewExchangeData {
  title: string;
  type: string;
  description: string;
  startDate: string;
  endDate: string;
}

interface CountryOption {
  id: string;
  name: string;
  flagUrl?: string | null;
}

/**
 * Props for the hook
 */
export interface UseDiplomaticOperationsProps {
  countryId: string;
  countryName: string;
}

/**
 * Hook return type
 */
export interface UseDiplomaticOperationsReturn {
  // Tab state
  activeTab: TabType;
  handleTabChange: (value: string) => void;

  // Data
  embassies: any[] | undefined;
  missions: any[] | undefined;
  exchanges: any[] | undefined;
  relationships: any[] | undefined;
  availableUpgrades: any[] | undefined;
  hostCountryOptions: any[];

  // Loading states
  embassiesLoading: boolean;
  missionsLoading: boolean;
  exchangesLoading: boolean;
  upgradesLoading: boolean;
  countriesLoading: boolean;

  // Computed values
  networkMetrics: NetworkMetrics | null;
  filteredMissions: any[];
  filteredExchanges: any[];
  selectedUpgrade: any | null;
  embassyCount: number;
  activeEmbassyCount: number;
  existingGuestEmbassyHosts: Set<string>;

  // Embassy state
  expandedEmbassy: string | null;
  selectedEmbassy: string | null;
  handleEmbassyToggle: (embassyId: string) => void;
  handleEmbassyUpgrade: (embassyId: string) => void;
  handleEmbassyStartMission: (embassyId: string) => void;
  handleEmbassyAllocateBudget: (embassyId: string) => void;

  // Filters
  missionFilter: MissionFilter;
  exchangeFilter: ExchangeFilter;
  handleMissionFilterChange: (value: string) => void;
  handleExchangeFilterChange: (value: string) => void;

  // Dialog states
  establishEmbassyOpen: boolean;
  setEstablishEmbassyOpen: (open: boolean) => void;
  startMissionOpen: boolean;
  setStartMissionOpen: (open: boolean) => void;
  createExchangeOpen: boolean;
  setCreateExchangeOpen: (open: boolean) => void;
  allocateBudgetOpen: boolean;
  setAllocateBudgetOpen: (open: boolean) => void;
  upgradeEmbassyOpen: boolean;
  setUpgradeEmbassyOpen: (open: boolean) => void;

  // Form data
  newEmbassyData: NewEmbassyData;
  newMissionData: NewMissionData;
  newExchangeData: NewExchangeData;
  budgetAmount: number;
  selectedUpgradeType: string;

  // Form handlers
  handleHostCountrySelect: (value: string) => void;
  handleEmbassyNameChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleEmbassyLocationChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleEmbassyAmbassadorChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleMissionTypeChange: (value: string) => void;
  handleMissionStaffChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleMissionPriorityChange: (value: string) => void;
  handleExchangeTitleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleExchangeTypeChange: (value: string) => void;
  handleExchangeDescriptionChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  handleExchangeStartDateChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleExchangeEndDateChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleBudgetAmountChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleUpgradeTypeChange: (value: string) => void;

  // Action handlers
  handleEstablishEmbassy: () => void;
  handleStartMission: () => void;
  handleCompleteMission: (missionId: string) => void;
  handleCreateExchange: () => void;
  handleAllocateBudget: () => void;
  handleUpgradeEmbassy: () => void;

  // Dialog open helpers
  openEstablishEmbassyDialog: () => void;
  openStartMissionDialog: () => void;
  openCreateExchangeDialog: () => void;

  // Mutation states
  establishEmbassyMutation: any;
  startMissionMutation: any;
  completeMissionMutation: any;
  createExchangeMutation: any;
  allocateBudgetMutation: any;
  upgradeEmbassyMutation: any;
}

/**
 * Custom hook for diplomatic operations management
 */
export function useDiplomaticOperations({
  countryId,
  countryName,
}: UseDiplomaticOperationsProps): UseDiplomaticOperationsReturn {
  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>("embassy-network");
  const [expandedEmbassy, setExpandedEmbassy] = useState<string | null>(null);
  const [missionFilter, setMissionFilter] = useState<MissionFilter>("all");
  const [exchangeFilter, setExchangeFilter] = useState<ExchangeFilter>("all");
  const [selectedEmbassy, setSelectedEmbassy] = useState<string | null>(null);

  // Dialog states
  const [establishEmbassyOpen, setEstablishEmbassyOpen] = useState(false);
  const [startMissionOpen, setStartMissionOpen] = useState(false);
  const [createExchangeOpen, setCreateExchangeOpen] = useState(false);
  const [allocateBudgetOpen, setAllocateBudgetOpen] = useState(false);
  const [upgradeEmbassyOpen, setUpgradeEmbassyOpen] = useState(false);

  // Form states
  const [newEmbassyData, setNewEmbassyData] = useState<NewEmbassyData>({
    hostCountry: "",
    name: "",
    location: "",
    ambassador: "",
  });
  const [newMissionData, setNewMissionData] = useState<NewMissionData>({
    type: "trade_negotiation",
    staff: 1,
    priority: "normal",
  });
  const [newExchangeData, setNewExchangeData] = useState<NewExchangeData>({
    title: "",
    type: "festival",
    description: "",
    startDate: "",
    endDate: "",
  });
  const [budgetAmount, setBudgetAmount] = useState(10000);
  const [selectedUpgradeType, setSelectedUpgradeType] = useState<string>("staff_expansion");

  // Fetch data
  const {
    data: embassies,
    isLoading: embassiesLoading,
    refetch: refetchEmbassies,
  } = api.diplomatic.getEmbassies.useQuery({ countryId });

  const {
    data: missions,
    isLoading: missionsLoading,
    refetch: refetchMissions,
  } = api.diplomatic.getAvailableMissions.useQuery(
    { embassyId: selectedEmbassy || "" },
    { enabled: !!selectedEmbassy }
  );

  const normalizedEmbassies = useMemo<Embassy[]>(() => {
    if (!Array.isArray(embassies)) return [];

    const validStatuses: EmbassyStatus[] = [
      "active",
      "strengthening",
      "neutral",
      "suspended",
      "closed",
    ];

    return embassies.map((embassy: any) => ({
      id: embassy.id ?? `embassy-${Math.random().toString(36).slice(2)}`,
      country: embassy.country ?? embassy.hostCountryName ?? "Unknown",
      status: validStatuses.includes(embassy.status) ? embassy.status : "neutral",
      strength: typeof embassy.strength === "number" ? embassy.strength : 0,
      level: typeof embassy.level === "number" ? embassy.level : 1,
      hostCountryId: embassy.hostCountryId,
      guestCountryId: embassy.guestCountryId,
      role: embassy.role,
    }));
  }, [embassies]);

  const {
    data: exchanges,
    isLoading: exchangesLoading,
    refetch: refetchExchanges,
  } = api.diplomatic.getCulturalExchanges.useQuery({ countryId });

  const { data: relationships } = api.diplomatic.getRelationships.useQuery({ countryId });

  const normalizedMissions = useMemo<Mission[]>(() => {
    if (!Array.isArray(missions)) return [];

    return missions.map((mission: any) => ({
      id: mission.id ?? `mission-${Math.random().toString(36).slice(2)}`,
      name: mission.name ?? mission.title ?? "Unknown Mission",
      status: (mission.status ?? "available") as MissionStatus,
      difficulty: (mission.difficulty ?? "medium") as MissionDifficulty,
      progress: typeof mission.progress === "number" ? mission.progress : undefined,
      priority: typeof mission.priority === "string" ? mission.priority : undefined,
      createdAt: mission.createdAt ?? undefined,
    }));
  }, [missions]);

  const normalizedExchanges = useMemo<CulturalExchange[]>(() => {
    if (!Array.isArray(exchanges)) return [];

    return exchanges.map((exchange: any) => ({
      id: exchange.id ?? `exchange-${Math.random().toString(36).slice(2)}`,
      title: exchange.title ?? "Untitled Exchange",
      status: (exchange.status ?? "planning") as ExchangeStatus,
      type: exchange.type ?? "general",
      createdAt: exchange.createdAt ?? undefined,
    }));
  }, [exchanges]);

  const { data: availableUpgrades, isLoading: upgradesLoading } =
    api.diplomatic.getAvailableUpgrades.useQuery(
      { embassyId: selectedEmbassy || "" },
      { enabled: upgradeEmbassyOpen && !!selectedEmbassy }
    );

  const { data: countryOptionsData, isLoading: countriesLoading } =
    api.countries.getSelectList.useQuery();

  // Computed values
  const hostCountryOptions = useMemo<CountryOption[]>(() => {
    if (!Array.isArray(countryOptionsData)) return [];

    return countryOptionsData
      .filter((country: any) => country?.id !== countryId)
      .map((country: any) => ({
        id: country.id,
        name: country.name ?? country.label ?? "Unknown",
        flagUrl: country.flagUrl ?? null,
      }));
  }, [countryOptionsData, countryId]);

  const existingGuestEmbassyHosts = useMemo(() => {
    if (normalizedEmbassies.length === 0) return new Set<string>();
    return new Set<string>(
      normalizedEmbassies
        .filter((embassy) => embassy.guestCountryId === countryId || embassy.role === "guest")
        .map((embassy) => embassy.hostCountryId)
        .filter((id): id is string => Boolean(id))
    );
  }, [normalizedEmbassies, countryId]);

  const networkMetrics = useMemo(
    () => calculateNetworkMetrics(normalizedEmbassies),
    [normalizedEmbassies]
  );

  const filteredMissions = useMemo(
    () => filterMissionsByStatus(normalizedMissions, missionFilter),
    [normalizedMissions, missionFilter]
  );

  const filteredExchanges = useMemo(
    () => filterExchangesByStatus(normalizedExchanges, exchangeFilter),
    [normalizedExchanges, exchangeFilter]
  );

  const selectedUpgrade = useMemo(() => {
    if (!availableUpgrades) return null;
    return (
      availableUpgrades.find((upgrade) => upgrade?.upgradeType === selectedUpgradeType) ?? null
    );
  }, [availableUpgrades, selectedUpgradeType]);

  const embassyCount = useMemo(() => normalizedEmbassies.length, [normalizedEmbassies]);

  const activeEmbassyCount = useMemo(
    () => normalizedEmbassies.filter((e) => e.status === "active").length,
    [normalizedEmbassies]
  );

  // Effects
  useEffect(() => {
    if (!upgradeEmbassyOpen || !availableUpgrades || availableUpgrades.length === 0) return;
    if (!availableUpgrades.some((upgrade) => upgrade?.upgradeType === selectedUpgradeType)) {
      setSelectedUpgradeType(availableUpgrades[0]?.upgradeType ?? "staff_expansion");
    }
  }, [availableUpgrades, upgradeEmbassyOpen, selectedUpgradeType]);

  useEffect(() => {
    if (!establishEmbassyOpen || hostCountryOptions.length === 0) return;
    setNewEmbassyData((prev) => {
      if (prev.hostCountry && hostCountryOptions.some((option) => option.id === prev.hostCountry)) {
        return prev;
      }

      const availableOption =
        hostCountryOptions.find((option) => !existingGuestEmbassyHosts.has(option.id)) ||
        hostCountryOptions[0];
      if (!availableOption) return prev;

      return {
        ...prev,
        hostCountry: availableOption.id,
        name: `Embassy of ${countryName} in ${availableOption.name}`,
      };
    });
  }, [establishEmbassyOpen, hostCountryOptions, existingGuestEmbassyHosts, countryName]);

  // Mutations
  const establishEmbassyMutation = api.diplomatic.establishEmbassy.useMutation({
    onSuccess: (data) => {
      toast.success("Embassy Established", {
        description: `Your embassy is now active in ${(data as any).hostCountryName || "the host nation"}.`,
      });
      setEstablishEmbassyOpen(false);
      setNewEmbassyData({ hostCountry: "", name: "", location: "", ambassador: "" });
      void refetchEmbassies();
    },
    onError: (error) => {
      toast.error("Failed to Establish Embassy", { description: error.message });
    },
  });

  const startMissionMutation = api.diplomatic.startMission.useMutation({
    onSuccess: () => {
      toast.success("Mission Started", {
        description: "Your diplomatic mission has been initiated!",
      });
      setStartMissionOpen(false);
      setNewMissionData({ type: "trade_negotiation", staff: 1, priority: "normal" });
      refetchMissions();
      refetchEmbassies();
    },
    onError: (error) => {
      toast.error("Failed to Start Mission", { description: error.message });
    },
  });

  const completeMissionMutation = api.diplomatic.completeMission.useMutation({
    onSuccess: (data) => {
      const message = data.success
        ? `Mission successful! Earned +${data.rewards.experience} XP and +${data.rewards.influence.toFixed(0)} influence.`
        : "Mission failed. Better luck next time.";
      toast[data.success ? "success" : "warning"]("Mission Complete", { description: message });
      refetchMissions();
      refetchEmbassies();
    },
    onError: (error) => {
      toast.error("Failed to Complete Mission", { description: error.message });
    },
  });

  const createExchangeMutation = api.diplomatic.createCulturalExchange.useMutation({
    onSuccess: () => {
      toast.success("Cultural Exchange Created", {
        description: "Your cultural exchange program has been created!",
      });
      setCreateExchangeOpen(false);
      setNewExchangeData({
        title: "",
        type: "festival",
        description: "",
        startDate: "",
        endDate: "",
      });
      refetchExchanges();
    },
    onError: (error) => {
      toast.error("Failed to Create Exchange", { description: error.message });
    },
  });

  const allocateBudgetMutation = api.diplomatic.allocateBudget.useMutation({
    onSuccess: () => {
      toast.success("Budget Allocated", {
        description: `$${budgetAmount.toLocaleString()} has been allocated to the embassy.`,
      });
      setAllocateBudgetOpen(false);
      setBudgetAmount(10000);
      refetchEmbassies();
    },
    onError: (error) => {
      toast.error("Failed to Allocate Budget", { description: error.message });
    },
  });

  const upgradeEmbassyMutation = api.diplomatic.upgradeEmbassy.useMutation({
    onSuccess: (upgrade) => {
      toast.success("Upgrade Initiated", {
        description: `${upgrade.name || "Embassy upgrade"} will complete in ${upgrade.duration} days.`,
      });
      setUpgradeEmbassyOpen(false);
      setSelectedUpgradeType("staff_expansion");
      refetchEmbassies();
    },
    onError: (error) => {
      toast.error("Failed to upgrade embassy", { description: error.message });
    },
  });

  // Tab handlers
  const handleTabChange = useCallback((value: string) => {
    setActiveTab(value as TabType);
  }, []);

  // Embassy handlers
  const handleEmbassyToggle = useCallback((embassyId: string) => {
    setExpandedEmbassy((prev) => (prev === embassyId ? null : embassyId));
  }, []);

  const handleEmbassyUpgrade = useCallback((embassyId: string) => {
    setSelectedEmbassy(embassyId);
    setUpgradeEmbassyOpen(true);
  }, []);

  const handleEmbassyStartMission = useCallback((embassyId: string) => {
    setSelectedEmbassy(embassyId);
    setStartMissionOpen(true);
  }, []);

  const handleEmbassyAllocateBudget = useCallback((embassyId: string) => {
    setSelectedEmbassy(embassyId);
    setAllocateBudgetOpen(true);
  }, []);

  // Filter handlers
  const handleMissionFilterChange = useCallback((value: string) => {
    setMissionFilter(value as MissionFilter);
  }, []);

  const handleExchangeFilterChange = useCallback((value: string) => {
    setExchangeFilter(value as ExchangeFilter);
  }, []);

  // Dialog open helpers
  const openEstablishEmbassyDialog = useCallback(() => setEstablishEmbassyOpen(true), []);
  const openStartMissionDialog = useCallback(() => setStartMissionOpen(true), []);
  const openCreateExchangeDialog = useCallback(() => setCreateExchangeOpen(true), []);

  // Form handlers - Embassy
  const handleHostCountrySelect = useCallback(
    (value: string) => {
      const selected = hostCountryOptions.find((option) => option.id === value);
      setNewEmbassyData((prev) => {
        const shouldOverrideName =
          !prev.name || prev.name.startsWith(`Embassy of ${countryName} in `);
        return {
          ...prev,
          hostCountry: value,
          name:
            selected && shouldOverrideName
              ? `Embassy of ${countryName} in ${selected.name}`
              : prev.name,
        };
      });
    },
    [hostCountryOptions, countryName]
  );

  const handleEmbassyNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setNewEmbassyData((prev) => ({ ...prev, name: e.target.value }));
  }, []);

  const handleEmbassyLocationChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setNewEmbassyData((prev) => ({ ...prev, location: e.target.value }));
  }, []);

  const handleEmbassyAmbassadorChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setNewEmbassyData((prev) => ({ ...prev, ambassador: e.target.value }));
  }, []);

  // Form handlers - Mission
  const handleMissionTypeChange = useCallback((value: string) => {
    setNewMissionData((prev) => ({ ...prev, type: value }));
  }, []);

  const handleMissionStaffChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMissionData((prev) => ({ ...prev, staff: parseInt(e.target.value) }));
  }, []);

  const handleMissionPriorityChange = useCallback((value: string) => {
    setNewMissionData((prev) => ({ ...prev, priority: value }));
  }, []);

  // Form handlers - Exchange
  const handleExchangeTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setNewExchangeData((prev) => ({ ...prev, title: e.target.value }));
  }, []);

  const handleExchangeTypeChange = useCallback((value: string) => {
    setNewExchangeData((prev) => ({ ...prev, type: value }));
  }, []);

  const handleExchangeDescriptionChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setNewExchangeData((prev) => ({ ...prev, description: e.target.value }));
    },
    []
  );

  const handleExchangeStartDateChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setNewExchangeData((prev) => ({ ...prev, startDate: e.target.value }));
  }, []);

  const handleExchangeEndDateChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setNewExchangeData((prev) => ({ ...prev, endDate: e.target.value }));
  }, []);

  // Form handlers - Budget & Upgrade
  const handleBudgetAmountChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setBudgetAmount(parseInt(e.target.value));
  }, []);

  const handleUpgradeTypeChange = useCallback((value: string) => {
    setSelectedUpgradeType(value);
  }, []);

  // Action handlers
  const handleEstablishEmbassy = useCallback(() => {
    if (!newEmbassyData.hostCountry) {
      toast.error("Missing Information", { description: "Please select a host country." });
      return;
    }

    const selectedHost = hostCountryOptions.find(
      (option) => option.id === newEmbassyData.hostCountry
    );

    const embassyName =
      newEmbassyData.name && newEmbassyData.name.trim().length > 0
        ? newEmbassyData.name
        : selectedHost
          ? `Embassy of ${countryName} in ${selectedHost.name}`
          : "";

    if (!embassyName) {
      toast.error("Missing Information", {
        description: "Please provide host country and embassy name.",
      });
      return;
    }

    establishEmbassyMutation.mutate({
      hostCountryId: newEmbassyData.hostCountry,
      guestCountryId: countryId,
      name: embassyName,
      location: newEmbassyData.location || undefined,
      ambassadorName: newEmbassyData.ambassador || undefined,
    });
  }, [newEmbassyData, countryId, establishEmbassyMutation, hostCountryOptions, countryName]);

  const handleStartMission = useCallback(() => {
    if (!selectedEmbassy) {
      toast.error("No Embassy Selected", { description: "Please select an embassy first." });
      return;
    }

    startMissionMutation.mutate({
      embassyId: selectedEmbassy,
      missionType: newMissionData.type as any,
      staffAssigned: newMissionData.staff,
      priorityLevel: newMissionData.priority as any,
    });
  }, [selectedEmbassy, newMissionData, startMissionMutation]);

  const handleCompleteMission = useCallback(
    (missionId: string) => {
      completeMissionMutation.mutate({ missionId });
    },
    [completeMissionMutation]
  );

  const handleCreateExchange = useCallback(() => {
    if (!newExchangeData.title || !newExchangeData.description) {
      toast.error("Missing Information", { description: "Please provide title and description." });
      return;
    }

    createExchangeMutation.mutate({
      title: newExchangeData.title,
      type: newExchangeData.type as any,
      description: newExchangeData.description,
      hostCountryId: countryId,
      hostCountryName: countryName,
      startDate: newExchangeData.startDate || new Date().toISOString(),
      endDate:
        newExchangeData.endDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    });
  }, [newExchangeData, countryId, countryName, createExchangeMutation]);

  const handleAllocateBudget = useCallback(() => {
    if (!selectedEmbassy) {
      toast.error("No Embassy Selected", { description: "Please select an embassy first." });
      return;
    }

    allocateBudgetMutation.mutate({
      embassyId: selectedEmbassy,
      additionalBudget: budgetAmount,
    });
  }, [selectedEmbassy, budgetAmount, allocateBudgetMutation]);

  const handleUpgradeEmbassy = useCallback(() => {
    if (!selectedEmbassy) {
      toast.error("No Embassy Selected", { description: "Please select an embassy to upgrade." });
      return;
    }

    const upgrade = availableUpgrades?.find(
      (option: any) => option?.upgradeType === selectedUpgradeType
    );
    if (!upgrade) {
      toast.error("Upgrade Unavailable", {
        description: "No upgrades available for this embassy.",
      });
      return;
    }

    upgradeEmbassyMutation.mutate({
      embassyId: selectedEmbassy,
      upgradeType: upgrade.upgradeType as any,
      level: upgrade.nextLevel,
    });
  }, [selectedEmbassy, availableUpgrades, selectedUpgradeType, upgradeEmbassyMutation]);

  return {
    // Tab state
    activeTab,
    handleTabChange,

    // Data
    embassies,
    missions,
    exchanges,
    relationships,
    availableUpgrades,
    hostCountryOptions,

    // Loading states
    embassiesLoading,
    missionsLoading,
    exchangesLoading,
    upgradesLoading,
    countriesLoading,

    // Computed values
    networkMetrics,
    filteredMissions,
    filteredExchanges,
    selectedUpgrade,
    embassyCount,
    activeEmbassyCount,
    existingGuestEmbassyHosts,

    // Embassy state
    expandedEmbassy,
    selectedEmbassy,
    handleEmbassyToggle,
    handleEmbassyUpgrade,
    handleEmbassyStartMission,
    handleEmbassyAllocateBudget,

    // Filters
    missionFilter,
    exchangeFilter,
    handleMissionFilterChange,
    handleExchangeFilterChange,

    // Dialog states
    establishEmbassyOpen,
    setEstablishEmbassyOpen,
    startMissionOpen,
    setStartMissionOpen,
    createExchangeOpen,
    setCreateExchangeOpen,
    allocateBudgetOpen,
    setAllocateBudgetOpen,
    upgradeEmbassyOpen,
    setUpgradeEmbassyOpen,

    // Form data
    newEmbassyData,
    newMissionData,
    newExchangeData,
    budgetAmount,
    selectedUpgradeType,

    // Form handlers
    handleHostCountrySelect,
    handleEmbassyNameChange,
    handleEmbassyLocationChange,
    handleEmbassyAmbassadorChange,
    handleMissionTypeChange,
    handleMissionStaffChange,
    handleMissionPriorityChange,
    handleExchangeTitleChange,
    handleExchangeTypeChange,
    handleExchangeDescriptionChange,
    handleExchangeStartDateChange,
    handleExchangeEndDateChange,
    handleBudgetAmountChange,
    handleUpgradeTypeChange,

    // Action handlers
    handleEstablishEmbassy,
    handleStartMission,
    handleCompleteMission,
    handleCreateExchange,
    handleAllocateBudget,
    handleUpgradeEmbassy,

    // Dialog open helpers
    openEstablishEmbassyDialog,
    openStartMissionDialog,
    openCreateExchangeDialog,

    // Mutation states
    establishEmbassyMutation,
    startMissionMutation,
    completeMissionMutation,
    createExchangeMutation,
    allocateBudgetMutation,
    upgradeEmbassyMutation,
  };
}
