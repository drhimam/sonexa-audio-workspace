import { useCallback, useEffect, useRef, useState } from 'react';

export type RecorderState = 'idle' | 'recording' | 'paused' | 'stopping';

export interface RecorderController {
  state: RecorderState;
  elapsedSec: number;
  error: string | null;
  levels: number[]; // recent amplitude samples for waveform
  start: () => Promise<void>;
  pause: () => void;
  resume: () => void;
  stop: () => Promise<{ blob: Blob; durationSec: number } | null>;
  discard: () => void;
}

const SAMPLE_COUNT = 48; // bars shown in waveform

export function useRecorder(): RecorderController {
  const [state, setState] = useState<RecorderState>('idle');
  const [elapsedSec, setElapsedSec] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [levels, setLevels] = useState<number[]>(() => Array(SAMPLE_COUNT).fill(0));

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const accumulatedRef = useRef<number>(0); // ms accumulated before pause
  const timerRef = useRef<number | null>(null);
  const levelBufferRef = useRef<number[]>(Array(SAMPLE_COUNT).fill(0));

  const stopTimer = () => {
    if (timerRef.current) { window.clearInterval(timerRef.current); timerRef.current = null; }
  };

  const stopAnalyser = () => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
  };

  const teardownStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close().catch(() => {});
    }
    audioCtxRef.current = null;
    analyserRef.current = null;
    stopAnalyser();
  }, []);

  const runAnalyser = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const buf = new Uint8Array(analyser.fftSize);
    const tick = () => {
      if (!analyserRef.current) return;
      analyserRef.current.getByteTimeDomainData(buf);
      // Compute RMS amplitude (0..1).
      let sum = 0;
      for (let i = 0; i < buf.length; i++) {
        const v = (buf[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / buf.length);
      const normalized = Math.min(1, rms * 2.2);
      const arr = levelBufferRef.current;
      arr.push(normalized);
      if (arr.length > SAMPLE_COUNT) arr.shift();
      setLevels([...arr]);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const startTimer = useCallback(() => {
    stopTimer();
    startTimeRef.current = performance.now();
    timerRef.current = window.setInterval(() => {
      const now = performance.now();
      const total = accumulatedRef.current + (now - startTimeRef.current);
      setElapsedSec(Math.floor(total / 1000));
    }, 200);
  }, []);

  const start = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AC();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser);
      analyserRef.current = analyser;

      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mediaRecorderRef.current = mr;
      mr.start(100);

      accumulatedRef.current = 0;
      levelBufferRef.current = Array(SAMPLE_COUNT).fill(0);
      setState('recording');
      startTimer();
      runAnalyser();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not access microphone');
      teardownStream();
      setState('idle');
    }
  }, [runAnalyser, startTimer, teardownStream]);

  const pause = useCallback(() => {
    const mr = mediaRecorderRef.current;
    if (!mr || mr.state !== 'recording') return;
    mr.pause();
    accumulatedRef.current += performance.now() - startTimeRef.current;
    stopTimer();
    stopAnalyser();
    setState('paused');
  }, []);

  const resume = useCallback(() => {
    const mr = mediaRecorderRef.current;
    if (!mr || mr.state !== 'paused') return;
    mr.resume();
    startTimer();
    runAnalyser();
    setState('recording');
  }, [runAnalyser, startTimer]);

  const stop = useCallback(async () => {
    const mr = mediaRecorderRef.current;
    if (!mr) return null;
    setState('stopping');
    if (mr.state === 'recording') {
      accumulatedRef.current += performance.now() - startTimeRef.current;
    }
    stopTimer();
    stopAnalyser();
    const durationSec = Math.max(1, Math.round(accumulatedRef.current / 1000));
    const stopped = new Promise<Blob>((resolve) => {
      mr.onstop = () => {
        const type = mr.mimeType || 'audio/webm';
        resolve(new Blob(chunksRef.current, { type }));
      };
    });
    mr.stop();
    const blob = await stopped;
    teardownStream();
    mediaRecorderRef.current = null;
    setState('idle');
    setElapsedSec(0);
    levelBufferRef.current = Array(SAMPLE_COUNT).fill(0);
    setLevels(Array(SAMPLE_COUNT).fill(0));
    return { blob, durationSec };
  }, [teardownStream]);

  const discard = useCallback(() => {
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== 'inactive') {
      try { mr.stop(); } catch { /* ignore */ }
    }
    teardownStream();
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    accumulatedRef.current = 0;
    stopTimer();
    setState('idle');
    setElapsedSec(0);
    setLevels(Array(SAMPLE_COUNT).fill(0));
  }, [teardownStream]);

  // Cleanup on unmount
  useEffect(() => () => {
    teardownStream();
    stopTimer();
  }, [teardownStream]);

  return { state, elapsedSec, error, levels, start, pause, resume, stop, discard };
}
