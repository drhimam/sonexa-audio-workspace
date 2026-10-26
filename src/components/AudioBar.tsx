import { useEffect, useState } from 'react';
import { Play, Pause, Download, Loader2 } from 'lucide-react';
import { useAudioPlayer } from '@/lib/useAudioPlayer';
import { formatTime, clsx } from '@/lib/utils';

interface AudioBarProps {
  audioUrl: string | null;
  loading: boolean;
  onDownload?: () => void;
  activeSegmentStart?: number | null;
  onSeek?: (sec: number) => void;
}

export function AudioBar({ audioUrl, loading, onDownload }: AudioBarProps) {
  const player = useAudioPlayer();
  const [progressRatio, setProgressRatio] = useState(0);

  useEffect(() => {
    if (audioUrl) player.load(audioUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioUrl]);

  useEffect(() => {
    setProgressRatio(player.durationSec ? player.currentSec / player.durationSec : 0);
  }, [player.currentSec, player.durationSec]);

  if (loading) {
    return (
      <div className="card px-4 py-3 flex items-center gap-3 text-sm text-muted">
        <Loader2 size={16} className="animate-spin text-primary" /> Loading audio…
      </div>
    );
  }
  if (!audioUrl) return null;

  const seekFromEvent = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const sec = ratio * (player.durationSec || 0);
    player.seek(sec);
  };

  return (
    <div className="card px-3 py-2.5 flex items-center gap-3">
      <button onClick={player.toggle} className="btn-primary !px-2.5 !py-2 rounded-full" aria-label={player.playing ? 'Pause' : 'Play'}>
        {player.playing ? <Pause size={16} /> : <Play size={16} />}
      </button>
      <span className="font-mono text-xs tabular-nums text-muted w-12 text-right">{formatTime(player.currentSec)}</span>
      <div
        className="flex-1 h-2 rounded-full surface-2 relative cursor-pointer group"
        onClick={seekFromEvent}
        role="slider"
        aria-valuenow={Math.round(progressRatio * 100)}
      >
        <div className="absolute inset-y-0 left-0 rounded-full bg-primary transition-[width] duration-150" style={{ width: `${progressRatio * 100}%` }} />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-primary shadow opacity-0 group-hover:opacity-100 transition"
          style={{ left: `calc(${progressRatio * 100}% - 6px)` }}
        />
      </div>
      <span className="font-mono text-xs tabular-nums text-soft w-12">{formatTime(player.durationSec)}</span>
      {onDownload && (
        <button onClick={onDownload} className="btn-ghost !px-2 rounded-md" aria-label="Download audio">
          <Download size={15} />
        </button>
      )}
      <span className={clsx('chip', player.playing ? 'bg-primary/10 text-primary' : 'surface-2 text-muted')}>
        {player.playing ? 'Playing' : 'Ready'}
      </span>
    </div>
  );
}
