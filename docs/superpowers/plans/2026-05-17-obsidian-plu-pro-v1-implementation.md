# obsidian-plu-pro v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 Obsidian 插件「PluPro 项目控制塔」v1,在 HIC vault 内提供按"主题项目"维度聚合 OpenSpec changes / 任务进度 / 阻塞依赖的主视图,补足 `.base` 看板读不到 markdown body 的能力空白。

**Architecture:** Obsidian 插件(TypeScript + esbuild),代码分纯函数核心层(`core/`) + 视图层(`view/`)。核心层无 Obsidian 依赖、用 Jest 单测;视图层依赖 Obsidian `ItemView` / `App` API,用人工冒烟覆盖。项目实体显化为 `_projects/<slug>.md` manifest 文件,子文件通过 `project:` frontmatter 反向关联,内存索引订阅 `app.metadataCache` 增量更新。

**Tech Stack:** TypeScript 5.x (strict mode) / esbuild / Obsidian 1.4.0+ API / Jest 29.x / `gray-matter`(frontmatter 解析 fallback)

**Spec:** [docs/superpowers/specs/2026-05-17-obsidian-plu-pro-v1-design.md](../specs/2026-05-17-obsidian-plu-pro-v1-design.md)

---

## Stage 0: 脚手架

### Task 1: 仓库初始化 + 插件 manifest

**Files:**
- Create: `manifest.json`
- Create: `package.json`
- Create: `.gitignore`
- Create: `README.md`

- [ ] **Step 1: 初始化 git 仓库**

Run:
```bash
cd /Users/danwei/Documents/HIC-softwave/obsidian-plu-pro
git init -b main
```
Expected: `Initialized empty Git repository in .../obsidian-plu-pro/.git/`

- [ ] **Step 2: 创建 `manifest.json`**(Obsidian 插件元数据)

```json
{
  "id": "obsidian-plu-pro",
  "name": "PluPro 项目控制塔",
  "version": "0.1.0",
  "minAppVersion": "1.4.0",
  "description": "按主题项目维度聚合 OpenSpec changes / 任务进度 / 阻塞依赖的项目控制塔。",
  "author": "danwei",
  "authorUrl": "",
  "isDesktopOnly": true
}
```

- [ ] **Step 3: 创建 `package.json`**

```json
{
  "name": "obsidian-plu-pro",
  "version": "0.1.0",
  "description": "Obsidian plugin: PluPro 项目控制塔",
  "main": "dist/main.js",
  "scripts": {
    "dev": "node esbuild.config.mjs",
    "build": "node esbuild.config.mjs production",
    "test": "jest",
    "test:watch": "jest --watch",
    "typecheck": "tsc --noEmit"
  },
  "keywords": ["obsidian-plugin", "openspec", "project-management"],
  "author": "danwei",
  "license": "MIT",
  "devDependencies": {
    "@types/jest": "^29.5.12",
    "@types/node": "^20.11.0",
    "builtin-modules": "^3.3.0",
    "esbuild": "^0.20.0",
    "jest": "^29.7.0",
    "obsidian": "latest",
    "ts-jest": "^29.1.2",
    "tslib": "^2.6.2",
    "typescript": "^5.3.0"
  },
  "dependencies": {
    "gray-matter": "^4.0.3"
  }
}
```

- [ ] **Step 4: 创建 `.gitignore`**

```gitignore
node_modules/
dist/
*.log
.DS_Store
.idea/
.vscode/
coverage/
*.tsbuildinfo
```

- [ ] **Step 5: 创建最小 `README.md`**

```markdown
# obsidian-plu-pro

Obsidian 插件 — **PluPro 项目控制塔**,按主题项目维度聚合 OpenSpec changes / 任务进度 / 阻塞依赖。

## 文档

- 设计 spec:`docs/superpowers/specs/2026-05-17-obsidian-plu-pro-v1-design.md`
- 实施计划:`docs/superpowers/plans/2026-05-17-obsidian-plu-pro-v1-implementation.md`
```

- [ ] **Step 6: 安装依赖**

Run: `npm install`
Expected: 无错误,`node_modules/` 与 `package-lock.json` 出现

- [ ] **Step 7: 提交**

```bash
git add manifest.json package.json package-lock.json .gitignore README.md
git commit -m "$(cat <<'EOF'
chore(scaffold): 初始化插件仓库与依赖声明

仓库脚手架第一步 — manifest.json 描述 Obsidian 插件元数据,
package.json 声明 TypeScript / esbuild / Jest 工具链,
.gitignore 排除 node_modules / dist / 系统垃圾文件。
EOF
)"
```

---

### Task 2: TypeScript 与 esbuild 配置

**Files:**
- Create: `tsconfig.json`
- Create: `esbuild.config.mjs`
- Create: `jest.config.js`

- [ ] **Step 1: 创建 `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "node",
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "isolatedModules": true,
    "resolveJsonModule": true,
    "lib": ["DOM", "ES2020"],
    "types": ["jest", "node"],
    "baseUrl": "src"
  },
  "include": ["src/**/*", "tests/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 2: 创建 `esbuild.config.mjs`**

```javascript
import esbuild from 'esbuild';
import process from 'process';
import builtins from 'builtin-modules';

const prod = process.argv[2] === 'production';

const context = await esbuild.context({
  entryPoints: ['src/main.ts'],
  bundle: true,
  external: ['obsidian', 'electron', ...builtins],
  format: 'cjs',
  target: 'es2020',
  logLevel: 'info',
  sourcemap: prod ? false : 'inline',
  treeShaking: true,
  outfile: 'dist/main.js',
  minify: prod,
});

if (prod) {
  await context.rebuild();
  process.exit(0);
} else {
  await context.watch();
}
```

- [ ] **Step 3: 创建 `jest.config.js`**

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  moduleDirectories: ['node_modules', 'src'],
  moduleNameMapper: {
    '^obsidian$': '<rootDir>/tests/mocks/obsidian.ts',
  },
  collectCoverageFrom: ['src/**/*.ts', '!src/main.ts', '!src/view/**'],
};
```

- [ ] **Step 4: 创建 Obsidian mock**(用于 Jest 单测)

File: `tests/mocks/obsidian.ts`

```typescript
// Minimal Obsidian API mock for unit tests.
// Real Obsidian runtime is provided when the plugin is loaded in the app.

export class Plugin {}
export class PluginSettingTab {}
export class ItemView {}
export class Setting {}
export class Notice {
  constructor(_message: string) {}
}
export class TFile {
  path = '';
  basename = '';
  extension = 'md';
  parent: { path: string } | null = null;
}
export class TFolder {
  path = '';
  children: Array<TFile | TFolder> = [];
}
export class App {}
export class Vault {}
export class MetadataCache {}
export class FileManager {
  async processFrontMatter(_file: TFile, _fn: (fm: Record<string, unknown>) => void): Promise<void> {}
}
```

- [ ] **Step 5: 验证 TypeScript 编译**

Run: `npm run typecheck`
Expected: 无输出(无错误)

- [ ] **Step 6: 提交**

```bash
git add tsconfig.json esbuild.config.mjs jest.config.js tests/mocks/obsidian.ts
git commit -m "$(cat <<'EOF'
chore(build): 配置 TypeScript / esbuild / Jest 工具链

esbuild 配置打包入口 src/main.ts,external 排除 obsidian / electron 与
Node 内置模块。Jest 用 ts-jest preset 跑 src/ 单测,obsidian 模块
经 tests/mocks/obsidian.ts 提供最小 mock,让纯函数测试不需要真实
Obsidian 运行时。
EOF
)"
```

---

### Task 3: 核心类型定义

**Files:**
- Create: `src/types.ts`

- [ ] **Step 1: 创建 `src/types.ts`**(对齐 spec §2.4)

```typescript
export type ProjectSlug = string;

export type ProjectStatus = 'active' | 'paused' | 'done' | 'archived';

export interface ProjectManifest {
  slug: ProjectSlug;
  title: string;
  status: ProjectStatus;
  owner?: string;
  created?: string;
  updated?: string;
  scope?: string[];
  tags?: string[];
  manifestPath: string;
}

export interface ChangeFrontmatter {
  status?: string;
  capability?: string;
  owner?: string;
  project?: ProjectSlug;
  related?: string[];
  [key: string]: unknown;
}

export interface ChangeRef {
  targetSlug: string;
  raw: string;
  resolved: boolean;
}

export interface TaskGroupProgress {
  heading: string;
  done: number;
  total: number;
}

export interface TaskProgress {
  totalDone: number;
  totalCount: number;
  groups: TaskGroupProgress[];
}

export interface AggregateProgress {
  totalDone: number;
  totalCount: number;
  changeCount: number;
  changesDone: number;
}

export interface ChangeEntry {
  slug: string;
  proposalPath: string;
  frontmatter: ChangeFrontmatter;
  taskProgress: TaskProgress;
  blockers: ChangeRef[];
}

export interface ProjectEntry {
  manifest: ProjectManifest;
  changes: ChangeEntry[];
  progress: AggregateProgress;
}

export interface OrphanRef {
  sourcePath: string;
  declaredProject: ProjectSlug;
}

export interface ProjectIndexSnapshot {
  projects: Map<ProjectSlug, ProjectEntry>;
  unassigned: ChangeEntry[];
  orphanRefs: OrphanRef[];
}

export interface AssignmentCandidate {
  projectSlug: ProjectSlug;
  score: number;
  reasons: string[];
}

export interface PluginSettings {
  changesPath: string;
  projectsPath: string;
  enableCapabilityFallback: boolean;
}

export const DEFAULT_SETTINGS: PluginSettings = {
  changesPath: 'openspec/changes',
  projectsPath: '_projects',
  enableCapabilityFallback: true,
};
```

- [ ] **Step 2: 验证编译**

Run: `npm run typecheck`
Expected: 无错误

- [ ] **Step 3: 提交**

```bash
git add src/types.ts
git commit -m "$(cat <<'EOF'
feat(types): 定义 v1 核心类型契约

对齐 spec §2.4 — ProjectManifest / ChangeFrontmatter / ChangeRef /
TaskProgress / AggregateProgress / ChangeEntry / ProjectEntry /
OrphanRef / ProjectIndexSnapshot / AssignmentCandidate / PluginSettings。
EOF
)"
```

---

## Stage 1: 核心解析(纯函数 TDD)

### Task 4: TasksParser — 段落识别

**Files:**
- Create: `tests/TasksParser.spec.ts`
- Create: `src/core/TasksParser.ts`

