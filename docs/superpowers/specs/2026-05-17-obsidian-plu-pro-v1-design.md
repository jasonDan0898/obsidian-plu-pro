---
title: obsidian-plu-pro v1 设计
slug: obsidian-plu-pro-v1
status: approved
type: spec
created: 2026-05-17
updated: 2026-05-17
owner: "@danwei"
tags: [obsidian, plugin, project-management, spec]
---

# obsidian-plu-pro v1 设计

> 形态：Obsidian 插件,运行于本地 HIC vault(`/Users/danwei/Documents/HIC/`)。
> 目标:在 vault 内提供「项目控制塔」主视图,把 OpenSpec changes / 任务进度 / 阻塞依赖按「主题项目」维度聚合,补足现有 `.base` 看板「读不到 markdown body」的能力空白。

---

## 1. 范围

### 1.1 v1 in

- 项目控制塔单一主视图(一个 Obsidian `ItemView` 选项卡)。
- 项目 manifest 增删改:仅编辑 frontmatter,不写正文 body。
- OpenSpec change 索引:扫描 `<vault>/openspec/changes/*/{proposal,design,tasks}.md`。
- 任务进度解析:`tasks.md` 的 `- [ ]` / `- [x]` checkbox,按 `## ` 段落分组统计。
- 项目—子文件归并助手:候选推荐 + 一键写回 `project:` 字段到子文件 frontmatter。
- 未分类桶:所有缺 `project:` 字段的 change 自动归类,主视图可见。
- 阻塞依赖:读 frontmatter `related:` 数组,以列表形式呈现(不绘图)。

### 1.2 v1 out(明确推迟到 v2+)

- 甘特图 / 时间轴可视化。
- 依赖关系拓扑图(d3 / cytoscape.js)。
- SQLite 持久化索引。
- 跨 vault / 多 vault 支持。
- OpenSpec CLI 直接调用(保持插件只读旁路)。
- markdown body 内 wikilink / 段落抽取。
- 跨 `02-requirements/` 与 `openspec/changes/` 的统一关联。
- 任务勾选写回 markdown body(Obsidian 自带 checkbox 即可)。

---

## 2. 数据模型

### 2.1 项目 manifest

位置:`<vault>/_projects/<slug>.md`(默认路径,设置可改)。

```markdown
---
type: project
slug: bottleneck-routing
title: 瓶颈区域布线
status: active           # active / paused / done / archived
owner: "@danwei"
created: 2026-05-17
updated: 2026-05-17
scope:                   # 项目认领的 capability(辅助归并打分)
  - hic-rule-center
  - hic-layout-planning
tags: [project, hic]
---

# 瓶颈区域布线

## 愿景
(用户自由编辑,插件不碰 body)

## 里程碑
…
```

**字段约束:**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `type` | string | 是 | 固定 `project`,用于和其他 frontmatter 区分 |
| `slug` | string | 是 | kebab-case,等于文件名(不含 `.md`) |
| `title` | string | 是 | 中文展示名 |
| `status` | enum | 是 | `active` / `paused` / `done` / `archived` |
| `owner` | string | 否 | `@username` 格式 |
| `created` | date | 否 | ISO 日期,缺省取文件 ctime |
| `updated` | date | 否 | ISO 日期,缺省取文件 mtime |
| `scope` | string[] | 否 | 项目认领的 capability slug,用于"未分类归并"候选打分 |
| `tags` | string[] | 否 | Obsidian 标签,至少含 `project` |

### 2.2 子文件 frontmatter 契约

OpenSpec change 的 `proposal.md` / `design.md` / `tasks.md` 需带:

```yaml
project: bottleneck-routing   # 项目 slug,等于 _projects/<slug>.md 的 slug
```

**插件不强制**该字段存在 — 缺失则自动归到「未分类」桶,UI 提供"归并到项目"操作通过 `app.fileManager.processFrontMatter` 安全写回。

### 2.3 任务进度解析

`tasks.md` 解析规则(v1 简单可靠):

- **一级章节**:以 `## ` 开头的标题(如 `## 1. 核心契约接口`)作为分组锚点。
- **任务项**:任意缩进的 `- [ ]` / `- [x]` 都计入,扁平统计(不做父子完成度传播)。
- **进度公式**:`done / total`,同时给出 change 总体 + 按段落分组两套数。
- **不解析**:嵌套 task 父子关系、wikilink、文本描述、HTML 注释里的 task。

