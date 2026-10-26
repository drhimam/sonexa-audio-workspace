import Dexie, { type Table } from 'dexie';
import type { Folder, Session } from './types';

// Local-first IndexedDB store. Audio blobs kept in a separate blob table to
// avoid loading big binaries into memory when listing sessions.
class SonexaDB extends Dexie {
  sessions!: Table<Session, string>;
  folders!: Table<Folder, string>;
  audio!: Table<{ id: string; blob: Blob; createdAt: number }, string>;
  settings!: Table<{ id: string; value: unknown }, string>;

  constructor() {
    super('sonexa-audio-workspace');
    this.version(1).stores({
      sessions: 'id, createdAt, updatedAt, status',
      audio: 'id, createdAt',
      settings: 'id',
    });
    this.version(2).stores({
      sessions: 'id, createdAt, updatedAt, status, folderId',
      folders: 'id, createdAt, updatedAt',
      audio: 'id, createdAt',
      settings: 'id',
    });
  }
}

export const db = new SonexaDB();

// ---- Audio blob helpers -------------------------------------------------

export async function saveAudioBlob(id: string, blob: Blob): Promise<void> {
  await db.audio.put({ id, blob, createdAt: Date.now() });
}

export async function getAudioBlob(id: string): Promise<Blob | undefined> {
  const row = await db.audio.get(id);
  return row?.blob;
}

export async function deleteAudioBlob(id: string): Promise<void> {
  await db.audio.delete(id);
}

// ---- Settings helpers ---------------------------------------------------

export async function getSetting<T>(id: string, fallback: T): Promise<T> {
  const row = await db.settings.get(id);
  return (row?.value as T) ?? fallback;
}

export async function setSetting<T>(id: string, value: T): Promise<void> {
  await db.settings.put({ id, value });
}

// ---- Folder helpers -----------------------------------------------------

export async function listFolders(): Promise<Folder[]> {
  const all = await db.folders.toArray();
  return all.sort((a, b) => a.createdAt - b.createdAt);
}

export async function getFolder(id: string): Promise<Folder | undefined> {
  return db.folders.get(id);
}

export async function saveFolder(folder: Folder): Promise<void> {
  await db.folders.put(folder);
}

export async function renameFolder(id: string, name: string): Promise<void> {
  await db.folders.update(id, { name, updatedAt: Date.now() });
}

export async function deleteFolder(id: string): Promise<void> {
  await db.folders.delete(id);
  // Unassign sessions belonging to this folder so they're not orphaned.
  const sessions = await db.sessions.where('folderId').equals(id).toArray();
  await Promise.all(sessions.map((s) => db.sessions.update(s.id, { folderId: null, updatedAt: Date.now() })));
}

// ---- Session helpers ----------------------------------------------------

export async function listSessions(): Promise<Session[]> {
  const all = await db.sessions.toArray();
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getSession(id: string): Promise<Session | undefined> {
  return db.sessions.get(id);
}

export async function saveSession(session: Session): Promise<void> {
  await db.sessions.put(session);
}

export async function deleteSession(id: string): Promise<void> {
  await db.sessions.delete(id);
  await deleteAudioBlob(id);
}

// Sessions store chat & documents inline (sub-arrays). Patch a session by
// reading, merging, and writing back.
export async function updateSession(
  id: string,
  patch: Partial<Session>,
): Promise<Session | undefined> {
  const existing = await db.sessions.get(id);
  if (!existing) return undefined;
  const next: Session = { ...existing, ...patch, updatedAt: Date.now() };
  await db.sessions.put(next);
  return next;
}
