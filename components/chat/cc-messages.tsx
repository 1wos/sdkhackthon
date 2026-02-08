"use client";

import { useMemo } from "react";
import type {
  SessionEntry,
  UserMessage,
  AssistantMessage,
  SystemMessage,
  ContentBlock,
  ToolResultBlock,
  ToolUseBlock,
} from "@/lib/types";
import {
  isUserMessage,
  isAssistantMessage,
  isSystemMessage,
  isToolResultBlock,
  isToolUseBlock,
} from "@/lib/types";
import { CCUserMessage } from "./cc-user-message";
import { CCAssistantMessage } from "./cc-assistant-message";
import { CCSystemMessage, shouldShowSystemMessage } from "./cc-system-message";

interface CCMessagesProps {
  entries: SessionEntry[];
}

interface MergedAssistantMessage {
  type: "merged-assistant";
  messageId: string;
  message: AssistantMessage;
  mergedContent: ContentBlock[];
  sourceUuids: string[];
}

type DisplayEntry = UserMessage | MergedAssistantMessage | SystemMessage;

/**
 * Check if a user message is purely tool results
 */
function isPureToolResultMessage(entry: UserMessage): boolean {
  const content = entry.message.content;
  if (typeof content === "string") return false;
  const hasToolResult = content.some(isToolResultBlock);
  const hasText = content.some(
    (b) => "type" in b && b.type === "text" && "text" in b && (b as { text: string }).text.trim()
  );
  return hasToolResult && !hasText;
}

/**
 * Deduplicate content blocks
 */
function deduplicateContentBlocks(blocks: ContentBlock[]): ContentBlock[] {
  const result: ContentBlock[] = [];
  const seenToolUseIds = new Set<string>();
  const seenThinkingSignatures = new Set<string>();
  let lastTextContent = "";

  for (const block of blocks) {
    if ("type" in block) {
      switch (block.type) {
        case "tool_use": {
          const toolBlock = block as ToolUseBlock;
          if (!seenToolUseIds.has(toolBlock.id)) {
            seenToolUseIds.add(toolBlock.id);
            result.push(block);
          }
          break;
        }
        case "thinking": {
          const thinkingBlock = block as { type: "thinking"; signature?: string };
          const sig = thinkingBlock.signature || Math.random().toString();
          if (!seenThinkingSignatures.has(sig)) {
            seenThinkingSignatures.add(sig);
            result.push(block);
          }
          break;
        }
        case "text": {
          const textBlock = block as { type: "text"; text: string };
          if (textBlock.text.length > lastTextContent.length) {
            const newResult = result.filter(
              (b) =>
                !("type" in b) ||
                b.type !== "text" ||
                !("text" in b) ||
                !(textBlock.text as string).startsWith((b as { text: string }).text)
            );
            result.length = 0;
            result.push(...newResult);
            result.push(block);
            lastTextContent = textBlock.text;
          }
          break;
        }
        case "image":
          result.push(block);
          break;
        default:
          result.push(block);
      }
    }
  }

  return result;
}

/**
 * Process session entries into display-ready format
 */
function processEntries(entries: SessionEntry[]): {
  displayEntries: DisplayEntry[];
  toolResultsMap: Map<string, ToolResultBlock>;
} {
  const toolResultsMap = new Map<string, ToolResultBlock>();

  for (const entry of entries) {
    if (!isUserMessage(entry)) continue;
    const content = entry.message.content;
    if (typeof content === "string") continue;

    for (const block of content) {
      if (isToolResultBlock(block)) {
        toolResultsMap.set(block.tool_use_id, block);
      }
    }
  }

  const assistantByMessageId = new Map<
    string,
    { entries: AssistantMessage[]; allContent: ContentBlock[] }
  >();

  for (const entry of entries) {
    if (!isAssistantMessage(entry)) continue;
    if (entry.isSidechain) continue;

    const msgId = entry.message.id;
    if (!msgId) continue;

    const existing = assistantByMessageId.get(msgId);
    if (existing) {
      existing.entries.push(entry);
      existing.allContent.push(...entry.message.content);
    } else {
      assistantByMessageId.set(msgId, {
        entries: [entry],
        allContent: [...entry.message.content],
      });
    }
  }

  const displayEntries: DisplayEntry[] = [];
  const processedMessageIds = new Set<string>();

  for (const entry of entries) {
    if (isSystemMessage(entry)) {
      if (shouldShowSystemMessage(entry)) {
        displayEntries.push(entry);
      }
      continue;
    }

    if (isUserMessage(entry)) {
      if (entry.isSidechain) continue;
      if (isPureToolResultMessage(entry)) continue;
      displayEntries.push(entry);
      continue;
    }

    if (isAssistantMessage(entry)) {
      if (entry.isSidechain) continue;

      const msgId = entry.message.id;
      if (!msgId) continue;

      if (processedMessageIds.has(msgId)) continue;
      processedMessageIds.add(msgId);

      const group = assistantByMessageId.get(msgId);
      if (!group || group.entries.length === 0) continue;

      const mergedContent = deduplicateContentBlocks(group.allContent);
      const lastEntry = group.entries[group.entries.length - 1]!;

      displayEntries.push({
        type: "merged-assistant",
        messageId: msgId,
        message: lastEntry,
        mergedContent,
        sourceUuids: group.entries.map((e) => e.uuid),
      });
    }
  }

  return { displayEntries, toolResultsMap };
}

/**
 * Claude Code Messages Container
 */
export function CCMessages({ entries }: CCMessagesProps) {
  const { displayEntries, toolResultsMap } = useMemo(
    () => processEntries(entries),
    [entries]
  );

  return (
    <div className="flex flex-col gap-6">
      {displayEntries.map((entry) => {
        if ("type" in entry && entry.type === "system") {
          return (
            <CCSystemMessage
              key={(entry as SystemMessage).uuid}
              message={entry as SystemMessage}
            />
          );
        }

        if ("type" in entry && entry.type === "user") {
          return <CCUserMessage key={entry.uuid} message={entry as UserMessage} />;
        }

        if ("type" in entry && entry.type === "merged-assistant") {
          const merged = entry as MergedAssistantMessage;

          const messageToolResults = new Map<string, ToolResultBlock>();
          for (const block of merged.mergedContent) {
            if (isToolUseBlock(block)) {
              const result = toolResultsMap.get(block.id);
              if (result) {
                messageToolResults.set(block.id, result);
              }
            }
          }

          return (
            <CCAssistantMessage
              key={merged.messageId}
              message={merged.message}
              mergedContent={merged.mergedContent}
              toolResults={messageToolResults}
            />
          );
        }

        return null;
      })}
    </div>
  );
}
