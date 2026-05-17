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
