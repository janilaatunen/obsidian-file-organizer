# File Organizer

> **⚠️ Disclaimer:** This plugin was vibe coded. It works, but edge cases may exist. Use at your own risk and always back up your vault before use.

An Obsidian plugin that automatically organizes files by moving them to specified folders based on their tags. Runs silently in the background every 6 hours and on startup.

## Features

- **Automatic Organization**: Runs every 6 hours and optionally on startup
- **Tag-Based Rules**: Move files with specific tags to designated folders
- **Multiple Rules**: Create as many organization rules as you need
- **Silent Operation**: Works in the background, only shows notification when files are moved
- **Safe**: Never deletes or modifies file content, only moves files
- **Flexible**: Enable/disable rules individually or turn off startup organization
- **Smart**: Skips files already in the target folder, prevents duplicate file conflicts

## How It Works

1. Define rules: "Files with tag X should be in folder Y"
2. Plugin checks all markdown files in your vault
3. Files with matching tags are automatically moved to the specified folder
4. You get a single notification when files are moved: "Moved 5 files"

## Installation

### Manual Installation

1. Download the latest release files:
   - `main.js`
   - `manifest.json`

2. Create a folder in your vault: `.obsidian/plugins/file-organizer/`

3. Copy the downloaded files into this folder

4. Restart Obsidian or reload the app

5. Go to Settings → Community Plugins and enable "File Organizer"

## Setup

1. Open **Settings → File Organizer**

2. Configure startup behavior:
   - **Organize on startup**: Toggle to enable/disable organization when Obsidian launches

3. Add organization rules:
   - Click **"Add Rule"**
   - Enter a **Tag** (e.g., `archive` or `#archive`)
   - Enter a **Target Folder** (e.g., `Archive` or `Archive/2024`)
   - Toggle the rule **on/off** as needed

4. Files are automatically organized every 6 hours

## Usage

### Automatic Organization

Once configured, the plugin works automatically:
- **On startup** (if enabled in settings)
- **Every 6 hours** while Obsidian is running

### Manual Organization

You can manually trigger organization:
- Settings → File Organizer → **"Organize Now"** button
- Command Palette (Cmd/Ctrl+P) → "File Organizer: Organize files now"

### Creating Rules

**Example Rule:**
```
Tag: archive
Target Folder: Archive/2024
```

This moves all files tagged with `#archive` into the `Archive/2024` folder.

**Tag Formats Supported:**
- `archive` (without #)
- `#archive` (with #)
- Works with both frontmatter tags and inline tags

## Settings

### Organization Rules

Each rule has:
- **Tag**: The tag to search for in files
- **Target Folder**: Where files should be moved
- **Enabled/Disabled**: Toggle to activate/deactivate the rule
- **Delete**: Remove the rule

### Options

- **Organize on startup**: Enable/disable automatic organization when Obsidian launches
- **Organize Now**: Manual button to trigger organization immediately

## Tag Detection

The plugin finds tags in two places:

**Frontmatter:**
```yaml
---
tags:
  - archive
  - old
---
```

**Inline:**
```markdown
This note needs to be archived #archive
```

Both formats are supported and normalized (case-insensitive, with or without `#`).

## Safety Features

- **No File Deletion**: Only moves files, never deletes
- **No Content Modification**: File contents remain unchanged
- **Duplicate Prevention**: Won't move if a file with the same name exists in target folder
- **Error Handling**: Logs errors without crashing
- **Skip Already Organized**: Won't move files already in the target folder

## Known Limitations

- Only works with markdown files (`.md`)
- Does not organize attachments/images (only moves the markdown files)
- Rules are processed sequentially, not in parallel
- If a file has multiple tags from different rules, the first matching rule applies
- Does not handle nested tag hierarchies (e.g., `#project/work`)

## Troubleshooting

### Files not moving
- Check that the tag exactly matches (case-insensitive)
- Verify the target folder path is correct
- Ensure the rule is enabled (toggle is on)
- Check console (Cmd/Ctrl+Shift+I) for errors

### File already exists warning
- A file with the same name already exists in the target folder
- Rename one of the files to resolve the conflict

### Folder not created
- Parent folders must exist
- Create parent folders manually first

## Development

Built with:
- TypeScript
- Obsidian API
- esbuild for bundling

### Building from source

```bash
npm install
npm run build
```

## License

MIT

## Author

Jani Laatunen

## Contributing

This is a personal project that was vibe coded. Feel free to fork and improve it, but don't expect production-grade code quality. Pull requests are welcome if you want to fix bugs or add features.
