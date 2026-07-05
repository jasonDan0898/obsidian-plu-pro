import type {
  AggregateProgress,
  ChangeEntry,
  DocumentRecord,
  OrphanRef,
  ProjectEntry,
  ProjectIndexSnapshot,
  ProjectManifest,
  ProjectSlug,
  RelationshipEdge,
  ReviewRecord,
  SlugConflict,
} from '../types';
import { parseChangeRefs } from './ChangeRefParser';
import { analyzeHealth, deriveLongTasks, recommendNextActionForChange, summarizeOverview } from './HealthAnalyzer';
import { simulateScenarios } from './ScenarioCatalog';

export interface BuildInput {
  manifests: ProjectManifest[];
  changes: ChangeEntry[];
  documents?: DocumentRecord[];
  reviewRecords?: ReviewRecord[];
}

function aggregate(changes: ChangeEntry[]): AggregateProgress {
  let totalDone = 0;
  let totalCount = 0;
  let changesDone = 0;
  for (const c of changes) {
    totalDone += c.taskProgress.totalDone;
    totalCount += c.taskProgress.totalCount;
    if (c.taskProgress.totalCount > 0 && c.taskProgress.totalDone === c.taskProgress.totalCount) {
      changesDone += 1;
    }
  }
  return {
    totalDone,
    totalCount,
    changeCount: changes.length,
    changesDone,
  };
}

export function buildIndex(input: BuildInput): ProjectIndexSnapshot {
  const knownSlugs = new Set(input.changes.map((c) => c.slug));

  // 检测重复 slug:同一 slug 多个 manifest 时,只保留先扫描到的,把所有
  // 冲突路径记入 slugConflicts 供 UI 显式警告。spec §5 边界:让用户看见
  // 冲突而非静默覆盖。
  const manifestBySlug = new Map<ProjectSlug, ProjectManifest>();
  const conflictsBySlug = new Map<ProjectSlug, string[]>();
  for (const m of input.manifests) {
    const existing = manifestBySlug.get(m.slug);
    if (existing) {
      const paths = conflictsBySlug.get(m.slug) ?? [existing.manifestPath];
      paths.push(m.manifestPath);
      conflictsBySlug.set(m.slug, paths);
    } else {
      manifestBySlug.set(m.slug, m);
    }
  }
  const slugConflicts: SlugConflict[] = Array.from(conflictsBySlug, ([slug, manifestPaths]) => ({
    slug,
    manifestPaths,
  }));

  const enrichedChanges: ChangeEntry[] = input.changes.map((c) => ({
    ...c,
    blockers: parseChangeRefs(c.frontmatter.related, knownSlugs),
    linkSources: [],
  }));

  const projects = new Map<ProjectSlug, ProjectEntry>();
  const unassigned: ChangeEntry[] = [];
  const orphanRefs: OrphanRef[] = [];
  const generatedOwners = new Map<string, ProjectSlug[]>();

  for (const manifest of input.manifests) {
    for (const slug of manifest.generatedChanges ?? []) {
      const owners = generatedOwners.get(slug) ?? [];
      owners.push(manifest.slug);
      generatedOwners.set(slug, owners);
    }
  }

  for (const c of enrichedChanges) {
    const declared = c.frontmatter.project;
    if (!declared) {
      const generatedOwner = generatedOwners.get(c.slug)?.[0];
      if (generatedOwner && manifestBySlug.has(generatedOwner)) {
        addChangeToProject(projects, manifestBySlug.get(generatedOwner)!, {
          ...c,
          linkSources: ['generated-changes'],
        });
      } else {
        unassigned.push(c);
      }
      continue;
    }
    const manifest = manifestBySlug.get(declared as ProjectSlug);
    if (!manifest) {
      orphanRefs.push({ sourcePath: c.proposalPath, declaredProject: declared as ProjectSlug });
      unassigned.push(c);
      continue;
    }
    addChangeToProject(projects, manifest, { ...c, linkSources: ['proposal-project'] });
  }

  for (const [slug, entry] of projects) {
    entry.progress = aggregate(entry.changes);
    entry.generatedChanges = entry.manifest.generatedChanges ?? [];
    entry.reverseLinkedChanges = entry.changes
      .filter((change) => change.linkSources?.includes('proposal-project'))
      .map((change) => change.slug);
    entry.nextAction = recommendProjectEntryAction(entry);
    projects.set(slug, entry);
  }

  for (const manifest of input.manifests) {
    if (!projects.has(manifest.slug)) {
      projects.set(manifest.slug, {
        manifest,
        changes: [],
        progress: aggregate([]),
        generatedChanges: manifest.generatedChanges ?? [],
        reverseLinkedChanges: [],
        nextAction: manifest.pendingAnalysis
          ? `/analyze-project ${manifest.slug}`
          : '完善 project vision/goals 并拆解 OpenSpec change',
      });
    }
  }

  const documents = [
    ...(input.documents ?? []),
    ...documentRecordsForProjects(input.manifests),
    ...documentRecordsForChanges(enrichedChanges),
  ];
  const relationships = buildRelationships(projects);
  const healthIssues = analyzeHealth({ projects, unassigned, orphanRefs, slugConflicts, documents });
  const partial: ProjectIndexSnapshot = {
    projects,
    unassigned,
    orphanRefs,
    slugConflicts,
    documents,
    relationships,
    healthIssues,
    overview: {
      projectCount: 0,
      activeChangeCount: 0,
      blockerCount: 0,
      unresolvedBlockerCount: 0,
      taskDone: 0,
      taskTotal: 0,
      archiveCandidateCount: 0,
      pendingAnalysisCount: 0,
      metadataWarningCount: 0,
      longTaskCount: 0,
    },
    longTasks: [],
    scenarioResults: [],
    reviewRecords: input.reviewRecords ?? [],
  };
  partial.longTasks = deriveLongTasks(projects, unassigned);
  partial.overview = summarizeOverview(partial);
  partial.scenarioResults = simulateScenarios(partial);
  return partial;
}

