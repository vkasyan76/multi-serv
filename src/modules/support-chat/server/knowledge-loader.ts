import "server-only";

import fs from "node:fs/promises";
import path from "node:path";

export type SupportKnowledgeSourceType =
  | "operational-guidance"
  | "policy-summary"
  | "terms-reference"
  | "fallback-guidance";

export type SupportKnowledgeDocument = {
  id: string;
  version: string;
  locale: string;
  sourceType: SupportKnowledgeSourceType;
  filename: string;
  title: string;
  content: string;
};

export type SupportKnowledgeChunk = {
  id: string;
  documentId: string;
  documentVersion: string;
  locale: string;
  sourceType: SupportKnowledgeSourceType;
  filename: string;
  title: string;
  sectionId: string;
  sectionTitle: string;
  text: string;
};

const KNOWLEDGE_DIR = path.join(
  process.cwd(),
  "src/modules/support-chat/server/knowledge"
);

const KNOWLEDGE_FILE_ORDER = [
  "support-faq.en.md",
  "registration-help.en.md",
  "provider-onboarding.en.md",
  "booking-calendar-help.en.md",
  "booking-payment-policy.en.md",
  "terms-reference.en.md",
  "unsupported-questions.en.md",
] as const;

let cachedChunks: SupportKnowledgeChunk[] | null = null;

// Intentionally narrow frontmatter parser for the support knowledge pack.
// It supports only flat scalar `key: value` fields.
function parseFrontmatter(raw: string) {
  if (!raw.startsWith("---")) {
    throw new Error("Knowledge file missing frontmatter.");
  }

  const end = raw.indexOf("\n---", 3);
  if (end === -1) {
    throw new Error("Knowledge file has invalid frontmatter.");
  }

  const frontmatterText = raw.slice(3, end).trim();
  const content = raw.slice(end + "\n---".length).trim();

  const frontmatter = Object.fromEntries(
    frontmatterText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const idx = line.indexOf(":");
        if (idx === -1) return [line, ""];
        return [line.slice(0, idx).trim(), line.slice(idx + 1).trim()];
      })
  );

  return { frontmatter, content };
}

function assertSourceType(value: string): SupportKnowledgeSourceType {
  const allowed = new Set<SupportKnowledgeSourceType>([
    "operational-guidance",
    "policy-summary",
    "terms-reference",
    "fallback-guidance",
  ]);

  if (!allowed.has(value as SupportKnowledgeSourceType)) {
    throw new Error(`Unsupported knowledge sourceType: ${value}`);
  }

  return value as SupportKnowledgeSourceType;
}

function firstContentLine(text: string) {
  return (
    text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line.length > 0 && !line.startsWith("Audience:")) ?? ""
  );
}

function splitIntoChunks(
  doc: SupportKnowledgeDocument
): SupportKnowledgeChunk[] {
  const sections = doc.content.split(/\n(?=## )/g);

  return sections
    .map((section) => {
      const headingMatch = section.match(/^##\s+(.+)$/m);
      if (!headingMatch) return null;
      const rawSectionId = headingMatch[1];
      if (!rawSectionId) return null;

      // Knowledge headings are already stable IDs, e.g. `## registration-create-account`.
      // Keep them exact so retrieval/debug logs point back to the authored section.
      const sectionId = rawSectionId.trim();
      const text = section.replace(/^##\s+.+$/m, "").trim();

      if (!sectionId || !text) return null;

      return {
        id: `${doc.id}:${sectionId}`,
        documentId: doc.id,
        documentVersion: doc.version,
        locale: doc.locale,
        sourceType: doc.sourceType,
        filename: doc.filename,
        title: doc.title,
        sectionId,
        sectionTitle: firstContentLine(text) || sectionId,
        text,
      } satisfies SupportKnowledgeChunk;
    })
    .filter((chunk): chunk is SupportKnowledgeChunk => !!chunk);
}

async function loadKnowledgeDocument(
  filename: string
): Promise<SupportKnowledgeDocument> {
  const filePath = path.join(KNOWLEDGE_DIR, filename);
  const raw = await fs.readFile(filePath, "utf8");
  const { frontmatter, content } = parseFrontmatter(raw);

  const titleMatch = content.match(/^#\s+(.+)$/m);

  const id = frontmatter.id;
  const version = frontmatter.version;
  const locale = frontmatter.locale;
  const sourceType = frontmatter.sourceType;

  if (!id || !version || !locale || !sourceType) {
    throw new Error(`Knowledge file ${filename} is missing required metadata.`);
  }

  return {
    id,
    version,
    locale,
    sourceType: assertSourceType(sourceType),
    filename,
    title: titleMatch?.[1]?.trim() ?? id,
    content,
  };
}

export async function loadSupportKnowledgeChunks() {
  if (cachedChunks) return cachedChunks;

  const docs = await Promise.all(
    KNOWLEDGE_FILE_ORDER.map((filename) => loadKnowledgeDocument(filename))
  );

  cachedChunks = docs.flatMap(splitIntoChunks);

  return cachedChunks;
}

export function clearSupportKnowledgeCacheForTests() {
  cachedChunks = null;
}
