import type { WritePreview } from '../types';
import { mergeFrontmatterIntoText } from './FrontmatterIO';
import { stableHash, makeStableId } from './Hash';

export function isBlockedWriteTarget(targetPath: string): boolean {
  const normalized = targetPath.replace(/\\/g, '/');
  return (
    normalized.startsWith('openspec/specs/') ||
    normalized.includes('/openspec/specs/') ||
    normalized.includes('/archive/') ||
    normalized.endsWith('/archive') ||
    normalized.includes('ht-ml.app')
  );
}

export function createFrontmatterPreview(input: {
  targetPath: string;
  beforeText: string;
  patch: Record<string, unknown>;
  operation: WritePreview['operation'];
  source?: WritePreview['source'];
  now?: string;
}): WritePreview {
  if (isBlockedWriteTarget(input.targetPath)) {
    throw new Error(`受控写入禁止目标:${input.targetPath}`);
  }
  const now = input.now ?? new Date().toISOString();
  const afterText = mergeFrontmatterIntoText(input.beforeText, input.patch);
  const targetHash = stableHash(input.beforeText);
  return {
    id: `preview-${makeStableId([input.targetPath, targetHash, now])}`,
    operation: input.operation,
    targetPath: input.targetPath,
    targetHash,
    beforeText: input.beforeText,
    afterText,
    diff: createUnifiedDiff(input.beforeText, afterText),
    status: 'preview',
    createdAt: now,
    source: input.source ?? 'plugin',
    rollbackHint: `如需回滚,用 write-previews/${targetHash} 记录里的 beforeText 覆盖 ${input.targetPath}`,
  };
}

export function createPendingAnalysisPreview(input: {
  manifestPath: string;
  manifestText: string;
  slug: string;
  now?: string;
}): WritePreview {
  return createFrontmatterPreview({
    targetPath: input.manifestPath,
    beforeText: input.manifestText,
    operation: 'mark-pending-analysis',
    patch: {
      'pending-analysis': true,
      'last-analyzed': input.now ?? new Date().toISOString(),
    },
    now: input.now,
  });
}

export function applyPreviewToText(preview: WritePreview, currentText: string): string {
  if (isBlockedWriteTarget(preview.targetPath)) {
    throw new Error(`受控写入禁止目标:${preview.targetPath}`);
  }
  const currentHash = stableHash(currentText);
  if (currentHash !== preview.targetHash) {
    throw new Error(`目标文件已变化,拒绝 apply: expected ${preview.targetHash}, got ${currentHash}`);
  }
  return preview.afterText;
}

export function createUnifiedDiff(beforeText: string, afterText: string): string {
  if (beforeText === afterText) {
    return '(no changes)';
  }
  const beforeLines = beforeText.split(/\r?\n/);
  const afterLines = afterText.split(/\r?\n/);
  const max = Math.max(beforeLines.length, afterLines.length);
  const lines: string[] = ['--- before', '+++ after'];
  for (let i = 0; i < max; i += 1) {
    const before = beforeLines[i];
    const after = afterLines[i];
    if (before === after) {
      continue;
    }
    if (typeof before === 'string') {
      lines.push(`-${before}`);
    }
    if (typeof after === 'string') {
      lines.push(`+${after}`);
    }
  }
  return lines.join('\n');
}
