#!/usr/bin/env bash
# 把当前代码仓 dist/ 与 manifest.json / styles.css 通过 symlink 安装到
# HIC vault 的 .obsidian/plugins/obsidian-plu-pro/。
# 用法:./scripts/install-dev.sh [vault-path]
# 默认 vault-path = /Users/danwei/Documents/HIC
set -euo pipefail

VAULT_PATH="${1:-/Users/danwei/Documents/HIC}"
PLUGIN_DIR="$VAULT_PATH/.obsidian/plugins/obsidian-plu-pro"
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ ! -d "$VAULT_PATH" ]]; then
  echo "Vault 路径不存在:$VAULT_PATH" >&2
  exit 1
fi

if [[ ! -f "$REPO_DIR/dist/main.js" ]]; then
  echo "dist/main.js 不存在,请先执行 'npm run build'" >&2
  exit 1
fi

mkdir -p "$PLUGIN_DIR"

for f in main.js manifest.json styles.css; do
  target="$PLUGIN_DIR/$f"
  if [[ -e "$target" && ! -L "$target" ]]; then
    echo "警告:$target 是真实文件,将被 symlink 替换" >&2
  fi
done

ln -sf "$REPO_DIR/dist/main.js" "$PLUGIN_DIR/main.js"
ln -sf "$REPO_DIR/manifest.json" "$PLUGIN_DIR/manifest.json"
ln -sf "$REPO_DIR/styles.css" "$PLUGIN_DIR/styles.css"

echo "已部署到:$PLUGIN_DIR"
echo "下一步:Obsidian 设置 → 第三方插件 → 启用 'PluPro 项目控制塔'"
