# File Organizer

> **⚠️ Disclaimer:** This plugin was vibe coded. Use at your own risk and back up your vault.

Automatically organize files in Obsidian by tags, file types, and filename patterns.

## Features

- **Multiple matching criteria**: Tags (markdown only), file types, filename patterns, or combinations
- **Automatic organization**: On startup and/or every 24 hours
- **Excluded folders**: Protect specific directories from organization
- **Safe**: Only moves files, never deletes or modifies content
- **Silent operation**: Runs in background, notifies only when files are moved

## Installation

1. Download `main.js` and `manifest.json` from releases
2. Create folder: `.obsidian/plugins/file-organizer/`
3. Copy files into folder
4. Restart Obsidian
5. Enable in Settings → Community Plugins

## Usage

### Create Rules

Go to Settings → File Organizer:

**Example rules:**
- Move all files with `#archive` tag → `Archive/` folder
- Move all `png` files with "Screenshot" in name → `Attachments/Screenshots/`
- Move all `pdf` files → `Documents/`

Each rule can use:
- **Tag** (requires `#`, markdown files only)
- **File type** (`png`, `pdf`, `md`, etc.)
- **Filename pattern** (matches anywhere in filename)
- **Target folder** (required)

Leave criteria empty to ignore. Multiple criteria = AND logic.

### Organization Options

- **Organize on startup**: Runs when Obsidian launches
- **Automatic organization**: Runs every 24 hours
- **Organize Now**: Manual trigger

### Excluded Folders

Add folders to exclude (e.g., `Templates`). Files in excluded folders are never moved.

## How It Works

1. Plugin checks all vault files against rules
2. Matches files by specified criteria (tag/type/pattern)
3. Moves matching files to target folders
4. Shows notification: "Moved X files"

## Tag Detection

Works with frontmatter and inline tags:

```yaml
---
tags: archive
---
```

```markdown
This note #archive
```

Both formats supported. Tag input requires `#` prefix.

## Safety

- Only moves files, never deletes
- Won't overwrite existing files
- Skips files already in target folder
- Creates folders if they don't exist

## Development

```bash
npm install
npm run build
```

## License

MIT © 2026 Jani Laatunen
