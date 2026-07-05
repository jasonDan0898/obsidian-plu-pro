import type { App } from 'obsidian';
import { Vault } from 'obsidian';
import { buildAIAssignment } from '../src/core/AssignmentBuilder';
import { AssignmentRunner } from '../src/core/AssignmentRunner';
import { AssignmentScanner } from '../src/core/AssignmentScanner';
import { AssignmentStore } from '../src/core/AssignmentStore';
import { createFrontmatterPreview, applyPreviewToText } from '../src/core/WritePreview';
import type { AIResult, ChangeEntry, TaskItem } from '../src/types';
import { DEFAULT_SETTINGS } from '../src/types';

const root = DEFAULT_SETTINGS.controlTowerMetaPath;

function createApp(): App {
  return { vault: new Vault() } as unknown as App;
}

function changeEntry(): ChangeEntry {
  return {
    slug: 'ai-workbench-loop',
    proposalPath: 'openspec/changes/ai-workbench-loop/proposal.md',
    tasksPath: 'openspec/changes/ai-workbench-loop/tasks.md',
    designPath: 'openspec/changes/ai-workbench-loop/design.md',
    specDeltaPaths: ['openspec/changes/ai-workbench-loop/specs/workbench/spec.md'],
    evidencePaths: [],
    sourcePaths: [
      'openspec/changes/ai-workbench-loop/proposal.md',
      'openspec/changes/ai-workbench-loop/tasks.md',
      '.env',
      'dist/bundle.js',
      'docs/large-context.md',
    ],
    frontmatter: { project: 'knowledge-control-tower' },
    taskProgress: {
      totalDone: 0,
      totalCount: 1,
      groups: [{ heading: 'T10', done: 0, total: 1 }],
    },
    blockers: [],
  };
}

const tasks: TaskItem[] = [
  { line: 1, heading: 'T10. 场景夹具', text: '验证 AI 协作台闭环', done: false },
];

describe('Assignment flow E2E scenarios S20/S21/S22/S23/S24/S27', () => {
  it('covers context packaging, exclusions, preview safety, manual validate command, dirty risk, and evidence scanning', async () => {
    const app = createApp();
    const store = new AssignmentStore(app, root);
    const assignment = buildAIAssignment({
      change: changeEntry(),
      tasks,
      controlTowerMetaPath: root,
      now: '2026-07-05T00:00:00.000Z',
      verifyCommands: ['openspec validate ai-workbench-loop --strict --no-interactive'],
      pathByteSizes: { 'docs/large-context.md': 2_000_000 },
      workspaceDirty: true,
    });
    await store.writeAssignment(assignment);

    const manualRun = new AssignmentRunner().prepareManualRun(assignment);
    const beforeText = '---\nstatus: draft\n---\n# Demo\n';
    const preview = createFrontmatterPreview({
      targetPath: 'openspec/changes/ai-workbench-loop/proposal.md',
      beforeText,
      operation: 'set-frontmatter',
      patch: { status: 'queued' },
      now: '2026-07-05T00:01:00.000Z',
    });
    const result: AIResult = {
      assignmentId: assignment.id,
      status: 'returned',
      command: manualRun.command,
      exitCode: 0,
      outputSummary: 'manual run completed',
      diffSummary: 'assignment flow verified',
      testResults: 'PASS',
      unverified: [],
      deviations: '',
    };
    await store.writeResult(result);
    const scanSummary = await new AssignmentScanner(store, { now: '2026-07-05T00:10:00.000Z' }).scanResults();

    expect(assignment.readContext).toEqual(
      expect.arrayContaining([
        'openspec/changes/ai-workbench-loop/proposal.md',
        'openspec/changes/ai-workbench-loop/tasks.md',
      ]),
    );
    expect(assignment.excludeReasons).toEqual(
      expect.arrayContaining([
        { path: '.env', reason: '环境变量文件' },
        { path: 'dist/bundle.js', reason: '生成产物目录' },
        { path: 'docs/large-context.md', reason: '超过上下文大小限制' },
      ]),
    );
    expect(preview.diff).toContain('+status: queued');
    expect(applyPreviewToText(preview, beforeText)).toContain('status: queued');
    expect(() => applyPreviewToText(preview, `${beforeText}changed`)).toThrow('目标文件已变化');
    expect(assignment.verifyCommands).toContain('openspec validate ai-workbench-loop --strict --no-interactive');
    expect(manualRun.command).toContain(`${root}/ai-assignments/${assignment.id}.json`);
    expect(assignment.workspaceRisk).toContain('dirty');
    expect(assignment.allowPaths).not.toContain('README.md');
    expect(scanSummary.scanned).toEqual([assignment.id]);
    expect(await store.readEvidence(assignment.id)).toMatchObject({
      assignmentId: assignment.id,
      command: manualRun.command,
      testResults: 'PASS',
    });
  });
});
