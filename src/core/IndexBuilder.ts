import type { App } from 'obsidian';
import type { ProjectIndexSnapshot, PluginSettings } from '../types';
import { AuxiliaryScanner } from './AuxiliaryScanner';
import { ChangeScanner } from './ChangeScanner';
import { ProjectManifestScanner } from './ProjectManifestScanner';
import { buildIndex } from './ProjectIndex';
import { SidecarStore } from './SidecarStore';

export class IndexBuilder {
  private readonly changeScanner: ChangeScanner;
  private readonly manifestScanner: ProjectManifestScanner;
  private readonly auxiliaryScanner: AuxiliaryScanner;
  private readonly sidecarStore: SidecarStore;

  constructor(app: App, settings: PluginSettings) {
    this.changeScanner = new ChangeScanner(app, settings.changesPath);
    this.manifestScanner = new ProjectManifestScanner(app, settings.projectsPath);
    this.auxiliaryScanner = new AuxiliaryScanner(app, settings);
    this.sidecarStore = new SidecarStore(app, settings.controlTowerMetaPath);
  }

  async rebuild(): Promise<ProjectIndexSnapshot> {
    const [manifests, changes, documents, reviewRecords] = await Promise.all([
      this.manifestScanner.scanAll(),
      this.changeScanner.scanAll(),
      this.auxiliaryScanner.scanAll(),
      this.sidecarStore.listReviewRecords(),
    ]);
    return buildIndex({ manifests, changes, documents, reviewRecords });
  }
}
