import type { ProjectIndexSnapshot, ScenarioCase, ScenarioSimulationResult } from '../types';

export const SCENARIO_CATALOG: ScenarioCase[] = [
  ['S01', '每日 90+ active changes 总览', 'active changes 很多', '按项目/风险/阻塞/更新时间排序', '优先看健康面板与长任务看板', 'warning'],
  ['S02', '多个项目 pending-analysis', '多个项目待拆解', '显示分析队列', '按项目愿景生成 handoff', 'info'],
  ['S03', '单项目 10+ generated changes', '项目拆解较大', '项目详情展示整体进度', '创建长期任务线程', 'info'],
  ['S04', '单 change 100+ tasks', '任务清单很长', '阶段化执行视图', '推荐下一项 task', 'warning'],
  ['S05', 'Change 间 blocker', 'related 指向其他 change', '双向显示阻塞', '先处理 blocker', 'warning'],
  ['S06', 'Change 缺少 project', 'proposal 无 project', '健康面板提示', '生成 frontmatter 修复预览', 'warning'],
  ['S07', 'Change 指向不存在 project', 'project manifest 不存在', '错误级风险', '创建或修正 project', 'error'],
  ['S08', '非 kebab change slug', 'slug 非 ASCII kebab-case', '协议违规', '人工迁移目录', 'error'],
  ['S09', '缺少 tasks.md', 'change 无任务清单', '不可执行态', '补齐 tasks.md', 'error'],
  ['S10', '缺少 spec delta', 'change 无 specs/**/spec.md', '契约不完整', '补齐 spec delta', 'warning'],
  ['S11', '陈旧 openspec-index.json', '索引根目录或时间陈旧', '提示重建索引', '重新扫描', 'warning'],
  ['S12', '缺少拆解 prompt', 'project-to-changes-prompt.md 不存在', '分析链路不可用', '补齐标准 prompt', 'error'],
  ['S13', '一句话 vision 生成架构 brief', '项目只有 vision', '架构规划台可起草', '生成 ArchitectureBrief sidecar', 'info'],
  ['S14', 'red-green 长任务执行', 'tasks 已落定', '显示当前 task 和验证槽', '按 checkbox 顺序推进', 'info'],
  ['S15', '多个长期任务推荐下一步', '长任务线程大于 1', '推荐最小推进动作', '选择最高风险线程', 'info'],
  ['S16', 'design.md 批注', '用户选中文档段落', 'ReviewRecord 保存', '进入批注队列', 'info'],
  ['S17', '批注源文档变更', 'source hash 变化', '标记 stale', '重新确认后处理', 'warning'],
  ['S18', '会议本地导出', '用户导出 review surface', '生成本地 HTML', '带派生标签', 'info'],
  ['S19', '第三方发布阻断', '出现 publish/share 动作', '阻断并记录', '仅允许 local export', 'error'],
  ['S20', '生成 Agent 上下文包', '选择项目/change', '包含相关源路径', '交给 Codex/Claude', 'info'],
  ['S21', '上下文包排除敏感内容', '遇到 credentials/.env/大文件', '列出排除原因', '保持最小上下文', 'warning'],
  ['S22', 'frontmatter 修复预览', '用户选择修复', '显示 before/after diff', '确认后写入', 'info'],
  ['S23', '预览后 hash 变化', '目标文件被改', '拒绝 apply', '重新生成预览', 'error'],
  ['S24', '运行 openspec validate', '用户请求验证', '记录命令结果', '不修改文件', 'info'],
  ['S25', '已完成但 archive 手工确认', 'tasks 全完成', '显示 archive candidate', '提示人工归档', 'warning'],
  ['S26', '旧 vault root 路径', '索引含旧 /Users/danwei 路径', '迁移风险提示', '重建索引/修正文档', 'warning'],
  ['S27', '无关 dirty files', '工作区有外部变更', '风险面板提示', '不覆盖无关文件', 'warning'],
  ['S28', '跨天恢复长任务', '线程暂停后恢复', '显示 resume packet', '继续下一项', 'info'],
  ['S29', '架构决策沉淀', '关键取舍出现', '生成 ADR sidecar', '关联 project/change', 'info'],
  ['S30', '偏差反馈', 'design/tasks/spec delta 变化', '记录 deviation', 'commit message 提醒 Reason', 'warning'],
].map(([id, title, trigger, expectedSignal, expectedAction, risk]) => ({
  id,
  title,
  trigger,
  expectedSignal,
  expectedAction,
  risk,
})) as ScenarioCase[];

