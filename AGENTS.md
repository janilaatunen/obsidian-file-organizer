# obsidian-file-organizer

Obsidian plugin for automatic rule-based file organization.

## Rules

- **Organization runs on startup and every 24 hours.** It moves the user's files, so any change to the rules engine or the excluded-folder checks risks misfiling a real vault — reason it through before changing either.
- `main.js` is a build artifact and gitignored — never hand-edit it.

## Verification

```bash
npm run build       # typecheck + build; esbuild copies into ~/Obsidian/Main on success
```

`build` alone already deploys. `npm run build:deploy` exists for the case where the esbuild copy step is bypassed; it re-copies explicitly.

**Then reload Obsidian** (Cmd+Option+I for the console) and check for errors. A build that succeeds proves nothing about runtime behaviour in the app.
