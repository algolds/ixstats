/**
 * intelAlerts router — split across files by domain and recombined here.
 *
 * mergeRouters preserves every procedure at the top level, so the public API path
 * `api.intelAlerts.*` is byte-identical to the former monolith — no call sites change.
 *
 * The `evaluateThresholds` helper is also re-exported from this module so existing
 * imports (`import { evaluateThresholds } from "../alerts"` in
 * `intelligence/core/dashboard.ts`, and the dynamic import in
 * `countries/management.ts`) keep resolving to the same logical function.
 *
 * Domains:
 *  - actions:    alert acknowledgement and archival
 *  - thresholds: alert-threshold CRUD (get / update / delete)
 *  - crises:     active crisis events and response teams
 *  - security:   security threats, dashboard, and threat creation
 */
import { mergeRouters } from "~/server/api/trpc";
import { intelAlertsActionsRouter } from "./actions";
import { intelAlertsThresholdsRouter } from "./thresholds";
import { intelAlertsCrisesRouter } from "./crises";
import { intelAlertsSecurityRouter } from "./security";


export const intelAlertsRouter = mergeRouters(
  intelAlertsActionsRouter,
  intelAlertsThresholdsRouter,
  intelAlertsCrisesRouter,
  intelAlertsSecurityRouter
);
