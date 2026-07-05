import { createAssignmentBoardViewModel } from '../src/view/AssignmentBoardViewModel';
import type { AIAssignment, AssignmentStatus } from '../src/types';

function assignment(id: string, status: AssignmentStatus): AIAssignment {
  return {
    schemaVersion: 1,
    id,
    title: `Assignment ${id}`,
    targetKind: 'change',
    targetRef: 'ai-workbench-loop',
    taskRefs: [
      { section: 'T9', text: '展示 AI assignment 队列' },
      { section: 'T9', text: '提供手动命令' },
    ],
    goal: 'Render assignment board',
    allowPaths: ['openspec/changes/ai-workbench-loop'],
    denyPaths: ['openspec/specs/'],
    readContext: ['openspec/changes/ai-workbench-loop/proposal.md'],
    excludeReasons: [],
    verifyCommands: ['npm test -- tests/AssignmentBoardViewModel.spec.ts --runInBand'],
    expectedOutput: 'Board row',
    writeBackTo: `_meta/openspec-control-tower/evidence/${id}.json`,
    resultPath: `_meta/openspec-control-tower/ai-results/${id}.json`,
    triggerCommand: `codex --assignment _meta/openspec-control-tower/ai-assignments/${id}.json`,
    workspaceRisk: status === 'running' ? 'dirty-worktree-warning: README.md' : 'clean-or-unchecked',
    lock: null,
    status,
    createdAt: '2026-07-05T00:00:00.000Z',
    updatedAt: status === 'returned' ? '2026-07-05T00:05:00.000Z' : '2026-07-05T00:00:00.000Z',
  };
}

describe('AssignmentBoardViewModel', () => {
  it('summarizes assignments into stable board rows and status counts', () => {
    const model = createAssignmentBoardViewModel([
      assignment('assignment-3', 'returned'),
      assignment('assignment-1', 'draft'),
      assignment('assignment-2', 'running'),
    ]);

    expect(model.total).toBe(3);
    expect(model.byStatus).toEqual({ draft: 1, locked: 0, running: 1, returned: 1, closed: 0 });
    expect(model.rows.map((row) => row.id)).toEqual(['assignment-2', 'assignment-1', 'assignment-3']);
    expect(model.rows[0]).toMatchObject({
      id: 'assignment-2',
      status: 'running',
      taskSummary: 'T9: 展示 AI assignment 队列 / T9: 提供手动命令',
      command: 'codex --assignment _meta/openspec-control-tower/ai-assignments/assignment-2.json',
      canRunManually: true,
      canScanResult: true,
    });
  });
});
