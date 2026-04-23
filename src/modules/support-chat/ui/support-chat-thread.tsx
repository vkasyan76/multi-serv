import { cn } from "@/lib/utils";
import { type SupportChatMessage } from "@/modules/support-chat/ui/types";

export function SupportChatThread({
  messages,
  isSending,
  sendingText,
  getHandoffText,
}: {
  messages: SupportChatMessage[];
  isSending: boolean;
  sendingText: string;
  getHandoffText: (message: SupportChatMessage) => string | null;
}) {
  return (
    <div className="space-y-3">
      {messages.map((message) => {
        const handoffText =
          message.role === "assistant" ? getHandoffText(message) : null;
        const isUser = message.role === "user";

        return (
          <div key={message.id} className="space-y-2">
            <div
              className={cn(
                "max-w-[82%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm leading-6 shadow-sm",
                isUser
                  ? "ml-auto rounded-br-md bg-blue-600 text-white"
                  : "mr-auto rounded-bl-md bg-muted text-foreground"
              )}
            >
              {message.content}
            </div>

            {handoffText ? (
              <p className="mr-auto max-w-[82%] rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs leading-5 text-blue-900">
                {handoffText}
              </p>
            ) : null}
          </div>
        );
      })}

      {isSending ? (
        <p className="mr-auto max-w-[82%] rounded-2xl rounded-bl-md bg-muted px-3 py-2 text-sm text-muted-foreground">
          {sendingText}
        </p>
      ) : null}
    </div>
  );
}
