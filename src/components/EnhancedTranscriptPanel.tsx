import { useMemo, useState } from 'react';
import {
  Wand2, Loader2, FileText, Sparkles, Tag, RefreshCw, AlertCircle, Check, Copy,
} from 'lucide-react';
import type { EnhancedTranscript, TranscriptData } from '@/lib/types';
import { formatTimestamp } from '@/lib/utils';
import { copyToClipboard } from '@/lib/export';

interface EnhancedTranscriptPanelProps {
  raw: TranscriptData | null;
  enhanced: EnhancedTranscript | null;
  enhancing: boolean;
  error: string | null;
  onGenerate: () => void;
  onRegenerate: () => void;
}

export function EnhancedTranscriptPanel({
  raw, enhanced, enhancing, error, onGenerate, onRegenerate,
}: EnhancedTranscriptPanelProps) {
  const [copied, setCopied] = useState(false);
  const hasRaw = !!raw && raw.segments.length > 0;

  const fullText = useMemo(() => {
    if (!enhanced) return '';
    return enhanced.segments
      .map((s) => `[${formatTimestamp(s.start)}] ${s.speaker ? `${s.speaker}: ` : ''}${s.text}`)
      .join('\n');
  }, [enhanced]);

  const handleCopy = async () => {
    const ok = await copyToClipboard(fullText);
    if (ok) { setCopied(true); setTimeout(() => setCopied(false), 1500); }
  };

  if (!hasRaw) {
    return (
      <div className="card p-10 flex flex-col items-center justify-center text-center">
        <FileText size={28} className="text-soft mb-3" />
        <p className="text-sm font-medium">No raw transcript yet</p>
        <p className="text-xs text-muted mt-1 max-w-xs">Transcribe your audio first, then enhance it here to clean up filler words, fix punctuation, and structure the conversation.</p>
      </div>
    );
  }

  if (enhancing) {
    return (
      <div className="card p-10 flex flex-col items-center justify-center text-center">
        <Loader2 size={28} className="animate-spin text-primary mb-3" />
        <p className="text-sm font-medium">Enhancing transcript…</p>
        <p className="text-xs text-muted mt-1 max-w-xs">Cleaning filler words, fixing punctuation, merging fragments, and detecting topics.</p>
      </div>
    );
  }

  if (!enhanced) {
    return (
      <div className="card p-8 flex flex-col items-center justify-center text-center">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
          <Sparkles size={22} className="text-primary" />
        </div>
        <h3 className="text-sm font-semibold">Enhance this transcript</h3>
        <p className="text-xs text-muted mt-2 max-w-sm">
          The raw transcript is cleaned by an LLM: filler words and stutters removed, punctuation fixed, fragments merged into readable sentences, plus a short summary and topic tags.
        </p>
        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 px-3 py-2 text-xs">
            <AlertCircle size={14} /> {error}
          </div>
        )}
        <button onClick={onGenerate} className="btn-primary mt-4">
          <Wand2 size={15} /> Enhance transcript
        </button>
      </div>
    );
  }

  return (
    <div className="card flex flex-col h-full overflow-hidden">
      <div className="px-4 py-2.5 border-b border-app flex items-center gap-2 flex-wrap">
        <Sparkles size={15} className="text-primary" />
        <h3 className="text-sm font-semibold">Enhanced transcript</h3>
        <span className="chip surface-2 text-muted ml-1">{enhanced.segments.length} segments</span>
        <div className="ml-auto flex items-center gap-1">
          <button onClick={handleCopy} className="btn-ghost !py-1.5 !px-2 text-xs">
            {copied ? <Check size={13} className="text-primary" /> : <Copy size={13} />} Copy
          </button>
          <button onClick={onRegenerate} disabled={enhancing} className="btn-ghost !py-1.5 !px-2 text-xs">
            <RefreshCw size={13} /> Regenerate
          </button>
        </div>
      </div>

      {(enhanced.summary || (enhanced.topics && enhanced.topics.length > 0)) && (
        <div className="px-4 py-3 border-b border-app surface-2 space-y-2.5">
          {enhanced.summary && (
            <div>
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted mb-1">
                <FileText size={11} /> Summary
              </div>
              <p className="text-sm leading-relaxed text-[var(--text)]">{enhanced.summary}</p>
            </div>
          )}
          {enhanced.topics && enhanced.topics.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <Tag size={11} className="text-muted" />
              {enhanced.topics.map((t, i) => (
                <span key={i} className="chip bg-primary/10 text-primary">{t}</span>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto scroll-thin px-2 py-2">
        {enhanced.segments.map((s) => (
          <div key={s.id} className="rounded-lg px-3 py-2 mb-1 hover:bg-black/[0.03] dark:hover:bg-white/[0.04] transition-colors">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-[11px] tabular-nums text-primary">{formatTimestamp(s.start)}</span>
              {s.speaker && <span className="chip surface-2 text-muted !py-0.5">{s.speaker}</span>}
            </div>
            <p className="text-sm leading-relaxed text-[var(--text)]">{s.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