export function createEmptySnapshot(): ProjectIndexSnapshot {
  return {
    projects: new Map(),
    unassigned: [],
    orphanRefs: [],
    slugConflicts: [],
    documents: [],
    relationships: [],
    healthIssues: [],
    overview: {
      projectCount: 0,
      activeChangeCount: 0,
      blockerCount: 0,
      unresolvedBlockerCount: 0,
      taskDone: 0,
      taskTotal: 0,
      archiveCandidateCount: 0,
      pendingAnalysisCount: 0,
      metadataWarningCount: 0,
      longTaskCount: 0,
    },
    longTasks: [],
    scenarioResults: [],
    reviewRecords: [],
  };
}

function addChangeToProject(
  projects: Map<ProjectSlug, ProjectEntry>,
  manifest: ProjectManifest,
  change: ChangeEntry,
): void {
  let entry = projects.get(manifest.slug);
  if (!entry) {
    entry = {
      manifest,
      changes: [],
      progress: aggregate([]),
      generatedChanges: manifest.generatedChanges ?? [],
      reverseLinkedChanges: [],
    };
    projects.set(manifest.slug, entry);
  }
  if (!entry.changes.some((existing) => existing.slug === change.slug)) {
    entry.changes.push(change);
  }
}

function recommendProjectEntryAction(entry: ProjectEntry): string {
  if (entry.manifest.pendingAnalysis) return `/analyze-project ${entry.manifest.slug}`;
  const next = entry.changes.find((change) => change.taskProgress.nextOpenTask);
  if (next) return recommendNextActionForChange(next);
  if (entry.progress.changeCount === 0) return '拆解 OpenSpec changes';
  return '检查 OpenSpec health 并运行 validate';
}

function documentRecordsForProjects(manifests: ProjectManifest[]): DocumentRecord[] {
  return manifests.map((manifest) => ({
    id: `project:${manifest.slug}`,
    kind: 'project',
    path: manifest.manifestPath,
    title: manifest.title,
    projectSlug: manifest.slug,
    source: 'source',
  }));
}

function documentRecordsForChanges(changes: ChangeEntry[]): DocumentRecord[] {
  const out: DocumentRecord[] = [];
  for (const change of changes) {
    out.push({
      id: `change:${change.slug}:proposal`,
      kind: 'proposal',
      path: change.proposalPath,
      title: change.slug,
      projectSlug: typeof change.frontmatter.project === 'string' ? change.frontmatter.project : undefined,
      changeSlug: change.slug,
      hash: change.proposalHash,
      source: 'source',
    });
    if (change.designPath) {
      out.push({
        id: `change:${change.slug}:design`,
        kind: 'design',
        path: change.designPath,
        title: `${change.slug} design`,
        changeSlug: change.slug,
        source: 'source',
      });
    }
    if (change.tasksPath) {
      out.push({
        id: `change:${change.slug}:tasks`,
        kind: 'tasks',
        path: change.tasksPath,
        title: `${change.slug} tasks`,
        changeSlug: change.slug,
        source: 'source',
      });
    }
    for (const path of change.specDeltaPaths ?? []) {
      out.push({
        id: `change:${change.slug}:spec:${path}`,
        kind: 'spec-delta',
        path,
        title: `${change.slug} spec delta`,
        changeSlug: change.slug,
        source: 'source',
      });
    }
    for (const path of change.evidencePaths ?? []) {
      out.push({
        id: `change:${change.slug}:evidence:${path}`,
        kind: 'evidence',
        path,
        title: `${change.slug} evidence`,
        changeSlug: change.slug,
        source: 'source',
      });
    }
  }
  return out;
}

function buildRelationships(projects: Map<ProjectSlug, ProjectEntry>): RelationshipEdge[] {
  const edges: RelationshipEdge[] = [];
  for (const entry of projects.values()) {
    for (const change of entry.changes) {
      edges.push({
        fromId: `project:${entry.manifest.slug}`,
        toId: `change:${change.slug}:proposal`,
        kind: change.linkSources?.includes('generated-changes') ? 'generated-change' : 'project-change',
      });
      if (change.designPath) {
        edges.push({ fromId: `change:${change.slug}:proposal`, toId: `change:${change.slug}:design`, kind: 'change-design' });
      }
      if (change.tasksPath) {
        edges.push({ fromId: `change:${change.slug}:proposal`, toId: `change:${change.slug}:tasks`, kind: 'change-task' });
      }
      for (const path of change.specDeltaPaths ?? []) {
        edges.push({ fromId: `change:${change.slug}:proposal`, toId: `change:${change.slug}:spec:${path}`, kind: 'change-spec' });
      }
      for (const path of change.evidencePaths ?? []) {
        edges.push({ fromId: `change:${change.slug}:proposal`, toId: `change:${change.slug}:evidence:${path}`, kind: 'change-evidence' });
      }
    }
  }
  return edges;
}
