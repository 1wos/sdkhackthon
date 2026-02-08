# Moru API Reference

Complete API reference for Python and JavaScript SDKs.

## Installation

```bash
# Python
pip install moru

# JavaScript/TypeScript
npm install @moru-ai/core

# CLI
curl -fsSL https://moru.io/cli/install.sh | bash
```

---

## Sandbox

### Create

```python
# Python
from moru import Sandbox

sbx = Sandbox.create()
sbx = Sandbox.create("python")  # Use specific template
sbx = Sandbox.create(
    template="python",
    timeout=600,                    # seconds
    metadata={"key": "value"},
    envs={"VAR": "value"},
    volume_id="vol_xxx",
    volume_mount_path="/workspace",
    allow_internet_access=True,
)
```

```typescript
// JavaScript
import Sandbox from '@moru-ai/core'

const sbx = await Sandbox.create()
const sbx = await Sandbox.create("python")
const sbx = await Sandbox.create("python", {
  timeoutMs: 600000,              // milliseconds
  metadata: { key: "value" },
  envs: { VAR: "value" },
  volumeId: "vol_xxx",
  volumeMountPath: "/workspace",
  allowInternetAccess: true,
})
```

### Connect / Kill / Info

```python
# Connect to existing
sbx = Sandbox.connect("sbx_xxx")

# Check if running
sbx.is_running()

# Get info
info = sbx.get_info()  # template_id, started_at, end_at, state, cpu_count, memory_mb

# Get metrics
metrics = sbx.get_metrics()  # cpu_used_pct, mem_used, mem_total, disk_used, disk_total

# Set timeout
sbx.set_timeout(1800)  # seconds

# Get public URL for port
url = sbx.get_host(8080)

# Kill
sbx.kill()

# List all sandboxes
for info in Sandbox.list():
    print(info.sandbox_id)
```

---

## Commands

```python
# Basic run
result = sbx.commands.run("echo 'hello'")
# Returns: stdout, stderr, exit_code

# With options
result = sbx.commands.run(
    "python script.py",
    cwd="/app",                    # Working directory
    user="root",                   # Run as user
    envs={"DEBUG": "1"},          # Environment variables
    timeout=120,                   # seconds (Python) / timeoutMs (JS)
    on_stdout=lambda d: print(d), # Stream stdout
    on_stderr=lambda d: print(d), # Stream stderr
)

# Background process
handle = sbx.commands.run("python server.py", background=True)
handle.send_stdin("input\n")
handle.wait()
handle.kill()

# List/kill processes
processes = sbx.commands.list()
sbx.commands.kill(pid)
```

---

## Files

```python
# Read
content = sbx.files.read("/path/to/file.txt")
binary = sbx.files.read("/path/to/file.bin", format="bytes")
stream = sbx.files.read("/path/to/large.bin", format="stream")

# Write
sbx.files.write("/path/to/file.txt", "content")
sbx.files.write("/path/to/file.bin", binary_data)

# Write multiple
sbx.files.write_files([
    {"path": "/file1.txt", "data": "content1"},
    {"path": "/file2.txt", "data": "content2"},
])

# Operations
sbx.files.exists("/path")
sbx.files.list("/path")
sbx.files.list("/path", depth=5)  # Recursive
sbx.files.get_info("/path")       # name, type, size, permissions, modified_time
sbx.files.remove("/path")
sbx.files.rename("/old", "/new")
sbx.files.make_dir("/path")

# Watch for changes
handle = sbx.files.watch_dir("/path")
for event in handle.events():
    print(f"{event.type}: {event.name}")
handle.stop()
```

---

## Volumes

```python
from moru import Volume

# Create (idempotent)
vol = Volume.create(name="my-workspace")

# Get
vol = Volume.get("vol_xxx")       # by ID
vol = Volume.get("my-workspace")  # by name

# List
for vol in Volume.list():
    print(f"{vol.name}: {vol.total_size_bytes} bytes")

# Properties
vol.volume_id
vol.name
vol.total_size_bytes
vol.total_file_count

# File operations (no sandbox needed)
files = vol.list_files("/")
content = vol.download("/path/to/file")
vol.upload("/path/to/file", b"content")
vol.delete("/path/to/file")

# Delete volume
vol.delete()
```

### Attach to Sandbox

```python
sbx = Sandbox.create(
    volume_id=vol.volume_id,
    volume_mount_path="/workspace"  # Must be /workspace, /data, /mnt, or /volumes
)
```

---

## Templates

```python
from moru import Template
from moru.template import wait_for_port, wait_for_url

# Build template
template = (
    Template()
    .from_python_image("3.11")           # or from_node_image, from_ubuntu_image
    .apt_install(["curl", "git"])
    .pip_install(["flask", "pandas"])    # or npm_install, bun_install
    .copy("./src", "/app/src")
    .set_workdir("/app")
    .set_envs({"NODE_ENV": "production"})
    .set_start_cmd("python app.py", wait_for_port(8000))
)

# Build
info = Template.build(template, alias="my-app")
info = Template.build(template, alias="my-app", cpu_count=4, memory_mb=2048)

# Build in background
info = Template.build_in_background(template, alias="my-app")
status = Template.get_build_status(info)  # building, success, failed

# From Dockerfile
template = Template().from_dockerfile("./Dockerfile")
```

---

## PTY (Interactive Terminal)

```python
handle = sbx.pty.create(
    cols=80,
    rows=24,
    on_data=lambda data: print(data.decode(), end="")
)
handle.send_input("ls -la\n")
handle.resize(120, 40)
handle.kill()

# Start with command
handle = sbx.pty.start("python3", cols=80, rows=24, on_data=print)
```

---

## Exceptions

```python
from moru.exceptions import (
    SandboxException,           # Base
    TimeoutException,           # Operation timed out
    NotFoundException,          # Resource not found
    AuthenticationException,    # Invalid API key
    NotEnoughSpaceException,    # Disk full
    CommandExitException,       # Non-zero exit code (has exit_code, stdout, stderr)
    TemplateException,          # Template error
    RateLimitException,         # Rate limit exceeded
)
```

```typescript
import {
  SandboxError,
  TimeoutError,
  NotFoundError,
  AuthenticationError,
  NotEnoughSpaceError,
  CommandExitError,
  TemplateError,
  RateLimitError,
} from '@moru-ai/core'
```

---

## CLI Commands

```bash
# Auth
moru auth login
moru auth info
moru auth logout

# Sandbox
moru sandbox create [template]
moru sandbox run [template] <cmd>
moru sandbox exec <id> <cmd>
moru sandbox list
moru sandbox kill <id>
moru sandbox logs <id> [--follow]
moru sandbox metrics <id>

# Template
moru template init
moru template create <name> [--dockerfile ./Dockerfile]
moru template list
moru template delete <name>

# Volume
moru volume create --name <name>
moru volume list
moru volume delete <name>
```

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `MORU_API_KEY` | API key for SDK/CLI |
| `MORU_ACCESS_TOKEN` | Access token from login |
| `MORU_DOMAIN` | API domain (default: moru.io) |
