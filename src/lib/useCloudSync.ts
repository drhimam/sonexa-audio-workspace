import { useState, useEffect, useCallback, useRef } from 'react';
import { getSetting, setSetting } from './db';
import {
  type MultiCloudSettings,
  type CloudProviderId,
  type CloudSyncStatus,
  type SyncOperationResult,
  DEFAULT_MULTI_CLOUD_SETTINGS,
  CLOUD_PROVIDER_META,
  isProviderConnected,
  executeMultiCloudSync,
  connectGoogleDrive,
  connectOneDrive as connectOneDriveFlow,
  testWebDavConnection,
  type WebDavConfig,
} from './cloudSync';

const SETTING_KEY = 'sonexa_multi_cloud_settings';

export function useCloudSync() {
  const [settings, setSettings] = useState<MultiCloudSettings>(DEFAULT_MULTI_CLOUD_SETTINGS);
  const [status, setStatus] = useState<CloudSyncStatus>('idle');
  const [syncError, setSyncError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  // Concurrency guard to prevent multiple simultaneous sync operations
  const isSyncingRef = useRef(false);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  // Load persisted settings on mount
  useEffect(() => {
    let alive = true;
    getSetting<MultiCloudSettings>(SETTING_KEY, DEFAULT_MULTI_CLOUD_SETTINGS).then((saved) => {
      if (!alive) return;
      if (saved) {
        setSettings({
          ...DEFAULT_MULTI_CLOUD_SETTINGS,
          ...saved,
          googleDrive: { ...DEFAULT_MULTI_CLOUD_SETTINGS.googleDrive, ...saved.googleDrive },
          oneDrive: { ...DEFAULT_MULTI_CLOUD_SETTINGS.oneDrive, ...saved.oneDrive },
          webdav: { ...DEFAULT_MULTI_CLOUD_SETTINGS.webdav, ...saved.webdav },
          cloudflare: { ...DEFAULT_MULTI_CLOUD_SETTINGS.cloudflare, ...saved.cloudflare },
        });
      }
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Persist settings updates to IndexedDB
  const updateSettings = useCallback(async (patch: Partial<MultiCloudSettings>) => {
    setSettings((prev) => {
      const next: MultiCloudSettings = {
        ...prev,
        ...patch,
      };
      setSetting(SETTING_KEY, next);
      return next;
    });
  }, []);

  const setActiveProvider = useCallback(async (provider: CloudProviderId) => {
    await updateSettings({ activeProvider: provider });
  }, [updateSettings]);

  // Connect Google Drive
  const connectGoogle = useCallback(async (customClientId?: string) => {
    const clientId = (customClientId || settingsRef.current.googleDrive.clientId || import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim();
    if (!clientId) {
      throw new Error('Please enter a Google Cloud OAuth Client ID to connect Google Drive.');
    }

    const { accessToken, tokenExpiry, userEmail, userName } = await connectGoogleDrive(clientId);
    await updateSettings({
      activeProvider: 'google-drive',
      googleDrive: {
        ...settingsRef.current.googleDrive,
        connected: true,
        accessToken,
        tokenExpiry,
        userEmail,
        userName,
        clientId,
      },
    });
  }, [updateSettings]);

  const disconnectGoogle = useCallback(async () => {
    await updateSettings({
      activeProvider: settingsRef.current.activeProvider === 'google-drive' ? 'none' : settingsRef.current.activeProvider,
      googleDrive: {
        ...settingsRef.current.googleDrive,
        connected: false,
        accessToken: undefined,
        tokenExpiry: undefined,
        userEmail: undefined,
        userName: undefined,
      },
    });
  }, [updateSettings]);

  // Connect Microsoft OneDrive
  const connectOneDrive = useCallback(async (customClientId?: string) => {
    const clientId = (customClientId || settingsRef.current.oneDrive.clientId || import.meta.env.VITE_ONEDRIVE_CLIENT_ID || '').trim();
    if (!clientId) {
      throw new Error('Please enter an Azure Client ID to connect OneDrive.');
    }

    const { accessToken, tokenExpiry, userEmail, userName } = await connectOneDriveFlow(clientId);
    await updateSettings({
      activeProvider: 'onedrive',
      oneDrive: {
        ...settingsRef.current.oneDrive,
        connected: true,
        accessToken,
        tokenExpiry,
        userEmail,
        userName,
        clientId,
      },
    });
  }, [updateSettings]);

  const disconnectOneDrive = useCallback(async () => {
    await updateSettings({
      activeProvider: settingsRef.current.activeProvider === 'onedrive' ? 'none' : settingsRef.current.activeProvider,
      oneDrive: {
        ...settingsRef.current.oneDrive,
        connected: false,
        accessToken: undefined,
        tokenExpiry: undefined,
        userEmail: undefined,
        userName: undefined,
      },
    });
  }, [updateSettings]);

  // Connect WebDAV / Nextcloud
  const saveWebDav = useCallback(async (webdavConfig: WebDavConfig) => {
    // Test connection first
    await testWebDavConnection(webdavConfig);

    await updateSettings({
      activeProvider: 'webdav',
      webdav: {
        ...webdavConfig,
        connected: true,
      },
    });
  }, [updateSettings]);

  const disconnectWebDav = useCallback(async () => {
    await updateSettings({
      activeProvider: settingsRef.current.activeProvider === 'webdav' ? 'none' : settingsRef.current.activeProvider,
      webdav: {
        ...settingsRef.current.webdav,
        connected: false,
        password: '',
      },
    });
  }, [updateSettings]);

  // Sync Cloudflare state from existing auth without overriding active provider
  const setCloudflareAuth = useCallback(async (token: string | null, userEmail?: string) => {
    await updateSettings({
      cloudflare: {
        connected: Boolean(token),
        token: token || undefined,
        userEmail,
      },
    });
  }, [updateSettings]);

  // Execute sync on active provider
  const syncNow = useCallback(async (): Promise<SyncOperationResult> => {
    const current = settingsRef.current;
    if (current.activeProvider === 'none') {
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

    if (isSyncingRef.current) {
      return {
        success: false,
        provider: current.activeProvider,
        pulledSessions: 0,
        pulledFolders: 0,
        pushedSessions: 0,
        pushedFolders: 0,
        timestamp: Date.now(),
        error: 'Sync already in progress.',
      };
    }

    isSyncingRef.current = true;
    setStatus('syncing');
    setSyncError(null);

    try {
      const res = await executeMultiCloudSync(current);
      if (res.success) {
        setStatus('synced');
        await updateSettings({ lastSyncTime: res.timestamp });
      } else {
        setStatus('error');
        setSyncError(res.error || 'Sync failed.');
      }
      return res;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatus('error');
      setSyncError(msg);
      return {
        success: false,
        provider: current.activeProvider,
        pulledSessions: 0,
        pulledFolders: 0,
        pushedSessions: 0,
        pushedFolders: 0,
        timestamp: Date.now(),
        error: msg,
      };
    } finally {
      isSyncingRef.current = false;
    }
  }, [updateSettings]);

  const activeMeta = CLOUD_PROVIDER_META[settings.activeProvider];
  const isConnected = isProviderConnected(settings.activeProvider, settings);

  return {
    settings,
    status,
    syncError,
    ready,
    activeMeta,
    isConnected,
    updateSettings,
    setActiveProvider,
    connectGoogle,
    disconnectGoogle,
    connectOneDrive,
    disconnectOneDrive,
    saveWebDav,
    disconnectWebDav,
    setCloudflareAuth,
    syncNow,
  };
}
