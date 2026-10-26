import { useEffect } from 'react';
import { X } from 'lucide-react';
import { clsx } from '@/lib/utils';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string;
}

export function Modal({ open, onClose, title, subtitle, icon, children, footer, maxWidth = 'max-w-lg' }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className={clsx('relative w-full surface border border-app rounded-2xl shadow-soft-dark animate-slide-up flex flex-col max-h-[90vh]', maxWidth)}>
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-app">
          <div className="flex items-start gap-3 min-w-0">
            {icon && <div className="mt-0.5 text-primary shrink-0">{icon}</div>}
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-[var(--text)] truncate">{title}</h2>
              {subtitle && <p className="text-xs text-muted mt-0.5">{subtitle}</p>}
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost p-1.5 rounded-md -mr-1.5" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto scroll-thin px-5 py-4">{children}</div>
        {footer && <div className="px-5 py-3.5 border-t border-app surface-2 rounded-b-2xl flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}
