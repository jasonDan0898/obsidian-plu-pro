# 内网机器安装指南

本机 push GitHub 后,内网机器从 GitHub 拉。两种方案任选其一,**推荐 BRAT**。

## 方案 A:BRAT(推荐 — 支持自动更新检查)

### 一次性安装

1. Obsidian → 设置 → 第三方插件 → 浏览社区插件
2. 搜索 `BRAT`(全称 Obsidian42 - BRAT)
3. 安装 + 启用 BRAT 插件
4. 进入 BRAT 设置 → "Add Beta plugin"
5. 输入此仓库地址(例如 `your-github-username/obsidian-plu-pro`)
6. BRAT 自动下载 main.js / manifest.json / styles.css 到
   `<vault>/.obsidian/plugins/obsidian-plu-pro/`
7. 第三方插件设置中启用 `PluPro 项目控制塔`

### 后续更新

BRAT 设置 → "Check for updates to beta plugins" → 拉最新 release。
不用自己下载/复制文件。

---

## 方案 B:手动下载(无需 BRAT)

### 一次性安装

1. 访问 GitHub 仓库的 Releases 页面
2. 找到最新版本 release,下载 3 个 assets:
   - `main.js`
   - `manifest.json`
   - `styles.css`
3. 在内网机器的 vault 下创建目录:
   ```
   <vault>/.obsidian/plugins/obsidian-plu-pro/
   ```
4. 把 3 个文件放进去
5. Obsidian 重启 → 设置 → 第三方插件 → 启用 `PluPro 项目控制塔`

### 后续更新

重新下载 3 个文件覆盖,重启插件即可。

---

## 方案 C:git clone + 本地 build(需要 Node.js)

如果内网机器**也要做开发**(改代码 / 调试):

```bash
git clone https://github.com/your-github-username/obsidian-plu-pro.git
cd obsidian-plu-pro
npm install
npm run build

# 然后用本仓库自带的 install-dev.sh 部署
./scripts/install-dev.sh "<vault-path>"
```

**前提**:内网机器能访问 npm registry(可能需要内网 npm mirror,如
`npm config set registry https://registry.npmmirror.com`)。

---

## 启用后第一次使用

1. 命令面板 Cmd-P → 输入 `PluPro` → 打开项目控制塔
2. 或点左侧 ribbon 📋 图标
3. 控制塔会自动扫描 `<vault>/_projects/*.md` 与 `<vault>/openspec/changes/*/proposal.md`
4. 详细操作参考 vault 内 `docs/smoke-test.md`(如有)

如果是新 vault 没有 OpenSpec changes:控制塔会显示"未分类(0)" — 正常。
