import { useCallback, useEffect, useRef, useState } from 'react';

export type AudioSourceMode = 'mic' | 'system' | 'meeting';
export type RecorderState = 'idle' | 'recording' | 'paused' | 'stopping';

export interface RecorderController {
  state: RecorderState;
  elapsedSec: number;
  error: string | null;
  levels: number[];
  audioSource: AudioSourceMode;
  setAudioSource: (source: AudioSourceMode) => void;
  start: (source?: AudioSourceMode) => Promise<void>;
  pause: () => void;
  resume: () => void;
  stop: () => Promise<{ blob: Blob; durationSec: number } | null>;
  discard: () => void;
}

const SAMPLE_COUNT = 48; // bars shown in waveform

export function useRecorder(defaultSource: AudioSourceMode = 'meeting'): RecorderController {
  const [state, setState] = useState<RecorderState>('idle');
  const [elapsedSec, setElapsedSec] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [levels, setLevels] = useState<number[]>(() => Array(SAMPLE_COUNT).fill(0));
  const [audioSource, setAudioSource] = useState<AudioSourceMode>(defaultSource);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rawStreamsRef = useRef<MediaStream[]>([]);
  const chunksRef = useRef<Blob[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const accumulatedRef = useRef<number>(0);
  const timerRef = useRef<number | null>(null);
  const levelBufferRef = useRef<number[]>(Array(SAMPLE_COUNT).fill(0));

  const stopTimer = () => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const stopAnalyser = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  const teardownStream = useCallback(() => {
    // Stop all sub-streams (mic, display/system audio)
    for (const s of rawStreamsRef.current) {
      s.getTracks().forEach((t) => t.stop());
    }
    rawStreamsRef.current = [];

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

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

  const start = useCallback(
    async (sourceMode?: AudioSourceMode) => {
      setError(null);
      const mode = sourceMode || audioSource;

      try {
        const AC =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new AC();
        audioCtxRef.current = ctx;

        let recordStream: MediaStream;

        if (mode === 'mic') {
          // 1. Microphone Only
          const micStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
          });
          rawStreamsRef.current = [micStream];

          const source = ctx.createMediaStreamSource(micStream);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 1024;
          source.connect(analyser);
          analyserRef.current = analyser;

          recordStream = micStream;
        } else if (mode === 'system') {
          // 2. System / Tab Audio Only (e.g. YouTube, media playing, video call audio)
          if (!navigator.mediaDevices?.getDisplayMedia) {
            throw new Error('System audio capture is not supported in this browser.');
          }

          const displayStream = await navigator.mediaDevices.getDisplayMedia({
            video: { width: 1, height: 1, frameRate: 1 },
            audio: true,
          });

          const audioTracks = displayStream.getAudioTracks();
          displayStream.getVideoTracks().forEach((t) => t.stop());

          if (audioTracks.length === 0) {
            displayStream.getTracks().forEach((t) => t.stop());
            throw new Error(
              "No system audio captured. When the browser prompt opens, make sure to check 'Also share system audio' (or 'Share tab audio')."
            );
          }

          const sysAudioStream = new MediaStream([audioTracks[0]]);
          rawStreamsRef.current = [displayStream, sysAudioStream];

          const source = ctx.createMediaStreamSource(sysAudioStream);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 1024;
          source.connect(analyser);
          analyserRef.current = analyser;

          recordStream = sysAudioStream;
        } else {
          // 3. Meeting Mode: Mix Microphone (Your Voice) + System Audio (Other Callers / Teams / Zoom)
          if (!navigator.mediaDevices?.getDisplayMedia) {
            throw new Error('Screen / Meeting audio capture is not supported in this browser.');
          }

          // Request Mic
          const micStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
          });

          // Request System / Meeting Window Audio
          let displayStream: MediaStream;
          try {
            displayStream = await navigator.mediaDevices.getDisplayMedia({
              video: { width: 1, height: 1, frameRate: 1 },
              audio: true,
            });
          } catch (displayErr) {
            micStream.getTracks().forEach((t) => t.stop());
            throw displayErr;
          }

          const sysAudioTracks = displayStream.getAudioTracks();
          displayStream.getVideoTracks().forEach((t) => t.stop());

          if (sysAudioTracks.length === 0) {
            micStream.getTracks().forEach((t) => t.stop());
            displayStream.getTracks().forEach((t) => t.stop());
            throw new Error(
              "No meeting audio captured. In the share prompt, choose your Zoom/Teams window or screen and check 'Also share system audio'."
            );
          }

          const sysAudioStream = new MediaStream([sysAudioTracks[0]]);
          rawStreamsRef.current = [micStream, displayStream, sysAudioStream];

          // Mix both into a single Web Audio Destination
          const destination = ctx.createMediaStreamDestination();
          const micSource = ctx.createMediaStreamSource(micStream);
          const sysSource = ctx.createMediaStreamSource(sysAudioStream);

          micSource.connect(destination);
          sysSource.connect(destination);

          // Route to Analyser for live visualizer
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 1024;
          micSource.connect(analyser);
          sysSource.connect(analyser);
          analyserRef.current = analyser;

          recordStream = destination.stream;
        }

        streamRef.current = recordStream;

        // Create MediaRecorder
        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : MediaRecorder.isTypeSupported('audio/mp4')
          ? 'audio/mp4'
          : 'audio/webm';

        const mr = new MediaRecorder(recordStream, { mimeType });
        chunksRef.current = [];
        mr.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };

        mediaRecorderRef.current = mr;
        mr.start(100);

        accumulatedRef.current = 0;
        levelBufferRef.current = Array(SAMPLE_COUNT).fill(0);
        setState('recording');
        startTimer();
        runAnalyser();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Could not access audio device';
        // User cancelled picker or permission denied
        if (msg.includes('Permission denied') || msg.includes('cancelled')) {
          setError('Audio capture cancelled or permission denied.');
        } else {
          setError(msg);
        }
        teardownStream();
        setState('idle');
      }
    },
    [audioSource, runAnalyser, startTimer, teardownStream]
  );

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
      try {
        mr.stop();
      } catch {
        // ignore already inactive recorder
      }
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

  return {
    state,
    elapsedSec,
    error,
    levels,
    audioSource,
    setAudioSource,
    start,
    pause,
    resume,
    stop,
    discard,
  };
}
