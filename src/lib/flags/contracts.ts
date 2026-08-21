/**
 * Canonical contracts for the unified flag resolution stack (Plan 164).
 */

export type FlagSource =
  | "provided"
  | "persistent-cache"
  | "memory-cache"
  | "commons"
  | "fictional-wiki"
  | "placeholder";

export type FlagFallbackPolicy = "commons-only" | "fictional-wiki";

export interface FlagResolution {
  countryName: string;
  normalizedName: string;
  flagUrl: string | null;
  source: FlagSource;
  cached: boolean;
  isPlaceholder: boolean;
}

export interface FlagResolverStats {
  memoryCacheSize: number;
  inFlightRequests: number;
  hits: number;
  misses: number;
  placeholders: number;
}

export interface PersistentFlagCacheAdapter {
  get(normalizedName: string): Promise<string | null | undefined>;
  set(normalizedName: string, url: string | null, ttlMs?: number): Promise<void>;
  getAll?(): Promise<Record<string, string>>;
  clear?(): Promise<void>;
}

export interface FlagResolverOptions {
  fallbackPolicy?: FlagFallbackPolicy;
  providedUrl?: string | null;
}

export interface FlagResolver {
  resolve(
    countryName: string,
    options?: FlagResolverOptions
  ): Promise<FlagResolution>;
  resolveBatch(
    countryNames: readonly string[],
    options?: { fallbackPolicy?: FlagFallbackPolicy }
  ): Promise<ReadonlyMap<string, FlagResolution>>;
  peek(countryName: string): FlagResolution | null;
  prefetch(countryNames: readonly string[], options?: { fallbackPolicy?: FlagFallbackPolicy }): void;
  clear(): Promise<void>;
  stats(): FlagResolverStats;
}