### 2.4 内存索引结构

```ts
type ProjectSlug = string;             // kebab-case,等于 _projects/<slug>.md 文件名

type ProjectManifest = {
  slug: ProjectSlug;
  title: string;
  status: 'active' | 'paused' | 'done' | 'archived';
  owner?: string;
  created?: string;                    // ISO date
  updated?: string;                    // ISO date
  scope?: string[];                    // 项目认领的 capability slug
  tags?: string[];
  manifestPath: string;                // _projects/<slug>.md
};

type ChangeFrontmatter = {
  status?: string;                     // draft / approved / executing / archived
  capability?: string;
  owner?: string;
  project?: ProjectSlug;
  related?: string[];                  // 元素为 wikilink 字符串(如 "[[../other-change/proposal]]")
                                       // 或裸 slug,二者都需被解析为 ChangeRef
  [key: string]: unknown;
};

type ChangeRef = {
  targetSlug: string;                  // 目标 change 的 slug
  raw: string;                         // 原始 frontmatter 字符串(wikilink 或 slug)
  resolved: boolean;                   // 是否在索引中找到对应 change
};

type TaskProgress = {
  totalDone: number;
  totalCount: number;
  groups: Array<{ heading: string; done: number; total: number }>;
};

type AggregateProgress = {
  totalDone: number;                   // 项目下所有 change 的 task 总和
  totalCount: number;
  changeCount: number;
  changesDone: number;                 // 100% 完成的 change 数
};

type ChangeEntry = {
  slug: string;                        // openspec/changes/<slug>/
  proposalPath: string;
  frontmatter: ChangeFrontmatter;
  taskProgress: TaskProgress;
  blockers: ChangeRef[];               // 来自 frontmatter related: 解析
};

type ProjectEntry = {
  manifest: ProjectManifest;
  changes: ChangeEntry[];
  progress: AggregateProgress;
};

type OrphanRef = {
  sourcePath: string;                  // 引用方文件路径
  declaredProject: ProjectSlug;        // 引用方 frontmatter 里写的 project slug
};

type ProjectIndex = {
  projects: Map<ProjectSlug, ProjectEntry>;
  unassigned: ChangeEntry[];           // 缺 project: 字段的 change
  orphanRefs: OrphanRef[];             // 指向不存在 manifest 的 project: 引用
};
```

**`related:` 解析规则**:

- `"[[../other-change/proposal]]"` → 提取 `other-change` 作为 `targetSlug`
- `"[[other-change]]"` → `targetSlug = other-change`
- `"other-change"`(裸字符串) → `targetSlug = other-change`
- 解析失败的条目仍保留为 `ChangeRef { resolved: false }`,UI 上以灰色阻塞项展示

---

## 3. 架构

### 3.1 代码仓结构

```
obsidian-plu-pro/
├── manifest.json              # Obsidian 插件元数据
├── package.json
├── tsconfig.json
├── esbuild.config.mjs         # 官方推荐打包工具
├── src/
│   ├── main.ts                # Plugin 入口(命令/视图/setting tab 注册)
│   ├── settings.ts            # PluginSettings 数据 + SettingTab UI
│   ├── core/
│   │   ├── ProjectIndex.ts    # 内存索引,订阅 metadataCache 增量更新
│   │   ├── TasksParser.ts     # tasks.md checkbox 解析(纯函数)
│   │   ├── FrontmatterIO.ts   # processFrontMatter 安全读写封装
│   │   └── ChangeScanner.ts   # 扫描 openspec/changes/ 构建 change 列表
│   ├── view/
│   │   ├── ControlTowerView.ts        # ItemView 主视图入口
│   │   ├── ProjectListPane.ts         # 左侧项目列表 + 完成度进度条
│   │   ├── ProjectDetailPane.ts       # 右侧详情(元数据 + change 卡 + 阻塞)
│   │   └── AssignmentSuggester.ts     # 归并助手(候选+一键写回)
│   └── types.ts               # 与 §2.4 一致:ProjectIndex / ProjectEntry / ChangeEntry
│                              # / ChangeFrontmatter / ChangeRef / TaskProgress
│                              # / AggregateProgress / ProjectManifest / OrphanRef
├── tests/
│   ├── TasksParser.spec.ts
│   ├── FrontmatterIO.spec.ts
│   ├── ProjectIndex.spec.ts
│   └── fixtures/              # 真实 OpenSpec change 脱敏样例
├── docs/
│   └── superpowers/
│       └── specs/
│           └── 2026-05-17-obsidian-plu-pro-v1-design.md   # 本文档
└── .gitignore
```

