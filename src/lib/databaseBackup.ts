import { db } from './db';
import type { Session, Folder } from './types';
import { downloadBlob } from './export';

export interface SerializedAudioBlob {
  id: string;
  mimeType: string;
  dataUrl: string;
  createdAt: number;
}

export interface SonexaDatabaseDump {
  version: 1;
  app: 'Sonexa AI Meeting Copilot' | 'Sonexa Audio Workspace';
  exportedAt: number;
  metadata: {
    sessionCount: number;
    folderCount: number;
    audioCount: number;
    hasAudioBlobs: boolean;
    appVersion: string;
  };
  sessions: Session[];
  folders: Folder[];
  settings: { id: string; value: unknown }[];
  audioBlobs?: SerializedAudioBlob[];
}

export interface ImportSummary {
  sessionCount: number;
  folderCount: number;
  audioCount: number;
  exportedAt: number;
  hasAudioBlobs: boolean;
}

export interface ImportResult {
  success: boolean;
  sessionsImported: number;
  foldersImported: number;
  audioBlobsImported: number;
  settingsImported: number;
  error?: string;
}

// Convert a binary Blob to base64 DataURL
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Convert a base64 DataURL back to binary Blob
export function dataUrlToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(',');
  const mimeMatch = parts[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'audio/webm';
  const bstr = atob(parts[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

// ----------------------------------------------------------------------------
// EXPORT DATABASE
// ----------------------------------------------------------------------------

export async function exportDatabaseToJson(
  options: {
    includeAudioBlobs?: boolean;
    onProgress?: (progress: number, label: string) => void;
  } = {}
): Promise<SonexaDatabaseDump> {
  const { includeAudioBlobs = true, onProgress } = options;

  onProgress?.(0.1, 'Loading folders and sessions…');
  const [sessions, folders, settings] = await Promise.all([
    db.sessions.toArray(),
    db.folders.toArray(),
    db.settings.toArray(),
  ]);

  let serializedAudio: SerializedAudioBlob[] | undefined = undefined;

  if (includeAudioBlobs) {
    onProgress?.(0.3, 'Loading audio recordings…');
    const allAudio = await db.audio.toArray();
    serializedAudio = [];

    for (let i = 0; i < allAudio.length; i++) {
      const item = allAudio[i];
      const ratio = 0.3 + (0.6 * (i + 1)) / (allAudio.length || 1);
      onProgress?.(ratio, `Serializing audio ${i + 1} of ${allAudio.length}…`);

      try {
        const dataUrl = await blobToDataUrl(item.blob);
        serializedAudio.push({
          id: item.id,
          mimeType: item.blob.type || 'audio/webm',
          dataUrl,
          createdAt: item.createdAt,
        });
      } catch (err) {
        console.warn(`Could not serialize audio blob ${item.id}`, err);
      }
    }
  }

  onProgress?.(0.95, 'Preparing backup file…');

  const dump: SonexaDatabaseDump = {
    version: 1,
    app: 'Sonexa AI Meeting Copilot',
    exportedAt: Date.now(),
    metadata: {
      sessionCount: sessions.length,
      folderCount: folders.length,
      audioCount: serializedAudio ? serializedAudio.length : 0,
      hasAudioBlobs: !!serializedAudio && serializedAudio.length > 0,
      appVersion: '1.2.0',
    },
    sessions,
    folders,
    settings,
    audioBlobs: serializedAudio,
  };

  onProgress?.(1.0, 'Export complete!');
  return dump;
}

export async function downloadDatabaseBackup(
  options: {
    includeAudioBlobs?: boolean;
    onProgress?: (progress: number, label: string) => void;
  } = {}
): Promise<void> {
  const dump = await exportDatabaseToJson(options);
  const jsonString = JSON.stringify(dump, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });

  const dateStr = new Date(dump.exportedAt).toISOString().split('T')[0];
  const typeTag = options.includeAudioBlobs === false ? 'light' : 'full';
  const filename = `sonexa-database-backup-${dateStr}-${typeTag}.json`;

  downloadBlob(filename, blob);
}

// ----------------------------------------------------------------------------
// INSPECT & VALIDATE BACKUP FILE
// ----------------------------------------------------------------------------

export async function inspectBackupFile(file: File): Promise<{
  dump: SonexaDatabaseDump;
  summary: ImportSummary;
}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = reader.result as string;
        const parsed = JSON.parse(text);

        if (!parsed || (parsed.app !== 'Sonexa Audio Workspace' && parsed.app !== 'Sonexa AI Meeting Copilot') || parsed.version !== 1) {
          throw new Error('Invalid file format. This file is not a valid Sonexa backup JSON.');
        }

        if (!Array.isArray(parsed.sessions) || !Array.isArray(parsed.folders)) {
          throw new Error('Backup file is corrupt: missing sessions or folders array.');
        }

        const summary: ImportSummary = {
          sessionCount: parsed.sessions.length,
          folderCount: parsed.folders.length,
          audioCount: Array.isArray(parsed.audioBlobs) ? parsed.audioBlobs.length : 0,
          exportedAt: parsed.exportedAt || Date.now(),
          hasAudioBlobs: Array.isArray(parsed.audioBlobs) && parsed.audioBlobs.length > 0,
        };

        resolve({ dump: parsed, summary });
      } catch (err: unknown) {
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file from disk.'));
    reader.readAsText(file);
  });
}

