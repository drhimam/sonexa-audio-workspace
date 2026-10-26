import { syncWithGoogleDrive } from './googleDrive';
import { syncWithWebDav } from './webdav';
import { syncWithOneDrive } from './oneDrive';
import { runBidirectionalSync } from '../sync';
import type { MultiCloudSettings, SyncOperationResult, CloudProviderId } from './types';

export * from './types';
export * from './googleDrive';
export * from './webdav';
export * from './oneDrive';

/**
 * Checks if a specific cloud provider is properly connected and ready
 */
export function isProviderConnected(
  provider: CloudProviderId,
  settings: MultiCloudSettings
): boolean {
  switch (provider) {
    case 'google-drive':
      return Boolean(settings.googleDrive.connected && settings.googleDrive.accessToken);
    case 'onedrive':
      return Boolean(settings.oneDrive.connected && settings.oneDrive.accessToken);
    case 'webdav':
      return Boolean(
        settings.webdav.connected &&
          settings.webdav.serverUrl &&
          settings.webdav.username &&
          settings.webdav.password
      );
    case 'cloudflare':
      return Boolean(settings.cloudflare.connected && settings.cloudflare.token);
    case 'none':
      return true;
    default:
      return false;
  }
}

/**
 * Unified sync entry point: dispatches to active cloud provider
 */
export async function executeMultiCloudSync(
  settings: MultiCloudSettings,
  options: { syncAudio?: boolean } = {}
): Promise<SyncOperationResult> {
  const provider = settings.activeProvider;

  switch (provider) {
    case 'google-drive':
      return await syncWithGoogleDrive(settings.googleDrive, settings.lastSyncTime);

    case 'onedrive':
      return await syncWithOneDrive(settings.oneDrive, settings.lastSyncTime);

    case 'webdav':
      return await syncWithWebDav(settings.webdav, settings.lastSyncTime);

    case 'cloudflare': {
      const token = settings.cloudflare.token || '';
      const cfRes = await runBidirectionalSync(token, settings.lastSyncTime, {
        syncAudio: options.syncAudio ?? settings.syncAudio,
      });
      return {
        success: cfRes.success,
        provider: 'cloudflare',
        pulledSessions: cfRes.pulledSessions,
        pulledFolders: cfRes.pulledFolders,
        pushedSessions: cfRes.pushedSessions,
        pushedFolders: cfRes.pushedFolders,
        timestamp: cfRes.timestamp,
        error: cfRes.error,
      };
    }

    case 'none':
    default:
      return {
        success: true,
        provider: 'none',
        pulledSessions: 0,
        pulledFolders: 0,
        pushedSessions: 0,
        pushedFolders: 0,
        timestamp: Date.now(),
      };
  }
}
