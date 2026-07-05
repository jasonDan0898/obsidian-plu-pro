import type { AIAssignment, AssignmentLock, Evidence } from '../src/types';
import { DEFAULT_SETTINGS } from '../src/types';

describe('control tower AI collaboration types', () => {
  it('defines assignment, evidence, and lock models on the existing sidecar root setting', () => {
    const lock: AssignmentLock = {
      assignmentId: 'assign-1',
      paths: ['openspec/changes/demo'],
      owner: 'codex',
      lockedAt: '2026-07-05T00:00:00.000Z',
    };

    const assignment: AIAssignment = {
      schemaVersion: 1,
      id: 'assign-1',
      title: 'Implement demo change',
      targetKind: 'change',
      targetRef: 'demo-change',
      taskRefs: [{ section: '1. Build', text: 'write tests' }],
      goal: 'Finish the demo change using TDD',
      allowPaths: ['openspec/changes/demo-change'],
      denyPaths: ['openspec/specs/demo/spec.md'],
      readContext: ['openspec/changes/demo-change/proposal.md'],
      excludeReasons: [{ path: '.env', reason: '环境变量文件' }],
      verifyCommands: ['npm test -- tests/demo.spec.ts'],
      expectedOutput: 'Tests pass and evidence is written',
      writeBackTo: '_meta/openspec-control-tower/evidence/assign-1.json',
      resultPath: '_meta/openspec-control-tower/ai-results/assign-1.json',
      triggerCommand: 'codex --assignment _meta/openspec-control-tower/ai-assignments/assign-1.json',
      workspaceRisk: 'dirty files: 1 related',
      lock,
      status: 'draft',
      createdAt: '2026-07-05T00:00:00.000Z',
      updatedAt: '2026-07-05T00:00:00.000Z',
    };

    const evidence: Evidence = {
      schemaVersion: 1,
      id: 'evidence-1',
      assignmentId: assignment.id,
      command: 'npm test -- tests/demo.spec.ts',
      exitCode: 0,
      outputSummary: '1 test passed',
      diffSummary: 'src/demo.ts changed',
      testResults: 'PASS tests/demo.spec.ts',
      unverified: [],
      deviations: '',
      recordedAt: '2026-07-05T00:05:00.000Z',
    };

    expect(assignment.lock).toBe(lock);
    expect(evidence.assignmentId).toBe(assignment.id);
    expect(DEFAULT_SETTINGS.controlTowerMetaPath).toBe('_meta/openspec-control-tower');
  });
});
