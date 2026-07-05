// Minimal Obsidian API mock for unit tests.
// Real Obsidian runtime is provided when the plugin is loaded in the app.

export class Plugin {}
export class PluginSettingTab {}
export class ItemView {}
export class Setting {}
export class Notice {
  constructor(_message: string) {}
}
export class TFile {
  path = '';
  basename = '';
  extension = 'md';
  parent: { path: string } | null = null;
}
export class TFolder {
  name = '';
  path = '';
  children: Array<TFile | TFolder> = [];
}
export class App {}
export class Vault {
  private readonly files = new Map<string, string>();
  private readonly folders = new Set<string>(['']);

  readonly adapter = {
    read: async (path: string): Promise<string> => this.files.get(normalizePath(path)) ?? '',
    write: async (path: string, data: string): Promise<void> => {
      const normalized = normalizePath(path);
      await this.adapter.mkdir(parentPath(normalized));
      this.files.set(normalized, data);
    },
    exists: async (path: string): Promise<boolean> => {
      const normalized = normalizePath(path);
      return this.files.has(normalized) || this.folders.has(normalized);
    },
    list: async (path: string): Promise<{ files: string[]; folders: string[] }> => {
      const normalized = normalizePath(path);
      const prefix = normalized ? `${normalized}/` : '';
      const files = Array.from(this.files.keys())
        .filter((filePath) => parentPath(filePath) === normalized)
        .sort();
      const folders = Array.from(this.folders)
        .filter((folderPath) => folderPath && parentPath(folderPath) === normalized && folderPath.startsWith(prefix))
        .sort();
      return { files, folders };
    },
    mkdir: async (path: string): Promise<void> => {
      const normalized = normalizePath(path);
      const parts = normalized.split('/').filter(Boolean);
      let cursor = '';
      for (const part of parts) {
        cursor = cursor ? `${cursor}/${part}` : part;
        this.folders.add(cursor);
      }
    },
  };

  async read(file: TFile): Promise<string> {
    return this.files.get(normalizePath(file.path)) ?? '';
  }

  async modify(file: TFile, data: string): Promise<void> {
    await this.adapter.write(file.path, data);
  }

  getAbstractFileByPath(path: string): TFile | TFolder | null {
    const normalized = normalizePath(path);
    if (this.files.has(normalized)) {
      const file = new TFile();
      file.path = normalized;
      const name = normalized.split('/').pop() ?? normalized;
      const dot = name.lastIndexOf('.');
      file.basename = dot >= 0 ? name.slice(0, dot) : name;
      file.extension = dot >= 0 ? name.slice(dot + 1) : '';
      file.parent = { path: parentPath(normalized) };
      return file;
    }
    if (this.folders.has(normalized)) {
      const folder = new TFolder();
      folder.path = normalized;
      folder.name = normalized.split('/').pop() ?? normalized;
      folder.children = [];
      return folder;
    }
    return null;
  }
}
export class MetadataCache {}
export class FileManager {
  // Invoke the callback with a fresh empty frontmatter object so tests exercising
  // processFrontMatter side-effects don't silently skip the callback. Each call
  // creates a new {} — mutations are not persisted across calls. To inject
  // specific initial values, override with jest.spyOn:
  //   jest.spyOn(fm, 'processFrontMatter').mockImplementation(async (_f, fn) => fn({ key: 'val' }));
  async processFrontMatter(_file: TFile, fn: (fm: Record<string, unknown>) => void): Promise<void> {
    fn({});
  }
}

function normalizePath(path: string): string {
  return path.replace(/^\/+/, '').replace(/\/+$/, '');
}

function parentPath(path: string): string {
  const normalized = normalizePath(path);
  const index = normalized.lastIndexOf('/');
  return index < 0 ? '' : normalized.slice(0, index);
}
