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
