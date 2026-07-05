import type { AIAssignment, AssignmentExcludedPath, ChangeEntry, TaskItem } from '../types';
import { makeStableId } from './Hash';
import { toAssignmentTaskRefs } from './TaskRefs';

const DEFAULT_MAX_CONTEXT_BYTES = 1_000_000;

export interface BuildAssignmentInput {
  change: ChangeEntry;
  tasks?: TaskItem[];
  controlTowerMetaPath: string;
  now?: string;
  verifyCommands?: string[];
  pathByteSizes?: Record<string, number>;
  workspaceDirty?: boolean;
  maxContextBytes?: number;
}

export function buildAIAssignment(input: BuildAssignmentInput): AIAssignment {
  const now = input.now ?? new Date().toISOString();
  const id = `${input.change.slug}-${makeStableId([input.change.slug, now])}`;
  const resultPath = `${input.controlTowerMetaPath}/ai-results/${id}.json`;
  const evidencePath = `${input.controlTowerMetaPath}/evidence/${id}.json`;
  const assignmentPath = `${input.controlTowerMetaPath}/ai-assignments/${id}.json`;
  const pathByteSizes = input.pathByteSizes ?? {};
  const maxContextBytes = input.maxContextBytes ?? DEFAULT_MAX_CONTEXT_BYTES;
  const candidatePaths = unique([
    input.change.proposalPath,
    input.change.tasksPath,
    input.change.designPath,
    ...(input.change.specDeltaPaths ?? []),
    ...(input.change.evidencePaths ?? []),
    ...(input.change.sourcePaths ?? []),
  ]);
  const readContext: string[] = [];
  const excludeReasons: AssignmentExcludedPath[] = [];

  for (const path of candidatePaths) {
    const reason = assignmentExclusionReason(path, {
      bytes: pathByteSizes[path],
      maxContextBytes,
    });
    if (reason) {
      excludeReasons.push({ path, reason });
    } else {
      readContext.push(path);
    }
  }

  return {
    schemaVersion: 1,
    id,
    title: `AI assignment: ${input.change.slug}`,
    targetKind: 'change',
    targetRef: input.change.slug,
    taskRefs: toAssignmentTaskRefs(input.tasks ?? input.change.taskProgress.items, {
      fallback: input.change.taskProgress.nextOpenTask,
    }),
    goal: buildGoal(input.change),
    allowPaths: unique([changeRootPath(input.change.proposalPath), resultPath]),
    denyPaths: ['openspec/specs/', '.env', 'node_modules/', 'dist/'],
    readContext,
    excludeReasons,
    verifyCommands: input.verifyCommands ?? ['npm test -- --runInBand', 'npm run typecheck', 'npm run build'],
    expectedOutput: 'Return an ai-results JSON file with command, exitCode, diffSummary, testResults, unverified, and deviations.',
    writeBackTo: evidencePath,
    resultPath,
    triggerCommand: `codex --assignment ${assignmentPath}`,
    workspaceRisk: input.workspaceDirty
      ? 'dirty-worktree-warning: inspect unrelated changes before writing'
      : 'clean-or-unchecked',
    lock: null,
    status: 'draft',
    createdAt: now,
    updatedAt: now,
  };
}

export function assignmentExclusionReason(
  path: string,
  options: { bytes?: number; maxContextBytes?: number } = {},
): string | null {
  const normalized = normalizePath(path);
  const maxContextBytes = options.maxContextBytes ?? DEFAULT_MAX_CONTEXT_BYTES;
  if (typeof options.bytes === 'number' && options.bytes > maxContextBytes) {
    return '超过上下文大小限制';
  }
  if (/(^|\/)\.env(?:\.|$)/.test(normalized)) return '环境变量文件';
  if (/(^|\/)_private(\/|$)/.test(normalized)) return '私有目录';
  if (/(^|\/)(credentials|secrets?)(\/|$)/i.test(normalized)) return '凭据目录';
  if (/(^|\/)(credentials|secrets?)\.(json|ya?ml|toml|txt)$/i.test(normalized)) return '凭据文件';
  if (/(^|\/)node_modules(\/|$)/.test(normalized)) return '依赖目录';
  if (/(^|\/)(dist|coverage|\.data|outputs)(\/|$)/.test(normalized)) return '生成产物目录';
  if (/(^|\/)(package-lock\.json|npm-shrinkwrap\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb)$/.test(normalized)) {
    return '锁文件';
  }
  return null;
}

function buildGoal(change: ChangeEntry): string {
  const next = change.taskProgress.nextOpenTask?.text;
  return next ? `Implement ${change.slug}: ${next}` : `Implement ${change.slug} according to its current OpenSpec change files.`;
}

function changeRootPath(proposalPath: string): string {
  const index = normalizePath(proposalPath).lastIndexOf('/');
  return index < 0 ? normalizePath(proposalPath) : normalizePath(proposalPath).slice(0, index);
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');
}

function unique(paths: Array<string | undefined>): string[] {
  return Array.from(new Set(paths.filter((path): path is string => typeof path === 'string' && path.length > 0)));
}
