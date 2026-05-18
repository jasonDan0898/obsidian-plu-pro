import { ItemView, Plugin, TFile, WorkspaceLeaf } from 'obsidian';
import type { ChangeEntry, ProjectEntry, ProjectIndexSnapshot, SystemFilter } from '../types';

export const VIEW_TYPE_CONTROL_TOWER = 'plupro-control-tower';

/**
 * 视图只需要插件暴露的最小行为子集 — 同样为了避免 view ↔ main 循环
 * type-import,这里定义 inline contract,PluProPlugin 隐式满足。
 */
export interface PluProPluginForView extends Plugin {
  getIndex(): ProjectIndexSnapshot;
  openAssignmentModal(target: ChangeEntry): void;
  refreshIndex(): Promise<void>;
  markProjectForAnalysis(file: TFile): Promise<void>;
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
          title.createSpan({ cls: 'plupro-badge plupro-badge-pending', text: ' 🟡 待分析' });
        } else if (fm.generatedChanges && fm.generatedChanges.length > 0) {
          title.createSpan({
            cls: 'plupro-badge plupro-badge-done',
            text: ` 🟢 已拆解(${fm.generatedChanges.length})`,
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
      this.detailPaneEl.createDiv({ cls: 'plupro-hint', text: '选择左侧项目查看详情' });
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
    const actions = this.detailPaneEl.createDiv({ cls: 'plupro-detail-actions' });
    const analyzeBtn = actions.createEl('button', {
      cls: 'plupro-analyze-btn',
      text: '🤖 用 Claude 分析此项目',
    });
    analyzeBtn.addEventListener('click', () => {
      const file = this.app.vault.getAbstractFileByPath(entry.manifest.manifestPath);
      if (file instanceof TFile) {
        void this.plugin.markProjectForAnalysis(file);
      }
    });
    const meta = this.detailPaneEl.createDiv({ cls: 'plupro-detail-meta' });
    meta.createSpan({ text: `状态:${entry.manifest.status}` });
    if (entry.manifest.owner) {
      meta.createSpan({ text: ` · 负责人:${entry.manifest.owner}` });
    }
    if (entry.manifest.scope && entry.manifest.scope.length > 0) {
      meta.createSpan({ text: ` · 能力域:${entry.manifest.scope.join(', ')}` });
    }
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
