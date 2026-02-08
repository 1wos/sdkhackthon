"""
Hackathon TypeScript Agent Template

Builds from Dockerfile with:
- Node.js 20 runtime
- Claude Code CLI
- Claude Agent SDK for TypeScript
- Agent code at /app/agent.mts
- Claude Code credentials at ~/.claude/.credentials.json

Usage:
    cd ~/moru/hackathon-starter/agent
    python3 template.py

Prerequisites:
    pip3 install moru python-dotenv
    export MORU_API_KEY=moru_8f4a2b6c9d1e3f5a7b8c0d2e4f6a8b1c3d5e7f9a0b2c4d6e8f1a3b5c7d9e0f2a
"""

import os
from pathlib import Path

# Set API key
os.environ["MORU_API_KEY"] = "moru_8f4a2b6c9d1e3f5a7b8c0d2e4f6a8b1c3d5e7f9a0b2c4d6e8f1a3b5c7d9e0f2a"

from moru import Template, wait_for_timeout, default_build_logger

AGENT_DIR = Path(__file__).parent


def build_template():
    template_alias = "hackathon-ts-agent"

    print("=" * 50)
    print("Building Hackathon TypeScript Agent Template")
    print("=" * 50)
    print(f"\nTemplate alias: {template_alias}")
    print()

    template = (
        Template(file_context_path=str(AGENT_DIR))
        .from_dockerfile(str(AGENT_DIR / "Dockerfile"))
        .set_start_cmd("claude --version", wait_for_timeout(10_000))
    )

    build_info = Template.build(
        template,
        alias=template_alias,
        cpu_count=2,
        memory_mb=2048,
        on_build_logs=default_build_logger(),
    )

    print()
    print("=" * 50)
    print("Build Complete!")
    print("=" * 50)
    print()
    print(f"Template ID: {build_info.template_id}")
    print(f"Alias: {build_info.alias}")
    print()
    print("Agent code at: /app/agent.mts")
    print("Credentials at: ~/.claude/.credentials.json")
    print()
    print("Usage:")
    print(f"  sandbox = Sandbox.create('{template_alias}')")
    print("  sandbox.commands.run('cd /app && npx tsx agent.mts')")


if __name__ == "__main__":
    build_template()
