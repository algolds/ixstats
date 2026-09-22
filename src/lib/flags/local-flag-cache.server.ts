import "server-only";

import * as fs from "fs";
import * as path from "path";
import type { PersistentFlagCacheAdapter } from "./contracts";
import { normalizeCountryName, normalizeFlagUrl } from "./normalization";
import { withBasePath } from "~/lib/base-path";
import economyData from "~/app/builder/lib/economy-data.json";

interface FlagMetadataFile {
  flags?: Record<string, { fileName?: string }>;
}

export class LocalFlagCacheAdapter implements PersistentFlagCacheAdapter {
  private cache = new Map<string, string>();
  private saveTimeout: NodeJS.Timeout | null = null;
  private isSaving = false;
  private cacheFilePath: string;

  constructor() {
    this.cacheFilePath = path.join(process.cwd(), "public", "flags", "flag-cache.json");
    this.initialize();
  }

  private initialize(): void {
    const flagsDir = path.join(process.cwd(), "public", "flags");

    // 1. Index local flag files present on disk in public/flags/
    const localDiskFiles = new Set<string>();
    if (fs.existsSync(flagsDir)) {
      try {
        const files = fs.readdirSync(flagsDir);
        for (const file of files) {
          localDiskFiles.add(file.toLowerCase());
        }
      } catch (err) {
        console.warn("[LocalFlagCache] Error reading flags directory:", err);
      }
    }

    // 2. Pre-populate from public/flags/metadata.json (fictional wiki & local flags)
    const metadataPath = path.join(flagsDir, "metadata.json");
    if (fs.existsSync(metadataPath)) {
      try {
        const raw = fs.readFileSync(metadataPath, "utf-8");
        const metadata: FlagMetadataFile = JSON.parse(raw);
        if (metadata.flags && typeof metadata.flags === "object") {
          for (const [key, entry] of Object.entries(metadata.flags)) {
            if (entry?.fileName && localDiskFiles.has(entry.fileName.toLowerCase())) {
              const normalized = normalizeCountryName(key);
              if (normalized) {
                this.cache.set(normalized, withBasePath(`/flags/${entry.fileName}`));
              }
            }
          }
        }
      } catch (err) {
        console.warn("[LocalFlagCache] Error loading metadata.json:", err);
      }
    }

    // 3. Pre-populate from economy-data.json (210 real-world benchmark countries)
    for (const item of economyData as Array<{ name: string; countryCode?: string; flag?: string }>) {
      if (!item.name) continue;
      const normName = normalizeCountryName(item.name);
      const code = item.countryCode?.trim().toLowerCase();

      // Check if a local file already exists in public/flags/
      let localFileName: string | null = null;
      const possibleNames = [
        code ? `${code}.svg` : null,
        code ? `${code}.png` : null,
        `${item.name.toLowerCase().replace(/\s+/g, "_")}.svg`,
        `${item.name.toLowerCase().replace(/\s+/g, "_")}.png`,
        `${item.name.toLowerCase().replace(/\s+/g, "_")}.jpg`,
      ].filter(Boolean) as string[];

      for (const candidate of possibleNames) {
        if (localDiskFiles.has(candidate.toLowerCase())) {
          localFileName = candidate;
          break;
        }
      }

      const flagUrl = localFileName
        ? withBasePath(`/flags/${localFileName}`)
        : item.flag || (code ? `https://flagcdn.com/w320/${code}.png` : null);

      if (flagUrl) {
        if (normName) this.cache.set(normName, flagUrl);
        if (code) this.cache.set(code, flagUrl);

        // Alias expansions
        if (item.name.includes(",")) {
          const mainPart = item.name.split(",")[0]?.trim();
          if (mainPart) {
            const normMain = normalizeCountryName(mainPart);
            if (!this.cache.has(normMain)) this.cache.set(normMain, flagUrl);
          }
        }
        if (normName === "russian federation") this.cache.set("russia", flagUrl);
        if (normName === "united states") {
          this.cache.set("usa", flagUrl);
          this.cache.set("us", flagUrl);
        }
        if (normName === "united kingdom") {
          this.cache.set("uk", flagUrl);
          this.cache.set("great britain", flagUrl);
        }
        if (normName === "korea, rep.") {
          this.cache.set("south korea", flagUrl);
          this.cache.set("republic of korea", flagUrl);
        }
        if (normName === "korea, dem. people's rep.") this.cache.set("north korea", flagUrl);
        if (normName === "syrian arab republic") this.cache.set("syria", flagUrl);
        if (normName === "turkiye") this.cache.set("turkey", flagUrl);
        if (normName === "venezuela, rb") this.cache.set("venezuela", flagUrl);
        if (normName === "slovak republic") this.cache.set("slovakia", flagUrl);
        if (normName === "kyrgyz republic") this.cache.set("kyrgyzstan", flagUrl);
        if (normName === "lao pdr") this.cache.set("laos", flagUrl);
      }
    }

    // 4. Overlay saved disk cache (public/flags/flag-cache.json)
    if (fs.existsSync(this.cacheFilePath)) {
      try {
        const raw = fs.readFileSync(this.cacheFilePath, "utf-8");
        const saved = JSON.parse(raw);
        if (saved && typeof saved === "object") {
          for (const [key, url] of Object.entries(saved)) {
            if (typeof url === "string" && url) {
              this.cache.set(key, url);
            }
          }
        }
      } catch (err) {
        console.warn("[LocalFlagCache] Error loading flag-cache.json:", err);
      }
    }
  }

  public async get(normalizedName: string): Promise<string | null | undefined> {
    if (!normalizedName) return null;
    const clean = normalizeCountryName(normalizedName);
    const hit = this.cache.get(clean) || this.cache.get(normalizedName);
    return hit ?? null;
  }

  public async set(normalizedName: string, url: string | null): Promise<void> {
    const validUrl = normalizeFlagUrl(url);
    if (!normalizedName || !validUrl) return;

    const clean = normalizeCountryName(normalizedName);
    this.cache.set(clean, validUrl);

    this.queueSave();
  }

  public async getAll(): Promise<Record<string, string>> {
    return Object.fromEntries(this.cache.entries());
  }

  public async clear(): Promise<void> {
    this.cache.clear();
    this.initialize();
  }

  private queueSave(): void {
    if (this.saveTimeout) clearTimeout(this.saveTimeout);

    this.saveTimeout = setTimeout(async () => {
      if (this.isSaving) return;
      this.isSaving = true;
      try {
        const flagsDir = path.dirname(this.cacheFilePath);
        if (!fs.existsSync(flagsDir)) {
          await fs.promises.mkdir(flagsDir, { recursive: true });
        }
        const data = Object.fromEntries(this.cache.entries());
        await fs.promises.writeFile(this.cacheFilePath, JSON.stringify(data, null, 2), "utf-8");
      } catch (err) {
        console.warn("[LocalFlagCache] Error writing flag-cache.json:", err);
      } finally {
        this.isSaving = false;
      }
    }, 1000);
  }
}

export const localFlagCache = new LocalFlagCacheAdapter();
