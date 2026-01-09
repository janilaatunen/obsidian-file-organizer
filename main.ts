import { App, Plugin, PluginSettingTab, Setting, TFile, Notice } from 'obsidian';

interface OrganizeRule {
	tag: string;
	folder: string;
	fileType: string; // e.g., "png", "pdf", "md"
	filenamePattern: string; // e.g., "Screenshot", "Untitled"
}

interface FileOrganizerSettings {
	rules: OrganizeRule[];
	organizeOnStartup: boolean;
	automaticOrganization: boolean;
	lastOrganized: number; // timestamp
	excludedFolders: string[];
}

const DEFAULT_SETTINGS: FileOrganizerSettings = {
	rules: [],
	organizeOnStartup: true,
	automaticOrganization: true,
	lastOrganized: 0,
	excludedFolders: ['Templates']
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

		// Check if organization is needed every hour
		this.organizerInterval = window.setInterval(() => {
			this.checkAndOrganize();
		}, 60 * 60 * 1000); // Check every hour
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

	async checkAndOrganize() {
		if (!this.settings.automaticOrganization) {
			return;
		}

		const now = Date.now();
		const dayInMs = 24 * 60 * 60 * 1000;
		const timeSinceLastOrganized = now - this.settings.lastOrganized;

		if (timeSinceLastOrganized >= dayInMs) {
			await this.organizeFiles();
		}
	}

	async organizeFiles() {
		console.log('Starting file organization...');
		let totalMoved = 0;

		for (const rule of this.settings.rules) {
			const moved = await this.organizeByRule(rule);
			totalMoved += moved;
		}

		// Update last organized timestamp
		this.settings.lastOrganized = Date.now();
		await this.saveSettings();

		if (totalMoved > 0) {
			new Notice(`File Organizer: Moved ${totalMoved} file${totalMoved === 1 ? '' : 's'}`);
			console.log(`File organization complete: ${totalMoved} files moved`);
		} else {
			console.log('File organization complete: No files to move');
		}
	}

	async organizeByRule(rule: OrganizeRule): Promise<number> {
		const { tag, folder, fileType, filenamePattern } = rule;
		let movedCount = 0;

		// Ensure target folder exists
		await this.ensureFolder(folder);

		// Get all files (not just markdown)
		const files = this.app.vault.getFiles();

		for (const file of files) {
			// Skip if file is already in target folder
			if (file.parent?.path === folder) {
				continue;
			}

			// Skip if file is in an excluded folder
			if (this.isInExcludedFolder(file.path)) {
				continue;
			}

			// Check if file matches the rule
			const matches = await this.fileMatchesRule(file, rule);
			if (matches) {
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

	async fileMatchesRule(file: TFile, rule: OrganizeRule): Promise<boolean> {
		const { tag, fileType, filenamePattern } = rule;

		// Check tag (only for markdown files)
		if (tag) {
			if (file.extension === 'md') {
				const hasTag = await this.fileHasTag(file, tag);
				if (hasTag) {
					return true;
				}
			}
		}

		// Check file type
		if (fileType && file.extension.toLowerCase() !== fileType.toLowerCase()) {
			return false;
		}

		// Check filename pattern
		if (filenamePattern) {
			const basename = file.basename.toLowerCase();
			const pattern = filenamePattern.toLowerCase();
			if (!basename.includes(pattern)) {
				return false;
			}
		}

		// If fileType or filenamePattern is set and we got here, it matches
		if (fileType || filenamePattern) {
			return true;
		}

		return false;
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

	isInExcludedFolder(filePath: string): boolean {
		for (const excludedFolder of this.settings.excludedFolders) {
			if (filePath.startsWith(excludedFolder + '/') || filePath.startsWith(excludedFolder + '\\')) {
				return true;
			}
		}
		return false;
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

		containerEl.createEl('h1', { text: 'File Organizer Settings' });

		// Organization section
		containerEl.createEl('h2', { text: 'Organization' });

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

		// Automatic organization toggle
		new Setting(containerEl)
			.setName('Automatic organization')
			.setDesc('Automatically organize files once every 24 hours')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.automaticOrganization)
				.onChange(async (value) => {
					this.plugin.settings.automaticOrganization = value;
					await this.plugin.saveSettings();
				}));

		// Manual organize button
		new Setting(containerEl)
			.setName('Organize files now')
			.setDesc('Manually trigger file organization')
			.addButton(button => button
				.setButtonText('Organize Now')
				.setCta()
				.onClick(() => {
					this.plugin.organizeFiles();
				}));

		// Rules section
		containerEl.createEl('h2', { text: 'Organization Rules' });
		containerEl.createEl('p', {
			text: 'Match files by tag (markdown only), file type, filename pattern, or any combination. Leave fields empty to ignore that criteria.',
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
				.onClick(async () => {
					this.plugin.settings.rules.push({
						tag: '',
						folder: '',
						fileType: '',
						filenamePattern: ''
					});
					await this.plugin.saveSettings();
					this.display();
				}));

		// Excluded folders section
		containerEl.createEl('h2', { text: 'Excluded Folders' });
		containerEl.createEl('p', {
			text: 'Files in these folders will never be moved.',
			cls: 'setting-item-description'
		});

		// Display existing excluded folders
		this.plugin.settings.excludedFolders.forEach((folder, index) => {
			this.addExcludedFolderSetting(containerEl, folder, index);
		});

		// Add new excluded folder button
		new Setting(containerEl)
			.addButton(button => button
				.setButtonText('Add Excluded Folder')
				.onClick(async () => {
					this.plugin.settings.excludedFolders.push('');
					await this.plugin.saveSettings();
					this.display();
				}));
	}

	addRuleSetting(containerEl: HTMLElement, rule: OrganizeRule, index: number) {
		const ruleSetting = new Setting(containerEl)
			.setClass('file-organizer-rule');

		// Single row with tag, filetype, filename pattern, folder, and delete
		ruleSetting
			.addText(text => text
				.setPlaceholder('#tag')
				.setValue(rule.tag || '')
				.onChange(async (value) => {
					// Ensure tag starts with #
					if (value && !value.startsWith('#')) {
						value = '#' + value;
					}
					rule.tag = value;
					await this.plugin.saveSettings();
					// Update the input field to show the #
					text.setValue(value);
				}))
			.addText(text => text
				.setPlaceholder('type (png/pdf/md)')
				.setValue(rule.fileType || '')
				.onChange(async (value) => {
					rule.fileType = value;
					await this.plugin.saveSettings();
				}))
			.addText(text => text
				.setPlaceholder('filename pattern')
				.setValue(rule.filenamePattern || '')
				.onChange(async (value) => {
					rule.filenamePattern = value;
					await this.plugin.saveSettings();
				}))
			.addText(text => text
				.setPlaceholder('folder/path')
				.setValue(rule.folder)
				.onChange(async (value) => {
					rule.folder = value;
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
	}

	addExcludedFolderSetting(containerEl: HTMLElement, folder: string, index: number) {
		const folderSetting = new Setting(containerEl)
			.setClass('file-organizer-excluded-folder');

		folderSetting
			.addText(text => text
				.setPlaceholder('folder/path')
				.setValue(folder)
				.onChange(async (value) => {
					this.plugin.settings.excludedFolders[index] = value;
					await this.plugin.saveSettings();
				}))
			.addButton(button => button
				.setButtonText('Delete')
				.setWarning()
				.onClick(async () => {
					this.plugin.settings.excludedFolders.splice(index, 1);
					await this.plugin.saveSettings();
					this.display();
				}));
	}
}
