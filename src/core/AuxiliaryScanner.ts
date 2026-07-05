import type { App, TFile, TFolder } from 'obsidian';
import type { DocumentKind, DocumentRecord, PluginSettings } from '../types';
import { stableHash, makeStableId } from './Hash';

const DEFAULT_SCAN_ROOTS = [
  'docs/superpowers/specs',
  'docs/superpowers/plans',
  '06-standards/工作计划',
  '_meta/openspec-control-tower',
  '.lavish',
];

export class AuxiliaryScanner {
  constructor(private readonly app: App, private readonly settings: PluginSettings) {}

  async scanAll(): Promise<DocumentRecord[]> {
    const roots = [
      ...DEFAULT_SCAN_ROOTS.filter((root) => root !== this.settings.controlTowerMetaPath),
      this.settings.controlTowerMetaPath,
    ];
    const records: DocumentRecord[] = [];
    const seen = new Set<string>();
    for (const root of roots) {
      const folder = this.app.vault.getAbstractFileByPath(root);
      if (!folder || !this.isFolder(folder)) {
        continue;
      }
      for (const file of this.findFiles(folder as TFolder)) {
        if (seen.has(file.path) || !this.shouldInclude(file)) {
          continue;
        }
        seen.add(file.path);
        const record = await this.toDocumentRecord(file);
        if (record) {
          records.push(record);
        }
      }
    }
    return records;
  }

  private async toDocumentRecord(file: TFile): Promise<DocumentRecord | null> {
    const text = await this.app.vault.read(file);
    const metadata = this.extractMetadata(file.path, text);
    return {
      id: `doc:${makeStableId([file.path])}`,
      kind: this.kindForPath(file.path),
      path: file.path,
      title: this.titleForPath(file.path, text),
      hash: stableHash(text),
      bytes: this.sizeOf(file, text),
      source: file.path.startsWith('.lavish/') ? 'derived' : 'source',
      metadata,
    };
  }

  private extractMetadata(path: string, text: string): Record<string, unknown> | undefined {
    if (path === `${this.settings.controlTowerMetaPath}/openspec-index.json`) {
      try {
        const parsed = JSON.parse(text) as Record<string, unknown>;
        const vaultRoot = typeof parsed.vaultRoot === 'string' ? parsed.vaultRoot : undefined;
        const generatedAt = typeof parsed.generatedAt === 'string' ? parsed.generatedAt : undefined;
        const staleReasons: string[] = [];
        if (vaultRoot && !vaultRoot.includes('/EVS/eda-docs-vault')) {
          staleReasons.push(`vaultRoot=${vaultRoot}`);
        }
        if (generatedAt) {
          const ageMs = Date.now() - Date.parse(generatedAt);
          if (Number.isFinite(ageMs) && ageMs > 1000 * 60 * 60 * 24 * 14) {
            staleReasons.push(`generatedAt=${generatedAt}`);
          }
        }
        return { vaultRoot, generatedAt, staleReasons };
      } catch {
        return { staleReasons: ['invalid-json'] };
      }
    }
    return undefined;
  }

  private kindForPath(path: string): DocumentKind {
    if (path.startsWith('docs/superpowers/specs/')) return 'superpowers-spec';
    if (path.startsWith('docs/superpowers/plans/')) return 'superpowers-plan';
    if (path.startsWith('06-standards/工作计划/')) return 'weekly-plan';
    if (path.startsWith('.lavish/')) return 'lavish-metadata';
    if (path.includes('/reviews/') || path.includes('/write-previews/')) return 'review-artifact';
    if (path.startsWith(this.settings.controlTowerMetaPath + '/')) return 'sidecar';
    return 'evidence';
  }

  private titleForPath(path: string, text: string): string {
    const heading = text.match(/^#\s+(.+)$/m)?.[1]?.trim();
    if (heading) {
      return heading;
    }
    return path.split('/').pop() ?? path;
  }

  private shouldInclude(file: TFile): boolean {
    if (file.path.startsWith('.lavish/')) {
      return ['json', 'md', 'txt'].includes(file.extension);
    }
    return ['md', 'json', 'txt'].includes(file.extension);
  }

  private findFiles(folder: TFolder): TFile[] {
    const out: TFile[] = [];
    const visit = (node: TFolder): void => {
      for (const child of node.children) {
        if (this.isFile(child)) {
          out.push(child as TFile);
        } else if (this.isFolder(child)) {
          visit(child as TFolder);
        }
      }
    };
    visit(folder);
    return out;
  }

  private sizeOf(file: TFile, text: string): number {
    const maybeStat = file as TFile & { stat?: { size?: number } };
    return typeof maybeStat.stat?.size === 'number' ? maybeStat.stat.size : text.length;
  }

  private isFolder(item: unknown): item is TFolder {
    return !!item && typeof item === 'object' && 'children' in (item as object);
  }

  private isFile(item: unknown): item is TFile {
    return !!item && typeof item === 'object' && 'extension' in (item as object);
  }
}
