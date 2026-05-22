/**
 * Extracts department/ministry names + minister names from wiki text.
 * Maps to builder department categories using keyword-based matching.
 */

export interface ParsedDepartment {
  name: string;
  category: "Defense" | "Education" | "Health" | "Finance" | "Foreign Affairs" | "Interior" | "Justice" | "Transportation" | "Agriculture" | "Environment" | "Labor" | "Commerce" | "Energy" | "Communications" | "Culture" | "Science and Technology" | "Social Services" | "Housing" | "Veterans Affairs" | "Intelligence" | "Emergency Management" | "Other";
  minister?: string;
  description?: string;
  confidence: number;
  evidence: string;
}

const CATEGORY_KEYWORDS: Record<string, ParsedDepartment['category']> = {
  defense: 'Defense',
  military: 'Defense',
  'armed forces': 'Defense',
  war: 'Defense',
  education: 'Education',
  schools: 'Education',
  universities: 'Education',
  academic: 'Education',
  health: 'Health',
  medical: 'Health',
  hospital: 'Health',
  sanitation: 'Health',
  finance: 'Finance',
  treasury: 'Finance',
  budget: 'Finance',
  revenue: 'Finance',
  tax: 'Finance',
  foreign: 'Foreign Affairs',
  diplomatic: 'Foreign Affairs',
  international: 'Foreign Affairs',
  'external affairs': 'Foreign Affairs',
  interior: 'Interior',
  'home affairs': 'Interior',
  domestic: 'Interior',
  internal: 'Interior',
  justice: 'Justice',
  legal: 'Justice',
  law: 'Justice',
  court: 'Justice',
  'attorney general': 'Justice',
  transport: 'Transportation',
  transportation: 'Transportation',
  infrastructure: 'Transportation',
  roads: 'Transportation',
  railways: 'Transportation',
  aviation: 'Transportation',
  agriculture: 'Agriculture',
  farming: 'Agriculture',
  rural: 'Agriculture',
  food: 'Agriculture',
  environment: 'Environment',
  ecology: 'Environment',
  climate: 'Environment',
  'natural resources': 'Environment',
  labor: 'Labor',
  employment: 'Labor',
  workforce: 'Labor',
  workers: 'Labor',
  commerce: 'Commerce',
  trade: 'Commerce',
  business: 'Commerce',
  industry: 'Commerce',
  economic: 'Commerce',
  energy: 'Energy',
  power: 'Energy',
  electricity: 'Energy',
  oil: 'Energy',
  petroleum: 'Energy',
  communications: 'Communications',
  telecommunications: 'Communications',
  post: 'Communications',
  information: 'Communications',
  culture: 'Culture',
  arts: 'Culture',
  heritage: 'Culture',
  tourism: 'Culture',
  science: 'Science and Technology',
  technology: 'Science and Technology',
  research: 'Science and Technology',
  innovation: 'Science and Technology',
  social: 'Social Services',
  welfare: 'Social Services',
  community: 'Social Services',
  housing: 'Housing',
  'urban development': 'Housing',
  construction: 'Housing',
  veterans: 'Veterans Affairs',
  'ex-servicemen': 'Veterans Affairs',
  'military pension': 'Veterans Affairs',
  intelligence: 'Intelligence',
  security: 'Intelligence',
  spy: 'Intelligence',
  emergency: 'Emergency Management',
  disaster: 'Emergency Management',
  crisis: 'Emergency Management',
  'civil defense': 'Emergency Management',
};

function categorizeDepartment(name: string): ParsedDepartment['category'] {
  const lowerName = name.toLowerCase();

  for (const [keyword, category] of Object.entries(CATEGORY_KEYWORDS)) {
    if (lowerName.includes(keyword)) {
      return category;
    }
  }

  return 'Other';
}

function extractEvidence(content: string, matchIndex: number, matchLength: number, contextChars = 80): string {
  const start = Math.max(0, matchIndex - contextChars);
  const end = Math.min(content.length, matchIndex + matchLength + contextChars);
  let snippet = content.slice(start, end).replace(/\n/g, ' ').trim();
  if (start > 0) snippet = '...' + snippet;
  if (end < content.length) snippet = snippet + '...';
  return snippet;
}

function findMinisterForDepartment(content: string, deptName: string): { minister?: string; evidence?: string } {
  const ministerPatterns = [
    /(?:minister|secretary|head)\s+(?:of\s+)?(?:the\s+)?([A-Z][a-zA-Z\s]+?)\s*(?:is|was|:)\s*([A-Z][a-zA-Z\s.]+)/gi,
    /(?:the\s+)?(?:minister|secretary)\s+(?:of\s+)?([A-Z][a-zA-Z\s]+?)\s*(?:is|was)\s+([A-Z][a-zA-Z\s.]+)/gi,
  ];

  for (const pattern of ministerPatterns) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const ministerDept = match[1]?.trim().toLowerCase();
      const personName = match[2]?.trim();
      if (ministerDept && personName) {
        const deptLower = deptName.toLowerCase();
        if (deptLower.includes(ministerDept) || ministerDept.includes(deptLower)) {
          return { minister: personName, evidence: match[0] };
        }
      }
    }
  }

  return {};
}

function extractDescription(content: string, deptName: string): string | undefined {
  const deptLower = deptName.toLowerCase();
  const sentences = content.split(/[.!?]+/);

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (trimmed.toLowerCase().includes(deptLower) && trimmed.length > 20 && trimmed.length < 300) {
      return trimmed.trim();
    }
  }

  return undefined;
}

export function parseDepartments(pages: { title: string; content: string }[]): ParsedDepartment[] {
  const combinedContent = pages.map(p => p.content).join('\n\n');
  const departments: ParsedDepartment[] = [];
  const seenNames = new Set<string>();

  const ministryPattern = /(?:ministry|department|secretariat|bureau|office)\s+(?:of\s+)?([A-Z][a-zA-Z\s,.'\-]+?)(?:,|\.|;|—|\band\b|$|\n)/gi;
  let match;

  while ((match = ministryPattern.exec(combinedContent)) !== null) {
    const rawName = match[1]?.trim();
    if (!rawName || rawName.length < 2 || rawName.length > 80) continue;

    const normalizedName = rawName.replace(/\s+/g, ' ').trim();
    const lowerNormalized = normalizedName.toLowerCase();

    if (seenNames.has(lowerNormalized)) continue;

    const category = categorizeDepartment(normalizedName);
    const confidence = match[0].toLowerCase().includes('ministry of') || match[0].toLowerCase().includes('department of') ? 90 : 60;

    if (confidence < 50) continue;

    const evidence = extractEvidence(combinedContent, match.index, match[0].length);
    const { minister, evidence: ministerEvidence } = findMinisterForDepartment(combinedContent, normalizedName);
    const description = extractDescription(combinedContent, normalizedName);

    seenNames.add(lowerNormalized);

    departments.push({
      name: normalizedName,
      category,
      minister,
      description: description || ministerEvidence,
      confidence,
      evidence,
    });
  }

  return departments.filter(d => d.confidence >= 50);
}
