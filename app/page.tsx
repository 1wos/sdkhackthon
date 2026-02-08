"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { CCMessages } from "@/components/chat/cc-messages";
import { PromptForm } from "@/components/chat/prompt-form";
import { ProcessingSteps } from "@/components/chat/processing-steps";
import { ReportDownloadPopup } from "@/components/chat/report-download-popup";
import { ConversationSidebar } from "@/components/chat/conversation-sidebar";
import { WorkspacePanel } from "@/components/workspace/workspace-panel";
import { useTheme } from "@/components/theme-provider";
import type { SessionEntry, ConversationResponse } from "@/lib/types";
import { MessageSquarePlus, Moon, PanelLeft, PanelRight, Search, Sparkles, Sun, TrendingUp } from "lucide-react";

// Pending message type for optimistic UI
interface PendingMessage {
  id: string;
  content: string;
  timestamp: string;
}

const EXAMPLE_PROMPTS = [
  { label: "Cursor vs Claude Code", icon: <TrendingUp className="size-3.5" /> },
  { label: "Manus AI review", icon: <Search className="size-3.5" /> },
  { label: "Genspark analysis", icon: <Sparkles className="size-3.5" /> },
];

export default function Home() {
  const { theme, toggleTheme } = useTheme();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [status, setStatus] = useState<ConversationResponse["status"]>("idle");
  const [serverMessages, setServerMessages] = useState<SessionEntry[]>([]);
  const [pendingMessages, setPendingMessages] = useState<PendingMessage[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [showWorkspace, setShowWorkspace] = useState(true);
  const [showSidebar, setShowSidebar] = useState(true);
  const [sidebarRefresh, setSidebarRefresh] = useState(0);
  const [runStartTime, setRunStartTime] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Track post-completion poll attempts to avoid infinite polling
  const postCompletionPollsRef = useRef(0);

  // Extract text from a user message content (handles both string and ContentBlock[]).
  const getUserMessageText = useCallback((content: string | unknown[]): string => {
    if (typeof content === "string") return content;
    if (Array.isArray(content)) {
      return content
        .filter((b: any) => b.type === "text" && b.text)
        .map((b: any) => b.text)
        .join("\n");
    }
    return "";
  }, []);

  // Check if a pending message has a matching user message in server data.
  const hasPendingMatch = useCallback(
    (pending: PendingMessage, serverMsgs: SessionEntry[]) => {
      return serverMsgs.some(
        (m) =>
          m.type === "user" &&
          getUserMessageText(m.message.content) === pending.content
      );
    },
    [getUserMessageText]
  );

  // Polling for conversation updates
  useEffect(() => {
    if (!conversationId) return;

    const isDone = status === "completed" || status === "error";

    if (isDone && (pendingMessages.length === 0 || postCompletionPollsRef.current >= 10)) return;
    if (!isDone && status !== "running") return;

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/conversations/${conversationId}`);
        if (response.ok) {
          const data: ConversationResponse = await response.json();

          setServerMessages(data.messages);

          if (data.messages.length > 0) {
            setPendingMessages((prev) =>
              prev.filter((p) => !hasPendingMatch(p, data.messages))
            );
          }

          if (data.status === "completed" || data.status === "error") {
            postCompletionPollsRef.current++;
            setRunStartTime(null);
          }

          setStatus(data.status);
          setErrorMessage(data.errorMessage || null);
          setRefreshTrigger((prev) => prev + 1);
        }
      } catch (error) {
        console.error("Polling error:", error);
      }
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [conversationId, status, pendingMessages.length, hasPendingMatch]);

  // Compute combined messages
  const messages: SessionEntry[] = [
    ...serverMessages,
    ...pendingMessages.map((p): SessionEntry => ({
      type: "user",
      uuid: p.id,
      parentUuid: serverMessages.length > 0 ? serverMessages[serverMessages.length - 1].uuid : null,
      sessionId: "",
      timestamp: p.timestamp,
      isSidechain: false,
      message: {
        role: "user",
        content: p.content,
      },
    })),
  ];

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [serverMessages, pendingMessages]);

  const handleSubmit = useCallback(
    async (content: string) => {
      setIsSubmitting(true);
      setErrorMessage(null);
      postCompletionPollsRef.current = 0;
      setRunStartTime(Date.now());

      const pendingId = `pending-${Date.now()}`;
      const pendingMsg: PendingMessage = {
        id: pendingId,
        content,
        timestamp: new Date().toISOString(),
      };
      setPendingMessages((prev) => [...prev, pendingMsg]);

      try {
        const response = await fetch("/api/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversationId,
            content,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to send message");
        }

        const data = await response.json();
        setConversationId(data.conversationId);
        setStatus("running");
        setSidebarRefresh((prev) => prev + 1);
      } catch (error) {
        setPendingMessages((prev) => prev.filter((m) => m.id !== pendingId));
        setErrorMessage(error instanceof Error ? error.message : "Unknown error");
        setRunStartTime(null);
      } finally {
        setIsSubmitting(false);
      }
    },
    [conversationId]
  );

  // Load an existing conversation
  const loadConversation = useCallback(async (id: string) => {
    setConversationId(id);
    setServerMessages([]);
    setPendingMessages([]);
    setErrorMessage(null);
    postCompletionPollsRef.current = 0;
    setRunStartTime(null);

    try {
      const response = await fetch(`/api/conversations/${id}`);
      if (response.ok) {
        const data: ConversationResponse = await response.json();
        setServerMessages(data.messages);
        setStatus(data.status);
        setErrorMessage(data.errorMessage || null);
      }
    } catch {
      // polling will pick it up
    }
  }, []);

  // Start a new conversation
  const startNewConversation = useCallback(() => {
    setConversationId(null);
    setServerMessages([]);
    setPendingMessages([]);
    setStatus("idle");
    setErrorMessage(null);
    setRunStartTime(null);
    postCompletionPollsRef.current = 0;
  }, []);

  const isLoading = status === "running" || isSubmitting;
  const hasMessages = messages.length > 0;
  const showProcessingSteps = status === "running" && hasMessages;

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-border/60 px-5 h-[52px] bg-card/50 backdrop-blur-sm">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowSidebar((v) => !v)}
            className="p-1.5 hover:bg-accent rounded-lg transition-colors"
            title={showSidebar ? "Hide history" : "Show history"}
          >
            <PanelLeft className="size-4 text-muted-foreground" />
          </button>
          <div className="size-7 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
            <Search className="size-3.5 text-white" />
          </div>
          <span className="text-sm font-semibold tracking-tight">Reddit Deep-Dive Analyst</span>
        </div>
        <div className="flex items-center gap-1.5">
          {status === "running" && (
            <span className="text-xs text-orange-400 font-mono animate-pulse">analyzing...</span>
          )}
          <button
            onClick={startNewConversation}
            className="p-1.5 hover:bg-accent rounded-lg transition-colors"
            title="New conversation"
          >
            <MessageSquarePlus className="size-4 text-orange-400" />
          </button>
          <button
            onClick={toggleTheme}
            className="p-1.5 hover:bg-accent rounded-lg transition-colors"
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? (
              <Sun className="size-4 text-muted-foreground" />
            ) : (
              <Moon className="size-4 text-muted-foreground" />
            )}
          </button>
          {!showWorkspace && (
            <button
              onClick={() => setShowWorkspace(true)}
              className="p-1.5 hover:bg-accent rounded-lg transition-colors"
              title="Open workspace"
            >
              <PanelRight className="size-4 text-muted-foreground" />
            </button>
          )}
        </div>
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Conversation history sidebar */}
        {showSidebar && (
          <div className="w-[220px] shrink-0">
            <ConversationSidebar
              activeId={conversationId}
              onSelect={loadConversation}
              onNew={startNewConversation}
              refreshTrigger={sidebarRefresh}
            />
          </div>
        )}

        <ResizablePanelGroup direction="horizontal" className="flex-1">
          {/* Chat panel */}
          <ResizablePanel defaultSize={showWorkspace ? 55 : 100} minSize={40}>
          <div className="flex h-full flex-col">
            {/* Messages area */}
            <div className="flex-1 overflow-auto">
              {!hasMessages ? (
                /* Landing Page - completely redesigned */
                <div className="flex h-full flex-col items-center justify-center px-4 bg-grid relative">
                  {/* Gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-b from-background via-background/95 to-background pointer-events-none" />

                  <div className="relative z-10 flex flex-col items-center max-w-2xl w-full">
                    {/* Logo & Title */}
                    <div className="mb-2 size-14 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-lg glow-orange">
                      <Search className="size-7 text-white" />
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight mt-4 gradient-text">
                      Reddit Deep-Dive Analyst
                    </h1>
                    <p className="text-sm text-muted-foreground mt-2 text-center max-w-md leading-relaxed">
                      AI tool deep-dive research powered by Reddit community insights.
                      <br />
                      <span className="text-orange-400/70">Reviews, comparisons, and pain points — all in one report.</span>
                    </p>

                    {/* Example prompts */}
                    <div className="flex flex-wrap gap-2 mt-6 justify-center">
                      {EXAMPLE_PROMPTS.map((example) => (
                        <button
                          key={example.label}
                          onClick={() => handleSubmit(example.label)}
                          disabled={isLoading}
                          className="flex items-center gap-1.5 rounded-full border border-border/60 bg-card/50 px-3.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:border-orange-500/30 hover:bg-orange-500/5 transition-all duration-200 disabled:opacity-50"
                        >
                          {example.icon}
                          {example.label}
                        </button>
                      ))}
                    </div>

                    {/* Prompt Form */}
                    <div className="w-full max-w-xl mt-6">
                      <PromptForm
                        onSubmit={handleSubmit}
                        isLoading={isLoading}
                        disabled={status === "running"}
                        placeholder="Enter an AI tool to research (e.g. Cursor vs Claude Code)..."
                      />
                    </div>

                    {/* Subtle info */}
                    <p className="text-[11px] text-muted-foreground/50 mt-4">
                      Powered by Claude Agent SDK + Moru Sandbox
                    </p>
                  </div>
                </div>
              ) : (
                <div className="max-w-3xl mx-auto px-4 py-6">
                  <CCMessages entries={messages} />

                  {/* Processing Steps - shown during agent work */}
                  {showProcessingSteps && (
                    <div className="mt-6 animate-fade-in">
                      <ProcessingSteps
                        isRunning={status === "running"}
                        messages={serverMessages}
                        startTime={runStartTime ?? undefined}
                      />
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Error display */}
            {errorMessage && (
              <div className="mx-4 mb-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive animate-fade-in">
                {errorMessage}
              </div>
            )}

            {/* Bottom prompt form (only when there are messages) */}
            {hasMessages && (
              <div className="border-t border-border/60 p-4 bg-card/30 backdrop-blur-sm">
                <div className="max-w-3xl mx-auto">
                  <PromptForm
                    onSubmit={handleSubmit}
                    isLoading={isLoading}
                    disabled={status === "running"}
                    placeholder="Follow-up: deep-dive pricing, compare competitors, pain points..."
                  />
                </div>
              </div>
            )}
          </div>
        </ResizablePanel>

        {showWorkspace && (
          <>
            <ResizableHandle />
            <ResizablePanel defaultSize={45} minSize={25}>
              <WorkspacePanel
                conversationId={conversationId}
                refreshTrigger={refreshTrigger}
                onClose={() => setShowWorkspace(false)}
              />
            </ResizablePanel>
          </>
        )}
        </ResizablePanelGroup>
      </div>

      {/* Report download popup - appears when analysis is complete */}
      <ReportDownloadPopup
        conversationId={conversationId}
        isCompleted={status === "completed"}
        refreshTrigger={refreshTrigger}
      />
    </div>
  );
}
