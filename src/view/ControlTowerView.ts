import { ItemView, Notice, Plugin, TFile, WorkspaceLeaf } from 'obsidian';
import type {
  AIAssignment,
  ChangeEntry,
  ContextPackage,
  HealthIssue,
  LongTaskThread,
  ProjectEntry,
  ProjectIndexSnapshot,
  SystemFilter,
} from '../types';
import type { AssignmentScanSummary } from '../core/AssignmentScanner';
import type { ManualAssignmentRun } from '../core/AssignmentRunner';
import { createAssignmentBoardViewModel } from './AssignmentBoardViewModel';

export const VIEW_TYPE_CONTROL_TOWER = 'plupro-control-tower';

/**
 * 视图只需要插件暴露的最小行为子集 — 同样为了避免 view ↔ main 循环
 * type-import,这里定义 inline contract,PluProPlugin 隐式满足。
 */
export interface PluProPluginForView extends Plugin {
  getIndex(): ProjectIndexSnapshot;
  getAIAssignments(): AIAssignment[];
  openAssignmentModal(target: ChangeEntry): void;
  refreshIndex(): Promise<void>;
  markProjectForAnalysis(file: TFile): Promise<void>;
  createAIAssignmentForChange(change: ChangeEntry): Promise<AIAssignment>;
  prepareAIAssignmentRun(assignmentId: string): Promise<ManualAssignmentRun | null>;
  scanAIAssignmentResults(): Promise<AssignmentScanSummary>;
  createContextPackage(selection: { projectSlug?: string; changeSlug?: string }): ContextPackage;
  createReviewForSource(input: {
    sourcePath: string;
    body: string;
    excerpt?: string;
    projectSlug?: string;
    changeSlug?: string;
  }): Promise<unknown>;
  exportLocalReviewSurface(selection: { projectSlug?: string; changeSlug?: string }): Promise<string>;
  saveScenarioSimulationEvidence(): Promise<string>;
}

export class ControlTowerView extends ItemView {
  private listPaneEl: HTMLElement | null = null;
  private detailPaneEl: HTMLElement | null = null;
  private selectedProjectSlug: string | null = null;
  private systemFilter: SystemFilter = 'all';

  constructor(leaf: WorkspaceLeaf, private readonly plugin: PluProPluginForView) {
    super(leaf);
  }

  getViewType(): string {
    return VIEW_TYPE_CONTROL_TOWER;
  }

  getDisplayText(): string {
    return 'PluPro 项目控制塔';
  }

  getIcon(): string {
    return 'kanban-square';
  }

  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass('plupro-control-tower');

    const layout = container.createDiv({ cls: 'plupro-layout' });
    this.listPaneEl = layout.createDiv({ cls: 'plupro-list-pane' });
    this.detailPaneEl = layout.createDiv({ cls: 'plupro-detail-pane' });

