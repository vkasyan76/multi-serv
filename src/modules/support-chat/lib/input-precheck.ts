export type SupportChatInputPrecheckDisposition =
  | "in_scope"
  | "empty"
  | "abusive"
  | "nonsense";

const ABUSIVE_PATTERN =
  /\b(fuck|fucking|shit|bullshit|bitch|asshole|idiot|moron|stupid|dumb|useless|shut up|kill yourself|kys)\b/i;

// Minimal precheck helper for obviously unusable inputs.
// This is not semantic scope classification and does not detect account,
// policy, retrieval, or support intent.
export function classifySupportChatInputPrecheck(
  message: string
): SupportChatInputPrecheckDisposition {
  const trimmed = message.trim();

  if (!trimmed) return "empty";
  if (ABUSIVE_PATTERN.test(trimmed)) return "abusive";
  if (!/[\p{L}\p{N}]/u.test(trimmed)) return "nonsense";

  return "in_scope";
}
