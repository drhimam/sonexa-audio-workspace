import { useMemo, useState } from 'react';
import {
  Plus, Mic, FileText, MessageSquare, Sparkles, Trash2, Search,
  MoreHorizontal, AudioWaveform, Circle, Loader2, CheckCircle2, AlertCircle,
  Folder as FolderIcon, FolderPlus, ChevronRight, ChevronDown, FolderInput,
  Pencil, Database, X, Download, type LucideIcon,
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
  onCreateFolder: (name: string) => Promise<void | Folder>;
  onRenameFolder: (id: string, name: string) => Promise<void>;
  onDeleteFolder: (id: string) => Promise<void>;
  onMoveSession: (sessionId: string, folderId: string | null) => Promise<void>;
  onOpenBackup?: () => void;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
  onInstallApp?: () => void;
  canInstallApp?: boolean;
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
  onOpenBackup, mobileOpen, onCloseMobile, onInstallApp, canInstallApp,
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
        onClick={() => {
          onSelect(s.id);
          onCloseMobile?.();
        }}
        className={clsx(
          'group relative rounded-xl px-3 py-2 mb-1 cursor-pointer transition-all border',
          isActive
            ? 'bg-primary/10 border-primary/40 shadow-xs'
            : 'border-transparent hover:bg-black/[0.03] dark:hover:bg-white/[0.04] hover:border-app/50'
        )}
      >
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className={clsx('text-[13px] leading-snug truncate', isActive ? 'text-primary font-semibold' : 'text-[var(--text)] font-normal')}>{s.title}</p>
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
    const isUnfiled = key === NO_FOLDER;

    return (
      <div
        onClick={() => toggleCollapse(key)}
        className={clsx(
          'group cursor-pointer rounded-xl px-2.5 py-2 my-1.5 transition-all border flex items-center gap-2.5 select-none shadow-xs',
          isUnfiled
            ? 'border-app/70 bg-black/[0.02] dark:bg-white/[0.02] hover:bg-black/[0.04] dark:hover:bg-white/[0.04]'
            : 'border-primary/25 bg-primary/[0.04] dark:bg-primary/[0.06] hover:border-primary/45 hover:bg-primary/[0.08]'
        )}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            toggleCollapse(key);
          }}
          className="btn-ghost !p-1 !rounded-md shrink-0"
          aria-label={isCollapsed ? 'Expand folder' : 'Collapse folder'}
        >
          {isCollapsed ? (
            <ChevronRight size={15} className="text-muted" />
          ) : (
            <ChevronDown size={15} className="text-muted" />
          )}
        </button>

        <div
          className={clsx(
            'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-xs border',
            isUnfiled
              ? 'bg-black/5 dark:bg-white/5 border-app text-muted'
              : 'bg-primary/20 dark:bg-primary/25 border-primary/30 text-primary'
          )}
        >
          <FolderIcon size={17} />
        </div>

        <div className="min-w-0 flex-1">
          <span
            className={clsx(
              'block font-bold tracking-tight truncate',
              isUnfiled ? 'text-[15px] text-muted' : 'text-base text-[var(--text)]'
            )}
          >
            {label}
          </span>
        </div>

        <span
          className={clsx(
            'px-2 py-0.5 rounded-full text-xs font-semibold shrink-0',
            isUnfiled ? 'surface-2 text-muted border border-app' : 'bg-primary/15 text-primary'
          )}
        >
          {count}
        </span>

        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition shrink-0">
          {!isUnfiled && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onNew(key);
              }}
              className="btn-ghost !p-1 !rounded-md text-primary hover:bg-primary/10"
              aria-label="New session in this folder"
              title="Add session to this folder"
            >
              <Plus size={14} />
            </button>
          )}
          {actions}
        </div>
      </div>
    );
  };

  const sidebarContent = (
    <aside className="w-72 max-w-[85vw] shrink-0 h-full flex flex-col border-r border-app surface shadow-xl md:shadow-none">
      <div className="px-4 py-4 border-b border-app">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white shadow-soft">
              <AudioWaveform size={18} />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold">Sonexa</div>
              <div className="text-[10px] text-soft">Audio Workspace</div>
            </div>
          </div>
          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="md:hidden btn-ghost !p-1.5 rounded-lg text-muted hover:text-[var(--text)]"
              aria-label="Close sidebar"
            >
              <X size={17} />
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              onNew(null);
              onCloseMobile?.();
            }}
            className="btn-primary flex-1"
          >
            <Plus size={16} /> New session
          </button>
          <button onClick={openCreateFolder} className="btn-outline !px-2.5" aria-label="New folder" title="New folder">
            <FolderPlus size={15} />
          </button>
        </div>
      </div>

      {canInstallApp && (
        <div className="px-3 py-2 border-b border-app bg-primary/5">
          <button
            onClick={onInstallApp}
            className="btn-primary w-full !py-1.5 text-xs flex items-center justify-center gap-1.5 shadow-sm"
          >
            <Download size={13} />
            <span>Install Desktop App</span>
          </button>
        </div>
      )}

      <div className="px-3 py-2.5 border-b border-app">
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-soft" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search sessions…"
            className="input !pl-8 !py-2 text-sm"
          />
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
              <div className="mb-3">
                {renderFolderHeader('Unfiled Library', unfiled.length, NO_FOLDER)}
                {!collapsed[NO_FOLDER] && (
                  <div className="pl-3.5 ml-4 border-l-2 border-app/60 space-y-1 mb-2 mt-1 animate-fade-in">
                    {unfiled.map(renderSession)}
                  </div>
                )}
              </div>
            )}
            {folderOrder.map((f) => {
              const items = grouped.get(f.id) ?? [];
              return (
                <div key={f.id} className="mb-3">
                  {renderFolderHeader(f.name, items.length, f.id, (
                    <>
                      <button onClick={(e) => { e.stopPropagation(); openRenameFolder(f); }} className="btn-ghost !p-1 !rounded-md" aria-label="Rename folder" title="Rename folder"><Pencil size={12} /></button>
                      <button onClick={(e) => { e.stopPropagation(); onDeleteFolder(f.id); }} className="btn-ghost !p-1 !rounded-md text-red-500 hover:bg-red-500/10" aria-label="Delete folder" title="Delete folder"><Trash2 size={12} /></button>
                    </>
                  ))}
                  {!collapsed[f.id] && (
                    <div className="pl-3.5 ml-4 border-l-2 border-primary/25 dark:border-primary/30 space-y-1 mb-2 mt-1 animate-fade-in">
                      {items.length === 0 ? (
                        <p className="text-[11px] text-muted italic py-1 px-2">No sessions in this folder</p>
                      ) : (
                        items.map(renderSession)
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {folderOrder.length === 0 && unfiled.length === 0 && (
              <p className="text-center text-[11px] text-soft py-6">No matches.</p>
            )}
          </>
        )}
      </div>
      <div className="px-3 py-2 border-t border-app flex items-center justify-between text-[11px] text-soft">
        <span className="flex items-center gap-1.5 text-muted">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span>IndexedDB</span>
        </span>
        {onOpenBackup && (
          <button
            onClick={onOpenBackup}
            className="btn-ghost !py-1 !px-2 text-[11px] text-primary hover:bg-primary/10 rounded flex items-center gap-1"
            title="Export or Import database JSON file"
          >
            <Database size={12} />
            <span>Backup / Transfer</span>
          </button>
        )}
      </div>
    </aside>
  );

  return (
    <>
      {/* Mobile Drawer (visible only on mobile screens when mobileOpen is true) */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity animate-fade-in"
            onClick={onCloseMobile}
          />
          <div className="relative z-10 animate-slide-up h-full">
            {sidebarContent}
          </div>
        </div>
      )}

      {/* Desktop Persistent Sidebar (hidden on mobile, visible on md and up) */}
      <div className="hidden md:flex h-full shrink-0">
        {sidebarContent}
      </div>

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