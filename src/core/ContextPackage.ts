import type { ContextPackage, ProjectIndexSnapshot } from '../types';
import { recommendNextActionForChange } from './HealthAnalyzer';
import { makeStableId } from './Hash';

const EXCLUDED_PATH_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /\.env(?:\.|$)/, reason: '环境变量文件' },
  { pattern: /(^|\/)_private(\/|$)/, reason: '私有目录' },
  { pattern: /(^|\/)node_modules(\/|$)/, reason: '依赖目录' },
  { pattern: /(^|\/)(dist|coverage|\.data|outputs)(\/|$)/, reason: '生成产物目录' },
  { pattern: /ht-ml\.app/i, reason: '第三方发布令牌或 URL' },
  { pattern: /(^|\/)\.lavish\/.*\.html$/i, reason: 'Lavish HTML 是派生产物,不作为上下文源' },
];

export interface ContextPackageSelection {
  projectSlug?: string;
  changeSlug?: string;
}

export function createContextPackage(
  snapshot: ProjectIndexSnapshot,
  selection: ContextPackageSelection,
): ContextPackage {
  const now = new Date().toISOString();
  const project = selection.projectSlug ? snapshot.projects.get(selection.projectSlug) : undefined;
  const change = findChange(snapshot, selection.changeSlug);
  const relatedChanges = change
    ? [change]
    : project
      ? project.changes
      : [];
  const candidatePaths = unique([
    project?.manifest.manifestPath,
    ...relatedChanges.flatMap((entry) => entry.sourcePaths ?? [entry.proposalPath]),
    ...snapshot.reviewRecords
      .filter((record) =>
        record.status !== 'dismissed' &&
        ((selection.changeSlug && record.changeSlug === selection.changeSlug) ||
          (selection.projectSlug && record.projectSlug === selection.projectSlug)),
      )
      .map((record) => record.sourcePath),
  ]);

  const sourcePaths: string[] = [];
  const excludedPaths: ContextPackage['excludedPaths'] = [];
  for (const path of candidatePaths) {
    if (!path) continue;
    const excluded = exclusionReason(path);
    if (excluded) {
      excludedPaths.push({ path, reason: excluded });
    } else {
      sourcePaths.push(path);
    }
  }

  const summaryLines = [
    project ? `Project ${project.manifest.slug}: ${project.manifest.title}` : undefined,
    change ? `Change ${change.slug}: ${recommendNextActionForChange(change)}` : undefined,
    relatedChanges.length > 0
      ? `Changes: ${relatedChanges.map((entry) => entry.slug).join(', ')}`
      : undefined,
    `Open review records: ${snapshot.reviewRecords.filter((record) => record.status === 'open' || record.status === 'queued').length}`,
  ].filter((line): line is string => typeof line === 'string');

  return {
    id: `ctx-${makeStableId([selection.projectSlug ?? '', selection.changeSlug ?? '', now])}`,
    title: titleForSelection(selection),
    createdAt: now,
    scope: selection,
    sourcePaths,
    excludedPaths,
    summary: summaryLines.join('\n'),
    prompt: buildPrompt(selection, summaryLines, sourcePaths),
    allowedActions: [
      'read-source-files',
      'create-or-update-openspec-change',
      'preview-frontmatter-repair',
      'run-openspec-validate-readonly',
      'record-review-sidecar',
    ],
  };
}

export function exclusionReason(path: string): string | null {
  for (const entry of EXCLUDED_PATH_PATTERNS) {
    if (entry.pattern.test(path)) {
      return entry.reason;
    }
  }
  return null;
}

function findChange(snapshot: ProjectIndexSnapshot, slug: string | undefined) {
  if (!slug) return undefined;
  for (const entry of snapshot.projects.values()) {
    const found = entry.changes.find((change) => change.slug === slug);
    if (found) return found;
  }
  return snapshot.unassigned.find((change) => change.slug === slug);
}

function titleForSelection(selection: ContextPackageSelection): string {
  if (selection.changeSlug) return `Control Tower context: ${selection.changeSlug}`;
  if (selection.projectSlug) return `Control Tower context: ${selection.projectSlug}`;
  return 'Control Tower context';
}

function buildPrompt(selection: ContextPackageSelection, summaryLines: string[], sourcePaths: string[]): string {
  return [
    '请基于下列本地 vault 源文件继续工作,不要依赖派生 HTML 作为事实源。',
    selection.projectSlug ? `Project: ${selection.projectSlug}` : undefined,
    selection.changeSlug ? `Change: ${selection.changeSlug}` : undefined,
    '',
    'Summary:',
    ...summaryLines,
    '',
    'Read first:',
    ...sourcePaths.map((path) => `- ${path}`),
    '',
    'Guardrails:',
    '- 不直接编辑 openspec/specs/**',
    '- 不执行 archive',
    '- 写入前先生成 diff preview 并校验 hash',
  ]
    .filter((line): line is string => typeof line === 'string')
    .join('\n');
}

function unique(paths: Array<string | undefined>): string[] {
  return Array.from(new Set(paths.filter((path): path is string => typeof path === 'string' && path.length > 0)));
}
