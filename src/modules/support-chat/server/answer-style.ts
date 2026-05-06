import "server-only";

const MARKDOWN_FORMATTING_PATTERNS: Array<[RegExp, string]> = [
  [/^\s{0,3}#{1,6}\s+/gm, ""],
  [/\*\*([^*]+)\*\*/g, "$1"],
  [/__([^_]+)__/g, "$1"],
  [/`([^`]+)`/g, "$1"],
  [/^\s*[-*]\s+/gm, ""],
  [/^\s*\d+[.)]\s+/gm, ""],
];

export function formatSupportChatAnswerForWidget(text: string) {
  return MARKDOWN_FORMATTING_PATTERNS.reduce(
    (value, [pattern, replacement]) => value.replace(pattern, replacement),
    text,
  )
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
