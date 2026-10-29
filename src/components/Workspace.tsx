import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Loader2, Wand2, AlertCircle, MessageSquare, FileText, Sparkles, Clock,
  Pencil, Check, X, Sparkle, Bookmark,
  type LucideIcon,
} from 'lucide-react';
import type { SavedItem, Session, TranscriptData, ProviderSettings } from '@/lib/types';
import { transcribeAudio, enhanceTranscript } from '@/lib/ai';
import { getAudioBlob, updateSession, saveAudioBlob } from '@/lib/db';
import { clsx, formatTime } from '@/lib/utils';
import { AudioBar } from './AudioBar';
import { TranscriptView } from './TranscriptView';
import { ChatPanel } from './ChatPanel';
import { StructuredPanel } from './StructuredPanel';
import { SavedPanel } from './SavedPanel';
import { RecorderPanel } from './RecorderPanel';
import { UploadDropzone } from './UploadDropzone';
import { EnhancedTranscriptPanel } from './EnhancedTranscriptPanel';
import { downloadBlob } from '@/lib/export';

interface WorkspaceProps {
  session: Session;
  settings: ProviderSettings;
  onSessionChange: (s: Session) => void;
}

type Tab = 'transcript' | 'enhanced' | 'chat' | 'structured' | 'saved';

const TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: 'transcript', label: 'Raw Transcript', icon: FileText },
  { id: 'enhanced', label: 'Enhanced', icon: Sparkle },
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'structured', label: 'Structured Content', icon: Sparkles },
  { id: 'saved', label: 'Saved content', icon: Bookmark },
];

// Estimate duration of an uploaded audio/video file so the UI shows a sane
// number even before the element is loaded for playback.
async function estimateMediaDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    try {
      const url = URL.createObjectURL(file);
      const el = document.createElement(file.type.startsWith('video') ? 'video' : 'audio');
      el.preload = 'metadata';
      el.onloadedmetadata = () => {
        const d = isFinite(el.duration) ? el.duration : 0;
        URL.revokeObjectURL(url);
        resolve(d > 0 ? Math.round(d) : 0);
      };
      el.onerror = () => { URL.revokeObjectURL(url); resolve(0); };
      el.src = url;
    } catch { resolve(0); }
  });
}

