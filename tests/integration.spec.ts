import fs from 'fs';
import path from 'path';
import { parseManifestFromText } from '../src/core/ProjectManifestScanner';
import { scanChangeFromDisk } from '../src/core/ChangeScanner';
import { buildIndex } from '../src/core/ProjectIndex';

const FIX = path.resolve(__dirname, 'fixtures');

function readChange(name: string) {
  const proposalText = fs.readFileSync(path.join(FIX, name, 'proposal.md'), 'utf-8');
  const tasksText = fs.readFileSync(path.join(FIX, name, 'tasks.md'), 'utf-8');
  return scanChangeFromDisk({
    slug: name,
    proposalPath: `openspec/changes/${name}/proposal.md`,
    proposalText,
    tasksText,
  });
}

describe('integration: realistic fixtures', () => {
  it('挂载到正确项目并聚合进度', () => {
    const manifestText = fs.readFileSync(
      path.join(FIX, 'realistic-project/_projects/bottleneck-routing.md'),
      'utf-8',
    );
    const manifest = parseManifestFromText(manifestText, '_projects/bottleneck-routing.md');
    expect(manifest).not.toBeNull();

    const changes = [readChange('realistic-change-1'), readChange('realistic-change-2')];
    const idx = buildIndex({ manifests: [manifest!], changes });

    expect(idx.unassigned).toEqual([]);
    expect(idx.orphanRefs).toEqual([]);
    expect(idx.projects.size).toBe(1);

    const entry = idx.projects.get('bottleneck-routing')!;
    expect(entry.changes).toHaveLength(2);
    expect(entry.progress.changeCount).toBe(2);
    // change-1: 3 done / 6 total; change-2: 5 done / 5 total
    expect(entry.progress.totalDone).toBe(8);
    expect(entry.progress.totalCount).toBe(11);
    expect(entry.progress.changesDone).toBe(1);

    const c1 = entry.changes.find((c) => c.slug === 'realistic-change-1')!;
    expect(c1.blockers).toHaveLength(1);
    expect(c1.blockers[0].targetSlug).toBe('realistic-change-2');
    expect(c1.blockers[0].resolved).toBe(true);
  });
});
