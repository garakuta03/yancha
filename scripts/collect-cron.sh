#!/usr/bin/env bash
# research collect を cron から日次実行するためのラッパー。
#
# cron には罠が2つあるため、素の `pnpm research collect` を crontab に書いてはいけない:
#   1. research-data のパスは cwd 相対で解決される → 必ずリポジトリに cd する必要がある
#   2. cron の環境には mise / direnv が効かない → node へのパスが通らない
#
# 使い方（crontab -e）:
#   17 0 * * * /home/ope/Projects/MY-PROJECT/yancha/scripts/collect-cron.sh
#
# ⚠️ このホストは UTC で動いている。crontab の時刻も UTC で解釈される。
#    00:17 UTC = 09:17 JST（日本時間の朝）。JST のつもりで書くと9時間ズレる。
#
# 設計上の注意:
#   - cron 化してよいのは collect だけ。discover はしない
#     （クォータ(search.list 100回/日)を食う上、候補の判定は人間が行う原則のため）
#   - collect は search.list を使わないので 100回/日の枠を消費しない。約16ユニット/日（10,000枠）

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"

LOG_DIR="$REPO_DIR/research-data/logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/collect.log"

echo "=== $(date -Iseconds) collect 開始 ===" >>"$LOG_FILE"

# mise 経由で node にパスを通す（node のパスを直書きすると将来のバージョン更新で壊れるため）
# ⚠️ node_modules/.bin/tsx は JS ではなく npm のシェルシムなので、
#    `node node_modules/.bin/tsx` としてはいけない（SyntaxError になる）。シムを直接実行する。
#
# ⚠️ cron の PATH は最小（/usr/bin:/bin 程度）で ~/.local/bin を含まないため、
#    `command -v mise` だけでは mise を見つけられず node: not found で落ちる。
#    絶対パス（$HOME/.local/bin/mise）も候補に入れて解決する。
MISE_BIN="$(command -v mise || true)"
if [ -z "$MISE_BIN" ] && [ -x "$HOME/.local/bin/mise" ]; then
  MISE_BIN="$HOME/.local/bin/mise"
fi

if [ -n "$MISE_BIN" ]; then
  RUNNER=("$MISE_BIN" exec --)
else
  # mise が無い環境向けのフォールバック（node が PATH にある前提）
  RUNNER=()
fi

if "${RUNNER[@]}" ./node_modules/.bin/tsx --env-file-if-exists=.env \
    packages/research/src/cli.ts collect >>"$LOG_FILE" 2>&1; then
  echo "=== $(date -Iseconds) collect 成功 ===" >>"$LOG_FILE"
else
  status=$?
  echo "=== $(date -Iseconds) collect 失敗 (exit=$status) ===" >>"$LOG_FILE"
  exit "$status"
fi
