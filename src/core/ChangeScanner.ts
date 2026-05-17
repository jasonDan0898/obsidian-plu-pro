import type { App, TFile, TFolder } from 'obsidian';
import type { ChangeEntry, ChangeFrontmatter } from '../types';
import { parseFrontmatterFromText } from './FrontmatterIO';
import { parseTasks } from './TasksParser';

export interface ScanInput {
  slug: string;
  proposalPath: string;
  proposalText: string;
  tasksText: string | undefined;
}

export function scanChangeFromDisk(input: ScanInput): ChangeEntry {
  const frontmatter = parseFrontmatterFromText(input.proposalText) as ChangeFrontmatter;
  const taskProgress = input.tasksText
    ? parseTasks(input.tasksText)
    : { totalDone: 0, totalCount: 0, groups: [{ heading: '(未分组)', done: 0, total: 0 }] };

  return {
    slug: input.slug,
    proposalPath: input.proposalPath,
    frontmatter,
    taskProgress,
    blockers: [],
  };
}

export class ChangeScanner {
  constructor(private readonly app: App, private readonly changesRoot: string) {}

  async scanAll(): Promise<ChangeEntry[]> {
    const folder = this.app.vault.getAbstractFileByPath(this.changesRoot);
    if (!folder || !this.isFolder(folder)) {
      return [];
    }
    const entries: ChangeEntry[] = [];
    for (const child of (folder as TFolder).children) {
      if (!this.isFolder(child) || child.name === 'archive') {
        continue;
      }
      const entry = await this.scanOne(child as TFolder);
      if (entry) {
        entries.push(entry);
      }
    }
    return entries;
  }

  async scanOne(folder: TFolder): Promise<ChangeEntry | null> {
    const proposal = folder.children.find(
      (f) => this.isFile(f) && (f as TFile).basename === 'proposal',
    ) as TFile | undefined;
    if (!proposal) {
      return null;
    }
    const tasks = folder.children.find(
      (f) => this.isFile(f) && (f as TFile).basename === 'tasks',
    ) as TFile | undefined;

    const proposalText = await this.app.vault.read(proposal);
    const tasksText = tasks ? await this.app.vault.read(tasks) : undefined;

    return scanChangeFromDisk({
      slug: folder.name,
      proposalPath: proposal.path,
      proposalText,
      tasksText,
    });
  }

  private isFolder(item: unknown): item is TFolder {
    return !!item && typeof item === 'object' && 'children' in (item as object);
  }

  private isFile(item: unknown): item is TFile {
    return !!item && typeof item === 'object' && 'extension' in (item as object);
  }
}
