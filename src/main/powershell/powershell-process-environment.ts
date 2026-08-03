type PowerShellCommand = 'powershell.exe' | 'pwsh.exe';

export function createPowerShellProcessEnvironment(
  command: PowerShellCommand,
  environment: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  if (command !== 'powershell.exe') {
    return environment;
  }

  const childEnvironment = { ...environment };
  for (const key of Object.keys(childEnvironment)) {
    if (key.toLowerCase() === 'psmodulepath') {
      delete childEnvironment[key];
    }
  }

  return childEnvironment;
}
