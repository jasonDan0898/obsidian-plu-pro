import { createContextPackage, exclusionReason } from '../src/core/ContextPackage';
import { buildIndex } from '../src/core/ProjectIndex';
import type { ChangeEntry, ProjectManifest, ReviewRecord } from '../src/types';

const manifest: ProjectManifest = {
  slug: 'proj-a',
  title: '项目 A',
  status: 'active',
  manifestPath: '_projects/proj-a.md',
};

const change: ChangeEntry = {
  slug: 'change-a',
  proposalPath: 'openspec/changes/change-a/proposal.md',
  frontmatter: { project: 'proj-a' },
  taskProgress: {
    totalDone: 0,
    totalCount: 1,
    groups: [{ heading: 'Tasks', done: 0, total: 1 }],
  },
  blockers: [],
  sourcePaths: [
    'openspec/changes/change-a/proposal.md',
    'openspec/changes/change-a/design.md',
    '_private/secret.md',
    '.lavish/demo.html',
  ],
  hasTasks: true,
  hasSpecDelta: true,
  isValidSlug: true,
};

const review: ReviewRecord = {
  id: 'review-1',
  kind: 'annotation',
  sourcePath: 'openspec/changes/change-a/design.md',
  sourceHash: 'fnv1a-demo',
  body: '需要补风险',
  author: 'human',
  status: 'queued',
  createdAt: '2026-07-03T00:00:00.000Z',
  updatedAt: '2026-07-03T00:00:00.000Z',
  projectSlug: 'proj-a',
  changeSlug: 'change-a',
};

describe('ContextPackage', () => {
  it('排除敏感和派生路径', () => {
    expect(exclusionReason('_private/secret.md')).toBe('私有目录');
    expect(exclusionReason('.lavish/demo.html')).toBe('Lavish HTML 是派生产物,不作为上下文源');
  });

  it('为选中 change 生成确定范围的上下文包', () => {
    const snapshot = buildIndex({ manifests: [manifest], changes: [change], reviewRecords: [review] });
    const pkg = createContextPackage(snapshot, { projectSlug: 'proj-a', changeSlug: 'change-a' });

    expect(pkg.sourcePaths).toEqual(
      expect.arrayContaining([
        '_projects/proj-a.md',
        'openspec/changes/change-a/proposal.md',
        'openspec/changes/change-a/design.md',
      ]),
    );
    expect(pkg.excludedPaths.map((item) => item.path)).toEqual(
      expect.arrayContaining(['_private/secret.md', '.lavish/demo.html']),
    );
    expect(pkg.prompt).toContain('不直接编辑 openspec/specs/**');
  });
});
