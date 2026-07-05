import type { App } from 'obsidian';
import type {
  ArchitectureDecision,
  ReviewAuthor,
  ReviewRecord,
  ReviewStatus,
  ScenarioSimulationResult,
  WritePreview,
} from '../types';
import { stableHash, makeStableId } from './Hash';

export interface ReviewRecordInput {
  sourcePath: string;
  sourceText: string;
  body: string;
  excerpt?: string;
  selector?: string;
  author: ReviewAuthor;
  status?: ReviewStatus;
  projectSlug?: string;
  changeSlug?: string;
  kind?: ReviewRecord['kind'];
  now?: string;
}

export function createReviewRecord(input: ReviewRecordInput): ReviewRecord {
  const now = input.now ?? new Date().toISOString();
  const id = `review-${makeStableId([input.sourcePath, input.body, now])}`;
  return {
    id,
    kind: input.kind ?? 'annotation',
    sourcePath: input.sourcePath,
    sourceHash: stableHash(input.sourceText),
    selector: input.selector,
    excerpt: input.excerpt,
    body: input.body,
    author: input.author,
    status: input.status ?? 'open',
    createdAt: now,
    updatedAt: now,
    projectSlug: input.projectSlug,
    changeSlug: input.changeSlug,
  };
}

export function withStaleReviewFlag(record: ReviewRecord, currentSourceText: string | undefined): ReviewRecord {
  if (typeof currentSourceText !== 'string') {
    return { ...record, stale: true };
  }
  return { ...record, stale: stableHash(currentSourceText) !== record.sourceHash };
}

export function createArchitectureDecision(input: {
  title: string;
  context: string;
  decision: string;
  consequences: string[];
  projectSlug?: string;
  changeSlug?: string;
  now?: string;
}): ArchitectureDecision {
  const now = input.now ?? new Date().toISOString();
  return {
    id: `adr-${makeStableId([input.title, input.decision, now])}`,
    title: input.title,
    projectSlug: input.projectSlug,
    changeSlug: input.changeSlug,
    status: 'proposed',
    context: input.context,
    decision: input.decision,
    consequences: input.consequences,
    createdAt: now,
  };
}

export class SidecarStore {
  constructor(private readonly app: App, private readonly rootPath: string) {}

  async saveReviewRecord(record: ReviewRecord): Promise<string> {
    const path = `${this.rootPath}/reviews/${record.id}.json`;
    await this.writeJson(path, record);
    return path;
  }

  async saveWritePreview(preview: WritePreview): Promise<string> {
    const path = `${this.rootPath}/write-previews/${preview.id}.json`;
    await this.writeJson(path, preview);
    return path;
  }

  async saveArchitectureDecision(decision: ArchitectureDecision): Promise<string> {
    const path = `${this.rootPath}/architecture-decisions/${decision.id}.json`;
    await this.writeJson(path, decision);
    return path;
  }

  async saveScenarioResults(results: ScenarioSimulationResult[]): Promise<string> {
    const id = `scenario-${new Date().toISOString().replace(/[:.]/g, '-')}`;
    const path = `${this.rootPath}/scenario-simulations/${id}.json`;
    await this.writeJson(path, { id, generatedAt: new Date().toISOString(), results });
    return path;
  }

  async listReviewRecords(): Promise<ReviewRecord[]> {
    return this.readJsonFiles<ReviewRecord>(`${this.rootPath}/reviews`);
  }

  async updateReviewStatus(id: string, status: ReviewStatus): Promise<ReviewRecord | null> {
    const path = `${this.rootPath}/reviews/${id}.json`;
    if (!(await this.app.vault.adapter.exists(path))) {
      return null;
    }
    const record = JSON.parse(await this.app.vault.adapter.read(path)) as ReviewRecord;
    const updated: ReviewRecord = { ...record, status, updatedAt: new Date().toISOString() };
    await this.writeJson(path, updated);
    return updated;
  }

  private async readJsonFiles<T>(folderPath: string): Promise<T[]> {
    if (!(await this.app.vault.adapter.exists(folderPath))) {
      return [];
    }
    const listed = await this.app.vault.adapter.list(folderPath);
    const out: T[] = [];
    for (const filePath of listed.files.filter((path) => path.endsWith('.json'))) {
      try {
        out.push(JSON.parse(await this.app.vault.adapter.read(filePath)) as T);
      } catch {
        // Ignore malformed sidecars; health scanner will surface invalid JSON separately.
      }
    }
    return out;
  }

  private async writeJson(path: string, value: unknown): Promise<void> {
    await this.ensureFolder(path.split('/').slice(0, -1).join('/'));
    await this.app.vault.adapter.write(path, `${JSON.stringify(value, null, 2)}\n`);
  }

  private async ensureFolder(folderPath: string): Promise<void> {
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
