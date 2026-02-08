---
name: moru
description: "Use this skill for Moru cloud sandbox concepts, CLI commands, and general guidance. Moru provides isolated Firecracker microVMs with dedicated CPU, memory, and filesystem for safe code execution. This skill covers: installing the Moru CLI, authenticating with `moru auth login`, creating sandboxes with `moru sandbox create`, running commands with `moru sandbox run`, managing templates with `moru template`, working with persistent volumes via `moru volume`, and understanding core concepts like sandboxes, templates, and volumes. Use this skill when users ask about Moru architecture, CLI usage, environment variables (MORU_API_KEY, MORU_ACCESS_TOKEN), resource limits, or when unsure which SDK to use. For writing Python code with sandboxes, use moru-python instead. For JavaScript/TypeScript code, use moru-javascript instead. Triggers on: 'moru cli', 'moru sandbox', 'moru template', 'moru volume', 'moru auth', 'install moru', 'what is moru', 'moru concepts'."
---

# Moru Cloud Sandboxes

Isolated Firecracker microVMs with dedicated CPU, memory, and filesystem for safe code execution.

## When to Use Which Skill

| Skill | Use When |
|-------|----------|
| **moru** (this) | CLI, general concepts, architecture |
| **moru-python** | Python SDK (`pip install moru`) |
| **moru-javascript** | JavaScript/TypeScript SDK (`npm install @moru-ai/core`) |

## Core Concepts

### Sandbox
Isolated VM with up to 2 vCPUs, 4GB RAM, 10GB disk. Default timeout is 1 hour.

### Template
Pre-built environment with packages installed. Sandboxes start instantly from templates.

### Volume
Persistent storage that survives sandbox restarts. Mount to `/workspace`, `/data`, `/mnt`, or `/volumes`.

## CLI Quick Start

```bash
# Install
curl -fsSL https://moru.io/cli/install.sh | bash

# Login
moru auth login

# Run command in sandbox
moru sandbox run base echo 'hello world'

# Interactive sandbox
moru sandbox create python

# List/kill
moru sandbox list
moru sandbox kill sbx_abc123
```

## CLI Reference

### Sandbox Commands
```bash
moru sandbox create [template]      # Create interactive sandbox
moru sandbox run [template] <cmd>   # Run command, auto-cleanup
moru sandbox exec <id> <cmd>        # Execute in existing sandbox
moru sandbox list                   # List sandboxes
moru sandbox kill <id>              # Kill sandbox
moru sandbox logs <id> [--follow]   # View logs
moru sandbox metrics <id>           # View CPU/memory/disk
```

### Template Commands
```bash
moru template init                              # Initialize template project
moru template create <name> --dockerfile ./Dockerfile
moru template list
moru template delete <name>
```

### Volume Commands
```bash
moru volume create --name <name>
moru volume list
moru volume delete <name>
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `MORU_API_KEY` | API key (get from https://moru.io/dashboard?tab=keys) |
| `MORU_ACCESS_TOKEN` | Access token from `moru auth login` |

## Resource Limits

| Resource | Maximum |
|----------|---------|
| vCPUs | 2 |
| Memory | 4 GB |
| Disk | 10 GB |
| Timeout | 1 hour |
| Concurrent Sandboxes | 20 per team |
