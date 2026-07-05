import { App, Plugin, PluginSettingTab, Setting } from 'obsidian';
import type { PluginSettings } from './types';
import { DEFAULT_SETTINGS } from './types';

export { DEFAULT_SETTINGS };
export type { PluginSettings };

/**
 * SettingTab 只需要插件暴露的最小接口,定义在此处避免与 main.ts 形成
 * 循环 type-import。main.ts 中的 PluProPlugin 会实现这个 contract。
 */
export interface PluProPluginContract extends Plugin {
  settings: PluginSettings;
  saveSettings(): Promise<void>;
  refreshIndex(): Promise<void>;
}

export class PluProSettingTab extends PluginSettingTab {
  constructor(app: App, private readonly plugin: PluProPluginContract) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'PluPro 设置' });

    new Setting(containerEl)
      .setName('OpenSpec changes 路径')
      .setDesc('相对 vault 根目录,例如 openspec/changes')
      .addText((text) =>
        text
          .setPlaceholder('openspec/changes')
          .setValue(this.plugin.settings.changesPath)
          .onChange(async (value) => {
            this.plugin.settings.changesPath = value || DEFAULT_SETTINGS.changesPath;
            await this.plugin.saveSettings();
            await this.plugin.refreshIndex();
          }),
      );

    new Setting(containerEl)
      .setName('项目 manifest 目录')
      .setDesc('相对 vault 根目录,例如 _projects')
      .addText((text) =>
        text
          .setPlaceholder('_projects')
          .setValue(this.plugin.settings.projectsPath)
          .onChange(async (value) => {
            this.plugin.settings.projectsPath = value || DEFAULT_SETTINGS.projectsPath;
            await this.plugin.saveSettings();
            await this.plugin.refreshIndex();
          }),
      );

    new Setting(containerEl)
      .setName('控制塔 sidecar 目录')
      .setDesc('相对 vault 根目录,用于保存 reviews / ADR / write-previews / scenario-simulations')
      .addText((text) =>
        text
          .setPlaceholder('_meta/openspec-control-tower')
          .setValue(this.plugin.settings.controlTowerMetaPath)
          .onChange(async (value) => {
            this.plugin.settings.controlTowerMetaPath = value || DEFAULT_SETTINGS.controlTowerMetaPath;
            await this.plugin.saveSettings();
            await this.plugin.refreshIndex();
          }),
      );

    new Setting(containerEl)
      .setName('启用 capability 归并 fallback')
      .setDesc('未分类时根据 change.capability 推荐项目')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.enableCapabilityFallback)
          .onChange(async (value) => {
            this.plugin.settings.enableCapabilityFallback = value;
            await this.plugin.saveSettings();
          }),
      );
  }
}
