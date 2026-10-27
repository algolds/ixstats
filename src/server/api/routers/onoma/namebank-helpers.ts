// src/server/api/routers/onoma/namebank-helpers.ts
// Parsing, serialization, and mapping helpers for Onoma Stash & NameBank records

import { StashNoteMetadataSchema } from "~/lib/onoma/types";

interface LexiconDef {
  partOfSpeech: string;
  root: string;
  meaning: string;
  origin: string;
}

interface ParsedStashNote {
  category: string | null;
  role: string | null;
  gender: string | null;
  setName: string | null;
  lexiconDefinition: LexiconDef | null;
  values: string[];
}

interface StashItemRecord {
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

interface StandaloneNameBankRecord {
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

interface NameBankEntryOutput {
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

const asString = (v: unknown) => (typeof v === "string" ? v : null);

/** Best-effort read of a note that failed schema validation: keep whichever fields are well-formed. */
function parseLooseNote(obj: Record<string, unknown>): ParsedStashNote {
  const ld = obj.lexiconDefinition;
  const lexicon = ld && typeof ld === "object" ? (ld as Record<string, string>) : null;
  return {
    category: asString(obj.category),
    role: asString(obj.role),
    gender: asString(obj.gender),
    setName: asString(obj.setName),
    lexiconDefinition: lexicon && {
      partOfSpeech: lexicon.partOfSpeech || "Noun",
      root: lexicon.root || "",
      meaning: lexicon.meaning || "",
      origin: lexicon.origin || "",
    },
    values: Array.isArray(obj.values) ? cleanRawValues(obj.values) : [],
  };
}

/**
 * Parse JSON note metadata stored on a StashItem.
 */
export function parseStashItemNote(note: string | null, contentType?: string): ParsedStashNote {
  const empty: ParsedStashNote = {
    category: null,
    role: null,
    gender: null,
    setName: null,
    lexiconDefinition: null,
    values: [],
  };
  if (!note) return empty;

  try {
    const raw = JSON.parse(note);
    const parsed = StashNoteMetadataSchema.safeParse(raw);
    if (parsed.success) {
      const { data } = parsed;
      return {
        category: data.category || null,
        role: data.role || null,
        gender: data.gender || null,
        setName: data.setName || null,
        lexiconDefinition: data.lexiconDefinition || null,
        values: cleanRawValues(data.values || []),
      };
    }
    return raw && typeof raw === "object" ? parseLooseNote(raw as Record<string, unknown>) : empty;
  } catch {
    return contentType === "dictionary" ? { ...empty, values: cleanRawValues(note) } : empty;
  }
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
