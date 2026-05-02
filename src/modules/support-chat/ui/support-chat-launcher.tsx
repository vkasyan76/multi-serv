"use client";

import { Button, type buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SupportChatAiIcon } from "@/modules/support-chat/ui/support-chat-ai-icon";
import { useSupportChat } from "@/modules/support-chat/ui/support-chat-provider";
import { type VariantProps } from "class-variance-authority";

type ButtonVariantProps = VariantProps<typeof buttonVariants>;

export function SupportChatLauncher({
  className,
  children,
  onOpen,
  variant = "outline",
  size,
  showIcon = true,
}: {
  className?: string;
  children?: React.ReactNode;
  onOpen?: () => void;
  variant?: ButtonVariantProps["variant"];
  size?: ButtonVariantProps["size"];
  showIcon?: boolean;
}) {
  const { openChat } = useSupportChat();

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={cn("gap-2", className)}
      onClick={() => {
        openChat();
        onOpen?.();
      }}
    >
      {showIcon ? (
        <SupportChatAiIcon
          className="h-6 w-6"
          iconClassName="h-5 w-5"
          sparkleClassName="h-2.5 w-2.5"
          variant="plain"
        />
      ) : null}
      {children}
    </Button>
  );
}
