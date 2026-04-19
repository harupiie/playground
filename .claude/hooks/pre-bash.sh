#!/bin/bash
# Claude Code PreToolUse(Bash) フック
# AGENTS.md のルールをインフラ層で強制する：
#   - git commit 前に pnpm lint / pnpm test を実行（失敗時はコミットをブロック）
#   - git push 前に git pull --rebase を実行（失敗時はプッシュをブロック）

input=$(cat)
cmd=$(echo "$input" | python3 -c "
import sys, json
d = json.load(sys.stdin)
ti = d.get('tool_input') or d.get('input') or d
print(ti.get('command', ''))
" 2>/dev/null || echo "")

# git commit → pnpm lint → pnpm test
# --no-verify が明示された場合はスキップ（ユーザーが意図的に bypass する場合）
if echo "$cmd" | grep -qE '\bgit\s+commit\b' && ! echo "$cmd" | grep -q '\-\-no-verify'; then
  ROOT="$(git rev-parse --show-toplevel)"
  echo "[Hook] コミット前に pnpm lint を実行します..." >&2
  pnpm --prefix "$ROOT" lint || exit 1
  echo "[Hook] コミット前に pnpm test を実行します..." >&2
  pnpm --prefix "$ROOT" test
  exit $?
fi

# git push → git pull --rebase
# rebase が失敗した場合（コンフリクトなど）はプッシュをブロックする
if echo "$cmd" | grep -qE '\bgit\s+push\b'; then
  echo "[Hook] プッシュ前に git pull --rebase を実行します..." >&2
  git -C "$(git rev-parse --show-toplevel)" pull --rebase
  exit $?
fi

exit 0
