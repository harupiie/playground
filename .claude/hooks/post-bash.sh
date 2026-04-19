#!/bin/bash
# Claude Code PostToolUse(Bash) フック
# AGENTS.md のルールをインフラ層で強制する：
#   - pnpm install/add/remove 後に pnpm audit を実行し、結果を Claude に見せる

input=$(cat)
cmd=$(echo "$input" | python3 -c "
import sys, json
d = json.load(sys.stdin)
ti = d.get('tool_input') or d.get('input') or d
print(ti.get('command', ''))
" 2>/dev/null || echo "")

# pnpm install / add / remove → pnpm audit
# 脆弱性が見つかっても exit 0 にし、Claude に判断させる（AGENTS.md 参照）
if echo "$cmd" | grep -qE '\bpnpm\s+(install|add|remove)\b'; then
  echo "[Hook] pnpm audit を実行します..." >&2
  pnpm --prefix "$(git rev-parse --show-toplevel)" audit || true
fi

exit 0
