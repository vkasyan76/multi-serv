import "server-only";

export type SupportChatRedactionResult = {
  redactedText: string;
  redactionApplied: boolean;
  redactionTypes: string[];
};

const REDACTION_PATTERNS: Array<{
  type: string;
  pattern: RegExp;
  replacement: string;
}> = [
  {
    type: "email",
    pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
    replacement: "[redacted-email]",
  },
  {
    type: "phone",
    pattern: /(?:\+?\d[\d\s().-]{7,}\d)/g,
    replacement: "[redacted-phone]",
  },
  {
    type: "payment-reference",
    pattern:
      /\b(?:pi|cs|ch|in|cus|acct|seti|pm)_[A-Za-z0-9_~-]{8,}\b/g,
    replacement: "[redacted-payment-reference]",
  },
  {
    type: "long-number",
    pattern: /\b(?:\d[ -]?){13,19}\b/g,
    replacement: "[redacted-number]",
  },
];

export function redactSupportChatText(
  text: string
): SupportChatRedactionResult {
  let redactedText = text;
  const redactionTypes = new Set<string>();

  for (const { type, pattern, replacement } of REDACTION_PATTERNS) {
    redactedText = redactedText.replace(pattern, () => {
      redactionTypes.add(type);
      return replacement;
    });
  }

  return {
    redactedText,
    redactionApplied: redactionTypes.size > 0,
    redactionTypes: [...redactionTypes],
  };
}
