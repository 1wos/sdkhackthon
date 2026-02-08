#!/bin/zsh
# Extracts Claude Code credentials from macOS Keychain
# and writes .credentials.json WITHOUT the refresh token.
#
# Usage: ./sync-credentials.sh
#
# The access token typically lasts ~24 hours.
# After expiry, rebuild the template with fresh credentials.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
OUTPUT="$SCRIPT_DIR/.credentials.json"

echo "Extracting Claude Code credentials from Keychain..."

RAW=$(security find-generic-password -s 'Claude Code-credentials' -w 2>/dev/null) || {
  echo "Error: Could not read 'Claude Code-credentials' from Keychain."
  echo "Make sure you're logged in: claude login"
  exit 1
}

# Strip refresh token and write to .credentials.json
echo "$RAW" | python3 -c "
import json, sys
creds = json.loads(sys.stdin.read())
oauth = creds.get('claudeAiOauth', {})

# Remove refresh token
oauth.pop('refreshToken', None)

# Check expiry
expires_at = oauth.get('expiresAt', 0)
import time
remaining_hours = (expires_at / 1000 - time.time()) / 3600

if remaining_hours <= 0:
    print('ERROR: Access token is already expired!', file=sys.stderr)
    print('Run: claude login', file=sys.stderr)
    sys.exit(1)

creds['claudeAiOauth'] = oauth
print(json.dumps(creds, indent=2))
print(f'Access token expires in {remaining_hours:.1f} hours', file=sys.stderr)
" > "$OUTPUT"

chmod 600 "$OUTPUT"
echo "Written to: $OUTPUT"
echo ""
echo "Next: rebuild template with 'pnpm --filter hackathon-agent run build:template'"
