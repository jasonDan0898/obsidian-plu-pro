import { buildAIAssignment } from '../src/core/AssignmentBuilder';
import { DEFAULT_SETTINGS, type ChangeEntry, type TaskItem } from '../src/types';

const now = '2026-07-05T00:00:00.000Z';
const root = DEFAULT_SETTINGS.controlTowerMetaPath;

function changeEntry(): ChangeEntry {
  return {
    slug: 'ai-workbench-loop',
    proposalPath: 'openspec/changes/ai-workbench-loop/proposal.md',
    tasksPath: 'openspec/changes/ai-workbench-loop/tasks.md',
    designPath: 'openspec/changes/ai-workbench-loop/design.md',
    specDeltaPaths: ['openspec/changes/ai-workbench-loop/specs/workbench/spec.md'],
    evidencePaths: ['openspec/changes/ai-workbench-loop/evidence/previous.md'],
    sourcePaths: [
      'openspec/changes/ai-workbench-loop/proposal.md',
      'openspec/changes/ai-workbench-loop/tasks.md',
      '.env',
      'node_modules/pkg/index.js',
      'dist/bundle.js',
      'package-lock.json',
      'docs/large-context.md',
    ],
    frontmatter: { project: 'knowledge-control-tower' },
    taskProgress: {
      totalDone: 1,
      totalCount: 3,
      groups: [{ heading: 'T4', done: 1, total: 3 }],
    },
    blockers: [],
  };
}

const tasks: TaskItem[] = [
  { line: 1, heading: 'T4. Assignment Builder', text: '打包任务上下文', done: false },
  { line: 2, heading: 'T4. Assignment Builder', text: '已完成项', done: true },
  { line: 3, heading: 'T5. Write Preview', text: '补写回编排', done: false },
];

describe('AssignmentBuilder', () => {
  it('builds a full manual-run AI assignment from ChangeEntry plus existing TaskItem records', () => {
    const assignment = buildAIAssignment({
      change: changeEntry(),
      tasks,
      controlTowerMetaPath: root,
      now,
      verifyCommands: ['npm test -- tests/AssignmentBuilder.spec.ts --runInBand'],
      pathByteSizes: { 'docs/large-context.md': 2_000_000 },
      workspaceDirty: true,
    });

    expect(assignment.id).toMatch(/^ai-workbench-loop-/);
    expect(assignment.status).toBe('draft');
    expect(assignment.targetKind).toBe('change');
    expect(assignment.targetRef).toBe('ai-workbench-loop');
    expect(assignment.taskRefs).toEqual([
      { section: 'T4. Assignment Builder', text: '打包任务上下文' },
      { section: 'T5. Write Preview', text: '补写回编排' },
    ]);
    expect(assignment.readContext).toEqual([
      'openspec/changes/ai-workbench-loop/proposal.md',
      'openspec/changes/ai-workbench-loop/tasks.md',
      'openspec/changes/ai-workbench-loop/design.md',
      'openspec/changes/ai-workbench-loop/specs/workbench/spec.md',
      'openspec/changes/ai-workbench-loop/evidence/previous.md',
    ]);
    expect(assignment.excludeReasons).toEqual(
      expect.arrayContaining([
        { path: '.env', reason: '环境变量文件' },
        { path: 'node_modules/pkg/index.js', reason: '依赖目录' },
        { path: 'dist/bundle.js', reason: '生成产物目录' },
        { path: 'package-lock.json', reason: '锁文件' },
        { path: 'docs/large-context.md', reason: '超过上下文大小限制' },
      ]),
    );
    expect(assignment.allowPaths).toEqual([
      'openspec/changes/ai-workbench-loop',
      `${root}/ai-results/${assignment.id}.json`,
    ]);
    expect(assignment.denyPaths).toEqual(expect.arrayContaining(['openspec/specs/', '.env', 'node_modules/', 'dist/']));
    expect(assignment.resultPath).toBe(`${root}/ai-results/${assignment.id}.json`);
    expect(assignment.writeBackTo).toBe(`${root}/evidence/${assignment.id}.json`);
    expect(assignment.triggerCommand).toContain(`${root}/ai-assignments/${assignment.id}.json`);
    expect(assignment.triggerCommand).not.toContain('child_process');
    expect(assignment.workspaceRisk).toContain('dirty');
  });
});
