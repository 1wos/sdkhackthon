#!/usr/bin/env node
/**
 * Hackathon Starter Agent - Claude Agent SDK integration for Moru sandbox.
 *
 * Protocol:
 * 1. Read process_start from stdin (with optional session_id for resume)
 * 2. Read session_message from stdin (user's prompt)
 * 3. Emit session_started with sessionId to stdout
 * 4. Call Claude Agent SDK query() with prompt
 * 5. On completion/error, call CALLBACK_URL to update status
 */

import { query } from "@anthropic-ai/claude-agent-sdk";
import * as readline from "readline";
import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

// Debug logging helper
function debug(msg: string, data?: any): void {
  const timestamp = new Date().toISOString();
  if (data !== undefined) {
    console.error(`[DEBUG ${timestamp}] ${msg}:`, JSON.stringify(data, null, 2));
  } else {
    console.error(`[DEBUG ${timestamp}] ${msg}`);
  }
}

// Types for our protocol
interface ProcessStartCommand {
  type: "process_start";
  session_id?: string;
}

interface SessionMessageCommand {
  type: "session_message";
  text?: string;
  content?: Array<{ type: string; text?: string }>;
}

interface AgentMessage {
  type: string;
  session_id?: string;
  message?: string;
  result?: {
    duration_ms?: number;
    duration_api_ms?: number;
    total_cost_usd?: number | null;
    num_turns?: number;
  };
}

function emit(msg: AgentMessage): void {
  console.log(JSON.stringify(msg));
}

function parseContent(msg: SessionMessageCommand): string {
  if (msg.text) return msg.text;
  if (msg.content) {
    return msg.content
      .filter((b) => b.type === "text" && b.text)
      .map((b) => b.text!)
      .join("\n");
  }
  return "";
}

/**
 * Line reader that buffers incoming lines for reliable reading.
 * This handles the case where stdin is piped quickly and multiple
 * lines arrive before we're ready to read them.
 */
class LineReader {
  private lines: string[] = [];
  private resolvers: ((line: string | null) => void)[] = [];
  private closed = false;

  constructor(rl: readline.Interface) {
    rl.on("line", (line) => {
      debug("LineReader received line", { lineLength: line.length, waitingResolvers: this.resolvers.length, bufferedLines: this.lines.length });
      if (this.resolvers.length > 0) {
        // Someone is waiting for a line, resolve immediately
        debug("LineReader: resolving immediately");
        const resolve = this.resolvers.shift()!;
        resolve(line);
      } else {
        // Buffer the line for later
        debug("LineReader: buffering line");
        this.lines.push(line);
      }
    });

    rl.on("close", () => {
      debug("LineReader: stdin closed", { pendingResolvers: this.resolvers.length, bufferedLines: this.lines.length });
      this.closed = true;
      // Resolve all pending readers with null
      while (this.resolvers.length > 0) {
        const resolve = this.resolvers.shift()!;
        resolve(null);
      }
    });
  }

  async readLine(): Promise<string | null> {
    // Check if we have buffered lines
    if (this.lines.length > 0) {
      return this.lines.shift()!;
    }

    // Check if stream is closed
    if (this.closed) {
      return null;
    }

    // Wait for next line
    return new Promise((resolve) => {
      this.resolvers.push(resolve);
    });
  }
}

/**
 * Flush filesystem buffers so JuiceFS uploads pending writes to object storage.
 * Must be called before the callback so the session JSONL is readable via the volume API.
 */
function flushVolume(): void {
  try {
    debug("Flushing volume (sync)...");
    execSync("sync", { timeout: 10_000 });
    debug("Volume flush complete");
  } catch (e) {
    debug("Volume flush failed (non-fatal)", { error: String(e) });
  }
}

async function callCallback(status: "completed" | "error", sessionId?: string, errorMessage?: string) {
  const callbackUrl = process.env.CALLBACK_URL;
  if (!callbackUrl) {
    console.error("[AGENT] No CALLBACK_URL set, skipping callback");
    return;
  }

  try {
    const response = await fetch(callbackUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status,
        sessionId,
        errorMessage,
      }),
    });

    if (!response.ok) {
      console.error(`[AGENT] Callback failed: ${response.status}`);
    }
  } catch (error) {
    console.error("[AGENT] Callback error:", error);
  }
}

