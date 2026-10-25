/**
 * Policy → simulation bridge.
 *
 * An active policy moves the economy through a StorytellerEffect tagged `POLICY:<id>`: its
 * `gdpEffect` (percent) is a GDP level shift, so +2 means GDP per capita ends 2% higher. The
 * shift phases in over POLICY_PHASE_IN_YEARS from enactment and is kept while the policy is in
 * force. Ending the policy unwinds it from then on; the projected past never changes.
 */
import type { PrismaClient } from "@prisma/client";
import { StorytellerEffectType } from "~/lib/economy/calculations";
import { endStorytellerEffects, syncLevelEffects } from "~/lib/economy/storyteller-effects";

const POLICY_TAG = (policyId: string) => `POLICY:${policyId}`;

/** Max GDP level shift a single policy may exert (±5%), to keep the sim sane. */
const MAX_GDP_LEVEL_SHIFT = 0.05;

/** IxTime years over which a policy's GDP effect phases in. */
export const POLICY_PHASE_IN_YEARS = 1;

interface PolicyLike {
  id: string;
  countryId: string;
  name: string;
  gdpEffect?: number | null;
}

/** GDP level shift (decimal) for a policy's `gdpEffect` percent: +2 → 0.02, clamped to ±5%. */
export function policyGdpLevelShift(gdpEffect: number | null | undefined): number {
  const raw = (gdpEffect ?? 0) / 100;
  return Math.max(-MAX_GDP_LEVEL_SHIFT, Math.min(MAX_GDP_LEVEL_SHIFT, raw));
}

/**
 * Bring the policy's GDP level effect to its `gdpEffect`. Idempotent: an unchanged policy writes
 * nothing, a changed one appends the difference from now on (its nation's realm clock).
 */
export async function applyPolicyEffect(db: PrismaClient, policy: PolicyLike): Promise<void> {
  const value = policyGdpLevelShift(policy.gdpEffect);
  await syncLevelEffects(
    db,
    { createdBy: POLICY_TAG(policy.id) },
    value === 0
      ? []
      : [
          {
            countryId: policy.countryId,
            inputType: StorytellerEffectType.GDP_LEVEL_ADJUSTMENT,
            value,
            duration: POLICY_PHASE_IN_YEARS,
            description: `Active policy: ${policy.name}`,
            createdBy: POLICY_TAG(policy.id),
          },
        ]
  );
}

/** End the StorytellerEffect(s) tied to a policy, unwound from `now` (its nation's clock time). */
export async function clearPolicyEffect(
  db: PrismaClient,
  policyId: string,
  now: number
): Promise<void> {
  await endStorytellerEffects(db, { createdBy: POLICY_TAG(policyId) }, now);
}
