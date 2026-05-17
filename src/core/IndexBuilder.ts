import type { App } from 'obsidian';
import type { ProjectIndexSnapshot, PluginSettings } from '../types';
import { ChangeScanner } from './ChangeScanner';
import { ProjectManifestScanner } from './ProjectManifestScanner';
import { buildIndex } from './ProjectIndex';

export class IndexBuilder {
  private readonly changeScanner: ChangeScanner;
  private readonly manifestScanner: ProjectManifestScanner;

  constructor(app: App, settings: PluginSettings) {
    this.changeScanner = new ChangeScanner(app, settings.changesPath);
    this.manifestScanner = new ProjectManifestScanner(app, settings.projectsPath);
  }

  async rebuild(): Promise<ProjectIndexSnapshot> {
    const [manifests, changes] = await Promise.all([
      this.manifestScanner.scanAll(),
      this.changeScanner.scanAll(),
    ]);
    return buildIndex({ manifests, changes });
  }
}