async function main() {
  const workspace = process.env.WORKSPACE_DIR || process.cwd();
  const resumeSessionId = process.env.RESUME_SESSION_ID || undefined;

  // Debug: Log startup info
  debug("Agent starting");
  debug("Environment", {
    workspace,
    resumeSessionId,
    HOME: process.env.HOME,
    CALLBACK_URL: process.env.CALLBACK_URL,
    cwd: process.cwd(),
  });

  // Debug: Check credentials
  const credentialsPath = path.join(process.env.HOME || "/home/user", ".claude", ".credentials.json");
  const credentialsExists = fs.existsSync(credentialsPath);
  debug("Credentials check", {
    path: credentialsPath,
    exists: credentialsExists,
  });

  if (credentialsExists) {
    try {
      const creds = JSON.parse(fs.readFileSync(credentialsPath, "utf-8"));
      const expiresAt = creds?.claudeAiOauth?.expiresAt;
      if (expiresAt) {
        const expires = new Date(expiresAt);
        debug("Credentials expiry", {
          expiresAt: expires.toISOString(),
          isExpired: Date.now() > expiresAt,
        });
      }
    } catch (e) {
      debug("Failed to parse credentials", { error: String(e) });
    }
  }

  // Debug: List ~/.claude directory
  const claudeDir = path.join(process.env.HOME || "/home/user", ".claude");
  try {
    const claudeFiles = fs.readdirSync(claudeDir);
    debug("~/.claude directory contents", claudeFiles);
  } catch (e) {
    debug("Failed to list ~/.claude", { error: String(e) });
  }

  const rl = readline.createInterface({
    input: process.stdin,
    terminal: false,
  });

  const reader = new LineReader(rl);
  debug("LineReader initialized, waiting for stdin...");

  try {
    // Wait for process_start
    debug("Waiting for process_start...");
    const startLine = await reader.readLine();
    debug("Received line", { startLine });
    if (!startLine) {
      emit({ type: "process_error", message: "No input received" });
      return;
    }

    let startMsg: ProcessStartCommand;
    try {
      startMsg = JSON.parse(startLine);
    } catch {
      emit({ type: "process_error", message: "Invalid JSON for process_start" });
      return;
    }

    if (startMsg.type !== "process_start") {
      emit({ type: "process_error", message: "Expected process_start" });
      return;
    }

    // Use session_id from message or env
    const sessionIdToResume = startMsg.session_id || resumeSessionId || undefined;

    debug("Emitting process_ready", { sessionIdToResume });
    emit({
      type: "process_ready",
      session_id: sessionIdToResume || "pending",
    });

    // Wait for session_message
    debug("Waiting for session_message...");
    const msgLine = await reader.readLine();
    debug("Received line", { msgLine });
    if (!msgLine) {
      emit({ type: "process_error", message: "No session_message received" });
      return;
    }

    let sessionMsg: SessionMessageCommand;
    try {
      sessionMsg = JSON.parse(msgLine);
    } catch {
      emit({ type: "process_error", message: "Invalid JSON for session_message" });
      return;
    }

    if (sessionMsg.type !== "session_message") {
      emit({ type: "process_error", message: "Expected session_message" });
      return;
    }

    const prompt = parseContent(sessionMsg);
    if (!prompt) {
      emit({ type: "process_error", message: "Empty prompt" });
      return;
    }

    let currentSessionId: string | undefined = sessionIdToResume;
    let gotResult = false;

    debug("Starting query()", {
      prompt: prompt.substring(0, 100) + (prompt.length > 100 ? "..." : ""),
      workspace,
      resumeSessionId: sessionIdToResume,
    });

    // Run the agent
    for await (const message of query({
      prompt,
      options: {
        allowedTools: [
          "Read", "Write", "Edit", "Bash", "Grep", "Glob",
          "WebSearch", "WebFetch", "TodoWrite", "Task",
        ],
        maxTurns: 50,
        permissionMode: "bypassPermissions",
        allowDangerouslySkipPermissions: true, // Required when using bypassPermissions
        cwd: workspace,
        resume: sessionIdToResume,
        settingSources: ["user", "project"], // Load ~/.claude/CLAUDE.md, skills, and project settings
      },
    })) {
      // Debug: Log each message type from query
      debug("Query message", { type: message.type, subtype: (message as any).subtype });

      // Capture session_id from init message
      if (message.type === "system" && (message as any).subtype === "init") {
        currentSessionId = (message as any).session_id;
        emit({
          type: "session_started",
          session_id: currentSessionId,
        });
      }

      // Handle result message
      if ("result" in message && message.type === "result") {
        gotResult = true;
        const resultMsg = message as any;

        emit({
          type: "session_complete",
          session_id: currentSessionId,
          result: {
            duration_ms: resultMsg.duration_ms,
            duration_api_ms: resultMsg.duration_api_ms,
            total_cost_usd: resultMsg.total_cost_usd,
            num_turns: resultMsg.num_turns,
          },
        });

        // Flush volume before callback so session JSONL is persisted
        flushVolume();
        await callCallback("completed", currentSessionId);
      }
    }

    // If we didn't get a result, still call callback
    if (!gotResult) {
      console.error("[AGENT] Warning: query() ended without result");
      emit({
        type: "session_complete",
        session_id: currentSessionId,
        result: {
          duration_ms: 0,
          duration_api_ms: 0,
          total_cost_usd: 0,
          num_turns: 0,
        },
      });
      flushVolume();
      await callCallback("completed", currentSessionId);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[AGENT] Exception:", errorMessage);
    emit({ type: "process_error", message: errorMessage });
    flushVolume();
    await callCallback("error", undefined, errorMessage);
  } finally {
    rl.close();
    emit({ type: "process_stopped" });
  }
}

main().catch((error) => {
  console.error("[AGENT] Fatal error:", error);
  process.exit(1);
});
