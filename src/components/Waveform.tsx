import { clsx } from '@/lib/utils';

interface WaveformProps {
  levels: number[];
  active: boolean;
  bars?: number;
  className?: string;
}

// Renders a centered amplitude bar visualizer. Bars grow symmetrically from
// the middle horizontal axis so it reads as a classic waveform.
export function Waveform({ levels, active, className }: WaveformProps) {
  return (
    <div className={clsx('flex items-center justify-center gap-[3px] h-24', className)}>
      {levels.map((v, i) => {
        const h = Math.max(4, v * 96);
        return (
          <span
            key={i}
            className={clsx(
              'w-[3px] rounded-full transition-all duration-75',
              active ? 'bg-primary' : 'bg-primary/30',
            )}
            style={{ height: `${h}%` }}
          />
        );
      })}
    </div>
  );
}
