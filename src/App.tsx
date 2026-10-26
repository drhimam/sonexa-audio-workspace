import { useEffect, useState } from 'react';
import { Settings, Sun, Moon, AudioWaveform, Plus } from 'lucide-react';
import { Sidebar } from '@/components/Sidebar';
import { Workspace } from '@/components/Workspace';
import { SettingsModal } from '@/components/SettingsModal';
import { useTheme } from '@/lib/useTheme';
import { useProviderSettings } from '@/lib/useProviderSettings';
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
  const [sessions, setSessions] = useState<Session[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    Promise.all([listSessions(), listFolders()]).then(([s, f]) => {
      setSessions(s);
      setFolders(f);
      if (s.length > 0 && !activeId) setActiveId(s[0].id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          <div className="flex items-center gap-2 text-xs text-muted">
            <AudioWaveform size={14} className="text-primary" />
            <span className="hidden sm:inline">Audio Workspace · local-first</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => handleNew(null)} className="btn-ghost !py-1.5 text-xs"><Plus size={14} /> New</button>
            <button onClick={toggle} className="btn-ghost !p-2 rounded-md" aria-label="Toggle theme">
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
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
