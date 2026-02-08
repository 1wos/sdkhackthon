# Hackathon Starter

## Architecture Overview

- **Web tier**: Next.js on Vercel (UI, API routes, database)
- **Agent tier**: Moru sandbox (isolated compute running Claude Agent SDK)
- **Storage**: PostgreSQL (conversation state), Moru Volumes (workspace files)
- **Template alias**: `moru-hackathon-agent` (defined in `agent/template.ts` and `lib/moru.ts`)

## Moru CLI - Setup

Install the CLI and authenticate:

```bash
curl -fsSL https://moru.io/cli/install.sh | bash   # Install Moru CLI
moru auth login                                      # Opens browser for authentication
moru auth info                                       # Verify you're logged in
```

You also need `MORU_API_KEY` in your `.env` for the SDK (get it from https://moru.io/dashboard?tab=keys).

## Environment Variables

Required in `.env` (local) and Vercel dashboard (production):

```
DATABASE_URL="postgresql://..."              # PostgreSQL connection string
MORU_API_KEY="moru_..."                      # Moru API key
ANTHROPIC_API_KEY="sk-ant-..."               # Claude API key (embedded in template via .credentials.json)
BASE_URL="https://your-app.vercel.app"       # Callback URL for agent -> web app
```

**CRITICAL**: `BASE_URL` must NOT have a trailing newline or slash. The agent uses it for callbacks:
`${BASE_URL}/api/conversations/${id}/status`. A newline in the URL will silently break callbacks.

## Moru CLI - Sandbox Debugging

You can also guide the user to check the Moru dashboard at https://moru.io/dashboard to monitor sandboxes, templates, and builds.

Use `moru sandbox --help` to discover available commands. Key debugging workflow:

```bash
moru sandbox list                    # List all sandboxes (recent, with status/end reason)
moru sandbox logs <sandboxID>        # View stdout/stderr logs from a sandbox
moru sandbox exec <sandboxID> <cmd>  # Run a command inside a running sandbox
moru sandbox create <template>       # Create a sandbox for manual testing
moru sandbox kill <sandboxID>        # Kill a running sandbox
```

When debugging a failing sandbox:
1. `moru sandbox list` - check if it exists and its status/end reason
2. `moru sandbox logs <id>` - read the full output to find errors
3. `moru sandbox exec <id> <cmd>` - inspect files, env vars, or run commands inside a live sandbox
4. Create a fresh sandbox to test changes: `moru sandbox create <template>` then `exec` into it

### Common Sandbox Issues

**Sandbox shows "killed" end reason**:
- **This is often NORMAL behavior**: When the agent completes successfully, it sends a callback to the web app, which then kills the sandbox via `Sandbox.kill()`. The "killed" end reason is expected for successful completions.
- To verify it was a normal kill: check that the conversation status is "completed" in the DB (`pnpm db:studio`) and that the frontend shows the response.
- If the conversation is stuck in "running" status with a killed sandbox, the callback failed:
  - Check if the CALLBACK_URL in sandbox logs has a newline or malformed URL
  - Run: `moru sandbox logs <id> | grep CALLBACK` to inspect
  - Check for 401 errors (Vercel Deployment Protection / SSO blocking callbacks)
  - The Vercel serverless function has a timeout (~30s for hobby plan). If the agent takes too long and the callback URL is broken, the sandbox gets killed when the function times out.

**Sandbox starts but agent never responds**:
- Check `moru sandbox logs <id>` for credential errors
- Look for `"isExpired": true` in the debug output - means Claude Code credentials expired
- Verify `.credentials.json` was properly embedded during `pnpm build:template`

**Agent writes files to wrong path**:
- Agent CWD is `/workspace/data` (the volume mount), but Claude Code may default to `/home/user/`
- Files written to `/home/user/` do NOT persist to the volume
- Files in `/workspace/data/` persist and are visible in the workspace file explorer
- Session files persist at `/workspace/data/.claude/` via symlink from `~/.claude`

**Multi-turn: agent can't find files from previous turn**:
- Each turn creates a new sandbox, so files at `/home/user/` are lost between turns
- Files at `/workspace/data/` persist via the Moru volume and are available in subsequent turns
- The agent session is resumed via `RESUME_SESSION_ID`, so it has conversation history context
- If the agent wrote to `/home/user/` in a previous turn, it will get "file not found" — this is expected; the agent typically self-corrects and recreates at `/workspace/data/`

**Template build fails with "alias already taken"**:
- The template alias is globally unique per Moru account
- If you change `MORU_API_KEY`, you need a new alias
- Update both `agent/template.ts` (line 26) and `lib/moru.ts` (line 3) to match

## Template Rebuild Workflow

When you change agent code or credentials:

```bash
# 1. Update .env with your MORU_API_KEY
# 2. Rebuild the template
pnpm build:template

# 3. If alias conflict, change alias in BOTH:
#    - agent/template.ts (templateAlias variable)
#    - lib/moru.ts (TEMPLATE_NAME constant)
#    Then rebuild again

# 4. Redeploy Vercel to pick up code changes
npx vercel --prod -y
```

## Vercel Deployment - Debugging

### Deploy Workflow

```bash
# List recent deployments
npx vercel ls

# Deploy to production
npx vercel --prod -y

# Check deployment logs
npx vercel inspect <deployment-url> --logs

# List projects and production URLs
npx vercel project ls
```

### Vercel Environment Variables

```bash
# List env vars
npx vercel env ls

# Add/update an env var (use printf to avoid trailing newline!)
printf 'value_without_newline' | npx vercel env add VAR_NAME production

# Remove an env var
npx vercel env rm VAR_NAME production -y

# IMPORTANT: After changing env vars, redeploy:
npx vercel --prod -y
```

**GOTCHA**: Using `echo` to pipe env values adds a trailing `\n`. Always use `printf` instead:
```bash
# BAD - adds newline to the value:
echo 'https://myapp.vercel.app' | npx vercel env add BASE_URL production

# GOOD - no trailing newline:
printf 'https://myapp.vercel.app' | npx vercel env add BASE_URL production
```

### Common Vercel Issues

**Build fails with Prisma error**:
- Ensure `DATABASE_URL` is set in Vercel env vars
- The build script runs `prisma generate && next build`
- If the DB is unreachable during build, the Prisma client still generates (it only needs the schema)

**API routes return 500**:
- Check Vercel function logs: `npx vercel inspect <url> --logs`
- Common cause: missing env vars (MORU_API_KEY, DATABASE_URL, BASE_URL)
- Vercel serverless functions have a 30s timeout on hobby plan

**Agent callback never arrives**:
- Check `BASE_URL` in Vercel env vars for trailing newline/slash
- Verify with: `moru sandbox logs <id> | grep CALLBACK`
- The callback URL format: `${BASE_URL}/api/conversations/${id}/status`

**Agent callback returns 401 (Vercel Deployment Protection / SSO)**:
- Vercel projects may have "Deployment Protection" (SSO authentication) enabled by default
- This blocks ALL unauthenticated requests to the deployment, including agent callbacks from Moru sandboxes
- Symptom: `moru sandbox logs <id>` shows `Callback failed: 401`, and `curl` to the status endpoint returns an HTML page with "Authentication Required"
- Diagnosis: `curl -s https://your-app.vercel.app/api/conversations/test/status | head -5` — if it returns HTML instead of JSON, SSO is blocking
- Fix: Disable Deployment Protection via Vercel API:
  ```bash
  # Get your Vercel auth token
  cat ~/Library/Application\ Support/com.vercel.cli/auth.json  # macOS

  # Get your project ID
  cat .vercel/project.json

  # Disable SSO protection
  curl -s -X PATCH "https://api.vercel.com/v9/projects/<PROJECT_ID>" \
    -H "Authorization: Bearer <VERCEL_TOKEN>" \
    -H "Content-Type: application/json" \
    -d '{"ssoProtection":null}'

  # Redeploy after changing protection settings
  npx vercel --prod -y
  ```
- Alternative: You can also disable it in the Vercel dashboard under Project Settings → Deployment Protection

## PostgreSQL Database - Debugging

### Connection

```bash
# Check connection string format
# postgresql://user:password@host:port/database

# For Vercel Postgres (Neon):
# postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require

# Push schema to database
pnpm db:push

# Open Prisma Studio (GUI)
pnpm db:studio
```

### Schema

The app has a single `Conversation` model:
```
id, status (idle/running/completed/error), volumeId, sandboxId, sessionId, errorMessage
```

### Common DB Issues

**"Can't reach database server"**:
- Check `DATABASE_URL` format and credentials
- For local dev: ensure PostgreSQL is running (`brew services start postgresql`)
- For production: check the connection string includes `?sslmode=require` for hosted DBs

**Conversation stuck in "running" status**:
- The agent sandbox was likely killed before sending the callback
- Debug: `moru sandbox logs <sandboxId from DB>` to see what happened
- Fix: manually update status via Prisma Studio (`pnpm db:studio`)

**Schema out of sync**:
- Run `pnpm db:push` to push latest schema
- For production: `DATABASE_URL="prod_url" npx prisma db push`

## Debugging the Full Request Flow

When a message is sent, the flow is:

1. **Frontend** sends `POST /api/conversations` with `{conversationId, content}`
2. **API route** creates/gets conversation in DB, creates Moru volume + sandbox
3. **Sandbox** starts agent at `/app/agent.mts`, sends `process_start` + `session_message`
4. **Agent** runs Claude Code SDK `query()`, streams tool use to stdout
5. **Frontend** polls `GET /api/conversations/{id}` every 2 seconds
6. **API route** reads session JSONL file from volume, returns messages
7. **Agent** completes, sends `POST ${BASE_URL}/api/conversations/{id}/status`
8. **API route** updates DB status to "completed", kills sandbox

### Debug each step:

| Step | How to debug |
|------|-------------|
| 1-2 | Check Vercel function logs, browser Network tab |
| 3 | `moru sandbox list` + `moru sandbox logs <id>` |
| 4 | `moru sandbox logs <id>` - look for query messages |
| 5-6 | Browser Network tab - check `/api/conversations/{id}` responses |
| 7 | `moru sandbox logs <id> \| grep CALLBACK` - check URL is correct |
| 8 | `pnpm db:studio` - check conversation status field |

## Volume Debugging

Volumes store workspace files and persist across sandbox restarts. They're SDK-only (no CLI command).

**Volume files API** (from the running app):
```
GET /api/conversations/{id}/files?path=/&tree=true    # List all files
GET /api/conversations/{id}/files/{filepath}           # Read file content
```

**Direct API call** (for debugging):
```bash
curl -H "X-API-Key: $MORU_API_KEY" \
  "https://api.moru.io/volumes/{volumeId}/files/download?path=/hello.py"
```

**Volume mount path**: `/workspace/data` inside the sandbox.

### Volume gotchas:
- `readVolumeFile` in `lib/moru.ts` uses direct API call (bypasses SDK bug with 401)
- Volume files are only visible if written to `/workspace/data/`, not `/home/user/`
- The `.claude/` directory is symlinked: `~/.claude -> /workspace/data/.claude`

---

Whenever you change this file, update AGENTS.md with the same content.