- [ ] **Step 1: 写失败测试 — 段落识别**

File: `tests/TasksParser.spec.ts`

```typescript
import { parseTasks } from '../src/core/TasksParser';

describe('TasksParser - 段落识别', () => {
  it('按 ## 标题切分章节', () => {
    const input = `## 1. 核心契约接口

- [ ] 1.1 创建接口
- [x] 1.2 写实现

## 2. 数据库迁移

- [ ] 2.1 写 Flyway 脚本
`;
    const result = parseTasks(input);
    expect(result.groups).toHaveLength(2);
    expect(result.groups[0].heading).toBe('1. 核心契约接口');
    expect(result.groups[1].heading).toBe('2. 数据库迁移');
  });

  it('忽略 ### 三级标题,不作为分组锚点', () => {
    const input = `## 1. 章节一

### 1.1 子章节
- [ ] 任务 A
`;
    const result = parseTasks(input);
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].heading).toBe('1. 章节一');
  });

  it('无 ## 章节时返回单一默认组', () => {
    const input = `- [ ] 孤立任务 A
- [x] 孤立任务 B
`;
    const result = parseTasks(input);
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].heading).toBe('(未分组)');
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

Run: `npx jest TasksParser`
Expected: FAIL — `Cannot find module '../src/core/TasksParser'`

- [ ] **Step 3: 写最小实现**

File: `src/core/TasksParser.ts`

```typescript
import type { TaskProgress, TaskGroupProgress } from '../types';

const SECTION_HEADER = /^##\s+(.+?)\s*$/;
const TASK_DONE = /^\s*-\s*\[x\]\s/i;
const TASK_TODO = /^\s*-\s*\[ \]\s/;

export function parseTasks(text: string): TaskProgress {
  const lines = text.split(/\r?\n/);
  const groups: TaskGroupProgress[] = [];
  let current: TaskGroupProgress = { heading: '(未分组)', done: 0, total: 0 };
  let seenAny = false;

  for (const line of lines) {
    const headerMatch = line.match(SECTION_HEADER);
    if (headerMatch) {
      if (seenAny || current.total > 0) {
        groups.push(current);
      }
      current = { heading: headerMatch[1], done: 0, total: 0 };
      seenAny = true;
      continue;
    }

    if (TASK_DONE.test(line)) {
      current.done += 1;
      current.total += 1;
    } else if (TASK_TODO.test(line)) {
      current.total += 1;
    }
  }

  if (seenAny || current.total > 0) {
    groups.push(current);
  }

  if (groups.length === 0) {
    groups.push({ heading: '(未分组)', done: 0, total: 0 });
  }

  const totalDone = groups.reduce((sum, g) => sum + g.done, 0);
  const totalCount = groups.reduce((sum, g) => sum + g.total, 0);

  return { totalDone, totalCount, groups };
}
```

- [ ] **Step 4: 运行测试验证通过**

Run: `npx jest TasksParser`
Expected: PASS(3 tests)

- [ ] **Step 5: 提交**

```bash
git add tests/TasksParser.spec.ts src/core/TasksParser.ts
git commit -m "$(cat <<'EOF'
feat(parser): 实现 tasks.md 段落识别

