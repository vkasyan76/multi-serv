export type SupportChatDisposition =
  | "answered"
  | "uncertain"
  | "escalate"
  | "unsupported_account_question";

export type SupportChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  disposition?: SupportChatDisposition;
  needsHumanSupport?: boolean;
  sources?: {
    documentId: string;
    documentVersion: string;
    chunkId: string;
    sectionId: string;
    sectionTitle: string;
    sourceType: string;
    score: number;
    matchedTerms: string[];
  }[];
};
