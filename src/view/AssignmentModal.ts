import { App, Modal, Notice, Setting } from 'obsidian';
import type { ChangeEntry, ProjectEntry, AssignmentCandidate } from '../types';
import { suggestProjects, type SuggestOptions } from '../core/AssignmentSuggester';

export class AssignmentModal extends Modal {
  constructor(
    app: App,
    private readonly target: ChangeEntry,
    private readonly allProjects: ProjectEntry[],
    private readonly onAssign: (projectSlug: string) => Promise<void>,
    private readonly suggestOptions: SuggestOptions = {},
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl('h2', { text: `归并 ${this.target.slug}` });

    const candidates = suggestProjects(this.target, this.allProjects, this.suggestOptions);
    if (candidates.length === 0) {
      contentEl.createDiv({
        cls: 'plupro-hint',
        text: '没有可推荐的候选项目 — 请在下方手动选择',
      });
    } else {
      contentEl.createEl('h3', { text: '推荐候选' });
      for (const candidate of candidates) {
        this.renderCandidate(contentEl, candidate);
      }
    }

    contentEl.createEl('h3', { text: '所有项目' });
    const recommendedSlugs = new Set(candidates.map((c) => c.projectSlug));
    const others = this.allProjects.filter((p) => !recommendedSlugs.has(p.manifest.slug));
    if (others.length === 0) {
      contentEl.createDiv({ cls: 'plupro-hint', text: '(无)' });
    } else {
      for (const p of others) {
        new Setting(contentEl)
          .setName(p.manifest.title)
          .setDesc(p.manifest.slug)
          .addButton((btn) =>
            btn.setButtonText('归并').onClick(() => this.assignAndClose(p.manifest.slug)),
          );
      }
    }
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private renderCandidate(parent: HTMLElement, candidate: AssignmentCandidate): void {
    const project = this.allProjects.find((p) => p.manifest.slug === candidate.projectSlug);
    const displayName = project ? project.manifest.title : candidate.projectSlug;
    new Setting(parent)
      .setName(displayName)
      .setDesc(`${candidate.projectSlug} · 得分 ${candidate.score} — ${candidate.reasons.join(' / ')}`)
      .addButton((btn) =>
        btn
          .setButtonText('归并')
          .setCta()
          .onClick(() => this.assignAndClose(candidate.projectSlug)),
      );
  }

  private async assignAndClose(projectSlug: string): Promise<void> {
    try {
      await this.onAssign(projectSlug);
      new Notice(`已归并 ${this.target.slug} → ${projectSlug}`);
      this.close();
    } catch (err) {
      // 失败时保持 modal 打开,用户可以直接选择其他候选重试。
      new Notice(`归并失败:${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
