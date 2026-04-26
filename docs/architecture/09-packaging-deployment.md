# 09. Packaging and Deployment

## Purpose

Define how Groups Console v2 is built, signed, installed, and updated on administrator workstations.

## Packaging choice

- Electron application
- `electron-builder` for Windows packaging
- signed NSIS installer for first release

## Deployment posture

This is an internal admin tool. The preferred deployment path is enterprise-friendly distribution such as Intune, SCCM, or a controlled internal installer share.

## Initial update strategy

- no mandatory in-app auto-update for v1
- app can display current version and available-version messaging later
- release management remains controlled by IT

## Runtime assumptions

- Windows 10/11 x64 managed workstation
- Windows PowerShell 5.1 available
- ExchangeOnlineManagement module required at supported pinned version range
- app no longer depends on `ImportExcel`

## Installer responsibilities

- install signed desktop app
- include packaged PowerShell scripts/modules needed by app
- verify PowerShell availability on first run
- verify Exchange module availability on first run and guide install/remediation if missing
- support an app-owned ExchangeOnlineManagement install/remediation path after launch through the main-process IPC and packaged PowerShell worker, without broadening the renderer into a privileged shell

## Execution policy rule

The app must not require permanent execution-policy changes as a normal setup step. Preferred behavior:

1. launch app-owned PowerShell sessions with process-scoped execution policy handling
2. avoid calling persistent `Set-ExecutionPolicy` during normal startup
3. if MachinePolicy or UserPolicy prevents execution, surface a clear prerequisite error to the admin

## Code signing

- production builds must be code signed
- installer and executable signatures must be verifiable by IT
- unsigned builds are for local development only

## Packaging decisions

- x64 only for v1
- per-user install is acceptable if that minimizes unnecessary elevation
- if enterprise environment requires per-machine install, document that as a deployment profile rather than changing app behavior

## Bootstrap checks on first run

1. PowerShell version availability
2. ExchangeOnlineManagement module presence, version, and importability
3. write access for log directory
4. tenant configuration presence
5. whether effective execution policy permits the worker strategy in this environment

The shell/auth UI consumes these checks immediately. It can block or defer Exchange sign-in when PowerShell is missing, ExchangeOnlineManagement is missing, or the module is installed but cannot be imported. Missing ExchangeOnlineManagement may be remediated through the app-owned install action; installed-but-not-importable failures should be surfaced with the import error and IT remediation guidance.

## Rollback support

- retain prior installer packages outside the app
- keep local data and logs separate from app binaries
- avoid destructive uninstall behavior for app data unless explicitly requested

## Acceptance criteria

- Packaging does not depend on changing machine-wide execution policy.
- Packaging does not depend on permanent execution-policy mutation as a normal setup path.
- The deployment path is compatible with managed Windows admin environments.
- The runtime dependency story is explicit and supportable.
