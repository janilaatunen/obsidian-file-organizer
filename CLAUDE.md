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
npm run build   # Production build → main.js, auto-deploys to vault
npm run dev     # Watch mode, auto-deploys to vault on every save
```

## Build Output

- `main.js` — plugin code (gitignored)
- `manifest.json` — plugin metadata

## Deployment

Build and deploy are automatic — esbuild copies files to the vault after every build.

**After any code change, run `npm run build` to build and deploy to vault.**

Then reload Obsidian (Cmd+Option+I to open console and check for errors).

> **Claude Code:** Always run `npm run build` after making any code changes to this plugin.

## Git

Identity: personal (`jani@laatunen.fi` / janilaatunen)

## Rules

- Never increment version numbers without explicit confirmation
- "Vibe coded" — focus on functionality over perfect code quality
- Always recommend users backup their vault before using
