/**
 * The admin side of the IIWiki panel (/admin/iiwiki): status (the switch, the config every IIWiki call uses, the
 * breaker, the last live test and every place the app reaches IIWiki), the switch flip and the breaker reset (both
 * written to AdminAuditLog and DMed to the admin), and the live test.
 */
import type { PrismaClient } from "@prisma/client";
import { sendAdminDm } from "~/lib/discord/admin-dm";
import { DEFAULT_USER_AGENT, getMediaWikiApiUrl } from "~/lib/wiki-os/config";
import { lastIiwikiProbe, runIiwikiProbe, type ProbeRun } from "~/lib/wiki-os/iiwiki-probe";
import {
  IIWIKI_FEATURES,
  IIWIKI_FEATURE_IDS,
  refreshIiwikiSwitch,
  setIiwikiSwitch,
  type IiwikiSwitchState,
} from "~/lib/wiki-os/iiwiki-switch";
import { IIWIKI_TOUCHPOINTS, type IiwikiTouchpoint } from "~/lib/wiki-os/iiwiki-touchpoints";
import {
  PROXY_LANE_LIMITS,
  SISTER_GUARD_OPTIONS,
  upstreamGuard,
  type CircuitStatus,
} from "~/lib/wiki-os/upstream-guard";
import { SISTER_WIKI_HOSTS, sisterWikiApiUrl } from "~/lib/wiki-os/wiki-hosts";

type Actor = { id: string; name: string };
type AuditDb = Pick<PrismaClient, "adminAuditLog">;

export interface IiwikiStatus {
  switch: IiwikiSwitchState;
  features: { id: keyof typeof IIWIKI_FEATURES; label: string }[];
  config: {
    origin: string;
    directApiUrl: string;
    /** What the app's calls use: the development relay in development, else the same as `directApiUrl`. */
    appApiUrl: string;
    viaRelay: boolean;
    userAgent: string;
    limits: {
      maxConcurrent: number;
      perMinute: number;
      proxyMaxConcurrent: number;
      proxyPerMinute: number;
    };
  };
  /** The breaker of the host the app's calls go to, in this server process. */
  circuit: CircuitStatus & { host: string };
  lastProbe: ProbeRun | null;
  touchpoints: IiwikiTouchpoint[];
}

const appHost = () => new URL(getMediaWikiApiUrl("iiwiki")).host;

export async function getIiwikiStatus(): Promise<IiwikiStatus> {
  const state = await refreshIiwikiSwitch(true);
  const directApiUrl = sisterWikiApiUrl(SISTER_WIKI_HOSTS.iiwiki);
  const appApiUrl = getMediaWikiApiUrl("iiwiki");
  return {
    switch: state,
    features: IIWIKI_FEATURE_IDS.map((id) => ({ id, label: IIWIKI_FEATURES[id] })),
    config: {
      origin: SISTER_WIKI_HOSTS.iiwiki.origin,
      directApiUrl,
      appApiUrl,
      viaRelay: appApiUrl !== directApiUrl,
      userAgent: DEFAULT_USER_AGENT,
      limits: {
        maxConcurrent: SISTER_GUARD_OPTIONS.maxConcurrent,
        perMinute: SISTER_GUARD_OPTIONS.perMinute,
        proxyMaxConcurrent: PROXY_LANE_LIMITS.maxConcurrent,
        proxyPerMinute: PROXY_LANE_LIMITS.perMinute,
      },
    },
    circuit: { ...upstreamGuard.circuitStatus(appHost()), host: appHost() },
    lastProbe: lastIiwikiProbe(),
    touchpoints: IIWIKI_TOUCHPOINTS,
  };
}

/** Which switches differ between two states, for the audit row and the DM. */
export function describeSwitchChange(
  before: IiwikiSwitchState,
  after: IiwikiSwitchState
): string[] {
  const changes: string[] = [];
  if (before.enabled !== after.enabled) changes.push(`IIWiki ${after.enabled ? "on" : "off"}`);
  for (const id of IIWIKI_FEATURE_IDS) {
    if (before.features[id] !== after.features[id]) {
      changes.push(`${id} ${after.features[id] ? "on" : "off"}`);
    }
  }
  return changes;
}

export async function updateIiwikiSwitch(
  auditDb: AuditDb,
  actor: Actor,
  next: IiwikiSwitchState
): Promise<IiwikiSwitchState> {
  const before = await refreshIiwikiSwitch(true);
  const changes = describeSwitchChange(before, next);
  if (changes.length === 0) return before;
  const saved = await setIiwikiSwitch(next);
  await auditDb.adminAuditLog.create({
    data: {
      action: "iiwiki.switch.update",
      targetType: "iiwiki",
      targetId: "iiwiki_switch",
      targetName: "IIWiki switch",
      changes: JSON.stringify({ from: before, to: saved }),
      adminId: actor.id,
      adminName: actor.name,
    },
  });
  void dm(`IIWiki switch changed by ${actor.name}: ${changes.join(", ")}`);
  return saved;
}

export async function resetIiwikiCircuit(auditDb: AuditDb, actor: Actor): Promise<CircuitStatus> {
  const host = appHost();
  upstreamGuard.resetCircuit(host);
  await auditDb.adminAuditLog.create({
    data: {
      action: "iiwiki.circuit.reset",
      targetType: "iiwiki",
      targetId: host,
      targetName: "IIWiki breaker",
      changes: JSON.stringify({ host }),
      adminId: actor.id,
      adminName: actor.name,
    },
  });
  return upstreamGuard.circuitStatus(host);
}

export function runIiwikiLiveTest(): Promise<ProbeRun> {
  return runIiwikiProbe();
}

/** Fire-and-forget: a Discord hiccup must never fail a change that already happened. */
async function dm(message: string): Promise<void> {
  try {
    await sendAdminDm(message);
  } catch (error) {
    console.warn("[iiwiki] switch DM failed:", error instanceof Error ? error.message : error);
  }
}
