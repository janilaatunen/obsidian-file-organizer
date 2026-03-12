# CLAUDE.md — obsidian-file-organizer

Obsidian plugin for automatic rule-based file organization.

## Tech Stack

- TypeScript, esbuild
- Obsidian API

## Architecture

- Main class extends `Plugin`
- Rule-based file organization engine
- Tag detection in frontmatter and inline content
- Scheduled organization: runs on startup + every 24 hours
- Excluded folders protection
- Settings interface + settings tab

## Commands

```bash
npm install
npm run build   # Production build → main.js
npm run dev     # Watch mode
```

## Build Output

- `main.js` — plugin code (gitignored)
- `manifest.json` — plugin metadata

## Deployment

After committing, copy built files to vault:

```bash
cp main.js manifest.json \
  ~/Obsidian/Codex/.obsidian/plugins/obsidian-file-organizer/
```

Then reload Obsidian (Cmd+Option+I to open console and check for errors).

## Git

Identity: personal (`jani@laatunen.fi` / janilaatunen)

## Rules

- Never increment version numbers without explicit confirmation
- "Vibe coded" — focus on functionality over perfect code quality
- Always recommend users backup their vault before using
