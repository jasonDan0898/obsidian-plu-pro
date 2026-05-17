import matter from 'gray-matter';
import type { App, TFile } from 'obsidian';

export function parseFrontmatterFromText(text: string): Record<string, unknown> {
  try {
    const parsed = matter(text);
    return parsed.data ?? {};
  } catch (err) {
    // Malformed YAML (rare in Obsidian-curated files). Return empty so callers
    // can keep going, but log so the failure isn't completely silent.
    console.warn('[FrontmatterIO] failed to parse frontmatter:', err);
    return {};
  }
}

export function mergeFrontmatterIntoText(
  text: string,
  patch: Record<string, unknown>,
): string {
  const parsed = matter(text);
  const merged = { ...parsed.data, ...patch };
  return matter.stringify(parsed.content, merged);
}

export class FrontmatterIO {
  constructor(private readonly app: App) {}

  /**
   * v1 trade-off: reads the file directly to guarantee consistency. For larger
   * vaults / hot paths, prefer `app.metadataCache.getFileCache(file)?.frontmatter`
   * which is already cached. The cast to `T` is not runtime-checked — the caller
   * is responsible for verifying the actual value type.
   */
  async readField<T = unknown>(file: TFile, field: string): Promise<T | undefined> {
    const text = await this.app.vault.read(file);
    const fm = parseFrontmatterFromText(text);
    return fm[field] as T | undefined;
  }

  async setField(file: TFile, field: string, value: unknown): Promise<void> {
    await this.app.fileManager.processFrontMatter(file, (fm) => {
      fm[field] = value;
    });
  }

  async removeField(file: TFile, field: string): Promise<void> {
    await this.app.fileManager.processFrontMatter(file, (fm) => {
      delete fm[field];
    });
  }
}
