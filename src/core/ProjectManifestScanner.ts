import type { App, TFile, TFolder } from 'obsidian';
import type { ProjectManifest, ProjectPhase, ProjectStatus, ProjectSystem } from '../types';
import { parseFrontmatterFromText } from './FrontmatterIO';

const VALID_STATUSES: ProjectStatus[] = ['active', 'paused', 'done', 'archived'];
const VALID_SYSTEMS: ProjectSystem[] = ['HIC', 'EVS'];

function asString(v: unknown): string | undefined {
  if (typeof v === 'string') return v;
  // YAML 解析 ISO 时间戳/日期会自动产出 Date 对象,统一序列化回 ISO 字符串。
  if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString();
  return undefined;
}

function asStringArray(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  return v
    .map((x) => {
      if (typeof x === 'string') return x;
      if (x && typeof x === 'object' && !Array.isArray(x)) {
        const entries = Object.entries(x as Record<string, unknown>);
        if (entries.length === 1) {
          const [key, value] = entries[0];
          return `${key}: ${String(value)}`;
        }
      }
      return undefined;
    })
    .filter((x): x is string => typeof x === 'string');
}

function asNumberRecord(v: unknown): Record<string, number> | undefined {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return undefined;
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(v as Record<string, unknown>)) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      out[key] = value;
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export function parseManifestFromText(
  text: string,
  manifestPath: string,
): ProjectManifest | null {
  const fm = parseFrontmatterFromText(text);
  if (fm.type !== 'project') {
    return null;
  }
  const slug = asString(fm.slug);
  const title = asString(fm.title);
  if (!slug || !title) {
    return null;
  }
  const statusRaw = asString(fm.status);
  const status: ProjectStatus =
    statusRaw && VALID_STATUSES.includes(statusRaw as ProjectStatus)
      ? (statusRaw as ProjectStatus)
      : 'active';

  return {
    slug,
    title,
    status,
    phase: asString(fm.phase) as ProjectPhase | undefined,
    owner: asString(fm.owner),
    created: asString(fm.created),
    updated: asString(fm.updated),
    deadline: asString(fm.deadline),
    vision: asString(fm.vision),
    goals: asStringArray(fm.goals),
    scope: asStringArray(fm.scope),
    successCriteria: asStringArray(fm['success-criteria']),
    nonGoals: asStringArray(fm['non-goals']),
    risks: asStringArray(fm.risks),
    tags: asStringArray(fm.tags),
    manifestPath,
    pendingAnalysis: typeof fm['pending-analysis'] === 'boolean' ? fm['pending-analysis'] : false,
    generatedChanges: asStringArray(fm['generated-changes']),
    lastAnalyzed: asString(fm['last-analyzed']),
    superpowersSpecs: asStringArray(fm['superpowers-specs']),
    superpowersPlans: asStringArray(fm['superpowers-plans']),
    deviationFlags: asNumberRecord(fm['deviation-flags']),
    system: (() => {
      const raw = asString(fm.system);
      return raw && VALID_SYSTEMS.includes(raw as ProjectSystem)
        ? (raw as ProjectSystem)
        : undefined;
    })(),
  };
}

export class ProjectManifestScanner {
  constructor(private readonly app: App, private readonly projectsRoot: string) {}

  async scanAll(): Promise<ProjectManifest[]> {
    const folder = this.app.vault.getAbstractFileByPath(this.projectsRoot);
    if (!folder || !this.isFolder(folder)) {
      return [];
    }
    const out: ProjectManifest[] = [];
    for (const child of (folder as TFolder).children) {
      if (!this.isFile(child)) continue;
      const file = child as TFile;
      if (file.extension !== 'md') continue;
      const text = await this.app.vault.read(file);
      const manifest = parseManifestFromText(text, file.path);
      if (manifest) {
        out.push(manifest);
      }
    }
    return out;
  }

  private isFolder(item: unknown): item is TFolder {
    return !!item && typeof item === 'object' && 'children' in (item as object);
  }

  private isFile(item: unknown): item is TFile {
    return !!item && typeof item === 'object' && 'extension' in (item as object);
  }
}
