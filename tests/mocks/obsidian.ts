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
  async read(_file: TFile): Promise<string> {
    return '';
  }
  getAbstractFileByPath(_path: string): TFile | TFolder | null {
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
