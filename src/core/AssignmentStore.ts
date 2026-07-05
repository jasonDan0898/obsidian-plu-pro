import type { App } from 'obsidian';
import type { AIAssignment, AIResult, AssignmentLock, Evidence } from '../types';

type JsonRecord = Record<string, unknown>;

export class AssignmentStore {
  constructor(private readonly app: App, private readonly rootPath: string) {}

  async writeAssignment(assignment: AIAssignment): Promise<string> {
    const path = this.assignmentPath(assignment.id);
    await this.writeJson(path, assignment);
    return path;
  }

  async readAssignment(id: string): Promise<AIAssignment | null> {
    return this.readJson<AIAssignment>(this.assignmentPath(id), isAssignment);
  }

  async listAssignments(): Promise<AIAssignment[]> {
    return this.readJsonFiles<AIAssignment>(`${this.rootPath}/ai-assignments`, isAssignment);
  }

  async writeResult(result: AIResult): Promise<string> {
    const path = this.resultPath(result.assignmentId);
    await this.writeJson(path, result);
    return path;
  }

  async readResult(id: string): Promise<AIResult | null> {
    return this.readJson<AIResult>(this.resultPath(id), isResult);
  }

  async writeEvidence(evidence: Evidence): Promise<string> {
    const path = this.evidencePath(evidence.id);
    await this.writeJson(path, evidence);
    return path;
  }

  async readEvidence(id: string): Promise<Evidence | null> {
    return this.readJson<Evidence>(this.evidencePath(id), isEvidence);
  }

  async writeLocks(locks: AssignmentLock[]): Promise<string> {
    const path = `${this.rootPath}/assignment-locks.json`;
    await this.writeJson(path, { schemaVersion: 1, locks });
    return path;
  }

  async readLocks(): Promise<AssignmentLock[]> {
    const payload = await this.readJson<{ locks: AssignmentLock[] }>(
      `${this.rootPath}/assignment-locks.json`,
      (value) => Array.isArray((value as JsonRecord).locks),
    );
    return payload?.locks.filter(isLock) ?? [];
  }

  assignmentPath(id: string): string {
    return `${this.rootPath}/ai-assignments/${id}.json`;
  }

  resultPath(id: string): string {
    return `${this.rootPath}/ai-results/${id}.json`;
  }

  evidencePath(id: string): string {
    return `${this.rootPath}/evidence/${id}.json`;
  }

  private async readJson<T>(path: string, guard: (value: unknown) => boolean): Promise<T | null> {
    try {
      if (!(await this.app.vault.adapter.exists(path))) {
        return null;
      }
      const parsed = JSON.parse(await this.app.vault.adapter.read(path)) as unknown;
      return guard(parsed) ? (parsed as T) : null;
    } catch {
      return null;
    }
  }

  private async readJsonFiles<T>(folderPath: string, guard: (value: unknown) => boolean): Promise<T[]> {
    if (!(await this.app.vault.adapter.exists(folderPath))) {
      return [];
    }
    const listed = await this.app.vault.adapter.list(folderPath);
    const out: T[] = [];
    for (const filePath of listed.files.filter((path) => path.endsWith('.json')).sort()) {
      const item = await this.readJson<T>(filePath, guard);
      if (item) out.push(item);
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

function isAssignment(value: unknown): value is AIAssignment {
  const record = value as JsonRecord;
  return (
    !!record &&
    typeof record === 'object' &&
    record.schemaVersion === 1 &&
    typeof record.id === 'string' &&
    Array.isArray(record.allowPaths) &&
    Array.isArray(record.denyPaths)
  );
}

function isResult(value: unknown): value is AIResult {
  const record = value as JsonRecord;
  return (
    !!record &&
    typeof record === 'object' &&
    typeof record.assignmentId === 'string' &&
    (record.status === 'returned' || record.status === 'failed')
  );
}

function isEvidence(value: unknown): value is Evidence {
  const record = value as JsonRecord;
  return (
    !!record &&
    typeof record === 'object' &&
    record.schemaVersion === 1 &&
    typeof record.id === 'string' &&
    typeof record.assignmentId === 'string'
  );
}

function isLock(value: unknown): value is AssignmentLock {
  const record = value as JsonRecord;
  return (
    !!record &&
    typeof record === 'object' &&
    typeof record.assignmentId === 'string' &&
    Array.isArray(record.paths) &&
    typeof record.owner === 'string' &&
    typeof record.lockedAt === 'string'
  );
}
