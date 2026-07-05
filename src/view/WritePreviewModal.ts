import { App, Modal } from 'obsidian';
import type { WritePreview } from '../types';

export function confirmWritePreview(app: App, preview: WritePreview): Promise<boolean> {
  return new Promise((resolve) => {
    new WritePreviewModal(app, preview, resolve).open();
  });
}

export class WritePreviewModal extends Modal {
  private resolved = false;

  constructor(
    app: App,
    private readonly preview: WritePreview,
    private readonly resolve: (accepted: boolean) => void,
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl('h2', { text: '写入预览' });
    contentEl.createDiv({ cls: 'plupro-path', text: this.preview.targetPath });
    contentEl.createEl('pre', { cls: 'plupro-pre plupro-preview-diff', text: this.preview.diff });

    const actions = contentEl.createDiv({ cls: 'plupro-detail-actions' });
    const applyBtn = actions.createEl('button', { cls: 'plupro-analyze-btn', text: '应用' });
    applyBtn.addEventListener('click', () => this.finish(true));
    const cancelBtn = actions.createEl('button', { cls: 'plupro-secondary-btn', text: '取消' });
    cancelBtn.addEventListener('click', () => this.finish(false));
  }

  onClose(): void {
    this.contentEl.empty();
    if (!this.resolved) {
      this.resolve(false);
    }
  }

  private finish(accepted: boolean): void {
    this.resolved = true;
    this.resolve(accepted);
    this.close();
  }
}
