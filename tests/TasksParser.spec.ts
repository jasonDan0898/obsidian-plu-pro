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

describe('TasksParser - checkbox 计数', () => {
  it('扁平统计任意缩进的任务项', () => {
    const input = `## 段一

- [ ] 顶级 1
  - [ ] 缩进 1
    - [x] 深缩进 1
- [x] 顶级 2
`;
    const result = parseTasks(input);
    expect(result.totalCount).toBe(4);
    expect(result.totalDone).toBe(2);
  });

  it('区分大小写 X / x 都识别为完成', () => {
    const input = `## 段一

- [X] 大写 X
- [x] 小写 x
- [ ] 待办
`;
    const result = parseTasks(input);
    expect(result.totalDone).toBe(2);
    expect(result.totalCount).toBe(3);
  });

  it('空文件返回零进度单组', () => {
    const result = parseTasks('');
    expect(result.totalCount).toBe(0);
    expect(result.totalDone).toBe(0);
    expect(result.groups).toHaveLength(1);
  });

  it('totalDone 与 totalCount 等于各组之和', () => {
    const input = `## 段一

- [x] 任务
- [ ] 任务

## 段二

- [x] 任务
- [x] 任务
- [ ] 任务
`;
    const result = parseTasks(input);
    expect(result.totalDone).toBe(3);
    expect(result.totalCount).toBe(5);
    expect(result.groups[0]).toEqual({ heading: '段一', done: 1, total: 2 });
    expect(result.groups[1]).toEqual({ heading: '段二', done: 2, total: 3 });
  });

  it('忽略 HTML 注释里的 task 标记', () => {
    const input = `## 段一

<!-- - [x] 注释里的任务不计 -->
- [ ] 真任务
`;
    const result = parseTasks(input);
    expect(result.totalCount).toBe(1);
    expect(result.totalDone).toBe(0);
  });

  it('保留行内 inline 注释后的任务', () => {
    const input = `## 段一

- [x] 任务 A <!-- ref: #123 -->
- [ ] 任务 B
- [x] 任务 C <!-- TODO -->
`;
    const result = parseTasks(input);
    expect(result.totalCount).toBe(3);
    expect(result.totalDone).toBe(2);
  });

  it('忽略跨行 HTML 注释块内的任务', () => {
    const input = `## 段一

- [x] 段外真任务
<!--
- [ ] 跨行注释内任务,不计
- [x] 也不计
-->
- [ ] 段外另一真任务
`;
    const result = parseTasks(input);
    expect(result.totalCount).toBe(2);
    expect(result.totalDone).toBe(1);
  });
});
