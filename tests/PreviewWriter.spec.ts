import type { App } from 'obsidian';
import { Vault } from 'obsidian';
import type { FrontmatterIO } from '../src/core/FrontmatterIO';
import { createFrontmatterPreview } from '../src/core/WritePreview';
import { PreviewWriter } from '../src/core/PreviewWriter';
import { stableHash } from '../src/core/Hash';
import { DEFAULT_SETTINGS, type WritePreview } from '../src/types';

const root = DEFAULT_SETTINGS.controlTowerMetaPath;

function createApp(): App {
  return { vault: new Vault() } as unknown as App;
}

describe('PreviewWriter', () => {
  it('applies frontmatter previews through FrontmatterIO and audits the applied preview', async () => {
    const app = createApp();
    const targetPath = 'openspec/changes/demo/proposal.md';
    const beforeText = '---\nstatus: draft\nremove-me: old\n---\n# Demo\n';
    await app.vault.adapter.write(targetPath, beforeText);
    const preview = createFrontmatterPreview({
      targetPath,
      beforeText,
      operation: 'set-frontmatter',
      patch: { status: 'queued' },
      now: '2026-07-05T00:00:00.000Z',
    });
    preview.afterText = '---\nstatus: queued\n---\n# Demo\n';

    const frontmatterIO = {
      setField: jest.fn(async () => undefined),
      removeField: jest.fn(async () => undefined),
    } as unknown as FrontmatterIO;

    const applied = await new PreviewWriter(app, root, frontmatterIO).apply(preview);

    expect(frontmatterIO.setField).toHaveBeenCalledWith(expect.objectContaining({ path: targetPath }), 'status', 'queued');
    expect(frontmatterIO.removeField).toHaveBeenCalledWith(expect.objectContaining({ path: targetPath }), 'remove-me');
    expect(applied.status).toBe('applied');
    const audit = JSON.parse(await app.vault.adapter.read(`${root}/write-previews/${preview.id}.json`)) as WritePreview;
    expect(audit.status).toBe('applied');
  });

  it('writes JSON previews with the vault adapter after stale-hash validation', async () => {
    const app = createApp();
    const targetPath = `${root}/ai-results/assignment-1.json`;
    const beforeText = '{"assignmentId":"assignment-1","status":"returned"}\n';
    const afterText = '{"assignmentId":"assignment-1","status":"returned","exitCode":0}\n';
    await app.vault.adapter.write(targetPath, beforeText);
    const preview: WritePreview = {
      id: 'preview-json-1',
      operation: 'append-sidecar-note',
      targetPath,
      targetHash: stableHash(beforeText),
      beforeText,
      afterText,
      diff: 'json diff',
      status: 'preview',
      createdAt: '2026-07-05T00:00:00.000Z',
      source: 'codex',
      rollbackHint: 'restore beforeText',
    };

    await new PreviewWriter(app, root).apply(preview);

    expect(await app.vault.adapter.read(targetPath)).toBe(afterText);
  });

  it('rejects stale preview application before writing or auditing', async () => {
    const app = createApp();
    const targetPath = `${root}/ai-results/assignment-1.json`;
    const beforeText = '{"assignmentId":"assignment-1","status":"returned"}\n';
    await app.vault.adapter.write(targetPath, `${beforeText}changed`);
    const preview: WritePreview = {
      id: 'preview-stale',
      operation: 'append-sidecar-note',
      targetPath,
      targetHash: stableHash(beforeText),
      beforeText,
      afterText: '{}\n',
      diff: 'json diff',
      status: 'preview',
      createdAt: '2026-07-05T00:00:00.000Z',
      source: 'codex',
      rollbackHint: 'restore beforeText',
    };

    await expect(new PreviewWriter(app, root).apply(preview)).rejects.toThrow('目标文件已变化');
    expect(await app.vault.adapter.exists(`${root}/write-previews/${preview.id}.json`)).toBe(false);
  });
});
