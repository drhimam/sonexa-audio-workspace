import { useCallback, useRef, useState } from 'react';
import { Upload, FileAudio, FileVideo, Loader2, Check, AlertCircle } from 'lucide-react';
import { clsx, formatBytes } from '@/lib/utils';

interface UploadDropzoneProps {
  onUpload: (file: File) => Promise<void>;
  busy?: boolean;
}

const AUDIO_EXTS = ['mp3', 'wav', 'm4a', 'webm', 'ogg', 'flac', 'aac', 'opus', 'mp4', 'mov', 'mkv', 'avi'];
const MAX_BYTES = 500 * 1024 * 1024; // 500 MB

function fileKind(name: string): 'audio' | 'video' | 'unknown' {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (['mp4', 'mov', 'mkv', 'avi', 'webm'].includes(ext)) return 'video';
  if (AUDIO_EXTS.includes(ext)) return 'audio';
  return 'unknown';
}

export function UploadDropzone({ onUpload, busy }: UploadDropzoneProps) {
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ name: string; size: number } | null>(null);
  const [done, setDone] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    setDone(false);
    const kind = fileKind(file.name);
    if (kind === 'unknown') {
      setError(`Unsupported file type: ${file.name}. Use audio (mp3, wav, m4a, webm, ogg, flac) or video (mp4, mov, mkv, webm).`);
      return;
    }
    if (file.size > MAX_BYTES) {
      setError(`File is too large (${formatBytes(file.size)}). Max 500 MB.`);
      return;
    }
    setProgress({ name: file.name, size: file.size });
    try {
      await onUpload(file);
      setDone(true);
      setTimeout(() => { setProgress(null); setDone(false); }, 2200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
      setProgress(null);
    }
  }, [onUpload]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (busy) return;
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }, [busy, handleFile]);

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-3">
        <Upload size={16} className="text-primary" />
        <h3 className="text-sm font-semibold">Upload file</h3>
        <span className="text-[11px] text-soft ml-1">Audio or video</span>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); if (!busy) setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => !busy && !progress && inputRef.current?.click()}
        className={clsx(
          'relative rounded-xl border-2 border-dashed px-4 py-7 text-center cursor-pointer transition-colors',
          dragging ? 'border-primary bg-primary/5' : 'border-app hover:border-primary/50 hover:bg-black/[0.02] dark:hover:bg-white/[0.03]',
          (busy || !!progress) && 'pointer-events-none opacity-70',
        )}
      >
        <input ref={inputRef} type="file" accept="audio/*,video/*" onChange={onPick} className="hidden" />

        {progress ? (
          <div className="flex flex-col items-center gap-2">
            {done ? <Check size={22} className="text-primary" /> : <Loader2 size={22} className="animate-spin text-primary" />}
            <div className="text-sm font-medium truncate max-w-full">{progress.name}</div>
            <div className="text-[11px] text-muted">{formatBytes(progress.size)} · {done ? 'Saved' : 'Saving…'}</div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-2 text-soft">
              <FileAudio size={22} />
              <FileVideo size={22} />
            </div>
            <p className="text-sm font-medium">Drag & drop an audio or video file</p>
            <p className="text-[11px] text-muted">or click to browse · up to 500 MB</p>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 px-3 py-2 text-xs">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
