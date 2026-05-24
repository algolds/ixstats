/**
 * Parse revenue sources from wiki text at ≥95% confidence ONLY.
 * Extremely strict — only matches explicit, unambiguous statements about government revenue sources.
 */

export interface ParsedRevenueSource {
  name: string;
  category: "Direct Tax" | "Indirect Tax" | "Non-Tax Revenue" | "Fees and Fines" | "Other";
  confidence: number;
  evidence: string;
}

export interface WikiRevenueAttributes {
  sources: ParsedRevenueSource[];
  overallConfidence: number;
}

const revenueCategoryKeywords: Record<string, ParsedRevenueSource["category"]> = {
  "income tax": "Direct Tax",
  "personal income tax": "Direct Tax",
  paye: "Direct Tax",
  "payroll tax": "Direct Tax",
  "corporate tax": "Direct Tax",
  "company tax": "Direct Tax",
  "business tax": "Direct Tax",
  "profits tax": "Direct Tax",
  vat: "Indirect Tax",
  "value-added tax": "Indirect Tax",
  "sales tax": "Indirect Tax",
  gst: "Indirect Tax",
  "goods and services tax": "Indirect Tax",
  customs: "Indirect Tax",
  tariffs: "Indirect Tax",
  "import duties": "Indirect Tax",
  "export duties": "Indirect Tax",
  "trade taxes": "Indirect Tax",
  "property tax": "Direct Tax",
  "land tax": "Direct Tax",
  "real estate tax": "Direct Tax",
  "stamp duty": "Direct Tax",
  excise: "Indirect Tax",
  "sin tax": "Indirect Tax",
  "fuel tax": "Indirect Tax",
  "carbon tax": "Indirect Tax",
  "tobacco tax": "Indirect Tax",
  "alcohol tax": "Indirect Tax",
  "wealth tax": "Direct Tax",
  "inheritance tax": "Direct Tax",
  "estate tax": "Direct Tax",
  "gift tax": "Direct Tax",
  fees: "Fees and Fines",
  licenses: "Fees and Fines",
  fines: "Fees and Fines",
  penalties: "Fees and Fines",
  "registration fees": "Fees and Fines",
  "oil revenue": "Non-Tax Revenue",
  "resource revenue": "Non-Tax Revenue",
  "sovereign wealth": "Non-Tax Revenue",
  "natural resource": "Non-Tax Revenue",
  privatization: "Non-Tax Revenue",
  "state asset sales": "Non-Tax Revenue",
  "dividends from state enterprises": "Non-Tax Revenue",
  "tourism revenue": "Non-Tax Revenue",
  remittances: "Non-Tax Revenue",
  "foreign aid": "Non-Tax Revenue",
};

const revenuePatterns = [
  {
    regex:
      /(?:primary|main|principal)\s+(?:sources?\s+)?(?:of\s+)?(?:government\s+)?revenue\s+(?:are|is|include)\s+(.+?)\./gi,
    confidence: 95,
  },
  {
    regex:
      /government\s+revenue\s+(?:comes|derived|obtained)\s+(?:mainly|primarily)\s+from\s+(.+?)\./gi,
    confidence: 95,
  },
  {
    regex: /(?:the\s+)?tax\s+system\s+(?:relies|depends|is\s+based)\s+on\s+(.+?)\./gi,
    confidence: 96,
  },
  {
    regex:
      /revenue\s+(?:is|was)\s+(?:generated|derived|obtained)\s+(?:primarily|mainly)\s+(?:through|from)\s+(.+?)\./gi,
    confidence: 95,
  },
];

function extractEvidence(
  content: string,
  matchIndex: number,
  matchLength: number,
  contextChars = 80
): string {
  const start = Math.max(0, matchIndex - contextChars);
  const end = Math.min(content.length, matchIndex + matchLength + contextChars);
  let snippet = content.slice(start, end).replace(/\n/g, " ").trim();
  if (start > 0) snippet = "..." + snippet;
  if (end < content.length) snippet = snippet + "...";
  return snippet;
}

function categorizeRevenue(name: string): ParsedRevenueSource["category"] | null {
  const lowerName = name.toLowerCase().trim();

  for (const [keyword, category] of Object.entries(revenueCategoryKeywords)) {
    if (lowerName === keyword || lowerName.includes(keyword)) {
      return category;
    }
  }

  return null;
}

function parseRevenueList(raw: string): string[] {
  const cleaned = raw.replace(/\band\b/gi, ",").trim();
  return cleaned
    .split(",")
    .map((s) => s.replace(/^(?:the|and|or)\s+/i, "").trim())
    .filter((s) => s.length > 0);
}

export function parseRevenueSources(
  pages: { title: string; content: string }[]
): WikiRevenueAttributes {
  const combinedContent = pages.map((p) => p.content).join("\n\n");
  const sources: ParsedRevenueSource[] = [];
  const seenNames = new Set<string>();

  for (const { regex, confidence } of revenuePatterns) {
    regex.lastIndex = 0;
    let match;

    while ((match = regex.exec(combinedContent)) !== null) {
      const captured = match[1];
      if (!captured || captured.length < 2) continue;

      const items = parseRevenueList(captured);

      for (const item of items) {
        const normalizedName = item.replace(/\s+/g, " ").trim();
        const lowerNormalized = normalizedName.toLowerCase();

        if (seenNames.has(lowerNormalized)) continue;

        const category = categorizeRevenue(normalizedName);
        if (!category) continue;

        const evidence = extractEvidence(combinedContent, match.index, match[0].length);

        seenNames.add(lowerNormalized);

        sources.push({
          name: normalizedName,
          category,
          confidence,
          evidence,
        });
      }
    }
  }

  const validSources = sources.filter((s) => s.confidence >= 95);

  const overallConfidence =
    validSources.length > 0
      ? Math.round(validSources.reduce((sum, s) => sum + s.confidence, 0) / validSources.length)
      : 0;

  return {
    sources: validSources,
    overallConfidence,
  };
}
