import { listSessions, saveSession, getSession, listFolders, saveFolder, getFolder } from '../db';
import type { Session, Folder } from '../types';
import type { GoogleDriveConfig, SyncOperationResult } from './types';

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: { access_token?: string; error?: string; expires_in?: number }) => void;
          }) => {
            requestAccessToken: (options?: { prompt?: string }) => void;
          };
        };
      };
    };
  }
}

// Load Google Identity Services script if not already loaded
export function loadGoogleGisScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) {
      resolve();
      return;
    }
    const existing = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Failed to load Google GIS script')));
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google GIS script from accounts.google.com'));
    document.head.appendChild(script);
  });
}

/**
 * Trigger Google OAuth popup flow
 */
export async function connectGoogleDrive(
  clientId: string
): Promise<{ accessToken: string; tokenExpiry: number; userEmail?: string; userName?: string }> {
  if (!clientId || clientId.trim().length === 0) {
    throw new Error('Google Client ID is required. Please provide a Client ID in Cloud Sync Settings.');
  }

  await loadGoogleGisScript();

  return new Promise((resolve, reject) => {
    try {
      const client = window.google!.accounts.oauth2.initTokenClient({
        client_id: clientId.trim(),
        scope: 'https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile',
        callback: async (res) => {
          if (res.error || !res.access_token) {
            reject(new Error(res.error || 'Google login cancelled or token not received.'));
            return;
          }

          const accessToken = res.access_token;
          const tokenExpiry = Date.now() + (res.expires_in || 3599) * 1000;

          // Fetch profile
          let userEmail: string | undefined;
          let userName: string | undefined;
          try {
            const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (profileRes.ok) {
              const profile = await profileRes.json();
              userEmail = profile.email;
              userName = profile.name;
            }
          } catch {
            // Non-fatal if profile lookup fails
          }

          resolve({ accessToken, tokenExpiry, userEmail, userName });
        },
      });

      client.requestAccessToken({ prompt: 'consent' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      reject(new Error(`Failed to initialize Google login: ${msg}`));
    }
  });
}

/**
 * Locate sonexa-workspace.json in Google Drive AppData folder
 */
async function findAppDataFileId(accessToken: string): Promise<string | null> {
  const url = `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name='sonexa-workspace.json' and trashed=false&fields=files(id,name,modifiedTime)`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error(`Google Drive API error: ${res.statusText}`);
  }

  const data = await res.json();
  const file = data.files?.[0];
  return file ? file.id : null;
}

/**
 * Execute full bidirectional sync with Google Drive
 */
export async function syncWithGoogleDrive(
  config: GoogleDriveConfig,
  lastSyncTime: number | null
): Promise<SyncOperationResult> {
  const result: SyncOperationResult = {
    success: false,
    provider: 'google-drive',
    pulledSessions: 0,
    pulledFolders: 0,
    pushedSessions: 0,
    pushedFolders: 0,
    timestamp: Date.now(),
  };

  if (!config.accessToken) {
    result.error = 'Google Drive is not connected. Please connect your account in Settings.';
    return result;
  }

  // Check if token has expired
  if (config.tokenExpiry && Date.now() > config.tokenExpiry) {
    result.error = 'Google Drive session has expired. Please re-authenticate in Settings.';
    return result;
  }

  const token = config.accessToken;

  try {
    let fileId = config.fileId || (await findAppDataFileId(token));
    const pulledSessionIds = new Set<string>();
    const pulledFolderIds = new Set<string>();

    // 1. PULL: If remote file exists, download and merge
    if (fileId) {
      const downloadRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (downloadRes.ok) {
        const remoteData = await downloadRes.json();
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
      }
    }

    // 2. PUSH: Prepare local data and write to Drive
    const allLocalSessions = await listSessions();
    const allLocalFolders = await listFolders();

    const payload = JSON.stringify({
      version: 1,
      app: 'Sonexa AI Meeting Copilot',
      exportedAt: Date.now(),
      sessions: allLocalSessions,
      folders: allLocalFolders,
    });

    if (fileId) {
      // Update existing file
      const updateRes = await fetch(
        `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json; charset=UTF-8',
          },
          body: payload,
        }
      );

      if (!updateRes.ok) {
        throw new Error(`Failed to update file in Google Drive: ${updateRes.statusText}`);
      }
    } else {
      // Create new file inside appDataFolder using multipart upload
      const metadata = JSON.stringify({
        name: 'sonexa-workspace.json',
        parents: ['appDataFolder'],
        mimeType: 'application/json',
      });

      const boundary = '-------314159265358979323846';
      const delimiter = `\r\n--${boundary}\r\n`;
      const closeDelim = `\r\n--${boundary}--`;

      const multipartBody =
        delimiter +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        metadata +
        delimiter +
        'Content-Type: application/json\r\n\r\n' +
        payload +
        closeDelim;

      const createRes = await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': `multipart/related; boundary=${boundary}`,
          },
          body: multipartBody,
        }
      );

      if (!createRes.ok) {
        throw new Error(`Failed to create workspace file in Google Drive: ${createRes.statusText}`);
      }

      const created = await createRes.json();
      fileId = created.id;
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
