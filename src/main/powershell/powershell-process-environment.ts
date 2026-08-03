import { win32 as path } from 'node:path';

type PowerShellCommand = 'powershell.exe' | 'pwsh.exe';

export function createPowerShellProcessEnvironment(
  command: PowerShellCommand,
  environment: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  if (command !== 'powershell.exe') {
    return environment;
  }

  const preferredModulePaths = [
    environment.USERPROFILE
      ? path.join(environment.USERPROFILE, 'Documents', 'WindowsPowerShell', 'Modules')
      : null,
    environment.ProgramFiles
      ? path.join(environment.ProgramFiles, 'WindowsPowerShell', 'Modules')
      : null,
    environment.SystemRoot
      ? path.join(environment.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'Modules')
      : null,
  ];
  const inheritedModulePaths = (environment.PSModulePath ?? '')
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const modulePaths = [...preferredModulePaths, ...inheritedModulePaths].filter(
    (entry): entry is string => {
      if (!entry) {
        return false;
      }

      const key = entry.toLowerCase();
      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    },
  );

  return {
    ...environment,
    PSModulePath: modulePaths.join(';'),
  };
}
