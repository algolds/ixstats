/**
 * Onoma language-pack publishing rules (SL-18), shared by the marketplace router and its UI.
 *
 * A pack owner can publish a draft pack (visibility "public", listed in the marketplace, or
 * "unlisted", reachable by id) once it passes `packPublishProblems`, and unpublish it back to
 * "draft" at any time. Forks already made keep their copy.
 */

export const PACK_PUBLISH_RULES = {
  nameMin: 3,
  nameMax: 80,
  descriptionMin: 20,
  descriptionMax: 2000,
  maxTags: 10,
  tagMax: 30,
  /** A dictionary must hold at least this many entries to count as content. */
  minDictionaryEntries: 10,
  maxDictionaries: 10,
  maxDictionaryEntries: 2000,
  entryMax: 80,
} as const;

export interface PackDictionary {
  name: string;
  category?: string | null;
  values: string[];
}

interface PublishCandidate {
  name: string;
  description: string | null;
  tags: string[];
}

interface PublishVersion {
  dictionaries: unknown;
  phonologyRules: unknown;
  morphologyRules: unknown;
  orthographyRules: unknown;
  namingConventions: unknown;
}

const isNonEmptyObject = (value: unknown) =>
  !!value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length > 0;

/** Dictionaries stored on a pack version (JSON), keeping only well-formed entries. */
export function readPackDictionaries(stored: unknown): PackDictionary[] {
  if (!Array.isArray(stored)) return [];
  return stored.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const { name, category, values } = entry as Record<string, unknown>;
    if (typeof name !== "string" || !Array.isArray(values)) return [];
    return [
      {
        name,
        category: typeof category === "string" ? category : null,
        values: values.filter((v): v is string => typeof v === "string" && v.trim().length > 0),
      },
    ];
  });
}

/**
 * Why a pack cannot be published yet; empty when it can. It needs a name, a description, at
 * most `maxTags` tags and a latest version with content: a dictionary of at least
 * `minDictionaryEntries` entries, or phonology, morphology, orthography or naming rules.
 */
export function packPublishProblems(
  pack: PublishCandidate,
  latestVersion: PublishVersion | null
): string[] {
  const rules = PACK_PUBLISH_RULES;
  const problems: string[] = [];
  const name = pack.name.trim();
  if (name.length < rules.nameMin || name.length > rules.nameMax) {
    problems.push(`The name must be ${rules.nameMin} to ${rules.nameMax} characters.`);
  }
  const description = pack.description?.trim() ?? "";
  if (description.length < rules.descriptionMin) {
    problems.push(`Add a description of at least ${rules.descriptionMin} characters.`);
  }
  if (pack.tags.length > rules.maxTags) {
    problems.push(`Use at most ${rules.maxTags} tags.`);
  }
  if (!latestVersion) {
    problems.push("The pack has no version to publish.");
    return problems;
  }
  const hasDictionary = readPackDictionaries(latestVersion.dictionaries).some(
    (d) => d.values.length >= rules.minDictionaryEntries
  );
  const hasRules = [
    latestVersion.phonologyRules,
    latestVersion.morphologyRules,
    latestVersion.orthographyRules,
    latestVersion.namingConventions,
  ].some(isNonEmptyObject);
  if (!hasDictionary && !hasRules) {
    problems.push(
      `Add a dictionary of at least ${rules.minDictionaryEntries} entries, or phonology, morphology, orthography or naming rules.`
    );
  }
  return problems;
}
