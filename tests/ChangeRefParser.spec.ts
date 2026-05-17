import { parseChangeRefs } from '../src/core/ChangeRefParser';

describe('ChangeRefParser', () => {
  const knownSlugs = new Set(['establish-hic-kernel-audit', 'add-health-check-endpoint']);

  it('解析相对路径 wikilink', () => {
    const refs = parseChangeRefs(
      ['"[[../establish-hic-kernel-audit/proposal]]"'],
      knownSlugs,
    );
    expect(refs).toHaveLength(1);
    expect(refs[0]).toEqual({
      targetSlug: 'establish-hic-kernel-audit',
      raw: '"[[../establish-hic-kernel-audit/proposal]]"',
      resolved: true,
    });
  });

  it('解析裸 wikilink', () => {
    const refs = parseChangeRefs(['[[add-health-check-endpoint]]'], knownSlugs);
    expect(refs[0].targetSlug).toBe('add-health-check-endpoint');
    expect(refs[0].resolved).toBe(true);
  });

  it('解析裸 slug 字符串', () => {
    const refs = parseChangeRefs(['add-health-check-endpoint'], knownSlugs);
    expect(refs[0].targetSlug).toBe('add-health-check-endpoint');
    expect(refs[0].resolved).toBe(true);
  });

  it('未知 slug 标记为 resolved=false 但保留', () => {
    const refs = parseChangeRefs(['[[some-unknown-change]]'], knownSlugs);
    expect(refs[0].targetSlug).toBe('some-unknown-change');
    expect(refs[0].resolved).toBe(false);
  });

  it('忽略指向非 change 类文件的 wikilink', () => {
    const refs = parseChangeRefs(
      ['[[../../06-standards/HIC/总纲]]', '[[design]]', '[[tasks]]'],
      knownSlugs,
    );
    expect(refs).toHaveLength(0);
  });

  it('去重相同 targetSlug', () => {
    const refs = parseChangeRefs(
      [
        '[[../establish-hic-kernel-audit/proposal]]',
        'establish-hic-kernel-audit',
      ],
      knownSlugs,
    );
    expect(refs).toHaveLength(1);
  });

  it('空数组或 undefined 返回空数组', () => {
    expect(parseChangeRefs([], knownSlugs)).toEqual([]);
    expect(parseChangeRefs(undefined, knownSlugs)).toEqual([]);
  });
});
