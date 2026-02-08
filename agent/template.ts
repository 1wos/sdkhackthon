/**
 * Hackathon TypeScript Agent Template
 *
 * Builds from Dockerfile with:
 * - Node.js 20 runtime
 * - Claude Code CLI
 * - Claude Agent SDK for TypeScript
 * - Agent code at /app/agent.mts
 * - Claude Code credentials at ~/.claude/.credentials.json
 *
 * Usage:
 *   pnpm --filter hackathon-agent run build:template
 *
 * Prerequisites:
 *   pnpm install
 *   MORU_API_KEY set in root .env
 */

import path from "path";
import { fileURLToPath } from "url";
import { Template, waitForTimeout } from "@moru-ai/core";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function buildTemplate() {
  const templateAlias = "team-agent";

  console.log("=".repeat(50));
  console.log("Building Hackathon TypeScript Agent Template");
  console.log("=".repeat(50));
  console.log(`\nTemplate alias: ${templateAlias}\n`);

  const template = Template({ fileContextPath: __dirname })
    .fromDockerfile(path.join(__dirname, "Dockerfile"))
    .setStartCmd("echo ok", waitForTimeout(5000));

  const buildInfo = await Template.build(template, {
    alias: templateAlias,
    cpuCount: 2,
    memoryMB: 2048,
    onBuildLogs: (entry) => console.log(entry.message),
  });

  console.log();
  console.log("=".repeat(50));
  console.log("Build Complete!");
  console.log("=".repeat(50));
  console.log();
  console.log(`Template ID: ${buildInfo.templateId}`);
  console.log(`Alias: ${buildInfo.alias}`);
  console.log();
  console.log("Agent code at: /app/agent.mts");
  console.log("Credentials at: ~/.claude/.credentials.json");
  console.log();
  console.log(`Usage:`);
  console.log(`  const sbx = await Sandbox.create('${templateAlias}')`);
  console.log(`  await sbx.commands.run('cd /app && npx tsx agent.mts')`);
}

buildTemplate().catch((err) => {
  console.error("Build failed:", err?.message || err);
  console.error("Error name:", err?.name);
  console.error("Error stack:", err?.stack);
  console.error("Full error:", JSON.stringify(err, Object.getOwnPropertyNames(err || {}), 2));
  process.exit(1);
});
