 Comprehensive Builder Autosave & Persistence - Full Implementation Plan                                   │ │
│ │                                                                                                           │ │
│ │ Executive Summary                                                                                         │ │
│ │                                                                                                           │ │
│ │ Implement complete autosave functionality across all builder sections (National Identity, Government,     │ │
│ │ Tax, Economics) with automatic data loading in edit mode, manual save buttons, and comprehensive          │ │
│ │ validation testing.                                                                                       │ │
│ │                                                                                                           │ │
│ │ Estimated Time: 3 hours                                                                                   │ │
│ │ Impact: HIGH - Critical user experience improvement                                                       │ │
│ │ Risk: MEDIUM - Touches core builder functionality                                                         │ │
│ │                                                                                                           │ │
│ │ ---                                                                                                       │ │
│ │ Phase 1: Fix Critical Autosave Hook Bug (10 min)                                                          │ │
│ │                                                                                                           │ │
│ │ Priority: CRITICAL - Must fix before adding more autosave hooks                                           │ │
│ │                                                                                                           │ │
│ │ File: /src/hooks/useNationalIdentityAutoSync.ts                                                           │ │
│ │                                                                                                           │ │
│ │ Change 1: Fix dependency array (line 105)                                                                 │ │
│ │ // BEFORE (line 105)                                                                                      │ │
│ │ }, [nationalIdentity, enabled, countryId, debounceMs]);                                                   │ │
│ │                                                                                                           │ │
│ │ // AFTER                                                                                                  │ │
│ │ }, [nationalIdentity, enabled, countryId, debounceMs, handleAutoSync]);                                   │ │
│ │                                                                                                           │ │
│ │ Change 2: Fix handleAutoSync dependencies (line 122)                                                      │ │
│ │ // BEFORE (line 122)                                                                                      │ │
│ │ }, [countryId, enabled, nationalIdentity, autosaveMutation]);                                             │ │
│ │                                                                                                           │ │
│ │ // AFTER - Remove autosaveMutation from deps                                                              │ │
│ │ }, [countryId, enabled, nationalIdentity]);                                                               │ │
│ │                                                                                                           │ │
│ │ Validation:                                                                                               │ │
│ │ - No infinite loops during autosave                                                                       │ │
│ │ - Autosave triggers correctly after 15s                                                                   │ │
│ │ - Check console for excessive re-renders                                                                  │ │
│ │                                                                                                           │ │
│ │ ---                                                                                                       │ │
│ │ Phase 2: Implement Edit Mode Data Loading (45 min)                                                        │ │
│ │                                                                                                           │ │
│ │ File: /src/app/builder/hooks/useBuilderState.ts                                                           │ │
│ │                                                                                                           │ │
│ │ Change 1: Add tRPC queries at top of hook (after line 150)                                                │ │
│ │ export function useBuilderState(mode: "create" | "edit" = "create", countryId?: string) {                 │ │
│ │   // Existing state declarations...                                                                       │ │
│ │                                                                                                           │ │
│ │   // NEW: Add data loading queries for edit mode                                                          │ │
│ │   const { data: existingCountry, isLoading: isLoadingCountry } = api.countries.getByIdAtTime.useQuery(    │ │
│ │     {                                                                                                     │ │
│ │       id: countryId!,                                                                                     │ │
│ │       atTime: new Date()                                                                                  │ │
│ │     },                                                                                                    │ │
│ │     {                                                                                                     │ │
│ │       enabled: mode === "edit" && !!countryId,                                                            │ │
│ │       staleTime: 5 * 60 * 1000, // 5 min cache                                                            │ │
│ │     }                                                                                                     │ │
│ │   );                                                                                                      │ │
│ │                                                                                                           │ │
│ │   const { data: existingIdentity } = api.nationalIdentity.getByCountryId.useQuery(                        │ │
│ │     { countryId: countryId! },                                                                            │ │
│ │     {                                                                                                     │ │
│ │       enabled: mode === "edit" && !!countryId,                                                            │ │
│ │       staleTime: 5 * 60 * 1000,                                                                           │ │
│ │     }                                                                                                     │ │
│ │   );                                                                                                      │ │
│ │                                                                                                           │ │
│ │   const { data: existingGovernment } = api.government.getByCountryId.useQuery(                            │ │
│ │     { countryId: countryId! },                                                                            │ │
│ │     {                                                                                                     │ │
│ │       enabled: mode === "edit" && !!countryId,                                                            │ │
│ │       staleTime: 5 * 60 * 1000,                                                                           │ │
│ │     }                                                                                                     │ │
│ │   );                                                                                                      │ │
│ │                                                                                                           │ │
│ │   const { data: existingTaxSystem } = api.taxSystem.getByCountryId.useQuery(                              │ │
│ │     { countryId: countryId! },                                                                            │ │
│ │     {                                                                                                     │ │
│ │       enabled: mode === "edit" && !!countryId,                                                            │ │
│ │       staleTime: 5 * 60 * 1000,                                                                           │ │
│ │     }                                                                                                     │ │
│ │   );                                                                                                      │ │
│ │                                                                                                           │ │
│ │ Change 2: Load data into state when queries complete (add useEffect after queries)                        │ │
│ │   // NEW: Load existing data into builder state                                                           │ │
│ │   useEffect(() => {                                                                                       │ │
│ │     if (mode === "edit" && existingCountry && !builderState.economicInputs) {                             │ │
│ │       console.log("[useBuilderState] Loading existing country data into builder");                        │ │
│ │                                                                                                           │ │
│ │       // Convert existing country to economic inputs format                                               │ │
│ │       const economicInputs = {                                                                            │ │
│ │         countryName: existingCountry.name,                                                                │ │
│ │         population: existingCountry.population,                                                           │ │
│ │         gdp: existingCountry.gdp,                                                                         │ │
│ │         gdpPerCapita: existingCountry.gdpPerCapita,                                                       │ │
│ │         // ... map all fields from existing country                                                       │ │
│ │         nationalIdentity: existingIdentity ? {                                                            │ │
│ │           countryName: existingIdentity.countryName || existingCountry.name,                              │ │
│ │           officialName: existingIdentity.officialName || "",                                              │ │
│ │           capitalCity: existingIdentity.capitalCity || "",                                                │ │
│ │           // ... map all national identity fields                                                         │ │
│ │         } : undefined,                                                                                    │ │
│ │       };                                                                                                  │ │
│ │                                                                                                           │ │
│ │       setBuilderState(prev => ({                                                                          │ │
│ │         ...prev,                                                                                          │ │
│ │         economicInputs,                                                                                   │ │
│ │         governmentStructure: existingGovernment || null,                                                  │ │
│ │         taxSystemData: existingTaxSystem ? convertTaxSystemToBuilderState(existingTaxSystem) : null,      │ │
│ │       }));                                                                                                │ │
│ │     }                                                                                                     │ │
│ │   }, [mode, existingCountry, existingIdentity, existingGovernment, existingTaxSystem]);                   │ │
│ │                                                                                                           │ │
│ │ Change 3: Add helper function to convert tax system                                                       │ │
│ │ function convertTaxSystemToBuilderState(taxSystem: any): TaxBuilderState {                                │ │
│ │   return {                                                                                                │ │
│ │     taxSystem: {                                                                                          │ │
│ │       taxSystemName: taxSystem.taxSystemName,                                                             │ │
│ │       taxAuthority: taxSystem.taxAuthority,                                                               │ │
│ │       fiscalYear: taxSystem.fiscalYear,                                                                   │ │
│ │       // ... map all fields                                                                               │ │
│ │     },                                                                                                    │ │
│ │     categories: taxSystem.categories || [],                                                               │ │
│ │     brackets: taxSystem.brackets || [],                                                                   │ │
│ │   };                                                                                                      │ │
│ │ }                                                                                                         │ │
│ │                                                                                                           │ │
│ │ Change 4: Update return value to include loading state                                                    │ │
│ │   return {                                                                                                │ │
│ │     builderState,                                                                                         │ │
│ │     setBuilderState,                                                                                      │ │
│ │     lastSaved,                                                                                            │ │
│ │     isAutoSaving,                                                                                         │ │
│ │     isLoadingCountry, // NEW: expose loading state                                                        │ │
│ │     countryId,                                                                                            │ │
│ │     mode,                                                                                                 │ │
│ │     // ... rest of return values                                                                          │ │
│ │   };                                                                                                      │ │
│ │                                                                                                           │ │
│ │ ---                                                                                                       │ │
│ │ Phase 3: Add Government Autosave Mutation (30 min)                                                        │ │
│ │                                                                                                           │ │
│ │ File: /src/server/api/routers/government.ts                                                               │ │
│ │                                                                                                           │ │
│ │ Add new mutation after existing mutations (~line 650)                                                     │ │
│ │   /**                                                                                                     │ │
│ │    * Autosave government structure (incremental save during editing)                                      │ │
│ │    * Used by builder for real-time persistence                                                            │ │
│ │    */                                                                                                     │ │
│ │   autosave: protectedProcedure                                                                            │ │
│ │     .input(                                                                                               │ │
│ │       z.object({                                                                                          │ │
│ │         countryId: z.string(),                                                                            │ │
│ │         data: z.object({                                                                                  │ │
│ │           governmentName: z.string().optional(),                                                          │ │
│ │           governmentType: z.string().optional(),                                                          │ │
│ │           headOfState: z.string().optional(),                                                             │ │
│ │           headOfGovernment: z.string().optional(),                                                        │ │
│ │           legislature: z.string().optional(),                                                             │ │
│ │           judiciary: z.string().optional(),                                                               │ │
│ │           departments: z.array(z.any()).optional(),                                                       │ │
│ │           budgetAllocations: z.array(z.any()).optional(),                                                 │ │
│ │         }),                                                                                               │ │
│ │       })                                                                                                  │ │
│ │     )                                                                                                     │ │
│ │     .mutation(async ({ ctx, input }) => {                                                                 │ │
│ │       if (!ctx.auth?.userId) {                                                                            │ │
│ │         throw new Error("Not authenticated");                                                             │ │
│ │       }                                                                                                   │ │
│ │                                                                                                           │ │
│ │       // Verify user owns this country                                                                    │ │
│ │       const userProfile = await ctx.db.user.findUnique({                                                  │ │
│ │         where: { clerkUserId: ctx.auth.userId },                                                          │ │
│ │       });                                                                                                 │ │
│ │                                                                                                           │ │
│ │       if (!userProfile || userProfile.countryId !== input.countryId) {                                    │ │
│ │         throw new Error("You do not have permission to edit this country.");                              │ │
│ │       }                                                                                                   │ │
│ │                                                                                                           │ │
│ │       try {                                                                                               │ │
│ │         // Upsert government structure                                                                    │ │
│ │         const governmentStructure = await ctx.db.governmentStructure.upsert({                             │ │
│ │           where: { countryId: input.countryId },                                                          │ │
│ │           update: {                                                                                       │ │
│ │             governmentName: input.data.governmentName,                                                    │ │
│ │             governmentType: input.data.governmentType,                                                    │ │
│ │             headOfState: input.data.headOfState,                                                          │ │
│ │             headOfGovernment: input.data.headOfGovernment,                                                │ │
│ │             legislature: input.data.legislature,                                                          │ │
│ │             judiciary: input.data.judiciary,                                                              │ │
│ │             updatedAt: new Date(),                                                                        │ │
│ │           },                                                                                              │ │
│ │           create: {                                                                                       │ │
│ │             countryId: input.countryId,                                                                   │ │
│ │             governmentName: input.data.governmentName || "Government",                                    │ │
│ │             governmentType: input.data.governmentType || "Republic",                                      │ │
│ │             headOfState: input.data.headOfState,                                                          │ │
│ │             headOfGovernment: input.data.headOfGovernment,                                                │ │
│ │             legislature: input.data.legislature,                                                          │ │
│ │             judiciary: input.data.judiciary,                                                              │ │
│ │           },                                                                                              │ │
│ │         });                                                                                               │ │
│ │                                                                                                           │ │
│ │         return {                                                                                          │ │
│ │           success: true,                                                                                  │ │
│ │           data: governmentStructure,                                                                      │ │
│ │           message: "Government structure autosaved successfully",                                         │ │
│ │         };                                                                                                │ │
│ │       } catch (error) {                                                                                   │ │
│ │         console.error("[Government API] Autosave failed:", error);                                        │ │
│ │         throw new Error(                                                                                  │ │
│ │           `Failed to autosave government: ${error instanceof Error ? error.message : "Unknown error"}`    │ │
│ │         );                                                                                                │ │
│ │       }                                                                                                   │ │
│ │     }),                                                                                                   │ │
│ │                                                                                                           │ │
│ │ ---                                                                                                       │ │
│ │ Phase 4: Add Tax System Autosave Mutation (30 min)                                                        │ │
│ │                                                                                                           │ │
│ │ File: /src/server/api/routers/taxSystem.ts                                                                │ │
│ │                                                                                                           │ │
│ │ Add new mutation after existing mutations (~line 700)                                                     │ │
│ │   /**                                                                                                     │ │
│ │    * Autosave tax system (incremental save during editing)                                                │ │
│ │    * Used by builder for real-time persistence                                                            │ │
│ │    */                                                                                                     │ │
│ │   autosave: protectedProcedure                                                                            │ │
│ │     .input(                                                                                               │ │
│ │       z.object({                                                                                          │ │
│ │         countryId: z.string(),                                                                            │ │
│ │         data: z.object({                                                                                  │ │
│ │           taxSystemName: z.string().optional(),                                                           │ │
│ │           taxAuthority: z.string().optional(),                                                            │ │
│ │           fiscalYear: z.string().optional(),                                                              │ │
│ │           taxCode: z.string().optional(),                                                                 │ │
│ │           baseRate: z.number().optional(),                                                                │ │
│ │           progressiveTax: z.boolean().optional(),                                                         │ │
│ │           flatTaxRate: z.number().optional(),                                                             │ │
│ │           categories: z.array(z.any()).optional(),                                                        │ │
│ │           brackets: z.array(z.any()).optional(),                                                          │ │
│ │         }),                                                                                               │ │
│ │       })                                                                                                  │ │
│ │     )                                                                                                     │ │
│ │     .mutation(async ({ ctx, input }) => {                                                                 │ │
│ │       if (!ctx.auth?.userId) {                                                                            │ │
│ │         throw new Error("Not authenticated");                                                             │ │
│ │       }                                                                                                   │ │
│ │                                                                                                           │ │
│ │       // Verify user owns this country                                                                    │ │
│ │       const userProfile = await ctx.db.user.findUnique({                                                  │ │
│ │         where: { clerkUserId: ctx.auth.userId },                                                          │ │
│ │       });                                                                                                 │ │
│ │                                                                                                           │ │
│ │       if (!userProfile || userProfile.countryId !== input.countryId) {                                    │ │
│ │         throw new Error("You do not have permission to edit this country.");                              │ │
│ │       }                                                                                                   │ │
│ │                                                                                                           │ │
│ │       try {                                                                                               │ │
│ │         // Upsert tax system                                                                              │ │
│ │         const taxSystem = await ctx.db.taxSystem.upsert({                                                 │ │
│ │           where: { countryId: input.countryId },                                                          │ │
│ │           update: {                                                                                       │ │
│ │             taxSystemName: input.data.taxSystemName,                                                      │ │
│ │             taxAuthority: input.data.taxAuthority,                                                        │ │
│ │             fiscalYear: input.data.fiscalYear,                                                            │ │
│ │             taxCode: input.data.taxCode,                                                                  │ │
│ │             baseRate: input.data.baseRate,                                                                │ │
│ │             progressiveTax: input.data.progressiveTax,                                                    │ │
│ │             flatTaxRate: input.data.flatTaxRate,                                                          │ │
│ │             updatedAt: new Date(),                                                                        │ │
│ │           },                                                                                              │ │
│ │           create: {                                                                                       │ │
│ │             countryId: input.countryId,                                                                   │ │
│ │             taxSystemName: input.data.taxSystemName || "National Tax System",                             │ │
│ │             taxAuthority: input.data.taxAuthority || "Tax Authority",                                     │ │
│ │             fiscalYear: input.data.fiscalYear || "calendar",                                              │ │
│ │             taxCode: input.data.taxCode,                                                                  │ │
│ │             baseRate: input.data.baseRate || 0,                                                           │ │
│ │             progressiveTax: input.data.progressiveTax ?? true,                                            │ │
│ │             flatTaxRate: input.data.flatTaxRate,                                                          │ │
│ │           },                                                                                              │ │
│ │         });                                                                                               │ │
│ │                                                                                                           │ │
│ │         return {                                                                                          │ │
│ │           success: true,                                                                                  │ │
│ │           data: taxSystem,                                                                                │ │
│ │           message: "Tax system autosaved successfully",                                                   │ │
│ │         };                                                                                                │ │
│ │       } catch (error) {                                                                                   │ │
│ │         console.error("[TaxSystem API] Autosave failed:", error);                                         │ │
│ │         throw new Error(                                                                                  │ │
│ │           `Failed to autosave tax system: ${error instanceof Error ? error.message : "Unknown error"}`    │ │
│ │         );                                                                                                │ │
│ │       }                                                                                                   │ │
│ │     }),                                                                                                   │ │
│ │                                                                                                           │ │
│ │ ---                                                                                                       │ │
│ │ Phase 5: Create Government Autosave Hook (25 min)                                                         │ │
│ │                                                                                                           │ │
│ │ File: /src/hooks/useGovernmentAutoSync.ts (NEW FILE)                                                      │ │
│ │                                                                                                           │ │
│ │ Create complete autosave hook (similar to national identity)                                              │ │
│ │ "use client";                                                                                             │ │
│ │                                                                                                           │ │
│ │ import { useState, useEffect, useRef, useCallback } from "react";                                         │ │
│ │ import { api } from "~/trpc/react";                                                                       │ │
│ │                                                                                                           │ │
│ │ interface GovernmentData {                                                                                │ │
│ │   governmentName?: string;                                                                                │ │
│ │   governmentType?: string;                                                                                │ │
│ │   headOfState?: string;                                                                                   │ │
│ │   headOfGovernment?: string;                                                                              │ │
│ │   legislature?: string;                                                                                   │ │
│ │   judiciary?: string;                                                                                     │ │
│ │   departments?: any[];                                                                                    │ │
│ │   budgetAllocations?: any[];                                                                              │ │
│ │ }                                                                                                         │ │
│ │                                                                                                           │ │
│ │ interface AutoSyncOptions {                                                                               │ │
│ │   enabled?: boolean;                                                                                      │ │
│ │   debounceMs?: number;                                                                                    │ │
│ │   onSyncSuccess?: () => void;                                                                             │ │
│ │   onSyncError?: (error: string) => void;                                                                  │ │
│ │ }                                                                                                         │ │
│ │                                                                                                           │ │
│ │ interface AutoSyncState {                                                                                 │ │
│ │   isSyncing: boolean;                                                                                     │ │
│ │   lastSyncTime: Date | null;                                                                              │ │
│ │   pendingChanges: boolean;                                                                                │ │
│ │   syncError: string | null;                                                                               │ │
│ │ }                                                                                                         │ │
│ │                                                                                                           │ │
│ │ export function useGovernmentAutoSync(                                                                    │ │
│ │   countryId: string | undefined,                                                                          │ │
│ │   governmentData: GovernmentData,                                                                         │ │
│ │   options: AutoSyncOptions = {}                                                                           │ │
│ │ ) {                                                                                                       │ │
│ │   const {                                                                                                 │ │
│ │     enabled = true,                                                                                       │ │
│ │     debounceMs = 15000, // 15 seconds                                                                     │ │
│ │     onSyncSuccess,                                                                                        │ │
│ │     onSyncError,                                                                                          │ │
│ │   } = options;                                                                                            │ │
│ │                                                                                                           │ │
│ │   const [syncState, setSyncState] = useState<AutoSyncState>({                                             │ │
│ │     isSyncing: false,                                                                                     │ │
│ │     lastSyncTime: null,                                                                                   │ │
│ │     pendingChanges: false,                                                                                │ │
│ │     syncError: null,                                                                                      │ │
│ │   });                                                                                                     │ │
│ │                                                                                                           │ │
│ │   const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);                                           │ │
│ │   const previousDataRef = useRef<GovernmentData>(governmentData);                                         │ │
│ │                                                                                                           │ │
│ │   // API mutation                                                                                         │ │
│ │   const autosaveMutation = api.government.autosave.useMutation({                                          │ │
│ │     onSuccess: () => {                                                                                    │ │
│ │       setSyncState((prev) => ({                                                                           │ │
│ │         ...prev,                                                                                          │ │
│ │         isSyncing: false,                                                                                 │ │
│ │         lastSyncTime: new Date(),                                                                         │ │
│ │         pendingChanges: false,                                                                            │ │
│ │         syncError: null,                                                                                  │ │
│ │       }));                                                                                                │ │
│ │       onSyncSuccess?.();                                                                                  │ │
│ │     },                                                                                                    │ │
│ │     onError: (error) => {                                                                                 │ │
│ │       setSyncState((prev) => ({                                                                           │ │
│ │         ...prev,                                                                                          │ │
│ │         isSyncing: false,                                                                                 │ │
│ │         syncError: error.message,                                                                         │ │
│ │       }));                                                                                                │ │
│ │       onSyncError?.(error.message);                                                                       │ │
│ │     },                                                                                                    │ │
│ │   });                                                                                                     │ │
│ │                                                                                                           │ │
│ │   // Track changes and trigger debounced save                                                             │ │
│ │   useEffect(() => {                                                                                       │ │
│ │     if (!enabled || !countryId) return;                                                                   │ │
│ │                                                                                                           │ │
│ │     const hasChanges = JSON.stringify(governmentData) !== JSON.stringify(previousDataRef.current);        │ │
│ │                                                                                                           │ │
│ │     if (hasChanges) {                                                                                     │ │
│ │       setSyncState((prev) => ({ ...prev, pendingChanges: true }));                                        │ │
│ │                                                                                                           │ │
│ │       if (debounceTimerRef.current) {                                                                     │ │
│ │         clearTimeout(debounceTimerRef.current);                                                           │ │
│ │       }                                                                                                   │ │
│ │                                                                                                           │ │
│ │       debounceTimerRef.current = setTimeout(() => {                                                       │ │
│ │         handleAutoSync();                                                                                 │ │
│ │       }, debounceMs);                                                                                     │ │
│ │     }                                                                                                     │ │
│ │                                                                                                           │ │
│ │     previousDataRef.current = governmentData;                                                             │ │
│ │                                                                                                           │ │
│ │     return () => {                                                                                        │ │
│ │       if (debounceTimerRef.current) {                                                                     │ │
│ │         clearTimeout(debounceTimerRef.current);                                                           │ │
│ │       }                                                                                                   │ │
│ │     };                                                                                                    │ │
│ │   }, [governmentData, enabled, countryId, debounceMs]);                                                   │ │
│ │                                                                                                           │ │
│ │   const handleAutoSync = useCallback(async () => {                                                        │ │
│ │     if (!countryId || !enabled) return;                                                                   │ │
│ │                                                                                                           │ │
│ │     setSyncState((prev) => ({ ...prev, isSyncing: true }));                                               │ │
│ │                                                                                                           │ │
│ │     try {                                                                                                 │ │
│ │       await autosaveMutation.mutateAsync({                                                                │ │
│ │         countryId,                                                                                        │ │
│ │         data: governmentData,                                                                             │ │
│ │       });                                                                                                 │ │
│ │     } catch (error) {                                                                                     │ │
│ │       console.warn("Government autosave failed:", error);                                                 │ │
│ │     }                                                                                                     │ │
│ │   }, [countryId, enabled, governmentData]);                                                               │ │
│ │                                                                                                           │ │
│ │   const syncNow = useCallback(async () => {                                                               │ │
│ │     if (debounceTimerRef.current) {                                                                       │ │
│ │       clearTimeout(debounceTimerRef.current);                                                             │ │
│ │     }                                                                                                     │ │
│ │     await handleAutoSync();                                                                               │ │
│ │   }, [handleAutoSync]);                                                                                   │ │
│ │                                                                                                           │ │
│ │   useEffect(() => {                                                                                       │ │
│ │     return () => {                                                                                        │ │
│ │       if (debounceTimerRef.current) {                                                                     │ │
│ │         clearTimeout(debounceTimerRef.current);                                                           │ │
│ │       }                                                                                                   │ │
│ │     };                                                                                                    │ │
│ │   }, []);                                                                                                 │ │
│ │                                                                                                           │ │
│ │   return {                                                                                                │ │
│ │     syncState,                                                                                            │ │
│ │     syncNow,                                                                                              │ │
│ │     isEnabled: enabled,                                                                                   │ │
│ │   };                                                                                                      │ │
│ │ }                                                                                                         │ │
│ │                                                                                                           │ │
│ │ ---                                                                                                       │ │
│ │ Phase 6: Create Tax System Autosave Hook (25 min)                                                         │ │
│ │                                                                                                           │ │
│ │ File: /src/hooks/useTaxSystemAutoSync.ts (NEW FILE)                                                       │ │
│ │                                                                                                           │ │
│ │ Create complete autosave hook (copy structure from useGovernmentAutoSync)                                 │ │
│ │ // Similar structure to useGovernmentAutoSync but for tax system data                                     │ │
│ │ // Replace governmentData with taxSystemData                                                              │ │
│ │ // Use api.taxSystem.autosave mutation                                                                    │ │
│ │ // Same 15s debounce, same error handling                                                                 │ │
│ │                                                                                                           │ │
│ │ ---                                                                                                       │ │
│ │ Phase 7: Integrate Autosave into Government Builder (20 min)                                              │ │
│ │                                                                                                           │ │
│ │ File: /src/components/government/GovernmentBuilder.tsx (or relevant component)                            │ │
│ │                                                                                                           │ │
│ │ Add at top of component                                                                                   │ │
│ │ import { useGovernmentAutoSync } from "~/hooks/useGovernmentAutoSync";                                    │ │
│ │                                                                                                           │ │
│ │ // Inside component, after existing hooks                                                                 │ │
│ │ const { syncState, syncNow } = useGovernmentAutoSync(                                                     │ │
│ │   countryId,                                                                                              │ │
│ │   {                                                                                                       │ │
│ │     governmentName: structure?.governmentName,                                                            │ │
│ │     governmentType: structure?.governmentType,                                                            │ │
│ │     // ... map all government fields                                                                      │ │
│ │   },                                                                                                      │ │
│ │   {                                                                                                       │ │
│ │     enabled: !!countryId, // Only in edit mode                                                            │ │
│ │     onSyncSuccess: () => {                                                                                │ │
│ │       console.log("[GovernmentBuilder] Autosave successful");                                             │ │
│ │       toast.success("Government structure saved");                                                        │ │
│ │     },                                                                                                    │ │
│ │     onSyncError: (error) => {                                                                             │ │
│ │       console.error("[GovernmentBuilder] Autosave failed:", error);                                       │ │
│ │       toast.error("Failed to save government structure");                                                 │ │
│ │     },                                                                                                    │ │
│ │   }                                                                                                       │ │
│ │ );                                                                                                        │ │
│ │                                                                                                           │ │
│ │ Add autosave status indicator                                                                             │ │
│ │ {syncState.isSyncing && (                                                                                 │ │
│ │   <div className="text-xs text-blue-500">                                                                 │ │
│ │     <Loader2 className="h-3 w-3 animate-spin inline mr-1" />                                              │ │
│ │     Saving...                                                                                             │ │
│ │   </div>                                                                                                  │ │
│ │ )}                                                                                                        │ │
│ │                                                                                                           │ │
│ │ ---                                                                                                       │ │
│ │ Phase 8: Integrate Autosave into Tax Builder (20 min)                                                     │ │
│ │                                                                                                           │ │
│ │ File: /src/components/tax-system/TaxBuilder.tsx (or relevant component)                                   │ │
│ │                                                                                                           │ │
│ │ Same pattern as Government Builder                                                                        │ │
│ │ - Import useTaxSystemAutoSync                                                                             │ │
│ │ - Hook into tax data changes                                                                              │ │
│ │ - Show autosave status                                                                                    │ │
│ │ - Add toast notifications                                                                                 │ │
│ │                                                                                                           │ │
│ │ ---                                                                                                       │ │
│ │ Phase 9: Add Manual Save Button to Builder Header (25 min)                                                │ │
│ │                                                                                                           │ │
│ │ File: /src/app/builder/components/enhanced/sections/BuilderHeader.tsx                                     │ │
│ │                                                                                                           │ │
│ │ Change 1: Accept autosave refs as props                                                                   │ │
│ │ interface BuilderHeaderProps {                                                                            │ │
│ │   // ... existing props                                                                                   │ │
│ │   onManualSave?: () => Promise<void>; // NEW                                                              │ │
│ │   isSaving?: boolean; // NEW                                                                              │ │
│ │ }                                                                                                         │ │
│ │                                                                                                           │ │
│ │ Change 2: Add Save button to header                                                                       │ │
│ │ <Button                                                                                                   │ │
│ │   onClick={onManualSave}                                                                                  │ │
│ │   disabled={isSaving}                                                                                     │ │
│ │   variant="outline"                                                                                       │ │
│ │   className="ml-4"                                                                                        │ │
│ │ >                                                                                                         │ │
│ │   {isSaving ? (                                                                                           │ │
│ │     <>                                                                                                    │ │
│ │       <Loader2 className="h-4 w-4 animate-spin mr-2" />                                                   │ │
│ │       Saving...                                                                                           │ │
│ │     </>                                                                                                   │ │
│ │   ) : (                                                                                                   │ │
│ │     <>                                                                                                    │ │
│ │       <Save className="h-4 w-4 mr-2" />                                                                   │ │
│ │       Save Progress                                                                                       │ │
│ │     </>                                                                                                   │ │
│ │   )}                                                                                                      │ │
│ │ </Button>                                                                                                 │ │
│ │                                                                                                           │ │
│ │ Change 3: Wire up in parent component                                                                     │ │
│ │ // In AtomicBuilderPage or wherever BuilderHeader is used                                                 │ │
│ │ const handleManualSave = async () => {                                                                    │ │
│ │   setIsSaving(true);                                                                                      │ │
│ │   try {                                                                                                   │ │
│ │     // Call syncNow() for all active autosave hooks                                                       │ │
│ │     await Promise.all([                                                                                   │ │
│ │       nationalIdentitySync?.syncNow(),                                                                    │ │
│ │       governmentSync?.syncNow(),                                                                          │ │
│ │       taxSystemSync?.syncNow(),                                                                           │ │
│ │     ]);                                                                                                   │ │
│ │     toast.success("All changes saved successfully!");                                                     │ │
│ │   } catch (error) {                                                                                       │ │
│ │     toast.error("Failed to save some changes");                                                           │ │
│ │   } finally {                                                                                             │ │
│ │     setIsSaving(false);                                                                                   │ │
│ │   }                                                                                                       │ │
│ │ };                                                                                                        │ │
│ │                                                                                                           │ │
│ │ ---                                                                                                       │ │
│ │ Phase 10: Create Comprehensive Test Script (30 min)                                                       │ │
│ │                                                                                                           │ │
│ │ File: /ixwiki/public/projects/ixstats/test-builder-persistence.sh (NEW FILE)                              │ │
│ │                                                                                                           │ │
│ │ #!/bin/bash                                                                                               │ │
│ │                                                                                                           │ │
│ │ # Builder Persistence & Autosave Test Script                                                              │ │
│ │ # Tests all autosave functionality and data persistence                                                   │ │
│ │                                                                                                           │ │
│ │ set -e                                                                                                    │ │
│ │                                                                                                           │ │
│ │ RED='\033[0;31m'                                                                                          │ │
│ │ GREEN='\033[0;32m'                                                                                        │ │
│ │ YELLOW='\033[1;33m'                                                                                       │ │
│ │ BLUE='\033[0;34m'                                                                                         │ │
│ │ NC='\033[0m'                                                                                              │ │
│ │                                                                                                           │ │
│ │ TESTS_PASSED=0                                                                                            │ │
│ │ TESTS_FAILED=0                                                                                            │ │
│ │                                                                                                           │ │
│ │ print_test() {                                                                                            │ │
│ │     echo -e "${YELLOW}TEST:${NC} $1"                                                                      │ │
│ │ }                                                                                                         │ │
│ │                                                                                                           │ │
│ │ print_pass() {                                                                                            │ │
│ │     echo -e "${GREEN}✓ PASS:${NC} $1"                                                                     │ │
│ │     ((TESTS_PASSED++))                                                                                    │ │
│ │ }                                                                                                         │ │
│ │                                                                                                           │ │
│ │ print_fail() {                                                                                            │ │
│ │     echo -e "${RED}✗ FAIL:${NC} $1"                                                                       │ │
│ │     ((TESTS_FAILED++))                                                                                    │ │
│ │ }                                                                                                         │ │
│ │                                                                                                           │ │
│ │ # Test 1: National Identity Autosave                                                                      │ │
│ │ test_national_identity_autosave() {                                                                       │ │
│ │     print_test "Testing National Identity autosave persistence"                                           │ │
│ │                                                                                                           │ │
│ │     COUNT=$(PGPASSWORD=postgres psql -h localhost -p 5433 -U postgres -d ixstats \                        │ │
│ │         -c "SELECT COUNT(*) FROM \"NationalIdentity\";" -t 2>/dev/null)                                   │ │
│ │                                                                                                           │ │
│ │     if [ "$COUNT" -gt 0 ]; then                                                                           │ │
│ │         print_pass "National Identity records found: $COUNT"                                              │ │
│ │     else                                                                                                  │ │
│ │         print_fail "No National Identity records in database"                                             │ │
│ │     fi                                                                                                    │ │
│ │ }                                                                                                         │ │
│ │                                                                                                           │ │
│ │ # Test 2: Government Structure Persistence                                                                │ │
│ │ test_government_persistence() {                                                                           │ │
│ │     print_test "Testing Government Structure persistence"                                                 │ │
│ │                                                                                                           │ │
│ │     COUNT=$(PGPASSWORD=postgres psql -h localhost -p 5433 -U postgres -d ixstats \                        │ │
│ │         -c "SELECT COUNT(*) FROM \"GovernmentStructure\";" -t 2>/dev/null)                                │ │
│ │                                                                                                           │ │
│ │     if [ "$COUNT" -gt 0 ]; then                                                                           │ │
│ │         print_pass "Government structures found: $COUNT"                                                  │ │
│ │     else                                                                                                  │ │
│ │         print_fail "No Government structures in database"                                                 │ │
│ │     fi                                                                                                    │ │
│ │ }                                                                                                         │ │
│ │                                                                                                           │ │
│ │ # Test 3: Tax System Persistence                                                                          │ │
│ │ test_tax_system_persistence() {                                                                           │ │
│ │     print_test "Testing Tax System persistence"                                                           │ │
│ │                                                                                                           │ │
│ │     COUNT=$(PGPASSWORD=postgres psql -h localhost -p 5433 -U postgres -d ixstats \                        │ │
│ │         -c "SELECT COUNT(*) FROM \"TaxSystem\";" -t 2>/dev/null)                                          │ │
│ │                                                                                                           │ │
│ │     if [ "$COUNT" -gt 0 ]; then                                                                           │ │
│ │         print_pass "Tax systems found: $COUNT"                                                            │ │
│ │     else                                                                                                  │ │
│ │         print_fail "No Tax systems in database"                                                           │ │
│ │     fi                                                                                                    │ │
│ │ }                                                                                                         │ │
│ │                                                                                                           │ │
│ │ # Test 4: tRPC Autosave Endpoints                                                                         │ │
│ │ test_trpc_endpoints() {                                                                                   │ │
│ │     print_test "Testing tRPC autosave endpoints availability"                                             │ │
│ │                                                                                                           │ │
│ │     # This would need authentication, so just check server is running                                     │ │
│ │     HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}"                                                    │ │
│ │ "http://localhost:3550/projects/ixstats/api/trpc/nationalIdentity.autosave" 2>/dev/null || echo "000")    │ │
│ │                                                                                                           │ │
│ │     if [ "$HTTP_CODE" != "000" ]; then                                                                    │ │
│ │         print_pass "tRPC endpoints responding (HTTP $HTTP_CODE)"                                          │ │
│ │     else                                                                                                  │ │
│ │         print_fail "tRPC endpoints not responding"                                                        │ │
│ │     fi                                                                                                    │ │
│ │ }                                                                                                         │ │
│ │                                                                                                           │ │
│ │ # Test 5: Recent Autosave Activity                                                                        │ │
│ │ test_recent_autosaves() {                                                                                 │ │
│ │     print_test "Checking for recent autosave activity in logs"                                            │ │
│ │                                                                                                           │ │
│ │     RECENT_SAVES=$(grep -r "autosave" /ixwiki/public/projects/ixstats/logs/users/ 2>/dev/null | wc -l ||  │ │
│ │ echo "0")                                                                                                 │ │
│ │                                                                                                           │ │
│ │     if [ "$RECENT_SAVES" -gt 0 ]; then                                                                    │ │
│ │         print_pass "Found $RECENT_SAVES autosave operations in logs"                                      │ │
│ │     else                                                                                                  │ │
│ │         print_fail "No autosave operations found in logs"                                                 │ │
│ │     fi                                                                                                    │ │
│ │ }                                                                                                         │ │
│ │                                                                                                           │ │
│ │ # Main execution                                                                                          │ │
│ │ echo -e "${GREEN}╔═══════════════════════════════════════════╗${NC}"                                      │ │
│ │ echo -e "${GREEN}║  Builder Persistence Test Suite          ║${NC}"                                       │ │
│ │ echo -e "${GREEN}╚═══════════════════════════════════════════╝${NC}\n"                                    │ │
│ │                                                                                                           │ │
│ │ test_national_identity_autosave                                                                           │ │
│ │ test_government_persistence                                                                               │ │
│ │ test_tax_system_persistence                                                                               │ │
│ │ test_trpc_endpoints                                                                                       │ │
│ │ test_recent_autosaves                                                                                     │ │
│ │                                                                                                           │ │
│ │ echo -e "\n${BLUE}═══════════════════════════════════════════${NC}"                                       │ │
│ │ echo -e "${GREEN}Tests Passed: $TESTS_PASSED${NC}"                                                        │ │
│ │ echo -e "${RED}Tests Failed: $TESTS_FAILED${NC}"                                                          │ │
│ │ echo -e "${BLUE}═══════════════════════════════════════════${NC}\n"                                       │ │
│ │                                                                                                           │ │
│ │ if [ "$TESTS_FAILED" -eq 0 ]; then                                                                        │ │
│ │     echo -e "${GREEN}✓ ALL PERSISTENCE TESTS PASSED${NC}\n"                                               │ │
│ │     exit 0                                                                                                │ │
│ │ else                                                                                                      │ │
│ │     echo -e "${RED}⚠ SOME TESTS FAILED${NC}\n"                                                            │ │
│ │     exit 1                                                                                                │ │
│ │ fi                                                                                                        │ │
│ │                                                                                                           │ │
│ │ ---                                                                                                       │ │
│ │ Phase 11: Final Validation (30 min)                                                                       │ │
│ │                                                                                                           │ │
│ │ Validation Checklist                                                                                      │ │
│ │                                                                                                           │ │
│ │ Test 1: National Identity                                                                                 │ │
│ │ - Create new country in builder                                                                           │ │
│ │ - Edit national identity fields                                                                           │ │
│ │ - Wait 15 seconds                                                                                         │ │
│ │ - Check database for persisted data                                                                       │ │
│ │ - Refresh page                                                                                            │ │
│ │ - Verify data reloads correctly                                                                           │ │
│ │                                                                                                           │ │
│ │ Test 2: Government                                                                                        │ │
│ │ - Edit government structure                                                                               │ │
│ │ - Wait 15 seconds                                                                                         │ │
│ │ - Check database                                                                                          │ │
│ │ - Refresh page                                                                                            │ │
│ │ - Verify persistence                                                                                      │ │
│ │                                                                                                           │ │
│ │ Test 3: Tax System                                                                                        │ │
│ │ - Configure tax brackets                                                                                  │ │
│ │ - Wait 15 seconds                                                                                         │ │
│ │ - Check database                                                                                          │ │
│ │ - Refresh page                                                                                            │ │
│ │ - Verify persistence                                                                                      │ │
│ │                                                                                                           │ │
│ │ Test 4: Manual Save                                                                                       │ │
│ │ - Click "Save Progress" button                                                                            │ │
│ │ - Verify immediate save (no 15s wait)                                                                     │ │
│ │ - Check all tables updated                                                                                │ │
│ │ - Verify toast notifications                                                                              │ │
│ │                                                                                                           │ │
│ │ Test 5: Edit Mode                                                                                         │ │
│ │ - Access builder with mode=edit&countryId=xxx                                                             │ │
│ │ - Verify all data loads                                                                                   │ │
│ │ - Make changes                                                                                            │ │
│ │ - Verify autosave works                                                                                   │ │
│ │ - Refresh                                                                                                 │ │
│ │ - Verify changes persist                                                                                  │ │
│ │                                                                                                           │ │
│ │ ---                                                                                                       │ │
│ │ File Summary                                                                                              │ │
│ │                                                                                                           │ │
│ │ New Files (3)                                                                                             │ │
│ │                                                                                                           │ │
│ │ 1. /src/hooks/useGovernmentAutoSync.ts - Government autosave hook                                         │ │
│ │ 2. /src/hooks/useTaxSystemAutoSync.ts - Tax autosave hook                                                 │ │
│ │ 3. /ixwiki/public/projects/ixstats/test-builder-persistence.sh - Test script                              │ │
│ │                                                                                                           │ │
│ │ Modified Files (6)                                                                                        │ │
│ │                                                                                                           │ │
│ │ 1. /src/hooks/useNationalIdentityAutoSync.ts - Fix dependencies                                           │ │
│ │ 2. /src/app/builder/hooks/useBuilderState.ts - Add edit mode loading                                      │ │
│ │ 3. /src/server/api/routers/government.ts - Add autosave mutation                                          │ │
│ │ 4. /src/server/api/routers/taxSystem.ts - Add autosave mutation                                           │ │
│ │ 5. /src/app/builder/components/enhanced/sections/BuilderHeader.tsx - Add save button                      │ │
│ │ 6. /src/components/government/GovernmentBuilder.tsx - Integrate autosave                                  │ │
│ │ 7. /src/components/tax-system/TaxBuilder.tsx - Integrate autosave                                         │ │
│ │                                                                                                           │ │
│ │ ---                                                                                                       │ │
│ │ Risk Mitigation                                                                                           │ │
│ │                                                                                                           │ │
│ │ Database Load                                                                                             │ │
│ │ - 15-second debounce prevents excessive writes                                                            │ │
│ │ - Upsert operations prevent duplicate records                                                             │ │
│ │ - Indexes on countryId ensure fast queries                                                                │ │
│ │                                                                                                           │ │
│ │ Performance                                                                                               │ │
│ │ - tRPC queries use staleTime (5 min cache)                                                                │ │
│ │ - Only load data when enabled flag is true                                                                │ │
│ │ - Mutations are fire-and-forget (don't block UI)                                                          │ │
│ │                                                                                                           │ │
│ │ User Experience                                                                                           │ │
│ │ - Silent autosave in background                                                                           │ │
│ │ - Manual save button for instant save                                                                     │ │
│ │ - Toast notifications for feedback                                                                        │ │
│ │ - Loading states prevent confusion                                                                        │ │
│ │                                                                                                           │ │
│ │ Rollback Plan                                                                                             │ │
│ │ - All changes are additive (no breaking changes)                                                          │ │
│ │ - Can disable autosave with enabled: false                                                                │ │
│ │ - Original save-on-submit still works                                                                     │ │
│ │ - Database migrations not required                                                                        │ │
│ │                                                                                                           │ │
│ │ ---                                                                                                       │ │
│ │ Success Criteria                                                                                          │ │
│ │                                                                                                           │ │
│ │ ✅ Functional Requirements                                                                                 │ │
│ │ - All builder sections autosave every 15 seconds                                                          │ │
│ │ - Data persists to PostgreSQL database                                                                    │ │
│ │ - Page refresh loads existing data                                                                        │ │
│ │ - Manual save button works instantly                                                                      │ │
│ │ - Edit mode loads all country data                                                                        │ │
│ │                                                                                                           │ │
│ │ ✅ Performance Requirements                                                                                │ │
│ │ - Autosave completes in <500ms                                                                            │ │
│ │ - No UI blocking during save                                                                              │ │
│ │ - Database queries cached appropriately                                                                   │ │
│ │ - No infinite loops or excessive re-renders                                                               │ │
│ │                                                                                                           │ │
│ │ ✅ UX Requirements                                                                                         │ │
│ │ - Visual feedback for autosave status                                                                     │ │
│ │ - Toast notifications for success/error                                                                   │ │
│ │ - Save button disables during save                                                                        │ │
│ │ - Loading state during data fetch                                                                         │ │
│ │                                                                                                           │ │
│ │ ---                                                                                                       │ │
│ │ Timeline                                                                                                  │ │
│ │                                                                                                           │ │
│ │ | Phase | Task                             | Duration | Dependencies |                                    │ │
│ │ |-------|----------------------------------|----------|--------------|                                    │ │
│ │ | 1     | Fix autosave hook bugs           | 10 min   | None         |                                    │ │
│ │ | 2     | Implement edit mode loading      | 45 min   | Phase 1      |                                    │ │
│ │ | 3     | Add government autosave mutation | 30 min   | Phase 1      |                                    │ │
│ │ | 4     | Add tax autosave mutation        | 30 min   | Phase 1      |                                    │ │
│ │ | 5     | Create government autosave hook  | 25 min   | Phase 3      |                                    │ │
│ │ | 6     | Create tax autosave hook         | 25 min   | Phase 4      |                                    │ │
│ │ | 7     | Integrate govt autosave          | 20 min   | Phase 5      |                                    │ │
│ │ | 8     | Integrate tax autosave           | 20 min   | Phase 6      |                                    │ │
│ │ | 9     | Add manual save button           | 25 min   | Phases 5,6   |                                    │ │
│ │ | 10    | Create test script               | 30 min   | None         |                                    │ │
│ │ | 11    | Final validation                 | 30 min   | All          |                                    │ │
│ │                                                                                                           │ │
│ │ Total: ~4.5 hours (includes buffer time)                                                                  │ │
│ │                                                                                                           │ │
│ │ ---                                                                                                       │ │
│ │ Next Steps After Approval                                                                                 │ │
│ │                                                                                                           │ │
│ │ 1. Update image download user agent (already fixed)                                                       │ │
│ │ 2. Rebuild and restart server                                                                             │ │
│ │ 3. Implement phases 1-11 sequentially                                                                     │ │
│ │ 4. Run validation tests                                                                                   │ │
│ │ 5. Generate final report                                                                                  │ │
│ │ 6. Update FIX_SUMMARY documentation    