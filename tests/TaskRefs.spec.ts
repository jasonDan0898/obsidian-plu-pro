import { toAssignmentTaskRefs } from '../src/core/TaskRefs';
import type { TaskItem } from '../src/types';

describe('TaskRefs', () => {
  it('maps existing TaskItem records to assignment task refs without inventing a second task model', () => {
    const items: TaskItem[] = [
      { line: 3, heading: 'T3. 任务解析', text: '复用 TaskItem', done: false },
      { line: 4, heading: 'T3. 任务解析', text: '已完成任务', done: true },
      { line: 9, heading: 'T4. Assignment Builder', text: '生成任务包', done: false },
    ];

    expect(toAssignmentTaskRefs(items)).toEqual([
      { section: 'T3. 任务解析', text: '复用 TaskItem' },
      { section: 'T4. Assignment Builder', text: '生成任务包' },
    ]);
  });

  it('falls back to the current next open task when no full item list is present', () => {
    expect(
      toAssignmentTaskRefs(undefined, {
        fallback: { line: 12, heading: 'TDD', text: '下一步任务', done: false },
      }),
    ).toEqual([{ section: 'TDD', text: '下一步任务' }]);
  });
});
