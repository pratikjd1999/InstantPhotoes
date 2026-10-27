#!/usr/bin/env bash
# Builds a clean copy of the whole project for drag-and-drop upload on the GitHub web UI.
# Output goes OUTSIDE the project (../InstantPhotoes-upload) so it never nests inside itself.
# Respects .gitignore (node_modules, .env, build output, ...) plus the extra excludes below.
set -euo pipefail

cd "$(dirname "$0")/.."
OUT="../InstantPhotoes-upload"

rm -rf "$OUT"
mkdir -p "$OUT"

# tracked + untracked files that are not git-ignored
git ls-files -co --exclude-standard -z \
  | grep -zvE '(^|/)(node_modules|\.git|\.next|\.turbo|dist|build|coverage|\.venv|__pycache__)(/|$)|(^|/)\.DS_Store$|(^|/)\.env(\..*)?$|\.pem$|\.key$' \
  | xargs -0 -I{} rsync -R "{}" "$OUT/"

COUNT=$(find "$OUT" -type f | wc -l | tr -d ' ')
SIZE=$(du -sh "$OUT" | cut -f1)
echo "Bundle ready: $OUT"
echo "Files: $COUNT   Size: $SIZE"
if [ "$COUNT" -gt 100 ]; then
  echo "WARNING: GitHub's web upload accepts at most ~100 files at a time. Upload in several batches."
fi
