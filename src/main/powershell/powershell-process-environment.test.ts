import { describe, expect, it } from 'vitest';

import { createPowerShellProcessEnvironment } from './powershell-process-environment';

describe('createPowerShellProcessEnvironment', () => {
  it('puts Windows PowerShell module locations before inherited PowerShell 7 locations', () => {
    const result = createPowerShellProcessEnvironment('powershell.exe', {
      USERPROFILE: 'C:\\Users\\ExampleUser',
      ProgramFiles: 'C:\\Program Files',
      SystemRoot: 'C:\\Windows',
      PSModulePath: 'C:\\Program Files\\PowerShell\\7\\Modules;C:\\Program Files\\WindowsPowerShell\\Modules',
    });

    expect(result.PSModulePath?.split(';')).toEqual([
      'C:\\Users\\ExampleUser\\Documents\\WindowsPowerShell\\Modules',
      'C:\\Program Files\\WindowsPowerShell\\Modules',
      'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\Modules',
      'C:\\Program Files\\PowerShell\\7\\Modules',
    ]);
  });

  it('does not rewrite the PowerShell 7 environment', () => {
    const environment = { PSModulePath: 'C:\\Program Files\\PowerShell\\7\\Modules' };

    expect(createPowerShellProcessEnvironment('pwsh.exe', environment)).toBe(environment);
  });
});
