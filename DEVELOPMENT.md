# Groups Console Development

## Local Setup

```bash
npm install
npm start
```

## Scripts

- `npm start` - start the Electron Forge dev app
- `npm run lint` - run ESLint
- `npm run lint:fix` - auto-fix lintable issues
- `npm run typecheck` - run the three TypeScript projects (`main`, `preload`, `renderer`)
- `npm run test` - run Vitest for `src/**/*.test.ts`
- `npm run test:watch` - run Vitest in watch mode
- `npm run package` - package the app with Electron Forge
- `npm run make` - build distributables

## Verification

For changes that affect code behavior, the normal verification baseline is:

```bash
npm run lint
npm run typecheck
npm run test
```

The repo's Vitest config currently targets `src/**/*.test.ts`. Playwright is present in the repo, but it is not wired into the default `npm test` script.

## Development Notes

- Packaging is currently based on Electron Forge, not `electron-builder`.
- Packaged PowerShell assets are shipped via Forge `extraResource`.
- The renderer is browser-like by design; add privileged behavior through preload/main, not by importing Node APIs in `src/renderer/**`.
- On some Linux development hosts, Electron startup can fail if the local `chrome-sandbox` helper is not configured correctly. Treat that as an environment issue and do not weaken the app sandbox/security settings to work around it.

## Architecture References

- `docs/architecture/03-target-architecture.md`
- `docs/architecture/04-security-model.md`
- `docs/architecture/05-exchange-graph-integration.md`
- `docs/architecture/09-packaging-deployment.md` *(some packaging details are historical; the live repo uses Electron Forge)*
- `docs/architecture/11-test-strategy.md`
- `docs/architecture/14-permission-matrix.md`
