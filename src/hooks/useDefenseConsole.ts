"use client";

import { useCallback } from "react";
import { api, type RouterOutputs } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import type { BudgetShares, SharePreset } from "~/lib/military/model";

export type DefensePolicyView = RouterOutputs["security"]["getDefensePolicy"];
/** The owner's view: policy, budget, funding, warnings and every branch's derived state. */
export type OwnerDefense = Exclude<DefensePolicyView, { redacted: true }>;
/** What another nation sees: the public order of battle and the visible posture. */
export type RedactedDefense = Extract<DefensePolicyView, { redacted: true }>;
export type OwnerBranch = OwnerDefense["branches"][number];
export type ProcurementOrderRow = RouterOutputs["security"]["getProcurementOrders"][number];

export const isRedactedDefense = (view: DefensePolicyView): view is RedactedDefense =>
  "redacted" in view && view.redacted;

/** The nation's defense now: the owner's full view, or the redacted one for anyone else. */
export function useDefenseOverview(countryId: string) {
  const query = api.security.getDefensePolicy.useQuery(
    { countryId },
    { enabled: !!countryId, staleTime: 30_000 }
  );
  const data = query.data;
  return {
    isLoading: query.isLoading,
    owner: data && !isRedactedDefense(data) ? data : null,
    redacted: data && isRedactedDefense(data) ? data : null,
  };
}

/** Re-read everything a defense write can move: the overview, branches, orders and the threat picture. */
export function useDefenseRefresh(countryId: string) {
  const utils = api.useUtils();
  return useCallback(() => {
    void utils.security.getDefensePolicy.invalidate({ countryId });
    void utils.security.getMilitaryBranches.invalidate({ countryId });
    void utils.security.getProcurementOrders.invalidate();
    void utils.security.getSecurityAssessment.invalidate({ countryId });
    void utils.security.getBorderSecurity.invalidate({ countryId });
  }, [utils, countryId]);
}

/** Toast and refresh on success, toast the server's reason on failure. */
function useWriteHandlers(countryId: string) {
  const notify = useNotify();
  const refresh = useDefenseRefresh(countryId);
  return useCallback(
    (success: string) => ({
      onSuccess: () => {
        notify.success(success);
        refresh();
      },
      onError: (error: { message: string }) => notify.error(error.message),
    }),
    [notify, refresh]
  );
}

/** The national levers: budget split, manpower model, doctrine, alert, O&M priority and surge. */
export function useDefenseLevers(countryId: string) {
  const handlers = useWriteHandlers(countryId);
  const shares = api.security.setDefenseShares.useMutation(handlers("Budget split saved"));
  const manpower = api.security.setManpowerModel.useMutation(handlers("Manpower model saved"));
  const doctrine = api.security.setDoctrine.useMutation(handlers("Doctrine changed"));
  const alert = api.security.setAlertLevel.useMutation(handlers("Alert level ordered"));
  const omPriority = api.security.setOmPriority.useMutation(handlers("Upkeep priority changed"));
  const surge = api.security.setProductionSurge.useMutation(handlers("Production plan changed"));

  return {
    pending:
      shares.isPending ||
      manpower.isPending ||
      doctrine.isPending ||
      alert.isPending ||
      omPriority.isPending ||
      surge.isPending,
    saveShares: (next: BudgetShares) => shares.mutate({ countryId, shares: next }),
    applyPreset: (preset: SharePreset) => shares.mutate({ countryId, preset }),
    saveManpower: (input: { volunteerShare: number; serviceMonths: number; reserveYears: number }) =>
      manpower.mutate({ countryId, ...input }),
    setDoctrine: (value: OwnerDefense["policy"]["doctrine"]) =>
      doctrine.mutate({ countryId, doctrine: value }),
    setAlertLevel: (value: OwnerDefense["policy"]["alertLevel"]) =>
      alert.mutate({ countryId, alertLevel: value }),
    setOmPriority: (value: OwnerDefense["policy"]["omPriority"]) =>
      omPriority.mutate({ countryId, omPriority: value }),
    setSurge: (surging: boolean) => surge.mutate({ countryId, surging }),
  };
}

/** A branch's levers: effort share and target strength, mobilisation, and scrapping an asset. */
export function useBranchLevers(countryId: string) {
  const handlers = useWriteHandlers(countryId);
  const allocation = api.security.setBranchAllocation.useMutation(handlers("Branch plan saved"));
  const mobilise = api.security.mobiliseReserves.useMutation(
    handlers("Mobilisation ordered. Reservists report over the coming weeks.")
  );
  const demobilise = api.security.demobiliseReserves.useMutation(
    handlers("Reservists sent home")
  );
  const scrap = api.security.deleteMilitaryAsset.useMutation(handlers("Asset scrapped"));
  const updateAsset = api.security.updateMilitaryAsset.useMutation(handlers("Asset saved"));

  return {
    pending:
      allocation.isPending ||
      mobilise.isPending ||
      demobilise.isPending ||
      scrap.isPending ||
      updateAsset.isPending,
    saveAllocation: (input: { id: string; effortShare?: number; targetActive?: number | null }) =>
      allocation.mutate(input),
    mobilise: (branchId: string, reservists: number) => mobilise.mutate({ branchId, reservists }),
    demobilise: (branchId: string) => demobilise.mutate({ branchId }),
    scrapAsset: (id: string) => scrap.mutate({ id }),
    setAssetStatus: (id: string, status: "operational" | "maintenance" | "reserve") =>
      updateAsset.mutate({ id, asset: { status } }),
  };
}

/** Open procurement orders, placing one and cancelling one. */
export function useProcurement(countryId: string, enabled: boolean) {
  const handlers = useWriteHandlers(countryId);
  const orders = api.security.getProcurementOrders.useQuery(
    { countryId },
    { enabled: enabled && !!countryId, staleTime: 30_000 }
  );
  const place = api.security.orderProcurement.useMutation(
    handlers("Order placed. It enters service when it is delivered.")
  );
  const cancel = api.security.cancelProcurementOrder.useMutation(handlers("Order cancelled"));

  return {
    orders: orders.data ?? [],
    isLoading: orders.isLoading,
    placing: place.isPending,
    placeOrder: (
      input: {
        branchId: string;
        catalogKey: string;
        quantity: number;
        source: "domestic" | "import";
      },
      onPlaced?: () => void
    ) => place.mutate(input, { onSuccess: () => onPlaced?.() }),
    cancelOrder: (orderId: string) => cancel.mutate({ countryId, orderId }),
  };
}
