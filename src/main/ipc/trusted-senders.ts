const trustedWebContentsIds = new Set<number>();

export function registerTrustedWebContents(id: number): void {
  trustedWebContentsIds.add(id);
}

export function clearTrustedWebContents(): void {
  trustedWebContentsIds.clear();
}

export function isTrustedWebContents(id: number): boolean {
  return trustedWebContentsIds.has(id);
}
