import { useEffect, useState } from 'react';
import {
  Mic, Pause, Play, Square, Trash2, Loader2, AlertCircle, Check,
  Monitor, Users, Info,
} from 'lucide-react';
import { useRecorder, type AudioSourceMode } from '@/lib/useRecorder';
import { Waveform } from './Waveform';
import { formatTime, clsx } from '@/lib/utils';

interface RecorderPanelProps {
  onSave: (blob: Blob, durationSec: number) => Promise<void>;
}

export function RecorderPanel({ onSave }: RecorderPanelProps) {
  const r = useRecorder('meeting');
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

  const sources: { id: AudioSourceMode; label: string; icon: typeof Mic; desc: string }[] = [
    {
      id: 'meeting',
      label: 'Meeting Mode',
      icon: Users,
      desc: 'Dual capture: records your Mic + Zoom/Teams/Meet callers mixed.',
    },
    {
      id: 'mic',
      label: 'Mic Only',
      icon: Mic,
      desc: 'Record your voice or in-person conversation.',
    },
    {
      id: 'system',
      label: 'System Audio',
      icon: Monitor,
      desc: 'Record computer audio (YouTube, video/audio playing, podcasts).',
    },
  ];

  return (
    <div className="card p-4 sm:p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {r.audioSource === 'meeting' ? (
            <Users size={16} className="text-primary" />
          ) : r.audioSource === 'system' ? (
            <Monitor size={16} className="text-primary" />
          ) : (
            <Mic size={16} className="text-primary" />
          )}
          <h3 className="text-sm font-semibold">Audio Recorder</h3>
        </div>
        <div className="flex items-center gap-2">
          {isRecording && (
            <span
              className={clsx(
                'chip',
                r.state === 'recording'
                  ? 'bg-red-500/10 text-red-500'
                  : 'bg-amber-500/10 text-amber-600'
              )}
            >
              <span
                className={clsx(
                  'w-1.5 h-1.5 rounded-full',
                  r.state === 'recording' ? 'bg-red-500 animate-pulse-soft' : 'bg-amber-500'
                )}
              />
              {r.state === 'recording' ? 'Recording' : 'Paused'}
            </span>
          )}
          <span className="font-mono text-sm tabular-nums text-muted">{formatTime(r.elapsedSec)}</span>
        </div>
      </div>

      {/* Audio Source Selector (only selectable when idle) */}
      {!isRecording && (
        <div className="mb-3.5 space-y-1.5">
          <div className="text-[11px] font-medium text-muted">Audio Source:</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
            {sources.map((s) => {
              const Icon = s.icon;
              const active = r.audioSource === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => r.setAudioSource(s.id)}
                  className={clsx(
                    'p-2 rounded-lg border text-left transition flex items-center sm:flex-col sm:items-start gap-2 sm:gap-1',
                    active
                      ? 'border-primary bg-primary/10 text-primary font-semibold'
                      : 'border-app text-muted hover:bg-black/[0.02] dark:hover:bg-white/[0.02]'
                  )}
                  title={s.desc}
                >
                  <Icon size={14} className={active ? 'text-primary' : 'text-soft'} />
                  <span className="text-xs">{s.label}</span>
                </button>
              );
            })}
          </div>

          {/* Context tip for meeting / system audio */}
          {r.audioSource !== 'mic' && (
            <div className="flex items-start gap-1.5 p-2 rounded-lg surface-2 border border-app text-[11px] text-muted animate-fade-in mt-1.5">
              <Info size={13} className="text-primary mt-0.5 shrink-0" />
              <span>
                {r.audioSource === 'system'
                  ? "When prompted by your browser, choose 'Chrome Tab' or 'Entire Screen' and check 'Also share audio'."
                  : "Meeting mode mixes your microphone with Zoom, Teams, or Meet callers into one synchronized recording."}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Waveform visualizer */}
      <Waveform levels={r.levels} active={r.state === 'recording'} />

      {r.error && (
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 px-3 py-2 text-xs">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span>{r.error}</span>
        </div>
      )}

      {/* Action Controls */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        {r.state === 'idle' && (
          <button onClick={() => r.start()} className="btn-primary w-full sm:w-auto">
            {r.audioSource === 'meeting' ? (
              <Users size={16} />
            ) : r.audioSource === 'system' ? (
              <Monitor size={16} />
            ) : (
              <Mic size={16} />
            )}
            <span>
              {r.audioSource === 'mic'
                ? 'Start Voice Recording'
                : r.audioSource === 'system'
                ? 'Capture System Audio'
                : 'Start Meeting Recording'}
            </span>
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
          <span className="text-xs text-muted flex items-center gap-1.5">
            <Loader2 size={14} className="animate-spin" /> Saving audio…
          </span>
        )}
        {saved && r.state === 'idle' && (
          <span className="text-xs text-primary flex items-center gap-1.5 animate-fade-in">
            <Check size={14} /> Saved to library
          </span>
        )}
      </div>
    </div>
  );
}
