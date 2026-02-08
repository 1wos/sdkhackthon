---
name: moru-javascript
description: "Use this skill when writing JavaScript or TypeScript code that interacts with Moru cloud sandboxes. This includes: creating sandboxes with `await Sandbox.create()`, running commands with `await sbx.commands.run()`, reading and writing files with `sbx.files.read()` and `sbx.files.write()`, working with persistent volumes using the `Volume` class, building custom templates with the `Template` builder, handling background processes, and streaming command output. The SDK includes full TypeScript types for `SandboxOpts`, `SandboxInfo`, `CommandResult`, `EntryInfo`, `VolumeInfo`, and more. Error handling uses typed exceptions: `TimeoutError`, `CommandExitError`, `AuthenticationError`, `NotFoundError`, `NotEnoughSpaceError` from `@moru-ai/core`. Use this skill whenever users want to: execute code safely in isolated environments from Node.js or browser applications, build AI agents that run untrusted code, create serverless functions that need compute isolation, or any JavaScript/TypeScript automation involving Moru sandboxes. Triggers on: 'moru javascript', 'moru typescript', 'moru node', '@moru-ai/core', 'npm install @moru', 'Sandbox.create', 'typescript sandbox', 'node sandbox', 'Volume.create', 'Template.build', or any JS/TS code that needs to run in isolated cloud environments. Do NOT use this skill for Python code - use moru-python instead."
---

# Moru JavaScript/TypeScript SDK

```bash
npm install @moru-ai/core
```

TypeScript types included.

## Quick Start

```typescript
import Sandbox from '@moru-ai/core'

const sbx = await Sandbox.create()
try {
  await sbx.files.write("/app/script.py", "print('Hello from Moru!')")
  const result = await sbx.commands.run("python3 /app/script.py")
  console.log(result.stdout)
} finally {
  await sbx.kill()
}
```

## Quick Reference

| Task | Code |
|------|------|
| Create sandbox | `await Sandbox.create()` or `await Sandbox.create("template")` |
| Run command | `await sbx.commands.run("cmd")` |
| Read file | `await sbx.files.read("/path")` |
| Write file | `await sbx.files.write("/path", "content")` |
| Background process | `await sbx.commands.run("cmd", { background: true })` |
| Set timeout | `Sandbox.create({ timeoutMs: 600000 })` or `sbx.setTimeout(600000)` |
| Use volume | `Sandbox.create({ volumeId, volumeMountPath: "/workspace" })` |

---

## Sandbox Lifecycle

### Create
```typescript
import Sandbox from '@moru-ai/core'

// Default template
const sbx = await Sandbox.create()

// Specific template
const sbx = await Sandbox.create("python")

// With options
const sbx = await Sandbox.create("python", {
  timeoutMs: 600000,                // milliseconds (default: 300000)
  metadata: { project: "myapp" },
  envs: { API_KEY: "secret" },
  volumeId: "vol_xxx",
  volumeMountPath: "/workspace",
  allowInternetAccess: true,
})
```

### Connect to Existing
```typescript
const sbx = await Sandbox.connect("sbx_abc123")
if (await sbx.isRunning()) {
  const result = await sbx.commands.run("echo still alive")
}
```

### Kill
```typescript
await sbx.kill()
// or
await Sandbox.kill("sbx_abc123")
```

### List All
```typescript
for await (const info of Sandbox.list()) {
  console.log(`${info.sandboxId}: ${info.state}`)
}
```

---

## Running Commands

### Basic
```typescript
const result = await sbx.commands.run("echo hello")
console.log(result.stdout)      // "hello\n"
console.log(result.stderr)      // ""
console.log(result.exitCode)    // 0
```

### With Options
```typescript
const result = await sbx.commands.run("python3 script.py", {
  cwd: "/app",                              // Working directory
  user: "root",                             // Run as root
  envs: { DEBUG: "1" },                    // Environment variables
  timeoutMs: 120000,                        // Command timeout (ms)
  onStdout: (data) => process.stdout.write(data),  // Stream stdout
  onStderr: (data) => process.stderr.write(data),  // Stream stderr
})
```

### Background Process
```typescript
const handle = await sbx.commands.run("python3 server.py", { background: true })

// Get public URL
const url = sbx.getHost(8080)
console.log(`Server at: ${url}`)

// Send input
await handle.sendStdin("quit\n")

// Wait for completion
const result = await handle.wait()

// Or kill it
await handle.kill()
```

### Process Management
```typescript
// List running processes
for (const proc of await sbx.commands.list()) {
  console.log(`PID ${proc.pid}: ${proc.command}`)
}

// Kill by PID
await sbx.commands.kill(1234)
```

---

## Working with Files

### Read/Write
```typescript
// Write
await sbx.files.write("/app/config.json", '{"key": "value"}')

// Read
const content = await sbx.files.read("/app/config.json")

// Binary
const bytes = await sbx.files.read("/app/image.png", { format: 'bytes' })
const blob = await sbx.files.read("/app/image.png", { format: 'blob' })
await sbx.files.write("/app/output.bin", binaryData)

// Stream large files
const stream = await sbx.files.read("/app/large.bin", { format: 'stream' })
```

### Multiple Files
```typescript
await sbx.files.write([
  { path: "/app/file1.txt", data: "content1" },
  { path: "/app/file2.txt", data: "content2" },
])
```