### 3.2 模块边界

| 模块 | 职责 | 依赖 |
|------|------|------|
| `core/ProjectIndex` | 维护内存索引,订阅 `app.metadataCache` 增量更新 | Obsidian `App`、ChangeScanner、TasksParser |
| `core/ChangeScanner` | 扫描 `openspec/changes/*/proposal.md`,提取 frontmatter | Obsidian `Vault` API |
| `core/TasksParser` | 纯函数:`input=tasksMdText` → `output=TaskProgress` | 无(string-in / object-out) |
| `core/FrontmatterIO` | 用 `app.fileManager.processFrontMatter` 安全读写 | Obsidian `App` |
| `view/ControlTowerView` | ItemView 容器,组装左右两栏 | Obsidian `View` API、ProjectIndex |
| `view/ProjectListPane` | 项目列表 + 完成度进度条 | ProjectIndex |
| `view/ProjectDetailPane` | 选中项目的详情(元数据 + change 卡 + 阻塞列表) | ProjectIndex |
| `view/AssignmentSuggester` | 未分类列表 + 候选项目推荐 + 一键归并 | FrontmatterIO、ProjectIndex |

### 3.3 设计原则

- **只读 markdown body,只写 frontmatter** — 守住插件责任边界,不变成编辑器。
- **项目实体显化为 vault 内 markdown 文件** — 插件被卸载后所有数据仍可用,可被 wikilink、Bases、git diff 消费。
- **v1 不引入框架** — 用原生 DOM + Obsidian `ItemView`;复杂局部状态再考虑 Svelte。
- **纯函数核心 + 副作用边缘** — `TasksParser` 等核心逻辑无 Obsidian 依赖,可单测;副作用集中在 `FrontmatterIO` / `ChangeScanner`。

---

## 4. 核心流程

### 4.1 启动

1. `Plugin.onload()`:注册命令 / 视图 / `SettingTab`。
2. 等待 `app.workspace.onLayoutReady`。
3. `ChangeScanner.scanAll()` 扫描所有 `openspec/changes/<slug>/proposal.md`,提取 frontmatter。
4. 对每个 change,读取同目录 `tasks.md` 跑 `TasksParser`。
5. 扫描 `_projects/<slug>.md`,构建 `ProjectManifest[]`。
6. `ProjectIndex.build()`:按 `project:` 字段把 change 挂到 project,缺字段的进未分类桶。
7. 注册 `metadataCache.on('changed', ...)` 增量更新文件归属与进度。

### 4.2 用户打开控制塔

1. Command Palette `Plu-Pro: Open Control Tower` → 打开 `ItemView`。
2. 左侧 `ProjectListPane` 渲染项目列表 + 每个项目的完成度。
3. 用户点击项目 → 右侧 `ProjectDetailPane` 渲染元数据 + change 列表。
4. 每个 change 卡片显示:title、status、owner、进度条、阻塞列表。

### 4.3 归并未分类

1. 项目列表底部固定一项「📦 未分类(N)」。
2. 点击后列出所有未带 `project:` 的 change。
3. 选中一个 change 后,`AssignmentSuggester` 基于 capability / wikilink / 路径给出 2-3 个候选项目(带匹配分数)。
4. 用户点击候选 → 调用 `FrontmatterIO.set(file, 'project', slug)`,索引立即重算。

### 4.4 候选打分(v1 简单规则)

`AssignmentSuggester` 候选分 = sum of:

| 信号 | 权重 |
|------|------|
| change 的 `capability` 在某项目的 `scope` 中 | +5 |
| change 的 `related:` 数组里有其他 change 已挂到某项目 | +3 |
| change 目录名包含项目 slug 的关键 token | +1 |

