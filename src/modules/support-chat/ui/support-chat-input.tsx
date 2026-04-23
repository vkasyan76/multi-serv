"use client";

import { type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function SupportChatInput({
  value,
  onChange,
  onSubmit,
  disabled,
  isSending,
  canSubmit,
  placeholder,
  sendLabel,
  sendingLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled: boolean;
  isSending: boolean;
  canSubmit: boolean;
  placeholder: string;
  sendLabel: string;
  sendingLabel: string;
}) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
      <Textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        rows={3}
        className="min-h-24 resize-y bg-white"
      />

      <div className="flex justify-end">
        <Button type="submit" disabled={disabled || !canSubmit}>
          {isSending ? sendingLabel : sendLabel}
        </Button>
      </div>
    </form>
  );
}
