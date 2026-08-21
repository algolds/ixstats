export type {
  FlagSource,
  FlagFallbackPolicy,
  FlagResolution,
  FlagResolverStats,
  FlagResolverOptions,
  FlagResolver,
} from "./contracts";

export {
  normalizeCountryName,
  normalizeFlagUrl,
  getFlagCandidateFileTitles,
} from "./normalization";
