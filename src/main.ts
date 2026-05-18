import { Plugin, TFile, WorkspaceLeaf, Notice } from 'obsidian';
import type { PluginSettings, ProjectIndexSnapshot, ChangeEntry } from './types';
import { DEFAULT_SETTINGS } from './types';
import { PluProSettingTab } from './settings';
import { IndexBuilder } from './core/IndexBuilder';
import { FrontmatterIO } from './core/FrontmatterIO';
import { ControlTowerView, VIEW_TYPE_CONTROL_TOWER } from './view/ControlTowerView';
import { AssignmentModal } from './view/AssignmentModal';

export default class PluProPlugin extends Plugin {
  settings: PluginSettings = { ...DEFAULT_SETTINGS };
  private indexBuilder!: IndexBuilder;
  private frontmatterIO!: FrontmatterIO;
  private currentIndex: ProjectIndexSnapshot = {
    projects: new Map(),
    unassigned: [],
    orphanRefs: [],
    slugConflicts: [],
  };
  private refreshTimer: number | null = null;

  async onload(): Promise<void> {
    await this.loadSettings();
    this.indexBuilder = new IndexBuilder(this.app, this.settings);
    this.frontmatterIO = new FrontmatterIO(this.app);

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
  }

  async refreshIndex(): Promise<void> {
    this.currentIndex = await this.indexBuilder.rebuild();
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
        await this.frontmatterIO.setField(file, 'project', projectSlug);
        await this.refreshIndex();
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

    await this.app.fileManager.processFrontMatter(file, (fm) => {
      fm['pending-analysis'] = true;
      fm['last-analyzed'] = new Date().toISOString();
    });

    new Notice(
      `已标记 ${slug} 为待分析。\n在 Claude Code 内运行:/analyze-project ${slug}`,
      8000,
    );

    await this.refreshIndex();
  }

  private registerMetadataCacheListeners(): void {
    const shouldHandle = (file: TFile): boolean => {
      return (
        file.path.startsWith(this.settings.changesPath + '/') ||
        file.path.startsWith(this.settings.projectsPath + '/')
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
}
