import type {
  ChangeEntry,
  DocumentRecord,
  HealthIssue,
  LongTaskThread,
  OrphanRef,
  OverviewMetrics,
  ProjectEntry,
  ProjectIndexSnapshot,
  ProjectSlug,
  SlugConflict,
} from '../types';

export interface HealthInput {
  projects: Map<ProjectSlug, ProjectEntry>;
  unassigned: ChangeEntry[];
  orphanRefs: OrphanRef[];
  slugConflicts: SlugConflict[];
  documents: DocumentRecord[];
}

export function flattenChanges(projects: Map<ProjectSlug, ProjectEntry>, unassigned: ChangeEntry[]): ChangeEntry[] {
  const bySlug = new Map<string, ChangeEntry>();
  for (const entry of projects.values()) {
    for (const change of entry.changes) {
      bySlug.set(change.slug, change);
    }
  }
  for (const change of unassigned) {
    bySlug.set(change.slug, change);
  }
  return Array.from(bySlug.values());
}

export function analyzeHealth(input: HealthInput): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const allChanges = flattenChanges(input.projects, input.unassigned);
  const changesWithMissingProject = allChanges.filter((change) => !change.frontmatter.project);

  for (const change of changesWithMissingProject) {
    issues.push({
      id: `missing-project:${change.slug}`,
      severity: 'warning',
      title: 'Change 缺少 project',
      message: `${change.slug} 没有 proposal.md frontmatter project 字段,无法稳定归入项目。`,
      sourcePath: change.proposalPath,
      changeSlug: change.slug,
      action: '生成 proposal frontmatter 修复预览。',
      scenarioIds: ['S06'],
    });
  }

  for (const ref of input.orphanRefs) {
    issues.push({
      id: `invalid-project:${ref.sourcePath}`,
      severity: 'error',
      title: 'Change 指向不存在的项目',
      message: `${ref.sourcePath} 声明 project=${ref.declaredProject},但 _projects 中没有对应 manifest。`,
      sourcePath: ref.sourcePath,
      projectSlug: ref.declaredProject,
      action: '创建项目 manifest 或修正 proposal project 字段。',
      scenarioIds: ['S07'],
    });
  }

  for (const conflict of input.slugConflicts) {
    issues.push({
      id: `project-slug-conflict:${conflict.slug}`,
      severity: 'error',
      title: '项目 slug 冲突',
      message: `${conflict.slug} 被多个 manifest 使用。`,
      projectSlug: conflict.slug,
      action: '保留一个权威 manifest,其余改 slug 或归档。',
    });
  }

  for (const change of allChanges) {
    if (change.isValidSlug === false) {
      issues.push({
        id: `invalid-change-slug:${change.slug}`,
        severity: 'error',
        title: 'Change slug 不符合 ASCII kebab-case',
        message: `${change.slug} 不能被自动修复,需要人工迁移目录和引用。`,
        sourcePath: change.proposalPath,
        changeSlug: change.slug,
        action: '手工迁移为 ASCII kebab-case change slug。',
        scenarioIds: ['S08'],
      });
    }
    if (change.hasTasks === false) {
      issues.push({
        id: `missing-tasks:${change.slug}`,
        severity: 'error',
        title: 'Change 缺少 tasks.md',
        message: `${change.slug} 没有 tasks.md,不能进入受控执行态。`,
        sourcePath: change.proposalPath,
        changeSlug: change.slug,
        action: '补齐 tasks.md 后再执行。',
        scenarioIds: ['S09'],
      });
    }
    if (change.hasSpecDelta === false) {
      issues.push({
        id: `missing-spec-delta:${change.slug}`,
        severity: 'warning',
        title: 'Change 缺少 spec delta',
        message: `${change.slug} 没有 specs/**/spec.md delta,OpenSpec 契约不完整。`,
        sourcePath: change.proposalPath,
        changeSlug: change.slug,
        action: '补齐 specs/<capability>/spec.md delta。',
        scenarioIds: ['S10'],
      });
    }
    for (const blocker of change.blockers.filter((b) => !b.resolved)) {
      issues.push({
        id: `unresolved-blocker:${change.slug}:${blocker.targetSlug}`,
        severity: 'warning',
        title: '阻塞关系未解析',
        message: `${change.slug} related 指向 ${blocker.targetSlug},但当前 active changes 中找不到目标。`,
        sourcePath: change.proposalPath,
        changeSlug: change.slug,
        action: '修正 related 引用或恢复目标 change。',
        scenarioIds: ['S05'],
      });
    }
  }

  for (const document of input.documents) {
    const staleReasons = document.metadata?.staleReasons;
    if (Array.isArray(staleReasons) && staleReasons.length > 0) {
      issues.push({
        id: `stale-index:${document.path}`,
        severity: 'warning',
        title: '控制塔索引可能陈旧',
        message: `${document.path} 含陈旧索引信号:${staleReasons.join(', ')}`,
        sourcePath: document.path,
        action: '重新扫描并生成新的控制塔索引。',
        scenarioIds: ['S11', 'S26'],
      });
    }
  }

  return issues;
}

