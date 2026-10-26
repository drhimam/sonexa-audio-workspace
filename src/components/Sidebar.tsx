import { useMemo, useState } from 'react';
import {
  Plus, Mic, FileText, MessageSquare, Sparkles, Trash2, Search,
  MoreHorizontal, AudioWaveform, Circle, Loader2, CheckCircle2, AlertCircle,
  Folder as FolderIcon, FolderPlus, ChevronRight, ChevronDown, FolderInput,
  Pencil, type LucideIcon,
} from 'lucide-react';
import type { Folder, Session, SessionStatus } from '@/lib/types';
import { clsx, formatDate } from '@/lib/utils';
import { Modal } from './Modal';

interface SidebarProps {
  sessions: Session[];
  folders: Folder[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: (folderId: string | null) => void;
  onDelete: (id: string) => void;
  onCreateFolder: (name: string) => Promise<void>;
  onRenameFolder: (id: string, name: string) => Promise<void>;
  onDeleteFolder: (id: string) => Promise<void>;
  onMoveSession: (sessionId: string, folderId: string | null) => Promise<void>;
}

const STATUS_META: Record<SessionStatus, { label: string; icon: LucideIcon; color: string }> = {
  recording: { label: 'Recording', icon: Circle, color: 'text-red-500' },
  recorded: { label: 'Recorded', icon: AudioWaveform, color: 'text-blue-500' },
  transcribing: { label: 'Transcribing', icon: Loader2, color: 'text-amber-500' },
  transcribed: { label: 'Ready', icon: CheckCircle2, color: 'text-primary' },
  enhancing: { label: 'Enhancing', icon: Loader2, color: 'text-amber-500' },
  enhanced: { label: 'Enhanced', icon: CheckCircle2, color: 'text-primary' },
  error: { label: 'Error', icon: AlertCircle, color: 'text-red-500' },
};

const NO_FOLDER = '__unfiled__';

export function Sidebar({
  sessions, folders, activeId, onSelect, onNew, onDelete,
  onCreateFolder, onRenameFolder, onDeleteFolder, onMoveSession,
}: SidebarProps) {
  const [query, setQuery] = useState('');
  const [menuId, setMenuId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [folderModal, setFolderModal] = useState<null | { mode: 'create' } | { mode: 'rename'; folder: Folder }>(null);
  const [moveModal, setMoveModal] = useState<Session | null>(null);
  const [folderNameDraft, setFolderNameDraft] = useState('');

  // Group sessions: unfiled bucket + one bucket per folder.
  const grouped = useMemo(() => {
    const map = new Map<string, Session[]>();
    const filtered = !query.trim()
      ? sessions
      : sessions.filter((s) => s.title.toLowerCase().includes(query.toLowerCase()));
    for (const s of filtered) {
      const key = s.folderId ?? NO_FOLDER;
      const arr = map.get(key) ?? [];
      arr.push(s);
      map.set(key, arr);
    }
    return map;
  }, [sessions, query]);

  const folderOrder = useMemo(() => [...folders].sort((a, b) => a.createdAt - b.createdAt), [folders]);
  const unfiled = grouped.get(NO_FOLDER) ?? [];

  const openCreateFolder = () => { setFolderNameDraft(''); setFolderModal({ mode: 'create' }); };
  const openRenameFolder = (f: Folder) => { setFolderNameDraft(f.name); setFolderModal({ mode: 'rename', folder: f }); };

  const submitFolder = async () => {
    const name = folderNameDraft.trim();
    if (!name) return;
    if (folderModal?.mode === 'create') await onCreateFolder(name);
    else if (folderModal?.mode === 'rename') await onRenameFolder(folderModal.folder.id, name);
    setFolderModal(null);
  };

  const toggleCollapse = (key: string) => setCollapsed((c) => ({ ...c, [key]: !c[key] }));

  const renderSession = (s: Session) => {
    const meta = STATUS_META[s.status];
    const Icon = meta.icon;
    const isActive = s.id === activeId;
    const hasTranscript = !!s.transcript && s.transcript.segments.length > 0;
    const hasChat = s.chat.length > 0;
    const hasDocs = s.documents.length > 0;
    return (
      <div
        key={s.id}
        onClick={() => onSelect(s.id)}
        className={clsx(
          'group relative rounded-lg px-3 py-2.5 mb-1 cursor-pointer transition-colors',
          isActive ? 'bg-primary/10' : 'hover:bg-black/[0.03] dark:hover:bg-white/[0.04]',
        )}
      >
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className={clsx('text-sm font-medium truncate', isActive ? 'text-primary' : 'text-[var(--text)]')}>{s.title}</p>
            <div className="flex items-center gap-1.5 mt-1 text-[11px] text-muted">
              <Icon size={11} className={clsx(meta.color, (s.status === 'transcribing' || s.status === 'enhancing') && 'animate-spin')} />
              <span>{meta.label}</span>
              {s.durationSec ? <span className="text-soft">· {Math.round(s.durationSec)}s</span> : null}
              {s.source === 'upload' && <span className="text-soft">· upload</span>}
            </div>
            <div className="flex items-center gap-1.5 mt-1.5 text-soft">
              <FileText size={11} className={hasTranscript ? 'text-primary' : ''} />
              <MessageSquare size={11} className={hasChat ? 'text-primary' : ''} />
              <Sparkles size={11} className={hasDocs ? 'text-primary' : ''} />
              <span className="ml-auto text-[10px]">{formatDate(s.updatedAt)}</span>
            </div>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); setMenuId(menuId === s.id ? null : s.id); }}
            className="btn-ghost !p-1 !rounded-md opacity-0 group-hover:opacity-100 transition"
            aria-label="Session options"
          >
            <MoreHorizontal size={14} />
          </button>
        </div>
        {menuId === s.id && (
          <div className="absolute right-2 top-10 z-20 surface border border-app rounded-lg shadow-soft-dark py-1 w-44 animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => { setMoveModal(s); setMenuId(null); }}
              className="w-full text-left px-3 py-1.5 text-xs hover:bg-black/5 dark:hover:bg-white/10 flex items-center gap-2"
            >
              <FolderInput size={12} /> Move to folder…
            </button>
            <button
              onClick={() => { onDelete(s.id); setMenuId(null); }}
              className="w-full text-left px-3 py-1.5 text-xs text-red-500 hover:bg-red-500/10 flex items-center gap-2"
            >
              <Trash2 size={12} /> Delete session
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderFolderHeader = (label: string, count: number, key: string, actions?: React.ReactNode) => {
    const isCollapsed = collapsed[key];
    return (
      <div className="group flex items-center gap-1.5 px-2 py-1.5 mt-3 first:mt-1">
        <button onClick={() => toggleCollapse(key)} className="btn-ghost !p-0.5 !rounded-md" aria-label={isCollapsed ? 'Expand' : 'Collapse'}>
          {isCollapsed ? <ChevronRight size={14} className="text-soft" /> : <ChevronDown size={14} className="text-soft" />}
        </button>
        <FolderIcon size={16} className={clsx(key === NO_FOLDER ? 'text-soft' : 'text-primary')} />
        <span className={clsx(
          'font-semibold truncate',
          key === NO_FOLDER ? 'text-sm text-muted normal-case tracking-normal' : 'text-[15px] text-[var(--text)]',
        )}>{label}</span>
        <span className="text-[11px] text-soft">{count}</span>
        <div className="ml-auto flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition">
          {key !== NO_FOLDER && (
            <button
              onClick={(e) => { e.stopPropagation(); onNew(key); }}
              className="btn-ghost !p-1 !rounded-md"
              aria-label="New session in this folder"
              title="New session here"
            >
              <Plus size={12} />
            </button>
          )}
          {actions}
        </div>
      </div>
    );
  };

  return (
    <>
      <aside className="w-72 shrink-0 h-full flex flex-col border-r border-app surface">
        <div className="px-4 py-4 border-b border-app">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white">
              <AudioWaveform size={18} />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold">Sonexa</div>
              <div className="text-[10px] text-soft">Audio Workspace</div>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => onNew(null)} className="btn-primary flex-1">
              <Plus size={16} /> New session
            </button>
            <button onClick={openCreateFolder} className="btn-outline !px-2.5" aria-label="New folder" title="New folder">
              <FolderPlus size={15} />
            </button>
          </div>
        </div>

        <div className="px-3 py-2.5 border-b border-app">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-soft" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search sessions…" className="input !pl-8 !py-2 text-sm" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto scroll-thin px-2 py-2">
          {sessions.length === 0 ? (
            <div className="text-center py-10 px-4">
              <Mic size={22} className="text-soft mx-auto mb-2" />
              <p className="text-xs text-muted">No sessions yet.</p>
              <p className="text-[11px] text-soft mt-1">Start a new session, record or upload audio.</p>
            </div>
          ) : (
            <>
              {unfiled.length > 0 && (
                <>
                  {renderFolderHeader('Unfiled', unfiled.length, NO_FOLDER)}
                  {!collapsed[NO_FOLDER] && unfiled.map(renderSession)}
                </>
              )}
              {folderOrder.map((f) => {
                const items = grouped.get(f.id) ?? [];
                return (
                  <div key={f.id}>
                    {renderFolderHeader(f.name, items.length, f.id, (
                      <>
                        <button onClick={(e) => { e.stopPropagation(); openRenameFolder(f); }} className="btn-ghost !p-1 !rounded-md" aria-label="Rename folder"><Pencil size={11} /></button>
                        <button onClick={(e) => { e.stopPropagation(); onDeleteFolder(f.id); }} className="btn-ghost !p-1 !rounded-md text-red-500 hover:bg-red-500/10" aria-label="Delete folder"><Trash2 size={11} /></button>
                      </>
                    ))}
                    {!collapsed[f.id] && items.map(renderSession)}
                  </div>
                );
              })}
              {folderOrder.length === 0 && unfiled.length === 0 && (
                <p className="text-center text-[11px] text-soft py-6">No matches.</p>
              )}
            </>
          )}
        </div>
        <div className="px-3 py-2 border-t border-app text-[10px] text-soft text-center">
          Local-first · IndexedDB
        </div>
      </aside>

      {/* Folder create / rename modal */}
      <Modal
        open={!!folderModal}
        onClose={() => setFolderModal(null)}
        title={folderModal?.mode === 'rename' ? 'Rename folder' : 'New folder'}
        icon={<FolderIcon size={18} />}
        maxWidth="max-w-sm"
        footer={
          <>
            <button onClick={() => setFolderModal(null)} className="btn-ghost">Cancel</button>
            <button onClick={submitFolder} disabled={!folderNameDraft.trim()} className="btn-primary">
              {folderModal?.mode === 'rename' ? 'Rename' : 'Create'}
            </button>
          </>
        }
      >
        <label className="text-xs font-medium text-muted">Folder name</label>
        <input
          autoFocus
          value={folderNameDraft}
          onChange={(e) => setFolderNameDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submitFolder(); }}
          placeholder="e.g. Client calls, Research interviews…"
          className="input mt-1.5 text-sm"
        />
      </Modal>

      {/* Move session to folder modal */}
      <MoveModal
        session={moveModal}
        folders={folderOrder}
        onClose={() => setMoveModal(null)}
        onMove={async (folderId) => {
          if (moveModal) await onMoveSession(moveModal.id, folderId);
          setMoveModal(null);
        }}
      />
    </>
  );
}

function MoveModal({
  session, folders, onClose, onMove,
}: {
  session: Session | null;
  folders: Folder[];
  onClose: () => void;
  onMove: (folderId: string | null) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const move = async (folderId: string | null) => {
    setBusy(true);
    try { await onMove(folderId); } finally { setBusy(false); }
  };
  return (
    <Modal
      open={!!session}
      onClose={onClose}
      title="Move to folder"
      subtitle={session?.title}
      icon={<FolderInput size={18} />}
      maxWidth="max-w-sm"
    >
      <div className="space-y-1.5">
        <button
          onClick={() => move(null)}
          disabled={busy}
          className={clsx('w-full text-left rounded-lg px-3 py-2.5 text-sm flex items-center gap-2 transition-colors',
            session?.folderId == null ? 'bg-primary/10 text-primary' : 'hover:bg-black/5 dark:hover:bg-white/10')}
        >
          <FolderIcon size={15} className="text-soft" /> Unfiled
          {session?.folderId == null && <CheckCircle2 size={14} className="ml-auto" />}
        </button>
        {folders.map((f) => (
          <button
            key={f.id}
            onClick={() => move(f.id)}
            disabled={busy}
            className={clsx('w-full text-left rounded-lg px-3 py-2.5 text-sm flex items-center gap-2 transition-colors',
              session?.folderId === f.id ? 'bg-primary/10 text-primary' : 'hover:bg-black/5 dark:hover:bg-white/10')}
          >
            <FolderIcon size={15} className="text-primary" /> {f.name}
            {session?.folderId === f.id && <CheckCircle2 size={14} className="ml-auto" />}
          </button>
        ))}
        {folders.length === 0 && (
          <p className="text-xs text-soft text-center py-3">No folders yet. Create one with the folder icon above.</p>
        )}
      </div>
    </Modal>
  );
}