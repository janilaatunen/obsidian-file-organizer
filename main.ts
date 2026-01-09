import { App, Plugin, PluginSettingTab, Setting, TFile, Notice } from 'obsidian';

interface OrganizeRule {
	tag: string;
	folder: string;
	enabled: boolean;
}

interface FileOrganizerSettings {
	rules: OrganizeRule[];
	organizeOnStartup: boolean;
}

const DEFAULT_SETTINGS: FileOrganizerSettings = {
	rules: [],
	organizeOnStartup: true
}

export default class FileOrganizerPlugin extends Plugin {
	settings: FileOrganizerSettings;
	organizerInterval: number;

	async onload() {
		await this.loadSettings();
		console.log('File Organizer plugin loaded');

		// Add settings tab
		this.addSettingTab(new FileOrganizerSettingTab(this.app, this));

		// Organize on startup if enabled
		if (this.settings.organizeOnStartup) {
			this.app.workspace.onLayoutReady(() => {
				this.organizeFiles();
			});
		}

		// Auto-organize every 6 hours
		this.organizerInterval = window.setInterval(() => {
			this.organizeFiles();
		}, 6 * 60 * 60 * 1000); // 6 hours in milliseconds
		this.registerInterval(this.organizerInterval);

		// Add command to manually organize
		this.addCommand({
			id: 'organize-files-now',
			name: 'Organize files now',
			callback: () => {
				this.organizeFiles();
			}
		});
	}

