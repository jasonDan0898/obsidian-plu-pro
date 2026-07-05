import { Plugin, TFile, WorkspaceLeaf, Notice } from 'obsidian';
import type { AIAssignment, ContextPackage, PluginSettings, ProjectIndexSnapshot, ChangeEntry, ReviewRecord, WritePreview } from './types';
import { DEFAULT_SETTINGS } from './types';
import { PluProSettingTab } from './settings';
import { IndexBuilder } from './core/IndexBuilder';
import { FrontmatterIO } from './core/FrontmatterIO';
import { createEmptySnapshot } from './core/ProjectIndex';
import { createContextPackage } from './core/ContextPackage';
import { createReviewRecord, SidecarStore } from './core/SidecarStore';
import { createFrontmatterPreview, createPendingAnalysisPreview } from './core/WritePreview';
import { AssignmentScanner, type AssignmentScanSummary } from './core/AssignmentScanner';
import { buildAIAssignment } from './core/AssignmentBuilder';
import { AssignmentRunner, type ManualAssignmentRun } from './core/AssignmentRunner';
import { AssignmentStore } from './core/AssignmentStore';
import { PreviewWriter } from './core/PreviewWriter';
import { ControlTowerView, VIEW_TYPE_CONTROL_TOWER } from './view/ControlTowerView';
import { AssignmentModal } from './view/AssignmentModal';
import { confirmWritePreview } from './view/WritePreviewModal';

export default class PluProPlugin extends Plugin {
  settings: PluginSettings = { ...DEFAULT_SETTINGS };
  private indexBuilder!: IndexBuilder;
  private frontmatterIO!: FrontmatterIO;
  private sidecarStore!: SidecarStore;
  private assignmentStore!: AssignmentStore;
  private assignmentRunner!: AssignmentRunner;
  private previewWriter!: PreviewWriter;
  private currentIndex: ProjectIndexSnapshot = createEmptySnapshot();
  private currentAssignments: AIAssignment[] = [];
  private refreshTimer: number | null = null;

  async onload(): Promise<void> {
    await this.loadSettings();
    this.indexBuilder = new IndexBuilder(this.app, this.settings);
    this.frontmatterIO = new FrontmatterIO(this.app);
    this.sidecarStore = new SidecarStore(this.app, this.settings.controlTowerMetaPath);
    this.assignmentStore = new AssignmentStore(this.app, this.settings.controlTowerMetaPath);
    this.assignmentRunner = new AssignmentRunner();
    this.previewWriter = new PreviewWriter(this.app, this.settings.controlTowerMetaPath, this.frontmatterIO, this.sidecarStore);

    this.registerView(VIEW_TYPE_CONTROL_TOWER, (leaf) => new ControlTowerView(leaf, this));

    this.addRibbonIcon('kanban-square', 'PluPro 项目控制塔', () => {
      void this.activateView();
    });

    this.addCommand({
      id: 'open-control-tower',
      name: '打开项目控制塔',
      callback: () => this.activateView(),
    });

    this.addCommand({
      id: 'refresh-index',
      name: '刷新项目索引',
      callback: () => this.refreshIndex(),
    });

    this.addCommand({
      id: 'mark-project-for-analysis',
      name: '用 Claude 分析此项目',
      checkCallback: (checking: boolean) => {
        const file = this.app.workspace.getActiveFile();
        if (!file || !this.isProjectManifest(file)) {
          return false;
        }
        if (!checking) {
          void this.markProjectForAnalysis(file);
        }
        return true;
      },
    });

    this.addSettingTab(new PluProSettingTab(this.app, this));

    this.app.workspace.onLayoutReady(async () => {
      await this.refreshIndex();
      this.registerMetadataCacheListeners();
    });
  }

  onunload(): void {
    if (this.refreshTimer !== null) {
      window.clearTimeout(this.refreshTimer);
    }
  }

  async loadSettings(): Promise<void> {
    const data = (await this.loadData()) as Partial<PluginSettings> | null;
    this.settings = { ...DEFAULT_SETTINGS, ...(data ?? {}) };
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
    this.indexBuilder = new IndexBuilder(this.app, this.settings);
    this.sidecarStore = new SidecarStore(this.app, this.settings.controlTowerMetaPath);
    this.assignmentStore = new AssignmentStore(this.app, this.settings.controlTowerMetaPath);
    this.previewWriter = new PreviewWriter(this.app, this.settings.controlTowerMetaPath, this.frontmatterIO, this.sidecarStore);
  }

