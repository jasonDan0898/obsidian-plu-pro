import {
  applyPreviewToText,
  createFrontmatterPreview,
  createPendingAnalysisPreview,
  isBlockedWriteTarget,
} from '../src/core/WritePreview';

describe('WritePreview', () => {
  it('生成 frontmatter diff 并按 hash 应用', () => {
    const before = `---
type: project
slug: demo
title: Demo
---
body
`;
    const preview = createPendingAnalysisPreview({
      manifestPath: '_projects/demo.md',
      manifestText: before,
      slug: 'demo',
      now: '2026-07-03T00:00:00.000Z',
    });

    expect(preview.diff).toContain('pending-analysis');
    const applied = applyPreviewToText(preview, before);
    expect(applied).toContain('pending-analysis: true');
  });

  it('预览后文件变化时拒绝 apply', () => {
    const preview = createFrontmatterPreview({
      targetPath: 'openspec/changes/demo/proposal.md',
      beforeText: 'body\n',
      patch: { project: 'demo' },
      operation: 'set-frontmatter',
      now: '2026-07-03T00:00:00.000Z',
    });

    expect(() => applyPreviewToText(preview, 'changed\n')).toThrow('目标文件已变化');
  });

  it('阻断 specs 和 archive 写入目标', () => {
    expect(isBlockedWriteTarget('openspec/specs/demo/spec.md')).toBe(true);
    expect(isBlockedWriteTarget('openspec/changes/archive/2026-demo/proposal.md')).toBe(true);
    expect(() =>
      createFrontmatterPreview({
        targetPath: 'openspec/specs/demo/spec.md',
        beforeText: 'body',
        patch: { x: 1 },
        operation: 'set-frontmatter',
      }),
    ).toThrow('受控写入禁止目标');
  });
});
