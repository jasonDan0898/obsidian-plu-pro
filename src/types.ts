export type ProjectSlug = string;

export type ProjectStatus = 'active' | 'paused' | 'done' | 'archived';

export type ProjectPhase = 'brainstorming' | 'proposing' | 'implementing' | 'done' | string;

export type ProjectSystem = 'HIC' | 'EVS';

export type SystemFilter = 'all' | 'HIC' | 'EVS' | 'unassigned';

export type DocumentKind =
  | 'project'
  | 'change'
  | 'proposal'
  | 'design'
  | 'tasks'
  | 'spec-delta'
  | 'superpowers-spec'
  | 'superpowers-plan'
  | 'weekly-plan'
  | 'evidence'
  | 'review-artifact'
  | 'sidecar'
  | 'lavish-metadata';

export type HealthSeverity = 'info' | 'warning' | 'error';

export type ReviewStatus = 'open' | 'queued' | 'addressed' | 'dismissed';

export type ReviewAuthor = 'human' | 'codex' | 'plugin' | 'layout-audit';

export type WritePreviewStatus = 'preview' | 'applied' | 'rejected';

export type AssignmentStatus = 'draft' | 'locked' | 'running' | 'returned' | 'closed';

export interface AssignmentTaskRef {
  section: string;
  text: string;
}

export interface AssignmentExcludedPath {
  path: string;
  reason: string;
}

export interface AssignmentLock {
  assignmentId: string;
  paths: string[];
  owner: 'codex' | 'claude' | 'human' | string;
  lockedAt: string;
  expiresAt?: string;
  releasedAt?: string;
}

