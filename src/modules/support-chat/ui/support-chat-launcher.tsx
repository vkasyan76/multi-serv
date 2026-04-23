"use client";

import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSupportChat } from "@/modules/support-chat/ui/support-chat-provider";

export function SupportChatLauncher({
  className,
  children,
  onOpen,
}: {
  className?: string;
  children?: React.ReactNode;
  onOpen?: () => void;
}) {
  const { openChat } = useSupportChat();

  return (
    <Button
      type="button"
      variant="outline"
      className={cn("gap-2 rounded-full", className)}
      onClick={() => {
        openChat();
        onOpen?.();
      }}
    >
      <MessageCircle className="h-4 w-4" />
      {children}
    </Button>
  );
}
