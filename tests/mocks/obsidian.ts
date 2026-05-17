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
  path = '';
  children: Array<TFile | TFolder> = [];
}
export class App {}
export class Vault {}
export class MetadataCache {}
export class FileManager {
  async processFrontMatter(_file: TFile, _fn: (fm: Record<string, unknown>) => void): Promise<void> {}
}
