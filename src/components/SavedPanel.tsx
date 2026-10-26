import { useEffect, useMemo, useState } from 'react';
import {
  Bookmark, MessageSquare, FileText, Trash2, Copy, Download, Check, Search,
  BookmarkCheck, Maximize2, Minimize2, Pencil, History, RotateCcw, X, Eye,
  Clock, ArrowLeft,
} from 'lucide-react';
import type { SavedItem, SavedItemVersion } from '@/lib/types';
import {
  copyToClipboard,
  downloadMarkdown,
  downloadPlainText,
  exportPdf,
  renderMarkdown,
  slug,
} from '@/lib/export';
import { clsx, formatDate, formatDateLong, uid } from '@/lib/utils';

interface SavedPanelProps {
  items: SavedItem[];
  onDelete: (id: string) => void;
  onUpdateItem?: (item: SavedItem) => void;
}

export function SavedPanel({ items, onDelete, onUpdateItem }: SavedPanelProps) {
  const [activeId, setActiveId] = useState<string | null>(items[0]?.id ?? null);
  const [query, setQuery] = useState('');
  const [copied, setCopied] = useState(false);

  // Focus / Full Screen Mode
  const [focusMode, setFocusMode] = useState(false);

  // Edit State
  const [isEditing, setIsEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftContent, setDraftContent] = useState('');
  const [draftNote, setDraftNote] = useState('');
  const [editTab, setEditTab] = useState<'write' | 'preview'>('write');

  // Version Control State
  const [showVersions, setShowVersions] = useState(false);
  const [viewingVersion, setViewingVersion] = useState<SavedItemVersion | null>(null);

  // Filter & sort
  const filtered = useMemo(() => {
    const sorted = [...items].sort((a, b) => (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt));
    if (!query.trim()) return sorted;
    const q = query.toLowerCase();
    return sorted.filter((i) => i.title.toLowerCase().includes(q) || i.content.toLowerCase().includes(q));
  }, [items, query]);

  const active = filtered.find((i) => i.id === activeId) ?? filtered[0] ?? null;

  // Escape key closes Focus Mode or Version drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showVersions) {
          setShowVersions(false);
        } else if (focusMode) {
          setFocusMode(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focusMode, showVersions]);

  // Reset transient states when switching active item
  const handleSelectActive = (id: string) => {
    if (id === activeId) return;
    setActiveId(id);
    setIsEditing(false);
    setViewingVersion(null);
    setShowVersions(false);
  };

  const currentDisplayContent = viewingVersion ? viewingVersion.content : (isEditing ? draftContent : (active?.content ?? ''));
  const currentDisplayTitle = viewingVersion ? viewingVersion.title : (isEditing ? draftTitle : (active?.title ?? ''));

  const wordCount = useMemo(() => {
    const text = currentDisplayContent.trim();
    return text ? text.split(/\s+/).length : 0;
  }, [currentDisplayContent]);

  const readingTimeMin = Math.max(1, Math.ceil(wordCount / 200));

  const handleCopy = async () => {
    if (!currentDisplayContent) return;
    const ok = await copyToClipboard(currentDisplayContent);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const handleDownloadTxt = () => {
    if (!currentDisplayContent || !active) return;
    const filename = `${slug(currentDisplayTitle || active.title)}.txt`;
    downloadPlainText(filename, currentDisplayContent);
  };

  const handleDownloadMd = () => {
    if (!currentDisplayContent || !active) return;
    const filename = `${slug(currentDisplayTitle || active.title)}.md`;
    downloadMarkdown(filename, currentDisplayContent);
  };

  const handleExportPdf = () => {
    if (!currentDisplayContent || !active) return;
    exportPdf(currentDisplayTitle || active.title, currentDisplayContent);
  };

  // Start Editing
  const startEditing = () => {
    if (!active) return;
    setDraftTitle(active.title);
    setDraftContent(active.content);
    setDraftNote('');
    setEditTab('write');
    setViewingVersion(null);
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setDraftTitle('');
    setDraftContent('');
    setDraftNote('');
  };

  // Save Version
  const handleSaveEdit = () => {
    if (!active) return;
    const nextTitle = draftTitle.trim() || active.title;
    const isChanged = nextTitle !== active.title || draftContent !== active.content;

    if (!isChanged) {
      setIsEditing(false);
      return;
    }

    const existingVersions = active.versions ?? [];
    const versionNum = existingVersions.length + 1;

    // Snapshot the current version before replacing it
    const snapshot: SavedItemVersion = {
      id: uid('ver-'),
      versionNumber: versionNum,
      title: active.title,
      content: active.content,
      timestamp: active.updatedAt ?? active.createdAt,
      note: draftNote.trim() || (existingVersions.length === 0 ? 'Original content snapshot' : `Version ${versionNum}`),
    };

    const updatedItem: SavedItem = {
      ...active,
      title: nextTitle,
      content: draftContent,
      updatedAt: Date.now(),
      versions: [snapshot, ...existingVersions],
    };

    onUpdateItem?.(updatedItem);
    setIsEditing(false);
  };

  // Revert / Restore to a specific version
  const handleRevertVersion = (ver: SavedItemVersion) => {
    if (!active) return;
    const existingVersions = active.versions ?? [];
    const nextVersionNum = existingVersions.length + 1;

    // Snapshot what we currently have before restoring
    const snapshot: SavedItemVersion = {
      id: uid('ver-'),
      versionNumber: nextVersionNum,
      title: active.title,
      content: active.content,
      timestamp: active.updatedAt ?? active.createdAt,
      note: `Before restore to v${ver.versionNumber}`,
    };

    const updatedItem: SavedItem = {
      ...active,
      title: ver.title,
      content: ver.content,
      updatedAt: Date.now(),
      versions: [snapshot, ...existingVersions],
    };

    onUpdateItem?.(updatedItem);
    setViewingVersion(null);
    setShowVersions(false);
    if (isEditing) {
      setDraftTitle(ver.title);
      setDraftContent(ver.content);
    }
  };

  if (items.length === 0) {
    return (
      <div className="card p-10 flex flex-col items-center justify-center text-center">
        <Bookmark size={28} className="text-soft mb-3" />
        <p className="text-sm font-medium">Nothing saved yet</p>
        <p className="text-xs text-muted mt-1 max-w-xs">
          Save chat replies or generated documents by tapping the bookmark button. They'll collect here for focus reading, version-controlled editing, and multi-format exports.
        </p>
      </div>
    );
  }

  // Preview / Editor Controls Header Bar
  const renderHeaderActions = (isFocus: boolean) => (
    <div className="flex items-center gap-1.5 flex-wrap">
      {isEditing ? (
        <>
          <div className="flex rounded-lg border border-app p-0.5 surface-2 mr-1">
            <button
              onClick={() => setEditTab('write')}
              className={clsx(
                'px-2 py-1 text-xs rounded-md transition font-medium',
                editTab === 'write' ? 'bg-primary text-white shadow-xs' : 'text-muted hover:text-[var(--text)]'
              )}
            >
              Write
            </button>
            <button
              onClick={() => setEditTab('preview')}
              className={clsx(
                'px-2 py-1 text-xs rounded-md transition font-medium',
                editTab === 'preview' ? 'bg-primary text-white shadow-xs' : 'text-muted hover:text-[var(--text)]'
              )}
            >
              Live Preview
            </button>
          </div>
          <button
            onClick={handleSaveEdit}
            className="btn-primary !py-1.5 !px-2.5 text-xs flex items-center gap-1"
            title="Save as new version"
          >
            <Check size={13} /> Save Version
          </button>
          <button
            onClick={cancelEditing}
            className="btn-ghost !py-1.5 !px-2 text-xs flex items-center gap-1"
            title="Cancel editing"
          >
            <X size={13} /> Cancel
          </button>
        </>
      ) : (
        <>
          {viewingVersion ? (
            <button
              onClick={() => setViewingVersion(null)}
              className="btn-outline !py-1.5 !px-2.5 text-xs flex items-center gap-1 text-primary"
            >
              <ArrowLeft size={13} /> Return to Current
            </button>
          ) : (
            <button
              onClick={startEditing}
              className="btn-outline !py-1.5 !px-2.5 text-xs flex items-center gap-1"
              title="Edit content with version control"
            >
              <Pencil size={13} /> Edit
            </button>
          )}

          <button
            onClick={() => setShowVersions(!showVersions)}
            className={clsx(
              'btn-ghost !py-1.5 !px-2 text-xs flex items-center gap-1',
              showVersions && 'bg-primary/10 text-primary font-medium'
            )}
            title="View revision history"
          >
            <History size={13} />
            <span>Versions ({(active?.versions?.length ?? 0) + 1})</span>
          </button>

          <button onClick={handleCopy} className="btn-ghost !py-1.5 !px-2 text-xs flex items-center gap-1" title="Copy to clipboard">
            {copied ? <Check size={13} className="text-primary" /> : <Copy size={13} />}
            <span className="hidden sm:inline">Copy</span>
          </button>

          <button onClick={handleDownloadTxt} className="btn-ghost !py-1.5 !px-2 text-xs flex items-center gap-1" title="Download Plain Text (.txt)">
            <Download size={13} /> .txt
          </button>

          <button onClick={handleDownloadMd} className="btn-ghost !py-1.5 !px-2 text-xs flex items-center gap-1" title="Download Markdown (.md)">
            <Download size={13} /> .md
          </button>

          <button onClick={handleExportPdf} className="btn-ghost !py-1.5 !px-2 text-xs flex items-center gap-1" title="Export as PDF">
            <FileText size={13} /> PDF
          </button>

          {isFocus ? (
            <button
              onClick={() => setFocusMode(false)}
              className="btn-outline !py-1.5 !px-2.5 text-xs flex items-center gap-1 ml-1"
              title="Exit focus mode (Esc)"
            >
              <Minimize2 size={13} /> Exit Focus
            </button>
          ) : (
            <button
              onClick={() => setFocusMode(true)}
              className="btn-ghost !py-1.5 !px-2 text-xs flex items-center gap-1 ml-1 text-primary"
              title="Focus Mode / Full screen"
            >
              <Maximize2 size={13} /> <span className="hidden sm:inline">Focus</span>
            </button>
          )}
        </>
      )}
    </div>
  );

  // Versions Sidebar / Overlay Component
  const renderVersionDrawer = () => {
    if (!showVersions || !active) return null;
    const historyList = active.versions ?? [];
    const currentVersionNum = historyList.length + 1;

    return (
      <div className="border-t border-app surface-2 p-3.5 space-y-2.5 animate-fade-in text-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-semibold text-primary">
            <History size={14} /> Version History
          </div>
          <button
            onClick={() => setShowVersions(false)}
            className="btn-ghost !p-1 text-muted hover:text-[var(--text)]"
            title="Close version history"
          >
            <X size={13} />
          </button>
        </div>

        <div className="space-y-1.5 max-h-60 overflow-y-auto scroll-thin pr-1">
          {/* Current Live Version */}
          <div
            className={clsx(
              'p-2.5 rounded-lg border transition flex items-center justify-between gap-2',
              !viewingVersion ? 'border-primary/50 bg-primary/10' : 'border-app surface'
            )}
          >
            <div>
              <div className="flex items-center gap-1.5 font-semibold">
                <span>v{currentVersionNum}</span>
                <span className="chip bg-primary/20 text-primary !py-0 !px-1.5 text-[10px]">Current</span>
              </div>
              <div className="text-[11px] text-muted flex items-center gap-1.5 mt-0.5">
                <Clock size={11} /> {formatDateLong(active.updatedAt ?? active.createdAt)}
              </div>
            </div>
            {viewingVersion && (
              <button
                onClick={() => setViewingVersion(null)}
                className="btn-ghost !py-1 !px-2 text-xs text-primary"
              >
                View
              </button>
            )}
          </div>

          {/* Historical Versions */}
          {historyList.map((ver) => {
            const isSelected = viewingVersion?.id === ver.id;
            return (
              <div
                key={ver.id}
                className={clsx(
                  'p-2.5 rounded-lg border transition flex items-center justify-between gap-2',
                  isSelected ? 'border-amber-500/50 bg-amber-500/10' : 'border-app surface'
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 font-medium truncate">
                    <span>v{ver.versionNumber}</span>
                    {ver.note && <span className="text-soft truncate">— {ver.note}</span>}
                  </div>
                  <div className="text-[11px] text-muted flex items-center gap-1.5 mt-0.5">
                    <Clock size={11} /> {formatDateLong(ver.timestamp)}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => { setViewingVersion(ver); setIsEditing(false); }}
                    className={clsx('btn-ghost !py-1 !px-2 text-xs', isSelected ? 'text-amber-500 font-semibold' : 'text-muted')}
                    title="View historical snapshot"
                  >
                    <Eye size={12} /> View
                  </button>
                  <button
                    onClick={() => handleRevertVersion(ver)}
                    className="btn-outline !py-1 !px-2 text-xs text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
                    title="Restore this version as active content"
                  >
                    <RotateCcw size={12} /> Restore
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Main Editor / Content Body
  const renderEditorOrViewer = (isFocus: boolean) => {
    if (!active) return null;

    if (isEditing) {
      return (
        <div className="space-y-3 flex-1 flex flex-col min-h-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] font-medium text-muted block mb-1">Document Title</label>
              <input
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                placeholder="Title…"
                className="input text-sm !py-1.5 w-full font-medium"
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-muted block mb-1">Version Note (optional)</label>
              <input
                value={draftNote}
                onChange={(e) => setDraftNote(e.target.value)}
                placeholder="e.g. Added section 3, cleaned up summary…"
                className="input text-sm !py-1.5 w-full text-muted"
              />
            </div>
          </div>

          {editTab === 'write' ? (
            <div className="flex-1 flex flex-col min-h-0">
              <textarea
                value={draftContent}
                onChange={(e) => setDraftContent(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Tab') {
                    e.preventDefault();
                    const start = e.currentTarget.selectionStart;
                    const end = e.currentTarget.selectionEnd;
                    const val = e.currentTarget.value;
                    setDraftContent(val.substring(0, start) + '  ' + val.substring(end));
                    setTimeout(() => {
                      if (e.target instanceof HTMLTextAreaElement) {
                        e.target.selectionStart = e.target.selectionEnd = start + 2;
                      }
                    }, 0);
                  }
                }}
                rows={isFocus ? 24 : 14}
                className="input font-mono text-xs sm:text-sm !py-2.5 resize-y flex-1 w-full leading-relaxed"
                placeholder="Write Markdown content here…"
              />
              <div className="flex items-center justify-between text-[11px] text-muted mt-1.5">
                <span>Markdown supported (headings, lists, bold, tables, blockquotes)</span>
                <span>{wordCount} words · Tab key inserts 2 spaces</span>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto scroll-thin border border-app rounded-lg p-4 surface-2">
              <div className="prose-doc" dangerouslySetInnerHTML={{ __html: renderMarkdown(draftContent) }} />
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {/* Version snapshot warning banner */}
        {viewingVersion && (
          <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs animate-fade-in">
            <div className="flex items-center gap-2">
              <Eye size={15} className="shrink-0" />
              <span>
                Viewing historical <strong>Version {viewingVersion.versionNumber}</strong> ({formatDateLong(viewingVersion.timestamp)})
                {viewingVersion.note ? ` — "${viewingVersion.note}"` : ''}
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => handleRevertVersion(viewingVersion)}
                className="btn-primary !py-1 !px-2.5 text-xs bg-amber-600 hover:bg-amber-700 text-white flex items-center gap-1"
              >
                <RotateCcw size={12} /> Restore This Version
              </button>
              <button
                onClick={() => setViewingVersion(null)}
                className="btn-ghost !py-1 !px-2 text-xs"
              >
                Exit
              </button>
            </div>
          </div>
        )}

        {/* Metadata pills */}
        <div className="text-[11px] text-soft flex items-center gap-2 flex-wrap">
          <span>{formatDate(active.updatedAt ?? active.createdAt)}</span>
          {active.sourceLabel && <span className="chip surface-2 !py-0.5">{active.sourceLabel}</span>}
          <span className="chip surface-2 !py-0.5">{wordCount} words</span>
          <span className="chip surface-2 !py-0.5">{readingTimeMin} min read</span>
          {(active.versions?.length ?? 0) > 0 && (
            <span className="chip bg-primary/10 text-primary !py-0.5">
              v{(active.versions?.length ?? 0) + 1}
            </span>
          )}
        </div>

        {/* Formatted Markdown viewer */}
        <div className="prose-doc leading-relaxed" dangerouslySetInnerHTML={{ __html: renderMarkdown(currentDisplayContent) }} />
      </div>
    );
  };

  return (
    <>
      {/* 1. Normal Layout (List + Preview) */}
      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4 h-full">
        {/* List */}
        <div className="card flex flex-col overflow-hidden">
          <div className="px-4 py-2.5 border-b border-app flex items-center gap-2">
            <Bookmark size={15} className="text-primary" />
            <h3 className="text-sm font-semibold">Saved content</h3>
            <span className="chip surface-2 text-muted ml-1">{items.length}</span>
          </div>
          <div className="px-3 py-2 border-b border-app">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-soft" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search saved…"
                className="input !pl-8 !py-2 text-sm"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto scroll-thin px-2 py-2">
            {filtered.map((it) => {
              const Icon = it.kind === 'chat' ? MessageSquare : FileText;
              const isActive = active?.id === it.id;
              const verCount = (it.versions?.length ?? 0) + 1;
              return (
                <div
                  key={it.id}
                  onClick={() => handleSelectActive(it.id)}
                  className={clsx(
                    'group rounded-lg px-3 py-2.5 mb-1 cursor-pointer transition-colors',
                    isActive ? 'bg-primary/10' : 'hover:bg-black/[0.03] dark:hover:bg-white/[0.04]',
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Icon size={14} className="text-primary" />
                    <p className={clsx('text-sm font-medium truncate flex-1', isActive ? 'text-primary' : 'text-[var(--text)]')}>
                      {it.title}
                    </p>
                    <button
                      onClick={(e) => { e.stopPropagation(); onDelete(it.id); }}
                      className="btn-ghost !p-1 !rounded-md opacity-0 group-hover:opacity-100 text-red-500 hover:bg-red-500/10"
                      aria-label="Remove from saved"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1 text-[11px] text-muted">
                    <span className="chip surface-2 !py-0.5">{it.kind === 'chat' ? 'Chat' : 'Document'}</span>
                    {verCount > 1 && <span className="chip bg-primary/10 text-primary !py-0.5">v{verCount}</span>}
                    {it.sourceLabel && <span className="text-soft truncate max-w-[110px]">{it.sourceLabel}</span>}
                    <span className="ml-auto text-[10px]">{formatDate(it.updatedAt ?? it.createdAt)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Preview / Editor */}
        <div className="card flex flex-col overflow-hidden">
          {active && (
            <>
              <div className="px-4 py-2.5 border-b border-app flex items-center gap-2 flex-wrap justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <BookmarkCheck size={15} className="text-primary shrink-0" />
                  <h3 className="text-sm font-semibold truncate max-w-[220px] sm:max-w-md">
                    {currentDisplayTitle}
                  </h3>
                  <span className="chip surface-2 text-muted hidden sm:inline-flex">
                    {active.kind === 'chat' ? 'Chat reply' : 'Document'}
                  </span>
                </div>
                {renderHeaderActions(false)}
              </div>

              {renderVersionDrawer()}

              <div className="flex-1 overflow-y-auto scroll-thin px-5 py-4 flex flex-col">
                {renderEditorOrViewer(false)}
              </div>
            </>
          )}
        </div>
      </div>

      {/* 2. Focus Mode / Full Screen Modal Overlay */}
      {focusMode && active && (
        <div className="fixed inset-0 z-50 bg-[var(--bg)] text-[var(--text)] flex flex-col overflow-hidden animate-fade-in">
          {/* Focus Mode Top Navigation Bar */}
          <div className="px-6 py-3 border-b border-app surface flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <BookmarkCheck size={17} />
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-semibold truncate max-w-xl">
                  {currentDisplayTitle}
                </h2>
                <div className="flex items-center gap-2 text-xs text-muted">
                  <span>Focus Mode</span>
                  <span>·</span>
                  <span>{wordCount} words</span>
                  <span>·</span>
                  <span>{readingTimeMin} min read</span>
                </div>
              </div>
            </div>

            {renderHeaderActions(true)}
          </div>

          {renderVersionDrawer()}

          {/* Focus Mode Content Area */}
          <div className="flex-1 overflow-y-auto scroll-thin py-8 px-4 sm:px-8">
            <div className="max-w-4xl mx-auto w-full">
              {renderEditorOrViewer(true)}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
