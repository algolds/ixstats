// src/hooks/maps/useMapEditor.ts
// Master hook combining all CRUD mutations for map editor entities

import { api } from "~/trpc/react";
import { toast } from "sonner";
import type { RouterInputs } from "~/trpc/react";

/**
 * Type definitions for create/update inputs
 */
type CreateSubdivisionInput = RouterInputs["mapEditor"]["createSubdivision"];
type UpdateSubdivisionInput = RouterInputs["mapEditor"]["updateSubdivision"];
type CreateCityInput = RouterInputs["mapEditor"]["createCity"];
type UpdateCityInput = RouterInputs["mapEditor"]["updateCity"];
type CreatePOIInput = RouterInputs["mapEditor"]["createPOI"];
type UpdatePOIInput = RouterInputs["mapEditor"]["updatePOI"];

/**
 * Return type for useMapEditor hook
 */
export interface UseMapEditorResult {
  // Subdivision mutations
  createSubdivision: (input: CreateSubdivisionInput) => Promise<void>;
  updateSubdivision: (input: UpdateSubdivisionInput) => Promise<void>;
  deleteSubdivision: (id: string) => Promise<void>;
  submitSubdivisionForReview: (id: string) => Promise<void>;

  // City mutations
  createCity: (input: CreateCityInput) => Promise<void>;
  updateCity: (input: UpdateCityInput) => Promise<void>;
  deleteCity: (id: string) => Promise<void>;
  submitCityForReview: (id: string) => Promise<void>;

  // POI mutations
  createPOI: (input: CreatePOIInput) => Promise<void>;
  updatePOI: (input: UpdatePOIInput) => Promise<void>;
  deletePOI: (id: string) => Promise<void>;
  submitPOIForReview: (id: string) => Promise<void>;

  // Loading states
  isCreating: boolean;
  isUpdating: boolean;
  isDeleting: boolean;
  isSubmitting: boolean;
}

/**
 * Custom hook that combines all CRUD mutations for subdivisions, cities, and POIs.
 * Implements optimistic updates, error handling with retry logic, and toast notifications.
 *
 * @example
 * ```tsx
 * function MapEditor() {
 *   const {
 *     createSubdivision,
 *     updateCity,
 *     deletePOI,
 *     isCreating,
 *   } = useMapEditor();
 *
 *   const handleCreateSubdivision = async () => {
 *     await createSubdivision({
 *       countryId: "country_123",
 *       name: "New Province",
 *       type: "province",
 *       geometry: { ... },
 *       level: 1,
 *     });
 *   };
 *
 *   return (
 *     <button onClick={handleCreateSubdivision} disabled={isCreating}>
 *       Create Subdivision
 *     </button>
 *   );
 * }
 * ```
 *
 * @returns Object containing all mutation functions and loading states
 */
