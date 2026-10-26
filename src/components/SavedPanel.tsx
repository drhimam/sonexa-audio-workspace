import { useMemo, useState } from 'react';
import {
  Bookmark, MessageSquare, FileText, Trash2, Copy, Download, Check, Search, BookmarkCheck,
} from 'lucide-react';
import type { SavedItem } from '@/lib/types';
import { copyToClipboard, downloadMarkdown, exportPdf, renderMarkdown } from '@/lib/export';
import { clsx, formatDate } from '@/lib/utils';

interface SavedPanelProps {
  items: SavedItem[];
  onDelete: (id: string) => void;
}

export function SavedPanel({ items, onDelete }: SavedPanelProps) {
  const [activeId, setActiveId] = useState<string | null>(items[0]?.id ?? null);
  const [query, setQuery] = useState('');
  const [copied, setCopied] = useState(false);

  const filtered = useMemo(() => {
    const sorted = [...items].sort((a, b) => b.createdAt - a.createdAt);
    if (!query.trim()) return sorted;
    const q = query.toLowerCase();
    return sorted.filter((i) => i.title.toLowerCase().includes(q) || i.content.toLowerCase().includes(q));
  }, [items, query]);

  const active = filtered.find((i) => i.id === activeId) ?? filtered[0] ?? null;

  const handleCopy = async () => {
    if (!active) return;
    const ok = await copyToClipboard(active.content);
    if (ok) { setCopied(true); setTimeout(() => setCopied(false), 1500); }
  };

  if (items.length === 0) {
    return (
      <div className="card p-10 flex flex-col items-center justify-center text-center">
        <Bookmark size={28} className="text-soft mb-3" />
        <p className="text-sm font-medium">Nothing saved yet</p>
        <p className="text-xs text-muted mt-1 max-w-xs">Save chat replies or generated documents by tapping the bookmark button. They'll all collect here for quick reference and export.</p>
      </div>
    );
  }

  return (
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
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search saved…" className="input !pl-8 !py-2 text-sm" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto scroll-thin px-2 py-2">
          {filtered.map((it) => {
            const Icon = it.kind === 'chat' ? MessageSquare : FileText;
            const isActive = active?.id === it.id;
            return (
              <div
                key={it.id}
                onClick={() => setActiveId(it.id)}
                className={clsx(
                  'group rounded-lg px-3 py-2.5 mb-1 cursor-pointer transition-colors',
                  isActive ? 'bg-primary/10' : 'hover:bg-black/[0.03] dark:hover:bg-white/[0.04]',
                )}
              >
                <div className="flex items-center gap-2">
                  <Icon size={14} className={it.kind === 'chat' ? 'text-primary' : 'text-primary'} />
                  <p className={clsx('text-sm font-medium truncate flex-1', isActive ? 'text-primary' : 'text-[var(--text)]')}>{it.title}</p>
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
                  {it.sourceLabel && <span className="text-soft truncate">{it.sourceLabel}</span>}
                  <span className="ml-auto text-[10px]">{formatDate(it.createdAt)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Preview */}
      <div className="card flex flex-col overflow-hidden">
        {active && (
          <>
            <div className="px-4 py-2.5 border-b border-app flex items-center gap-2 flex-wrap">
              <BookmarkCheck size={15} className="text-primary" />
              <h3 className="text-sm font-semibold truncate">{active.title}</h3>
              <span className="chip surface-2 text-muted">{active.kind === 'chat' ? 'Chat reply' : 'Document'}</span>
              <div className="ml-auto flex items-center gap-1">
                <button onClick={handleCopy} className="btn-ghost !py-1.5 !px-2 text-xs">
                  {copied ? <Check size={13} className="text-primary" /> : <Copy size={13} />} Copy
                </button>
                <button onClick={() => downloadMarkdown(`${active.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.md`, active.content)} className="btn-ghost !py-1.5 !px-2 text-xs">
                  <Download size={13} /> .md
                </button>
                <button onClick={() => exportPdf(active.title, active.content)} className="btn-ghost !py-1.5 !px-2 text-xs">
                  <FileText size={13} /> PDF
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto scroll-thin px-5 py-4">
              <div className="text-[11px] text-soft mb-3 flex items-center gap-2">
                <span>{formatDate(active.createdAt)}</span>
                {active.sourceLabel && <span className="chip surface-2 !py-0.5">{active.sourceLabel}</span>}
              </div>
              <div className="prose-doc" dangerouslySetInnerHTML={{ __html: renderMarkdown(active.content) }} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
