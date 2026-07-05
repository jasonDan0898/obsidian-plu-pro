import type { AssignmentTaskRef, TaskItem } from '../types';

export interface TaskRefOptions {
  fallback?: TaskItem;
  limit?: number;
  includeDone?: boolean;
}

export function toAssignmentTaskRefs(
  items: TaskItem[] | undefined,
  options: TaskRefOptions = {},
): AssignmentTaskRef[] {
  const candidates = items && items.length > 0 ? items : options.fallback ? [options.fallback] : [];
  const limit = options.limit ?? 5;

  return candidates
    .filter((item) => options.includeDone || !item.done)
    .slice(0, limit)
    .map((item) => ({
      section: item.heading,
      text: item.text,
    }));
}