export function Workspace({ session, settings, onSessionChange }: WorkspaceProps) {
  const [tab, setTab] = useState<Tab>('transcript');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioLoading, setAudioLoading] = useState(false);
  const [transcribeProgress, setTranscribeProgress] = useState<{ ratio: number; label: string } | null>(null);
  const [transcribeError, setTranscribeError] = useState<string | null>(null);
  const [enhanceError, setEnhanceError] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(session.title);
  const [showTimestamps, setShowTimestamps] = useState<boolean>(() => {
    return localStorage.getItem('sonexa_show_timestamps') !== 'false';
  });

  const handleToggleTimestamps = () => {
    setShowTimestamps((prev) => {
      const next = !prev;
      localStorage.setItem('sonexa_show_timestamps', String(next));
      return next;
    });
  };

  const abortTranscribe = useRef<AbortController | null>(null);
  const abortEnhance = useRef<AbortController | null>(null);

  useEffect(() => { setTitleDraft(session.title); }, [session.title]);

  // Load audio blob into an object URL whenever the session changes.
  useEffect(() => {
    let url: string | null = null;
    let revoked = false;
    setAudioLoading(Boolean(session.audioBlobKey));
    setAudioUrl(null);
    if (!session.audioBlobKey) { setAudioLoading(false); return; }
    getAudioBlob(session.audioBlobKey).then((blob) => {
      if (revoked || !blob) { setAudioLoading(false); return; }
      url = URL.createObjectURL(blob);
      setAudioUrl(url);
      setAudioLoading(false);
    });
    return () => { revoked = true; if (url) URL.revokeObjectURL(url); };
  }, [session.id, session.audioBlobKey]);

  const patch = useCallback((p: Partial<Session>) => {
    const next = { ...session, ...p, updatedAt: Date.now() };
    onSessionChange(next);
    updateSession(session.id, p);
  }, [session, onSessionChange]);

  const handleSaveRecording = async (blob: Blob, durationSec: number) => {
    const blobKey = session.audioBlobKey ?? session.id;
    await saveAudioBlob(blobKey, blob);
    patch({ audioBlobKey: blobKey, durationSec, status: 'recorded', source: 'recording' });
  };

  const handleUpload = async (file: File) => {
    const blobKey = session.audioBlobKey ?? session.id;
    await saveAudioBlob(blobKey, file);
    const durationSec = await estimateMediaDuration(file);
    patch({
      audioBlobKey: blobKey,
      durationSec,
      status: 'recorded',
      source: 'upload',
      fileName: file.name,
      mimeType: file.type || undefined,
    });
  };

  const runTranscription = async () => {
    if (!session.audioBlobKey) return;
    setTranscribeError(null);
    patch({ status: 'transcribing' });
    const ac = new AbortController();
    abortTranscribe.current = ac;
    try {
      const blob = await getAudioBlob(session.audioBlobKey);
      if (!blob) throw new Error('Audio missing');
      const transcript = await transcribeAudio(settings, {
        audio: blob,
        onProgress: (ratio, label) => setTranscribeProgress({ ratio, label }),
        signal: ac.signal,
      });
      patch({ transcript, transcriptProvider: transcript.provider, status: 'transcribed' });
      setTab('transcript');
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        patch({ status: session.transcript ? 'transcribed' : 'recorded' });
      } else {
        setTranscribeError('Transcription failed. Check your API key in Settings.');
        patch({ status: 'error', errorMessage: 'Transcription failed' });
      }
    } finally {
      setTranscribeProgress(null);
      abortTranscribe.current = null;
    }
  };

  const cancelTranscription = () => abortTranscribe.current?.abort();

  const runEnhance = async () => {
    if (!session.transcript) return;
    setEnhanceError(null);
    patch({ status: 'enhancing' });
    setTab('enhanced');
    const ac = new AbortController();
    abortEnhance.current = ac;
    try {
      const enhanced = await enhanceTranscript(settings, session.transcript, { signal: ac.signal });
      patch({ enhancedTranscript: enhanced, status: 'enhanced' });
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        patch({ status: session.transcript ? 'transcribed' : 'recorded' });
      } else {
        setEnhanceError('Enhancement failed. Check your API key in Settings.');
        patch({ status: 'error', errorMessage: 'Enhancement failed' });
      }
    } finally {
      abortEnhance.current = null;
    }
  };

  const cancelEnhance = () => abortEnhance.current?.abort();

  const saveTitle = () => {
    const t = titleDraft.trim() || 'Untitled session';
    patch({ title: t });
    setEditingTitle(false);
  };

  const downloadAudio = async () => {
    if (!session.audioBlobKey) return;
    const blob = await getAudioBlob(session.audioBlobKey);
    if (blob) {
      const ext = session.fileName?.split('.').pop() || 'webm';
      downloadBlob(`${session.title.replace(/\s+/g, '-').toLowerCase()}.${ext}`, blob);
    }
  };

  const updateTranscript = (t: TranscriptData) => patch({ transcript: t });

  // ---- Saved items ------------------------------------------------------

  const savedItems = useMemo(() => session.savedItems ?? [], [session.savedItems]);
  const savedIds = useMemo(() => new Set(savedItems.map((i) => i.id)), [savedItems]);

  const addSavedItem = (item: SavedItem) => {
    if (savedIds.has(item.id)) return;
    patch({ savedItems: [item, ...savedItems] });
    setTab('saved');
  };
  const removeSavedItem = (id: string) => {
    patch({ savedItems: savedItems.filter((i) => i.id !== id) });
  };
  const updateSavedItem = (updated: SavedItem) => {
    patch({
      savedItems: savedItems.map((i) => (i.id === updated.id ? updated : i)),
    });
  };

  const tabBadges: Partial<Record<Tab, number>> = {
    chat: session.chat.length,
    structured: session.documents.length,
    saved: savedItems.length,
  };

  const isTranscribing = session.status === 'transcribing';
  const isEnhancing = session.status === 'enhancing';

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-4 pb-3 border-b border-app">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0 flex-1">
            {editingTitle ? (
              <div className="flex items-center gap-1.5">
                <input
                  autoFocus
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') { setEditingTitle(false); setTitleDraft(session.title); } }}
                  className="input !py-1 text-lg font-semibold max-w-md"
                />
                <button onClick={saveTitle} className="btn-primary !px-2 !py-1.5"><Check size={14} /></button>
                <button onClick={() => { setEditingTitle(false); setTitleDraft(session.title); }} className="btn-ghost !px-2 !py-1.5"><X size={14} /></button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-semibold truncate">{session.title}</h1>
                <button onClick={() => setEditingTitle(true)} className="btn-ghost !p-1 !rounded-md opacity-60 hover:opacity-100"><Pencil size={13} /></button>
              </div>
            )}
            <div className="flex items-center gap-3 mt-1 text-xs text-muted flex-wrap">
              <span className="flex items-center gap-1"><Clock size={12} /> {formatTime(session.durationSec ?? 0)}</span>
              {session.transcriptProvider && <span className="chip surface-2 capitalize">{session.transcriptProvider}</span>}
              {session.transcript && <span>{session.transcript.segments.length} segments</span>}
              {session.source === 'upload' && session.fileName && <span className="chip surface-2 truncate max-w-[200px]">upload · {session.fileName}</span>}
              {isTranscribing && (
                <span className="flex items-center gap-1 text-amber-500"><Loader2 size={12} className="animate-spin" /> Transcribing… {Math.round((transcribeProgress?.ratio ?? 0) * 100)}%</span>
              )}
              {isEnhancing && <span className="flex items-center gap-1 text-amber-500"><Loader2 size={12} className="animate-spin" /> Enhancing…</span>}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isTranscribing ? (
              <button onClick={cancelTranscription} className="btn-outline"><X size={15} /> Cancel</button>
            ) : isEnhancing ? (
              <button onClick={cancelEnhance} className="btn-outline"><X size={15} /> Cancel</button>
            ) : (
              <>
                {session.transcript && (
                  <button onClick={runEnhance} className="btn-outline">
                    <Sparkle size={15} /> {session.enhancedTranscript ? 'Re-enhance' : 'Enhance'}
                  </button>
                )}
                <button onClick={runTranscription} disabled={!session.audioBlobKey} className="btn-primary">
                  <Wand2 size={15} /> {session.transcript ? 'Re-transcribe' : 'Transcribe'}
                </button>
              </>
            )}
          </div>
        </div>

        {transcribeError && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 px-3 py-2 text-xs">
            <AlertCircle size={14} /> {transcribeError}
          </div>
        )}
        {enhanceError && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 px-3 py-2 text-xs">
            <AlertCircle size={14} /> {enhanceError}
          </div>
        )}

        <div className="mt-3 space-y-3">
          {session.audioBlobKey && (
            <AudioBar audioUrl={audioUrl} loading={audioLoading} onDownload={downloadAudio} />
          )}
          {!session.audioBlobKey && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="card border-dashed">
                <RecorderPanel onSave={handleSaveRecording} />
              </div>
              <UploadDropzone onUpload={handleUpload} />
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mt-3 -mb-3 overflow-x-auto scroll-thin">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            const badge = tabBadges[t.id];
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={clsx(
                  'flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap',
                  active ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-[var(--text)]',
                )}
              >
                <Icon size={15} /> {t.label}
                {badge ? <span className="chip surface-2 text-soft !py-0 !px-1.5 ml-1">{badge}</span> : null}
              </button>
            );
          })}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-hidden p-4">
        {tab === 'transcript' && (
          <TranscriptView
            sessionTitle={session.title}
            transcript={session.transcript ?? null}
            status={session.status}
            progressLabel={transcribeProgress?.label}
            onChange={updateTranscript}
            showTimestamps={showTimestamps}
            onToggleTimestamps={handleToggleTimestamps}
          />
        )}
        {tab === 'enhanced' && (
          <EnhancedTranscriptPanel
            sessionTitle={session.title}
            raw={session.transcript ?? null}
            enhanced={session.enhancedTranscript ?? null}
            enhancing={isEnhancing}
            error={enhanceError}
            onGenerate={runEnhance}
            onRegenerate={runEnhance}
            showTimestamps={showTimestamps}
            onToggleTimestamps={handleToggleTimestamps}
          />
        )}
        {tab === 'chat' && (
          <ChatPanel
            transcript={session.transcript ?? null}
            messages={session.chat}
            settings={settings}
            onMessages={(chat) => patch({ chat })}
            onSaveItem={addSavedItem}
            savedIds={savedIds}
          />
        )}
        {tab === 'structured' && (
          <StructuredPanel
            transcript={session.transcript ?? null}
            documents={session.documents}
            settings={settings}
            onDocuments={(documents) => patch({ documents })}
            onSaveItem={addSavedItem}
            savedIds={savedIds}
          />
        )}
        {tab === 'saved' && (
          <SavedPanel
            items={savedItems}
            onDelete={removeSavedItem}
            onUpdateItem={updateSavedItem}
          />
        )}
      </div>
    </div>
  );
}
