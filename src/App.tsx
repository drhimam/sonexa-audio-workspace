import { useEffect, useState, useCallback } from 'react';
import {
  Settings, Sun, Moon, AudioWaveform, Plus, Cloud,
  RefreshCw, User as UserIcon, LogOut, Check, ArrowLeft,
} from 'lucide-react';
import { Sidebar } from '@/components/Sidebar';
import { Workspace } from '@/components/Workspace';
import { SettingsModal } from '@/components/SettingsModal';
import { LandingPage } from '@/components/LandingPage';
import { AuthModal, type AuthMode } from '@/components/AuthModal';
import { useTheme } from '@/lib/useTheme';
import { useProviderSettings } from '@/lib/useProviderSettings';
import { useAuth } from '@/lib/useAuth';
import { runBidirectionalSync } from '@/lib/sync';
import {
  listSessions, saveSession, deleteSession, getSession, updateSession,
  listFolders, saveFolder, renameFolder, deleteFolder,
} from '@/lib/db';
import type { Folder, Session } from '@/lib/types';
import { uid } from '@/lib/utils';

function newSession(folderId: string | null = null): Session {
  const now = Date.now();
  return {
    id: uid('sess-'),
    title: `Session ${new Date(now).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`,
    createdAt: now,
    updatedAt: now,
    status: 'recording',
    folderId,
    chat: [],
    documents: [],
    savedItems: [],
  };
}

