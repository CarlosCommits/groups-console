import { describe, expect, it } from 'vitest';

import { createPowerShellProcessEnvironment } from './powershell-process-environment';

describe('createPowerShellProcessEnvironment', () => {
  it('removes inherited module paths so Windows PowerShell constructs its native defaults', () => {
    const environment = {
      TEMP: 'C:\\Users\\ExampleUser\\AppData\\Local\\Temp',
      PSModulePath: 'C:\\Program Files\\PowerShell\\7\\Modules',
    };

    const result = createPowerShellProcessEnvironment('powershell.exe', environment);

    expect(result).toEqual({ TEMP: 'C:\\Users\\ExampleUser\\AppData\\Local\\Temp' });
    expect(result).not.toBe(environment);
    expect(environment.PSModulePath).toBe('C:\\Program Files\\PowerShell\\7\\Modules');
  });

  it('removes PSModulePath without depending on environment-key casing', () => {
    const result = createPowerShellProcessEnvironment('powershell.exe', {
      PsModulePath: 'C:\\Custom\\Modules',
      SystemRoot: 'C:\\Windows',
    });

    expect(result).toEqual({ SystemRoot: 'C:\\Windows' });
  });

  it('does not rewrite the PowerShell 7 environment', () => {
    const environment = { PSModulePath: 'C:\\Program Files\\PowerShell\\7\\Modules' };

    expect(createPowerShellProcessEnvironment('pwsh.exe', environment)).toBe(environment);
  });
});
