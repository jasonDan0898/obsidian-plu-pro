import { acquireLock, releaseLock } from '../src/core/LockRegistry';
import type { AssignmentLock } from '../src/types';

const now = '2026-07-05T00:00:00.000Z';

function lock(overrides: Partial<AssignmentLock> = {}): AssignmentLock {
  return {
    assignmentId: 'assignment-a',
    owner: 'codex',
    paths: ['src/core'],
    lockedAt: now,
    ...overrides,
  };
}

describe('LockRegistry', () => {
  it('blocks AI-AI locks when paths overlap by ancestor or descendant', () => {
    const existing = lock({ assignmentId: 'assignment-a', owner: 'codex', paths: ['src/core'] });
    const candidate = lock({
      assignmentId: 'assignment-b',
      owner: 'claude',
      paths: ['src/core/AssignmentBuilder.ts'],
    });

    const result = acquireLock([existing], candidate, { now });

    expect(result.acquired).toBe(false);
    expect(result.hardConflicts.map((item) => item.assignmentId)).toEqual(['assignment-a']);
    expect(result.locks).toEqual([existing]);
  });

  it('allows acquisition with unrelated dirty file warnings', () => {
    const candidate = lock({ assignmentId: 'assignment-b', owner: 'codex', paths: ['src/core/AssignmentBuilder.ts'] });

    const result = acquireLock([], candidate, { now, dirtyPaths: ['README.md'] });

    expect(result.acquired).toBe(true);
    expect(result.warnings).toEqual(['dirty-worktree-warning: README.md']);
    expect(result.locks).toEqual([candidate]);
  });

  it('marks active locks as released and ignores released locks for new acquisition', () => {
    const released = releaseLock([lock()], 'assignment-a', '2026-07-05T00:05:00.000Z');
    const candidate = lock({ assignmentId: 'assignment-b', owner: 'claude', paths: ['src/core/PreviewWriter.ts'] });

    const result = acquireLock(released, candidate, { now });

    expect(released[0].releasedAt).toBe('2026-07-05T00:05:00.000Z');
    expect(result.acquired).toBe(true);
    expect(result.hardConflicts).toEqual([]);
  });
});
