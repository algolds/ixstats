/**
 * useMilitaryEquipmentCatalog Hook (Phase 6 Migration)
 *
 * Provides database-backed military equipment catalog with fallback to hardcoded data.
 * Integrates with tRPC API for equipment management and usage tracking.
 *
 * Features:
 * - Database query with 10-minute cache
 * - Automatic fallback to military-equipment.ts and military-equipment-extended.ts
 * - JSON parsing for specifications, capabilities, and requirements fields
 * - Usage tracking for analytics
 * - Warning system when using fallback data
 * - Support for comprehensive filtering (category, era, manufacturer, tech level, cost range)
 *
 * @module useMilitaryEquipmentCatalog
 */

import { useMemo } from 'react';
import { api } from '~/trpc/react';
import {
  MILITARY_AIRCRAFT,
  MILITARY_SHIPS,
  MILITARY_VEHICLES,
  WEAPON_SYSTEMS,
  DEFENSE_MANUFACTURERS,
  MILITARY_ERAS,
} from '~/lib/military-equipment';
import {
  EXPANDED_MILITARY_DATABASE,
  getTotalEquipmentCount,
} from '~/lib/military-equipment-extended';

/**
 * Equipment filters interface
 */
export interface EquipmentFilters {
  category?: 'infantry' | 'vehicle' | 'aircraft' | 'naval' | 'missile' | 'support';
  subcategory?: string;
  era?: 'wwi' | 'wwii' | 'cold-war' | 'modern' | 'future';
  manufacturer?: string;
  minTechLevel?: number;
  maxTechLevel?: number;
  minCost?: number;
  maxCost?: number;
}

/**
 * Military equipment catalog item interface
 */
