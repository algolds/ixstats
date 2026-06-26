#!/usr/bin/env bash
# Link Claude Code's per-project auto-memory to the git-tracked copy in this repo,
# so memory travels across machines via git: `git pull` receives, a commit pushes.
#
# Run ONCE per machine after cloning (the symlink target differs by clone path,
# which this derives from the repo location, so it works on the server and laptop alike).
set -euo pipefail

repo="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
slug="$(printf '%s' "$repo" | sed 's#/#-#g')"   # Claude Code's project slug = abs path with / -> -
home_mem="$HOME/.claude/projects/$slug/memory"
repo_mem="$repo/.claude/memory"

mkdir -p "$repo_mem" "$(dirname "$home_mem")"

# Preserve any real memory already at the home path before replacing it with the link.
if [ -e "$home_mem" ] && [ ! -L "$home_mem" ]; then
  mv "$home_mem" "$home_mem.bak.$(date +%s)"
  echo "Backed up existing memory -> ${home_mem}.bak.*"
fi

ln -sfn "$repo_mem" "$home_mem"
echo "Linked $home_mem -> $repo_mem"
