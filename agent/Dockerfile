FROM node:20-bookworm

# Install system dependencies
RUN apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y \
    build-essential curl git gh && \
    rm -rf /var/lib/apt/lists/*

# Install Claude Code CLI (required by Claude Agent SDK)
# Pin to specific version to match session schema types
RUN npm install -g @anthropic-ai/claude-code@2.1.1

# Install Claude Agent SDK and TypeScript tooling
RUN npm install -g @anthropic-ai/claude-agent-sdk typescript tsx

# Verify installations
RUN node --version && npm --version && claude --version && tsc --version

# Create /app directory and copy agent code
RUN mkdir -p /app
COPY src/agent.ts /app/agent.mts
RUN chmod 644 /app/agent.mts

# Create symlink to global node_modules so agent can import packages
RUN ln -s /usr/local/lib/node_modules /app/node_modules

# Create workspace directory
RUN mkdir -p /workspace && chmod 777 /workspace

# Create user home and .claude directories
RUN mkdir -p /home/user/.claude

# Copy Claude Code credentials
COPY .credentials.json /home/user/.claude/.credentials.json
RUN chmod 600 /home/user/.claude/.credentials.json

# Copy .claude config (CLAUDE.md, skills, etc.)
COPY .claude/ /home/user/.claude/

# Set ownership
RUN chown -R node:node /workspace /home/user/.claude /app

# Configure git
RUN git config --system init.defaultBranch main && \
    git config --system --add safe.directory '*'

# Set environment
ENV HOME=/home/user
ENV NODE_ENV=production

WORKDIR /home/user
USER node
