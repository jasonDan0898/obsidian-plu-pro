import type { App } from 'obsidian';
import { Vault } from 'obsidian';
import { AssignmentStore } from '../src/core/AssignmentStore';
import type { AIAssignment, AIResult, Evidence } from '../src/types';
import { DEFAULT_SETTINGS } from '../src/types';

const root = DEFAULT_SETTINGS.controlTowerMetaPath;

function createApp(): App {
  return { vault: new Vault() } as unknown as App;
}

function assignment(id = 'assign-1'): AIAssignment {
  return {
    schemaVersion: 1,
    id,
    title: `Assignment ${id}`,
    targetKind: 'change',
    targetRef: 'demo-change',
    taskRefs: [{ section: '1. Work', text: 'write tests' }],
    goal: 'Implement the demo change',
    allowPaths: ['openspec/changes/demo-change'],
    denyPaths: ['openspec/specs/demo/spec.md'],
    readContext: ['openspec/changes/demo-change/proposal.md'],
    excludeReasons: [{ path: '.env', reason: '环境变量文件' }],
    verifyCommands: ['npm test -- tests/demo.spec.ts'],
    expectedOutput: 'Tests pass',
    writeBackTo: `${root}/evidence/${id}.json`,
    resultPath: `${root}/ai-results/${id}.json`,
    triggerCommand: `codex --assignment ${root}/ai-assignments/${id}.json`,
    workspaceRisk: 'none',
    lock: null,
    status: 'draft',
    createdAt: '2026-07-05T00:00:00.000Z',
    updatedAt: '2026-07-05T00:00:00.000Z',
  };
}

describe('AssignmentStore', () => {
  it('round-trips assignments and lists them from the configured sidecar root', async () => {
    const app = createApp();
    const store = new AssignmentStore(app, root);
    const first = assignment('assign-1');
    const second = assignment('assign-2');

    await store.writeAssignment(first);
    await store.writeAssignment(second);

    expect(await store.readAssignment(first.id)).toEqual(first);
    expect((await store.listAssignments()).map((item) => item.id)).toEqual(['assign-1', 'assign-2']);
  });

  it('reads AI result JSON and converts evidence sidecars without throwing on damaged JSON', async () => {
    const app = createApp();
    const store = new AssignmentStore(app, root);
    const result: AIResult = {
      assignmentId: 'assign-1',
      status: 'returned',
      command: 'npm test',
      exitCode: 0,
      outputSummary: '98 tests passed',
      diffSummary: 'core files changed',
      testResults: 'PASS',
      unverified: [],
      deviations: '',
    };
    const evidence: Evidence = {
      schemaVersion: 1,
      id: 'evidence-1',
      assignmentId: 'assign-1',
      command: result.command,
      exitCode: result.exitCode,
      outputSummary: result.outputSummary,
      recordedAt: '2026-07-05T00:05:00.000Z',
    };

    await app.vault.adapter.write(`${root}/ai-results/assign-1.json`, JSON.stringify(result));
    await app.vault.adapter.write(`${root}/ai-results/broken.json`, '{bad json');
    await store.writeEvidence(evidence);

    expect(await store.readResult('assign-1')).toEqual(result);
    expect(await store.readResult('broken')).toBeNull();
    expect(await store.readEvidence('evidence-1')).toEqual(evidence);
  });
});
