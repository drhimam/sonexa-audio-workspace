import { useEffect, useState } from 'react';
import { Mic, Pause, Play, Square, Trash2, Loader2, AlertCircle, Check } from 'lucide-react';
import { useRecorder } from '@/lib/useRecorder';
import { Waveform } from './Waveform';
import { formatTime, clsx } from '@/lib/utils';

interface RecorderPanelProps {
  onSave: (blob: Blob, durationSec: number) => Promise<void>;
}

export function RecorderPanel({ onSave }: RecorderPanelProps) {
  const r = useRecorder();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const isRecording = r.state === 'recording' || r.state === 'paused';

  useEffect(() => {
    if (r.state === 'idle') setSaved(false);
  }, [r.state]);

  const handleStop = async () => {
    const result = await r.stop();
    if (!result) return;
    setSaving(true);
    try {
      await onSave(result.blob, result.durationSec);
      setSaved(true);
      setTimeout(() => setSaved(false), 2200);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Mic size={16} className="text-primary" />
          <h3 className="text-sm font-semibold">Recorder</h3>
        </div>
        <div className="flex items-center gap-2">
          {isRecording && (
            <span className={clsx('chip', r.state === 'recording' ? 'bg-red-500/10 text-red-500' : 'bg-amber-500/10 text-amber-600')}>
              <span className={clsx('w-1.5 h-1.5 rounded-full', r.state === 'recording' ? 'bg-red-500 animate-pulse-soft' : 'bg-amber-500')} />
              {r.state === 'recording' ? 'Recording' : 'Paused'}
            </span>
          )}
          <span className="font-mono text-sm tabular-nums text-muted">{formatTime(r.elapsedSec)}</span>
        </div>
      </div>

      <Waveform levels={r.levels} active={r.state === 'recording'} />

      {r.error && (
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 px-3 py-2 text-xs">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span>{r.error}. Grant microphone access in your browser and try again.</span>
        </div>
      )}

      <div className="mt-4 flex items-center justify-center gap-2">
        {r.state === 'idle' && (
          <button onClick={r.start} className="btn-primary">
            <Mic size={16} /> Start recording
          </button>
        )}
        {r.state === 'recording' && (
          <>
            <button onClick={r.pause} className="btn-outline">
              <Pause size={16} /> Pause
            </button>
            <button onClick={handleStop} className="btn-primary" disabled={saving}>
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Square size={16} />}
              {saving ? 'Saving…' : 'Stop & save'}
            </button>
            <button onClick={r.discard} className="btn-ghost text-red-500 hover:bg-red-500/10">
              <Trash2 size={16} /> Discard
            </button>
          </>
        )}
        {r.state === 'paused' && (
          <>
            <button onClick={r.resume} className="btn-primary">
              <Play size={16} /> Resume
            </button>
            <button onClick={handleStop} className="btn-outline" disabled={saving}>
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Square size={16} />}
              {saving ? 'Saving…' : 'Stop & save'}
            </button>
            <button onClick={r.discard} className="btn-ghost text-red-500 hover:bg-red-500/10">
              <Trash2 size={16} /> Discard
            </button>
          </>
        )}
        {saving && r.state === 'idle' && (
          <span className="text-xs text-muted flex items-center gap-1.5"><Loader2 size={14} className="animate-spin" /> Saving audio…</span>
        )}
        {saved && r.state === 'idle' && (
          <span className="text-xs text-primary flex items-center gap-1.5 animate-fade-in"><Check size={14} /> Saved to library</span>
        )}
      </div>
    </div>
  );
}
