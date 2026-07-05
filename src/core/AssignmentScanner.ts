import type { Evidence } from '../types';
import type { AssignmentStore } from './AssignmentStore';
import { releaseLock } from './LockRegistry';

export interface AssignmentScannerOptions {
  now?: string;
}

export interface AssignmentScanSummary {
  scanned: string[];
  skipped: string[];
  evidencePaths: string[];
}

export class AssignmentScanner {
  constructor(
    private readonly store: AssignmentStore,
    private readonly options: AssignmentScannerOptions = {},
  ) {}

  async scanResults(): Promise<AssignmentScanSummary> {
    const now = this.options.now ?? new Date().toISOString();
    const assignments = await this.store.listAssignments();
    const scanned: string[] = [];
    const skipped: string[] = [];
    const evidencePaths: string[] = [];

    for (const assignment of assignments) {
      if (assignment.status === 'closed') {
        continue;
      }
      const result = await this.store.readResult(assignment.id);
      if (!result) {
        skipped.push(assignment.id);
        continue;
      }

      const evidence: Evidence = {
        schemaVersion: 1,
        id: assignment.id,
        assignmentId: assignment.id,
        command: result.command,
        exitCode: result.exitCode,
        outputSummary: result.outputSummary,
        diffSummary: result.diffSummary,
        testResults: result.testResults,
        unverified: result.unverified,
        deviations: result.deviations,
        recordedAt: now,
      };
      evidencePaths.push(await this.store.writeEvidence(evidence));
      await this.store.writeLocks(releaseLock(await this.store.readLocks(), assignment.id, now));
      await this.store.writeAssignment({
        ...assignment,
        status: 'returned',
        lock: assignment.lock && !assignment.lock.releasedAt ? { ...assignment.lock, releasedAt: now } : assignment.lock,
        updatedAt: now,
      });
      scanned.push(assignment.id);
    }

    return { scanned, skipped, evidencePaths };
  }
}
