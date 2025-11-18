#!/usr/bin/env bash
set -euo pipefail

# Kill anything bound to common dev ports
for p in 3000 8080; do
  if lsof -ti :"$p" >/dev/null 2>&1; then
    echo "🔪 Killing processes on port $p"
    lsof -ti :"$p" | xargs kill -9 || true
  fi
done

echo "✅ Ports 3000 and 8080 are free"
