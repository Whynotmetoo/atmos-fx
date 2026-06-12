# Release Checklist

Use this checklist before publishing atmos-fx.

## Before Versioning

- Confirm the intended release scope is represented in `CHANGELOG.md`.
- Confirm `README.md` examples match the current public API.
- Confirm `docs/accessibility.md` covers motion and readability guidance for any new effect.
- Confirm package exports in `package.json` are intentional.
- Confirm optional adapters are represented as optional peer dependencies if the core entrypoint does not require them (Note: React is currently a required peer dependency since the root entrypoint exports React components directly).
- Confirm no local-only files such as `AGENTS.md` or `docs_local/` are staged.

## Validation

Run:

```bash
npm run typecheck
npm test
npm run build
npm pack --dry-run
```

Then create a package tarball and install it into a temporary consumer project:

```bash
tmpdir="$(mktemp -d)"
npm pack --pack-destination "$tmpdir"
mkdir "$tmpdir/consumer"
cd "$tmpdir/consumer"
npm init -y
npm install ../atmos-fx-*.tgz react
```

Validate that package imports resolve:

```bash
node --input-type=module -e "const core = await import('atmos-fx'); const pkg = await import('atmos-fx/package.json', { with: { type: 'json' } }); console.log(typeof core.createAtmosphere, typeof core.AtmosFx, pkg.default.name)"
```

Inspect the installed package:

```bash
find node_modules/atmos-fx -maxdepth 3 -type f | sort
```

Expected package contents include `dist/index.js`, `dist/react.js`, type declarations, `dist/atmos-fx.css`, `README.md`, `LICENSE`, `CHANGELOG.md`, and `package.json`.

## Publishing

- Update `version` in `package.json` and `package-lock.json`.
- Move relevant `CHANGELOG.md` entries from `Unreleased` to the new version heading.
- Commit with a release-focused Conventional Commit.
- Publish from a clean working tree.
- Create a GitHub release with the changelog notes.

## Rollback

If a published package is broken:

- Deprecate the broken version on npm with a clear message.
- Publish a patch release with the fix.
- Add a changelog note explaining the affected version and the replacement version.
