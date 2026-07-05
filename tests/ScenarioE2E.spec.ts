import { IndexBuilder } from '../src/core/IndexBuilder';
import { createContextPackage } from '../src/core/ContextPackage';
import { applyPreviewToText, createPendingAnalysisPreview } from '../src/core/WritePreview';
import { SCENARIO_CATALOG } from '../src/core/ScenarioCatalog';
import { DEFAULT_SETTINGS } from '../src/types';
import type { App } from 'obsidian';
import type { ProjectIndexSnapshot, ScenarioSimulationResult } from '../src/types';

interface MockFile {
  path: string;
  basename: string;
  extension: string;
  parent: MockFolder | null;
}

interface MockFolder {
  name: string;
  path: string;
  children: Array<MockFile | MockFolder>;
  parent: MockFolder | null;
}

class ScenarioVault {
  readonly root: MockFolder = { name: '', path: '', children: [], parent: null };
  readonly files = new Map<string, { file: MockFile; text: string }>();
  private readonly folders = new Map<string, MockFolder>([['', this.root]]);

  addFile(path: string, text: string): void {
    const normalized = path.replace(/^\/+/, '');
    const parts = normalized.split('/');
    const filename = parts.pop();
    if (!filename) return;
    const folder = this.ensureFolder(parts.join('/'));
    const dot = filename.lastIndexOf('.');
    const basename = dot >= 0 ? filename.slice(0, dot) : filename;
    const extension = dot >= 0 ? filename.slice(dot + 1) : '';
    const file: MockFile = {
      path: normalized,
      basename,
      extension,
      parent: folder,
    } as MockFile;
    folder.children.push(file);
    this.files.set(normalized, { file, text });
  }

  getAbstractFileByPath(path: string): MockFile | MockFolder | null {
    const normalized = path.replace(/^\/+/, '').replace(/\/$/, '');
    return this.files.get(normalized)?.file ?? this.folders.get(normalized) ?? null;
  }

  async read(file: MockFile): Promise<string> {
    return this.files.get(file.path)?.text ?? '';
  }

  readonly adapter = {
    exists: async (path: string): Promise<boolean> => {
      const normalized = path.replace(/^\/+/, '').replace(/\/$/, '');
      return this.files.has(normalized) || this.folders.has(normalized);
    },
    read: async (path: string): Promise<string> => this.files.get(path.replace(/^\/+/, ''))?.text ?? '',
    write: async (path: string, text: string): Promise<void> => {
      this.addFile(path, text);
    },
    mkdir: async (path: string): Promise<void> => {
      this.ensureFolder(path.replace(/^\/+/, '').replace(/\/$/, ''));
    },
    list: async (path: string): Promise<{ files: string[]; folders: string[] }> => {
      const normalized = path.replace(/^\/+/, '').replace(/\/$/, '');
      const folder = this.folders.get(normalized);
      if (!folder) return { files: [], folders: [] };
      const files: string[] = [];
      const folders: string[] = [];
      for (const child of folder.children) {
        if ('children' in child) {
          folders.push(child.path);
        } else {
          files.push(child.path);
        }
      }
      return { files, folders };
    },
  };

  private ensureFolder(path: string): MockFolder {
    const normalized = path.replace(/^\/+/, '').replace(/\/$/, '');
    if (this.folders.has(normalized)) {
      return this.folders.get(normalized)!;
    }
    const parts = normalized.split('/').filter(Boolean);
    let cursor = '';
    let parent = this.root;
    for (const part of parts) {
      cursor = cursor ? `${cursor}/${part}` : part;
      let folder = this.folders.get(cursor);
      if (!folder) {
        folder = { name: part, path: cursor, children: [], parent };
        parent.children.push(folder);
        this.folders.set(cursor, folder);
      }
      parent = folder;
    }
    return parent;
  }
}

const EXPECTED_SCENARIO_STATUS: Record<string, ScenarioSimulationResult['status']> = {
  S01: 'covered',
  S02: 'covered',
  S03: 'covered',
  S04: 'covered',
  S05: 'covered',
  S06: 'covered',
  S07: 'blocked',
  S08: 'blocked',
  S09: 'blocked',
  S10: 'covered',
  S11: 'covered',
  S12: 'covered',
  S13: 'covered',
  S14: 'covered',
  S15: 'covered',
  S16: 'covered',
  S17: 'covered',
  S18: 'covered',
  S19: 'covered',
  S20: 'covered',
  S21: 'covered',
  S22: 'covered',
  S23: 'covered',
  S24: 'covered',
  S25: 'covered',
  S26: 'covered',
  S27: 'covered',
  S28: 'covered',
  S29: 'covered',
  S30: 'covered',
};

