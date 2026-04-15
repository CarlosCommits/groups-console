import { appendFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { getRadAppLogDirectory } from '@/main/app/paths';

import type { AuditEvent } from './audit-event';
import type { OperationalLogEntry } from './log-entry';
import { redactForLog } from './redact';
import { rotateIfNeeded } from './rotation';

const LAST_ERROR_FILE = 'last-error.json';

export async function writeOperationalLog(entry: OperationalLogEntry): Promise<void> {
  await writeJsonLine('ops', entry);

  if (entry.result === 'failed') {
    await writeLastError(entry);
  }
}

export async function writeAuditEvent(event: AuditEvent): Promise<void> {
  await writeJsonLine('audit', event);
}

export async function exportDiagnosticsArtifacts(outputDirectory: string): Promise<number> {
  await mkdir(outputDirectory, { recursive: true });
  const logDirectory = getRadAppLogDirectory();
  let fileCount = 0;

  try {
    const entries = await readdir(logDirectory, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.jsonl')) {
        continue;
      }

      const sourcePath = path.join(logDirectory, entry.name);
      const targetPath = path.join(outputDirectory, entry.name);
      const contents = await readFile(sourcePath, 'utf8');
      const sanitizedContents = sanitizeLogFileForDiagnostics(entry.name, contents);

      await writeFile(targetPath, sanitizedContents, 'utf8');
      fileCount += 1;
    }
  } catch {
    // ignore missing log directories or unreadable files; session-status export still provides useful diagnostics.
  }

  return fileCount;
}

export async function readLastErrorSummary(): Promise<Record<string, unknown> | null> {
  try {
    const contents = await readFile(path.join(getRadAppLogDirectory(), LAST_ERROR_FILE), 'utf8');
    return JSON.parse(contents) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function sanitizeLastErrorSummaryForDiagnostics(
  summary: Record<string, unknown>,
): Record<string, unknown> {
  return {
    timestamp: summary.timestamp ?? null,
    level: summary.level ?? null,
    operationName: summary.operationName ?? null,
    backendOwner: summary.backendOwner ?? null,
    result: summary.result ?? null,
    safeErrorCode: summary.safeErrorCode ?? null,
    message:
      typeof summary.message === 'string' && /cancelled/i.test(summary.message)
        ? 'User cancelled diagnostics export.'
        : summary.safeErrorCode ?? summary.result ?? 'See local logs for full details.',
  };
}

async function writeJsonLine(stream: 'ops' | 'audit', entry: OperationalLogEntry | AuditEvent): Promise<void> {
  const logDirectory = getRadAppLogDirectory();
  const currentPath = await rotateIfNeeded(logDirectory, stream);
  const safeEntry = redactForLog(entry);

  await appendFile(currentPath, `${JSON.stringify(safeEntry)}\n`, 'utf8');
}

async function writeLastError(entry: OperationalLogEntry): Promise<void> {
  const logDirectory = getRadAppLogDirectory();
  await mkdir(logDirectory, { recursive: true });
  await writeFile(
    path.join(logDirectory, LAST_ERROR_FILE),
    JSON.stringify(redactForLog(entry), null, 2),
    'utf8',
  );
}

function sanitizeLogFileForDiagnostics(fileName: string, contents: string): string {
  const lines = contents
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      try {
        const parsed = JSON.parse(line) as Record<string, unknown>;
        return JSON.stringify(sanitizeLogRecordForDiagnostics(fileName, parsed));
      } catch {
        return JSON.stringify({
          timestamp: new Date().toISOString(),
          stream: fileName,
          note: 'Skipped malformed log line in diagnostics export.',
        });
      }
    });

  return lines.length > 0 ? `${lines.join('\n')}\n` : '';
}

function sanitizeLogRecordForDiagnostics(
  fileName: string,
  record: Record<string, unknown>,
): Record<string, unknown> {
  if (fileName.startsWith('audit-')) {
    return {
      timestamp: record.timestamp ?? null,
      operationType: record.operationType ?? null,
      targetObjectType: record.targetObjectType ?? null,
      summary: record.summary ?? null,
      result: record.result ?? null,
      authoritative: record.authoritative ?? null,
    };
  }

  return {
    timestamp: record.timestamp ?? null,
    level: record.level ?? null,
    operationName: record.operationName ?? null,
    backendOwner: record.backendOwner ?? null,
    result: record.result ?? null,
    safeErrorCode: record.safeErrorCode ?? null,
    message:
      typeof record.message === 'string' && /cancelled/i.test(record.message)
        ? 'User cancelled diagnostics export.'
        : record.safeErrorCode ?? record.result ?? 'See local logs for full details.',
  };
}
