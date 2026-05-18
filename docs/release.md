# 本机发布流程

## 一次性设置(只做一次)

### 1. GitHub 创建 repo + push

```bash
cd /Users/danwei/Documents/HIC-softwave/obsidian-plu-pro

# GitHub 网页上先创建一个空的 obsidian-plu-pro 仓库,然后:
git remote add origin git@github.com:<你的-github-username>/obsidian-plu-pro.git
git push -u origin main
```

### 2. GitHub Action 自动生效

`.github/workflows/release.yml` 已在仓库里,push 完成后,**每次 push tag 都会自动**:
1. 跑 `npm ci` + `typecheck` + `npx jest --ci` + `npm run build`
2. 把 `dist/main.js` / `manifest.json` / `styles.css` 上传到 GitHub Release 的 Assets

无需额外配置(`secrets.GITHUB_TOKEN` 是 GitHub 自动提供的)。

---

## 每次发布

```bash
# 1. 确认本地干净 + 全部测试过
git status
npx jest

# 2. 改版本号(可选,但推荐)
# 编辑 manifest.json 的 "version" 与 package.json 的 "version" 保持一致
# 例如 0.1.0 → 0.2.0
git add manifest.json package.json
git commit -m "chore(release): bump version to 0.2.0"

# 3. 打 tag(tag 名通常等于版本号)
git tag 0.2.0
git push origin main
git push origin 0.2.0
```

push tag 后:
- GitHub Action 自动跑 (在仓库 Actions 标签页查看进度)
- ~2-3 分钟后,新 release 在仓库 Releases 标签页可见
- Release 含 3 个 assets:`main.js` / `manifest.json` / `styles.css`

---

## 内网机器更新

如果用 BRAT:
- BRAT 设置 → Check for updates → 自动拉新版本

如果手动安装:
- 重新下载 release 的 3 个文件,覆盖 `<vault>/.obsidian/plugins/obsidian-plu-pro/`
- Obsidian → 第三方插件 → "PluPro 项目控制塔" → 关闭再启用

---

## 如果不想用 GitHub Action(纯手动)

不依赖自动化:

```bash
npm run build

# GitHub 网页 → Releases → Draft a new release
# Tag: 0.2.0
# Title: 0.2.0
# 上传 3 个 assets: dist/main.js, manifest.json, styles.css
```

效果与 Action 一致。
