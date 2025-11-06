# Subtitle Player

This project contains a statically exported Next.js interface for frame-accurate video review and subtitle QA workflows. The codebase bundles the player, ingest forms, and subtitle parsing utilities so the resulting site can be hosted from a folder path such as `/ppantoja/subtitleplayer/`.

## Local development

1. Install dependencies
   ```bash
   npm install
   ```
   > If the install fails due to a registry restriction (such as the locked-down execution environment used to generate this code), retry the command from a network that can reach the public npm registry.
2. Run the development server
   ```bash
   npm run dev
   ```
3. Visit `http://localhost:3000` in your browser.

## Building a static deploy

To create the static bundle that can be uploaded to your hosting provider, run:

```bash
npm run build:static
```

When the script completes, the static output lives in `deploy/ppantoja/subtitleplayer/`. Upload the contents of that directory to your hosting bucket. Make sure the bucket is configured for static website hosting so requests to `/ppantoja/subtitleplayer/` resolve to the included `index.html`.

## Testing note

The generated testing log shows `⚠️ npm install (not run; registry access is blocked in this environment)` because the automated environment intentionally blocks external network calls. This warning simply indicates that dependency installation could not be verified during code generation. Running `npm install` locally (or in any environment with registry access) resolves the warning.
