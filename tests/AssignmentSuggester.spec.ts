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

  it('enableCapabilityFallback=false 时跳过 capability 信号', () => {
    const target = change('orphan-change', { capability: 'hic-kernel-audit' });
    const projects = [projectEntry('proj-a', ['hic-kernel-audit'], [])];
    const candidates = suggestProjects(target, projects, { enableCapabilityFallback: false });
    expect(candidates).toEqual([]);
  });
});
