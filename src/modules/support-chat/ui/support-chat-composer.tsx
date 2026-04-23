"use client";

import { type FormEvent, type KeyboardEvent } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function SupportChatComposer({
  value,
  onChange,
  onSubmit,
  disabled,
  isSending,
  placeholder,
  sendLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled: boolean;
  isSending: boolean;
  placeholder: string;
  sendLabel: string;
}) {
  const canSubmit = value.trim().length > 0 && !disabled;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (canSubmit) onSubmit();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey) return;

    event.preventDefault();
    if (canSubmit) onSubmit();
  };

  return (
    <form className="flex items-end gap-2" onSubmit={handleSubmit}>
      <Textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={placeholder}
        rows={1}
        className="min-h-11 max-h-24 resize-none rounded-2xl bg-white px-4 py-3 text-sm shadow-sm"
      />

      <Button
        type="submit"
        size="icon"
        className="h-11 w-11 rounded-full"
        disabled={!canSubmit || isSending}
        aria-label={sendLabel}
      >
        <Send className="h-4 w-4" />
      </Button>
    </form>
  );
}
