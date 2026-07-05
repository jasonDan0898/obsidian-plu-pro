import { buildIndex } from '../src/core/ProjectIndex';
import { SCENARIO_CATALOG } from '../src/core/ScenarioCatalog';
import type { ChangeEntry, ProjectManifest } from '../src/types';

const project = (slug: string): ProjectManifest => ({
  slug,
  title: slug,
  status: 'active',
  manifestPath: `_projects/${slug}.md`,
  pendingAnalysis: true,
});

const change = (slug: string, total: number): ChangeEntry => ({
  slug,
  proposalPath: `openspec/changes/${slug}/proposal.md`,
  frontmatter: { project: 'proj-a' },
  taskProgress: {
    totalDone: 0,
    totalCount: total,
    groups: [{ heading: 'Tasks', done: 0, total }],
    items: total > 0 ? [{ line: 1, heading: 'Tasks', text: 'first task', done: false }] : [],
    nextOpenTask: total > 0 ? { line: 1, heading: 'Tasks', text: 'first task', done: false } : undefined,
  },
  blockers: [],
  hasTasks: true,
  hasSpecDelta: true,
  isValidSlug: true,
});

describe('ScenarioCatalog', () => {
  it('固定提供 30 个日常工作场景', () => {
    expect(SCENARIO_CATALOG).toHaveLength(30);
    expect(new Set(SCENARIO_CATALOG.map((s) => s.id)).size).toBe(30);
  });

  it('基于快照输出 30 条模拟结果并识别长任务', () => {
    const idx = buildIndex({
      manifests: [{ ...project('proj-a'), generatedChanges: Array.from({ length: 10 }, (_, i) => `c-${i}`) }],
      changes: [change('big-change', 100)],
    });

    expect(idx.scenarioResults).toHaveLength(30);
    expect(idx.longTasks.length).toBeGreaterThan(0);
    expect(idx.scenarioResults.find((s) => s.scenarioId === 'S03')?.status).toBe('covered');
    expect(idx.scenarioResults.find((s) => s.scenarioId === 'S04')?.status).toBe('covered');
    expect(idx.scenarioResults.find((s) => s.scenarioId === 'S28')?.status).toBe('covered');
  });
});
