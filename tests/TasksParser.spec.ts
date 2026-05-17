import { parseTasks } from '../src/core/TasksParser';

describe('TasksParser - 段落识别', () => {
  it('按 ## 标题切分章节', () => {
    const input = `## 1. 核心契约接口

- [ ] 1.1 创建接口
- [x] 1.2 写实现

## 2. 数据库迁移

- [ ] 2.1 写 Flyway 脚本
`;
    const result = parseTasks(input);
    expect(result.groups).toHaveLength(2);
    expect(result.groups[0].heading).toBe('1. 核心契约接口');
    expect(result.groups[1].heading).toBe('2. 数据库迁移');
  });

  it('忽略 ### 三级标题,不作为分组锚点', () => {
    const input = `## 1. 章节一

### 1.1 子章节
- [ ] 任务 A
`;
    const result = parseTasks(input);
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].heading).toBe('1. 章节一');
  });

  it('无 ## 章节时返回单一默认组', () => {
    const input = `- [ ] 孤立任务 A
- [x] 孤立任务 B
`;
    const result = parseTasks(input);
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].heading).toBe('(未分组)');
  });
});
