import { useState } from 'react';
import {
  Cloud, Check, RefreshCw, HardDrive, Server, ShieldCheck,
  AlertCircle, ChevronRight, LogOut, KeyRound, Globe, ExternalLink,
  FolderSync, Database, ArrowRight,
} from 'lucide-react';
import { Modal } from './Modal';
import {
  type CloudProviderId,
  CLOUD_PROVIDER_META,
  type MultiCloudSettings,
  type WebDavConfig,
} from '@/lib/cloudSync';
import { formatRelativeTime } from '@/lib/utils';

interface CloudSyncModalProps {
  open: boolean;
  onClose: () => void;
  cloudSync: {
    settings: MultiCloudSettings;
    status: string;
    syncError: string | null;
    activeMeta: typeof CLOUD_PROVIDER_META[CloudProviderId];
    isConnected: boolean;
    updateSettings: (patch: Partial<MultiCloudSettings>) => Promise<void>;
    setActiveProvider: (provider: CloudProviderId) => Promise<void>;
    connectGoogle: (clientId?: string) => Promise<void>;
    disconnectGoogle: () => Promise<void>;
    connectOneDrive: (clientId?: string) => Promise<void>;
    disconnectOneDrive: () => Promise<void>;
    saveWebDav: (config: WebDavConfig) => Promise<void>;
    disconnectWebDav: () => Promise<void>;
    syncNow: () => Promise<any>;
  };
}

