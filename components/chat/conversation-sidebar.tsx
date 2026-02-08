"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  MessageSquare,
  Plus,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
} from "lucide-react";
import type { ConversationSummary } from "@/lib/types";

interface ConversationSidebarProps {
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  refreshTrigger?: number;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

const statusConfig: Record<
  string,
  { icon: typeof CheckCircle2; className: string }
> = {
  completed: { icon: CheckCircle2, className: "text-green-400" },
  running: { icon: Loader2, className: "text-orange-400 animate-spin" },
  error: { icon: AlertCircle, className: "text-red-400" },
  idle: { icon: Clock, className: "text-muted-foreground" },
};

export function ConversationSidebar({
  activeId,
  onSelect,
  onNew,
  refreshTrigger,
}: ConversationSidebarProps) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/conversations");
      if (!res.ok) return;
      const data = await res.json();
      setConversations(data.conversations || []);
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations, refreshTrigger]);

  // Auto-refresh every 10 seconds when a conversation is running
  useEffect(() => {
    const hasRunning = conversations.some((c) => c.status === "running");
    if (!hasRunning) return;
    const interval = setInterval(fetchConversations, 10000);
    return () => clearInterval(interval);
  }, [conversations, fetchConversations]);

  return (
    <div className="flex h-full flex-col border-r border-border/60 bg-card/30">
      {/* Header */}
      <div className="flex items-center justify-between px-3 h-[52px] border-b border-border/60">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          History
        </span>
        <button
          onClick={onNew}
          className="p-1.5 hover:bg-accent rounded-lg transition-colors"
          title="New conversation"
        >
          <Plus className="size-4 text-orange-400" />
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-auto py-1.5">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="px-3 py-8 text-center">
            <MessageSquare className="size-5 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground/60">No conversations yet</p>
          </div>
        ) : (
          conversations.map((conv) => {
            const isActive = conv.id === activeId;
            const { icon: StatusIcon, className: statusClass } =
              statusConfig[conv.status] || statusConfig.idle;

            return (
              <button
                key={conv.id}
                onClick={() => onSelect(conv.id)}
                className={cn(
                  "w-full text-left px-3 py-2.5 mx-1.5 rounded-lg transition-all duration-150 group",
                  "hover:bg-accent/50",
                  isActive && "bg-orange-500/10 border border-orange-500/20"
                )}
                style={{ width: "calc(100% - 12px)" }}
              >
                <div className="flex items-start gap-2">
                  <StatusIcon
                    className={cn("size-3.5 mt-0.5 shrink-0", statusClass)}
                  />
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "text-xs font-medium truncate",
                        isActive ? "text-orange-300" : "text-foreground/80"
                      )}
                    >
                      {conv.title || "Untitled"}
                    </p>
                    <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                      {timeAgo(conv.updatedAt)}
                    </p>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
