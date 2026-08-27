// src/server/api/routers/onoma/namebank-helpers.ts
// Parsing, serialization, and mapping helpers for Onoma Stash & NameBank records

import { StashNoteMetadataSchema } from "~/lib/onoma/types";

export interface LexiconDef {
  partOfSpeech: string;
  root: string;
  meaning: string;
  origin: string;
}

export interface ParsedStashNote {
  category: string | null;
  role: string | null;
  gender: string | null;
  setName: string | null;
  lexiconDefinition: LexiconDef | null;
  values: string[];
}

export interface StashItemRecord {
  id: string;
  pageTitle: string;
  pageSlug: string;
  contentType: string;
  note: string | null;
  savedAt: Date;
  updatedAt: Date;
  stash: {
    id: string;
    name: string;
    color: string | null;
    userId?: string;
  };
}

export interface StandaloneNameBankRecord {
  id: string;
  userId: string;
  type: string;
  title: string;
  values: unknown;
  category: string | null;
  culturalProfile: string | null;
  isPublic: boolean;
  countryId: string | null;
  clonedFromId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface NameBankEntryOutput {
  id: string;
  userId: string;
  type: "dictionary" | "saved-name";
  title: string;
  values: string[];
  category: string | null;
  role: string | null;
  gender: string | null;
  setName: string | null;
  lexiconDefinition: LexiconDef | null;
  culturalProfile: string | null;
  isPublic: boolean;
  countryId: string | null;
  clonedFromId: string | null;
  createdAt: Date;
  updatedAt: Date;
  stashId?: string;
  stashName?: string;
  stashColor?: string | null;
}

/**
 * Splits and trims raw string or array values into a normalized array of strings.
 */
export function cleanRawValues(rawValues: unknown): string[] {
  if (Array.isArray(rawValues)) {
    return rawValues
      .filter((v): v is string => typeof v === "string")
      .flatMap((v) => v.split(/[\r\n,\s]+/))
      .map((v) => v.trim())
      .filter(Boolean);
  }
  if (typeof rawValues === "string") {
    return rawValues
      .split(/[\r\n,\s]+/)
      .map((v) => v.trim())
      .filter(Boolean);
  }
  return [];
}

/**
 * Parse JSON note metadata stored on a StashItem.
 */
export function parseStashItemNote(note: string | null, contentType?: string): ParsedStashNote {
  let category: string | null = null;
  let role: string | null = null;
  let gender: string | null = null;
  let setName: string | null = null;
  let lexiconDefinition: LexiconDef | null = null;
  let values: string[] = [];

  if (note) {
    try {
      const raw = JSON.parse(note);
      const parsed = StashNoteMetadataSchema.safeParse(raw);
      if (parsed.success) {
        category = parsed.data.category || null;
        role = parsed.data.role || null;
        gender = parsed.data.gender || null;
        setName = parsed.data.setName || null;
        lexiconDefinition = parsed.data.lexiconDefinition || null;
        values = cleanRawValues(parsed.data.values || []);
      } else if (raw && typeof raw === "object") {
        const obj = raw as Record<string, unknown>;
        category = typeof obj.category === "string" ? obj.category : null;
        role = typeof obj.role === "string" ? obj.role : null;
        gender = typeof obj.gender === "string" ? obj.gender : null;
        setName = typeof obj.setName === "string" ? obj.setName : null;
        if (obj.lexiconDefinition && typeof obj.lexiconDefinition === "object") {
          const ld = obj.lexiconDefinition as Record<string, string>;
          lexiconDefinition = {
            partOfSpeech: ld.partOfSpeech || "Noun",
            root: ld.root || "",
            meaning: ld.meaning || "",
            origin: ld.origin || "",
          };
        }
        if (Array.isArray(obj.values)) {
          values = cleanRawValues(obj.values);
        }
      }
    } catch {
      if (contentType === "dictionary") {
        values = cleanRawValues(note);
      }
    }
  }

  return {
    category,
    role,
    gender,
    setName,
    lexiconDefinition,
    values,
  };
}

/**
 * Map a database StashItem to a unified NameBankEntryOutput.
 */
export function mapStashItemToEntry(item: StashItemRecord, userId: string): NameBankEntryOutput {
  const parsed = parseStashItemNote(item.note, item.contentType);
  let values = parsed.values;
  if (item.contentType === "name" && values.length === 0) {
    values = [item.pageTitle];
  }

  return {
    id: item.id,
    userId,
    type: item.contentType === "dictionary" ? "dictionary" : "saved-name",
    title: item.pageTitle,
    values,
    category: parsed.category,
    role: parsed.role,
    gender: parsed.gender,
    setName: parsed.setName,
    lexiconDefinition: parsed.lexiconDefinition,
    culturalProfile: null,
    isPublic: false,
    countryId: null,
    clonedFromId: null,
    createdAt: item.savedAt,
    updatedAt: item.updatedAt,
    stashId: item.stash.id,
    stashName: item.stash.name,
    stashColor: item.stash.color,
  };
}

/**
 * Map a database NameBank record to a unified NameBankEntryOutput.
 */
export function mapStandaloneItemToEntry(
  item: StandaloneNameBankRecord,
  userId: string
): NameBankEntryOutput {
  return {
    id: item.id,
    userId,
    type: item.type as "dictionary" | "saved-name",
    title: item.title,
    values: cleanRawValues(item.values),
    category: item.category,
    role: null,
    gender: null,
    setName: null,
    lexiconDefinition: null,
    culturalProfile: item.culturalProfile,
    isPublic: item.isPublic,
    countryId: item.countryId,
    clonedFromId: item.clonedFromId,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    stashId: undefined,
    stashName: undefined,
    stashColor: undefined,
  };
}
