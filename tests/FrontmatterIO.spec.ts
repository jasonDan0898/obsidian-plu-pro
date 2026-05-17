import matter from 'gray-matter';
import { parseFrontmatterFromText, mergeFrontmatterIntoText } from '../src/core/FrontmatterIO';

describe('FrontmatterIO - 纯函数部分', () => {
  it('parseFrontmatterFromText 提取 frontmatter 对象', () => {
    const text = `---
status: draft
project: bottleneck-routing
related:
  - "[[../other/proposal]]"
---
# Body
正文
`;
    const fm = parseFrontmatterFromText(text);
    expect(fm.status).toBe('draft');
    expect(fm.project).toBe('bottleneck-routing');
    expect(fm.related).toEqual(['[[../other/proposal]]']);
  });

  it('parseFrontmatterFromText 处理无 frontmatter', () => {
    const fm = parseFrontmatterFromText('# 仅正文\n');
    expect(fm).toEqual({});
  });

  it('mergeFrontmatterIntoText 写入新字段,保留 body', () => {
    const original = `---
status: draft
---
# Body
内容
`;
    const updated = mergeFrontmatterIntoText(original, { project: 'demo-proj' });
    const parsed = matter(updated);
    expect(parsed.data.status).toBe('draft');
    expect(parsed.data.project).toBe('demo-proj');
    expect(parsed.content.trim()).toBe('# Body\n内容');
  });

  it('mergeFrontmatterIntoText 在无 frontmatter 文件上新建 block', () => {
    const original = '# 仅正文\n内容\n';
    const updated = mergeFrontmatterIntoText(original, { project: 'demo' });
    expect(updated.startsWith('---\n')).toBe(true);
    const parsed = matter(updated);
    expect(parsed.data.project).toBe('demo');
  });

  it('mergeFrontmatterIntoText 覆盖同名字段', () => {
    const original = `---
project: old
---
body
`;
    const updated = mergeFrontmatterIntoText(original, { project: 'new' });
    const parsed = matter(updated);
    expect(parsed.data.project).toBe('new');
  });
});
