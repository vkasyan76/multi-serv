export type SupportChatDisposition =
  | "answered"
  | "uncertain"
  | "escalate"
  | "unsupported_account_question";

export type SupportChatAction = {
  id: string;
  type: "account_candidate_select";
  label: string;
  description?: string;
  token: string;
};

export type SupportSelectedOrderContext = {
  type: "selected_order";
  token: string;
  label?: string;
  description?: string;
};

export type SupportChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  actions?: SupportChatAction[];
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
