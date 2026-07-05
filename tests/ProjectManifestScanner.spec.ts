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

  it('提取 pendingAnalysis / generatedChanges / lastAnalyzed 字段', () => {
    const text = `---
type: project
slug: demo-proj
title: Demo
status: active
pending-analysis: true
last-analyzed: 2026-05-18T10:30:00Z
generated-changes:
  - establish-x
  - migrate-y
---

# Body
`;
    const m = parseManifestFromText(text, '_projects/demo-proj.md')!;
    expect(m.pendingAnalysis).toBe(true);
    expect(m.generatedChanges).toEqual(['establish-x', 'migrate-y']);
    // YAML 的 ISO timestamp 被 js-yaml 解析为 Date,scanner 统一转 .toISOString()(带毫秒)
    expect(m.lastAnalyzed).toBe('2026-05-18T10:30:00.000Z');
  });

  it('提取架构规划相关字段', () => {
    const text = `---
type: project
slug: arch-proj
title: 架构项目
status: active
phase: brainstorming
vision: 把多长任务统一管理起来
goals:
  - G1: 建立控制塔
success-criteria:
  - 可看到长任务
non-goals:
  - 不做远程发布
risks:
  - 状态漂移
superpowers-specs:
  - docs/superpowers/specs/x.md
superpowers-plans:
  - docs/superpowers/plans/x.md
deviation-flags:
  blockers-new: 2
---
`;
    const m = parseManifestFromText(text, '_projects/arch-proj.md')!;
    expect(m.phase).toBe('brainstorming');
    expect(m.vision).toBe('把多长任务统一管理起来');
    expect(m.goals).toEqual(['G1: 建立控制塔']);
    expect(m.successCriteria).toEqual(['可看到长任务']);
    expect(m.nonGoals).toEqual(['不做远程发布']);
    expect(m.risks).toEqual(['状态漂移']);
    expect(m.superpowersSpecs).toEqual(['docs/superpowers/specs/x.md']);
    expect(m.superpowersPlans).toEqual(['docs/superpowers/plans/x.md']);
    expect(m.deviationFlags).toEqual({ 'blockers-new': 2 });
  });

  it('pending-analysis 缺失默认为 false', () => {
    const text = `---
type: project
slug: demo-proj
title: Demo
status: active
---
`;
    const m = parseManifestFromText(text, '_projects/demo-proj.md')!;
    expect(m.pendingAnalysis).toBe(false);
    expect(m.generatedChanges).toBeUndefined();
    expect(m.lastAnalyzed).toBeUndefined();
  });

  it('提取 system: HIC 字段', () => {
    const text = `---
type: project
slug: demo-proj
title: Demo
status: active
system: HIC
---
`;
    const m = parseManifestFromText(text, '_projects/demo-proj.md')!;
    expect(m.system).toBe('HIC');
  });

  it('提取 system: EVS 字段', () => {
    const text = `---
type: project
slug: demo-proj
title: Demo
status: active
system: EVS
---
`;
    const m = parseManifestFromText(text, '_projects/demo-proj.md')!;
    expect(m.system).toBe('EVS');
  });

  it('非法 system 值回退为 undefined', () => {
    const text = `---
type: project
slug: demo-proj
title: Demo
status: active
system: legacy
---
`;
    const m = parseManifestFromText(text, '_projects/demo-proj.md')!;
    expect(m.system).toBeUndefined();
  });

  it('缺 system 字段为 undefined', () => {
    const text = `---
type: project
slug: demo-proj
title: Demo
status: active
---
`;
    const m = parseManifestFromText(text, '_projects/demo-proj.md')!;
    expect(m.system).toBeUndefined();
  });
});
