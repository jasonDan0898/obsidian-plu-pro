import type { App } from 'obsidian';
import { Vault } from 'obsidian';
import { AssignmentScanner } from '../src/core/AssignmentScanner';
import { AssignmentStore } from '../src/core/AssignmentStore';
import type { AIAssignment, AIResult, AssignmentLock } from '../src/types';
import { DEFAULT_SETTINGS } from '../src/types';

const root = DEFAULT_SETTINGS.controlTowerMetaPath;

function createApp(): App {
  return { vault: new Vault() } as unknown as App;
}

function assignment(): AIAssignment {
  const lock: AssignmentLock = {
    assignmentId: 'assignment-1',
    owner: 'codex',
    paths: ['openspec/changes/ai-workbench-loop'],
    lockedAt: '2026-07-05T00:00:00.000Z',
  };
  return {
    schemaVersion: 1,
    id: 'assignment-1',
    title: 'AI assignment',
    targetKind: 'change',
    targetRef: 'ai-workbench-loop',
    taskRefs: [{ section: 'T8', text: '扫描 AI 结果' }],
    goal: 'Scan result JSON',
    allowPaths: ['openspec/changes/ai-workbench-loop', `${root}/ai-results/assignment-1.json`],
    denyPaths: ['openspec/specs/'],
    readContext: ['openspec/changes/ai-workbench-loop/proposal.md'],
    excludeReasons: [],
    verifyCommands: ['npm test -- tests/AssignmentScanner.spec.ts --runInBand'],
    expectedOutput: 'Evidence JSON',
    writeBackTo: `${root}/evidence/assignment-1.json`,
    resultPath: `${root}/ai-results/assignment-1.json`,
    triggerCommand: `codex --assignment ${root}/ai-assignments/assignment-1.json`,
    workspaceRisk: 'clean-or-unchecked',
    lock,
    status: 'running',
    createdAt: '2026-07-05T00:00:00.000Z',
    updatedAt: '2026-07-05T00:00:00.000Z',
  };
}

describe('AssignmentScanner', () => {
  it('turns ai-results input into an evidence sidecar and marks the assignment returned', async () => {
    const app = createApp();
    const store = new AssignmentStore(app, root);
    await store.writeAssignment(assignment());
    await store.writeLocks([
      {
        assignmentId: 'assignment-1',
        owner: 'codex',
        paths: ['openspec/changes/ai-workbench-loop'],
        lockedAt: '2026-07-05T00:00:00.000Z',
      },
    ]);
    const result: AIResult = {
      assignmentId: 'assignment-1',
      status: 'returned',
      command: 'npm test -- tests/AssignmentScanner.spec.ts --runInBand',
      exitCode: 0,
      outputSummary: '1 test passed',
      diffSummary: 'added scanner',
      testResults: 'PASS',
      unverified: [],
      deviations: '',
    };
    await store.writeResult(result);

    const summary = await new AssignmentScanner(store, { now: '2026-07-05T00:05:00.000Z' }).scanResults();

    expect(summary.scanned).toEqual(['assignment-1']);
    expect(summary.evidencePaths).toEqual([`${root}/evidence/assignment-1.json`]);
    expect(await store.readEvidence('assignment-1')).toEqual({
      schemaVersion: 1,
      id: 'assignment-1',
      assignmentId: 'assignment-1',
      command: result.command,
      exitCode: 0,
      outputSummary: '1 test passed',
      diffSummary: 'added scanner',
      testResults: 'PASS',
      unverified: [],
      deviations: '',
      recordedAt: '2026-07-05T00:05:00.000Z',
    });
    expect((await store.readAssignment('assignment-1'))?.status).toBe('returned');
    expect((await store.readAssignment('assignment-1'))?.lock?.releasedAt).toBe('2026-07-05T00:05:00.000Z');
    expect((await store.readLocks())[0].releasedAt).toBe('2026-07-05T00:05:00.000Z');
  });

  it('skips assignments with missing or damaged ai-results JSON', async () => {
    const app = createApp();
    const store = new AssignmentStore(app, root);
    await store.writeAssignment(assignment());
    await app.vault.adapter.write(`${root}/ai-results/assignment-1.json`, '{bad json');

    const summary = await new AssignmentScanner(store).scanResults();

    expect(summary.scanned).toEqual([]);
    expect(summary.skipped).toEqual(['assignment-1']);
    expect(await store.readEvidence('assignment-1')).toBeNull();
  });
});