describe('Scenario E2E: vault -> scanner -> snapshot -> 30 simulations', () => {
  let vault: ScenarioVault;
  let snapshot: ProjectIndexSnapshot;

  beforeAll(async () => {
    vault = buildScenarioVault();
    const app = { vault } as unknown as App;
    snapshot = await new IndexBuilder(app, DEFAULT_SETTINGS).rebuild();
  });

  it('通过真实 IndexBuilder 端到端产出 30 个场景结果', () => {
    expect(snapshot.scenarioResults).toHaveLength(30);
    expect(snapshot.scenarioResults.map((result) => result.scenarioId)).toEqual(
      SCENARIO_CATALOG.map((scenario) => scenario.id),
    );
  });

  it.each(SCENARIO_CATALOG)('$id $title', (scenario) => {
    const result = snapshot.scenarioResults.find((item) => item.scenarioId === scenario.id);
    expect(result).toBeDefined();
    expect(result!.status).toBe(EXPECTED_SCENARIO_STATUS[scenario.id]);
    expect(result!.signal.length).toBeGreaterThan(0);
    expect(result!.action.length).toBeGreaterThan(0);
  });

  it('端到端快照包含场景依赖的健康、长任务、关系和 sidecar 数据', () => {
    expect(snapshot.overview.activeChangeCount).toBeGreaterThanOrEqual(90);
    expect(snapshot.overview.pendingAnalysisCount).toBeGreaterThanOrEqual(2);
    expect(snapshot.overview.archiveCandidateCount).toBeGreaterThanOrEqual(1);
    expect(snapshot.longTasks.length).toBeGreaterThanOrEqual(2);
    expect(snapshot.reviewRecords).toHaveLength(1);
    expect(snapshot.documents.some((doc) => doc.kind === 'superpowers-spec')).toBe(true);
    expect(snapshot.documents.some((doc) => doc.kind === 'weekly-plan')).toBe(true);
    expect(snapshot.documents.some((doc) => doc.kind === 'lavish-metadata')).toBe(true);
    expect(snapshot.relationships.some((edge) => edge.kind === 'change-spec')).toBe(true);
    expect(snapshot.healthIssues.map((issue) => issue.id)).toEqual(
      expect.arrayContaining([
        'missing-project:missing-project-change',
        'invalid-project:openspec/changes/invalid-project-change/proposal.md',
        'invalid-change-slug:bad_中文',
        'missing-tasks:no-tasks-change',
        'missing-spec-delta:no-spec-change',
        'stale-index:_meta/openspec-control-tower/openspec-index.json',
      ]),
    );
  });

  it('端到端快照可以生成上下文包和 hash 保护写入预览', () => {
    const contextPackage = createContextPackage(snapshot, {
      projectSlug: 'proj-a',
      changeSlug: 'big-change',
    });
    expect(contextPackage.sourcePaths).toEqual(
      expect.arrayContaining([
        '_projects/proj-a.md',
        'openspec/changes/big-change/proposal.md',
        'openspec/changes/big-change/tasks.md',
        'openspec/changes/big-change/specs/demo/spec.md',
      ]),
    );
    expect(contextPackage.prompt).toContain('不直接编辑 openspec/specs/**');

    const manifest = vault.files.get('_projects/proj-a.md')!.text;
    const preview = createPendingAnalysisPreview({
      manifestPath: '_projects/proj-a.md',
      manifestText: manifest,
      slug: 'proj-a',
      now: '2026-07-03T00:00:00.000Z',
    });
    expect(applyPreviewToText(preview, manifest)).toContain('pending-analysis: true');
    expect(() => applyPreviewToText(preview, `${manifest}\nchanged`)).toThrow('目标文件已变化');
  });
});

function buildScenarioVault(): ScenarioVault {
  const vault = new ScenarioVault();
  addProjects(vault);
  addSpecialChanges(vault);
  addBulkChanges(vault, 90);
  addAuxiliaryDocuments(vault);
  return vault;
}

function addProjects(vault: ScenarioVault): void {
  vault.addFile(
    '_projects/proj-a.md',
    `---
type: project
slug: proj-a
title: 项目 A
status: active
phase: implementing
pending-analysis: true
vision: 管理多个长任务
goals:
  - G1: 建立控制塔
generated-changes:
${Array.from({ length: 10 }, (_, i) => `  - generated-${i}`).join('\n')}
scope:
  - standards-governance
---
# 项目 A
`,
  );
  vault.addFile(
    '_projects/proj-b.md',
    `---
type: project
slug: proj-b
title: 项目 B
status: active
phase: brainstorming
pending-analysis: true
vision: 只有一句愿景的架构规划入口
---
# 项目 B
`,
  );
}

