import { useCallback, useEffect, useRef, useState } from 'react';

export interface AudioPlayer {
  url: string | null;
  durationSec: number;
  currentSec: number;
  playing: boolean;
  ready: boolean;
  load: (url: string) => void;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  seek: (sec: number) => void;
  stop: () => void;
}

export function useAudioPlayer(): AudioPlayer {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [durationSec, setDurationSec] = useState(0);
  const [currentSec, setCurrentSec] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;
    const onLoaded = () => { setDurationSec(audio.duration || 0); setReady(true); };
    const onTime = () => setCurrentSec(audio.currentTime || 0);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => setPlaying(false);
    audio.addEventListener('loadedmetadata', onLoaded);
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.pause();
      audio.removeEventListener('loadedmetadata', onLoaded);
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
      if (url) URL.revokeObjectURL(url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = useCallback((newUrl: string) => {
    const audio = audioRef.current;
    if (!audio) return;
    if (url) URL.revokeObjectURL(url);
    setUrl(newUrl);
    setReady(false);
    setDurationSec(0);
    setCurrentSec(0);
    audio.src = newUrl;
    audio.load();
  }, [url]);

  const play = useCallback(() => { audioRef.current?.play().catch(() => {}); }, []);
  const pause = useCallback(() => { audioRef.current?.pause(); }, []);
  const toggle = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) a.play().catch(() => {}); else a.pause();
  }, []);
  const seek = useCallback((sec: number) => {
    const a = audioRef.current;
    if (a) { a.currentTime = sec; setCurrentSec(sec); }
  }, []);
  const stop = useCallback(() => {
    const a = audioRef.current;
    if (a) { a.pause(); a.currentTime = 0; setCurrentSec(0); setPlaying(false); }
  }, []);

  return { url, durationSec, currentSec, playing, ready, load, play, pause, toggle, seek, stop };
}
