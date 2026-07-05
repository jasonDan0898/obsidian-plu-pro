import { createArchitectureDecision, createReviewRecord, withStaleReviewFlag } from '../src/core/SidecarStore';

describe('SidecarStore pure helpers', () => {
  it('创建 review record 时记录 source hash 和状态', () => {
    const record = createReviewRecord({
      sourcePath: 'openspec/changes/demo/design.md',
      sourceText: '# Design\n',
      body: '这里需要补架构风险',
      excerpt: 'Design',
      author: 'human',
      now: '2026-07-03T00:00:00.000Z',
    });

    expect(record.id).toMatch(/^review-/);
    expect(record.sourceHash).toMatch(/^fnv1a-/);
    expect(record.status).toBe('open');
    expect(record.excerpt).toBe('Design');
  });

  it('源文档 hash 变化后标记 stale', () => {
    const record = createReviewRecord({
      sourcePath: 'openspec/changes/demo/design.md',
      sourceText: 'old',
      body: '批注',
      author: 'human',
      now: '2026-07-03T00:00:00.000Z',
    });

    expect(withStaleReviewFlag(record, 'old').stale).toBe(false);
    expect(withStaleReviewFlag(record, 'new').stale).toBe(true);
  });

  it('创建架构决策 sidecar', () => {
    const decision = createArchitectureDecision({
      title: '控制塔作为主入口',
      context: 'Lavish 需要收敛',
      decision: 'Obsidian 插件承载主体验',
      consequences: ['HTML 只作为派生产物'],
      now: '2026-07-03T00:00:00.000Z',
    });

    expect(decision.id).toMatch(/^adr-/);
    expect(decision.status).toBe('proposed');
    expect(decision.consequences).toEqual(['HTML 只作为派生产物']);
  });
});
