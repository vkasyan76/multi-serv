import "server-only";

import {
  loadSupportKnowledgeChunks,
  type SupportKnowledgeChunk,
} from "@/modules/support-chat/server/knowledge-loader";

export type SupportKnowledgeMatch = SupportKnowledgeChunk & {
  score: number;
  matchedTerms: string[];
};

export type RetrieveSupportKnowledgeInput = {
  query: string;
  locale?: string;
  limit?: number;
  minScore?: number;
};

const DEFAULT_LIMIT = 5;
const DEFAULT_MIN_SCORE = 2;

const SOURCE_TYPE_WEIGHT = {
  "operational-guidance": 3,
  "policy-summary": 2,
  "terms-reference": 1,
  "fallback-guidance": 2,
} as const;

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "but",
  "can",
  "do",
  "does",
  "for",
  "from",
  "how",
  "i",
  "if",
  "in",
  "is",
  "it",
  "me",
  "my",
  "of",
  "on",
  "or",
  "the",
  "to",
  "what",
  "when",
  "where",
  "why",
  "with",
  "you",
  "your",
]);

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function tokenize(value: string) {
  const normalized = normalizeText(value);
  if (!normalized) return [];

  return Array.from(new Set(normalized.split(/\s+/g))).filter(
    (term) => term.length >= 2 && !STOP_WORDS.has(term)
  );
}

function scoreChunk(chunk: SupportKnowledgeChunk, queryTerms: string[]) {
  const titleText = normalizeText(
    `${chunk.title} ${chunk.sectionId} ${chunk.sectionTitle}`
  );
  const bodyText = normalizeText(chunk.text);

  let score = 0;
  const matchedTerms: string[] = [];

  for (const term of queryTerms) {
    let termScore = 0;

    if (titleText.includes(term)) termScore += 4;
    if (bodyText.includes(term)) termScore += 1;

    if (termScore > 0) {
      score += termScore;
      matchedTerms.push(term);
    }
  }

  if (score > 0) {
    score += SOURCE_TYPE_WEIGHT[chunk.sourceType];
  }

  return { score, matchedTerms };
}

export async function retrieveSupportKnowledge(
  input: RetrieveSupportKnowledgeInput
): Promise<SupportKnowledgeMatch[]> {
  const limit = input.limit ?? DEFAULT_LIMIT;
  const minScore = input.minScore ?? DEFAULT_MIN_SCORE;
  const queryTerms = tokenize(input.query);

  if (!queryTerms.length) return [];

  const chunks = await loadSupportKnowledgeChunks();
  const requestedLocale = input.locale ?? "en";
  const localizedChunks = chunks.filter(
    (chunk) => chunk.locale === requestedLocale
  );
  const chunksForLocale =
    localizedChunks.length > 0
      ? localizedChunks
      : chunks.filter((chunk) => chunk.locale === "en");

  return chunksForLocale
    .map((chunk) => {
      const result = scoreChunk(chunk, queryTerms);
      return {
        ...chunk,
        score: result.score,
        matchedTerms: result.matchedTerms,
      };
    })
    .filter((match) => match.score >= minScore)
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.documentId.localeCompare(b.documentId) ||
        a.sectionId.localeCompare(b.sectionId)
    )
    .slice(0, limit);
}
