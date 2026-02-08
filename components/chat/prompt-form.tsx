"use client";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { ArrowUp, Loader2 } from "lucide-react";
import { useCallback, useRef, useState } from "react";

interface PromptFormProps {
  onSubmit: (message: string) => void;
  isLoading?: boolean;
  disabled?: boolean;
  placeholder?: string;
}

export function PromptForm({
  onSubmit,
  isLoading = false,
  disabled = false,
  placeholder = "Ask Claude to build something...",
}: PromptFormProps) {
  const [message, setMessage] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!message.trim() || isLoading || disabled) return;
      onSubmit(message.trim());
      setMessage("");
    },
    [message, onSubmit, isLoading, disabled]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit(e);
      }
    },
    [handleSubmit]
  );

  return (
    <form onSubmit={handleSubmit} className="relative flex w-full flex-col">
      <div
        className={cn(
          "relative z-0 rounded-[calc(var(--radius)+1px)] p-px shadow-lg transition-all",
          "focus-within:ring-ring/5 focus-within:border-border focus-within:ring-4",
          "user-message-border",
          (isLoading || disabled) && "opacity-50"
        )}
      >
        <div className="bg-background absolute inset-px -z-10 rounded-[calc(var(--radius)+1px)]" />

        <div className="from-card/10 to-card relative flex min-h-24 flex-col rounded-lg bg-gradient-to-t">
          <div className="bg-background absolute inset-0 -z-20 rounded-[calc(var(--radius)+1px)]" />
          <Textarea
            ref={textareaRef}
            autoFocus
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading || disabled}
            placeholder={placeholder}
            className="placeholder:text-muted-foreground/50 bg-transparent! max-h-48 flex-1 resize-none border-0 shadow-none focus-visible:ring-0"
          />

          <div className="flex items-center justify-end gap-2 p-2">
            <Button
              type="submit"
              size="iconSm"
              disabled={!message.trim() || isLoading || disabled}
              className="rounded-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white shadow-md shadow-orange-500/20 disabled:opacity-30 disabled:shadow-none"
            >
              {isLoading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ArrowUp className="size-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}
