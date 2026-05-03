import { cn } from "@/lib/utils";
import {
  type SupportChatAction,
  type SupportChatMessage,
} from "@/modules/support-chat/ui/types";

export function SupportChatThread({
  messages,
  isSending,
  sendingText,
  getHandoffText,
  onActionSelect,
}: {
  messages: SupportChatMessage[];
  isSending: boolean;
  sendingText: string;
  getHandoffText: (message: SupportChatMessage) => string | null;
  onActionSelect: (action: SupportChatAction) => void;
}) {
  return (
    <div className="space-y-2.5">
      {messages.map((message) => {
        const handoffText =
          message.role === "assistant" ? getHandoffText(message) : null;
        const isUser = message.role === "user";

        return (
          <div key={message.id} className="space-y-1.5">
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
              <p className="mr-auto max-w-[82%] rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs leading-5 text-neutral-700 shadow-sm">
                {handoffText}
              </p>
            ) : null}

            {!isUser && message.actions?.length ? (
              <div className="mr-auto grid max-w-[82%] gap-2">
                {message.actions.map((action) => (
                  <button
                    key={action.id}
                    type="button"
                    disabled={isSending}
                    onClick={() => onActionSelect(action)}
                    className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-left text-xs shadow-sm transition hover:border-blue-300 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <span className="block font-medium text-foreground">
                      {action.label}
                    </span>
                    {action.description ? (
                      <span className="mt-0.5 block text-muted-foreground">
                        {action.description}
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
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
