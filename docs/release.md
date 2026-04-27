# Release Process

Groups Console uses npm semver, git tags, and GitHub Releases.

## Versioning

- `0.1.x`: first launch line and patch fixes.
- `0.2.0`, `0.3.0`, etc.: meaningful feature releases before general availability.
- `1.0.0`: stable supported baseline.

Use patch releases for bug fixes and small copy/configuration changes. Use minor releases for new workflows, larger UI changes, or packaging/update behavior changes.

## Create A Release

Start from a clean working tree on the branch you intend to release.

```powershell
npm run release:patch
```

or:

```powershell
npm run release:minor
```

The `npm version` command runs lint, typecheck, and tests through `preversion`, updates `package.json` and `package-lock.json`, creates a release commit, and creates a `vX.Y.Z` git tag.

Push the commit and tag:

```powershell
npm run release:push
```

Pushing a `vX.Y.Z` tag starts the GitHub Actions release workflow. The workflow runs verification, builds the Windows distributables with Electron Forge, and publishes the generated installer/update assets to a GitHub Release.

## Distribution

Do not commit generated `.exe`, `.nupkg`, `RELEASES`, or `.zip` files to the repository. They belong in GitHub Releases, not git history.

For the current Windows-first app, distribute the generated `GroupsConsoleSetup.exe` from the matching GitHub Release. Keep the Squirrel `RELEASES` file and `.nupkg` assets attached to the release as well; those are the assets needed by Squirrel-style update feeds.

## Updates

Packaged builds check for updates through Electron's Squirrel updater and the public `update.electronjs.org` feed:

```text
https://update.electronjs.org/CarlosCommits/groups-console/win32-x64/<current-version>
```

The app checks shortly after startup and then periodically while it is running. When a new GitHub Release is available, Electron downloads the update in the background. After the download completes, the header shows an `Update` button. Clicking it restarts Groups Console and applies the downloaded update.

This update path requires:

- a public GitHub repository
- release assets published to GitHub Releases
- the Squirrel `.nupkg` and `RELEASES` assets attached to the release

If the repository becomes private or update access needs to be tenant-restricted, replace `update.electronjs.org` with a private Squirrel-compatible update server or static storage feed. Do not put GitHub personal access tokens in the desktop app.
