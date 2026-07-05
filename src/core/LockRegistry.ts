import type { AssignmentLock } from '../types';

export interface AcquireLockOptions {
  now?: string;
  dirtyPaths?: string[];
}

export interface AcquireLockResult {
  acquired: boolean;
  locks: AssignmentLock[];
  hardConflicts: AssignmentLock[];
  warnings: string[];
}

const AI_OWNERS = new Set(['codex', 'claude']);

export function acquireLock(
  locks: AssignmentLock[],
  candidate: AssignmentLock,
  options: AcquireLockOptions = {},
): AcquireLockResult {
  const now = options.now ?? new Date().toISOString();
  const hardConflicts = locks.filter((existing) => isHardConflict(existing, candidate, now));
  const warnings = (options.dirtyPaths ?? []).map((path) => `dirty-worktree-warning: ${path}`);

  if (hardConflicts.length > 0) {
    return { acquired: false, locks, hardConflicts, warnings };
  }

  return {
    acquired: true,
    locks: [...locks, candidate],
    hardConflicts: [],
    warnings,
  };
}

export function releaseLock(locks: AssignmentLock[], assignmentId: string, releasedAt = new Date().toISOString()): AssignmentLock[] {
  return locks.map((lock) => {
    if (lock.assignmentId !== assignmentId || lock.releasedAt) {
      return lock;
    }
    return { ...lock, releasedAt };
  });
}

export function pathsOverlap(left: string, right: string): boolean {
  const a = normalizePath(left);
  const b = normalizePath(right);
  return a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`);
}

function isHardConflict(existing: AssignmentLock, candidate: AssignmentLock, now: string): boolean {
  if (!isActiveLock(existing, now)) return false;
  if (existing.assignmentId === candidate.assignmentId) return false;
  if (!isAIOwner(existing.owner) || !isAIOwner(candidate.owner)) return false;
  return existing.paths.some((existingPath) =>
    candidate.paths.some((candidatePath) => pathsOverlap(existingPath, candidatePath)),
  );
}

function isActiveLock(lock: AssignmentLock, now: string): boolean {
  if (lock.releasedAt) return false;
  if (!lock.expiresAt) return true;
  return Date.parse(lock.expiresAt) > Date.parse(now);
}

function isAIOwner(owner: string): boolean {
  return AI_OWNERS.has(owner);
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');
}
