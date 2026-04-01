import { app } from 'electron';

export function isPackagedRuntime(): boolean {
  return typeof app !== 'undefined' && typeof app.isPackaged === 'boolean'
    ? app.isPackaged
    : false;
}
