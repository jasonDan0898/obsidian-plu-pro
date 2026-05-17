export type ProjectSlug = string;

export type ProjectStatus = 'active' | 'paused' | 'done' | 'archived';

export interface ProjectManifest {
  slug: ProjectSlug;
  title: string;
  status: ProjectStatus;
  owner?: string;
  created?: string;
  updated?: string;
  scope?: string[];
  tags?: string[];
  manifestPath: string;
}

export interface ChangeFrontmatter {
  status?: string;
  capability?: string;
  owner?: string;
  project?: ProjectSlug;
  related?: string[];
  [key: string]: unknown;
}

export interface ChangeRef {
  targetSlug: string;
  raw: string;
  resolved: boolean;
}

export interface TaskGroupProgress {
  heading: string;
  done: number;
  total: number;
}

export interface TaskProgress {
  totalDone: number;
  totalCount: number;
  groups: TaskGroupProgress[];
}

export interface AggregateProgress {
  totalDone: number;
  totalCount: number;
  changeCount: number;
  changesDone: number;
}

export interface ChangeEntry {
  slug: string;
  proposalPath: string;
  frontmatter: ChangeFrontmatter;
  taskProgress: TaskProgress;
  blockers: ChangeRef[];
}

export interface ProjectEntry {
  manifest: ProjectManifest;
  changes: ChangeEntry[];
  progress: AggregateProgress;
}

export interface OrphanRef {
  sourcePath: string;
  declaredProject: ProjectSlug;
}

export interface ProjectIndexSnapshot {
  /** Map is not JSON-serialisable; v2 persistence must convert to Array first. */
  projects: Map<ProjectSlug, ProjectEntry>;
  unassigned: ChangeEntry[];
  orphanRefs: OrphanRef[];
}

export interface AssignmentCandidate {
  projectSlug: ProjectSlug;
  score: number;
  reasons: string[];
}

export interface PluginSettings {
  /** Relative to vault root. Resolve with app.vault.getAbstractFileByPath(). */
  changesPath: string;
  /** Relative to vault root. Resolve with app.vault.getAbstractFileByPath(). */
  projectsPath: string;
  enableCapabilityFallback: boolean;
}

export const DEFAULT_SETTINGS: PluginSettings = {
  changesPath: 'openspec/changes',
  projectsPath: '_projects',
  enableCapabilityFallback: true,
};
