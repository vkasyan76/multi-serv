"use client";

import { useEffect } from "react";
import { useSupportChat } from "@/modules/support-chat/ui/support-chat-provider";

export function SupportChatRouteOpener() {
  const { openChat } = useSupportChat();

  useEffect(() => {
    openChat();
  }, [openChat]);

  return null;
}
