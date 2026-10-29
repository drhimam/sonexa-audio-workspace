import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Pencil, Check, X, FileText, Search, Download, Copy, Clock } from 'lucide-react';
import type { TranscriptData, TranscriptSegment } from '@/lib/types';
import { formatTimestamp, clsx, uid } from '@/lib/utils';
import {
  copyToClipboard,
  downloadMarkdown,
  downloadPlainText,
  transcriptToMarkdown,
  transcriptToPlainText,
  slug,
} from '@/lib/export';

interface TranscriptViewProps {
  sessionTitle?: string;
  transcript: TranscriptData | null;
  status: SessionStatusLite;
  progressLabel?: string;
  currentSec?: number;
  onSeek?: (sec: number) => void;
  onChange: (t: TranscriptData) => void;
  showTimestamps?: boolean;
  onToggleTimestamps?: () => void;
}

type SessionStatusLite = 'recording' | 'recorded' | 'transcribing' | 'transcribed' | 'enhancing' | 'enhanced' | 'error';

export function TranscriptView({
  sessionTitle,
  transcript,
  status,
  progressLabel,
  currentSec,
  onSeek,
  onChange,
  showTimestamps,
  onToggleTimestamps,
}: TranscriptViewProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState('');
  const [copied, setCopied] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const [localShowTimestamps, setLocalShowTimestamps] = useState<boolean>(() => {
    return localStorage.getItem('sonexa_show_timestamps') !== 'false';
  });
  const activeShowTimestamps = showTimestamps ?? localShowTimestamps;

  const handleToggleTimestamps = () => {
    if (onToggleTimestamps) {
      onToggleTimestamps();
    } else {
      setLocalShowTimestamps((prev) => {
        const next = !prev;
        localStorage.setItem('sonexa_show_timestamps', String(next));
        return next;
      });
    }
  };

  const handleCopy = async () => {
    if (!transcript) return;
    const txt = transcriptToPlainText(transcript, sessionTitle, { includeTimestamps: activeShowTimestamps });
    const ok = await copyToClipboard(txt);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const handleDownloadTxt = () => {
    if (!transcript) return;
    const filename = `${slug(sessionTitle || 'transcript')}-raw.txt`;
    downloadPlainText(filename, transcriptToPlainText(transcript, sessionTitle, { includeTimestamps: activeShowTimestamps }));
  };

  const handleDownloadMd = () => {
    if (!transcript) return;
    const filename = `${slug(sessionTitle || 'transcript')}-raw.md`;
    downloadMarkdown(filename, transcriptToMarkdown(transcript, sessionTitle, { includeTimestamps: activeShowTimestamps }));
  };

  const activeId = useMemo(() => {
    if (!transcript || currentSec == null) return null;
    const seg = transcript.segments.find((s) => currentSec >= s.start && currentSec < s.end);
    return seg?.id ?? null;
  }, [transcript, currentSec]);

  useEffect(() => {
    if (!activeId || !listRef.current) return;
    const el = listRef.current.querySelector(`[data-seg="${activeId}"]`);
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [activeId]);

  const filtered = useMemo(() => {
    if (!transcript) return [];
    if (!query.trim()) return transcript.segments;
    const q = query.toLowerCase();
    return transcript.segments.filter((s) => s.text.toLowerCase().includes(q));
  }, [transcript, query]);

  const startEdit = (s: TranscriptSegment) => { setEditingId(s.id); setDraft(s.text); };
  const cancelEdit = () => { setEditingId(null); setDraft(''); };
  const saveEdit = (id: string) => {
    if (!transcript) return;
    onChange({ ...transcript, segments: transcript.segments.map((s) => (s.id === id ? { ...s, text: draft } : s)) });
    cancelEdit();
  };
  const addSegmentAfter = (id: string) => {
    if (!transcript) return;
    const idx = transcript.segments.findIndex((s) => s.id === id);
    const prev = transcript.segments[idx];
    const next = transcript.segments[idx + 1];
    const start = prev?.end ?? 0;
    const end = next ? (next.start + start) / 2 : start + 2;
    const newSeg: TranscriptSegment = { id: uid('seg-'), start, end, text: '', speaker: prev?.speaker };
    onChange({ ...transcript, segments: [...transcript.segments.slice(0, idx + 1), newSeg, ...transcript.segments.slice(idx + 1)] });
    setEditingId(newSeg.id); setDraft('');
  };

  if (status === 'transcribing') {
    return (
      <div className="card p-10 flex flex-col items-center justify-center text-center">
        <Loader2 size={28} className="animate-spin text-primary mb-3" />
        <p className="text-sm font-medium">Transcribing audio…</p>
        <p className="text-xs text-muted mt-1">{progressLabel ?? 'Working on it'}</p>
      </div>
    );
  }

  if (!transcript || transcript.segments.length === 0) {
    return (
      <div className="card p-10 flex flex-col items-center justify-center text-center">
        <FileText size={28} className="text-soft mb-3" />
        <p className="text-sm font-medium">No transcript yet</p>
        <p className="text-xs text-muted mt-1 max-w-xs">Record or upload audio, then run transcription to see the editable transcript here.</p>
      </div>
    );
  }

  return (
    <div className="card flex flex-col h-full overflow-hidden">
      <div className="px-4 py-2.5 border-b border-app flex items-center gap-2 flex-wrap">
        <FileText size={15} className="text-primary" />
        <h3 className="text-sm font-semibold">Transcript</h3>
        <span className="chip surface-2 text-muted ml-1">{transcript.segments.length} segments</span>

        <div className="ml-auto flex items-center gap-1.5 flex-wrap">
          {/* Timestamps toggle button */}
          <button
            type="button"
            onClick={handleToggleTimestamps}
            className={clsx(
              'btn-ghost !py-1 !px-2.5 text-xs flex items-center gap-1.5 rounded-lg border transition-all',
              activeShowTimestamps
                ? 'border-primary/40 bg-primary/10 text-primary font-medium shadow-xs'
                : 'border-app text-muted hover:text-[var(--text)]'
            )}
            title={activeShowTimestamps ? 'Click to hide time segments' : 'Click to show time segments'}
          >
            <Clock size={13} className={activeShowTimestamps ? 'text-primary' : 'text-muted'} />
            <span className="hidden sm:inline">Timestamps</span>
            <span
              className={clsx(
                'text-[10px] px-1 py-0.2 rounded font-semibold',
                activeShowTimestamps
                  ? 'bg-primary/20 text-primary'
                  : 'bg-black/10 dark:bg-white/10 text-muted'
              )}
            >
              {activeShowTimestamps ? 'ON' : 'OFF'}
            </span>
          </button>

          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-soft" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search transcript…"
              className="input !py-1.5 !pl-8 text-xs w-32 sm:w-40"
            />
          </div>

          <button
            onClick={handleCopy}
            className="btn-ghost !py-1.5 !px-2 text-xs"
            title="Copy plain text transcript"
          >
            {copied ? <Check size={13} className="text-primary" /> : <Copy size={13} />}
            <span className="hidden sm:inline">Copy</span>
          </button>

          <button
            onClick={handleDownloadTxt}
            className="btn-ghost !py-1.5 !px-2 text-xs flex items-center gap-1"
            title="Download Plain Text (.txt)"
          >
            <Download size={13} />
            <span>.txt</span>
          </button>

          <button
            onClick={handleDownloadMd}
            className="btn-ghost !py-1.5 !px-2 text-xs flex items-center gap-1"
            title="Download Markdown (.md)"
          >
            <Download size={13} />
            <span>.md</span>
          </button>
        </div>
      </div>
      <div ref={listRef} className="flex-1 overflow-y-auto scroll-thin px-2 py-2">
        {filtered.map((s) => {
          const editing = editingId === s.id;
          const active = activeId === s.id;
          return (
            <div
              key={s.id}
              data-seg={s.id}
              className={clsx(
                'group rounded-lg px-3 py-2 mb-1 transition-colors',
                active && 'bg-primary/10',
                !active && 'hover:bg-black/[0.03] dark:hover:bg-white/[0.04]',
              )}
            >
              <div className="flex items-center gap-2 mb-1">
                {activeShowTimestamps && (
                  <button
                    onClick={() => onSeek?.(s.start)}
                    className="font-mono text-[11px] tabular-nums text-primary hover:underline flex items-center gap-1"
                    title="Click to seek audio to this timestamp"
                  >
                    <Clock size={11} className="text-primary/70" />
                    <span>{formatTimestamp(s.start)}</span>
                  </button>
                )}
                {s.speaker && <span className="chip surface-2 text-muted !py-0.5">{s.speaker}</span>}
                <div className="ml-auto flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition">
                  {!editing && (
                    <>
                      <button onClick={() => startEdit(s)} className="btn-ghost !px-1.5 !py-1 rounded-md" aria-label="Edit" title="Edit text"><Pencil size={12} /></button>
                      <button onClick={() => addSegmentAfter(s.id)} className="btn-ghost !px-1.5 !py-1 rounded-md" aria-label="Add segment" title="Add segment after">+</button>
                    </>
                  )}
                </div>
              </div>
              {editing ? (
                <div>
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    autoFocus
                    rows={2}
                    className="input text-sm !py-1.5 resize-y"
                  />
                  <div className="flex gap-1.5 mt-1.5">
                    <button onClick={() => saveEdit(s.id)} className="btn-primary !py-1 !px-2 text-xs"><Check size={12} /> Save</button>
                    <button onClick={cancelEdit} className="btn-ghost !py-1 !px-2 text-xs"><X size={12} /> Cancel</button>
                  </div>
                </div>
              ) : (
                <p className="text-sm leading-relaxed text-[var(--text)]">{s.text}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
