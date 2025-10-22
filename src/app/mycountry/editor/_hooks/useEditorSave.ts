"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { calculateScheduledDate, type ChangeType, type ImpactLevel } from "~/lib/change-impact-calculator";
import type { Country } from "@prisma/client";

interface ChangeTrackingChange {
  fieldPath: string;
  oldValue: unknown;
  newValue: unknown;
  fieldLabel: string;
  category: string;
  impact?: {
    changeType: ChangeType;
    impactLevel: ImpactLevel;
    warnings: string[];
  };
}

interface UseEditorSaveProps {
  countryId: string;
  changes: ChangeTrackingChange[];
  hasGovernmentChanges: boolean;
  hasEconomicChanges: boolean;
  hasTaxSystemChanges: boolean;
  pendingGovernmentData: any;
  pendingTaxSystemData: any;
  economicInputs: any;
  existingGovernment: any;
  existingTaxSystem: any;
  clearChanges: () => void;
  refetchCountry: () => Promise<any>;
}

export function useEditorSave({
  countryId,
  changes,
  hasGovernmentChanges,
  hasEconomicChanges,
  hasTaxSystemChanges,
  pendingGovernmentData,
  pendingTaxSystemData,
  economicInputs,
  existingGovernment,
  existingTaxSystem,
  clearChanges,
  refetchCountry
}: UseEditorSaveProps) {
  const [isSaving, setIsSaving] = useState(false);

  const utils = api.useUtils();
  const updateCountryMutation = api.countries.update.useMutation();
  const updateNationalIdentityMutation = api.nationalIdentity.update.useMutation();
  const createScheduledChangeMutation = api.scheduledChanges.createScheduledChange.useMutation();
  const updateGovernmentMutation = api.government.update.useMutation();
  const createGovernmentMutation = api.government.create.useMutation();
  const updateTaxSystemMutation = api.taxSystem.update.useMutation();
  const createTaxSystemMutation = api.taxSystem.create.useMutation();

  async function saveChanges() {
    setIsSaving(true);

    try {
      const instantChanges = changes.filter(c => c.impact?.changeType === "instant");
      const delayedChanges = changes.filter(c => c.impact?.changeType !== "instant");

      // Save instant country field changes
      if (instantChanges.length > 0) {
        const nationalIdentityFields = new Set(['officialName', 'motto', 'nationalAnthem', 'capitalCity', 'officialLanguages', 'currencyName', 'currencySymbol', 'demonym', 'governmentType']);

        const countryUpdates: Record<string, unknown> = {};
        const nationalIdentityUpdates: Record<string, unknown> = { countryId };

        instantChanges.forEach((change) => {
          if (nationalIdentityFields.has(change.fieldPath)) {
            const fieldName = change.fieldPath === 'currencyName' ? 'currency' : change.fieldPath;
            nationalIdentityUpdates[fieldName] = change.newValue;
          } else {
            countryUpdates[change.fieldPath] = change.newValue;
          }
        });

        if (Object.keys(countryUpdates).length > 0) {
          await updateCountryMutation.mutateAsync({ id: countryId, ...countryUpdates });
        }

        if (Object.keys(nationalIdentityUpdates).length > 1) {
          const { countryId: _, ...data } = nationalIdentityUpdates;
          await updateNationalIdentityMutation.mutateAsync({ countryId, data });
        }
      }

      // Schedule delayed changes
      for (const change of delayedChanges) {
        const scheduledFor = calculateScheduledDate(change.impact!.changeType, new Date());
        await createScheduledChangeMutation.mutateAsync({
          countryId,
          changeType: change.impact!.changeType,
          impactLevel: change.impact!.impactLevel,
          fieldPath: change.fieldPath,
          oldValue: JSON.stringify(change.oldValue),
          newValue: JSON.stringify(change.newValue),
          scheduledFor,
          warnings: change.impact!.warnings,
          metadata: { fieldLabel: change.fieldLabel, category: change.category },
        });
      }

      // Save government structure if changed
      if (hasGovernmentChanges && pendingGovernmentData) {
        if (existingGovernment) {
          await updateGovernmentMutation.mutateAsync({
            countryId,
            data: pendingGovernmentData
          });
        } else {
          await createGovernmentMutation.mutateAsync({
            countryId,
            data: pendingGovernmentData
          });
        }
      }

      // Save tax system if changed
      if (hasTaxSystemChanges && pendingTaxSystemData) {
        if (existingTaxSystem) {
          await updateTaxSystemMutation.mutateAsync({
            countryId,
            data: pendingTaxSystemData
          });
        } else {
          await createTaxSystemMutation.mutateAsync({
            countryId,
            data: pendingTaxSystemData
          });
        }
      }

      // Save economic data if changed
      if (hasEconomicChanges && economicInputs) {
        const economicData = {
          realGDPGrowthRate: economicInputs.coreIndicators.realGDPGrowthRate || 0,
          inflationRate: economicInputs.coreIndicators.inflationRate || 0,
          currencyExchangeRate: economicInputs.coreIndicators.currencyExchangeRate || 1.0,
          laborForceParticipationRate: economicInputs.laborEmployment.laborForceParticipationRate || 0,
          employmentRate: economicInputs.laborEmployment.employmentRate || 0,
          unemploymentRate: economicInputs.laborEmployment.unemploymentRate || 0,
          totalWorkforce: economicInputs.laborEmployment.totalWorkforce || 0,
          averageWorkweekHours: economicInputs.laborEmployment.averageWorkweekHours || 0,
          minimumWage: economicInputs.laborEmployment.minimumWage || 0,
          averageAnnualIncome: economicInputs.laborEmployment.averageAnnualIncome || 0,
          taxRevenueGDPPercent: economicInputs.fiscalSystem.taxRevenueGDPPercent || 0,
          governmentRevenueTotal: economicInputs.fiscalSystem.governmentRevenueTotal || 0,
          taxRevenuePerCapita: economicInputs.fiscalSystem.taxRevenuePerCapita || 0,
          governmentBudgetGDPPercent: economicInputs.fiscalSystem.governmentBudgetGDPPercent || 0,
          budgetDeficitSurplus: economicInputs.fiscalSystem.budgetDeficitSurplus || 0,
          internalDebtGDPPercent: economicInputs.fiscalSystem.internalDebtGDPPercent || 0,
          externalDebtGDPPercent: economicInputs.fiscalSystem.externalDebtGDPPercent || 0,
          totalDebtGDPRatio: economicInputs.fiscalSystem.totalDebtGDPRatio || 0,
          debtPerCapita: economicInputs.fiscalSystem.debtPerCapita || 0,
          interestRates: economicInputs.fiscalSystem.interestRates || 0,
          debtServiceCosts: economicInputs.fiscalSystem.debtServiceCosts || 0,
          povertyRate: economicInputs.incomeWealth.povertyRate || 0,
          incomeInequalityGini: economicInputs.incomeWealth.incomeInequalityGini || 0,
          socialMobilityIndex: economicInputs.incomeWealth.socialMobilityIndex || 0,
          totalGovernmentSpending: economicInputs.governmentSpending.totalSpending || 0,
          spendingGDPPercent: economicInputs.governmentSpending.spendingGDPPercent || 0,
          spendingPerCapita: economicInputs.governmentSpending.spendingPerCapita || 0,
          lifeExpectancy: economicInputs.demographics.lifeExpectancy || 0,
          urbanPopulationPercent: economicInputs.demographics.urbanRuralSplit?.urban || 0,
          ruralPopulationPercent: economicInputs.demographics.urbanRuralSplit?.rural || 0,
          literacyRate: economicInputs.demographics.literacyRate || 0,
        };

        await updateCountryMutation.mutateAsync({
          id: countryId,
          ...economicData
        });
      }

      clearChanges();
      await refetchCountry();
      await utils.countries.invalidate();
      await utils.government.invalidate();
      await utils.taxSystem.invalidate();

      const totalChanges = instantChanges.length + delayedChanges.length +
        (hasGovernmentChanges ? 1 : 0) +
        (hasEconomicChanges ? 1 : 0) +
        (hasTaxSystemChanges ? 1 : 0);

      const saveParts = [];
      if (instantChanges.length > 0) saveParts.push(`${instantChanges.length} instant`);
      if (delayedChanges.length > 0) saveParts.push(`${delayedChanges.length} scheduled`);
      if (hasEconomicChanges) saveParts.push('1 economic update');
      if (hasGovernmentChanges) saveParts.push('1 government update');
      if (hasTaxSystemChanges) saveParts.push('1 tax system update');

      return {
        success: true,
        message: `Success! ${totalChanges} change${totalChanges !== 1 ? 's' : ''} saved (${saveParts.join(', ')}).`
      };
    } catch (error) {
      console.error("Save failed:", error);
      return {
        success: false,
        message: "Failed to save changes."
      };
    } finally {
      setIsSaving(false);
    }
  }

  return {
    isSaving,
    saveChanges
  };
}