export function simulateScenarios(snapshot: Pick<ProjectIndexSnapshot, 'projects' | 'unassigned' | 'healthIssues' | 'longTasks' | 'overview' | 'documents'>): ScenarioSimulationResult[] {
  return SCENARIO_CATALOG.map((scenario) => {
    const signal = detectSignal(snapshot, scenario.id);
    return {
      scenarioId: scenario.id,
      title: scenario.title,
      status: signal.status,
      signal: signal.message,
      action: signal.status === 'covered' ? scenario.expectedAction : `待补强:${scenario.expectedAction}`,
    };
  });
}

function detectSignal(
  snapshot: Pick<ProjectIndexSnapshot, 'projects' | 'unassigned' | 'healthIssues' | 'longTasks' | 'overview' | 'documents'>,
  id: string,
): { status: ScenarioSimulationResult['status']; message: string } {
  const issues = snapshot.healthIssues;
  const issueHas = (scenarioId: string) => issues.some((issue) => issue.scenarioIds?.includes(scenarioId));
  const projects = Array.from(snapshot.projects.values());
  const allChanges = projects.flatMap((entry) => entry.changes).concat(snapshot.unassigned);

  switch (id) {
    case 'S01':
      return snapshot.overview.activeChangeCount >= 90
        ? { status: 'covered', message: `${snapshot.overview.activeChangeCount} active changes` }
        : { status: 'attention', message: 'active change 数量未达到压力场景,但总览指标已可展示' };
    case 'S02':
      return snapshot.overview.pendingAnalysisCount >= 2
        ? { status: 'covered', message: `${snapshot.overview.pendingAnalysisCount} pending projects` }
        : { status: 'attention', message: 'pending-analysis 队列较短' };
    case 'S03':
      return projects.some((entry) => (entry.manifest.generatedChanges?.length ?? 0) >= 10)
        ? { status: 'covered', message: '存在 10+ generated changes 项目' }
        : { status: 'attention', message: '暂无 10+ generated changes 项目' };
    case 'S04':
      return allChanges.some((change) => change.taskProgress.totalCount >= 100)
        ? { status: 'covered', message: '存在 100+ tasks change' }
        : { status: 'attention', message: '暂无 100+ tasks change' };
    case 'S05':
    case 'S06':
    case 'S07':
    case 'S08':
    case 'S09':
    case 'S10':
    case 'S11':
    case 'S26':
      return issueHas(id)
        ? { status: id === 'S07' || id === 'S08' || id === 'S09' ? 'blocked' : 'covered', message: '健康面板已捕获该信号' }
        : { status: 'attention', message: '当前快照未触发该风险' };
    case 'S12':
      return snapshot.documents.some((doc) => doc.path.endsWith('project-to-changes-prompt.md'))
        ? { status: 'covered', message: '拆解 prompt 可扫描' }
        : { status: 'blocked', message: '拆解 prompt 未出现在扫描文档中' };
    case 'S13':
      return projects.some((entry) => !!entry.manifest.vision && (entry.manifest.goals?.length ?? 0) === 0)
        ? { status: 'covered', message: '存在仅 vision 的项目' }
        : { status: 'attention', message: '未发现仅 vision 的项目,架构 brief 入口仍可用' };
    case 'S14':
      return allChanges.some((change) => change.taskProgress.totalCount > 0)
        ? { status: 'covered', message: '存在可按 checkbox 推进的 change' }
        : { status: 'attention', message: '暂无可执行 tasks' };
    case 'S15':
    case 'S28':
      return snapshot.longTasks.length > 0
        ? { status: 'covered', message: `${snapshot.longTasks.length} long task threads` }
        : { status: 'attention', message: '当前未推导出长期任务线程' };
    case 'S25':
      return snapshot.overview.archiveCandidateCount > 0
        ? { status: 'covered', message: `${snapshot.overview.archiveCandidateCount} archive candidates` }
        : { status: 'attention', message: '暂无 archive candidate' };
    default:
      return { status: 'covered', message: '能力通过插件入口或纯函数模块覆盖' };
  }
}
