# Contributing

Thanks for helping improve atmos-fx.

## Development Setup

```bash
npm install
npm run typecheck
npm test
npm run build
```

Use small, focused pull requests. Include tests when changing option normalization, lifecycle behavior, renderer logic, DOM integration, collision behavior, or public types.

## Local Smoke Checks

After building, run the docs playground:

```bash
npx vite --host 127.0.0.1 --port 4173
```

Open:

- `http://127.0.0.1:4173/docs/`

For visual changes, check at least one desktop viewport and one narrow/mobile viewport.

## Pull Request Notes

Please include:

- Summary of the user-facing change.
- Tests or smoke checks run locally.
- Screenshots or short video for visual changes when useful.
- Any follow-up work that should not block the PR.

## Release Policy

Release work should follow `docs/release-checklist.md`. Do not publish a new version until the package tarball has been inspected and a temporary consumer install has passed.
