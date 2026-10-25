/**
 * Government approval is `Country.publicApproval` (0-100), the figure issues and directives move and the
 * overview Standing card shows. Every approval readout uses it; there is no second, party-derived figure.
 */

/** The approval KPI text: a rounded percentage, or a dash when the nation has no approval figure. */
export function approvalKpiValue(publicApproval: number | null | undefined): string {
  return typeof publicApproval === "number" && Number.isFinite(publicApproval)
    ? `${Math.round(publicApproval)}%`
    : "—";
}
