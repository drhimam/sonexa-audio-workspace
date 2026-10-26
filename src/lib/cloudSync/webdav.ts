import { listSessions, saveSession, getSession, listFolders, saveFolder, getFolder } from '../db';
import type { Session, Folder } from '../types';
import type { WebDavConfig, SyncOperationResult } from './types';

function cleanUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

function cleanPath(path: string): string {
  const trimmed = path.trim().replace(/^\/+/, '').replace(/\/+$/, '');
  return trimmed ? `/${trimmed}` : '';
}

function getAuthHeader(config: WebDavConfig): string {
  return 'Basic ' + btoa(`${config.username.trim()}:${config.password.trim()}`);
}

/**
 * Verify WebDAV credentials and ensure remote folder exists
 */
export async function testWebDavConnection(
  config: WebDavConfig
): Promise<{ success: boolean; message: string }> {
  if (!config.serverUrl || !config.username || !config.password) {
    throw new Error('Please fill in Server URL, Username, and Password.');
  }

  const base = cleanUrl(config.serverUrl);
  const folder = cleanPath(config.folderPath || '/Sonexa');
  const targetDirUrl = `${base}${folder}`;
  const auth = getAuthHeader(config);

  try {
    // 1. Try PROPFIND on the folder
    const propRes = await fetch(targetDirUrl, {
      method: 'PROPFIND',
      headers: {
        Authorization: auth,
        Depth: '0',
      },
    });

    if (propRes.status === 404) {
      // Folder does not exist, try creating it with MKCOL
      const mkcolRes = await fetch(targetDirUrl, {
        method: 'MKCOL',
        headers: { Authorization: auth },
      });

      if (mkcolRes.ok || mkcolRes.status === 201 || mkcolRes.status === 405) {
        return { success: true, message: `Connected! Created remote directory ${folder}` };
      }
      throw new Error(`Failed to create remote directory ${folder} (HTTP ${mkcolRes.status})`);
    }

    if (propRes.status === 401 || propRes.status === 403) {
      throw new Error('Authentication failed. Please verify your WebDAV username and app password.');
    }

    if (propRes.ok || propRes.status === 207) {
      return { success: true, message: 'Connection successful!' };
    }

    // Fallback: try OPTIONS request
    const optRes = await fetch(base, {
      method: 'OPTIONS',
      headers: { Authorization: auth },
    });

    if (optRes.ok) {
      return { success: true, message: 'WebDAV server connected successfully.' };
    }

    throw new Error(`Server returned HTTP ${propRes.status}: ${propRes.statusText}`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('CORS')) {
      throw new Error(
        'Network error or CORS issue. If using Nextcloud/ownCloud, ensure your server allows WebDAV requests or CORS.'
      );
    }
    throw new Error(msg);
  }
}

/**
 * Perform bidirectional sync with WebDAV / Nextcloud / ownCloud
 */
export async function syncWithWebDav(
  config: WebDavConfig,
  lastSyncTime: number | null
): Promise<SyncOperationResult> {
  const result: SyncOperationResult = {
    success: false,
    provider: 'webdav',
    pulledSessions: 0,
    pulledFolders: 0,
    pushedSessions: 0,
    pushedFolders: 0,
    timestamp: Date.now(),
  };

  if (!config.serverUrl || !config.username || !config.password) {
    result.error = 'WebDAV configuration is incomplete.';
    return result;
  }

  const base = cleanUrl(config.serverUrl);
  const folder = cleanPath(config.folderPath || '/Sonexa');
  const targetDirUrl = `${base}${folder}`;
  const fileUrl = `${targetDirUrl}/sonexa-workspace.json`;
  const auth = getAuthHeader(config);

  try {
    const pulledSessionIds = new Set<string>();
    const pulledFolderIds = new Set<string>();

    // 1. PULL: Check if sonexa-workspace.json exists remotely
    const getRes = await fetch(fileUrl, {
      method: 'GET',
      headers: { Authorization: auth },
    });

    if (getRes.ok) {
      const remoteData = await getRes.json();
      const remoteSessions: Session[] = remoteData.sessions || [];
      const remoteFolders: Folder[] = remoteData.folders || [];

      // Merge folders
      for (const rf of remoteFolders) {
        pulledFolderIds.add(rf.id);
        const local = await getFolder(rf.id);
        if (!local || rf.updatedAt > local.updatedAt) {
          await saveFolder(rf);
          result.pulledFolders++;
        }
      }

      // Merge sessions
      for (const rs of remoteSessions) {
        pulledSessionIds.add(rs.id);
        const local = await getSession(rs.id);
        if (!local || rs.updatedAt > local.updatedAt) {
          await saveSession(rs);
          result.pulledSessions++;
        }
      }
    } else if (getRes.status === 404) {
      // Remote file doesn't exist yet, ensure folder exists
      await fetch(targetDirUrl, {
        method: 'MKCOL',
        headers: { Authorization: auth },
      }).catch(() => {});
    }

    // 2. PUSH: Prepare local data and upload
    const allLocalSessions = await listSessions();
    const allLocalFolders = await listFolders();

    const payload = JSON.stringify({
      version: 1,
      app: 'Sonexa Audio Workspace',
      exportedAt: Date.now(),
      sessions: allLocalSessions,
      folders: allLocalFolders,
    }, null, 2);

    const putRes = await fetch(fileUrl, {
      method: 'PUT',
      headers: {
        Authorization: auth,
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: payload,
    });

    if (!putRes.ok && putRes.status !== 201 && putRes.status !== 204) {
      throw new Error(`Failed to upload to WebDAV (HTTP ${putRes.status}: ${putRes.statusText})`);
    }

    result.pushedSessions = allLocalSessions.length;
    result.pushedFolders = allLocalFolders.length;
    result.success = true;
    result.timestamp = Date.now();
    return result;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    result.error = msg;
    return result;
  }
}