只展示得分 ≥ 1 的候选,最多 3 个,按分数降序。

---

## 5. 错误处理与边界

| 场景 | 行为 |
|------|------|
| `_projects/` 目录不存在 | 启动时自动创建一次 |
| `openspec/changes/` 路径设置错误 | 设置面板红字提示,主视图显示「未找到 changes 目录」占位 |
| `tasks.md` 无 `## ` 章节 | 整文件作为单一组,progress=未知 |
| frontmatter 解析失败 | 跳过该文件,调试日志输出,不阻塞其余索引 |
| `project: <slug>` 指向不存在的 manifest | 列出「孤儿引用」清单,提供「创建该项目 manifest」快捷操作 |
| 写回 frontmatter 失败(文件被其他插件锁定) | 弹 Notice 提示,内存索引不变 |
| 同一 slug 出现两个 manifest 文件 | 保留先扫描到的,次个标红+提示重命名 |

---

## 6. 测试策略

- **纯函数单测**(Jest):`TasksParser`、`FrontmatterIO`、`ProjectIndex` 的归并/重算逻辑 — v1 bug 风险最高的核心,优先覆盖。
- **视图层不做 e2e**:Obsidian 插件 e2e 工具链不成熟,性价比低;手工冒烟覆盖 4 条主流程:
    1. 打开控制塔
    2. 选中项目查看详情
    3. 归并未分类 change
    4. 删除项目 manifest 后主视图自适应
- **样例数据**:在 `tests/fixtures/` 放 3–5 个真实 OpenSpec change 的脱敏副本(取自当前 HIC vault 的 active changes)。

---

## 7. 构建与部署

- **构建工具**:esbuild(Obsidian 官方 sample 同款,零配置,编译极快)。
- **TypeScript**:strict mode 全开。
- **dev 环境**:vault 的 `.obsidian/plugins/obsidian-plu-pro/` 建 symlink 指向代码仓 `dist/`,`npm run dev` 即时热重载。
- **manifest.json**:
    - `id: obsidian-plu-pro`
    - `name: PluPro 项目控制塔`
    - `minAppVersion: 1.4.0`(v1 不依赖 Bases,1.4.0 足够;后续若集成 Bases 视图再提)
    - `isDesktopOnly: true`(v1 不考虑移动端)

---

## 8. 后续 v2+ 路线(非约束,仅记录方向)

- **v2** 依赖关系拓扑图(d3 或 cytoscape.js)。
- **v2** 甘特图,按 frontmatter `created` / `due` 渲染。
- **v2** 跨 `02-requirements/` 与 `openspec/changes/` 的统一关联视图。
- **v2** SQLite / IndexedDB 持久化索引(>5000 文件场景下取代内存索引)。
- **v3** 任务勾选写回 markdown body(取代 Obsidian 自带 checkbox UX)。
- **v3** 集成 `.base` 看板的双向跳转(从 base 行点击直接进入控制塔对应项目)。

---

## 9. 已确认的关键决策记录

| 决策点 | 选择 | 理由 |
|--------|------|------|
| 形态 | Obsidian 插件,非独立 Web app | 长期工作入口在 Obsidian,贴近 Markdown / frontmatter / wikilink |
| 范围 | HIC vault 优先 | 不做通用插件,先解决自己一个 vault 的问题 |
| 项目语义 | 主题项目(跨多个 capability / change) | 与 OpenSpec capability 是不同维度 |
| 项目建模 | γ 独立 manifest 文件(`_projects/<slug>.md`) | 项目作为 vault 一等公民,可独立 git diff / wikilink / Bases 查询 |
| 任务来源 | `openspec/changes/*/tasks.md` 的 checkbox | 现有 `.base` 看板读不到 body,这是核心价值缺口 |
| 存储 | 内存索引 + `metadataCache` 订阅 | v1 不上 SQLite |
| 写入 | 仅 frontmatter,经 `processFrontMatter` 安全 API | 不碰正文 body |
| 视图技术 | 原生 Obsidian `ItemView` + DOM | v1 不引入 React / Svelte / Vue |
| 构建工具 | esbuild | 官方 sample 同款,零坑 |