export interface MilitaryEquipmentItem {
  id: string;
  name: string;
  category: string;
  subcategory: string | null;
  era: string;
  manufacturerId: string;
  manufacturer?: {
    id: string;
    name: string;
    country: string;
    specialty: string | null;
  };
  specifications: Record<string, any> | null;
  capabilities: Record<string, any> | null;
  requirements: Record<string, any> | null;
  procurementCost: number;
  maintenanceCost: number;
  technologyTier: number;
  usageCount: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * useMilitaryEquipmentCatalog - Fetch military equipment catalog data
 *
 * Queries the database for military equipment metadata and falls back to hardcoded
 * data from military-equipment.ts and military-equipment-extended.ts if the database
 * is empty or unavailable. Supports comprehensive filtering and automatic caching
 * with 10-minute staleTime.
 *
 * All 3 JSON fields are parsed from the database response:
 * - specifications: Record<string, any> (speed, range, crew, armament, etc.)
 * - capabilities: Record<string, any> (weapons systems, sensors, special features)
 * - requirements: Record<string, any> (infrastructure, personnel, maintenance needs)
 *
 * NOTE: Currently uses hardcoded fallback as catalog migration to database is
 * pending (Phase 6). When MilitaryCatalogEquipment model is seeded to database,
 * this hook will automatically use database data.
 *
 * @param {EquipmentFilters} [filters] - Filter equipment by category, era, manufacturer, etc. (optional)
 * @returns {Object} Equipment data and loading state
 * @property {MilitaryEquipmentItem[]} equipment - List of military equipment with parsed JSON fields
 * @property {boolean} isLoading - Loading state indicator
 * @property {any} error - Error object if query failed
 * @property {boolean} isUsingFallback - True if using hardcoded fallback data
 * @property {string} dataSource - 'database' or 'fallback'
 * @property {number} total - Total count of equipment items
 * @property {boolean} hasMore - Whether there are more items to load (pagination)
 * @property {(equipmentId: string) => void} incrementUsage - Track equipment selection
 *
 * @example
 * ```tsx
 * function EquipmentCatalog() {
 *   const { equipment, isLoading, isUsingFallback, incrementUsage } =
 *     useMilitaryEquipmentCatalog({
 *       category: 'aircraft',
 *       era: 'modern',
 *       minTechLevel: 7,
 *     });
 *
 *   if (isLoading) return <Spinner />;
 *
 *   return (
 *     <>
 *       {isUsingFallback && <FallbackWarning />}
 *       <EquipmentGrid
 *         equipment={equipment}
 *         onSelect={(id) => incrementUsage(id)}
 *       />
 *     </>
 *   );
 * }
 * ```
 */
export function useMilitaryEquipmentCatalog(filters?: EquipmentFilters) {
  // ==================== DATABASE QUERY ====================
  const { data: dbResponse, isLoading, error } = api.militaryEquipment.getCatalogEquipment.useQuery(
    {
      category: filters?.category,
      subcategory: filters?.subcategory,
      era: filters?.era,
      manufacturerId: filters?.manufacturer,
      minTechLevel: filters?.minTechLevel,
      maxTechLevel: filters?.maxTechLevel,
      minCost: filters?.minCost,
      maxCost: filters?.maxCost,
      isActive: true,
      limit: 100,
      offset: 0,
    },
    {
      staleTime: 10 * 60 * 1000, // 10-minute cache
      enabled: true,
    }
  );

  // Extract equipment from response
  const dbEquipment = dbResponse?.equipment;
  const dbTotal = dbResponse?.total ?? 0;
  const dbHasMore = dbResponse?.hasMore ?? false;

  // ==================== USAGE TRACKING MUTATION ====================
  // Track equipment selection for analytics
  const { mutate: incrementUsage } = api.militaryEquipment.incrementEquipmentUsage.useMutation({
    onError: (err) => {
      console.warn('[useMilitaryEquipmentCatalog] Failed to track equipment usage:', err);
    }
  });

  // ==================== PROCESS EQUIPMENT WITH FALLBACK ====================
  const { equipment, total, hasMore, isUsingFallback, dataSource } = useMemo(() => {
    // Use database if available and not empty
    if (dbEquipment && dbEquipment.length > 0) {
      // Database equipment already has JSON fields parsed by the router
      return {
        equipment: dbEquipment as MilitaryEquipmentItem[],
        total: dbTotal,
        hasMore: dbHasMore,
        isUsingFallback: false,
        dataSource: 'database' as const,
      };
    }

    // Fallback to hardcoded data
    if (!isLoading) {
      console.warn('[useMilitaryEquipmentCatalog] Database empty or unavailable, falling back to hardcoded equipment');
    }

    const fallbackEquipment = getFallbackEquipment(filters);

    return {
      equipment: fallbackEquipment,
      total: fallbackEquipment.length,
      hasMore: false,
      isUsingFallback: true,
      dataSource: 'fallback' as const,
    };
  }, [dbEquipment, dbTotal, dbHasMore, filters, isLoading]);

  // ==================== RETURN HOOK INTERFACE ====================
  return {
    equipment,
    isLoading,
    error,
    isUsingFallback,
    dataSource,
    total,
    hasMore,
    incrementUsage: (equipmentId: string) => {
      incrementUsage({ equipmentId });
    }
  };
}

/**
 * Get fallback equipment from hardcoded data
 *
 * Aggregates equipment from MILITARY_AIRCRAFT, MILITARY_SHIPS, MILITARY_VEHICLES,
 * WEAPON_SYSTEMS, and EXPANDED_MILITARY_DATABASE, applies filters, and transforms
 * to the MilitaryEquipmentItem interface.
 *
 * This ensures backward compatibility when database is unavailable.
 */
function getFallbackEquipment(filters?: EquipmentFilters): MilitaryEquipmentItem[] {
  const allEquipment: MilitaryEquipmentItem[] = [];

  // Map era constants to database enum values
  const eraMapping: Record<string, 'wwi' | 'wwii' | 'cold-war' | 'modern' | 'future'> = {
    'COLD_WAR': 'cold-war',
    'MODERN': 'modern',
    'CONTEMPORARY': 'modern',
    'ADVANCED': 'future',
    'NEXT_GEN': 'future',
  };

  // Helper to transform hardcoded equipment to database format
  function transformEquipment(
    key: string,
    item: any,
    category: 'aircraft' | 'naval' | 'vehicle' | 'missile',
    subcategory: string
  ): MilitaryEquipmentItem {
    const manufacturerKey = item.manufacturer;
    const manufacturerData = DEFENSE_MANUFACTURERS[manufacturerKey as keyof typeof DEFENSE_MANUFACTURERS];

    return {
      id: key.toLowerCase(),
      name: item.name,
      category,
      subcategory,
      era: eraMapping[item.era] || 'modern',
      manufacturerId: manufacturerKey,
      manufacturer: manufacturerData ? {
        id: manufacturerKey,
        name: manufacturerData.name,
        country: manufacturerData.country,
        specialty: manufacturerData.specialty.join(', '),
      } : undefined,
      specifications: {
        crew: item.crew,
        speed: item.speed,
        range: item.range,
        ceiling: item.ceiling,
        armament: item.armament,
        displacement: item.displacement,
        aircraft: item.aircraft,
        depth: item.depth,
        altitude: item.altitude,
        firingRange: item.firingRange,
        troops: item.troops,
        role: item.role,
        variants: item.variants,
        imageUrl: item.imageUrl,
      },
      capabilities: null,
      requirements: null,
      procurementCost: item.acquisitionCost || 0,
      maintenanceCost: item.maintenanceCost || 0,
      technologyTier: calculateTechTier(item),
      usageCount: 0,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  // Process MILITARY_AIRCRAFT
  Object.entries(MILITARY_AIRCRAFT).forEach(([key, item]) => {
    allEquipment.push(transformEquipment(key, item, 'aircraft', item.category));
  });

  // Process MILITARY_SHIPS
  Object.entries(MILITARY_SHIPS).forEach(([key, item]) => {
    allEquipment.push(transformEquipment(key, item, 'naval', item.category));
  });

  // Process MILITARY_VEHICLES
  Object.entries(MILITARY_VEHICLES).forEach(([key, item]) => {
    allEquipment.push(transformEquipment(key, item, 'vehicle', item.category));
  });

  // Process WEAPON_SYSTEMS
  Object.entries(WEAPON_SYSTEMS).forEach(([key, item]) => {
    allEquipment.push(transformEquipment(key, item, 'missile', item.category));
  });

  // Process EXPANDED_MILITARY_DATABASE
  Object.entries(EXPANDED_MILITARY_DATABASE.fighters_gen5).forEach(([key, item]) => {
    allEquipment.push(transformEquipment(key, item, 'aircraft', item.category));
  });

  Object.entries(EXPANDED_MILITARY_DATABASE.fighters_gen4_5).forEach(([key, item]) => {
    allEquipment.push(transformEquipment(key, item, 'aircraft', item.category));
  });

  Object.entries(EXPANDED_MILITARY_DATABASE.attack_aircraft).forEach(([key, item]) => {
    allEquipment.push(transformEquipment(key, item, 'aircraft', item.category));
  });

  Object.entries(EXPANDED_MILITARY_DATABASE.bombers).forEach(([key, item]) => {
    allEquipment.push(transformEquipment(key, item, 'aircraft', item.category));
  });

  Object.entries(EXPANDED_MILITARY_DATABASE.transport).forEach(([key, item]) => {
    allEquipment.push(transformEquipment(key, item, 'aircraft', item.category));
  });

  Object.entries(EXPANDED_MILITARY_DATABASE.helicopters).forEach(([key, item]) => {
    allEquipment.push(transformEquipment(key, item, 'aircraft', item.category));
  });

  Object.entries(EXPANDED_MILITARY_DATABASE.naval_ships).forEach(([key, item]) => {
    allEquipment.push(transformEquipment(key, item, 'naval', item.category));
  });

  Object.entries(EXPANDED_MILITARY_DATABASE.ground_vehicles).forEach(([key, item]) => {
    allEquipment.push(transformEquipment(key, item, 'vehicle', item.category));
  });

  Object.entries(EXPANDED_MILITARY_DATABASE.weapon_systems).forEach(([key, item]) => {
    allEquipment.push(transformEquipment(key, item, 'missile', item.category));
  });

  // Apply filters
  let filtered = allEquipment;

  if (filters?.category) {
    filtered = filtered.filter(eq => eq.category === filters.category);
  }

  if (filters?.subcategory) {
    filtered = filtered.filter(eq =>
      eq.subcategory?.toLowerCase().includes(filters.subcategory!.toLowerCase())
    );
  }

  if (filters?.era) {
    filtered = filtered.filter(eq => eq.era === filters.era);
  }

  if (filters?.manufacturer) {
    filtered = filtered.filter(eq => eq.manufacturerId === filters.manufacturer);
  }

  if (filters?.minTechLevel !== undefined) {
    filtered = filtered.filter(eq => eq.technologyTier >= filters.minTechLevel!);
  }

  if (filters?.maxTechLevel !== undefined) {
    filtered = filtered.filter(eq => eq.technologyTier <= filters.maxTechLevel!);
  }

  if (filters?.minCost !== undefined) {
    filtered = filtered.filter(eq => eq.procurementCost >= filters.minCost!);
  }

  if (filters?.maxCost !== undefined) {
    filtered = filtered.filter(eq => eq.procurementCost <= filters.maxCost!);
  }

  return filtered;
}

/**
 * Calculate technology tier from equipment data
 * Maps era and cost to a 1-10 scale
 */
function calculateTechTier(item: any): number {
  const eraTiers: Record<string, number> = {
    'COLD_WAR': 5,
    'MODERN': 7,
    'CONTEMPORARY': 8,
    'ADVANCED': 9,
    'NEXT_GEN': 10,
  };

  const baseTier = eraTiers[item.era] || 7;

  // Adjust based on cost (high-cost items generally have higher tech)
  const cost = item.acquisitionCost || 0;
  let costModifier = 0;

  if (cost > 1000000000) costModifier = 1; // Billion+ = advanced tech
  else if (cost > 100000000) costModifier = 0.5; // 100M+ = modern tech
  else if (cost < 10000000) costModifier = -1; // <10M = older/simpler tech

  return Math.min(10, Math.max(1, Math.round(baseTier + costModifier)));
}

/**
 * Get all available equipment categories
 */
export function useMilitaryCategories() {
  const { equipment } = useMilitaryEquipmentCatalog();

  const categories = useMemo(() => {
    const categorySet = new Set<string>();
    equipment.forEach(eq => {
      if (eq.category) {
        categorySet.add(eq.category);
      }
    });
    return Array.from(categorySet).sort();
  }, [equipment]);

  return categories;
}

/**
 * Get all available manufacturers
 */
export function useMilitaryManufacturers() {
  const { equipment } = useMilitaryEquipmentCatalog();

  const manufacturers = useMemo(() => {
    const manufacturerMap = new Map<string, { id: string; name: string; country: string }>();
    equipment.forEach(eq => {
      if (eq.manufacturer && !manufacturerMap.has(eq.manufacturer.id)) {
        manufacturerMap.set(eq.manufacturer.id, {
          id: eq.manufacturer.id,
          name: eq.manufacturer.name,
          country: eq.manufacturer.country,
        });
      }
    });
    return Array.from(manufacturerMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [equipment]);

  return manufacturers;
}

/**
 * Get equipment by ID
 */
export function useMilitaryEquipmentById(equipmentId: string) {
  const { data: equipment, isLoading, error } = api.militaryEquipment.getEquipmentById.useQuery(
    { id: equipmentId },
    {
      staleTime: 10 * 60 * 1000,
      enabled: !!equipmentId,
    }
  );

  return {
    equipment,
    isLoading,
    error,
  };
}

/**
 * Get equipment grouped by category
 */
export function useMilitaryEquipmentByCategory(options?: {
  isActive?: boolean;
  era?: 'wwi' | 'wwii' | 'cold-war' | 'modern' | 'future';
}) {
  const { data: groupedEquipment, isLoading, error } = api.militaryEquipment.getEquipmentByCategory.useQuery(
    {
      isActive: options?.isActive ?? true,
      era: options?.era,
    },
    {
      staleTime: 10 * 60 * 1000,
    }
  );

  return {
    groupedEquipment,
    isLoading,
    error,
  };
}
