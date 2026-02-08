/**
 * Claude Code Session Types (v2.1.1)
 *
 * Simplified subset of types for rendering Claude Code session messages.
 * Full types are auto-generated from the JSON Schema definitions at:
 *   https://github.com/moru-ai/agent-schemas/claude-code/v2.1.1/session.schema.json
 *
 * Complete TypeScript types live in the maru monorepo:
 *   ~/moru/maru/packages/types/src/claude-code/session.ts
 *
 * This file contains only the types needed for the hackathon starter's
 * message rendering components. The full schema supports additional
 * message types (SummaryMessage, FileHistorySnapshot, QueueOperation)
 * and richer metadata (version, cwd, gitBranch, todos, etc.).
 */

// ============================================================================
// Content Blocks
// ============================================================================

export interface TextBlock {
  type: "text";
  text: string;
}

export interface ThinkingBlock {
  type: "thinking";
  thinking: string;
  signature: string;
}

export interface ToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ImageSource {
  type: "base64";
  media_type: "image/png" | "image/jpeg" | "image/gif" | "image/webp";
  data: string;
}

export interface ImageBlock {
  type: "image";
  source: ImageSource;
}

export interface ToolResultBlock {
  type: "tool_result";
  tool_use_id: string;
  content: string | Array<{ type: "text"; text: string } | { type: "image"; source: ImageSource }>;
  is_error?: boolean;
}

export type ContentBlock =
  | TextBlock
  | ThinkingBlock
  | ToolUseBlock
  | ToolResultBlock
  | ImageBlock;

// ============================================================================
// Messages
// ============================================================================

export interface UserMessagePayload {
  role: "user";
  content: string | ContentBlock[];
}

export interface UserMessage {
  type: "user";
  uuid: string;
  parentUuid: string | null;
  sessionId: string;
  timestamp: string;
  isSidechain: boolean;
  message: UserMessagePayload;
}

export interface UsageInfo {
  input_tokens: number;
  output_tokens: number;
}

export interface AssistantMessagePayload {
  model: string;
  id: string;
  type: "message";
  role: "assistant";
  content: ContentBlock[];
  stop_reason: "end_turn" | "tool_use" | "max_tokens" | "stop_sequence" | null;
  stop_sequence: string | null;
  usage: UsageInfo;
}

export interface AssistantMessage {
  type: "assistant";
  uuid: string;
  parentUuid: string | null;
  sessionId: string;
  timestamp: string;
  isSidechain: boolean;
  message: AssistantMessagePayload;
  isApiErrorMessage?: boolean;
  error?: string;
}

export type SystemMessageSubtype =
  | "local_command"
  | "turn_duration"
  | "api_error"
  | "stop_hook_summary"
  | "compact_boundary";

export interface CompactMetadata {
  trigger?: string;
  preTokens?: number;
}

export interface SystemMessage {
  type: "system";
  uuid: string;
  parentUuid: string | null;
  sessionId: string;
  timestamp: string;
  isSidechain: boolean;
  subtype: SystemMessageSubtype;
  content?: string;
  durationMs?: number;
  compactMetadata?: CompactMetadata;
}

export type SessionEntry = UserMessage | AssistantMessage | SystemMessage;

// ============================================================================
// Type Guards
// ============================================================================

export function isUserMessage(entry: SessionEntry): entry is UserMessage {
  return entry.type === "user";
}

export function isAssistantMessage(entry: SessionEntry): entry is AssistantMessage {
  return entry.type === "assistant";
}

export function isSystemMessage(entry: SessionEntry): entry is SystemMessage {
  return entry.type === "system";
}

export function isTextBlock(block: ContentBlock): block is TextBlock {
  return block.type === "text";
}

export function isThinkingBlock(block: ContentBlock): block is ThinkingBlock {
  return block.type === "thinking";
}

export function isToolUseBlock(block: ContentBlock): block is ToolUseBlock {
  return block.type === "tool_use";
}

export function isToolResultBlock(block: ContentBlock): block is ToolResultBlock {
  return block.type === "tool_result";
}

export function isImageBlock(block: ContentBlock): block is ImageBlock {
  return block.type === "image";
}

// ============================================================================
// API Types
// ============================================================================

export interface ConversationResponse {
  id: string;
  status: "idle" | "running" | "completed" | "error";
  messages: SessionEntry[];
  errorMessage?: string;
}

export interface SendMessageRequest {
  conversationId: string | null;
  content: string;
}

export interface SendMessageResponse {
  conversationId: string;
  status: "running";
}

export interface FileInfo {
  name: string;
  type: "file" | "directory";
  size?: number;
  path: string;
  children?: FileInfo[];
}

// Alias for compatibility with maru components
export type FileNode = FileInfo & { type: "file" | "folder" };

export interface StatusCallbackRequest {
  status: "completed" | "error";
  errorMessage?: string;
  sessionId?: string;
}

export interface ConversationSummary {
  id: string;
  title: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}