	onunload() {
		console.log('File Organizer plugin unloaded');
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async organizeFiles() {
		console.log('Starting file organization...');
		let totalMoved = 0;

		for (const rule of this.settings.rules) {
			if (!rule.enabled) {
				continue;
			}

			const moved = await this.organizeByRule(rule);
			totalMoved += moved;
		}

		if (totalMoved > 0) {
			new Notice(`File Organizer: Moved ${totalMoved} file${totalMoved === 1 ? '' : 's'}`);
			console.log(`File organization complete: ${totalMoved} files moved`);
		} else {
			console.log('File organization complete: No files to move');
		}
	}

	async organizeByRule(rule: OrganizeRule): Promise<number> {
		const { tag, folder } = rule;
		let movedCount = 0;

		// Ensure target folder exists
		await this.ensureFolder(folder);

		// Get all markdown files
		const files = this.app.vault.getMarkdownFiles();

		for (const file of files) {
			// Skip if file is already in target folder
			if (file.parent?.path === folder) {
				continue;
			}

			// Check if file has the tag
			const hasTag = await this.fileHasTag(file, tag);
			if (hasTag) {
				try {
					const newPath = `${folder}/${file.name}`;

					// Check if file with same name already exists in target folder
					const existingFile = this.app.vault.getAbstractFileByPath(newPath);
					if (existingFile) {
						console.warn(`File already exists at ${newPath}, skipping ${file.path}`);
						continue;
					}

					await this.app.vault.rename(file, newPath);
					movedCount++;
					console.log(`Moved: ${file.path} → ${newPath}`);
				} catch (error) {
					console.error(`Error moving file ${file.path}:`, error);
				}
			}
		}

		return movedCount;
	}

	async fileHasTag(file: TFile, tag: string): Promise<boolean> {
		try {
			const content = await this.app.vault.read(file);
			const cache = this.app.metadataCache.getFileCache(file);

			// Normalize tag (remove # if present, make lowercase)
			const normalizedSearchTag = tag.toLowerCase().replace(/^#/, '');

			// Check frontmatter tags
			if (cache?.frontmatter?.tags) {
				const fmTags = cache.frontmatter.tags;
				const tagsArray = Array.isArray(fmTags) ? fmTags : [fmTags];

				for (const fmTag of tagsArray) {
					const normalizedFmTag = String(fmTag).toLowerCase().replace(/^#/, '');
					if (normalizedFmTag === normalizedSearchTag) {
						return true;
					}
				}
			}

			// Check inline tags
			if (cache?.tags) {
				for (const tagCache of cache.tags) {
					const normalizedInlineTag = tagCache.tag.toLowerCase().replace(/^#/, '');
					if (normalizedInlineTag === normalizedSearchTag) {
						return true;
					}
				}
			}

			return false;
		} catch (error) {
			console.error(`Error checking tags for ${file.path}:`, error);
			return false;
		}
	}

	async ensureFolder(folderPath: string) {
		const folder = this.app.vault.getAbstractFileByPath(folderPath);
		if (!folder) {
			try {
				await this.app.vault.createFolder(folderPath);
				console.log(`Created folder: ${folderPath}`);
			} catch (error) {
				// Folder might already exist or parent doesn't exist
				console.error(`Error creating folder ${folderPath}:`, error);
			}
		}
	}
}

class FileOrganizerSettingTab extends PluginSettingTab {
	plugin: FileOrganizerPlugin;

	constructor(app: App, plugin: FileOrganizerPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;
		containerEl.empty();

		containerEl.createEl('h2', { text: 'File Organizer Settings' });

		// Organize on startup toggle
		new Setting(containerEl)
			.setName('Organize on startup')
			.setDesc('Automatically organize files when Obsidian launches')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.organizeOnStartup)
				.onChange(async (value) => {
					this.plugin.settings.organizeOnStartup = value;
					await this.plugin.saveSettings();
				}));

		containerEl.createEl('h3', { text: 'Organization Rules' });
		containerEl.createEl('p', {
			text: 'Files are automatically organized every 6 hours. Rules are processed in order.',
			cls: 'setting-item-description'
		});

		// Display existing rules
		this.plugin.settings.rules.forEach((rule, index) => {
			this.addRuleSetting(containerEl, rule, index);
		});

		// Add new rule button
		new Setting(containerEl)
			.addButton(button => button
				.setButtonText('Add Rule')
				.setCta()
				.onClick(async () => {
					this.plugin.settings.rules.push({
						tag: '',
						folder: '',
						enabled: true
					});
					await this.plugin.saveSettings();
					this.display();
				}));

		// Manual organize button
		containerEl.createEl('h3', { text: 'Manual Organization' });
		new Setting(containerEl)
			.setName('Organize files now')
			.setDesc('Manually trigger file organization')
			.addButton(button => button
				.setButtonText('Organize Now')
				.setCta()
				.onClick(() => {
					this.plugin.organizeFiles();
				}));
	}

	addRuleSetting(containerEl: HTMLElement, rule: OrganizeRule, index: number) {
		const ruleSetting = new Setting(containerEl)
			.setClass('file-organizer-rule');

		// Rule header with enable/disable toggle
		ruleSetting
			.setName(`Rule ${index + 1}`)
			.addToggle(toggle => toggle
				.setValue(rule.enabled)
				.setTooltip(rule.enabled ? 'Enabled' : 'Disabled')
				.onChange(async (value) => {
					rule.enabled = value;
					await this.plugin.saveSettings();
				}))
			.addButton(button => button
				.setButtonText('Delete')
				.setWarning()
				.onClick(async () => {
					this.plugin.settings.rules.splice(index, 1);
					await this.plugin.saveSettings();
					this.display();
				}));

		// Tag input
		new Setting(containerEl)
			.setName('Tag')
			.setDesc('Files with this tag will be moved (e.g., "archive" or "#archive")')
			.addText(text => text
				.setPlaceholder('tag-name')
				.setValue(rule.tag)
				.onChange(async (value) => {
					rule.tag = value;
					await this.plugin.saveSettings();
				}));

		// Folder input
		new Setting(containerEl)
			.setName('Target Folder')
			.setDesc('Folder where files will be moved (e.g., "Archive" or "Archive/2024")')
			.addText(text => text
				.setPlaceholder('folder/path')
				.setValue(rule.folder)
				.onChange(async (value) => {
					rule.folder = value;
					await this.plugin.saveSettings();
				}));

		containerEl.createEl('hr');
	}
}