export function summarizeOverview(snapshot: Pick<ProjectIndexSnapshot, 'projects' | 'unassigned' | 'healthIssues'>): OverviewMetrics {
  const allChanges = flattenChanges(snapshot.projects, snapshot.unassigned);
  const projectEntries = Array.from(snapshot.projects.values());
  const taskDone = allChanges.reduce((sum, change) => sum + change.taskProgress.totalDone, 0);
  const taskTotal = allChanges.reduce((sum, change) => sum + change.taskProgress.totalCount, 0);
  const blockerCount = allChanges.reduce((sum, change) => sum + change.blockers.length, 0);
  const unresolvedBlockerCount = allChanges.reduce(
    (sum, change) => sum + change.blockers.filter((b) => !b.resolved).length,
    0,
  );
  const archiveCandidateCount = allChanges.filter(
    (change) =>
      change.taskProgress.totalCount > 0 &&
      change.taskProgress.totalDone === change.taskProgress.totalCount &&
      change.frontmatter.status !== 'archived',
  ).length;

  return {
    projectCount: snapshot.projects.size,
    activeChangeCount: allChanges.filter((change) => change.frontmatter.status !== 'archived').length,
    blockerCount,
    unresolvedBlockerCount,
    taskDone,
    taskTotal,
    archiveCandidateCount,
    pendingAnalysisCount: projectEntries.filter((entry) => entry.manifest.pendingAnalysis).length,
    metadataWarningCount: snapshot.healthIssues.filter((issue) => issue.severity !== 'info').length,
    longTaskCount: deriveLongTasks(snapshot.projects, snapshot.unassigned).length,
  };
}

export function deriveLongTasks(
  projects: Map<ProjectSlug, ProjectEntry>,
  unassigned: ChangeEntry[],
): LongTaskThread[] {
  const threads: LongTaskThread[] = [];
  for (const entry of projects.values()) {
    const totalTasks = entry.progress.totalCount;
    const manyChanges = entry.changes.length >= 5 || (entry.manifest.generatedChanges?.length ?? 0) >= 10;
    const hasPendingArchitecture = entry.manifest.pendingAnalysis || entry.manifest.phase === 'brainstorming';
    if (manyChanges || totalTasks >= 20 || hasPendingArchitecture) {
      threads.push({
        id: `project:${entry.manifest.slug}`,
        title: entry.manifest.title,
        status: entry.changes.some((change) => change.blockers.some((b) => !b.resolved)) ? 'blocked' : 'active',
        projectSlug: entry.manifest.slug,
        changeSlugs: entry.changes.map((change) => change.slug),
        stage: hasPendingArchitecture ? 'architecture' : totalTasks === entry.progress.totalDone ? 'verification' : 'implementation',
        currentStep: recommendProjectStep(entry),
        blockers: entry.changes.flatMap((change) =>
          change.blockers.filter((b) => !b.resolved).map((b) => `${change.slug} -> ${b.targetSlug}`),
        ),
        nextAction: recommendProjectStep(entry),
        evidencePaths: entry.changes.flatMap((change) => change.evidencePaths ?? []),
        resumePacket: buildResumePacket(entry),
      });
    }
  }

  for (const change of [...flattenChanges(projects, unassigned)]) {
    if (change.taskProgress.totalCount >= 100 || change.blockers.length > 0) {
      threads.push({
        id: `change:${change.slug}`,
        title: change.slug,
        status: change.blockers.some((b) => !b.resolved) ? 'blocked' : 'ready',
        projectSlug: typeof change.frontmatter.project === 'string' ? change.frontmatter.project : undefined,
        changeSlugs: [change.slug],
        stage: change.taskProgress.totalDone === change.taskProgress.totalCount ? 'verification' : 'implementation',
        currentStep: change.taskProgress.nextOpenTask?.text ?? '验证已完成任务并准备归档候选提示',
        blockers: change.blockers.filter((b) => !b.resolved).map((b) => b.targetSlug),
        nextAction: change.taskProgress.nextOpenTask
          ? `继续 ${change.slug}: ${change.taskProgress.nextOpenTask.text}`
          : '运行 OpenSpec validate 并检查 archive 候选',
        evidencePaths: change.evidencePaths ?? [],
        resumePacket: `Change ${change.slug}\nProject: ${change.frontmatter.project ?? '(未分类)'}\nNext: ${
          change.taskProgress.nextOpenTask?.text ?? 'validate'
        }`,
      });
    }
  }

  return dedupeThreads(threads);
}

export function recommendNextActionForChange(change: ChangeEntry): string {
  if (change.hasTasks === false) return '补齐 tasks.md';
  if (change.hasSpecDelta === false) return '补齐 spec delta';
  if (change.blockers.some((b) => !b.resolved)) return '先处理未解析 blocker';
  if (change.taskProgress.nextOpenTask) return `执行下一项:${change.taskProgress.nextOpenTask.text}`;
  if (change.taskProgress.totalCount > 0) return '运行 openspec validate 并进入 archive 人工确认';
  return '补充任务清单后再执行';
}

function recommendProjectStep(entry: ProjectEntry): string {
  if (entry.manifest.pendingAnalysis) return `/analyze-project ${entry.manifest.slug}`;
  const firstBlocked = entry.changes.find((change) => change.blockers.some((b) => !b.resolved));
  if (firstBlocked) return `处理 blocker: ${firstBlocked.slug}`;
  const nextChange = entry.changes.find((change) => change.taskProgress.nextOpenTask);
  if (nextChange) return recommendNextActionForChange(nextChange);
  if (entry.changes.length === 0) return '完善 project vision/goals 并拆解 OpenSpec change';
  return '运行 openspec validate 并检查 archive 候选';
}

function buildResumePacket(entry: ProjectEntry): string {
  return [
    `Project: ${entry.manifest.slug}`,
    `Title: ${entry.manifest.title}`,
    `Phase: ${entry.manifest.phase ?? '(未填)'}`,
    `Progress: ${entry.progress.totalDone}/${entry.progress.totalCount}`,
    `Next: ${recommendProjectStep(entry)}`,
  ].join('\n');
}

function dedupeThreads(threads: LongTaskThread[]): LongTaskThread[] {
  const seen = new Set<string>();
  return threads.filter((thread) => {
    if (seen.has(thread.id)) return false;
    seen.add(thread.id);
    return true;
  });
}