export interface AIAssignment {
  schemaVersion: number;
  id: string;
  title: string;
  targetKind: 'change' | 'workitem';
  targetRef: string;
  taskRefs: AssignmentTaskRef[];
  goal: string;
  allowPaths: string[];
  denyPaths: string[];
  readContext: string[];
  excludeReasons: AssignmentExcludedPath[];
  verifyCommands: string[];
  expectedOutput: string;
  writeBackTo: string;
  resultPath: string;
  triggerCommand: string;
  workspaceRisk: string;
  lock: AssignmentLock | null;
  status: AssignmentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Evidence {
  schemaVersion: number;
  id: string;
  assignmentId: string;
  command?: string;
  exitCode?: number;
  outputSummary?: string;
  diffSummary?: string;
  testResults?: string;
  unverified?: string[];
  deviations?: string;
  recordedAt: string;
}

export interface AIResult {
  assignmentId: string;
  status: 'returned' | 'failed';
  command?: string;
  exitCode?: number;
  outputSummary?: string;
  diffSummary?: string;
  testResults?: string;
  unverified?: string[];
  deviations?: string;
}

export interface ProjectManifest {
  slug: ProjectSlug;
  title: string;
  status: ProjectStatus;
  phase?: ProjectPhase;
  owner?: string;
  created?: string;
  updated?: string;
  deadline?: string;
  vision?: string;
  goals?: string[];
  scope?: string[];
  successCriteria?: string[];
  nonGoals?: string[];
  risks?: string[];
  tags?: string[];
  manifestPath: string;
  pendingAnalysis?: boolean;
  generatedChanges?: string[];
  lastAnalyzed?: string;
  system?: ProjectSystem;
  superpowersSpecs?: string[];
  superpowersPlans?: string[];
  deviationFlags?: Record<string, number>;
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

export interface TaskItem {
  line: number;
  heading: string;
  text: string;
  done: boolean;
}

export interface TaskProgress {
  totalDone: number;
  totalCount: number;
  groups: TaskGroupProgress[];
  items?: TaskItem[];
  nextOpenTask?: TaskItem;
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
  tasksPath?: string;
  designPath?: string;
  specDeltaPaths?: string[];
  evidencePaths?: string[];
  sourcePaths?: string[];
  proposalHash?: string;
  hasTasks?: boolean;
  hasSpecDelta?: boolean;
  isValidSlug?: boolean;
  linkSources?: Array<'proposal-project' | 'generated-changes'>;
}

export interface ProjectEntry {
  manifest: ProjectManifest;
  changes: ChangeEntry[];
  progress: AggregateProgress;
  generatedChanges: string[];
  reverseLinkedChanges: string[];
  nextAction?: string;
}

export interface OrphanRef {
  sourcePath: string;
  declaredProject: ProjectSlug;
}

export interface SlugConflict {
  slug: ProjectSlug;
  manifestPaths: string[];
}

export interface DocumentRecord {
  id: string;
  kind: DocumentKind;
  path: string;
  title?: string;
  projectSlug?: ProjectSlug;
  changeSlug?: string;
  hash?: string;
  bytes?: number;
  source: 'source' | 'derived';
  metadata?: Record<string, unknown>;
}

export interface RelationshipEdge {
  fromId: string;
  toId: string;
  kind:
    | 'project-change'
    | 'generated-change'
    | 'change-spec'
    | 'change-task'
    | 'change-design'
    | 'change-plan'
    | 'change-evidence'
    | 'review-source';
}

export interface HealthIssue {
  id: string;
  severity: HealthSeverity;
  title: string;
  message: string;
  sourcePath?: string;
  projectSlug?: ProjectSlug;
  changeSlug?: string;
  action?: string;
  scenarioIds?: string[];
}

export interface OverviewMetrics {
  projectCount: number;
  activeChangeCount: number;
  blockerCount: number;
  unresolvedBlockerCount: number;
  taskDone: number;
  taskTotal: number;
  archiveCandidateCount: number;
  pendingAnalysisCount: number;
  metadataWarningCount: number;
  longTaskCount: number;
}

export interface LongTaskThread {
  id: string;
  title: string;
  status: 'active' | 'blocked' | 'paused' | 'ready';
  projectSlug?: ProjectSlug;
  changeSlugs: string[];
  stage: 'triage' | 'architecture' | 'implementation' | 'verification' | 'handoff';
  currentStep: string;
  blockers: string[];
  nextAction: string;
  evidencePaths: string[];
  resumePacket: string;
}

export interface ReviewRecord {
  id: string;
  kind: 'annotation' | 'selected-text' | 'queued-prompt' | 'layout-finding' | 'agent-reply';
  sourcePath: string;
  sourceHash: string;
  selector?: string;
  excerpt?: string;
  body: string;
  author: ReviewAuthor;
  status: ReviewStatus;
  stale?: boolean;
  createdAt: string;
  updatedAt: string;
  projectSlug?: ProjectSlug;
  changeSlug?: string;
}

export interface ArchitectureDecision {
  id: string;
  title: string;
  projectSlug?: ProjectSlug;
  changeSlug?: string;
  status: 'proposed' | 'accepted' | 'superseded';
  context: string;
  decision: string;
  consequences: string[];
  createdAt: string;
}

export interface ScenarioCase {
  id: string;
  title: string;
  trigger: string;
  expectedSignal: string;
  expectedAction: string;
  risk: HealthSeverity;
}

export interface ScenarioSimulationResult {
  scenarioId: string;
  title: string;
  status: 'covered' | 'attention' | 'blocked';
  signal: string;
  action: string;
}

export interface WritePreview {
  id: string;
  operation: 'set-frontmatter' | 'mark-pending-analysis' | 'append-sidecar-note';
  targetPath: string;
  targetHash: string;
  beforeText: string;
  afterText: string;
  diff: string;
  status: WritePreviewStatus;
  createdAt: string;
  source: 'plugin' | 'codex' | 'human';
  rollbackHint: string;
}

export interface ContextPackage {
  id: string;
  title: string;
  createdAt: string;
  scope: {
    projectSlug?: ProjectSlug;
    changeSlug?: string;
  };
  sourcePaths: string[];
  excludedPaths: Array<{ path: string; reason: string }>;
  summary: string;
  prompt: string;
  allowedActions: string[];
}

export interface ProjectIndexSnapshot {
  /** Map is not JSON-serialisable; v2 persistence must convert to Array first. */
  projects: Map<ProjectSlug, ProjectEntry>;
  unassigned: ChangeEntry[];
  orphanRefs: OrphanRef[];
  slugConflicts: SlugConflict[];
  documents: DocumentRecord[];
  relationships: RelationshipEdge[];
  healthIssues: HealthIssue[];
  overview: OverviewMetrics;
  longTasks: LongTaskThread[];
  scenarioResults: ScenarioSimulationResult[];
  reviewRecords: ReviewRecord[];
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
  /** Relative to vault root. Stores auditable Control Tower sidecars. */
  controlTowerMetaPath: string;
  enableCapabilityFallback: boolean;
}

export const DEFAULT_SETTINGS: PluginSettings = {
  changesPath: 'openspec/changes',
  projectsPath: '_projects',
  controlTowerMetaPath: '_meta/openspec-control-tower',
  enableCapabilityFallback: true,
};