function addSpecialChanges(vault: ScenarioVault): void {
  addChange(vault, 'big-change', {
    project: 'proj-a',
    tasks: tasks(100),
    spec: true,
    design: true,
    evidence: true,
  });
  addChange(vault, 'blocked-change', {
    project: 'proj-a',
    related: ['[[missing-blocker]]'],
    tasks: tasks(3),
    spec: true,
  });
  addChange(vault, 'missing-project-change', {
    tasks: tasks(2),
    spec: true,
  });
  addChange(vault, 'invalid-project-change', {
    project: 'missing-proj',
    tasks: tasks(2),
    spec: true,
  });
  addChange(vault, 'bad_中文', {
    project: 'proj-a',
    tasks: tasks(2),
    spec: true,
  });
  addChange(vault, 'no-tasks-change', {
    project: 'proj-a',
    spec: true,
  });
  addChange(vault, 'no-spec-change', {
    project: 'proj-a',
    tasks: tasks(2),
  });
  addChange(vault, 'complete-change', {
    project: 'proj-a',
    tasks: tasks(3, 3),
    spec: true,
  });
}

function addBulkChanges(vault: ScenarioVault, count: number): void {
  for (let i = 0; i < count; i += 1) {
    addChange(vault, `bulk-${i}`, {
      project: 'proj-a',
      tasks: tasks(1),
      spec: true,
    });
  }
}

function addAuxiliaryDocuments(vault: ScenarioVault): void {
  vault.addFile('docs/superpowers/specs/2026-07-03-control-tower-design.md', '# 控制塔设计\n');
  vault.addFile('docs/superpowers/plans/2026-07-03-control-tower-plan.md', '# 控制塔计划\n');
  vault.addFile('06-standards/工作计划/2026/2026-W27-7月第一周/README.md', '# 周计划\n');
  vault.addFile('_meta/openspec-control-tower/project-to-changes-prompt.md', '# 拆解 prompt\n');
  vault.addFile(
    '_meta/openspec-control-tower/openspec-index.json',
    JSON.stringify({
      generatedAt: '2020-01-01T00:00:00.000Z',
      vaultRoot: '/Users/danwei/Documents/HIC',
    }),
  );
  vault.addFile(
    '_meta/openspec-control-tower/reviews/review-1.json',
    JSON.stringify({
      id: 'review-1',
      kind: 'annotation',
      sourcePath: 'openspec/changes/big-change/design.md',
      sourceHash: 'fnv1a-old',
      excerpt: 'Architecture',
      body: '需要补架构风险',
      author: 'human',
      status: 'queued',
      createdAt: '2026-07-03T00:00:00.000Z',
      updatedAt: '2026-07-03T00:00:00.000Z',
      projectSlug: 'proj-a',
      changeSlug: 'big-change',
    }),
  );
  vault.addFile('.lavish/session.json', JSON.stringify({ artifact: 'local-only' }));
}

function addChange(
  vault: ScenarioVault,
  slug: string,
  options: {
    project?: string;
    related?: string[];
    tasks?: string;
    spec?: boolean;
    design?: boolean;
    evidence?: boolean;
  },
): void {
  const frontmatter = [
    '---',
    'status: draft',
    options.project ? `project: ${options.project}` : undefined,
    options.related && options.related.length > 0
      ? ['related:', ...options.related.map((item) => `  - "${item}"`)].join('\n')
      : undefined,
    '---',
  ]
    .filter((line): line is string => typeof line === 'string')
    .join('\n');
  vault.addFile(`openspec/changes/${slug}/proposal.md`, `${frontmatter}\n# ${slug}\n`);
  if (options.tasks) {
    vault.addFile(`openspec/changes/${slug}/tasks.md`, options.tasks);
  }
  if (options.design) {
    vault.addFile(`openspec/changes/${slug}/design.md`, `# Design\nArchitecture for ${slug}\n`);
  }
  if (options.spec) {
    vault.addFile(
      `openspec/changes/${slug}/specs/demo/spec.md`,
      `## ADDED Requirements\n\n### Requirement: ${slug}\n\n#### Scenario: main\n- **WHEN** used\n- **THEN** works\n`,
    );
  }
  if (options.evidence) {
    vault.addFile(`openspec/changes/${slug}/notes/acceptance/check.md`, '# Evidence\n');
  }
}

function tasks(total: number, done = 0): string {
  return [
    '# Tasks',
    '',
    '## 1. Work',
    ...Array.from({ length: total }, (_, index) =>
      `- [${index < done ? 'x' : ' '}] ${index + 1}. scenario task ${index + 1}`,
    ),
    '',
  ].join('\n');
}
