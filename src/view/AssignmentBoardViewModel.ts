import type { AIAssignment, AssignmentStatus } from '../types';

export interface AssignmentBoardRow {
  id: string;
  title: string;
  targetRef: string;
  status: AssignmentStatus;
  taskSummary: string;
  command: string;
  resultPath: string;
  evidencePath: string;
  workspaceRisk: string;
  canRunManually: boolean;
  canScanResult: boolean;
  updatedAt: string;
}

export interface AssignmentBoardViewModel {
  total: number;
  byStatus: Record<AssignmentStatus, number>;
  rows: AssignmentBoardRow[];
}

const STATUS_ORDER: Record<AssignmentStatus, number> = {
  running: 0,
  locked: 1,
  draft: 2,
  returned: 3,
  closed: 4,
};

export function createAssignmentBoardViewModel(assignments: AIAssignment[]): AssignmentBoardViewModel {
  const byStatus: Record<AssignmentStatus, number> = {
    draft: 0,
    locked: 0,
    running: 0,
    returned: 0,
    closed: 0,
  };

  const rows = assignments
    .map((assignment) => {
      byStatus[assignment.status] += 1;
      return toRow(assignment);
    })
    .sort((left, right) => {
      const statusDelta = STATUS_ORDER[left.status] - STATUS_ORDER[right.status];
      if (statusDelta !== 0) return statusDelta;
      return right.updatedAt.localeCompare(left.updatedAt) || left.id.localeCompare(right.id);
    });

  return {
    total: assignments.length,
    byStatus,
    rows,
  };
}

function toRow(assignment: AIAssignment): AssignmentBoardRow {
  return {
    id: assignment.id,
    title: assignment.title,
    targetRef: assignment.targetRef,
    status: assignment.status,
    taskSummary: assignment.taskRefs.map((task) => `${task.section}: ${task.text}`).join(' / '),
    command: assignment.triggerCommand,
    resultPath: assignment.resultPath,
    evidencePath: assignment.writeBackTo,
    workspaceRisk: assignment.workspaceRisk,
    canRunManually: assignment.status !== 'closed' && assignment.status !== 'returned',
    canScanResult: assignment.status === 'running' || assignment.status === 'locked' || assignment.status === 'draft',
    updatedAt: assignment.updatedAt,
  };
}
