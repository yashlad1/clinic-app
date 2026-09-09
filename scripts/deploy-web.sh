#!/bin/zsh
# Deploy the read-only dashboard.
#
#   ./scripts/deploy-web.sh
#
# Invoked DIRECTLY, never through an npm script, and it writes no permanent
# file. Both of those are deliberate: `packageJson:scripts` and `.gitignore`
# are BOTH EAS fingerprint sources, so adding a script alias or a gitignore
# entry rotates the OTA runtimeVersion and cuts every installed phone off from
# updates. That has now happened twice on this project - once for an npm alias,
# once for a `web/config.js` gitignore line - so the credentials are generated
# into place, deployed, and removed again, leaving the fingerprint untouched.
#
# Values come from the EAS environment variables, so there is one source of
# truth shared with the phone app.
set -e
cd "$(dirname "$0")/.."

# A FUNCTION, not a variable. zsh does not word-split an unquoted variable, so
# `EAS="npx ..."; $EAS env:list` dies with "command not found" - and under
# `set -e`, inside a $( ), it dies silently with exit 127 and no message at all.
# That exact mistake has now been made twice on this project.
eas_cli() { npx --yes eas-cli@23.2.0 "$@"; }

VARS=$(eas_cli env:list --environment production 2>/dev/null) || true

get() { echo "$VARS" | grep "^$1=" | head -1 | cut -d= -f2- ; }
URL=$(get EXPO_PUBLIC_SYNC_URL)
KEY=$(get EXPO_PUBLIC_SYNC_KEY)
EMAIL=$(get EXPO_PUBLIC_SYNC_EMAIL)

if [ -z "$URL" ] || [ -z "$KEY" ]; then
  echo "EXPO_PUBLIC_SYNC_URL / _KEY are not set on EAS. See docs/SETUP-COMMANDS.md." >&2
  exit 1
fi

# No password: the page asks for it and the browser keeps the session.
cat > web/config.js <<EOF
window.CLINIC_CONFIG = {
  url: '$URL',
  key: '$KEY',
  email: '$EMAIL',
};
EOF

# Removed even if the deploy fails, so it can never be committed by accident.
cleanup() { rm -f web/config.js; }
trap cleanup EXIT

echo "Deploying web/ with config for $URL"
eas_cli deploy --export-dir web --prod --non-interactive --dev-domain clinic-stock
