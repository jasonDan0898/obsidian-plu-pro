import { AssignmentRunner } from '../src/core/AssignmentRunner';
import type { AIAssignment } from '../src/types';

function assignment(): AIAssignment {
  return {
    schemaVersion: 1,
    id: 'assignment-1',
    title: 'AI assignment',
    targetKind: 'change',
    targetRef: 'ai-workbench-loop',
    taskRefs: [{ section: 'T7', text: '生成手动触发命令' }],
    goal: 'Build the manual command',
    allowPaths: ['openspec/changes/ai-workbench-loop'],
    denyPaths: ['openspec/specs/'],
    readContext: ['openspec/changes/ai-workbench-loop/proposal.md'],
    excludeReasons: [],
    verifyCommands: ['npm test -- tests/AssignmentRunner.spec.ts --runInBand'],
    expectedOutput: 'ai-results JSON',
    writeBackTo: '_meta/openspec-control-tower/evidence/assignment-1.json',
    resultPath: '_meta/openspec-control-tower/ai-results/assignment-1.json',
    triggerCommand: 'codex --assignment _meta/openspec-control-tower/ai-assignments/assignment-1.json',
    workspaceRisk: 'clean-or-unchecked',
    lock: null,
    status: 'draft',
    createdAt: '2026-07-05T00:00:00.000Z',
    updatedAt: '2026-07-05T00:00:00.000Z',
  };
}

describe('AssignmentRunner', () => {
  it('prepares a manual command without executing child_process', () => {
    const plan = new AssignmentRunner().prepareManualRun(assignment());

    expect(plan.mode).toBe('manual');
    expect(plan.command).toBe('codex --assignment _meta/openspec-control-tower/ai-assignments/assignment-1.json');
    expect(plan.instructions).toContain('手动运行上面的命令');
    expect(plan.command).not.toContain('child_process');
  });
});