### Directory Operations
```typescript
// Check existence
if (await sbx.files.exists("/app/config.json")) {
  const config = await sbx.files.read("/app/config.json")
}

// List directory
for (const entry of await sbx.files.list("/app")) {
  console.log(`${entry.type}: ${entry.name} (${entry.size} bytes)`)
}

// Recursive list
const entries = await sbx.files.list("/app", { depth: 5 })

// Get info
const info = await sbx.files.getInfo("/app/file.txt")
console.log(`Size: ${info.size}, Modified: ${info.modifiedTime}`)

// Create directory
await sbx.files.makeDir("/app/data")

// Delete
await sbx.files.remove("/app/old_file.txt")

// Rename/Move
await sbx.files.rename("/app/old.txt", "/app/new.txt")
```

### Watch for Changes
```typescript
const handle = await sbx.files.watchDir("/app", (event) => {
  console.log(`${event.type}: ${event.name}`)
})
await handle.stop()
```

---

## Volumes (Persistent Storage)

```typescript
import Sandbox, { Volume } from '@moru-ai/core'

// Create volume (idempotent)
const vol = await Volume.create({ name: "my-workspace" })

// Attach to sandbox
const sbx = await Sandbox.create("base", {
  volumeId: vol.volumeId,
  volumeMountPath: "/workspace"  // Must be /workspace, /data, /mnt, or /volumes
})

// Data in /workspace persists after kill
await sbx.commands.run("echo 'persistent' > /workspace/data.txt")
await sbx.kill()

// Later - data still there
const sbx2 = await Sandbox.create("base", {
  volumeId: vol.volumeId,
  volumeMountPath: "/workspace"
})
const result = await sbx2.commands.run("cat /workspace/data.txt")
console.log(result.stdout)  // "persistent"
```

### Volume Operations (No Sandbox Needed)
```typescript
const vol = await Volume.get("my-workspace")

// List files
for (const f of await vol.listFiles("/")) {
  console.log(`${f.type}: ${f.name}`)
}

// Download/Upload
const content = await vol.download("/data.txt")
await vol.upload("/config.json", Buffer.from('{"key": "value"}'))

// Delete file
await vol.delete("/old_file.txt")

// Delete volume (WARNING: permanent)
await vol.delete()
```

---

## Templates

```typescript
import { Template, waitForPort } from '@moru-ai/core'

// Define template
const template = Template()
  .fromPythonImage("3.11")
  .aptInstall(["curl", "git"])
  .pipInstall(["flask", "pandas", "requests"])
  .copy("./app", "/app")
  .setWorkdir("/app")
  .setEnvs({ FLASK_ENV: "production" })
  .setStartCmd("python app.py", waitForPort(5000))

// Build
const info = await Template.build(template, { alias: "my-flask-app" })

// Use
const sbx = await Sandbox.create("my-flask-app")
```

### From Dockerfile
```typescript
const template = Template().fromDockerfile("./Dockerfile")
await Template.build(template, { alias: "my-app" })
```

### Build Options
```typescript
await Template.build(template, {
  alias: "my-app",
  cpuCount: 4,
  memoryMB: 2048,
  onBuildLogs: (entry) => console.log(entry.message),
})

// Background build
const info = await Template.buildInBackground(template, { alias: "my-app" })
const status = await Template.getBuildStatus(info)  // building, success, failed
```

---

## Error Handling

```typescript
import Sandbox, {
  SandboxError,              // Base
  TimeoutError,              // Operation timed out
  NotFoundError,             // Resource not found
  AuthenticationError,       // Invalid API key
  NotEnoughSpaceError,       // Disk full
  CommandExitError,          // Non-zero exit (has exitCode, stdout, stderr)
} from '@moru-ai/core'

try {
  const sbx = await Sandbox.create()
  try {
    const result = await sbx.commands.run("python3 script.py", { timeoutMs: 30000 })
  } finally {
    await sbx.kill()
  }
} catch (error) {
  if (error instanceof TimeoutError) {
    console.log("Command timed out")
  } else if (error instanceof CommandExitError) {
    console.log(`Failed with exit code ${error.exitCode}: ${error.stderr}`)
  } else if (error instanceof AuthenticationError) {
    console.log("Invalid API key - check MORU_API_KEY")
  }
}
```

---

## TypeScript Types

```typescript
import type {
  SandboxOpts,
  SandboxInfo,
  CommandResult,
  CommandStartOpts,
  EntryInfo,
  VolumeInfo,
} from '@moru-ai/core'
```

---

## Common Pitfalls

### Always cleanup sandboxes
```typescript
// ❌ WRONG
const sbx = await Sandbox.create()
await sbx.commands.run("echo hello")
// Forgot to kill - sandbox keeps running!

// ✅ CORRECT
const sbx = await Sandbox.create()
try {
  await sbx.commands.run("echo hello")
} finally {
  await sbx.kill()
}
```

### Don't assume packages exist
```typescript
// ❌ WRONG
await sbx.commands.run("python3 -c 'import pandas'")  // ImportError!

// ✅ CORRECT
await sbx.commands.run("pip install pandas", { timeoutMs: 120000 })
await sbx.commands.run("python3 -c 'import pandas'")
```

### Write to volume path for persistence
```typescript
// ❌ WRONG - lost on kill
await sbx.files.write("/home/user/data.txt", "important")

// ✅ CORRECT - persisted
await sbx.files.write("/workspace/data.txt", "important")
```

### Handle command failures
```typescript
const result = await sbx.commands.run("python3 script.py")
if (result.exitCode !== 0) {
  console.log(`Error: ${result.stderr}`)
}
```