  async refreshIndex(): Promise<void> {
    this.currentIndex = await this.indexBuilder.rebuild();
    this.currentAssignments = await this.assignmentStore.listAssignments();
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_CONTROL_TOWER)) {
      const view = leaf.view;
      if (view instanceof ControlTowerView) {
        view.renderAll(this.currentIndex);
      }
    }
  }

  getIndex(): ProjectIndexSnapshot {
    return this.currentIndex;
  }

  getAIAssignments(): AIAssignment[] {
    return this.currentAssignments;
  }

  async activateView(): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_CONTROL_TOWER);
    if (existing.length > 0) {
      this.app.workspace.revealLeaf(existing[0]);
      return;
    }
    const leaf: WorkspaceLeaf | null = this.app.workspace.getLeaf('tab');
    if (!leaf) {
      new Notice('无法创建视图 leaf');
      return;
    }
    await leaf.setViewState({ type: VIEW_TYPE_CONTROL_TOWER, active: true });
    this.app.workspace.revealLeaf(leaf);
  }

  openAssignmentModal(target: ChangeEntry): void {
    const allProjects = Array.from(this.currentIndex.projects.values());
    new AssignmentModal(
      this.app,
      target,
      allProjects,
      async (projectSlug) => {
        const file = this.app.vault.getAbstractFileByPath(target.proposalPath);
        if (!file || !(file instanceof TFile)) {
          throw new Error(`无法定位 ${target.proposalPath}`);
        }
        const beforeText = await this.app.vault.read(file);
        const preview = createFrontmatterPreview({
          targetPath: file.path,
          beforeText,
          operation: 'set-frontmatter',
          patch: { project: projectSlug },
        });
        if (await this.confirmPreview(preview)) {
          await this.applyWritePreview(preview);
          await this.refreshIndex();
        }
      },
      { enableCapabilityFallback: this.settings.enableCapabilityFallback },
    ).open();
  }

  /**
   * 检查文件是否为 _projects/ 下的有效项目 manifest 文件。
   * - 路径必须在 settings.projectsPath 下
   * - 必须是 .md
   * - 排除 _ 前缀的模板/工具文件(如 _template.md)
   */
  private isProjectManifest(file: TFile): boolean {
    return (
      file.path.startsWith(this.settings.projectsPath + '/') &&
      file.extension === 'md' &&
      !file.basename.startsWith('_')
    );
  }

  /**
   * 标记项目为"待分析",写回 frontmatter pending-analysis: true + last-analyzed,
   * 弹 Notice 提示用户在 Claude Code 跑 /analyze-project <slug>。
   */
  async markProjectForAnalysis(file: TFile): Promise<void> {
    const slug = await this.frontmatterIO.readField<string>(file, 'slug');
    const type = await this.frontmatterIO.readField<string>(file, 'type');

    if (type !== 'project' || !slug) {
      new Notice('当前文件不是有效项目 manifest(缺 type=project 或 slug)');
      return;
    }

    const beforeText = await this.app.vault.read(file);
    const preview = createPendingAnalysisPreview({
      manifestPath: file.path,
      manifestText: beforeText,
      slug,
    });
    if (!(await this.confirmPreview(preview))) {
      new Notice('已取消写入 pending-analysis');
      return;
    }
    await this.applyWritePreview(preview);

    new Notice(
      `已标记 ${slug} 为待分析。\n在 Claude Code 内运行:/analyze-project ${slug}`,
      8000,
    );

    await this.refreshIndex();
  }

  createContextPackage(selection: { projectSlug?: string; changeSlug?: string }): ContextPackage {
    return createContextPackage(this.currentIndex, selection);
  }

  async createAIAssignmentForChange(change: ChangeEntry): Promise<AIAssignment> {
    const assignment = buildAIAssignment({
      change,
      tasks: change.taskProgress.items,
      controlTowerMetaPath: this.settings.controlTowerMetaPath,
    });
    await this.assignmentStore.writeAssignment(assignment);
    this.currentAssignments = await this.assignmentStore.listAssignments();
    this.renderControlTowerViews();
    return assignment;
  }

  async prepareAIAssignmentRun(assignmentId: string): Promise<ManualAssignmentRun | null> {
    const assignment =
      this.currentAssignments.find((item) => item.id === assignmentId) ??
      (await this.assignmentStore.readAssignment(assignmentId));
    return assignment ? this.assignmentRunner.prepareManualRun(assignment) : null;
  }

  async scanAIAssignmentResults(): Promise<AssignmentScanSummary> {
    const summary = await new AssignmentScanner(this.assignmentStore).scanResults();
    this.currentAssignments = await this.assignmentStore.listAssignments();
    this.renderControlTowerViews();
    return summary;
  }

  async createReviewForSource(input: {
    sourcePath: string;
    body: string;
    excerpt?: string;
    projectSlug?: string;
    changeSlug?: string;
  }): Promise<ReviewRecord> {
    const file = this.app.vault.getAbstractFileByPath(input.sourcePath);
    if (!file || !(file instanceof TFile)) {
      throw new Error(`无法定位 review source:${input.sourcePath}`);
    }
    const sourceText = await this.app.vault.read(file);
    const record = createReviewRecord({
      sourcePath: input.sourcePath,
      sourceText,
      body: input.body,
      excerpt: input.excerpt,
      author: 'human',
      status: 'queued',
      projectSlug: input.projectSlug,
      changeSlug: input.changeSlug,
      kind: 'selected-text',
    });
    await this.sidecarStore.saveReviewRecord(record);
    await this.refreshIndex();
    return record;
  }

  async applyWritePreview(preview: WritePreview): Promise<void> {
    await this.previewWriter.apply(preview);
  }

  async exportLocalReviewSurface(selection: { projectSlug?: string; changeSlug?: string }): Promise<string> {
    const pkg = this.createContextPackage(selection);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const name = selection.changeSlug ?? selection.projectSlug ?? 'control-tower';
    const path = `${this.settings.controlTowerMetaPath}/reviews/exports/${stamp}-${name}.html`;
    const html = [
      '<!doctype html>',
      '<html lang="zh-CN"><meta charset="utf-8">',
      '<title>PluPro Local Review Export</title>',
      '<style>body{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;margin:24px;line-height:1.55}pre{white-space:pre-wrap;background:#f6f6f6;padding:12px;border-radius:6px}code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}</style>',
      '<body>',
      `<h1>${escapeHtml(pkg.title)}</h1>`,
      '<p><strong>Derived local artifact.</strong> This file is not an OpenSpec source of truth.</p>',
      `<p>Generated at: ${escapeHtml(pkg.createdAt)}</p>`,
      '<h2>Source paths</h2>',
      `<ul>${pkg.sourcePaths.map((sourcePath) => `<li><code>${escapeHtml(sourcePath)}</code></li>`).join('')}</ul>`,
      '<h2>Summary</h2>',
      `<pre>${escapeHtml(pkg.summary)}</pre>`,
      '<h2>Agent prompt</h2>',
      `<pre>${escapeHtml(pkg.prompt)}</pre>`,
      '</body></html>',
    ].join('\n');
    await this.ensureAdapterFolder(path.split('/').slice(0, -1).join('/'));
    await this.app.vault.adapter.write(path, html);
    return path;
  }

  async saveScenarioSimulationEvidence(): Promise<string> {
    return this.sidecarStore.saveScenarioResults(this.currentIndex.scenarioResults);
  }

  private async confirmPreview(preview: WritePreview): Promise<boolean> {
    return confirmWritePreview(this.app, preview);
  }

  private renderControlTowerViews(): void {
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_CONTROL_TOWER)) {
      const view = leaf.view;
      if (view instanceof ControlTowerView) {
        view.renderAll(this.currentIndex);
      }
    }
  }

  private registerMetadataCacheListeners(): void {
    const shouldHandle = (file: TFile): boolean => {
      return (
        file.path.startsWith(this.settings.changesPath + '/') ||
        file.path.startsWith(this.settings.projectsPath + '/') ||
        file.path.startsWith(this.settings.controlTowerMetaPath + '/') ||
        file.path.startsWith('docs/superpowers/') ||
        file.path.startsWith('06-standards/工作计划/') ||
        file.path.startsWith('.lavish/')
      );
    };
    const scheduleRefresh = (): void => {
      if (this.refreshTimer !== null) {
        window.clearTimeout(this.refreshTimer);
      }
      this.refreshTimer = window.setTimeout(() => {
        this.refreshTimer = null;
        void this.refreshIndex().catch((err) => {
          console.error('[PluPro] refresh failed', err);
        });
      }, 250);
    };

    this.registerEvent(
      this.app.metadataCache.on('changed', (file) => {
        if (file instanceof TFile && shouldHandle(file)) {
          scheduleRefresh();
        }
      }),
    );
    this.registerEvent(
      this.app.vault.on('create', (file) => {
        if (file instanceof TFile && shouldHandle(file)) {
          scheduleRefresh();
        }
      }),
    );
    this.registerEvent(
      this.app.vault.on('delete', (file) => {
        if (file instanceof TFile && shouldHandle(file)) {
          scheduleRefresh();
        }
      }),
    );
    this.registerEvent(
      this.app.vault.on('rename', (file) => {
        if (file instanceof TFile && shouldHandle(file)) {
          scheduleRefresh();
        }
      }),
    );
  }

  private async ensureAdapterFolder(folderPath: string): Promise<void> {
    const parts = folderPath.split('/').filter(Boolean);
    let cursor = '';
    for (const part of parts) {
      cursor = cursor ? `${cursor}/${part}` : part;
      if (!(await this.app.vault.adapter.exists(cursor))) {
        await this.app.vault.adapter.mkdir(cursor);
      }
    }
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