// ----------------------------------------------------------------------------
// IMPORT DATABASE
// ----------------------------------------------------------------------------

export async function importDatabaseFromJson(
  dump: SonexaDatabaseDump,
  mode: 'merge' | 'replace' = 'merge',
  onProgress?: (ratio: number, status: string) => void
): Promise<ImportResult> {
  const result: ImportResult = {
    success: false,
    sessionsImported: 0,
    foldersImported: 0,
    audioBlobsImported: 0,
    settingsImported: 0,
  };

  try {
    onProgress?.(0.1, 'Beginning database import transaction…');

    await db.transaction('rw', [db.sessions, db.folders, db.audio, db.settings], async () => {
      // 1. If REPLACE mode, clear existing tables first
      if (mode === 'replace') {
        onProgress?.(0.2, 'Clearing existing local tables…');
        await Promise.all([
          db.sessions.clear(),
          db.folders.clear(),
          db.audio.clear(),
          // keep local settings or replace? replace settings
          db.settings.clear(),
        ]);
      }

      // 2. Import Folders
      onProgress?.(0.3, `Importing ${dump.folders.length} folders…`);
      for (const folder of dump.folders) {
        await db.folders.put(folder);
        result.foldersImported++;
      }

      // 3. Import Sessions
      onProgress?.(0.5, `Importing ${dump.sessions.length} sessions…`);
      for (const session of dump.sessions) {
        await db.sessions.put(session);
        result.sessionsImported++;
      }

      // 4. Import Audio Blobs (if present)
      if (Array.isArray(dump.audioBlobs) && dump.audioBlobs.length > 0) {
        const total = dump.audioBlobs.length;
        for (let i = 0; i < total; i++) {
          const item = dump.audioBlobs[i];
          const ratio = 0.5 + (0.4 * (i + 1)) / total;
          onProgress?.(ratio, `Restoring audio recording ${i + 1} of ${total}…`);

          try {
            const blob = dataUrlToBlob(item.dataUrl);
            await db.audio.put({
              id: item.id,
              blob,
              createdAt: item.createdAt || Date.now(),
            });
            result.audioBlobsImported++;
          } catch (audioErr) {
            console.warn(`Could not restore audio blob ${item.id}`, audioErr);
          }
        }
      }

      // 5. Import Settings (if present)
      if (Array.isArray(dump.settings)) {
        for (const s of dump.settings) {
          await db.settings.put(s);
          result.settingsImported++;
        }
      }
    });

    onProgress?.(1.0, 'Import finished successfully!');
    result.success = true;
    return result;
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('Import failed', err);
    result.error = errorMsg;
    return result;
  }
}
