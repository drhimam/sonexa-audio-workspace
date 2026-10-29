import { listSessions, saveSession, getSession, listFolders, saveFolder, getFolder } from '../db';
import type { Session, Folder } from '../types';
import type { OneDriveConfig, SyncOperationResult } from './types';

/**
 * Connect to Microsoft OneDrive via OAuth2 popup
 */
export async function connectOneDrive(
  clientId: string
): Promise<{ accessToken: string; tokenExpiry: number; userEmail?: string; userName?: string }> {
  if (!clientId || clientId.trim().length === 0) {
    throw new Error('Microsoft Azure Client ID is required. Please provide a Client ID in Settings.');
  }

  const redirectUri = window.location.origin;
  const scope = encodeURIComponent('openid profile email Files.ReadWrite.AppFolder');
  const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${encodeURIComponent(
    clientId.trim()
  )}&response_type=token&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&prompt=select_account`;

  const width = 500;
  const height = 600;
  const left = window.screenX + (window.outerWidth - width) / 2;
  const top = window.screenY + (window.outerHeight - height) / 2;

  const popup = window.open(
    authUrl,
    'microsoft_oauth',
    `width=${width},height=${height},left=${left},top=${top},status=no,toolbar=no,menubar=no`
  );

  if (!popup) {
    throw new Error('Popup blocked by browser. Please allow popups for this site.');
  }

  return new Promise((resolve, reject) => {
    const timer = setInterval(async () => {
      try {
        if (!popup || popup.closed) {
          clearInterval(timer);
          reject(new Error('Microsoft login window was closed.'));
          return;
        }

        // Try reading popup URL (allowed when redirect happens to same origin)
        const currentUrl = popup.location.href;
        if (currentUrl.includes('#') || currentUrl.includes('access_token')) {
          clearInterval(timer);
          popup.close();

          const hash = new URL(currentUrl).hash.substring(1);
          const params = new URLSearchParams(hash);
          const accessToken = params.get('access_token');
          const expiresIn = parseInt(params.get('expires_in') || '3599', 10);

          if (!accessToken) {
            reject(new Error('Failed to retrieve access token from Microsoft.'));
            return;
          }

          const tokenExpiry = Date.now() + expiresIn * 1000;

          // Fetch user profile from Microsoft Graph
          let userEmail: string | undefined;
          let userName: string | undefined;
          try {
            const meRes = await fetch('https://graph.microsoft.com/v1.0/me', {
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (meRes.ok) {
              const me = await meRes.json();
              userEmail = me.mail || me.userPrincipalName;
              userName = me.displayName;
            }
          } catch {
            // Profile lookup error non-fatal
          }

          resolve({ accessToken, tokenExpiry, userEmail, userName });
        }
      } catch {
        // Cross-origin restriction before redirect completes - continue waiting
      }
    }, 500);
  });
}

/**
 * Execute bidirectional sync with Microsoft OneDrive via Graph API
 */
export async function syncWithOneDrive(
  config: OneDriveConfig,
  lastSyncTime: number | null
): Promise<SyncOperationResult> {
  const result: SyncOperationResult = {
    success: false,
    provider: 'onedrive',
    pulledSessions: 0,
    pulledFolders: 0,
    pushedSessions: 0,
    pushedFolders: 0,
    timestamp: Date.now(),
  };

  if (!config.accessToken) {
    result.error = 'OneDrive is not connected. Please connect your account in Settings.';
    return result;
  }

  if (config.tokenExpiry && Date.now() > config.tokenExpiry) {
    result.error = 'OneDrive session has expired. Please re-authenticate in Settings.';
    return result;
  }

  const token = config.accessToken;
  const fileUrl = 'https://graph.microsoft.com/v1.0/me/drive/special/approot:/sonexa-workspace.json:/content';

  try {
    const pulledSessionIds = new Set<string>();
    const pulledFolderIds = new Set<string>();

    // 1. PULL: Check if file exists in approot
    const getRes = await fetch(fileUrl, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
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
    }

    // 2. PUSH: Prepare local data and write to OneDrive approot
    const allLocalSessions = await listSessions();
    const allLocalFolders = await listFolders();

    const payload = JSON.stringify({
      version: 1,
      app: 'Sonexa AI Meeting Copilot',
      exportedAt: Date.now(),
      sessions: allLocalSessions,
      folders: allLocalFolders,
    });

    const putRes = await fetch(fileUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: payload,
    });

    if (!putRes.ok && putRes.status !== 201 && putRes.status !== 200) {
      throw new Error(`Failed to upload to OneDrive (HTTP ${putRes.status}: ${putRes.statusText})`);
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
