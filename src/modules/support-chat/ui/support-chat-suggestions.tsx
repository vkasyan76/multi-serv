"use client";

import { Button } from "@/components/ui/button";

export type SupportChatSuggestion = {
  id: string;
  label: string;
  prompt: string;
};

export function SupportChatSuggestions({
  suggestions,
  onSelect,
  disabled,
}: {
  suggestions: SupportChatSuggestion[];
  onSelect: (suggestion: SupportChatSuggestion) => void;
  disabled: boolean;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {suggestions.map((suggestion) => (
        <Button
          key={suggestion.id}
          type="button"
          variant="outline"
          className="h-auto justify-start whitespace-normal rounded-xl px-3 py-2 text-left text-sm"
          disabled={disabled}
          onClick={() => onSelect(suggestion)}
        >
          {suggestion.label}
        </Button>
      ))}
    </div>
  );
}