export default function App() {
  const { theme, toggle } = useTheme();
  const { settings, ready, update } = useProviderSettings();
  const auth = useAuth();

  const [view, setView] = useState<'landing' | 'workspace'>(() => {
    return (localStorage.getItem('sonexa_view') as 'landing' | 'workspace') || 'landing';
  });

  const [sessions, setSessions] = useState<Session[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [authModal, setAuthModal] = useState<{ open: boolean; mode: AuthMode }>({
    open: false,
    mode: 'signin',
  });
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  // Sync view preference
  const handleSetView = (v: 'landing' | 'workspace') => {
    setView(v);
    localStorage.setItem('sonexa_view', v);
  };

  // Reload local IndexedDB data
  const refreshLocalData = useCallback(async () => {
    const [s, f] = await Promise.all([listSessions(), listFolders()]);
    setSessions(s);
    setFolders(f);
    if (s.length > 0 && !activeId) setActiveId(s[0].id);
  }, [activeId]);

  useEffect(() => {
    refreshLocalData();
  }, [refreshLocalData]);

  // Cloud Sync Handler
  const handleTriggerSync = useCallback(async () => {
    if (!auth.token || !auth.syncEnabled) return;
    auth.setSyncStatus('syncing');
    const res = await runBidirectionalSync(auth.token, auth.lastSyncTime, { syncAudio: auth.syncAudio });
    if (res.success) {
      auth.setSyncStatus('synced');
      await refreshLocalData();
    } else {
      auth.setSyncStatus('error', res.error);
    }
  }, [auth, refreshLocalData]);

  // Periodic automatic sync every 60 seconds if authenticated and enabled
  useEffect(() => {
    if (!auth.isLoggedIn || !auth.syncEnabled || !auth.token) return;
    handleTriggerSync();
    const interval = setInterval(handleTriggerSync, 60000);
    return () => clearInterval(interval);
  }, [auth.isLoggedIn, auth.syncEnabled, auth.token, handleTriggerSync]);

  const active = activeId ? sessions.find((s) => s.id === activeId) ?? null : null;

  const handleNew = async (folderId: string | null = null) => {
    const s = newSession(folderId);
    await saveSession(s);
    setSessions((prev) => [s, ...prev]);
    setActiveId(s.id);
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
  };

  const handleSessionChange = (updated: Session) => {
    setSessions((prev) => {
      const next = prev.map((s) => (s.id === updated.id ? updated : s));
      return [...next].sort((a, b) => b.updatedAt - a.updatedAt);
    });
  };

  // ---- Folder handlers --------------------------------------------------

  const handleCreateFolder = async (name: string) => {
    const now = Date.now();
    const folder: Folder = { id: uid('fld-'), name, createdAt: now, updatedAt: now };
    await saveFolder(folder);
    setFolders((prev) => [...prev, folder].sort((a, b) => a.createdAt - b.createdAt));
  };

  const handleRenameFolder = async (id: string, name: string) => {
    await renameFolder(id, name);
    setFolders((prev) => prev.map((f) => (f.id === id ? { ...f, name, updatedAt: Date.now() } : f)));
  };

  const handleDeleteFolder = async (id: string) => {
    await deleteFolder(id);
    setFolders((prev) => prev.filter((f) => f.id !== id));
    setSessions((prev) => prev.map((s) => (s.folderId === id ? { ...s, folderId: null } : s)));
  };

  const handleMoveSession = async (sessionId: string, folderId: string | null) => {
    await updateSession(sessionId, { folderId });
    setSessions((prev) => prev.map((s) => (s.id === sessionId ? { ...s, folderId, updatedAt: Date.now() } : s)));
  };

  // Render Landing Page View
  if (view === 'landing') {
    return (
      <>
        <LandingPage
          onLaunchWorkspace={() => handleSetView('workspace')}
          onOpenAuth={(mode = 'signin') => setAuthModal({ open: true, mode })}
          theme={theme}
          onToggleTheme={toggle}
          isLoggedIn={auth.isLoggedIn}
          userName={auth.user?.name}
        />
        <AuthModal
          open={authModal.open}
          initialMode={authModal.mode}
          onClose={() => setAuthModal({ open: false, mode: 'signin' })}
          auth={auth}
          onSuccess={() => handleSetView('workspace')}
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
        onNew={handleNew}
        onDelete={handleDelete}
        onCreateFolder={handleCreateFolder}
        onRenameFolder={handleRenameFolder}
        onDeleteFolder={handleDeleteFolder}
        onMoveSession={handleMoveSession}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-12 shrink-0 border-b border-app surface flex items-center justify-between px-4">
          <div className="flex items-center gap-3 text-xs text-muted">
            <button
              onClick={() => handleSetView('landing')}
              className="btn-ghost !p-1.5 rounded-lg flex items-center gap-1.5 text-xs text-soft hover:text-[var(--text)]"
              title="Back to Landing Page"
            >
              <ArrowLeft size={13} />
              <span className="hidden sm:inline">Overview</span>
            </button>
            <div className="h-4 w-[1px] bg-[var(--border)]" />
            <div className="flex items-center gap-1.5">
              <AudioWaveform size={14} className="text-primary" />
              <span className="font-medium text-[var(--text)]">Sonexa</span>
              <span className="text-soft">· local-first</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Cloud Sync Status Badge */}
            {auth.isLoggedIn ? (
              <div className="flex items-center gap-1 mr-1">
                <button
                  onClick={handleTriggerSync}
                  className={`btn-ghost !py-1 !px-2.5 text-xs rounded-full flex items-center gap-1.5 border border-app ${
                    auth.syncStatus === 'syncing'
                      ? 'text-amber-500 bg-amber-500/10'
                      : auth.syncStatus === 'synced'
                      ? 'text-primary bg-primary/10'
                      : 'text-muted'
                  }`}
                  title="Click to sync with Cloudflare D1"
                >
                  {auth.syncStatus === 'syncing' ? (
                    <RefreshCw size={12} className="animate-spin text-amber-500" />
                  ) : (
                    <Cloud size={12} className="text-primary" />
                  )}
                  <span className="text-[11px] font-medium hidden md:inline">
                    {auth.syncStatus === 'syncing' ? 'Syncing...' : 'Cloud Synced'}
                  </span>
                </button>
              </div>
            ) : (
              <button
                onClick={() => setAuthModal({ open: true, mode: 'signin' })}
                className="btn-ghost !py-1 !px-2 text-xs rounded-lg text-primary hover:bg-primary/10 flex items-center gap-1 mr-1"
                title="Enable Cloudflare Multi-Device Sync"
              >
                <Cloud size={13} />
                <span className="text-[11px] font-medium hidden sm:inline">Connect Cloud</span>
              </button>
            )}

            <button onClick={() => handleNew(null)} className="btn-ghost !py-1.5 text-xs">
              <Plus size={14} /> New
            </button>

            <button onClick={toggle} className="btn-ghost !p-2 rounded-md" aria-label="Toggle theme">
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            <button onClick={() => setSettingsOpen(true)} className="btn-ghost !p-2 rounded-md" aria-label="Settings">
              <Settings size={16} />
            </button>

            {/* User Profile / Auth Button */}
            {auth.isLoggedIn ? (
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen((o) => !o)}
                  className="w-7 h-7 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-xs hover:ring-2 hover:ring-primary/40 transition"
                  aria-label="User Account"
                >
                  {auth.user?.name ? auth.user.name.charAt(0).toUpperCase() : 'U'}
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 top-9 z-50 surface border border-app rounded-xl shadow-soft-dark py-2 w-56 animate-slide-up text-xs">
                    <div className="px-3 py-1.5 border-b border-app">
                      <p className="font-semibold text-[var(--text)] truncate">{auth.user?.name || 'Account'}</p>
                      <p className="text-[11px] text-muted truncate">{auth.user?.email}</p>
                      <div className="flex items-center gap-1 text-[10px] text-primary mt-1">
                        <Check size={11} /> ZeptoMail Verified
                      </div>
                    </div>

                    <div className="px-3 py-2 border-b border-app space-y-1">
                      <div className="flex items-center justify-between text-muted">
                        <span>Cloudflare Sync:</span>
                        <span className="text-primary font-medium">{auth.syncEnabled ? 'Active' : 'Off'}</span>
                      </div>
                      <div className="flex items-center justify-between text-muted">
                        <span>Audio Sync:</span>
                        <span className="text-soft">{auth.syncAudio ? 'Enabled' : 'Text Only'}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        auth.signOut();
                        setUserMenuOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 text-red-500 hover:bg-red-500/10 flex items-center gap-2 mt-1"
                    >
                      <LogOut size={13} /> Sign Out of Cloud
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => setAuthModal({ open: true, mode: 'signin' })}
                className="btn-outline !py-1 !px-2.5 text-xs rounded-lg"
              >
                <UserIcon size={13} />
                <span>Sign In</span>
              </button>
            )}
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
            <EmptyState onNew={() => handleNew(null)} />
          )}
        </main>
      </div>

      {ready && (
        <SettingsModal
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          settings={settings}
          onUpdate={update}
        />
      )}

      <AuthModal
        open={authModal.open}
        initialMode={authModal.mode}
        onClose={() => setAuthModal({ open: false, mode: 'signin' })}
        auth={auth}
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
      <p className="text-sm text-muted mt-2 max-w-md">
        A local-first audio workspace. Record or upload audio, transcribe with multiple AI providers, enhance the transcript, chat with it, and generate structured documents — all from your browser.
      </p>
      <button onClick={onNew} className="btn-primary mt-5"><Plus size={16} /> Start a new session</button>
      <p className="text-xs text-soft mt-4">Tip: add your API keys in Settings to enable live transcription and AI chat.</p>
    </div>
  );
}
