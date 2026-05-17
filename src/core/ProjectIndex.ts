import type {
  AggregateProgress,
  ChangeEntry,
  OrphanRef,
  ProjectEntry,
  ProjectIndexSnapshot,
  ProjectManifest,
  ProjectSlug,
  SlugConflict,
} from '../types';
import { parseChangeRefs } from './ChangeRefParser';

export interface BuildInput {
  manifests: ProjectManifest[];
  changes: ChangeEntry[];
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
  }));

  const projects = new Map<ProjectSlug, ProjectEntry>();
  const unassigned: ChangeEntry[] = [];
  const orphanRefs: OrphanRef[] = [];

  for (const c of enrichedChanges) {
    const declared = c.frontmatter.project;
    if (!declared) {
      unassigned.push(c);
      continue;
    }
    const manifest = manifestBySlug.get(declared as ProjectSlug);
    if (!manifest) {
      orphanRefs.push({ sourcePath: c.proposalPath, declaredProject: declared as ProjectSlug });
      unassigned.push(c);
      continue;
    }
    let entry = projects.get(declared as ProjectSlug);
    if (!entry) {
      entry = { manifest, changes: [], progress: aggregate([]) };
      projects.set(declared as ProjectSlug, entry);
    }
    entry.changes.push(c);
  }

  for (const [slug, entry] of projects) {
    entry.progress = aggregate(entry.changes);
    projects.set(slug, entry);
  }

  for (const manifest of input.manifests) {
    if (!projects.has(manifest.slug)) {
      projects.set(manifest.slug, {
        manifest,
        changes: [],
        progress: aggregate([]),
      });
    }
  }

  return { projects, unassigned, orphanRefs, slugConflicts };
}