按 ## 二级标题切分章节,### 三级标题不作为分组锚点。无 ## 章节
的整文件归入单一「(未分组)」组,保证 progress.groups 始终非空。
EOF
)"
```

---

### Task 5: TasksParser — checkbox 计数与边界

**Files:**
- Modify: `tests/TasksParser.spec.ts`
- Modify: `src/core/TasksParser.ts:1-50`

- [ ] **Step 1: 追加边界测试**

Append to `tests/TasksParser.spec.ts`:

```typescript
describe('TasksParser - checkbox 计数', () => {
  it('扁平统计任意缩进的任务项', () => {
    const input = `## 段一

- [ ] 顶级 1
  - [ ] 缩进 1
    - [x] 深缩进 1
- [x] 顶级 2
`;
    const result = parseTasks(input);
    expect(result.totalCount).toBe(4);
    expect(result.totalDone).toBe(2);
  });

  it('区分大小写 X / x 都识别为完成', () => {
    const input = `## 段一

- [X] 大写 X
- [x] 小写 x
- [ ] 待办
`;
    const result = parseTasks(input);
    expect(result.totalDone).toBe(2);
    expect(result.totalCount).toBe(3);
  });

  it('空文件返回零进度单组', () => {
    const result = parseTasks('');
    expect(result.totalCount).toBe(0);
    expect(result.totalDone).toBe(0);
    expect(result.groups).toHaveLength(1);
  });

  it('totalDone 与 totalCount 等于各组之和', () => {
    const input = `## 段一

- [x] 任务
- [ ] 任务

## 段二

- [x] 任务
- [x] 任务
- [ ] 任务
`;
    const result = parseTasks(input);
    expect(result.totalDone).toBe(3);
    expect(result.totalCount).toBe(5);
    expect(result.groups[0]).toEqual({ heading: '段一', done: 1, total: 2 });
    expect(result.groups[1]).toEqual({ heading: '段二', done: 2, total: 3 });
  });

  it('忽略 HTML 注释里的 task 标记', () => {
    const input = `## 段一

<!-- - [x] 注释里的任务不计 -->
- [ ] 真任务
`;
    const result = parseTasks(input);
    expect(result.totalCount).toBe(1);
    expect(result.totalDone).toBe(0);
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

Run: `npx jest TasksParser`
Expected: FAIL — "忽略 HTML 注释" 一项(其他应通过)

- [ ] **Step 3: 修改实现 — 忽略 HTML 注释块**

Replace `src/core/TasksParser.ts` 内容:

```typescript
import type { TaskProgress, TaskGroupProgress } from '../types';

const SECTION_HEADER = /^##\s+(.+?)\s*$/;
const TASK_DONE = /^\s*-\s*\[x\]\s/i;
const TASK_TODO = /^\s*-\s*\[ \]\s/;
const COMMENT_OPEN = /<!--/;
const COMMENT_CLOSE = /-->/;

export function parseTasks(text: string): TaskProgress {
  const lines = text.split(/\r?\n/);
  const groups: TaskGroupProgress[] = [];
  let current: TaskGroupProgress = { heading: '(未分组)', done: 0, total: 0 };
  let seenAny = false;
  let inComment = false;

  for (const line of lines) {
    if (inComment) {
      if (COMMENT_CLOSE.test(line)) {
        inComment = false;
      }
      continue;
    }
    if (COMMENT_OPEN.test(line) && !COMMENT_CLOSE.test(line)) {
      inComment = true;
      continue;
    }
    if (COMMENT_OPEN.test(line) && COMMENT_CLOSE.test(line)) {
      continue;
    }

    const headerMatch = line.match(SECTION_HEADER);
    if (headerMatch) {
      if (seenAny || current.total > 0) {
        groups.push(current);
      }
      current = { heading: headerMatch[1], done: 0, total: 0 };
      seenAny = true;
      continue;
    }

    if (TASK_DONE.test(line)) {
      current.done += 1;
      current.total += 1;
    } else if (TASK_TODO.test(line)) {
      current.total += 1;
    }
  }

  if (seenAny || current.total > 0) {
    groups.push(current);
  }

  if (groups.length === 0) {
    groups.push({ heading: '(未分组)', done: 0, total: 0 });
  }

  const totalDone = groups.reduce((sum, g) => sum + g.done, 0);
  const totalCount = groups.reduce((sum, g) => sum + g.total, 0);

  return { totalDone, totalCount, groups };
}
```

- [ ] **Step 4: 运行测试验证全部通过**

Run: `npx jest TasksParser`
Expected: PASS(8 tests)

- [ ] **Step 5: 提交**

```bash
git add tests/TasksParser.spec.ts src/core/TasksParser.ts
git commit -m "$(cat <<'EOF'
feat(parser): 完善 checkbox 计数与边界处理

扁平统计任意缩进的 - [ ] / - [x](大小写不敏感);忽略 HTML 注释
块内的伪 task 标记;空文件返回零进度单组保持调用方简单。
EOF
)"
```

---

### Task 6: ChangeRef 解析器(`related:` 字段)

**Files:**
- Create: `tests/ChangeRefParser.spec.ts`
- Create: `src/core/ChangeRefParser.ts`

- [ ] **Step 1: 写失败测试**

File: `tests/ChangeRefParser.spec.ts`

```typescript
import { parseChangeRefs } from '../src/core/ChangeRefParser';

describe('ChangeRefParser', () => {
  const knownSlugs = new Set(['establish-hic-kernel-audit', 'add-health-check-endpoint']);

  it('解析相对路径 wikilink', () => {
    const refs = parseChangeRefs(
      ['"[[../establish-hic-kernel-audit/proposal]]"'],
      knownSlugs,
    );
    expect(refs).toHaveLength(1);
    expect(refs[0]).toEqual({
      targetSlug: 'establish-hic-kernel-audit',
      raw: '"[[../establish-hic-kernel-audit/proposal]]"',
      resolved: true,
    });
  });

  it('解析裸 wikilink', () => {
    const refs = parseChangeRefs(['[[add-health-check-endpoint]]'], knownSlugs);
    expect(refs[0].targetSlug).toBe('add-health-check-endpoint');
    expect(refs[0].resolved).toBe(true);
  });

  it('解析裸 slug 字符串', () => {
    const refs = parseChangeRefs(['add-health-check-endpoint'], knownSlugs);
    expect(refs[0].targetSlug).toBe('add-health-check-endpoint');
    expect(refs[0].resolved).toBe(true);
  });

  it('未知 slug 标记为 resolved=false 但保留', () => {
    const refs = parseChangeRefs(['[[some-unknown-change]]'], knownSlugs);
    expect(refs[0].targetSlug).toBe('some-unknown-change');
    expect(refs[0].resolved).toBe(false);
  });

  it('忽略指向非 change 类文件的 wikilink', () => {
    const refs = parseChangeRefs(
      ['[[../../06-standards/HIC/总纲]]', '[[design]]', '[[tasks]]'],
      knownSlugs,
    );
    expect(refs).toHaveLength(0);
  });

  it('去重相同 targetSlug', () => {
    const refs = parseChangeRefs(
      [
        '[[../establish-hic-kernel-audit/proposal]]',
        'establish-hic-kernel-audit',
      ],
      knownSlugs,
    );
    expect(refs).toHaveLength(1);
  });

  it('空数组或 undefined 返回空数组', () => {
    expect(parseChangeRefs([], knownSlugs)).toEqual([]);
    expect(parseChangeRefs(undefined, knownSlugs)).toEqual([]);
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

Run: `npx jest ChangeRefParser`
Expected: FAIL — `Cannot find module '../src/core/ChangeRefParser'`

- [ ] **Step 3: 写实现**

File: `src/core/ChangeRefParser.ts`

```typescript
import type { ChangeRef } from '../types';

const WIKILINK = /\[\[([^\]]+)\]\]/;
const NON_CHANGE_DOC = new Set(['proposal', 'design', 'tasks', 'spec', 'README']);

function extractSlug(raw: string): string | null {
  const trimmed = raw.trim().replace(/^"|"$/g, '');
  const wikilinkMatch = trimmed.match(WIKILINK);
  const inner = wikilinkMatch ? wikilinkMatch[1] : trimmed;
  const segments = inner.split('/').filter((s) => s && s !== '..' && s !== '.');
  if (segments.length === 0) {
    return null;
  }
  const last = segments[segments.length - 1];

  if (NON_CHANGE_DOC.has(last) && segments.length >= 2) {
    return segments[segments.length - 2];
  }
  if (NON_CHANGE_DOC.has(last)) {
    return null;
  }
  if (last.includes('.')) {
    return null;
  }
  return last;
}

export function parseChangeRefs(
  related: string[] | undefined,
  knownSlugs: Set<string>,
): ChangeRef[] {
  if (!related || related.length === 0) {
    return [];
  }
  const seen = new Set<string>();
  const refs: ChangeRef[] = [];
  for (const raw of related) {
    const slug = extractSlug(raw);
    if (!slug) {
      continue;
    }
    if (seen.has(slug)) {
      continue;
    }
    seen.add(slug);
    refs.push({
      targetSlug: slug,
      raw,
      resolved: knownSlugs.has(slug),
    });
  }
  return refs;
}
```

- [ ] **Step 4: 运行测试验证通过**

Run: `npx jest ChangeRefParser`
Expected: PASS(7 tests)

- [ ] **Step 5: 提交**

```bash
git add tests/ChangeRefParser.spec.ts src/core/ChangeRefParser.ts
git commit -m "$(cat <<'EOF'
feat(parser): 实现 frontmatter related 数组解析

支持相对路径 wikilink、裸 wikilink、裸 slug 三种格式,自动识别
指向 proposal / design / tasks 子文件时回退到父目录 slug。指向
非 change 类文件(spec / 总纲等)的 wikilink 被忽略,同一 slug
去重。未知 slug 保留为 resolved=false 用于 UI 灰色显示。
EOF
)"
```

---

## Stage 2: 副作用模块

### Task 7: FrontmatterIO — 读写封装

**Files:**
- Create: `src/core/FrontmatterIO.ts`
- Create: `tests/FrontmatterIO.spec.ts`

- [ ] **Step 1: 写失败测试**

File: `tests/FrontmatterIO.spec.ts`

```typescript
import matter from 'gray-matter';
import { parseFrontmatterFromText, mergeFrontmatterIntoText } from '../src/core/FrontmatterIO';

describe('FrontmatterIO - 纯函数部分', () => {
  it('parseFrontmatterFromText 提取 frontmatter 对象', () => {
    const text = `---
status: draft
project: bottleneck-routing
related:
  - "[[../other/proposal]]"
---
# Body
正文
`;
    const fm = parseFrontmatterFromText(text);
    expect(fm.status).toBe('draft');
    expect(fm.project).toBe('bottleneck-routing');
    expect(fm.related).toEqual(['[[../other/proposal]]']);
  });

  it('parseFrontmatterFromText 处理无 frontmatter', () => {
    const fm = parseFrontmatterFromText('# 仅正文\n');
    expect(fm).toEqual({});
  });

  it('mergeFrontmatterIntoText 写入新字段,保留 body', () => {
    const original = `---
status: draft
---
# Body
内容
`;
    const updated = mergeFrontmatterIntoText(original, { project: 'demo-proj' });
    const parsed = matter(updated);
    expect(parsed.data.status).toBe('draft');
    expect(parsed.data.project).toBe('demo-proj');
    expect(parsed.content.trim()).toBe('# Body\n内容');
  });

  it('mergeFrontmatterIntoText 在无 frontmatter 文件上新建 block', () => {
    const original = '# 仅正文\n内容\n';
    const updated = mergeFrontmatterIntoText(original, { project: 'demo' });
    expect(updated.startsWith('---\n')).toBe(true);
    const parsed = matter(updated);
    expect(parsed.data.project).toBe('demo');
  });

  it('mergeFrontmatterIntoText 覆盖同名字段', () => {
    const original = `---
project: old
---
body
`;
    const updated = mergeFrontmatterIntoText(original, { project: 'new' });
    const parsed = matter(updated);
    expect(parsed.data.project).toBe('new');
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

Run: `npx jest FrontmatterIO`
Expected: FAIL — `Cannot find module '../src/core/FrontmatterIO'`

- [ ] **Step 3: 写实现**

File: `src/core/FrontmatterIO.ts`

```typescript
import matter from 'gray-matter';
import type { App, TFile } from 'obsidian';

export function parseFrontmatterFromText(text: string): Record<string, unknown> {
  try {
    const parsed = matter(text);
    return parsed.data ?? {};
  } catch {
    return {};
  }
}

export function mergeFrontmatterIntoText(
  text: string,
  patch: Record<string, unknown>,
): string {
  const parsed = matter(text);
  const merged = { ...parsed.data, ...patch };
  return matter.stringify(parsed.content, merged);
}

export class FrontmatterIO {
  constructor(private readonly app: App) {}

  async readField<T = unknown>(file: TFile, field: string): Promise<T | undefined> {
    const text = await this.app.vault.read(file);
    const fm = parseFrontmatterFromText(text);
    return fm[field] as T | undefined;
  }

  async setField(file: TFile, field: string, value: unknown): Promise<void> {
    await this.app.fileManager.processFrontMatter(file, (fm) => {
      fm[field] = value;
    });
  }

  async removeField(file: TFile, field: string): Promise<void> {
    await this.app.fileManager.processFrontMatter(file, (fm) => {
      delete fm[field];
    });
  }
}
```

- [ ] **Step 4: 扩展 Obsidian mock 让 Vault 可读**

Modify `tests/mocks/obsidian.ts`,替换 Vault 类:

```typescript
export class Vault {
  async read(_file: TFile): Promise<string> {
    return '';
  }
}
```

- [ ] **Step 5: 运行测试验证通过**

Run: `npx jest FrontmatterIO`
Expected: PASS(5 tests)

- [ ] **Step 6: 提交**

```bash
git add src/core/FrontmatterIO.ts tests/FrontmatterIO.spec.ts tests/mocks/obsidian.ts
git commit -m "$(cat <<'EOF'
feat(io): 封装 frontmatter 读写

纯函数 parseFrontmatterFromText / mergeFrontmatterIntoText 用 gray-matter
解析,可单测。FrontmatterIO 类包装 Obsidian app.fileManager.processFrontMatter
安全 API,避免直接覆盖文件导致 body 丢失。
EOF
)"
```

---

### Task 8: ChangeScanner — 扫描与提取

**Files:**
- Create: `src/core/ChangeScanner.ts`
- Create: `tests/ChangeScanner.spec.ts`
- Create: `tests/fixtures/sample-change/proposal.md`
- Create: `tests/fixtures/sample-change/tasks.md`

- [ ] **Step 1: 创建样例数据**

File: `tests/fixtures/sample-change/proposal.md`

```markdown
---
status: draft
capability: hic-kernel-audit
owner: "@danwei"
project: bottleneck-routing
related:
  - "[[../other-change/proposal]]"
  - "[[../another-change]]"
---
# Proposal

正文内容(测试中不消费)
```

File: `tests/fixtures/sample-change/tasks.md`

```markdown
## 1. 接口

- [x] 1.1 定义接口
- [ ] 1.2 写实现

## 2. 测试

- [ ] 2.1 单测
- [ ] 2.2 集测
```

- [ ] **Step 2: 写失败测试**

File: `tests/ChangeScanner.spec.ts`

```typescript
import path from 'path';
import fs from 'fs';
import { scanChangeFromDisk } from '../src/core/ChangeScanner';

const FIXTURE_ROOT = path.resolve(__dirname, 'fixtures');

function readFixture(rel: string): string {
  return fs.readFileSync(path.join(FIXTURE_ROOT, rel), 'utf-8');
}

describe('ChangeScanner.scanChangeFromDisk', () => {
  it('提取 frontmatter + 计算 task 进度', () => {
    const proposalText = readFixture('sample-change/proposal.md');
    const tasksText = readFixture('sample-change/tasks.md');

    const entry = scanChangeFromDisk({
      slug: 'sample-change',
      proposalPath: 'openspec/changes/sample-change/proposal.md',
      proposalText,
      tasksText,
    });

    expect(entry.slug).toBe('sample-change');
    expect(entry.frontmatter.status).toBe('draft');
    expect(entry.frontmatter.capability).toBe('hic-kernel-audit');
    expect(entry.frontmatter.project).toBe('bottleneck-routing');
    expect(entry.taskProgress.totalDone).toBe(1);
    expect(entry.taskProgress.totalCount).toBe(4);
    expect(entry.taskProgress.groups).toHaveLength(2);
  });

  it('无 tasks.md 时进度为零', () => {
    const proposalText = readFixture('sample-change/proposal.md');
    const entry = scanChangeFromDisk({
      slug: 'sample-change',
      proposalPath: 'openspec/changes/sample-change/proposal.md',
      proposalText,
      tasksText: undefined,
    });
    expect(entry.taskProgress.totalCount).toBe(0);
    expect(entry.taskProgress.totalDone).toBe(0);
  });

  it('blockers 数组初始为空(解析在 ProjectIndex 内做,需 knownSlugs)', () => {
    const proposalText = readFixture('sample-change/proposal.md');
    const entry = scanChangeFromDisk({
      slug: 'sample-change',
      proposalPath: 'openspec/changes/sample-change/proposal.md',
      proposalText,
      tasksText: undefined,
    });
    expect(entry.blockers).toEqual([]);
  });
});
```

- [ ] **Step 3: 运行测试验证失败**

Run: `npx jest ChangeScanner`
Expected: FAIL — `Cannot find module '../src/core/ChangeScanner'`

- [ ] **Step 4: 写实现**

File: `src/core/ChangeScanner.ts`

```typescript
import type { App, TFile, TFolder } from 'obsidian';
import type { ChangeEntry, ChangeFrontmatter } from '../types';
import { parseFrontmatterFromText } from './FrontmatterIO';
import { parseTasks } from './TasksParser';

export interface ScanInput {
  slug: string;
  proposalPath: string;
  proposalText: string;
  tasksText: string | undefined;
}

export function scanChangeFromDisk(input: ScanInput): ChangeEntry {
  const frontmatter = parseFrontmatterFromText(input.proposalText) as ChangeFrontmatter;
  const taskProgress = input.tasksText
    ? parseTasks(input.tasksText)
    : { totalDone: 0, totalCount: 0, groups: [{ heading: '(未分组)', done: 0, total: 0 }] };

  return {
    slug: input.slug,
    proposalPath: input.proposalPath,
    frontmatter,
    taskProgress,
    blockers: [],
  };
}

export class ChangeScanner {
  constructor(private readonly app: App, private readonly changesRoot: string) {}

  async scanAll(): Promise<ChangeEntry[]> {
    const folder = this.app.vault.getAbstractFileByPath(this.changesRoot);
    if (!folder || !this.isFolder(folder)) {
      return [];
    }
    const entries: ChangeEntry[] = [];
    for (const child of (folder as TFolder).children) {
      if (!this.isFolder(child) || child.name === 'archive') {
        continue;
      }
      const entry = await this.scanOne(child as TFolder);
      if (entry) {
        entries.push(entry);
      }
    }
    return entries;
  }

  async scanOne(folder: TFolder): Promise<ChangeEntry | null> {
    const proposal = folder.children.find(
      (f) => this.isFile(f) && (f as TFile).basename === 'proposal',
    ) as TFile | undefined;
    if (!proposal) {
      return null;
    }
    const tasks = folder.children.find(
      (f) => this.isFile(f) && (f as TFile).basename === 'tasks',
    ) as TFile | undefined;

    const proposalText = await this.app.vault.read(proposal);
    const tasksText = tasks ? await this.app.vault.read(tasks) : undefined;

    return scanChangeFromDisk({
      slug: folder.name,
      proposalPath: proposal.path,
      proposalText,
      tasksText,
    });
  }

  private isFolder(item: unknown): item is TFolder {
    return !!item && typeof item === 'object' && 'children' in (item as object);
  }

  private isFile(item: unknown): item is TFile {
    return !!item && typeof item === 'object' && 'extension' in (item as object);
  }
}
```

- [ ] **Step 5: 给 Obsidian mock 补 TFolder.name**

Replace `tests/mocks/obsidian.ts` TFolder 类:

```typescript
export class TFolder {
  name = '';
  path = '';
  children: Array<TFile | TFolder> = [];
}
```

- [ ] **Step 6: 运行测试验证通过**

Run: `npx jest ChangeScanner`
Expected: PASS(3 tests)

- [ ] **Step 7: 提交**

```bash
git add src/core/ChangeScanner.ts tests/ChangeScanner.spec.ts tests/fixtures/sample-change/ tests/mocks/obsidian.ts
git commit -m "$(cat <<'EOF'
feat(scanner): 扫描 openspec/changes 与提取 ChangeEntry

纯函数 scanChangeFromDisk(input) 接受文本 + slug,输出 ChangeEntry,
可单测且不依赖 Obsidian。ChangeScanner 类用 Obsidian Vault API 在
运行时枚举 changes/ 下的子目录,跳过 archive 目录,自动关联 proposal.md
与 tasks.md。
EOF
)"
```

---

### Task 9: ProjectIndex — 构建与卷积

**Files:**
- Create: `src/core/ProjectIndex.ts`
- Create: `tests/ProjectIndex.spec.ts`

- [ ] **Step 1: 写失败测试**

File: `tests/ProjectIndex.spec.ts`

```typescript
import { buildIndex } from '../src/core/ProjectIndex';
import type { ChangeEntry, ProjectManifest } from '../src/types';

const manifest = (slug: string, scope: string[] = []): ProjectManifest => ({
  slug,
  title: slug,
  status: 'active',
  scope,
  manifestPath: `_projects/${slug}.md`,
});

const change = (
  slug: string,
  fm: Record<string, unknown>,
  done: number,
  total: number,
): ChangeEntry => ({
  slug,
  proposalPath: `openspec/changes/${slug}/proposal.md`,
  frontmatter: fm,
  taskProgress: {
    totalDone: done,
    totalCount: total,
    groups: [{ heading: '(未分组)', done, total }],
  },
  blockers: [],
});

describe('ProjectIndex.buildIndex', () => {
  it('按 project 字段把 change 挂到 project', () => {
    const idx = buildIndex({
      manifests: [manifest('proj-a')],
      changes: [change('c1', { project: 'proj-a' }, 1, 2)],
    });
    expect(idx.projects.size).toBe(1);
    expect(idx.projects.get('proj-a')!.changes).toHaveLength(1);
    expect(idx.unassigned).toEqual([]);
  });

  it('缺 project 字段的 change 进 unassigned', () => {
    const idx = buildIndex({
      manifests: [manifest('proj-a')],
      changes: [change('c1', {}, 0, 3)],
    });
    expect(idx.unassigned).toHaveLength(1);
    expect(idx.unassigned[0].slug).toBe('c1');
  });

  it('指向不存在 manifest 的 project 记入 orphanRefs', () => {
    const idx = buildIndex({
      manifests: [manifest('proj-a')],
      changes: [change('c1', { project: 'proj-missing' }, 0, 1)],
    });
    expect(idx.orphanRefs).toHaveLength(1);
    expect(idx.orphanRefs[0].declaredProject).toBe('proj-missing');
  });

  it('AggregateProgress 聚合多 change 进度', () => {
    const idx = buildIndex({
      manifests: [manifest('proj-a')],
      changes: [
        change('c1', { project: 'proj-a' }, 2, 4),
        change('c2', { project: 'proj-a' }, 3, 3),
        change('c3', { project: 'proj-a' }, 0, 2),
      ],
    });
    const entry = idx.projects.get('proj-a')!;
    expect(entry.progress.totalDone).toBe(5);
    expect(entry.progress.totalCount).toBe(9);
    expect(entry.progress.changeCount).toBe(3);
    expect(entry.progress.changesDone).toBe(1);
  });

  it('blockers 经 known slugs 解析填充', () => {
    const idx = buildIndex({
      manifests: [manifest('proj-a')],
      changes: [
        change('c1', { project: 'proj-a', related: ['[[../c2/proposal]]', '[[unknown]]'] }, 0, 1),
        change('c2', { project: 'proj-a' }, 0, 1),
      ],
    });
    const c1 = idx.projects.get('proj-a')!.changes.find((c) => c.slug === 'c1')!;
    expect(c1.blockers).toHaveLength(2);
    const resolvedMap = Object.fromEntries(c1.blockers.map((b) => [b.targetSlug, b.resolved]));
    expect(resolvedMap.c2).toBe(true);
    expect(resolvedMap.unknown).toBe(false);
  });

  it('空输入返回空索引', () => {
    const idx = buildIndex({ manifests: [], changes: [] });
    expect(idx.projects.size).toBe(0);
    expect(idx.unassigned).toEqual([]);
    expect(idx.orphanRefs).toEqual([]);
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

Run: `npx jest ProjectIndex`
Expected: FAIL — `Cannot find module '../src/core/ProjectIndex'`

- [ ] **Step 3: 写实现**

File: `src/core/ProjectIndex.ts`

```typescript
import type {
  AggregateProgress,
  ChangeEntry,
  OrphanRef,
  ProjectEntry,
  ProjectIndexSnapshot,
  ProjectManifest,
  ProjectSlug,
} from '../types';
import { parseChangeRefs } from './ChangeRefParser';

export interface BuildInput {
  manifests: ProjectManifest[];
  changes: ChangeEntry[];
}

function aggregate(changes: ChangeEntry[]): AggregateProgress {
  let totalDone = 0;
  let totalCount = 0;
  let changesDone = 0;
  for (const c of changes) {
    totalDone += c.taskProgress.totalDone;
    totalCount += c.taskProgress.totalCount;
    if (c.taskProgress.totalCount > 0 && c.taskProgress.totalDone === c.taskProgress.totalCount) {
      changesDone += 1;
    }
  }
  return {
    totalDone,
    totalCount,
    changeCount: changes.length,
    changesDone,
  };
}

export function buildIndex(input: BuildInput): ProjectIndexSnapshot {
  const knownSlugs = new Set(input.changes.map((c) => c.slug));
  const manifestBySlug = new Map<ProjectSlug, ProjectManifest>(
    input.manifests.map((m) => [m.slug, m]),
  );

  const enrichedChanges: ChangeEntry[] = input.changes.map((c) => ({
    ...c,
    blockers: parseChangeRefs(c.frontmatter.related, knownSlugs),
  }));

  const projects = new Map<ProjectSlug, ProjectEntry>();
  const unassigned: ChangeEntry[] = [];
  const orphanRefs: OrphanRef[] = [];

  for (const c of enrichedChanges) {
    const declared = c.frontmatter.project;
    if (!declared) {
      unassigned.push(c);
      continue;
    }
    const manifest = manifestBySlug.get(declared);
    if (!manifest) {
      orphanRefs.push({ sourcePath: c.proposalPath, declaredProject: declared });
      unassigned.push(c);
      continue;
    }
    let entry = projects.get(declared);
    if (!entry) {
      entry = { manifest, changes: [], progress: aggregate([]) };
      projects.set(declared, entry);
    }
    entry.changes.push(c);
  }

  for (const [slug, entry] of projects) {
    entry.progress = aggregate(entry.changes);
    projects.set(slug, entry);
  }

  for (const manifest of input.manifests) {
    if (!projects.has(manifest.slug)) {
      projects.set(manifest.slug, {
        manifest,
        changes: [],
        progress: aggregate([]),
      });
    }
  }

  return { projects, unassigned, orphanRefs };
}
```

- [ ] **Step 4: 运行测试验证通过**

Run: `npx jest ProjectIndex`
Expected: PASS(6 tests)

- [ ] **Step 5: 提交**

```bash
git add src/core/ProjectIndex.ts tests/ProjectIndex.spec.ts
git commit -m "$(cat <<'EOF'
feat(index): 实现项目索引构建与进度卷积

纯函数 buildIndex 按 project: frontmatter 把 change 分桶到 project,
缺字段进 unassigned,指向不存在 manifest 的进 orphanRefs。每个项目
聚合 totalDone / totalCount / changesDone,blockers 经 ChangeRefParser
配合 knownSlugs 标记 resolved 状态。
EOF
)"
```

---

### Task 10: 项目 manifest 扫描器 + 整合层

**Files:**
- Create: `src/core/ProjectManifestScanner.ts`
- Create: `src/core/IndexBuilder.ts`
- Create: `tests/ProjectManifestScanner.spec.ts`

- [ ] **Step 1: 写失败测试**

File: `tests/ProjectManifestScanner.spec.ts`

```typescript
import { parseManifestFromText } from '../src/core/ProjectManifestScanner';

describe('ProjectManifestScanner.parseManifestFromText', () => {
  it('提取完整 manifest', () => {
    const text = `---
type: project
slug: bottleneck-routing
title: 瓶颈区域布线
status: active
owner: "@danwei"
created: 2026-05-17
scope:
  - hic-rule-center
  - hic-layout-planning
tags: [project, hic]
---

# Body
`;
    const m = parseManifestFromText(text, '_projects/bottleneck-routing.md');
    expect(m).not.toBeNull();
    expect(m!.slug).toBe('bottleneck-routing');
    expect(m!.title).toBe('瓶颈区域布线');
    expect(m!.status).toBe('active');
    expect(m!.scope).toEqual(['hic-rule-center', 'hic-layout-planning']);
    expect(m!.manifestPath).toBe('_projects/bottleneck-routing.md');
  });

  it('type 不是 project 返回 null', () => {
    const text = `---
type: note
slug: foo
---
body
`;
    expect(parseManifestFromText(text, '_projects/foo.md')).toBeNull();
  });

  it('缺 slug 或 title 返回 null', () => {
    const text = `---
type: project
status: active
---
`;
    expect(parseManifestFromText(text, '_projects/bad.md')).toBeNull();
  });

  it('非法 status 回退到 active', () => {
    const text = `---
type: project
slug: foo
title: Foo
status: invalid-value
---
`;
    const m = parseManifestFromText(text, '_projects/foo.md')!;
    expect(m.status).toBe('active');
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

Run: `npx jest ProjectManifestScanner`
Expected: FAIL — module not found

- [ ] **Step 3: 写 ProjectManifestScanner**

File: `src/core/ProjectManifestScanner.ts`

```typescript
import type { App, TFile, TFolder } from 'obsidian';
import type { ProjectManifest, ProjectStatus } from '../types';
import { parseFrontmatterFromText } from './FrontmatterIO';

const VALID_STATUSES: ProjectStatus[] = ['active', 'paused', 'done', 'archived'];

function asString(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

function asStringArray(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  return v.filter((x): x is string => typeof x === 'string');
}

export function parseManifestFromText(
  text: string,
  manifestPath: string,
): ProjectManifest | null {
  const fm = parseFrontmatterFromText(text);
  if (fm.type !== 'project') {
    return null;
  }
  const slug = asString(fm.slug);
  const title = asString(fm.title);
  if (!slug || !title) {
    return null;
  }
  const statusRaw = asString(fm.status);
  const status: ProjectStatus =
    statusRaw && VALID_STATUSES.includes(statusRaw as ProjectStatus)
      ? (statusRaw as ProjectStatus)
      : 'active';

  return {
    slug,
    title,
    status,
    owner: asString(fm.owner),
    created: asString(fm.created),
    updated: asString(fm.updated),
    scope: asStringArray(fm.scope),
    tags: asStringArray(fm.tags),
    manifestPath,
  };
}

export class ProjectManifestScanner {
  constructor(private readonly app: App, private readonly projectsRoot: string) {}

  async scanAll(): Promise<ProjectManifest[]> {
    const folder = this.app.vault.getAbstractFileByPath(this.projectsRoot);
    if (!folder || !this.isFolder(folder)) {
      return [];
    }
    const out: ProjectManifest[] = [];
    for (const child of (folder as TFolder).children) {
      if (!this.isFile(child)) continue;
      const file = child as TFile;
      if (file.extension !== 'md') continue;
      const text = await this.app.vault.read(file);
      const manifest = parseManifestFromText(text, file.path);
      if (manifest) {
        out.push(manifest);
      }
    }
    return out;
  }

  private isFolder(item: unknown): item is TFolder {
    return !!item && typeof item === 'object' && 'children' in (item as object);
  }

  private isFile(item: unknown): item is TFile {
    return !!item && typeof item === 'object' && 'extension' in (item as object);
  }
}
```

- [ ] **Step 4: 写 IndexBuilder 整合层**

File: `src/core/IndexBuilder.ts`

```typescript
import type { App } from 'obsidian';
import type { ProjectIndexSnapshot, PluginSettings } from '../types';
import { ChangeScanner } from './ChangeScanner';
import { ProjectManifestScanner } from './ProjectManifestScanner';
import { buildIndex } from './ProjectIndex';

export class IndexBuilder {
  private readonly changeScanner: ChangeScanner;
  private readonly manifestScanner: ProjectManifestScanner;

  constructor(app: App, settings: PluginSettings) {
    this.changeScanner = new ChangeScanner(app, settings.changesPath);
    this.manifestScanner = new ProjectManifestScanner(app, settings.projectsPath);
  }

  async rebuild(): Promise<ProjectIndexSnapshot> {
    const [manifests, changes] = await Promise.all([
      this.manifestScanner.scanAll(),
      this.changeScanner.scanAll(),
    ]);
    return buildIndex({ manifests, changes });
  }
}
```

- [ ] **Step 5: 给 Obsidian mock 补 Vault.getAbstractFileByPath**

Modify `tests/mocks/obsidian.ts`,Vault 类:

```typescript
export class Vault {
  async read(_file: TFile): Promise<string> {
    return '';
  }
  getAbstractFileByPath(_path: string): TFile | TFolder | null {
    return null;
  }
}
```

- [ ] **Step 6: 运行测试 + 类型检查**

Run: `npx jest ProjectManifestScanner && npm run typecheck`
Expected: PASS(4 tests)+ typecheck 无错误

- [ ] **Step 7: 提交**

```bash
git add src/core/ProjectManifestScanner.ts src/core/IndexBuilder.ts tests/ProjectManifestScanner.spec.ts tests/mocks/obsidian.ts
git commit -m "$(cat <<'EOF'
feat(index): 实现项目 manifest 扫描器与索引整合层

ProjectManifestScanner 枚举 _projects/*.md,要求 frontmatter
type=project 且 slug+title 必填,非法 status 回退到 active。
IndexBuilder 统一编排 manifest 与 change 扫描,产出 ProjectIndexSnapshot。
EOF
)"
```

---

### Task 11: AssignmentSuggester — 候选打分

**Files:**
- Create: `src/core/AssignmentSuggester.ts`
- Create: `tests/AssignmentSuggester.spec.ts`

- [ ] **Step 1: 写失败测试**

File: `tests/AssignmentSuggester.spec.ts`

```typescript
import { suggestProjects } from '../src/core/AssignmentSuggester';
import type { ChangeEntry, ProjectEntry, ProjectManifest } from '../src/types';

const manifest = (slug: string, scope: string[] = []): ProjectManifest => ({
  slug,
  title: slug,
  status: 'active',
  scope,
  manifestPath: `_projects/${slug}.md`,
});

const change = (
  slug: string,
  fm: Record<string, unknown> = {},
  blockers: string[] = [],
): ChangeEntry => ({
  slug,
  proposalPath: `openspec/changes/${slug}/proposal.md`,
  frontmatter: fm,
  taskProgress: { totalDone: 0, totalCount: 0, groups: [] },
  blockers: blockers.map((t) => ({ targetSlug: t, raw: t, resolved: true })),
});

const projectEntry = (slug: string, scope: string[], changes: ChangeEntry[]): ProjectEntry => ({
  manifest: manifest(slug, scope),
  changes,
  progress: { totalDone: 0, totalCount: 0, changeCount: changes.length, changesDone: 0 },
});

describe('AssignmentSuggester.suggestProjects', () => {
  it('capability 匹配 project.scope 加 5 分', () => {
    const target = change('orphan-change', { capability: 'hic-kernel-audit' });
    const projects = [projectEntry('proj-a', ['hic-kernel-audit'], [])];
    const candidates = suggestProjects(target, projects);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].projectSlug).toBe('proj-a');
    expect(candidates[0].score).toBe(5);
    expect(candidates[0].reasons[0]).toMatch(/capability/);
  });

  it('related 指向某项目内的 change 加 3 分', () => {
    const inside = change('c1', { project: 'proj-a' });
    const target = change('orphan-change', {}, ['c1']);
    const projects = [projectEntry('proj-a', [], [inside])];
    const candidates = suggestProjects(target, projects);
    expect(candidates[0].score).toBe(3);
    expect(candidates[0].reasons[0]).toMatch(/related/);
  });

  it('change slug 含 project slug 加 1 分', () => {
    const target = change('add-proj-a-feature');
    const projects = [projectEntry('proj-a', [], [])];
    const candidates = suggestProjects(target, projects);
    expect(candidates[0].score).toBe(1);
  });

  it('多信号叠加,按分数降序', () => {
    const inside = change('c1', { project: 'proj-a' });
    const target = change('proj-a-orphan', { capability: 'hic-kernel-audit' }, ['c1']);
    const projects = [
      projectEntry('proj-a', ['hic-kernel-audit'], [inside]),
      projectEntry('proj-b', [], []),
    ];
    const candidates = suggestProjects(target, projects);
    expect(candidates[0].projectSlug).toBe('proj-a');
    expect(candidates[0].score).toBe(9);
    expect(candidates.find((c) => c.projectSlug === 'proj-b')).toBeUndefined();
  });

  it('得分为 0 的项目不出现在候选中', () => {
    const target = change('orphan');
    const projects = [projectEntry('proj-a', ['some-other'], [])];
    const candidates = suggestProjects(target, projects);
    expect(candidates).toEqual([]);
  });

  it('最多返回 3 个候选', () => {
    const target = change('orphan', { capability: 'hic-rule-center' });
    const projects = ['p1', 'p2', 'p3', 'p4', 'p5'].map((s) =>
      projectEntry(s, ['hic-rule-center'], []),
    );
    const candidates = suggestProjects(target, projects);
    expect(candidates).toHaveLength(3);
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

Run: `npx jest AssignmentSuggester`
Expected: FAIL — module not found

- [ ] **Step 3: 写实现**

File: `src/core/AssignmentSuggester.ts`

```typescript
import type {
  AssignmentCandidate,
  ChangeEntry,
  ProjectEntry,
  ProjectSlug,
} from '../types';

const SCORE_CAPABILITY = 5;
const SCORE_RELATED = 3;
const SCORE_SLUG_TOKEN = 1;
const MAX_CANDIDATES = 3;

export function suggestProjects(
  target: ChangeEntry,
  projects: ProjectEntry[],
): AssignmentCandidate[] {
  const candidates: AssignmentCandidate[] = [];

  for (const project of projects) {
    let score = 0;
    const reasons: string[] = [];

    const capability = typeof target.frontmatter.capability === 'string'
      ? target.frontmatter.capability
      : undefined;
    if (capability && project.manifest.scope?.includes(capability)) {
      score += SCORE_CAPABILITY;
      reasons.push(`capability ${capability} ∈ project.scope`);
    }

    const insideSlugs = new Set(project.changes.map((c) => c.slug));
    const relatedHit = target.blockers.find((b) => insideSlugs.has(b.targetSlug));
    if (relatedHit) {
      score += SCORE_RELATED;
      reasons.push(`related → ${relatedHit.targetSlug}(已在该项目内)`);
    }

    if (target.slug.includes(project.manifest.slug)) {
      score += SCORE_SLUG_TOKEN;
      reasons.push(`change slug 含 project slug "${project.manifest.slug}"`);
    }

    if (score > 0) {
      candidates.push({ projectSlug: project.manifest.slug, score, reasons });
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates.slice(0, MAX_CANDIDATES);
}

export function uniqueProjectSlugs(candidates: AssignmentCandidate[]): ProjectSlug[] {
  return Array.from(new Set(candidates.map((c) => c.projectSlug)));
}
```

- [ ] **Step 4: 运行测试验证通过**

Run: `npx jest AssignmentSuggester`
Expected: PASS(6 tests)

- [ ] **Step 5: 提交**

```bash
git add src/core/AssignmentSuggester.ts tests/AssignmentSuggester.spec.ts
git commit -m "$(cat <<'EOF'
feat(suggest): 实现未分类 change 归并候选打分

三信号加权评分:capability ∈ project.scope(+5),related 指向某
项目内 change(+3),change slug 含 project slug(+1)。得分为 0
的项目不入候选,最多返回 3 个降序。打分理由附在 reasons[] 供 UI
展示。
EOF
)"
```

---

## Stage 3: 视图层

### Task 12: PluginSettings + SettingTab

**Files:**
- Create: `src/settings.ts`

- [ ] **Step 1: 创建 settings.ts**

```typescript
import { App, Plugin, PluginSettingTab, Setting } from 'obsidian';
import type { PluginSettings } from './types';
import { DEFAULT_SETTINGS } from './types';

export { DEFAULT_SETTINGS };
export type { PluginSettings };

/**
 * SettingTab 只需要插件暴露的最小接口,定义在此处避免与 main.ts 形成
 * 循环 type-import。main.ts 中的 PluProPlugin 会实现这个 contract。
 */
export interface PluProPluginContract extends Plugin {
  settings: PluginSettings;
  saveSettings(): Promise<void>;
  refreshIndex(): Promise<void>;
}

export class PluProSettingTab extends PluginSettingTab {
  constructor(app: App, private readonly plugin: PluProPluginContract) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'PluPro 设置' });

    new Setting(containerEl)
      .setName('OpenSpec changes 路径')
      .setDesc('相对 vault 根目录,例如 openspec/changes')
      .addText((text) =>
        text
          .setPlaceholder('openspec/changes')
          .setValue(this.plugin.settings.changesPath)
          .onChange(async (value) => {
            this.plugin.settings.changesPath = value || DEFAULT_SETTINGS.changesPath;
            await this.plugin.saveSettings();
            await this.plugin.refreshIndex();
          }),
      );

    new Setting(containerEl)
      .setName('项目 manifest 目录')
      .setDesc('相对 vault 根目录,例如 _projects')
      .addText((text) =>
        text
          .setPlaceholder('_projects')
          .setValue(this.plugin.settings.projectsPath)
          .onChange(async (value) => {
            this.plugin.settings.projectsPath = value || DEFAULT_SETTINGS.projectsPath;
            await this.plugin.saveSettings();
            await this.plugin.refreshIndex();
          }),
      );

    new Setting(containerEl)
      .setName('启用 capability 归并 fallback')
      .setDesc('未分类时根据 change.capability 推荐项目')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.enableCapabilityFallback)
          .onChange(async (value) => {
            this.plugin.settings.enableCapabilityFallback = value;
            await this.plugin.saveSettings();
          }),
      );
  }
}
```

- [ ] **Step 2: 验证编译**

Run: `npm run typecheck`
Expected: 无错误(`PluProPluginContract` 解耦了对 main 模块的依赖)

- [ ] **Step 3: 提交**

```bash
git add src/settings.ts
git commit -m "$(cat <<'EOF'
feat(settings): 实现 SettingTab 与 PluginSettings

暴露 changes 路径、_projects 路径、capability fallback 开关 三个设置项,
修改后自动 saveData + 触发索引刷新。
EOF
)"
```

---

### Task 13: ControlTowerView 骨架

**Files:**
- Create: `src/view/ControlTowerView.ts`

- [ ] **Step 1: 创建 ControlTowerView 骨架**

```typescript
import { ItemView, Plugin, WorkspaceLeaf } from 'obsidian';
import type { ChangeEntry, ProjectIndexSnapshot } from '../types';

export const VIEW_TYPE_CONTROL_TOWER = 'plupro-control-tower';

/**
 * 视图只需要插件暴露的最小行为子集 — 同样为了避免 view ↔ main 循环
 * type-import,这里定义 inline contract,PluProPlugin 隐式满足。
 */
export interface PluProPluginForView extends Plugin {
  getIndex(): ProjectIndexSnapshot;
  openAssignmentModal(target: ChangeEntry): void;
}

export class ControlTowerView extends ItemView {
  private listPaneEl: HTMLElement | null = null;
  private detailPaneEl: HTMLElement | null = null;
  private selectedProjectSlug: string | null = null;

  constructor(leaf: WorkspaceLeaf, private readonly plugin: PluProPluginForView) {
    super(leaf);
  }

  getViewType(): string {
    return VIEW_TYPE_CONTROL_TOWER;
  }

  getDisplayText(): string {
    return 'PluPro 项目控制塔';
  }

  getIcon(): string {
    return 'kanban-square';
  }

  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass('plupro-control-tower');

    const layout = container.createDiv({ cls: 'plupro-layout' });
    this.listPaneEl = layout.createDiv({ cls: 'plupro-list-pane' });
    this.detailPaneEl = layout.createDiv({ cls: 'plupro-detail-pane' });

    this.renderAll(this.plugin.getIndex());
  }

  async onClose(): Promise<void> {
    this.listPaneEl = null;
    this.detailPaneEl = null;
  }

  renderAll(snapshot: ProjectIndexSnapshot): void {
    if (!this.listPaneEl || !this.detailPaneEl) {
      return;
    }
    this.renderList(snapshot);
    this.renderDetail(snapshot);
  }

  private renderList(snapshot: ProjectIndexSnapshot): void {
    if (!this.listPaneEl) return;
    this.listPaneEl.empty();
    this.listPaneEl.createEl('h3', { text: '项目', cls: 'plupro-list-title' });

    if (snapshot.projects.size === 0 && snapshot.unassigned.length === 0) {
      this.listPaneEl.createDiv({ cls: 'plupro-empty', text: '尚无项目 — 在 _projects/ 下创建 manifest 文件即可' });
      return;
    }

    const ul = this.listPaneEl.createEl('ul', { cls: 'plupro-project-list' });
    for (const [slug, entry] of snapshot.projects) {
      const li = ul.createEl('li', { cls: 'plupro-project-item' });
      if (slug === this.selectedProjectSlug) {
        li.addClass('is-selected');
      }
      const title = li.createDiv({ cls: 'plupro-project-title', text: entry.manifest.title });
      title.setAttr('data-slug', slug);
      const meta = li.createDiv({ cls: 'plupro-project-meta' });
      const pct = entry.progress.totalCount === 0
        ? 0
        : Math.round((entry.progress.totalDone / entry.progress.totalCount) * 100);
      meta.setText(
        `${entry.progress.changesDone}/${entry.progress.changeCount} change · ${entry.progress.totalDone}/${entry.progress.totalCount} task · ${pct}%`,
      );
      this.renderProgressBar(li, pct);
      li.addEventListener('click', () => {
        this.selectedProjectSlug = slug;
        this.renderAll(snapshot);
      });
    }

    const unassignedLi = ul.createEl('li', { cls: 'plupro-unassigned-item' });
    unassignedLi.setText(`📦 未分类(${snapshot.unassigned.length})`);
    if (this.selectedProjectSlug === '__unassigned__') {
      unassignedLi.addClass('is-selected');
    }
    unassignedLi.addEventListener('click', () => {
      this.selectedProjectSlug = '__unassigned__';
      this.renderAll(snapshot);
    });
  }

  private renderDetail(snapshot: ProjectIndexSnapshot): void {
    if (!this.detailPaneEl) return;
    this.detailPaneEl.empty();

    if (!this.selectedProjectSlug) {
      this.detailPaneEl.createDiv({ cls: 'plupro-hint', text: '选择左侧项目查看详情' });
      return;
    }

    if (this.selectedProjectSlug === '__unassigned__') {
      this.renderUnassignedDetail(snapshot);
      return;
    }

    const entry = snapshot.projects.get(this.selectedProjectSlug);
    if (!entry) {
      this.detailPaneEl.createDiv({ cls: 'plupro-hint', text: '项目已被删除,请选择其他项目' });
      return;
    }
    this.detailPaneEl.createEl('h2', { text: entry.manifest.title });
    const meta = this.detailPaneEl.createDiv({ cls: 'plupro-detail-meta' });
    meta.createSpan({ text: `状态:${entry.manifest.status}` });
    if (entry.manifest.owner) {
      meta.createSpan({ text: ` · 负责人:${entry.manifest.owner}` });
    }
    if (entry.manifest.scope && entry.manifest.scope.length > 0) {
      meta.createSpan({ text: ` · 能力域:${entry.manifest.scope.join(', ')}` });
    }
    this.detailPaneEl.createEl('h3', { text: 'Change 列表' });
    if (entry.changes.length === 0) {
      this.detailPaneEl.createDiv({ cls: 'plupro-empty', text: '该项目下尚未挂入任何 change' });
      return;
    }
    const changesUl = this.detailPaneEl.createEl('ul', { cls: 'plupro-change-list' });
    for (const c of entry.changes) {
      const li = changesUl.createEl('li', { cls: 'plupro-change-item' });
      li.createDiv({ cls: 'plupro-change-slug', text: c.slug });
      const tp = c.taskProgress;
      const pct = tp.totalCount === 0 ? 0 : Math.round((tp.totalDone / tp.totalCount) * 100);
      li.createDiv({
        cls: 'plupro-change-progress',
        text: `${tp.totalDone}/${tp.totalCount} task · ${pct}%`,
      });
      this.renderProgressBar(li, pct);
      if (c.blockers.length > 0) {
        const blockers = li.createDiv({ cls: 'plupro-change-blockers' });
        blockers.createSpan({ text: '阻塞:' });
        for (const b of c.blockers) {
          const tag = blockers.createSpan({
            cls: b.resolved ? 'plupro-blocker is-resolved' : 'plupro-blocker is-orphan',
            text: b.targetSlug,
          });
          if (!b.resolved) {
            tag.setAttr('title', '指向不存在的 change');
          }
        }
      }
    }
  }

  private renderUnassignedDetail(snapshot: ProjectIndexSnapshot): void {
    if (!this.detailPaneEl) return;
    this.detailPaneEl.createEl('h2', { text: '未分类 changes' });
    if (snapshot.unassigned.length === 0) {
      this.detailPaneEl.createDiv({ cls: 'plupro-empty', text: '全部 change 已分类' });
      return;
    }
    const ul = this.detailPaneEl.createEl('ul', { cls: 'plupro-change-list' });
    for (const c of snapshot.unassigned) {
      const li = ul.createEl('li', { cls: 'plupro-change-item' });
      li.createDiv({ cls: 'plupro-change-slug', text: c.slug });
      const assignBtn = li.createEl('button', { cls: 'plupro-assign-btn', text: '归并到项目…' });
      assignBtn.addEventListener('click', () => {
        this.plugin.openAssignmentModal(c);
      });
    }
  }

  private renderProgressBar(parent: HTMLElement, pct: number): void {
    const bar = parent.createDiv({ cls: 'plupro-progress-bar' });
    const fill = bar.createDiv({ cls: 'plupro-progress-fill' });
    fill.style.width = `${pct}%`;
  }
}
```

- [ ] **Step 2: 创建样式文件**

File: `styles.css`

```css
.plupro-control-tower .plupro-layout {
  display: flex;
  height: 100%;
  gap: 12px;
}
.plupro-list-pane {
  width: 280px;
  border-right: 1px solid var(--background-modifier-border);
  overflow-y: auto;
  padding: 8px;
}
.plupro-detail-pane {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}
.plupro-project-list,
.plupro-change-list {
  list-style: none;
  padding: 0;
  margin: 0;
}
.plupro-project-item,
.plupro-change-item {
  padding: 8px;
  border-radius: 6px;
  cursor: pointer;
  margin-bottom: 4px;
}
.plupro-project-item:hover {
  background-color: var(--background-modifier-hover);
}
.plupro-project-item.is-selected,
.plupro-unassigned-item.is-selected {
  background-color: var(--background-modifier-active);
}
.plupro-progress-bar {
  height: 4px;
  background-color: var(--background-modifier-border);
  border-radius: 2px;
  margin-top: 4px;
  overflow: hidden;
}
.plupro-progress-fill {
  height: 100%;
  background-color: var(--interactive-accent);
}
.plupro-blocker {
  display: inline-block;
  padding: 2px 6px;
  margin: 0 4px;
  border-radius: 4px;
  font-size: 0.85em;
}
.plupro-blocker.is-resolved {
  background-color: var(--background-secondary);
}
.plupro-blocker.is-orphan {
  background-color: var(--background-modifier-error);
  color: var(--text-on-accent);
}
.plupro-assign-btn {
  margin-left: 8px;
}
.plupro-empty,
.plupro-hint {
  color: var(--text-muted);
  padding: 16px;
}
.plupro-unassigned-item {
  padding: 8px;
  cursor: pointer;
  border-radius: 6px;
  margin-top: 12px;
  border-top: 1px solid var(--background-modifier-border);
}
```

- [ ] **Step 3: 提交**

```bash
git add src/view/ControlTowerView.ts styles.css
git commit -m "$(cat <<'EOF'
feat(view): 实现项目控制塔主视图骨架

ItemView 左右双栏布局 — 左侧项目列表(进度条+计数),底部固定
「📦 未分类」桶;右侧选中项目详情(元数据+change 卡+阻塞 chip)。
styles.css 用 Obsidian CSS 变量保持深浅色主题兼容。归并按钮事件
转发到 plugin.openAssignmentModal,在 Task 14 实现 Modal。
EOF
)"
```

---

### Task 14: AssignmentModal — 归并对话框

**Files:**
- Create: `src/view/AssignmentModal.ts`

- [ ] **Step 1: 创建 AssignmentModal**

```typescript
import { App, Modal, Notice, Setting } from 'obsidian';
import type { ChangeEntry, ProjectEntry, AssignmentCandidate } from '../types';
import { suggestProjects } from '../core/AssignmentSuggester';

export class AssignmentModal extends Modal {
  constructor(
    app: App,
    private readonly target: ChangeEntry,
    private readonly allProjects: ProjectEntry[],
    private readonly onAssign: (projectSlug: string) => Promise<void>,
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl('h2', { text: `归并 ${this.target.slug}` });

    const candidates = suggestProjects(this.target, this.allProjects);
    if (candidates.length === 0) {
      contentEl.createDiv({
        cls: 'plupro-hint',
        text: '没有可推荐的候选项目 — 请在下方手动选择',
      });
    } else {
      contentEl.createEl('h3', { text: '推荐候选' });
      for (const candidate of candidates) {
        this.renderCandidate(contentEl, candidate);
      }
    }

    contentEl.createEl('h3', { text: '所有项目' });
    const recommendedSlugs = new Set(candidates.map((c) => c.projectSlug));
    const others = this.allProjects.filter((p) => !recommendedSlugs.has(p.manifest.slug));
    if (others.length === 0) {
      contentEl.createDiv({ cls: 'plupro-hint', text: '(无)' });
    } else {
      for (const p of others) {
        new Setting(contentEl)
          .setName(p.manifest.title)
          .setDesc(p.manifest.slug)
          .addButton((btn) =>
            btn.setButtonText('归并').onClick(() => this.assignAndClose(p.manifest.slug)),
          );
      }
    }
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private renderCandidate(parent: HTMLElement, candidate: AssignmentCandidate): void {
    new Setting(parent)
      .setName(candidate.projectSlug)
      .setDesc(`得分 ${candidate.score} — ${candidate.reasons.join(' / ')}`)
      .addButton((btn) =>
        btn
          .setButtonText('归并')
          .setCta()
          .onClick(() => this.assignAndClose(candidate.projectSlug)),
      );
  }

  private async assignAndClose(projectSlug: string): Promise<void> {
    try {
      await this.onAssign(projectSlug);
      new Notice(`已归并 ${this.target.slug} → ${projectSlug}`);
      this.close();
    } catch (err) {
      new Notice(`归并失败:${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
```

- [ ] **Step 2: 提交**

```bash
git add src/view/AssignmentModal.ts
git commit -m "$(cat <<'EOF'
feat(view): 实现归并对话框 AssignmentModal

打开时即时调用 suggestProjects 计算候选,推荐候选按 CTA 按钮高亮;
其余项目以普通按钮列出。点击归并后通过 onAssign 回调写回 frontmatter,
成功/失败均以 Obsidian Notice 反馈。
EOF
)"
```

---

## Stage 4: 集成

### Task 15: main.ts 插件入口与 metadataCache 订阅

**Files:**
- Create: `src/main.ts`

- [ ] **Step 1: 创建 main.ts**

```typescript
import { Plugin, TFile, WorkspaceLeaf, Notice } from 'obsidian';
import type { PluginSettings, ProjectIndexSnapshot, ChangeEntry } from './types';
import { DEFAULT_SETTINGS } from './types';
import { PluProSettingTab } from './settings';
import { IndexBuilder } from './core/IndexBuilder';
import { FrontmatterIO } from './core/FrontmatterIO';
import { ControlTowerView, VIEW_TYPE_CONTROL_TOWER } from './view/ControlTowerView';
import { AssignmentModal } from './view/AssignmentModal';

export default class PluProPlugin extends Plugin {
  settings: PluginSettings = { ...DEFAULT_SETTINGS };
  private indexBuilder!: IndexBuilder;
  private frontmatterIO!: FrontmatterIO;
  private currentIndex: ProjectIndexSnapshot = {
    projects: new Map(),
    unassigned: [],
    orphanRefs: [],
  };
  private refreshTimer: number | null = null;

  async onload(): Promise<void> {
    await this.loadSettings();
    this.indexBuilder = new IndexBuilder(this.app, this.settings);
    this.frontmatterIO = new FrontmatterIO(this.app);

    this.registerView(VIEW_TYPE_CONTROL_TOWER, (leaf) => new ControlTowerView(leaf, this));

    this.addCommand({
      id: 'open-control-tower',
      name: '打开项目控制塔',
      callback: () => this.activateView(),
    });

    this.addCommand({
      id: 'refresh-index',
      name: '刷新项目索引',
      callback: () => this.refreshIndex(),
    });

    this.addSettingTab(new PluProSettingTab(this.app, this));

    this.app.workspace.onLayoutReady(async () => {
      await this.refreshIndex();
      this.registerMetadataCacheListeners();
    });
  }

  onunload(): void {
    if (this.refreshTimer !== null) {
      window.clearTimeout(this.refreshTimer);
    }
  }

  async loadSettings(): Promise<void> {
    const data = (await this.loadData()) as Partial<PluginSettings> | null;
    this.settings = { ...DEFAULT_SETTINGS, ...(data ?? {}) };
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
    this.indexBuilder = new IndexBuilder(this.app, this.settings);
  }

  async refreshIndex(): Promise<void> {
    this.currentIndex = await this.indexBuilder.rebuild();
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_CONTROL_TOWER)) {
      const view = leaf.view;
      if (view instanceof ControlTowerView) {
        view.renderAll(this.currentIndex);
      }
    }
  }

  getIndex(): ProjectIndexSnapshot {
    return this.currentIndex;
  }

  async activateView(): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_CONTROL_TOWER);
    if (existing.length > 0) {
      this.app.workspace.revealLeaf(existing[0]);
      return;
    }
    const leaf: WorkspaceLeaf | null = this.app.workspace.getLeaf('tab');
    if (!leaf) {
      new Notice('无法创建视图 leaf');
      return;
    }
    await leaf.setViewState({ type: VIEW_TYPE_CONTROL_TOWER, active: true });
    this.app.workspace.revealLeaf(leaf);
  }

  openAssignmentModal(target: ChangeEntry): void {
    const allProjects = Array.from(this.currentIndex.projects.values());
    new AssignmentModal(this.app, target, allProjects, async (projectSlug) => {
      const file = this.app.vault.getAbstractFileByPath(target.proposalPath);
      if (!file || !(file instanceof TFile)) {
        throw new Error(`无法定位 ${target.proposalPath}`);
      }
      await this.frontmatterIO.setField(file, 'project', projectSlug);
      await this.refreshIndex();
    }).open();
  }

  private registerMetadataCacheListeners(): void {
    const shouldHandle = (file: TFile): boolean => {
      return (
        file.path.startsWith(this.settings.changesPath + '/') ||
        file.path.startsWith(this.settings.projectsPath + '/')
      );
    };
    const scheduleRefresh = (): void => {
      if (this.refreshTimer !== null) {
        window.clearTimeout(this.refreshTimer);
      }
      this.refreshTimer = window.setTimeout(() => {
        this.refreshIndex();
        this.refreshTimer = null;
      }, 250);
    };

    this.registerEvent(
      this.app.metadataCache.on('changed', (file) => {
        if (file instanceof TFile && shouldHandle(file)) {
          scheduleRefresh();
        }
      }),
    );
    this.registerEvent(
      this.app.vault.on('create', (file) => {
        if (file instanceof TFile && shouldHandle(file)) {
          scheduleRefresh();
        }
      }),
    );
    this.registerEvent(
      this.app.vault.on('delete', (file) => {
        if (file instanceof TFile && shouldHandle(file)) {
          scheduleRefresh();
        }
      }),
    );
    this.registerEvent(
      this.app.vault.on('rename', (file) => {
        if (file instanceof TFile && shouldHandle(file)) {
          scheduleRefresh();
        }
      }),
    );
  }
}
```

- [ ] **Step 2: 验证完整编译**

Run: `npm run typecheck`
Expected: 无错误

- [ ] **Step 3: 验证 dev build**

Run: `npm run build`
Expected: `dist/main.js` 生成,无错误

- [ ] **Step 4: 提交**

```bash
git add src/main.ts
git commit -m "$(cat <<'EOF'
feat(plugin): 实现插件入口与索引订阅

注册命令(打开控制塔/刷新索引)、ItemView、SettingTab,启动时
等 onLayoutReady 后做首次扫描。订阅 metadataCache.on('changed')
与 vault create/delete/rename 事件,只对 changes/ 与 _projects/ 下
的文件触发 debounced 重建索引(250ms),避免高频 IO 抖动。
EOF
)"
```

---

### Task 16: dev 部署 + 冒烟测试 checklist

**Files:**
- Create: `scripts/install-dev.sh`
- Create: `docs/smoke-test.md`

- [ ] **Step 1: 创建 dev 部署脚本**

File: `scripts/install-dev.sh`

```bash
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

mkdir -p "$PLUGIN_DIR"
ln -sf "$REPO_DIR/dist/main.js" "$PLUGIN_DIR/main.js"
ln -sf "$REPO_DIR/manifest.json" "$PLUGIN_DIR/manifest.json"
ln -sf "$REPO_DIR/styles.css" "$PLUGIN_DIR/styles.css"

echo "已部署到:$PLUGIN_DIR"
echo "下一步:Obsidian 设置 → 第三方插件 → 启用 'PluPro 项目控制塔'"
```

- [ ] **Step 2: 赋可执行权限**

Run: `chmod +x scripts/install-dev.sh`
Expected: 无输出

- [ ] **Step 3: 创建冒烟测试 checklist**

File: `docs/smoke-test.md`

```markdown
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
```

- [ ] **Step 4: 提交**

```bash
git add scripts/install-dev.sh docs/smoke-test.md
git commit -m "$(cat <<'EOF'
chore(release): 添加 dev 部署脚本与冒烟 checklist

install-dev.sh 通过 symlink 把 dist/main.js / manifest.json / styles.css
挂到 vault 的 .obsidian/plugins/obsidian-plu-pro/,支持 npm run dev
后即时热重载。docs/smoke-test.md 列出 v1 四条主流程的人工验证步骤,
每次发布前过一遍。
EOF
)"
```

---

### Task 17: 真实样例 fixtures + 最终回归

**Files:**
- Create: `tests/fixtures/realistic-change-1/proposal.md`
- Create: `tests/fixtures/realistic-change-1/tasks.md`
- Create: `tests/fixtures/realistic-change-2/proposal.md`
- Create: `tests/fixtures/realistic-change-2/tasks.md`
- Create: `tests/fixtures/realistic-project/_projects/bottleneck-routing.md`
- Create: `tests/integration.spec.ts`

- [ ] **Step 1: 准备真实风格 fixtures**

File: `tests/fixtures/realistic-change-1/proposal.md`

```markdown
---
type: proposal
change-id: establish-hic-kernel-audit
status: draft
capability: hic-kernel-audit
owner: "@danwei"
project: bottleneck-routing
related:
  - "[[../realistic-change-2/proposal]]"
created: 2026-05-12
---
# Proposal: 建立 HIC kernel audit

(略)
```

File: `tests/fixtures/realistic-change-1/tasks.md`

```markdown
## 0. 前置依赖

- [x] 0.1 等 establish-hic-kernel-bounded-context archive
- [ ] 0.2 与 DBA 对齐 schema

## 1. 核心契约

- [x] 1.1 创建包结构
- [x] 1.2 实现 AuditRecord
- [ ] 1.3 实现 AuditPublisher
- [ ] 1.4 实现 AuditQuery
```

File: `tests/fixtures/realistic-change-2/proposal.md`

```markdown
---
type: proposal
change-id: layout-routing-eval-context-extraction
status: executing
capability: hic-layout-planning
owner: "@danwei"
project: bottleneck-routing
related: []
created: 2026-05-15
---
# Proposal: 抽取布线评估上下文

(略)
```

File: `tests/fixtures/realistic-change-2/tasks.md`

```markdown
## 1. 设计

- [x] 1.1 类图
- [x] 1.2 接口签名

## 2. 实现

- [x] 2.1 写 LayoutEvalContextExtractor
- [x] 2.2 写单测
- [x] 2.3 集成进 pipeline
```

File: `tests/fixtures/realistic-project/_projects/bottleneck-routing.md`

```markdown
---
type: project
slug: bottleneck-routing
title: 瓶颈区域布线
status: active
owner: "@danwei"
created: 2026-05-10
scope:
  - hic-kernel-audit
  - hic-layout-planning
tags: [project, hic]
---
# 瓶颈区域布线

(项目愿景与里程碑由人工编辑)
```

- [ ] **Step 2: 写端到端整合测试(纯函数路径)**

File: `tests/integration.spec.ts`

```typescript
import fs from 'fs';
import path from 'path';
import { parseManifestFromText } from '../src/core/ProjectManifestScanner';
import { scanChangeFromDisk } from '../src/core/ChangeScanner';
import { buildIndex } from '../src/core/ProjectIndex';

const FIX = path.resolve(__dirname, 'fixtures');

function readChange(name: string) {
  const proposalText = fs.readFileSync(path.join(FIX, name, 'proposal.md'), 'utf-8');
  const tasksText = fs.readFileSync(path.join(FIX, name, 'tasks.md'), 'utf-8');
  return scanChangeFromDisk({
    slug: name,
    proposalPath: `openspec/changes/${name}/proposal.md`,
    proposalText,
    tasksText,
  });
}

describe('integration: realistic fixtures', () => {
  it('挂载到正确项目并聚合进度', () => {
    const manifestText = fs.readFileSync(
      path.join(FIX, 'realistic-project/_projects/bottleneck-routing.md'),
      'utf-8',
    );
    const manifest = parseManifestFromText(manifestText, '_projects/bottleneck-routing.md');
    expect(manifest).not.toBeNull();

    const changes = [readChange('realistic-change-1'), readChange('realistic-change-2')];
    const idx = buildIndex({ manifests: [manifest!], changes });

    expect(idx.unassigned).toEqual([]);
    expect(idx.projects.size).toBe(1);

    const entry = idx.projects.get('bottleneck-routing')!;
    expect(entry.changes).toHaveLength(2);
    expect(entry.progress.changeCount).toBe(2);
    // change-1: 3 done / 6 total; change-2: 5 done / 5 total
    expect(entry.progress.totalDone).toBe(8);
    expect(entry.progress.totalCount).toBe(11);
    expect(entry.progress.changesDone).toBe(1);

    const c1 = entry.changes.find((c) => c.slug === 'realistic-change-1')!;
    expect(c1.blockers).toHaveLength(1);
    expect(c1.blockers[0].targetSlug).toBe('realistic-change-2');
    expect(c1.blockers[0].resolved).toBe(true);
  });
});
```

- [ ] **Step 3: 跑完整测试套件**

Run: `npm test`
Expected: PASS — 全部模块单测 + integration 通过

- [ ] **Step 4: 跑 typecheck + 完整 build**

Run: `npm run typecheck && npm run build`
Expected: 无错误,`dist/main.js` 重新生成

- [ ] **Step 5: 提交**

```bash
git add tests/fixtures/realistic-change-1/ tests/fixtures/realistic-change-2/ tests/fixtures/realistic-project/ tests/integration.spec.ts
git commit -m "$(cat <<'EOF'
test(integration): 真实风格 fixtures 端到端回归

两个具备真实 frontmatter 的 change(含跨 change related 引用)+
一个 project manifest,验证 ProjectManifestScanner → ChangeScanner →
buildIndex 的完整链路,确认进度聚合与 blockers 解析正确。
EOF
)"
```

---

## 完成定义(v1 Done)

- [ ] 17 个 task 全部 checkbox 打勾
- [ ] `npm test` 全绿(目标 25+ 测试用例)
- [ ] `npm run typecheck` 无错误
- [ ] `npm run build` 产出 `dist/main.js`
- [ ] `./scripts/install-dev.sh` 部署成功
- [ ] `docs/smoke-test.md` 4 条主流程人工通过
- [ ] `git log --oneline` 显示 17+ 个细粒度 commit
