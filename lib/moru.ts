import Sandbox, { Volume } from "@moru-ai/core";

const TEMPLATE_NAME = "team-agent";

/**
 * Create a new volume for a conversation
 */
export async function createVolume(conversationId: string): Promise<string> {
  const volume = await Volume.create({ name: `hackathon-${conversationId}` });
  return volume.volumeId;
}

/**
 * Get an existing volume
 */
export async function getVolume(volumeId: string) {
  return Volume.get(volumeId);
}

/**
 * Create a sandbox and launch the agent in a fully detached (fire-and-forget) way.
 *
 * ARCHITECTURE NOTE: We do NOT use `background: true` or `sendStdin()` because
 * those maintain a gRPC streaming connection from the Vercel function to the sandbox.
 * When the Vercel function returns and gets frozen/GC'd, the Moru server detects
 * the disconnected stream and kills the agent process — even if `disconnect()` is called.
 *
 * Instead, we:
 * 1. Write the input messages to a file inside the sandbox
 * 2. Launch the agent with `nohup` piping from that file, fully backgrounded
 * 3. All `commands.run()` calls are foreground (complete quickly, no streaming)
 * 4. The agent runs independently — no gRPC connection to maintain
 */
export async function createAndLaunchAgent(
  volumeId: string,
  conversationId: string,
  content: string,
  sessionId?: string
): Promise<{ sandboxId: string }> {
  const baseUrl = process.env.BASE_URL || "http://localhost:3000";

  const sandbox = await Sandbox.create(TEMPLATE_NAME, {
    volumeId,
    volumeMountPath: "/workspace/data",
    timeoutMs: 30 * 60 * 1000, // 30 minutes
  });

  // Create symlink ~/.claude -> /workspace/data/.claude so session files persist to volume
  await sandbox.commands.run(
    "mkdir -p /workspace/data/.claude && " +
    "cp -a /home/user/.claude/. /workspace/data/.claude/ && " +
    "rm -rf /home/user/.claude && " +
    "ln -sf /workspace/data/.claude /home/user/.claude"
  );

  // Write input messages to a file (the agent reads process_start + session_message from stdin)
  const processStart = JSON.stringify({ type: "process_start", session_id: sessionId || undefined });
  const sessionMessage = JSON.stringify({ type: "session_message", text: content });

  await sandbox.commands.run(
    `printf '%s\\n%s\\n' '${processStart.replace(/'/g, "'\\''")}' '${sessionMessage.replace(/'/g, "'\\''")}' > /tmp/agent_input.txt`
  );

  // Launch agent fully detached with nohup — no streaming connection maintained.
  // The agent reads from the input file, runs query(), and calls CALLBACK_URL when done.
  const callbackUrl = `${baseUrl}/api/conversations/${conversationId}/status`;
  await sandbox.commands.run(
    `nohup bash -c 'cd /workspace/data && WORKSPACE_DIR=/workspace/data CALLBACK_URL="${callbackUrl}" RESUME_SESSION_ID="${sessionId || ""}" npx tsx /app/agent.mts < /tmp/agent_input.txt >> /tmp/agent_stdout.log 2>> /tmp/agent_stderr.log' &>/dev/null &`
  );

  return { sandboxId: sandbox.sandboxId };
}

export interface FileInfo {
  name: string;
  type: "file" | "directory";
  size?: number;
  path: string;
  children?: FileInfo[];
}

/**
 * List files in a volume directory
 */
export async function listVolumeFiles(
  volumeId: string,
  path: string
): Promise<FileInfo[]> {
  const volume = await Volume.get(volumeId);

  try {
    const files = await volume.listFiles(path);
    return files.map((f) => ({
      name: f.name,
      type: f.type,
      size: f.size,
      path: f.path,
    }));
  } catch {
    return [];
  }
}

/**
 * Build a recursive file tree from a volume
 */
export async function buildFileTree(
  volumeId: string,
  path: string = "/",
  maxDepth: number = 5
): Promise<FileInfo[]> {
  const volume = await Volume.get(volumeId);

  async function buildNode(
    currentPath: string,
    depth: number
  ): Promise<FileInfo[]> {
    if (depth > maxDepth) return [];

    try {
      const files = await volume.listFiles(currentPath);
      const result: FileInfo[] = [];

      for (const f of files) {
        const node: FileInfo = {
          name: f.name,
          type: f.type,
          size: f.size,
          path: f.path,
        };

        if (f.type === "directory") {
          node.children = await buildNode(f.path, depth + 1);
        }

        result.push(node);
      }

      // Sort: directories first, then alphabetically
      result.sort((a, b) => {
        if (a.type === "directory" && b.type !== "directory") return -1;
        if (a.type !== "directory" && b.type === "directory") return 1;
        return a.name.localeCompare(b.name);
      });

      return result;
    } catch {
      return [];
    }
  }

  return buildNode(path, 0);
}

/**
 * Read a file from a volume
 * Note: Bypasses SDK's volume.download() due to 401 bug - calls API directly
 */
export async function readVolumeFile(
  volumeId: string,
  path: string
): Promise<string> {
  // Ensure path is absolute
  const absolutePath = path.startsWith("/") ? path : `/${path}`;

  // Bypass SDK bug: call API directly
  const apiKey = process.env.MORU_API_KEY;
  const response = await fetch(
    `https://api.moru.io/volumes/${volumeId}/files/download?path=${encodeURIComponent(absolutePath)}`,
    {
      headers: { "X-API-Key": apiKey || "" },
    }
  );

  if (!response.ok) {
    throw new Error(`Download failed: ${response.status} ${response.statusText}`);
  }

  return response.text();
}

/**
 * Kill a sandbox
 */
export async function killSandbox(sandboxId: string) {
  try {
    await Sandbox.kill(sandboxId);
  } catch {
    // Sandbox might already be dead
  }
}
