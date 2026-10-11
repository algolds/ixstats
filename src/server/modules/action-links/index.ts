import type { RewardDb, RewardInput } from "./rewards";

export { ActionLinkError, type ActionLinkErrorCode } from "./errors";
export {
  pickableActivities,
  pickableActivityWhere,
  syncPostActionLinks,
  validatePostActionTokens,
  type LinksDb,
} from "./links";
export {
  addPostToChain,
  createChain,
  myChains,
  removePostFromChain,
  reviewChain,
  reviewQueue,
  submitChain,
  type ChainActor,
  type ChainsDb,
} from "./chains";
export { appendChainToWiki, syncPendingChainWikis, type WikiSyncDb } from "./wiki-sync";

export type { RewardDb, RewardInput };

/**
 * Pays the links a post just created (see rewards.ts). Loaded on demand: the reward step pulls in the vault stack,
 * which a post without a linked action never needs, and the many suites that import the forum writes never load.
 */
export async function grantActionLinkRewards(db: RewardDb, input: RewardInput): Promise<number> {
  const { grantActionLinkRewards: grant } = await import("./rewards");
  return grant(db, input);
}