    this.renderAll(this.plugin.getIndex());
  }

  async onClose(): Promise<void> {
    this.listPaneEl = null;
    this.detailPaneEl = null;
  }

  /** 外部刷新入口:main.ts 在索引变化后调用,传入最新快照触发全量重渲染。 */
  renderAll(snapshot: ProjectIndexSnapshot): void {
    if (!this.listPaneEl || !this.detailPaneEl) {
      return;
    }
    this.renderList(snapshot);
    this.renderDetail(snapshot);
  }

  private renderList(snapshot: ProjectIndexSnapshot): void {
    if (!this.listPaneEl) return;
    this.listPaneEl.empty();

    const header = this.listPaneEl.createDiv({ cls: 'plupro-list-header' });
    header.createEl('h3', { text: '项目', cls: 'plupro-list-title' });
    const refreshBtn = header.createEl('button', {
      cls: 'plupro-refresh-btn',
      text: '⟳ 刷新',
      attr: { title: '重扫 _projects/ 与 openspec/changes/,通常自动更新即可' },
    });
    refreshBtn.addEventListener('click', async (evt) => {
      evt.stopPropagation();
      refreshBtn.setAttr('disabled', 'true');
      refreshBtn.setText('刷新中…');
      try {
        await this.plugin.refreshIndex();
      } finally {
        refreshBtn.removeAttribute('disabled');
        refreshBtn.setText('⟳ 刷新');
      }
    });

    // === v1.3 新增:segmented control 系统筛选 ===
    const counts = this.countBySystem(snapshot);
    const filterBar = this.listPaneEl.createDiv({ cls: 'plupro-filter-bar' });
    const filters: Array<{ key: SystemFilter; label: string; icon: string }> = [
      { key: 'all',        label: '全部',     icon: '' },
      { key: 'HIC',        label: 'HIC',     icon: '🟢' },
      { key: 'EVS',        label: 'EVS',     icon: '🟠' },
      { key: 'unassigned', label: '未分类',  icon: '⚪' },
    ];
    for (const f of filters) {
      const chip = filterBar.createEl('button', {
        cls: 'plupro-filter-chip' + (this.systemFilter === f.key ? ' is-active' : ''),
        text: `${f.icon} ${f.label} (${counts[f.key]})`.trim(),
      });
      chip.addEventListener('click', (evt) => {
        evt.stopPropagation();
        this.systemFilter = f.key;
        this.renderAll(this.plugin.getIndex());
      });
    }

    if (snapshot.slugConflicts.length > 0) {
      const banner = this.listPaneEl.createDiv({ cls: 'plupro-conflict-banner' });
      banner.createSpan({ text: `⚠ ${snapshot.slugConflicts.length} 处 slug 冲突` });
      const detail = banner.createEl('details');
      detail.createEl('summary', { text: '点开查看' });
      const list = detail.createEl('ul', { cls: 'plupro-conflict-list' });
      for (const cf of snapshot.slugConflicts) {
        const li = list.createEl('li');
        li.createSpan({ text: `slug "${cf.slug}":` });
        for (const p of cf.manifestPaths) {
          li.createEl('div', { cls: 'plupro-conflict-path', text: `  · ${p}` });
        }
      }
    }

    if (snapshot.projects.size === 0 && snapshot.unassigned.length === 0) {
      this.listPaneEl.createDiv({ cls: 'plupro-empty', text: '尚无项目 — 在 _projects/ 下创建 manifest 文件即可' });
      return;
    }

    const groups = this.groupProjectsBySystem(snapshot);
    if (groups.length === 0) {
      this.listPaneEl.createDiv({
        cls: 'plupro-empty',
        text: `${this.systemFilter} 系统下没有项目`,
      });
    }

    const ul = this.listPaneEl.createEl('ul', { cls: 'plupro-project-list' });

    const systemLabels: Record<SystemFilter, { icon: string; text: string }> = {
      all:        { icon: '',    text: '' },
      HIC:        { icon: '🟢', text: 'HIC 系统' },
      EVS:        { icon: '🟠', text: 'EVS 系统' },
      unassigned: { icon: '⚪', text: '未分类' },
    };

    for (const group of groups) {
      // 只在「全部」视图下渲染 divider(单组视图无必要)
      if (this.systemFilter === 'all') {
        const label = systemLabels[group.system];
        ul.createEl('li', {
          cls: 'plupro-system-divider',
          text: `━━━ ${label.icon} ${label.text}(${group.entries.length})━━━`,
        });
      }

      for (const entry of group.entries) {
        const slug = entry.manifest.slug;
        const li = ul.createEl('li', { cls: 'plupro-project-item' });
        if (slug === this.selectedProjectSlug) {
          li.addClass('is-selected');
        }
        const title = li.createDiv({ cls: 'plupro-project-title', text: entry.manifest.title });
        title.setAttr('data-slug', slug);
        const fm = entry.manifest;
        if (fm.pendingAnalysis) {
          title.createSpan({ cls: 'plupro-badge plupro-badge-pending', text: '待分析' });
        } else if (fm.generatedChanges && fm.generatedChanges.length > 0) {
          title.createSpan({
            cls: 'plupro-badge plupro-badge-done',
            text: `✓ ${fm.generatedChanges.length}`,
          });
        }
        const meta = li.createDiv({ cls: 'plupro-project-meta' });
        const pct = entry.progress.totalCount === 0
          ? 0
          : Math.round((entry.progress.totalDone / entry.progress.totalCount) * 100);
        meta.setText(
          `${entry.progress.changesDone}/${entry.progress.changeCount} change · ${entry.progress.totalDone}/${entry.progress.totalCount} task · ${pct}%`,
        );
        this.renderProgressBar(li, pct);
        li.addEventListener('click', () => {
          this.selectedProjectSlug = slug;
          this.renderAll(this.plugin.getIndex());
        });
      }
    }

    const unassignedLi = ul.createEl('li', { cls: 'plupro-unassigned-item' });
    unassignedLi.setText(`📦 未分类(${snapshot.unassigned.length})`);
    if (this.selectedProjectSlug === '__unassigned__') {
      unassignedLi.addClass('is-selected');
    }
    unassignedLi.addEventListener('click', () => {
      this.selectedProjectSlug = '__unassigned__';
      this.renderAll(this.plugin.getIndex());
    });
  }

  private renderDetail(snapshot: ProjectIndexSnapshot): void {
    if (!this.detailPaneEl) return;
    this.detailPaneEl.empty();

    if (!this.selectedProjectSlug) {
      this.renderHomeDetail(snapshot);
      return;
    }

    if (this.selectedProjectSlug === '__unassigned__') {
      this.renderUnassignedDetail(snapshot);
      return;
    }

    const entry = snapshot.projects.get(this.selectedProjectSlug);
    if (!entry) {
      this.detailPaneEl.createDiv({ cls: 'plupro-hint', text: '项目已被删除,请选择其他项目' });
      return;
    }
    this.detailPaneEl.createEl('h2', { text: entry.manifest.title });
    this.renderProjectBadges(this.detailPaneEl, entry);
    const actions = this.detailPaneEl.createDiv({ cls: 'plupro-detail-actions' });
    const analyzeBtn = actions.createEl('button', {
      cls: 'plupro-analyze-btn',
      text: '生成分析预览',
    });
    analyzeBtn.addEventListener('click', () => {
      const file = this.app.vault.getAbstractFileByPath(entry.manifest.manifestPath);
      if (file instanceof TFile) {
        void this.plugin.markProjectForAnalysis(file);
      }
    });
    const contextBtn = actions.createEl('button', {
      cls: 'plupro-secondary-btn',
      text: '生成上下文包',
    });
    contextBtn.addEventListener('click', () => {
      this.renderContextPackage(entry.manifest.slug);
    });
    const exportBtn = actions.createEl('button', {
      cls: 'plupro-secondary-btn',
      text: '本地导出',
    });
    exportBtn.addEventListener('click', async () => {
      const path = await this.plugin.exportLocalReviewSurface({ projectSlug: entry.manifest.slug });
      new Notice(`已导出本地审阅 HTML:${path}`, 7000);
      void this.plugin.refreshIndex();
    });
    const meta = this.detailPaneEl.createDiv({ cls: 'plupro-detail-meta' });
    meta.createSpan({ text: `状态:${entry.manifest.status}` });
    if (entry.manifest.owner) {
      meta.createSpan({ text: ` · 负责人:${entry.manifest.owner}` });
    }
    if (entry.manifest.scope && entry.manifest.scope.length > 0) {
      meta.createSpan({ text: ` · 能力域:${entry.manifest.scope.join(', ')}` });
    }
    if (entry.manifest.vision) {
      this.detailPaneEl.createDiv({ cls: 'plupro-vision', text: entry.manifest.vision });
    }
    if (entry.nextAction) {
      this.detailPaneEl.createDiv({ cls: 'plupro-next-action', text: `下一步:${entry.nextAction}` });
    }
    this.renderAssignmentBoard(this.detailPaneEl, new Set(entry.changes.map((change) => change.slug)));
    this.renderProjectHealthPanel(this.detailPaneEl, snapshot, entry.manifest.slug);
    this.renderLongTasksPanel(this.detailPaneEl, snapshot.longTasks.filter((task) => task.projectSlug === entry.manifest.slug));
    this.renderRelationshipPanel(this.detailPaneEl, entry);
    this.renderReviewPanel(this.detailPaneEl, entry);
    this.detailPaneEl.createEl('h3', { text: 'Change 列表' });
    if (entry.changes.length === 0) {
      this.detailPaneEl.createDiv({ cls: 'plupro-empty', text: '该项目下尚未挂入任何 change' });
      return;
    }
    const changesUl = this.detailPaneEl.createEl('ul', { cls: 'plupro-change-list' });
    for (const c of entry.changes) {
      const li = changesUl.createEl('li', { cls: 'plupro-change-item' });
      const slugEl = li.createDiv({ cls: 'plupro-change-slug plupro-clickable', text: c.slug });
      this.attachPreviewBehavior(slugEl, c.proposalPath);
      const changeActions = li.createDiv({ cls: 'plupro-change-actions' });
      const contextBtn = changeActions.createEl('button', { cls: 'plupro-small-btn', text: '上下文包' });
      contextBtn.addEventListener('click', (evt) => {
        evt.stopPropagation();
        this.renderContextPackage(entry.manifest.slug, c.slug);
      });
      const validateBtn = changeActions.createEl('button', { cls: 'plupro-small-btn', text: 'validate' });
      validateBtn.addEventListener('click', (evt) => {
        evt.stopPropagation();
        this.renderValidateCommand(c.slug);
      });
      const aiBtn = changeActions.createEl('button', { cls: 'plupro-small-btn', text: 'AI 任务' });
      aiBtn.addEventListener('click', async (evt) => {
        evt.stopPropagation();
        aiBtn.setAttr('disabled', 'true');
        try {
          const assignment = await this.plugin.createAIAssignmentForChange(c);
          new Notice(`已生成 AI 任务:${assignment.id}`);
          this.renderAll(this.plugin.getIndex());
        } finally {
          aiBtn.removeAttribute('disabled');
        }
      });
      const tp = c.taskProgress;
      const pct = tp.totalCount === 0 ? 0 : Math.round((tp.totalDone / tp.totalCount) * 100);
      li.createDiv({
        cls: 'plupro-change-progress',
        text: `${tp.totalDone}/${tp.totalCount} task · ${pct}%`,
      });
      this.renderProgressBar(li, pct);
      if (c.blockers.length > 0) {
        const blockers = li.createDiv({ cls: 'plupro-change-blockers' });
        blockers.createSpan({ text: '阻塞:' });
        for (const b of c.blockers) {
          const tag = blockers.createSpan({
            cls: b.resolved ? 'plupro-blocker is-resolved' : 'plupro-blocker is-orphan',
            text: b.targetSlug,
          });
          if (!b.resolved) {
            tag.setAttr('title', '指向不存在的 change');
          }
        }
      }
    }
  }

  private renderHomeDetail(snapshot: ProjectIndexSnapshot): void {
    if (!this.detailPaneEl) return;
    this.detailPaneEl.createEl('h2', { text: '每日控制塔' });
    this.renderOverviewMetrics(this.detailPaneEl, snapshot);
    const actions = this.detailPaneEl.createDiv({ cls: 'plupro-detail-actions' });
    const saveScenarioBtn = actions.createEl('button', {
      cls: 'plupro-secondary-btn',
      text: '保存场景模拟证据',
    });
    saveScenarioBtn.addEventListener('click', async () => {
      const path = await this.plugin.saveScenarioSimulationEvidence();
      new Notice(`已保存场景模拟:${path}`, 7000);
      void this.plugin.refreshIndex();
    });
    this.renderAssignmentBoard(this.detailPaneEl);
    this.renderHealthPanel(this.detailPaneEl, snapshot.healthIssues, 12);
    this.renderLongTasksPanel(this.detailPaneEl, snapshot.longTasks);
    this.renderScenarioPanel(this.detailPaneEl, snapshot);
  }

  private renderOverviewMetrics(parent: HTMLElement, snapshot: ProjectIndexSnapshot): void {
    const metrics = [
      ['项目', snapshot.overview.projectCount],
      ['Active changes', snapshot.overview.activeChangeCount],
      ['任务', `${snapshot.overview.taskDone}/${snapshot.overview.taskTotal}`],
      ['阻塞', `${snapshot.overview.unresolvedBlockerCount}/${snapshot.overview.blockerCount}`],
      ['待分析', snapshot.overview.pendingAnalysisCount],
      ['Archive 候选', snapshot.overview.archiveCandidateCount],
      ['健康警告', snapshot.overview.metadataWarningCount],
      ['长任务', snapshot.overview.longTaskCount],
    ];
    const grid = parent.createDiv({ cls: 'plupro-metric-grid' });
    for (const [label, value] of metrics) {
      const cell = grid.createDiv({ cls: 'plupro-metric-cell' });
      cell.createDiv({ cls: 'plupro-metric-value', text: String(value) });
      cell.createDiv({ cls: 'plupro-metric-label', text: String(label) });
    }
  }

  private renderProjectBadges(parent: HTMLElement, entry: ProjectEntry): void {
    const badges = parent.createDiv({ cls: 'plupro-inline-badges' });
    badges.createSpan({ cls: 'plupro-badge', text: entry.manifest.phase ?? 'phase:未填' });
    if (entry.manifest.pendingAnalysis) {
      badges.createSpan({ cls: 'plupro-badge plupro-badge-pending', text: 'pending-analysis' });
    }
    if (entry.generatedChanges.length > 0) {
      badges.createSpan({ cls: 'plupro-badge plupro-badge-done', text: `generated:${entry.generatedChanges.length}` });
    }
    if (entry.reverseLinkedChanges.length > 0) {
      badges.createSpan({ cls: 'plupro-badge', text: `linked:${entry.reverseLinkedChanges.length}` });
    }
  }

  private renderProjectHealthPanel(
    parent: HTMLElement,
    snapshot: ProjectIndexSnapshot,
    projectSlug: string,
  ): void {
    const issues = snapshot.healthIssues.filter(
      (issue) =>
        issue.projectSlug === projectSlug ||
        entryHasIssue(snapshot.projects.get(projectSlug), issue),
    );
    this.renderHealthPanel(parent, issues, 8);
  }

  private renderHealthPanel(parent: HTMLElement, issues: HealthIssue[], limit: number): void {
    parent.createEl('h3', { text: 'OpenSpec 健康' });
    if (issues.length === 0) {
      parent.createDiv({ cls: 'plupro-empty', text: '当前范围未发现健康问题' });
      return;
    }
    const list = parent.createEl('ul', { cls: 'plupro-health-list' });
    for (const issue of issues.slice(0, limit)) {
      const li = list.createEl('li', { cls: `plupro-health-item is-${issue.severity}` });
      li.createDiv({ cls: 'plupro-health-title', text: issue.title });
      li.createDiv({ cls: 'plupro-health-message', text: issue.message });
      if (issue.action) {
        li.createDiv({ cls: 'plupro-health-action', text: issue.action });
      }
      if (issue.sourcePath) {
        const pathEl = li.createDiv({ cls: 'plupro-path plupro-clickable', text: issue.sourcePath });
        this.attachPreviewBehavior(pathEl, issue.sourcePath);
      }
    }
    if (issues.length > limit) {
      parent.createDiv({ cls: 'plupro-muted', text: `另有 ${issues.length - limit} 条健康信号未展开` });
    }
  }

  private renderLongTasksPanel(parent: HTMLElement, tasks: LongTaskThread[]): void {
    parent.createEl('h3', { text: '长任务看板' });
    if (tasks.length === 0) {
      parent.createDiv({ cls: 'plupro-empty', text: '当前范围没有需要单独跟踪的长任务线程' });
      return;
    }
    const list = parent.createEl('ul', { cls: 'plupro-long-task-list' });
    for (const task of tasks.slice(0, 10)) {
      const li = list.createEl('li', { cls: `plupro-long-task is-${task.status}` });
      li.createDiv({ cls: 'plupro-long-task-title', text: task.title });
      li.createDiv({ cls: 'plupro-long-task-meta', text: `${task.stage} · ${task.status}` });
      li.createDiv({ cls: 'plupro-next-action', text: `下一步:${task.nextAction}` });
      if (task.blockers.length > 0) {
        li.createDiv({ cls: 'plupro-health-action', text: `阻塞:${task.blockers.join(', ')}` });
      }
      const details = li.createEl('details');
      details.createEl('summary', { text: 'resume packet' });
      details.createEl('pre', { cls: 'plupro-pre', text: task.resumePacket });
    }
  }

  private renderScenarioPanel(parent: HTMLElement, snapshot: ProjectIndexSnapshot): void {
    parent.createEl('h3', { text: '30 场景模拟' });
    const table = parent.createEl('table', { cls: 'plupro-table' });
    const head = table.createEl('thead').createEl('tr');
    ['场景', '状态', '信号', '动作'].forEach((label) => head.createEl('th', { text: label }));
    const body = table.createEl('tbody');
    for (const result of snapshot.scenarioResults) {
      const tr = body.createEl('tr', { cls: `plupro-scenario is-${result.status}` });
      tr.createEl('td', { text: `${result.scenarioId} ${result.title}` });
      tr.createEl('td', { text: result.status });
      tr.createEl('td', { text: result.signal });
      tr.createEl('td', { text: result.action });
    }
  }

  private renderAssignmentBoard(parent: HTMLElement, targetRefs?: Set<string>): void {
    const assignments = targetRefs
      ? this.plugin.getAIAssignments().filter((assignment) => targetRefs.has(assignment.targetRef))
      : this.plugin.getAIAssignments();
    const model = createAssignmentBoardViewModel(assignments);
    parent.createEl('h3', { text: 'AI 协作台' });
    const panel = parent.createDiv({ cls: 'plupro-ai-board' });
    const toolbar = panel.createDiv({ cls: 'plupro-detail-actions' });
    toolbar.createDiv({
      cls: 'plupro-muted',
      text: `任务 ${model.total} · draft ${model.byStatus.draft} · running ${model.byStatus.running} · returned ${model.byStatus.returned}`,
    });
    const scanBtn = toolbar.createEl('button', { cls: 'plupro-secondary-btn', text: '扫描结果' });
    scanBtn.addEventListener('click', async () => {
      scanBtn.setAttr('disabled', 'true');
      try {
        const summary = await this.plugin.scanAIAssignmentResults();
        new Notice(`已扫描 ${summary.scanned.length} 个 AI 结果`);
      } finally {
        scanBtn.removeAttribute('disabled');
      }
    });

    if (model.rows.length === 0) {
      panel.createDiv({ cls: 'plupro-empty', text: '当前范围没有 AI 任务' });
      return;
    }

    const list = panel.createEl('ul', { cls: 'plupro-ai-assignment-list' });
    for (const row of model.rows) {
      const li = list.createEl('li', { cls: `plupro-ai-assignment is-${row.status}` });
      const header = li.createDiv({ cls: 'plupro-ai-assignment-header' });
      header.createSpan({ cls: 'plupro-health-title', text: `${row.targetRef} · ${row.status}` });
      header.createSpan({ cls: 'plupro-muted', text: row.id });
      li.createDiv({ cls: 'plupro-health-message', text: row.taskSummary || row.title });
      if (row.workspaceRisk.includes('dirty')) {
        li.createDiv({ cls: 'plupro-health-action', text: row.workspaceRisk });
      }
      li.createEl('pre', { cls: 'plupro-pre', text: row.command });
      li.createDiv({ cls: 'plupro-path', text: row.resultPath });
      const rowActions = li.createDiv({ cls: 'plupro-detail-actions' });
      const runBtn = rowActions.createEl('button', {
        cls: 'plupro-small-btn',
        text: '生成命令',
        attr: row.canRunManually ? {} : { disabled: 'true' },
      });
      runBtn.addEventListener('click', async () => {
        const plan = await this.plugin.prepareAIAssignmentRun(row.id);
        if (!plan) {
          new Notice(`未找到 AI 任务:${row.id}`);
          return;
        }
        this.renderManualRunOutput(li, plan);
      });
    }
  }

  private renderManualRunOutput(parent: HTMLElement, plan: ManualAssignmentRun): void {
    const existing = parent.querySelector('.plupro-assignment-run-output');
    existing?.remove();
    const output = parent.createDiv({ cls: 'plupro-assignment-run-output' });
    output.createEl('pre', { cls: 'plupro-pre', text: `${plan.command}\n\n${plan.instructions}` });
  }

  private renderRelationshipPanel(parent: HTMLElement, entry: ProjectEntry): void {
    parent.createEl('h3', { text: '关系表' });
    const table = parent.createEl('table', { cls: 'plupro-table' });
    const head = table.createEl('thead').createEl('tr');
    ['Change', 'Design', 'Tasks', 'Spec delta', 'Evidence'].forEach((label) => head.createEl('th', { text: label }));
    const body = table.createEl('tbody');
    for (const change of entry.changes) {
      const tr = body.createEl('tr');
      tr.createEl('td', { text: change.slug });
      tr.createEl('td', { text: change.designPath ? 'yes' : 'no' });
      tr.createEl('td', { text: change.tasksPath ? `${change.taskProgress.totalDone}/${change.taskProgress.totalCount}` : 'missing' });
      tr.createEl('td', { text: String(change.specDeltaPaths?.length ?? 0) });
      tr.createEl('td', { text: String(change.evidencePaths?.length ?? 0) });
    }
  }

  private renderReviewPanel(parent: HTMLElement, entry: ProjectEntry): void {
    parent.createEl('h3', { text: '本地审阅' });
    const panel = parent.createDiv({ cls: 'plupro-review-panel' });
    const sourceSelect = panel.createEl('select', { cls: 'plupro-select' });
    const sources = this.reviewSourcesForProject(entry);
    for (const source of sources) {
      sourceSelect.createEl('option', { text: source.label, value: source.path });
    }
    const excerpt = panel.createEl('textarea', {
      cls: 'plupro-textarea',
      attr: { placeholder: '选区摘录或上下文' },
    });
    const body = panel.createEl('textarea', {
      cls: 'plupro-textarea',
      attr: { placeholder: '批注 / prompt / 架构问题' },
    });
    const saveBtn = panel.createEl('button', { cls: 'plupro-secondary-btn', text: '保存批注 sidecar' });
    saveBtn.addEventListener('click', async () => {
      const selectedPath = sourceSelect.value;
      if (!selectedPath || !body.value.trim()) {
        new Notice('请选择 source 并填写批注内容');
        return;
      }
      const changeSlug = sources.find((source) => source.path === selectedPath)?.changeSlug;
      await this.plugin.createReviewForSource({
        sourcePath: selectedPath,
        body: body.value.trim(),
        excerpt: excerpt.value.trim() || undefined,
        projectSlug: entry.manifest.slug,
        changeSlug,
      });
      body.value = '';
      excerpt.value = '';
      new Notice('已保存本地 review sidecar');
    });

    const openReviews = this.plugin
      .getIndex()
      .reviewRecords.filter((record) => record.projectSlug === entry.manifest.slug && record.status !== 'dismissed');
    if (openReviews.length > 0) {
      const list = panel.createEl('ul', { cls: 'plupro-review-list' });
      for (const record of openReviews.slice(0, 8)) {
        const li = list.createEl('li', { cls: 'plupro-review-item' });
        li.createDiv({ cls: 'plupro-health-title', text: `${record.status}${record.stale ? ' · stale' : ''}` });
        li.createDiv({ cls: 'plupro-health-message', text: record.body });
        li.createDiv({ cls: 'plupro-path', text: record.sourcePath });
      }
    }
  }

  private renderContextPackage(projectSlug: string, changeSlug?: string): void {
    if (!this.detailPaneEl) return;
    const existing = this.detailPaneEl.querySelector('.plupro-context-output');
    existing?.remove();
    const pkg = this.plugin.createContextPackage({ projectSlug, changeSlug });
    const output = this.detailPaneEl.createDiv({ cls: 'plupro-context-output' });
    output.createEl('h3', { text: 'AI 上下文包' });
    output.createEl('pre', { cls: 'plupro-pre', text: pkg.prompt });
    if (pkg.excludedPaths.length > 0) {
      output.createDiv({
        cls: 'plupro-muted',
        text: `已排除:${pkg.excludedPaths.map((item) => `${item.path}(${item.reason})`).join(', ')}`,
      });
    }
  }

  private renderValidateCommand(changeSlug: string): void {
    if (!this.detailPaneEl) return;
    const existing = this.detailPaneEl.querySelector('.plupro-validate-output');
    existing?.remove();
    const output = this.detailPaneEl.createDiv({ cls: 'plupro-validate-output plupro-context-output' });
    output.createEl('h3', { text: 'OpenSpec validate' });
    output.createEl('pre', {
      cls: 'plupro-pre',
      text: `openspec validate ${changeSlug} --strict --no-interactive`,
    });
    output.createDiv({
      cls: 'plupro-muted',
      text: '该动作只展示只读验证命令;归档仍需要人工在 OpenSpec 流程中确认。',
    });
  }

  private reviewSourcesForProject(entry: ProjectEntry): Array<{ label: string; path: string; changeSlug?: string }> {
    const sources: Array<{ label: string; path: string; changeSlug?: string }> = [
      { label: `Project manifest: ${entry.manifest.slug}`, path: entry.manifest.manifestPath },
    ];
    for (const change of entry.changes) {
      sources.push({ label: `${change.slug} proposal`, path: change.proposalPath, changeSlug: change.slug });
      if (change.designPath) sources.push({ label: `${change.slug} design`, path: change.designPath, changeSlug: change.slug });
      if (change.tasksPath) sources.push({ label: `${change.slug} tasks`, path: change.tasksPath, changeSlug: change.slug });
    }
    return sources;
  }

  private renderUnassignedDetail(snapshot: ProjectIndexSnapshot): void {
    if (!this.detailPaneEl) return;
    this.detailPaneEl.createEl('h2', { text: '未分类 changes' });
    if (snapshot.unassigned.length === 0) {
      this.detailPaneEl.createDiv({ cls: 'plupro-empty', text: '全部 change 已分类' });
      return;
    }
    const ul = this.detailPaneEl.createEl('ul', { cls: 'plupro-change-list' });
    for (const c of snapshot.unassigned) {
      const li = ul.createEl('li', { cls: 'plupro-change-item' });
      const slugEl = li.createDiv({ cls: 'plupro-change-slug plupro-clickable', text: c.slug });
      this.attachPreviewBehavior(slugEl, c.proposalPath);
      const assignBtn = li.createEl('button', { cls: 'plupro-assign-btn', text: '归并到项目…' });
      assignBtn.addEventListener('click', (evt) => {
        evt.stopPropagation();
        this.plugin.openAssignmentModal(c);
      });
    }
  }

  /**
   * 给 change slug 元素挂悬停预览(走 Obsidian Page Preview 核心插件)+ 点击在右侧
   * split pane 打开 proposal.md。让用户在归并前能快速判断 change 的主题归属。
   */
  private attachPreviewBehavior(el: HTMLElement, proposalPath: string): void {
    el.setAttr('title', `悬停预览 / 点击打开:${proposalPath}`);
    el.addEventListener('mouseover', (evt) => {
      this.app.workspace.trigger('hover-link', {
        event: evt,
        source: 'plupro-control-tower',
        hoverParent: this,
        targetEl: el,
        linktext: proposalPath,
      });
    });
    el.addEventListener('click', async (evt) => {
      evt.stopPropagation();
      const file = this.app.vault.getAbstractFileByPath(proposalPath);
      if (!(file instanceof TFile)) {
        return;
      }
      const leaf = this.app.workspace.getLeaf('split', 'vertical');
      await leaf.openFile(file);
    });
  }

  /**
   * 按 system 字段聚合 4 类计数,供 segmented control 显示。
   */
  private countBySystem(snapshot: ProjectIndexSnapshot): Record<SystemFilter, number> {
    const counts: Record<SystemFilter, number> = { all: 0, HIC: 0, EVS: 0, unassigned: 0 };
    for (const entry of snapshot.projects.values()) {
      counts.all += 1;
      const key = (entry.manifest.system ?? 'unassigned') as SystemFilter;
      counts[key] += 1;
    }
    return counts;
  }

  /**
   * 按 systemFilter 过滤项目,分组到 HIC / EVS / unassigned 三个桶,桶内按 title
   * 中文字典序排序,空桶被过滤掉。组间顺序固定 HIC → EVS → unassigned。
   */
  private groupProjectsBySystem(
    snapshot: ProjectIndexSnapshot,
  ): Array<{ system: SystemFilter; entries: ProjectEntry[] }> {
    const buckets = new Map<SystemFilter, ProjectEntry[]>();
    for (const entry of snapshot.projects.values()) {
      const key = (entry.manifest.system ?? 'unassigned') as SystemFilter;
      if (this.systemFilter !== 'all' && this.systemFilter !== key) continue;
      const arr = buckets.get(key) ?? [];
      arr.push(entry);
      buckets.set(key, arr);
    }
    const collator = new Intl.Collator('zh-CN');
    for (const arr of buckets.values()) {
      arr.sort((a, b) => collator.compare(a.manifest.title, b.manifest.title));
    }
    const order: SystemFilter[] = ['HIC', 'EVS', 'unassigned'];
    return order
      .map((system) => ({ system, entries: buckets.get(system) ?? [] }))
      .filter((g) => g.entries.length > 0);
  }

  private renderProgressBar(parent: HTMLElement, pct: number): void {
    const bar = parent.createDiv({ cls: 'plupro-progress-bar' });
    const fill = bar.createDiv({ cls: 'plupro-progress-fill' });
    fill.style.width = `${pct}%`;
  }
}

function entryHasIssue(entry: ProjectEntry | undefined, issue: HealthIssue): boolean {
  if (!entry || !issue.changeSlug) return false;
  return entry.changes.some((change) => change.slug === issue.changeSlug);
}