export function CloudSyncModal({ open, onClose, cloudSync }: CloudSyncModalProps) {
  const { settings, status, syncError, updateSettings, setActiveProvider, syncNow } = cloudSync;

  const [activeTab, setActiveTab] = useState<'google-drive' | 'onedrive' | 'webdav'>(
    settings.activeProvider === 'onedrive' || settings.activeProvider === 'webdav'
      ? settings.activeProvider
      : 'google-drive'
  );
  const [googleClientId, setGoogleClientId] = useState(settings.googleDrive.clientId || '');
  const [showGoogleAdvanced, setShowGoogleAdvanced] = useState(
    !(settings.googleDrive.clientId || import.meta.env.VITE_GOOGLE_CLIENT_ID)
  );
  const [oneDriveClientId, setOneDriveClientId] = useState(settings.oneDrive.clientId || '');
  const [showOneDriveAdvanced, setShowOneDriveAdvanced] = useState(
    !(settings.oneDrive.clientId || import.meta.env.VITE_ONEDRIVE_CLIENT_ID)
  );

  // WebDAV form state
  const [webdavUrl, setWebdavUrl] = useState(settings.webdav.serverUrl || '');
  const [webdavUser, setWebdavUser] = useState(settings.webdav.username || '');
  const [webdavPass, setWebdavPass] = useState(settings.webdav.password || '');
  const [webdavFolder, setWebdavFolder] = useState(settings.webdav.folderPath || '/Sonexa');

  const [busy, setBusy] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSelectActive = async (provider: 'google-drive' | 'onedrive' | 'webdav') => {
    setActiveTab(provider);
    await setActiveProvider(provider);
    setActionMessage({ type: 'success', text: `Switched active cloud sync to ${CLOUD_PROVIDER_META[provider].name}` });
  };

  const handleConnectGoogle = async () => {
    setBusy(true);
    setActionMessage(null);
    try {
      await cloudSync.connectGoogle(googleClientId);
      setActionMessage({ type: 'success', text: 'Google Drive connected successfully!' });
      await syncNow();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setActionMessage({ type: 'error', text: msg });
    } finally {
      setBusy(false);
    }
  };

  const handleDisconnectGoogle = async () => {
    setBusy(true);
    try {
      await cloudSync.disconnectGoogle();
      setActionMessage({ type: 'success', text: 'Google Drive disconnected.' });
    } finally {
      setBusy(false);
    }
  };

  const handleConnectOneDrive = async () => {
    setBusy(true);
    setActionMessage(null);
    try {
      await cloudSync.connectOneDrive(oneDriveClientId);
      setActionMessage({ type: 'success', text: 'Microsoft OneDrive connected successfully!' });
      await syncNow();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setActionMessage({ type: 'error', text: msg });
    } finally {
      setBusy(false);
    }
  };

  const handleDisconnectOneDrive = async () => {
    setBusy(true);
    try {
      await cloudSync.disconnectOneDrive();
      setActionMessage({ type: 'success', text: 'OneDrive disconnected.' });
    } finally {
      setBusy(false);
    }
  };

  const handleSaveWebDav = async () => {
    setBusy(true);
    setActionMessage(null);
    try {
      await cloudSync.saveWebDav({
        connected: false,
        serverUrl: webdavUrl,
        username: webdavUser,
        password: webdavPass,
        folderPath: webdavFolder,
      });
      setActionMessage({ type: 'success', text: 'WebDAV server connected and verified!' });
      await syncNow();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setActionMessage({ type: 'error', text: msg });
    } finally {
      setBusy(false);
    }
  };

  const handleDisconnectWebDav = async () => {
    setBusy(true);
    try {
      await cloudSync.disconnectWebDav();
      setWebdavPass('');
      setActionMessage({ type: 'success', text: 'WebDAV disconnected.' });
    } finally {
      setBusy(false);
    }
  };

  const handleManualSync = async () => {
    setBusy(true);
    setActionMessage(null);
    try {
      const res = await syncNow();
      if (res.success) {
        setActionMessage({
          type: 'success',
          text: `Sync complete! Pulled ${res.pulledSessions} sessions, pushed ${res.pushedSessions} sessions.`,
        });
      } else {
        setActionMessage({ type: 'error', text: res.error || 'Sync failed.' });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Cloud Sync & Multi-Provider Storage" maxWidth="max-w-2xl">
      <div className="space-y-5">
        {/* Banner / Info */}
        <div className="p-3.5 rounded-xl bg-primary/5 border border-primary/20 flex items-start gap-3">
          <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0 mt-0.5">
            <ShieldCheck size={18} />
          </div>
          <div className="text-xs text-secondary leading-relaxed">
            <span className="font-semibold text-app block text-sm mb-0.5">Bring Your Own Cloud (Zero Host Limits)</span>
            Sync your recordings, transcripts, documents, and chat directly to your own personal Google Drive,
            OneDrive, or Nextcloud/WebDAV. Your files remain 100% private and owned by you with zero database quotas.
          </div>
        </div>

        {/* Action message */}
        {actionMessage && (
          <div
            className={`p-3 rounded-lg text-xs flex items-center gap-2 border ${
              actionMessage.type === 'success'
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
            }`}
          >
            {actionMessage.type === 'success' ? <Check size={14} /> : <AlertCircle size={14} />}
            <span>{actionMessage.text}</span>
          </div>
        )}

        {/* Provider Tabs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {/* Google Drive */}
          <button
            type="button"
            onClick={() => setActiveTab('google-drive')}
            className={`p-2.5 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
              activeTab === 'google-drive'
                ? 'border-primary bg-primary/5 shadow-sm'
                : 'border-app hover:border-primary/40 bg-surface'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-base">📁</span>
              {settings.activeProvider === 'google-drive' && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                  Active
                </span>
              )}
            </div>
            <div>
              <div className="text-xs font-semibold text-app">Google Drive</div>
              <div className="text-[11px] text-muted">
                {settings.googleDrive.connected ? 'Connected' : '15GB Free'}
              </div>
            </div>
          </button>

          {/* Microsoft OneDrive */}
          <button
            type="button"
            onClick={() => setActiveTab('onedrive')}
            className={`p-2.5 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
              activeTab === 'onedrive'
                ? 'border-primary bg-primary/5 shadow-sm'
                : 'border-app hover:border-primary/40 bg-surface'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-base">☁️</span>
              {settings.activeProvider === 'onedrive' && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                  Active
                </span>
              )}
            </div>
            <div>
              <div className="text-xs font-semibold text-app">OneDrive</div>
              <div className="text-[11px] text-muted">
                {settings.oneDrive.connected ? 'Connected' : 'AppFolder'}
              </div>
            </div>
          </button>

          {/* WebDAV / Nextcloud */}
          <button
            type="button"
            onClick={() => setActiveTab('webdav')}
            className={`p-2.5 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
              activeTab === 'webdav'
                ? 'border-primary bg-primary/5 shadow-sm'
                : 'border-app hover:border-primary/40 bg-surface'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-base">🌐</span>
              {settings.activeProvider === 'webdav' && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                  Active
                </span>
              )}
            </div>
            <div>
              <div className="text-xs font-semibold text-app">WebDAV</div>
              <div className="text-[11px] text-muted">
                {settings.webdav.connected ? 'Connected' : 'Nextcloud'}
              </div>
            </div>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-4 rounded-xl border border-app bg-surface space-y-4">
          {/* 1. GOOGLE DRIVE */}
          {activeTab === 'google-drive' && (
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-app flex items-center gap-1.5">
                    <span>Google Drive Integration</span>
                    <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                      Recommended
                    </span>
                  </h4>
                  <p className="text-xs text-muted mt-0.5">
                    Stores all data in an isolated AppData folder inside your Google Drive. Invisible to other apps.
                  </p>
                </div>
                {settings.activeProvider !== 'google-drive' && (
                  <button
                    onClick={() => handleSelectActive('google-drive')}
                    className="btn-secondary !py-1 !px-2.5 text-xs flex items-center gap-1"
                  >
                    <span>Set as Active</span>
                    <ArrowRight size={12} />
                  </button>
                )}
              </div>

              {settings.googleDrive.connected ? (
                <div className="p-3 rounded-lg bg-surface-hover border border-app flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                      {settings.googleDrive.userEmail ? settings.googleDrive.userEmail[0].toUpperCase() : 'G'}
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-app">
                        {settings.googleDrive.userName || 'Google Account Connected'}
                      </div>
                      <div className="text-[11px] text-muted">{settings.googleDrive.userEmail}</div>
                    </div>
                  </div>
                  <button
                    onClick={handleDisconnectGoogle}
                    disabled={busy}
                    className="btn-ghost !py-1 !px-2.5 text-xs text-rose-500 hover:bg-rose-500/10 flex items-center gap-1"
                  >
                    <LogOut size={13} />
                    <span>Disconnect</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="p-3 rounded-lg border border-app bg-background text-xs space-y-2">
                    <div className="font-medium text-app flex items-center justify-between">
                      <span>OAuth 2.0 Client ID</span>
                      <button
                        type="button"
                        onClick={() => setShowGoogleAdvanced(!showGoogleAdvanced)}
                        className="text-[11px] text-primary hover:underline"
                      >
                        {showGoogleAdvanced ? 'Hide Client ID' : 'Configure Client ID'}
                      </button>
                    </div>

                    {showGoogleAdvanced && (
                      <div className="space-y-1 pt-1">
                        <input
                          type="text"
                          value={googleClientId}
                          onChange={(e) => setGoogleClientId(e.target.value)}
                          placeholder="your-client-id.apps.googleusercontent.com"
                          className="input-text text-xs w-full font-mono"
                        />
                        <p className="text-[10px] text-muted">
                          Create an OAuth 2.0 Client ID (Web Application) in Google Cloud Console with your domain
                          added under Authorized JavaScript Origins.
                        </p>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={handleConnectGoogle}
                    disabled={busy}
                    className="btn-primary w-full py-2 flex items-center justify-center gap-2 shadow-sm font-medium"
                  >
                    {busy ? <RefreshCw size={14} className="animate-spin" /> : <Cloud size={14} />}
                    <span>Connect Google Drive</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 2. MICROSOFT ONEDRIVE */}
          {activeTab === 'onedrive' && (
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-app">Microsoft OneDrive Integration</h4>
                  <p className="text-xs text-muted mt-0.5">
                    Syncs to <code className="text-[11px] font-mono">OneDrive/Apps/Sonexa</code> using Microsoft Graph.
                  </p>
                </div>
                {settings.activeProvider !== 'onedrive' && (
                  <button
                    onClick={() => handleSelectActive('onedrive')}
                    className="btn-secondary !py-1 !px-2.5 text-xs flex items-center gap-1"
                  >
                    <span>Set as Active</span>
                    <ArrowRight size={12} />
                  </button>
                )}
              </div>

              {settings.oneDrive.connected ? (
                <div className="p-3 rounded-lg bg-surface-hover border border-app flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-app">
                      {settings.oneDrive.userName || 'OneDrive Account Connected'}
                    </div>
                    <div className="text-[11px] text-muted">{settings.oneDrive.userEmail}</div>
                  </div>
                  <button
                    onClick={handleDisconnectOneDrive}
                    disabled={busy}
                    className="btn-ghost !py-1 !px-2.5 text-xs text-rose-500 hover:bg-rose-500/10 flex items-center gap-1"
                  >
                    <LogOut size={13} />
                    <span>Disconnect</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="p-3 rounded-lg border border-app bg-background text-xs space-y-2">
                    <div className="font-medium text-app flex items-center justify-between">
                      <span>Azure App Registration Client ID</span>
                      <button
                        type="button"
                        onClick={() => setShowOneDriveAdvanced(!showOneDriveAdvanced)}
                        className="text-[11px] text-primary hover:underline"
                      >
                        {showOneDriveAdvanced ? 'Hide Client ID' : 'Configure Client ID'}
                      </button>
                    </div>

                    {showOneDriveAdvanced && (
                      <div className="space-y-1 pt-1">
                        <input
                          type="text"
                          value={oneDriveClientId}
                          onChange={(e) => setOneDriveClientId(e.target.value)}
                          placeholder="00000000-0000-0000-0000-000000000000"
                          className="input-text text-xs w-full font-mono"
                        />
                      </div>
                    )}
                  </div>

                  <button
                    onClick={handleConnectOneDrive}
                    disabled={busy}
                    className="btn-primary w-full py-2 flex items-center justify-center gap-2 shadow-sm font-medium"
                  >
                    {busy ? <RefreshCw size={14} className="animate-spin" /> : <Cloud size={14} />}
                    <span>Connect Microsoft OneDrive</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 3. WEBDAV / NEXTCLOUD */}
          {activeTab === 'webdav' && (
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-app flex items-center gap-1.5">
                    <span>WebDAV / Nextcloud / ownCloud</span>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400">
                      No OAuth Needed
                    </span>
                  </h4>
                  <p className="text-xs text-muted mt-0.5">
                    Connect directly to any WebDAV-compatible server or private self-hosted cloud.
                  </p>
                </div>
                {settings.activeProvider !== 'webdav' && (
                  <button
                    onClick={() => handleSelectActive('webdav')}
                    className="btn-secondary !py-1 !px-2.5 text-xs flex items-center gap-1"
                  >
                    <span>Set as Active</span>
                    <ArrowRight size={12} />
                  </button>
                )}
              </div>

              <div className="space-y-2.5 text-xs">
                <div>
                  <label className="text-[11px] font-semibold text-secondary block mb-1">
                    Server WebDAV URL
                  </label>
                  <input
                    type="url"
                    value={webdavUrl}
                    onChange={(e) => setWebdavUrl(e.target.value)}
                    placeholder="https://nextcloud.example.com/remote.php/dav/files/username"
                    className="input-text w-full text-xs font-mono"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-semibold text-secondary block mb-1">
                      Username
                    </label>
                    <input
                      type="text"
                      value={webdavUser}
                      onChange={(e) => setWebdavUser(e.target.value)}
                      placeholder="username"
                      className="input-text w-full text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-secondary block mb-1">
                      Password or App Token
                    </label>
                    <input
                      type="password"
                      value={webdavPass}
                      onChange={(e) => setWebdavPass(e.target.value)}
                      placeholder="••••••••••••"
                      className="input-text w-full text-xs font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-secondary block mb-1">
                    Sync Folder Path
                  </label>
                  <input
                    type="text"
                    value={webdavFolder}
                    onChange={(e) => setWebdavFolder(e.target.value)}
                    placeholder="/Sonexa"
                    className="input-text w-full text-xs font-mono"
                  />
                </div>

                <div className="pt-2 flex items-center justify-between">
                  {settings.webdav.connected ? (
                    <button
                      type="button"
                      onClick={handleDisconnectWebDav}
                      disabled={busy}
                      className="btn-ghost text-xs text-rose-500 hover:bg-rose-500/10 flex items-center gap-1"
                    >
                      <LogOut size={13} />
                      <span>Disconnect WebDAV</span>
                    </button>
                  ) : <div />}

                  <button
                    type="button"
                    onClick={handleSaveWebDav}
                    disabled={busy || !webdavUrl || !webdavUser || !webdavPass}
                    className="btn-primary !py-1.5 !px-3.5 text-xs flex items-center gap-1.5"
                  >
                    {busy ? <RefreshCw size={12} className="animate-spin" /> : <Check size={12} />}
                    <span>Test & Connect WebDAV</span>
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Sync Controls & Options */}
        <div className="p-3.5 rounded-xl border border-app bg-surface flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div
              className={`p-2 rounded-lg ${
                status === 'syncing'
                  ? 'bg-amber-500/10 text-amber-500'
                  : status === 'synced'
                  ? 'bg-emerald-500/10 text-emerald-500'
                  : status === 'error'
                  ? 'bg-rose-500/10 text-rose-500'
                  : 'bg-muted/10 text-muted'
              }`}
            >
              {status === 'syncing' ? (
                <RefreshCw size={16} className="animate-spin text-amber-500" />
              ) : (
                <Cloud size={16} />
              )}
            </div>
            <div>
              <div className="text-xs font-semibold text-app flex items-center gap-1.5">
                <span>Active: {CLOUD_PROVIDER_META[settings.activeProvider].name}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${
                    status === 'synced'
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      : status === 'syncing'
                      ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                      : 'bg-muted/10 text-muted'
                  }`}
                >
                  {status === 'syncing' ? 'Syncing…' : status === 'synced' ? 'Synced' : 'Idle'}
                </span>
              </div>
              <div className="text-[11px] text-muted">
                {settings.lastSyncTime
                  ? `Last synced ${formatRelativeTime(settings.lastSyncTime)}`
                  : 'Never synced'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleSelectActive('none')}
              className={`btn-ghost !py-1.5 !px-2.5 text-xs rounded-lg ${
                settings.activeProvider === 'none' ? 'text-primary font-semibold' : 'text-muted'
              }`}
              title="Disable cloud sync (local only)"
            >
              Disable Sync
            </button>
            <button
              onClick={handleManualSync}
              disabled={busy || settings.activeProvider === 'none'}
              className="btn-primary !py-1.5 !px-3 text-xs flex items-center gap-1.5 shadow-sm"
            >
              <RefreshCw size={13} className={busy || status === 'syncing' ? 'animate-spin' : ''} />
              <span>Sync Now</span>
            </button>
          </div>
        </div>

        {/* Footer info */}
        <div className="text-[11px] text-muted flex items-center justify-between px-1">
          <span>Auto-sync runs every 5 minutes in background and upon tab visibility</span>
          <button onClick={onClose} className="text-primary hover:underline">
            Done
          </button>
        </div>
      </div>
    </Modal>
  );
}
