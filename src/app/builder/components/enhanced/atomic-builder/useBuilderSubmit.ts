"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "~/context/auth-context";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { createUrl } from "~/lib/utils";
import { sanitizeEconomicInputs } from "../../../hooks/useBuilderState";
import { useBuilderContext } from "../context/BuilderStateContext";

export function useBuilderSubmit({
  isEditMode,
  countryId,
  warnings,
}: {
  isEditMode: boolean;
  countryId?: string;
  warnings?: {
    deltaWarning?: string | null;
    currencyChangeWarning?: string | null;
    gdpCapWarning?: string | null;
  };
}) {
  const { user } = useUser();
  const router = useRouter();
  const notify = useNotify();
  const { builderState, registerSubmit, unregisterSubmit } = useBuilderContext();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const submissionLockRef = useRef(false);

  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearBuilderDraftMutation = api.builderDraft.clear.useMutation();

  const createCountryMutation = api.countries.createCountry.useMutation({
    onSuccess: (country) => {
      try {
        if (typeof window !== "undefined") {
          localStorage.removeItem("builder_state");
          localStorage.removeItem("builder_last_saved");
        }
        clearBuilderDraftMutation.mutate();
      } catch {
        // Failed to clear saved state
      }

      console.log("[Builder] Country created successfully:", country.name);

      notify.success(
        "Nation Created Successfully!",
        `Welcome to ${country.name}! Redirecting to your country dashboard...`
      );

      setTimeout(() => {
        router.push(createUrl(`/mycountry`));
      }, 1000);
    },
    onError: (err: { message?: string }) => {
      const errorMessage = err?.message ?? "Failed to create country";
      setError(errorMessage);
      console.error("[Builder] Country creation failed:", errorMessage);

      if (errorMessage.includes("already exists")) {
        notify.error(
          "Country Already Exists",
          "A country with this name already exists. Please choose a different name."
        );
      } else if (errorMessage.includes("no assigned role")) {
        notify.error(
          "Account Setup Required",
          "Your account needs to be configured. Please sign out and sign in again, or contact support."
        );
      } else {
        notify.error("Failed to Create Nation", errorMessage);
      }

      submissionLockRef.current = false;
      setIsSubmitting(false);
    },
  });

  const updateCountryMutation = api.countries.updateCountry.useMutation({
    onSuccess: (country) => {
      try {
        if (typeof window !== "undefined") {
          localStorage.removeItem(`builder_state_${countryId}`);
          localStorage.removeItem(`builder_last_saved_${countryId}`);
        }
      } catch {
        // Failed to clear saved state
      }

      console.log("[Builder] Country updated successfully:", country.name);

      notify.success(
        "Country Updated Successfully!",
        `${country.name} has been updated. Redirecting to your dashboard...`
      );

      setTimeout(() => {
        router.push(createUrl(`/mycountry`));
      }, 1000);
    },
    onError: (err: { message?: string }) => {
      const errorMessage = err?.message ?? "Failed to update country";
      setError(errorMessage);
      console.error("[Builder] Country update failed:", errorMessage);
      notify.error("Failed to Update Country", errorMessage);

      submissionLockRef.current = false;
      setIsSubmitting(false);
    },
  });

  const executeSubmitCountry = useCallback(async () => {
    if (submissionLockRef.current || isSubmitting) {
      return;
    }

    const { economicInputs } = builderState;
    if (!economicInputs) {
      notify.error("Incomplete Data", "Missing required economic inputs.");
      return;
    }

    try {
      submissionLockRef.current = true;
      setIsSubmitting(true);

      const formattedGovComps = builderState.governmentComponents.map((comp) => ({
        componentType: comp,
      }));

      if (isEditMode) {
        if (!countryId) {
          throw new Error("Missing country ID for update");
        }

        console.log("[Builder] Updating country:", economicInputs.countryName);

        notify.info(
          "Updating Your Country",
          "Applying your changes to the country, government, and economic systems..."
        );

        await updateCountryMutation.mutateAsync({
          id: countryId,
          name: economicInputs.countryName || "Updated Nation",
          economicInputs: sanitizeEconomicInputs(economicInputs),
          governmentComponents: formattedGovComps,
          taxSystemData: builderState.taxSystemData,
          governmentStructure: builderState.governmentStructure,
          economyBuilderState: builderState.economyBuilderState || undefined,
        });
      } else {
        console.log("[Builder] Creating country:", economicInputs.countryName);

        notify.info(
          "Creating Your Nation",
          "Setting up your country, government, and economic systems..."
        );

        await createCountryMutation.mutateAsync({
          name: economicInputs.countryName || "New Nation",
          foundationCountry:
            builderState.selectedCountry?.name || builderState.selectedCountry?.countryCode || null,
          economicInputs: sanitizeEconomicInputs(economicInputs),
          governmentComponents: formattedGovComps,
          taxSystemData: builderState.taxSystemData,
          governmentStructure: builderState.governmentStructure,
          economyBuilderState: builderState.economyBuilderState || undefined,
          archetypeId: builderState.selectedArchetypeId || undefined,
        });
      }
      setIsConfirmModalOpen(false);
    } catch {
      submissionLockRef.current = false;
      setIsSubmitting(false);
    }
  }, [
    builderState,
    createCountryMutation,
    updateCountryMutation,
    isSubmitting,
    isEditMode,
    countryId,
    notify,
  ]);

  const handleCreateCountry = useCallback(async () => {
    if (submissionLockRef.current || isSubmitting) {
      console.warn(
        isEditMode
          ? "[Builder] Country update already in progress, ignoring duplicate request"
          : "[Builder] Country creation already in progress, ignoring duplicate request"
      );
      notify.warning(
        isEditMode ? "Update In Progress" : "Creation In Progress",
        isEditMode
          ? "Please wait while your country is being updated..."
          : "Please wait while your nation is being created..."
      );
      return;
    }

    if (!builderState.economicInputs || !user) {
      const errorMsg = "Missing required data for country " + (isEditMode ? "update" : "creation");
      setError(errorMsg);
      notify.error(
        "Incomplete Data",
        isEditMode
          ? "Please complete all required fields before updating your country."
          : "Please complete all required fields before creating your nation."
      );
      return;
    }

    const hasWarnings = Boolean(
      warnings?.deltaWarning ||
      warnings?.currencyChangeWarning ||
      warnings?.gdpCapWarning
    );

    if (!isEditMode && !hasWarnings) {
      await executeSubmitCountry();
      return;
    }

    setIsVerified(false);
    setIsConfirmModalOpen(true);
  }, [builderState, user, isSubmitting, isEditMode, notify, warnings, executeSubmitCountry]);

  useEffect(() => {
    const isMutating =
      createCountryMutation.isPending || updateCountryMutation.isPending || isSubmitting;
    registerSubmit(handleCreateCountry, !!isMutating);
    return () => {
      unregisterSubmit(handleCreateCountry);
    };
  }, [
    handleCreateCountry,
    createCountryMutation.isPending,
    updateCountryMutation.isPending,
    isSubmitting,
    registerSubmit,
    unregisterSubmit,
  ]);

  return {
    isSubmitting,
    isConfirmModalOpen,
    setIsConfirmModalOpen,
    isVerified,
    setIsVerified,
    error,
    executeSubmitCountry,
    handleCreateCountry,
  };
}
