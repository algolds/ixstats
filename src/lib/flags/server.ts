import "server-only";

export {
  ServerFlagResolver,
  serverFlagResolver,
} from "./flag-resolver.server";

export type {
  FlagSource,
  FlagFallbackPolicy,
  FlagResolution,
  FlagResolverStats,
  FlagResolverOptions,
  PersistentFlagCacheAdapter,
  FlagResolver,
} from "./contracts";

export {
  normalizeCountryName,
  normalizeFlagUrl,
  getFlagCandidateFileTitles,
} from "./normalization";
