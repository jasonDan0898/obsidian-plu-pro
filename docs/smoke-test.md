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

## 已知 v1 限制(非缺陷)

- 不解析 markdown body 内容
- 不绘制依赖图
- 不支持任务 checkbox 勾选写回
- 不支持移动端
