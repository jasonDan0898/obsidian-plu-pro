import type { AIAssignment } from '../types';

export interface ManualAssignmentRun {
  mode: 'manual';
  assignmentId: string;
  command: string;
  resultPath: string;
  instructions: string;
}

export class AssignmentRunner {
  prepareManualRun(assignment: AIAssignment): ManualAssignmentRun {
    return {
      mode: 'manual',
      assignmentId: assignment.id,
      command: assignment.triggerCommand,
      resultPath: assignment.resultPath,
      instructions: [
        '手动运行上面的命令。',
        `完成后把结果写入 ${assignment.resultPath}。`,
        '控制塔会扫描 ai-results 并沉淀 Evidence sidecar。',
      ].join('\n'),
    };
  }
}
