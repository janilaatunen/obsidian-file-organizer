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
	logToDailyNote: boolean;
	dailyNotesFolder: string;
}

const DEFAULT_SETTINGS: FileOrganizerSettings = {
	rules: [],
	organizeOnStartup: true,
	automaticOrganization: true,
	lastOrganized: 0,
	excludedFolders: ['Templates'],
	logToDailyNote: true,
	dailyNotesFolder: 'Daily Notes'
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
		const movedFiles: Array<{oldPath: string, newPath: string, folder: string}> = [];

		// Get all files
		const files = this.app.vault.getFiles();

		// Process each file and check rules in priority order (first rule wins)
		for (const file of files) {
			// Skip if file is in an excluded folder
			if (this.isInExcludedFolder(file.path)) {
				continue;
			}

			// Check each rule in order (array order = priority order)
			for (const rule of this.settings.rules) {
				// Skip if file is already in target folder
				if (file.parent?.path === rule.folder) {
					break; // Don't check other rules for this file
				}

				// Check if file matches this rule
				const matches = await this.fileMatchesRule(file, rule);
				if (matches) {
					try {
						const oldPath = file.path;
						const newPath = `${rule.folder}/${file.name}`;

						// Ensure target folder exists
						await this.ensureFolder(rule.folder);

						// Check if file with same name already exists in target folder
						const existingFile = this.app.vault.getAbstractFileByPath(newPath);
						if (existingFile) {
							console.warn(`File already exists at ${newPath}, skipping ${file.path}`);
							break; // Don't check other rules for this file
						}

						await this.app.vault.rename(file, newPath);
						totalMoved++;
						movedFiles.push({
							oldPath: oldPath,
							newPath: newPath,
							folder: rule.folder
						});
						console.log(`Moved: ${oldPath} → ${newPath}`);
						break; // Don't check other rules for this file (first match wins)
					} catch (error) {
						console.error(`Error moving file ${file.path}:`, error);
						break; // Don't check other rules for this file
					}
				}
			}
		}

		// Update last organized timestamp
		this.settings.lastOrganized = Date.now();
		await this.saveSettings();

		if (totalMoved > 0) {
			new Notice(`File Organizer: Moved ${totalMoved} file${totalMoved === 1 ? '' : 's'}`);
			console.log(`File organization complete: ${totalMoved} files moved`);

			// Log to daily note if enabled
			if (this.settings.logToDailyNote) {
				await this.logToDailyNote(movedFiles);
			}
		} else {
			console.log('File organization complete: No files to move');
		}
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

	async logToDailyNote(movedFiles: Array<{oldPath: string, newPath: string, folder: string}>) {
		try {
			// Get today's date in YYYY-MM-DD format
			const today = new Date();
			const dateStr = today.toISOString().split('T')[0];
			const dailyNotePath = `${this.settings.dailyNotesFolder}/${dateStr}.md`;

			// Ensure daily notes folder exists
			await this.ensureFolder(this.settings.dailyNotesFolder);

			// Get or create the daily note
			let dailyNote = this.app.vault.getAbstractFileByPath(dailyNotePath) as TFile;

			if (!dailyNote) {
				// Create new daily note if it doesn't exist
				dailyNote = await this.app.vault.create(dailyNotePath, '');
			}

			// Read current content
			let content = await this.app.vault.read(dailyNote);

			// Get current time
			const timeStr = today.toLocaleTimeString('en-US', {
				hour: '2-digit',
				minute: '2-digit',
				hour12: false
			});

			// Build log entry - compact format
			let logEntry = `\n## File Organizer - ${timeStr}\n`;
			logEntry += `Moved ${movedFiles.length} file${movedFiles.length === 1 ? '' : 's'}:\n`;

			// Group files by folder
			const filesByFolder = new Map<string, string[]>();
			for (const file of movedFiles) {
				if (!filesByFolder.has(file.folder)) {
					filesByFolder.set(file.folder, []);
				}
				filesByFolder.get(file.folder)!.push(file.newPath);
			}

			// Create log entries grouped by folder - compact format
			for (const [folder, files] of filesByFolder.entries()) {
				logEntry += `- **${folder}**: `;
				const fileNames = files.map(filePath => filePath.split('/').pop() || filePath);
				logEntry += fileNames.join(', ') + '\n';
			}

			// Append log entry to daily note
			content += logEntry;
			await this.app.vault.modify(dailyNote, content);

			console.log(`Logged ${movedFiles.length} moved files to daily note: ${dailyNotePath}`);
		} catch (error) {
			console.error('Error logging to daily note:', error);
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

		// Logging section
		containerEl.createEl('h2', { text: 'Logging' });

		// Log to daily note toggle
		new Setting(containerEl)
			.setName('Log to daily note')
			.setDesc('Append a log entry to today\'s daily note when files are moved')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.logToDailyNote)
				.onChange(async (value) => {
					this.plugin.settings.logToDailyNote = value;
					await this.plugin.saveSettings();
				}));

		// Daily notes folder setting
		new Setting(containerEl)
			.setName('Daily notes folder')
			.setDesc('Folder where daily notes are stored')
			.addText(text => text
				.setPlaceholder('Daily Notes')
				.setValue(this.plugin.settings.dailyNotesFolder)
				.onChange(async (value) => {
					this.plugin.settings.dailyNotesFolder = value;
					await this.plugin.saveSettings();
				}));

		// Rules section
		containerEl.createEl('h2', { text: 'Organization Rules' });
		containerEl.createEl('p', {
			text: 'Match files by tag (markdown only), file type, filename pattern, or any combination. Leave fields empty to ignore that criteria. Rules are processed in order (top = highest priority). If a file matches multiple rules, the first matching rule wins.',
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
				.setIcon('arrow-up')
				.setTooltip('Move rule up (higher priority)')
				.setDisabled(index === 0)
				.onClick(async () => {
					// Swap with previous rule
					const temp = this.plugin.settings.rules[index - 1];
					this.plugin.settings.rules[index - 1] = this.plugin.settings.rules[index];
					this.plugin.settings.rules[index] = temp;
					await this.plugin.saveSettings();
					this.display();
				}))
			.addButton(button => button
				.setIcon('arrow-down')
				.setTooltip('Move rule down (lower priority)')
				.setDisabled(index === this.plugin.settings.rules.length - 1)
				.onClick(async () => {
					// Swap with next rule
					const temp = this.plugin.settings.rules[index + 1];
					this.plugin.settings.rules[index + 1] = this.plugin.settings.rules[index];
					this.plugin.settings.rules[index] = temp;
					await this.plugin.saveSettings();
					this.display();
				}))
			.addButton(button => button
				.setIcon('trash')
				.setTooltip('Delete rule')
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
				.setIcon('trash')
				.setTooltip('Delete excluded folder')
				.onClick(async () => {
					this.plugin.settings.excludedFolders.splice(index, 1);
					await this.plugin.saveSettings();
					this.display();
				}));
	}
}
