import type { TaskItem, TaskProgress, TaskGroupProgress } from '../types';

const SECTION_HEADER = /^##\s+(.+?)\s*$/;
const TASK_DONE = /^\s*-\s*\[x\]\s/i;
const TASK_TODO = /^\s*-\s*\[ \]\s/;
const TASK_LINE = /^\s*-\s*\[( |x|X)\]\s+(.*)$/;
const COMMENT_OPEN = /<!--/;
const COMMENT_CLOSE = /-->/;
const INLINE_COMMENT = /<!--.*?-->/g;

function stripInlineComments(line: string): string {
  return line.replace(INLINE_COMMENT, '');
}

export function parseTasks(text: string): TaskProgress {
  const lines = text.split(/\r?\n/);
  const groups: TaskGroupProgress[] = [];
  let current: TaskGroupProgress = { heading: '(未分组)', done: 0, total: 0 };
  let seenAny = false;
  let inComment = false;
  const items: TaskItem[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index];
    if (inComment) {
      if (COMMENT_CLOSE.test(rawLine)) {
        inComment = false;
      }
      continue;
    }

    const line = stripInlineComments(rawLine);

    if (COMMENT_OPEN.test(line)) {
      inComment = true;
      continue;
    }

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

    const itemMatch = line.match(TASK_LINE);
    if (itemMatch) {
      items.push({
        line: index + 1,
        heading: current.heading,
        text: itemMatch[2].trim(),
        done: itemMatch[1].toLowerCase() === 'x',
      });
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
  const nextOpenTask = items.find((item) => !item.done);

  return { totalDone, totalCount, groups, items, nextOpenTask };
}
