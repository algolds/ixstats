import { stripHtml } from "~/lib/utils/sanitize-html";

export type ArticleTopic =
  | "history"
  | "state"
  | "economy"
  | "defense"
  | "diplomacy"
  | "geography"
  | "society"
  | "culture"
  | "dossier";

export function cleanSummary(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const stripped = stripHtml(raw.replace(/\{\{[^{}]*\}\}/g, ""))
    .replace(/\{\{[^{}]*\}\}/g, "")
    .replace(/\[\[(?:[^\]|]+\|)?([^\]]+)\]\]/g, "$1")
    .replace(/'{2,}/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return stripped || null;
}

const TOPIC_PATTERNS: readonly [ArticleTopic, RegExp][] = [
  [
    "history",
    /\b(histor\w*|ancient|war\w*|eras?|dynast\w*|empire|emperor|imperial|revolut\w*|chronicle\w*)\b/i,
  ],
  [
    "state",
    /\b(govern\w*|politic\w*|senat\w*|assembl\w*|parliament\w*|corcillum|ministr\w*|ministers?|council\w*|court\w*|judic\w*|constitut\w*|laws?|imperator\w*|monarch\w*|presiden\w*|chancellor\w*|administrat\w*|provin\w*)\b/i,
  ],
  [
    "economy",
    /\b(econom\w*|bank\w*|treasur\w*|budget\w*|tax\w*|trad(?:e|es|ing)|industr\w*|commerc\w*|currenc\w*|rail\w*|ports?)\b/i,
  ],
  [
    "defense",
    /\b(armed|militar\w*|nav\w*|defen\w*|legion\w*|cohort\w*|forces?|security)\b/i,
  ],
  [
    "diplomacy",
    /\b(foreign|diplom\w*|treat\w*|allianc\w*|embass\w*|internation\w*)\b/i,
  ],
  [
    "geography",
    /\b(geograph\w*|climat\w*|region\w*|territor\w*|cit(?:y|ies)|capital\w*)\b/i,
  ],
  [
    "society",
    /\b(demograph\w*|educat\w*|health\w*|stratific\w*|social\w*|peoples?|population\w*)\b/i,
  ],
  [
    "culture",
    /\b(cultur\w*|relig\w*|church\w*|languag\w*|latin|arts?|architect\w*|sport\w*|leagu\w*)\b/i,
  ],
];

export function classifyArticleTopic(title: string): ArticleTopic {
  for (const [topic, pattern] of TOPIC_PATTERNS) {
    if (pattern.test(title)) return topic;
  }
  return "dossier";
}
