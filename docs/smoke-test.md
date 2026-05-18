# 冒烟测试 checklist(v1)

> 每次发布前手工跑一遍,确认 4 条主流程可用。环境:HIC vault(`/Users/danwei/Documents/HIC`)。

## 前置

- [ ] `npm run build` 成功,无 TS 报错
- [ ] `./scripts/install-dev.sh` 成功,symlink 已创建
- [ ] Obsidian → 设置 → 第三方插件 → 启用 "PluPro 项目控制塔"

## 流程 1:打开控制塔

- [ ] Cmd-P → 输入 "PluPro" → 命令 "打开项目控制塔" 可见
- [ ] 执行后新 Tab 打开,左侧项目列表渲染,右侧提示"选择左侧项目查看详情"
- [ ] 列表底部能看到「📦 未分类(N)」

## 流程 2:选中项目查看详情

- [ ] 点击左侧任意项目 → 右侧渲染元数据(状态/负责人/能力域)
- [ ] Change 列表出现,每个 change 含进度条 + `done/total` 计数
- [ ] 阻塞 chip 渲染正确(已知 change 灰色,孤儿 change 红色)

## 流程 3:归并未分类 change

- [ ] 点击左侧「📦 未分类」→ 右侧列出全部未分类 change
- [ ] 点击某 change 的「归并到项目…」按钮 → 弹出 AssignmentModal
- [ ] 候选区有得分项,点击「归并」后:
  - [ ] Notice 弹「已归并 X → Y」
  - [ ] Modal 关闭
  - [ ] 左侧列表项目计数 +1
  - [ ] 该 change 的 proposal.md frontmatter 出现 `project: <slug>` 字段
- [ ] Undo:打开 proposal.md 手工删除 frontmatter `project:` 后,控制塔列表 250ms 内自动刷新,该 change 回到未分类

## 流程 4:孤儿引用与设置项

- [ ] 在某 proposal.md 写入 `project: not-exist`,保存
- [ ] 控制塔右侧选中未分类 → 该 change 仍可见
- [ ] 检查左侧项目列表 — 「孤儿引用」数应反映(后续可加 badge,v1 仅日志输出)
- [ ] 打开设置 → 修改 "OpenSpec changes 路径" → 控制塔自动重建索引

## 流程 5:用 Claude 分析项目(v1.1 新增)

- [ ] 5.1 在 Obsidian 打开 `_projects/<某个真实项目>.md`
- [ ] 5.2 Cmd-P → 输入 "PluPro: 用 Claude 分析此项目" → 命令可见
- [ ] 5.3 执行命令,看到 Notice "已标记 X 为待分析。在 Claude Code 内运行:/analyze-project X"(8 秒)
- [ ] 5.4 检查该项目 frontmatter:`pending-analysis: true` 已写入,`last-analyzed` 有 ISO timestamp
- [ ] 5.5 控制塔左侧项目卡片,该项目 title 旁出现 🟡 待分析 chip
- [ ] 5.6 在 Claude Code 跑 `/analyze-project <slug>` → Claude 拆解并创建 N 个 change
- [ ] 5.7 检查 `openspec/changes/<新 slug>/proposal.md` frontmatter 含 `project: <slug>`
- [ ] 5.8 检查 `_projects/<slug>.md` frontmatter:
   - `pending-analysis: false`
   - `last-analyzed` 更新到 Claude 完成时刻
   - `generated-changes: [...]` 列出新 change slug
- [ ] 5.9 控制塔 250ms 内自动刷新,徽章切换为 🟢 已拆解(N)
- [ ] 5.10 项目下的 changes 数量从 0 变为 N,挂在该项目下

## 流程 6:HIC/EVS 系统筛选与分组(v1.3 新增)

- [ ] 6.1 打开控制塔,列表头部「项目 / ⟳ 刷新」之下出现 4 个 chip:全部 / HIC / EVS / 未分类
- [ ] 6.2 默认 chip 激活态为「全部」,蓝色背景
- [ ] 6.3 chip 计数:全部 = HIC + EVS + 未分类,各自数值匹配 _projects/ 实际 manifest 数
- [ ] 6.4 「全部」视图下出现 3 个 divider:━━━ 🟢 HIC 系统(N)━━━ 等
- [ ] 6.5 点 HIC chip:只显示 HIC 系统下项目,无 divider,EVS chip 计数不变
- [ ] 6.6 点 EVS chip:只显示 EVS 系统下项目
- [ ] 6.7 点未分类 chip:显示「自动生成标准层叠编码」「自动设置规则」等无 system 字段的项目
- [ ] 6.8 切换 chip 时,右侧已选中项目卡片状态不消失

## 已知 v1 限制(非缺陷)

- 不解析 markdown body 内容
- 不绘制依赖图
- 不支持任务 checkbox 勾选写回
- 不支持移动端
