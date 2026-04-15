import { mkdir, readdir, rename, stat, unlink } from 'node:fs/promises';
import path from 'node:path';

const MAX_STREAM_BYTES = 1_000_000;
const MAX_TOTAL_STREAM_BYTES = 5_000_000;

export async function rotateIfNeeded(logDirectory: string, stream: string): Promise<string> {
  await mkdir(logDirectory, { recursive: true });

  const currentPath = path.join(logDirectory, `${stream}-current.jsonl`);

  try {
    const currentStats = await stat(currentPath);
    if (currentStats.size >= MAX_STREAM_BYTES) {
      const archivedPath = path.join(logDirectory, `${stream}-${new Date().toISOString().replace(/[:.]/g, '-')}.jsonl`);
      await rename(currentPath, archivedPath);
    }
  } catch {
    // ignore missing current file
  }

  await pruneStream(logDirectory, stream);
  return currentPath;
}

async function pruneStream(logDirectory: string, stream: string): Promise<void> {
  const entries = await readdir(logDirectory, { withFileTypes: true });
  const matchingFiles = entries
    .filter((entry) => entry.isFile() && entry.name.startsWith(`${stream}-`) && entry.name.endsWith('.jsonl'))
    .map((entry) => path.join(logDirectory, entry.name));

  const stats = await Promise.all(
    matchingFiles.map(async (filePath) => ({
      filePath,
      ...(await stat(filePath)),
    })),
  );

  stats.sort((left, right) => right.mtimeMs - left.mtimeMs);

  let retainedBytes = 0;
  for (const entry of stats) {
    retainedBytes += entry.size;
    if (retainedBytes > MAX_TOTAL_STREAM_BYTES && !entry.filePath.endsWith('-current.jsonl')) {
      await unlink(entry.filePath).catch(() => undefined);
    }
  }
}
