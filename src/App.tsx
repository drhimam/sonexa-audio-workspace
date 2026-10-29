import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Settings, Sun, Moon, AudioWaveform, Plus, Cloud,
  RefreshCw, ArrowLeft, Database,
  Menu, Download,
} from 'lucide-react';
import { Sidebar } from '@/components/Sidebar';
import { Workspace } from '@/components/Workspace';
import { SettingsModal } from '@/components/SettingsModal';
import { LandingPage } from '@/components/LandingPage';
import { DataBackupModal } from '@/components/DataBackupModal';
import { NewSessionModal } from '@/components/NewSessionModal';
import { usePwaInstall } from '@/lib/usePwaInstall';
import { useTheme } from '@/lib/useTheme';
import { useProviderSettings } from '@/lib/useProviderSettings';
import { runBidirectionalSync } from '@/lib/sync';
import {
  listSessions, saveSession, deleteSession, getSession, updateSession,
  listFolders, saveFolder, renameFolder, deleteFolder,
} from '@/lib/db';
import type { Folder, Session } from '@/lib/types';
import { useCloudSync } from '@/lib/useCloudSync';
import { CloudSyncModal } from '@/components/CloudSyncModal';
import { uid } from '@/lib/utils';



export default function App() {
  const { theme, toggle } = useTheme();
  const { settings, ready, update } = useProviderSettings();
  const cloudSync = useCloudSync();
  const pwa = usePwaInstall();

  const syncDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [view, setView] = useState<'landing' | 'workspace'>(() => {
    return (localStorage.getItem('sonexa_view') as 'landing' | 'workspace') || 'landing';
  });

  const [sessions, setSessions] = useState<Session[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [cloudSyncModalOpen, setCloudSyncModalOpen] = useState(false);
  const [backupOpen, setBackupOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [newSessionModalOpen, setNewSessionModalOpen] = useState(false);
  const [newSessionFolderId, setNewSessionFolderId] = useState<string | null>(null);

  // Sync view preference
  const handleSetView = (v: 'landing' | 'workspace') => {
    setView(v);
    localStorage.setItem('sonexa_view', v);
  };

  // Reload local IndexedDB data
  const refreshLocalData = useCallback(async () => {
    const [s, f] = await Promise.all([listSessions(), listFolders()]);
    const normalizedFolders = f.map((folder) => ({
      ...folder,
      name: folder.name.toUpperCase(),
    }));
    setSessions(s);
    setFolders(normalizedFolders);
    if (s.length > 0 && !activeId) setActiveId(s[0].id);
  }, [activeId]);

  useEffect(() => {
    refreshLocalData();
  }, [refreshLocalData]);

  // Unified Multi-Cloud Sync Handler
  const handleTriggerSync = useCallback(async () => {
    if (cloudSync.settings.activeProvider === 'none') return;

    try {
      const res = await cloudSync.syncNow();
      if (res.success) {
        if (res.pulledSessions > 0 || res.pulledFolders > 0) {
          await refreshLocalData();
        }
      }
    } catch (err: unknown) {
      console.error('Multi-cloud sync error:', err);
    }
  }, [cloudSync, refreshLocalData]);

  // Debounced cloud sync when local modifications occur (cooldown of 4 seconds)
  const scheduleDebouncedSync = useCallback((delayMs = 4000) => {
    if (cloudSync.settings.activeProvider === 'none') return;
    if (syncDebounceTimerRef.current) clearTimeout(syncDebounceTimerRef.current);
    syncDebounceTimerRef.current = setTimeout(() => {
      handleTriggerSync();
    }, delayMs);
  }, [cloudSync.settings.activeProvider, handleTriggerSync]);

  // Periodic automatic sync: 5-minute background heartbeat + tab visibility trigger
  useEffect(() => {
    if (cloudSync.settings.activeProvider === 'none' || !cloudSync.settings.autoSync) return;

    // Run initial sync once upon provider select
    handleTriggerSync();

    // Heartbeat every 5 minutes (300,000ms)
    const interval = setInterval(() => {
      handleTriggerSync();
    }, cloudSync.settings.syncIntervalMs || 300000);

    // Sync when tab regains focus
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        handleTriggerSync();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (syncDebounceTimerRef.current) clearTimeout(syncDebounceTimerRef.current);
    };
  }, [cloudSync.settings.activeProvider, cloudSync.settings.autoSync, cloudSync.settings.syncIntervalMs, handleTriggerSync]);

  const active = activeId ? sessions.find((s) => s.id === activeId) ?? null : null;

  const openNewSessionModal = (folderId: string | null = null) => {
    setNewSessionFolderId(folderId);
    setNewSessionModalOpen(true);
  };

  const handleCreateSession = async (title: string, folderId: string | null) => {
    const now = Date.now();
    const s: Session = {
      id: uid('sess-'),
      title,
      createdAt: now,
      updatedAt: now,
      status: 'recording',
      folderId,
      chat: [],
      documents: [],
      savedItems: [],
    };
    await saveSession(s);
    setSessions((prev) => [s, ...prev]);
    setActiveId(s.id);
    setMobileMenuOpen(false);
    scheduleDebouncedSync(2000);
  };

  const handleSelect = async (id: string) => {
    setActiveId(id);
    const fresh = await getSession(id);
    if (fresh) setSessions((prev) => prev.map((s) => (s.id === id ? fresh : s)));
  };

  const handleDelete = async (id: string) => {
    await deleteSession(id);
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== id);
      setActiveId((curr) => (curr === id ? next[0]?.id ?? null : curr));
      return next;
    });
    scheduleDebouncedSync(2000);
  };

  const handleSessionChange = (updated: Session) => {
    setSessions((prev) => {
      const next = prev.map((s) => (s.id === updated.id ? updated : s));
      return [...next].sort((a, b) => b.updatedAt - a.updatedAt);
    });
    scheduleDebouncedSync(4000);
  };

  // ---- Folder handlers --------------------------------------------------

  const handleCreateFolder = async (name: string): Promise<Folder> => {
    const formattedName = name.trim().toUpperCase();
    const now = Date.now();
    const folder: Folder = { id: uid('fld-'), name: formattedName, createdAt: now, updatedAt: now };
    await saveFolder(folder);
    setFolders((prev) => [...prev, folder].sort((a, b) => a.createdAt - b.createdAt));
    scheduleDebouncedSync(2000);
    return folder;
  };

  const handleRenameFolder = async (id: string, name: string) => {
    const formattedName = name.trim().toUpperCase();
    await renameFolder(id, formattedName);
    setFolders((prev) => prev.map((f) => (f.id === id ? { ...f, name: formattedName, updatedAt: Date.now() } : f)));
    scheduleDebouncedSync(2000);
  };

  const handleDeleteFolder = async (id: string) => {
    await deleteFolder(id);
    setFolders((prev) => prev.filter((f) => f.id !== id));
    setSessions((prev) => prev.map((s) => (s.folderId === id ? { ...s, folderId: null } : s)));
    scheduleDebouncedSync(2000);
  };

  const handleMoveSession = async (sessionId: string, folderId: string | null) => {
    await updateSession(sessionId, { folderId });
    setSessions((prev) => prev.map((s) => (s.id === sessionId ? { ...s, folderId, updatedAt: Date.now() } : s)));
    scheduleDebouncedSync(2000);
  };

  // Render Landing Page View
  if (view === 'landing') {
    return (
      <>
        <LandingPage
          onLaunchWorkspace={() => handleSetView('workspace')}
          onOpenCloudSync={() => setCloudSyncModalOpen(true)}
          theme={theme}
          onToggleTheme={toggle}
          canInstallApp={pwa.canInstall}
          onInstallApp={pwa.install}
        />
        <CloudSyncModal
          open={cloudSyncModalOpen}
          onClose={() => setCloudSyncModalOpen(false)}
          cloudSync={cloudSync}
        />
      </>
    );
  }

  // Render Workspace View
  return (
    <div className="h-screen w-screen flex overflow-hidden bg-[var(--bg)] text-[var(--text)]">
      <Sidebar
        sessions={sessions}
        folders={folders}
        activeId={activeId}
        onSelect={handleSelect}
        onNew={openNewSessionModal}
        onDelete={handleDelete}
        onCreateFolder={handleCreateFolder}
        onRenameFolder={handleRenameFolder}
        onDeleteFolder={handleDeleteFolder}
        onMoveSession={handleMoveSession}
        onOpenBackup={() => setBackupOpen(true)}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        onInstallApp={pwa.install}
        canInstallApp={pwa.canInstall}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-12 shrink-0 border-b border-app surface flex items-center justify-between px-3 sm:px-4">
          <div className="flex items-center gap-2 sm:gap-3 text-xs text-muted">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden btn-ghost !p-1.5 rounded-lg text-muted hover:text-[var(--text)]"
              aria-label="Open sidebar navigation"
              title="Open Menu"
            >
              <Menu size={18} />
            </button>
            <button
              onClick={() => handleSetView('landing')}
              className="btn-ghost !p-1.5 rounded-lg flex items-center gap-1.5 text-xs text-soft hover:text-[var(--text)]"
              title="Back to Landing Page"
            >
              <ArrowLeft size={13} />
              <span className="hidden sm:inline">Overview</span>
            </button>
            <div className="h-4 w-[1px] bg-[var(--border)] hidden sm:block" />
            <div className="flex items-center gap-1.5">
              <AudioWaveform size={14} className="text-primary" />
              <span className="font-medium text-[var(--text)]">Sonexa</span>
              <span className="text-soft hidden md:inline">· local-first</span>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-1.5">
            {/* Install Desktop App Button */}
            {pwa.canInstall && (
              <button
                onClick={pwa.install}
                className="btn-primary !py-1 !px-2.5 text-xs rounded-lg hidden sm:flex items-center gap-1.5 shadow-sm"
                title="Install Sonexa as a desktop app"
              >
                <Download size={13} />
                <span>Install App</span>
              </button>
            )}

            {/* Multi-Cloud Sync Status Badge & Modal Trigger */}
            <div className="flex items-center gap-1 mr-1">
              <button
                onClick={() => setCloudSyncModalOpen(true)}
                className={`btn-ghost !py-1 !px-2.5 text-xs rounded-full flex items-center gap-1.5 border border-app transition-all ${
                  cloudSync.status === 'syncing'
                    ? 'text-amber-500 bg-amber-500/10 border-amber-500/30'
                    : cloudSync.status === 'synced'
                    ? 'text-primary bg-primary/10 border-primary/30'
                    : cloudSync.status === 'error'
                    ? 'text-rose-500 bg-rose-500/10 border-rose-500/30'
                    : 'text-muted hover:text-app hover:border-primary/40'
                }`}
                title="Select Cloud Provider (Google Drive, OneDrive, WebDAV, Sonexa Cloud)"
              >
                {cloudSync.status === 'syncing' ? (
                  <RefreshCw size={12} className="animate-spin text-amber-500" />
                ) : (
                  <Cloud size={12} className={cloudSync.status === 'synced' ? 'text-primary' : 'text-muted'} />
                )}
                <span className="text-[11px] font-medium hidden sm:inline">
                  {cloudSync.status === 'syncing'
                    ? 'Syncing…'
                    : cloudSync.settings.activeProvider !== 'none'
                    ? cloudSync.activeMeta.badgeLabel
                    : 'Connect Cloud'}
                </span>
              </button>

              {cloudSync.settings.activeProvider !== 'none' && (
                <button
                  onClick={handleTriggerSync}
                  disabled={cloudSync.status === 'syncing'}
                  className="btn-ghost !p-1.5 rounded-full text-muted hover:text-primary transition"
                  title={`Sync with ${cloudSync.activeMeta.name} now`}
                >
                  <RefreshCw size={12} className={cloudSync.status === 'syncing' ? 'animate-spin' : ''} />
                </button>
              )}
            </div>

            <button onClick={() => openNewSessionModal(null)} className="btn-ghost !py-1.5 !px-2 text-xs">
              <Plus size={14} /> <span className="hidden sm:inline">New</span>
            </button>

            <button onClick={toggle} className="btn-ghost !p-2 rounded-md" aria-label="Toggle theme">
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            <button onClick={() => setBackupOpen(true)} className="btn-ghost !p-2 rounded-md" aria-label="Backup / Transfer Data" title="Backup & Transfer Database (JSON)">
              <Database size={16} />
            </button>

            <button onClick={() => setSettingsOpen(true)} className="btn-ghost !p-2 rounded-md" aria-label="Settings">
              <Settings size={16} />
            </button>
          </div>
        </header>

        {/* Main */}
        <main className="flex-1 overflow-hidden">
          {active ? (
            <Workspace
              key={active.id}
              session={active}
              settings={settings}
              onSessionChange={handleSessionChange}
            />
          ) : (
            <EmptyState onNew={() => openNewSessionModal(null)} />
          )}
        </main>
      </div>

      {ready && (
        <SettingsModal
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          settings={settings}
          onUpdate={update}
          onOpenBackup={() => setBackupOpen(true)}
          onOpenCloudSync={() => setCloudSyncModalOpen(true)}
        />
      )}

      <CloudSyncModal
        open={cloudSyncModalOpen}
        onClose={() => setCloudSyncModalOpen(false)}
        cloudSync={cloudSync}
      />

      <DataBackupModal
        open={backupOpen}
        onClose={() => setBackupOpen(false)}
        onDataChanged={refreshLocalData}
      />

      <NewSessionModal
        open={newSessionModalOpen}
        onClose={() => setNewSessionModalOpen(false)}
        folders={folders}
        initialFolderId={newSessionFolderId}
        onSubmit={handleCreateSession}
        onCreateFolder={handleCreateFolder}
      />
    </div>
  );
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center px-6">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
        <AudioWaveform size={28} className="text-primary" />
      </div>
      <h2 className="text-xl font-semibold">Welcome to Sonexa</h2>
      <p className="text-xs font-semibold text-primary mt-1">AI Meeting Copilot</p>
      <p className="text-sm text-muted mt-2 max-w-md">
        Local-First AI Speech Transcription, Meeting Intelligence & Document Generator. Record or upload audio, transcribe with multiple AI providers, enhance the transcript, chat with it, and generate structured documents — all from your browser.
      </p>
      <button onClick={onNew} className="btn-primary mt-5"><Plus size={16} /> Start a new session</button>
      <p className="text-xs text-soft mt-4">Tip: add your API keys in Settings to enable live transcription and AI chat.</p>
    </div>
  );
}
