export type BootstrapCheckStatus = 'ready' | 'warning' | 'missing';

export type BootstrapCheck = {
  id: 'powershell' | 'exchangeModule' | 'logDirectory' | 'tenantConfig';
  label: string;
  status: BootstrapCheckStatus;
  detail: string;
};

export type SessionStatus = {
  appVersion: string;
  environment: 'development' | 'production';
  checks: BootstrapCheck[];
  security: {
    contextIsolation: boolean;
    sandbox: boolean;
    nodeIntegration: boolean;
  };
};