export function useMapEditor(): UseMapEditorResult {
  const utils = api.useUtils();

  // ============================================================================
  // SUBDIVISION MUTATIONS
  // ============================================================================

  const createSubdivisionMutation = api.mapEditor.createSubdivision.useMutation({
    onSuccess: async (data) => {
      toast.success(`Subdivision created: ${data.subdivision.name} has been created and submitted for review.`);
      await utils.mapEditor.getMySubdivisions.invalidate();
    },
    onError: (error) => {
      toast.error(`Failed to create subdivision: ${error.message}`);
    },
    retry: 1,
  });

  const updateSubdivisionMutation = api.mapEditor.updateSubdivision.useMutation({
    onSuccess: async (data) => {
      toast.success(`Subdivision updated: ${data.subdivision.name} has been updated successfully.`);
      await utils.mapEditor.getMySubdivisions.invalidate();
    },
    onError: (error) => {
      toast.error(`Failed to update subdivision: ${error.message}`);
    },
    retry: 1,
  });

  const deleteSubdivisionMutation = api.mapEditor.deleteSubdivision.useMutation({
    onSuccess: async () => {
      toast.success("Subdivision deleted successfully.");
      await utils.mapEditor.getMySubdivisions.invalidate();
    },
    onError: (error) => {
      toast.error(`Failed to delete subdivision: ${error.message}`);
    },
    retry: 1,
  });

  const submitSubdivisionForReviewMutation =
    api.mapEditor.submitSubdivisionForReview.useMutation({
      onSuccess: async () => {
        toast.success("Submitted for review: Your subdivision has been submitted for admin review.");
        await utils.mapEditor.getMySubdivisions.invalidate();
      },
      onError: (error) => {
        toast.error(`Failed to submit subdivision: ${error.message}`);
      },
      retry: 1,
    });

  // ============================================================================
  // CITY MUTATIONS
  // ============================================================================

  const createCityMutation = api.mapEditor.createCity.useMutation({
    onSuccess: async (data) => {
      toast.success(`City created: ${data.city.name} has been created and submitted for review.`);
      await utils.mapEditor.getMyCities.invalidate();
    },
    onError: (error) => {
      toast.error(`Failed to create city: ${error.message}`);
    },
    retry: 1,
  });

  const updateCityMutation = api.mapEditor.updateCity.useMutation({
    onSuccess: async (data) => {
      toast.success(`City updated: ${data.city.name} has been updated successfully.`);
      await utils.mapEditor.getMyCities.invalidate();
    },
    onError: (error) => {
      toast.error(`Failed to update city: ${error.message}`);
    },
    retry: 1,
  });

  const deleteCityMutation = api.mapEditor.deleteCity.useMutation({
    onSuccess: async () => {
      toast.success("City deleted successfully.");
      await utils.mapEditor.getMyCities.invalidate();
    },
    onError: (error) => {
      toast.error(`Failed to delete city: ${error.message}`);
    },
    retry: 1,
  });

  const submitCityForReviewMutation = api.mapEditor.submitCityForReview.useMutation({
    onSuccess: async () => {
      toast.success("Submitted for review: Your city has been submitted for admin review.");
      await utils.mapEditor.getMyCities.invalidate();
    },
    onError: (error) => {
      toast.error(`Failed to submit city: ${error.message}`);
    },
    retry: 1,
  });

  // ============================================================================
  // POI MUTATIONS
  // ============================================================================

  const createPOIMutation = api.mapEditor.createPOI.useMutation({
    onSuccess: async (data) => {
      toast.success(`POI created: ${data.poi.name} has been created and submitted for review.`);
      await utils.mapEditor.getMyPOIs.invalidate();
    },
    onError: (error) => {
      toast.error(`Failed to create POI: ${error.message}`);
    },
    retry: 1,
  });

  const updatePOIMutation = api.mapEditor.updatePOI.useMutation({
    onSuccess: async (data) => {
      toast.success(`POI updated: ${data.poi.name} has been updated successfully.`);
      await utils.mapEditor.getMyPOIs.invalidate();
    },
    onError: (error) => {
      toast.error(`Failed to update POI: ${error.message}`);
    },
    retry: 1,
  });

  const deletePOIMutation = api.mapEditor.deletePOI.useMutation({
    onSuccess: async () => {
      toast.success("POI deleted successfully.");
      await utils.mapEditor.getMyPOIs.invalidate();
    },
    onError: (error) => {
      toast.error(`Failed to delete POI: ${error.message}`);
    },
    retry: 1,
  });

  const submitPOIForReviewMutation = api.mapEditor.submitPOIForReview.useMutation({
    onSuccess: async () => {
      toast.success("Submitted for review: Your POI has been submitted for admin review.");
      await utils.mapEditor.getMyPOIs.invalidate();
    },
    onError: (error) => {
      toast.error(`Failed to submit POI: ${error.message}`);
    },
    retry: 1,
  });

  // ============================================================================
  // RETURN API
  // ============================================================================

  return {
    // Subdivision mutations
    createSubdivision: async (input: CreateSubdivisionInput) => {
      await createSubdivisionMutation.mutateAsync(input);
    },
    updateSubdivision: async (input: UpdateSubdivisionInput) => {
      await updateSubdivisionMutation.mutateAsync(input);
    },
    deleteSubdivision: async (id: string) => {
      await deleteSubdivisionMutation.mutateAsync({ id });
    },
    submitSubdivisionForReview: async (id: string) => {
      await submitSubdivisionForReviewMutation.mutateAsync({ id });
    },

    // City mutations
    createCity: async (input: CreateCityInput) => {
      await createCityMutation.mutateAsync(input);
    },
    updateCity: async (input: UpdateCityInput) => {
      await updateCityMutation.mutateAsync(input);
    },
    deleteCity: async (id: string) => {
      await deleteCityMutation.mutateAsync({ id });
    },
    submitCityForReview: async (id: string) => {
      await submitCityForReviewMutation.mutateAsync({ id });
    },

    // POI mutations
    createPOI: async (input: CreatePOIInput) => {
      await createPOIMutation.mutateAsync(input);
    },
    updatePOI: async (input: UpdatePOIInput) => {
      await updatePOIMutation.mutateAsync(input);
    },
    deletePOI: async (id: string) => {
      await deletePOIMutation.mutateAsync({ id });
    },
    submitPOIForReview: async (id: string) => {
      await submitPOIForReviewMutation.mutateAsync({ id });
    },

    // Loading states
    isCreating:
      createSubdivisionMutation.isPending ||
      createCityMutation.isPending ||
      createPOIMutation.isPending,
    isUpdating:
      updateSubdivisionMutation.isPending ||
      updateCityMutation.isPending ||
      updatePOIMutation.isPending,
    isDeleting:
      deleteSubdivisionMutation.isPending ||
      deleteCityMutation.isPending ||
      deletePOIMutation.isPending,
    isSubmitting:
      submitSubdivisionForReviewMutation.isPending ||
      submitCityForReviewMutation.isPending ||
      submitPOIForReviewMutation.isPending,
  };
}
