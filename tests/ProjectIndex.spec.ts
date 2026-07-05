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
    expect(idx.slugConflicts).toEqual([]);
  });

  it('同 slug 多 manifest 记入 slugConflicts,保留先扫描的', () => {
    const first: ProjectManifest = {
      slug: 'proj-a',
      title: '先扫到',
      status: 'active',
      manifestPath: '_projects/first.md',
    };
    const second: ProjectManifest = {
      slug: 'proj-a',
      title: '后扫到',
      status: 'active',
      manifestPath: '_projects/second.md',
    };
    const idx = buildIndex({ manifests: [first, second], changes: [] });

    expect(idx.slugConflicts).toHaveLength(1);
    expect(idx.slugConflicts[0].slug).toBe('proj-a');
    expect(idx.slugConflicts[0].manifestPaths).toEqual([
      '_projects/first.md',
      '_projects/second.md',
    ]);
    // 先扫到的保留为 active project
    const entry = idx.projects.get('proj-a')!;
    expect(entry.manifest.title).toBe('先扫到');
  });

  it('用 generated-changes 反向挂载未声明 project 的 change', () => {
    const idx = buildIndex({
      manifests: [{ ...manifest('proj-a'), generatedChanges: ['c1'] }],
      changes: [change('c1', {}, 0, 2)],
    });
    expect(idx.unassigned).toHaveLength(0);
    const entry = idx.projects.get('proj-a')!;
    expect(entry.changes.map((c) => c.slug)).toEqual(['c1']);
    expect(entry.changes[0].linkSources).toEqual(['generated-changes']);
  });

  it('生成 OpenSpec health issues 和 overview 指标', () => {
    const idx = buildIndex({
      manifests: [manifest('proj-a')],
      changes: [
        {
          ...change('bad_slug', { project: 'missing-proj' }, 0, 0),
          hasTasks: false,
          hasSpecDelta: false,
          isValidSlug: false,
        },
      ],
      documents: [
        {
          id: 'doc:stale',
          kind: 'sidecar',
          path: '_meta/openspec-control-tower/openspec-index.json',
          source: 'derived',
          metadata: { staleReasons: ['vaultRoot=/Users/danwei/Documents/HIC'] },
        },
      ],
    });

    expect(idx.healthIssues.map((issue) => issue.id)).toEqual(
      expect.arrayContaining([
        'invalid-project:openspec/changes/bad_slug/proposal.md',
        'invalid-change-slug:bad_slug',
        'missing-tasks:bad_slug',
        'missing-spec-delta:bad_slug',
        'stale-index:_meta/openspec-control-tower/openspec-index.json',
      ]),
    );
    expect(idx.overview.metadataWarningCount).toBeGreaterThanOrEqual(5);
  });
});
