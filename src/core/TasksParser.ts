import type { TaskProgress, TaskGroupProgress } from '../types';

const SECTION_HEADER = /^##\s+(.+?)\s*$/;
const TASK_DONE = /^\s*-\s*\[x\]\s/i;
const TASK_TODO = /^\s*-\s*\[ \]\s/;

export function parseTasks(text: string): TaskProgress {
  const lines = text.split(/\r?\n/);
  const groups: TaskGroupProgress[] = [];
  let current: TaskGroupProgress = { heading: '(未分组)', done: 0, total: 0 };
  let seenAny = false;

  for (const line of lines) {
    const headerMatch = line.match(SECTION_HEADER);
    if (headerMatch) {
      if (seenAny || current.total > 0) {
        groups.push(current);
      }
      current = { heading: headerMatch[1], done: 0, total: 0 };
      seenAny = true;
      continue;
    }

    if (TASK_DONE.test(line)) {
      current.done += 1;
      current.total += 1;
    } else if (TASK_TODO.test(line)) {
      current.total += 1;
    }
  }

  if (seenAny || current.total > 0) {
    groups.push(current);
  }

  if (groups.length === 0) {
    groups.push({ heading: '(未分组)', done: 0, total: 0 });
  }

  const totalDone = groups.reduce((sum, g) => sum + g.done, 0);
  const totalCount = groups.reduce((sum, g) => sum + g.total, 0);

  return { totalDone, totalCount, groups };
}
