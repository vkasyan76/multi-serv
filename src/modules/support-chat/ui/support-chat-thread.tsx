import { cn } from "@/lib/utils";

export type SupportChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  disposition?: "answered" | "uncertain" | "escalate" | "unsupported_account_question";
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

export function SupportChatThread({
  messages,
  isSending,
  emptyText,
  sendingText,
  getHandoffText,
}: {
  messages: SupportChatMessage[];
  isSending: boolean;
  emptyText: string;
  sendingText: string;
  getHandoffText: (message: SupportChatMessage) => string | null;
}) {
  if (!messages.length && !isSending) {
    return <p className="px-4 py-6 text-sm text-neutral-600">{emptyText}</p>;
  }

  return (
    <div className="divide-y divide-neutral-100">
      {messages.map((message) => {
        const handoffText =
          message.role === "assistant" ? getHandoffText(message) : null;

        return (
          <div key={message.id} className="space-y-2 px-4 py-4">
            <div
              className={cn(
                "max-w-full whitespace-pre-wrap rounded-md px-3 py-2 text-sm leading-6",
                message.role === "user"
                  ? "ml-auto bg-neutral-900 text-white"
                  : "mr-auto border border-neutral-200 bg-neutral-50 text-neutral-900"
              )}
            >
              {message.content}
            </div>

            {handoffText ? (
              <p className="text-sm text-neutral-600">{handoffText}</p>
            ) : null}
          </div>
        );
      })}

      {isSending ? (
        <div className="px-4 py-4">
          <p className="text-sm text-neutral-600">{sendingText}</p>
        </div>
      ) : null}
    </div>
  );
}
