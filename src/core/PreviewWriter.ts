import { App, TFile } from 'obsidian';
import type { WritePreview } from '../types';
import { FrontmatterIO, parseFrontmatterFromText } from './FrontmatterIO';
import { SidecarStore } from './SidecarStore';
import { applyPreviewToText } from './WritePreview';

export class PreviewWriter {
  private readonly frontmatterIO: FrontmatterIO;
  private readonly sidecarStore: SidecarStore;

  constructor(
    private readonly app: App,
    rootPath: string,
    frontmatterIO?: FrontmatterIO,
    sidecarStore?: SidecarStore,
  ) {
    this.frontmatterIO = frontmatterIO ?? new FrontmatterIO(app);
    this.sidecarStore = sidecarStore ?? new SidecarStore(app, rootPath);
  }

  async apply(preview: WritePreview): Promise<WritePreview> {
    const currentText = await this.readTargetText(preview.targetPath);
    const nextText = applyPreviewToText(preview, currentText);

    if (preview.targetPath.endsWith('.json')) {
      await this.writeWithAdapter(preview.targetPath, nextText);
    } else if (isFrontmatterOperation(preview.operation)) {
      await this.applyFrontmatterDelta(preview.targetPath, preview.beforeText, preview.afterText);
    } else {
      await this.modifyVaultFile(preview.targetPath, nextText);
    }

    const applied = { ...preview, status: 'applied' as const };
    await this.sidecarStore.saveWritePreview(applied);
    return applied;
  }

  private async readTargetText(targetPath: string): Promise<string> {
    if (await this.app.vault.adapter.exists(targetPath)) {
      return this.app.vault.adapter.read(targetPath);
    }
    const file = this.resolveFile(targetPath);
    if (!file) {
      throw new Error(`无法定位写入目标:${targetPath}`);
    }
    return this.app.vault.read(file);
  }

  private async applyFrontmatterDelta(targetPath: string, beforeText: string, afterText: string): Promise<void> {
    const file = this.resolveFile(targetPath);
    if (!file) {
      throw new Error(`无法定位写入目标:${targetPath}`);
    }
    const before = parseFrontmatterFromText(beforeText);
    const after = parseFrontmatterFromText(afterText);
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);

    for (const key of keys) {
      if (!(key in after)) {
        await this.frontmatterIO.removeField(file, key);
      } else if (!sameJsonValue(before[key], after[key])) {
        await this.frontmatterIO.setField(file, key, after[key]);
      }
    }
  }

  private async modifyVaultFile(targetPath: string, nextText: string): Promise<void> {
    const file = this.resolveFile(targetPath);
    if (!file) {
      throw new Error(`无法定位写入目标:${targetPath}`);
    }
    await this.app.vault.modify(file, nextText);
  }

  private resolveFile(targetPath: string): TFile | null {
    const target = this.app.vault.getAbstractFileByPath(targetPath);
    return target instanceof TFile ? target : null;
  }

  private async writeWithAdapter(path: string, text: string): Promise<void> {
    await this.ensureAdapterFolder(path.split('/').slice(0, -1).join('/'));
    await this.app.vault.adapter.write(path, text);
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

function isFrontmatterOperation(operation: WritePreview['operation']): boolean {
  return operation === 'set-frontmatter' || operation === 'mark-pending-analysis';
}

function sameJsonValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
