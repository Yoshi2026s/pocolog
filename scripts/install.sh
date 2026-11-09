#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."

command -v node >/dev/null || { echo 'Node.js 24 をインストールしてください。' >&2; exit 1; }
node -e 'if (Number(process.versions.node.split(".")[0]) !== 24) { console.error("Node.js 24 が必要です。"); process.exit(1); }'
command -v npm >/dev/null || { echo 'Node.js 24 に付属する npm が必要です。' >&2; exit 1; }
npm ci --cache .local-tools/npm-cache --no-audit --no-fund
npm test
npm run build
echo 'セットアップ完了。bash scripts/start.sh で起動できます。'
